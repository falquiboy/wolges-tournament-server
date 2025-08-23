use crate::models::*;
use crate::wolges_engine::WolgesEngine;
use std::collections::HashMap;
use uuid::Uuid;
use chrono::Utc;
use wolges::{alphabet, bag};
use std::fs::{File, OpenOptions};
use std::io::{Write, BufWriter};

pub struct TournamentManager {
    pub tournaments: HashMap<Uuid, Tournament>,
    pub engine: Option<WolgesEngine>,
    bags: HashMap<Uuid, bag::Bag>,  // Bolsa por torneo
}

impl TournamentManager {
    pub fn new() -> Self {
        Self {
            tournaments: HashMap::new(),
            engine: None,
            bags: HashMap::new(),
        }
    }
    
    pub fn load_dictionary(&mut self, kwg_path: &str, klv_path: Option<&str>) -> Result<(), String> {
        self.engine = Some(WolgesEngine::new(kwg_path, klv_path)?);
        Ok(())
    }
    
    pub fn create_tournament(&mut self, name: String, player_names: Vec<String>) -> Result<Tournament, String> {
        let engine = self.engine.as_ref()
            .ok_or("Dictionary not loaded. Load a KWG file first.")?;
        
        let id = Uuid::new_v4();
        let players: Vec<Player> = player_names.into_iter().map(|name| {
            Player {
                id: Uuid::new_v4(),
                name,
                total_score: 0,
                plays: Vec::new(),
            }
        }).collect();
        
        // Crear bolsa nueva con las 100 fichas españolas
        let alphabet = engine.get_alphabet();
        let mut new_bag = bag::Bag::new(alphabet);
        
        // Debug: Log tile distribution
        eprintln!("DEBUG: Alphabet size: {}", alphabet.len());
        eprintln!("DEBUG: Using spanish-internal config: {}", alphabet.len() > 26);
        
        // Track all N-related tiles
        let mut n_tiles = Vec::new();
        
        for tile in 0..alphabet.len() {
            let letter = alphabet.of_board(tile).unwrap_or("?");
            let freq = alphabet.freq(tile);
            if freq > 0 {
                eprintln!("  Tile {}: '{}' (bytes: {:?}) x{}", tile, letter, letter.as_bytes(), freq);
                
                // Track any tile that could be N or Ñ
                if letter.contains('N') || letter.contains('n') || 
                   letter.contains('Ñ') || letter.contains('ñ') ||
                   letter.as_bytes() == &[195, 145] || // Ñ UTF-8
                   letter.as_bytes() == &[195, 177] || // ñ UTF-8
                   letter == "~n" || letter == "n~" {   // Possible ASCII representations
                    n_tiles.push((tile, letter, freq));
                }
            }
        }
        
        eprintln!("DEBUG: N-related tiles found: {:?}", n_tiles);
        eprintln!("DEBUG: Total tiles in bag: {}", new_bag.0.len());
        
        // Mezclar la bolsa
        use rand::thread_rng;
        let mut rng = thread_rng();
        new_bag.shuffle(&mut rng);
        
        let tiles_remaining = new_bag.0.len() as u8;
        self.bags.insert(id, new_bag);
        
        let tournament = Tournament {
            id,
            name,
            created_at: Utc::now(),
            status: TournamentStatus::Created,
            rounds: Vec::new(),
            players,
            tiles_remaining,
            master_plays: Vec::new(),
        };
        
        self.tournaments.insert(id, tournament.clone());
        
        // Create tournament directory for persistence
        use crate::persistence::PersistenceManager;
        if let Err(e) = PersistenceManager::create_tournament_directory(&id.to_string(), &tournament.name) {
            eprintln!("Failed to create tournament directory: {}", e);
        }
        
        // Save initial state
        if let Err(e) = PersistenceManager::save_tournament(&tournament, self, vec![]) {
            eprintln!("Failed to save tournament: {}", e);
        }
        
        // Log tournament start
        if let Err(e) = self.log_tournament_start(&tournament) {
            eprintln!("Failed to log tournament start: {}", e);
        }
        
        Ok(tournament)
    }
    
    pub fn get_tournament(&self, id: &Uuid) -> Option<&Tournament> {
        self.tournaments.get(id)
    }
    
    pub fn add_player(&mut self, tournament_id: &Uuid, name: &str, player_id: Uuid) -> Result<Tournament, String> {
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
            
        if tournament.status != TournamentStatus::Created {
            return Err("Cannot add players after tournament has started".to_string());
        }
        
        let player = Player {
            id: player_id,
            name: name.to_string(),
            total_score: 0,
            plays: Vec::new(),
        };
        
        tournament.players.push(player);
        let tournament_clone = tournament.clone();
        
        // Save updated tournament
        use crate::persistence::PersistenceManager;
        if let Err(e) = PersistenceManager::save_tournament(&tournament_clone, self, vec![]) {
            eprintln!("Failed to save tournament after adding player: {}", e);
        }
        
        Ok(tournament_clone)
    }
    
    pub fn validate_word(&self, word: &str) -> Result<bool, String> {
        let engine = self.engine.as_ref()
            .ok_or("Engine not initialized")?;
        Ok(engine.validate_word(word))
    }
    
    pub fn start_new_round(&mut self, tournament_id: &Uuid) -> Result<Round, String> {
        let engine = self.engine.as_ref()
            .ok_or("Engine not initialized")?;
        
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
        
        let bag = self.bags.get_mut(tournament_id)
            .ok_or("Bag not found for tournament")?;
        
        // Update tournament status if needed
        if tournament.status == TournamentStatus::Created {
            tournament.status = TournamentStatus::InProgress;
        }
        
        // Get current board state
        let board_state = if let Some(last_round) = tournament.rounds.last() {
            // Apply the optimal play from last round to the board
            let mut new_board = last_round.board_state.clone();
            
            if let Some(optimal) = &last_round.optimal_play {
                // Apply the optimal play to the board
                Self::apply_play_to_board(&mut new_board, &optimal)?;
            }
            
            new_board
        } else {
            // Empty board for first round
            BoardState {
                tiles: vec![String::new(); 225],
            }
        };
        
        let round_number = tournament.rounds.len() as u32 + 1;
        
        // Check if we need to preserve residue from last round
        let remaining_tiles = if let Some(last_round) = tournament.rounds.last() {
            if last_round.status == RoundStatus::Completed {
                if let Some(optimal) = &last_round.optimal_play {
                    // Get tiles that were not used in the last play
                    Self::get_remaining_rack_tiles(engine, &last_round.rack, &optimal.tiles_used, &optimal.blank_positions)?
                } else {
                    vec![]
                }
            } else {
                vec![]
            }
        } else {
            vec![]
        };
        
        // Generate rack with validation, considering remaining tiles
        let (rack, rejection_reason, tiles_remaining) = if remaining_tiles.is_empty() {
            Self::generate_valid_rack(engine, bag, round_number)?
        } else {
            Self::generate_rack_with_remaining(engine, bag, round_number, &remaining_tiles)?
        };
        
        // Update tiles remaining
        tournament.tiles_remaining = tiles_remaining;
        
        let round = Round {
            number: round_number,
            rack: rack.clone(),
            board_state,
            optimal_play: None,
            optimal_revealed: false,
            status: RoundStatus::Active,
            rack_rejected: rejection_reason.is_some(),
            rejection_reason,
            timer_started: None,  // El timer se inicia cuando el admin lo decide
        };
        
        tournament.rounds.push(round.clone());
        
        // Save tournament state after round creation
        use crate::persistence::PersistenceManager;
        let tournament_clone = tournament.clone();
        if let Err(e) = PersistenceManager::save_tournament(&tournament_clone, self, vec![]) {
            eprintln!("Failed to save tournament after round creation: {}", e);
        }
        
        // Log round
        if let Err(e) = self.log_round(tournament_id, &round) {
            eprintln!("Failed to log round: {}", e);
        }
        
        Ok(round)
    }
    
    pub fn update_round_rack(&mut self, tournament_id: &Uuid, round_number: u32, manual_rack: &str) -> Result<Round, String> {
        let engine = self.engine.as_mut()
            .ok_or("Engine not initialized")?;
            
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
            
        let bag = self.bags.get_mut(tournament_id)
            .ok_or("Bag not found for tournament")?;
            
        // Encontrar la ronda actual
        let round = tournament.rounds.iter_mut()
            .find(|r| r.number == round_number)
            .ok_or("Round not found")?;
            
        // Validar el rack manual usando el alfabeto interno (no el externo)
        // Primero convertir el rack manual de formato externo [CH] a interno Ç
        let internal_rack = manual_rack
            .replace("[CH]", "Ç")
            .replace("[LL]", "K")
            .replace("[RR]", "W");
        
        let alphabet = engine.get_alphabet();  // Usar alfabeto interno del motor
        let rack_bytes = internal_rack.as_bytes();
        let rack_reader = alphabet::AlphabetReader::new_for_racks(alphabet);
        let mut idx = 0;
        let mut tile_count = 0;
        let mut required_tiles = Vec::new();
        
        // Parse the manual rack to get the required tiles
        while idx < rack_bytes.len() {
            if let Some((tile, next_idx)) = rack_reader.next_tile(rack_bytes, idx) {
                required_tiles.push(tile);
                tile_count += 1;
                idx = next_idx;
            } else {
                return Err(format!("Ficha inválida en posición {}", idx));
            }
        }
        
        if tile_count != 7 {
            return Err(format!("El atril debe tener exactamente 7 fichas, se proporcionaron {}", tile_count));
        }
        
        // Validate rack criteria using the same rules as auto-generated racks
        let (vowels, consonants, blanks) = Self::count_tile_types(&required_tiles, alphabet);
        if let Some(rejection_reason) = Self::validate_rack_criteria(vowels, consonants, blanks, round.number) {
            return Err(rejection_reason);
        }
        
        // Check if all required tiles are available in the bag
        let mut bag_tiles = bag.0.clone();
        for &required_tile in &required_tiles {
            if let Some(pos) = bag_tiles.iter().position(|&t| t == required_tile) {
                bag_tiles.remove(pos);
            } else {
                return Err(format!("La ficha {} no está disponible en la bolsa", 
                    alphabet.of_board(required_tile).unwrap_or("?")));
            }
        }
        
        // FIXED: Only return old rack tiles if the rack wasn't rejected
        // If the rack was rejected, the tiles are already in the bag
        if !round.rack_rejected {
            let old_rack = &round.rack;
            let old_internal_rack = old_rack
                .replace("[CH]", "Ç")
                .replace("[LL]", "K")
                .replace("[RR]", "W");
            
            // Parse old rack to get tiles to return
            let old_rack_bytes = old_internal_rack.as_bytes();
            let mut old_idx = 0;
            let mut old_tiles = Vec::new();
            
            while old_idx < old_rack_bytes.len() {
                if let Some((tile, next_idx)) = rack_reader.next_tile(old_rack_bytes, old_idx) {
                    old_tiles.push(tile);
                    old_idx = next_idx;
                }
            }
            
            // Return old tiles to bag
            let old_tiles_count = old_tiles.len();
            for tile in old_tiles {
                bag.0.push(tile);
            }
            
            eprintln!("Returned {} old tiles to bag (rack was not rejected)", old_tiles_count);
        } else {
            eprintln!("Rack was rejected - tiles already in bag, not returning them again");
        }
        
        // Now remove the new tiles from the bag
        for &required_tile in &required_tiles {
            if let Some(pos) = bag.0.iter().position(|&t| t == required_tile) {
                bag.0.remove(pos);
            }
        }
        
        // Update tiles remaining count
        tournament.tiles_remaining = bag.0.len() as u8;
        
        eprintln!("Manual rack update: removed {} tiles from bag, {} tiles remaining", 
                 required_tiles.len(), tournament.tiles_remaining);
        
        // Actualizar el rack de la ronda
        round.rack = manual_rack.to_string();
        
        // IMPORTANTE: Cuando actualizamos el rack manualmente, NO recalculamos optimal_play
        // porque eso causaría que la siguiente ronda use las fichas "sobrantes" incorrectas.
        // Al dejar optimal_play como estaba (o None), evitamos que start_new_round
        // trate de preservar fichas del rack manual.
        round.optimal_play = None;
        round.rack_rejected = false;
        round.rejection_reason = None;
        
        Ok(round.clone())
    }
    
    pub fn start_new_round_manual(&mut self, tournament_id: &Uuid, manual_rack: &str) -> Result<Round, String> {
        let engine = self.engine.as_mut()
            .ok_or("Engine not initialized")?;
            
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
            
        let bag = self.bags.get_mut(tournament_id)
            .ok_or("Bag not found for tournament")?;
            
        // Update tournament status if needed
        if tournament.status == TournamentStatus::Created {
            tournament.status = TournamentStatus::InProgress;
        }
        
        // Get current board state
        let board_state = if let Some(last_round) = tournament.rounds.last() {
            // Apply the optimal play from last round to the board
            let mut new_board = last_round.board_state.clone();
            
            if let Some(optimal) = &last_round.optimal_play {
                // Apply the optimal play to the board
                Self::apply_play_to_board(&mut new_board, &optimal)?;
            }
            
            new_board
        } else {
            // Empty board for first round
            BoardState {
                tiles: vec![String::new(); 225],
            }
        };
        
        let round_number = tournament.rounds.len() as u32 + 1;
        
        // Validar el rack manual usando el alfabeto interno (no el externo)
        // Convertir formato externo [CH], [LL], [RR] a formato interno Ç, K, W
        let internal_rack = manual_rack
            .replace("[CH]", "Ç")
            .replace("[LL]", "K")
            .replace("[RR]", "W");
        
        let alphabet = engine.get_alphabet();  // Usar alfabeto interno del motor
        let rack_bytes = internal_rack.as_bytes();
        let rack_reader = alphabet::AlphabetReader::new_for_racks(alphabet);
        let mut idx = 0;
        let mut tile_count = 0;
        
        // Contar fichas para validar que sean 7
        while idx < rack_bytes.len() {
            if let Some((_tile, next_idx)) = rack_reader.next_tile(rack_bytes, idx) {
                tile_count += 1;
                idx = next_idx;
            } else {
                return Err(format!("Ficha inválida en posición {}", idx));
            }
        }
        
        if tile_count != 7 {
            return Err(format!("El atril debe tener exactamente 7 fichas, se proporcionaron {}", tile_count));
        }
        
        // Parse manual rack to remove tiles from bag (usar mismo rack convertido)
        let rack_bytes = internal_rack.as_bytes();
        let rack_reader = alphabet::AlphabetReader::new_for_racks(alphabet);
        let mut idx = 0;
        let mut required_tiles = Vec::new();
        
        // Get list of required tiles
        while idx < rack_bytes.len() {
            if let Some((tile, next_idx)) = rack_reader.next_tile(rack_bytes, idx) {
                required_tiles.push(tile);
                idx = next_idx;
            }
        }
        
        // Validate rack criteria using the same rules as auto-generated racks
        let (vowels, consonants, blanks) = Self::count_tile_types(&required_tiles, alphabet);
        let validation_error = Self::validate_rack_criteria(vowels, consonants, blanks, round_number);
        
        // Check if tiles are available (only if validation passed)
        let mut tiles_removed = false;
        let mut availability_error = None;
        
        if validation_error.is_none() {
            // Check if all required tiles are available in the bag
            let mut bag_tiles = bag.0.clone();
            for &required_tile in &required_tiles {
                if let Some(pos) = bag_tiles.iter().position(|&t| t == required_tile) {
                    bag_tiles.remove(pos);
                } else {
                    availability_error = Some(format!("La ficha {} no está disponible en la bolsa", 
                        alphabet.of_board(required_tile).unwrap_or("?")));
                    break;
                }
            }
            
            // Only remove tiles if all are available
            if availability_error.is_none() {
                for &required_tile in &required_tiles {
                    if let Some(pos) = bag.0.iter().position(|&t| t == required_tile) {
                        bag.0.remove(pos);
                    }
                }
                tiles_removed = true;
            }
        }
        
        // Update tiles remaining
        tournament.tiles_remaining = bag.0.len() as u8;
        
        // Determine if rack was rejected and why
        let (rack_rejected, rejection_reason) = if let Some(reason) = validation_error {
            (true, Some(reason))
        } else if let Some(reason) = availability_error {
            (true, Some(reason))
        } else {
            (false, None)
        };
        
        // Calculate optimal play only if rack is valid
        let optimal_play = if !rack_rejected {
            if let Ok(play) = engine.find_optimal_play(&board_state, manual_rack) {
                Some(play)
            } else {
                None
            }
        } else {
            None
        };
        
        let round = Round {
            number: round_number,
            rack: manual_rack.to_string(),
            board_state,
            optimal_play,
            optimal_revealed: false,
            status: RoundStatus::Active,
            rack_rejected,
            rejection_reason,
            timer_started: None,  // El timer se inicia cuando el admin lo decide
        };
        
        tournament.rounds.push(round.clone());
        
        // Log round
        if let Err(e) = self.log_round(tournament_id, &round) {
            eprintln!("Failed to log round: {}", e);
        }
        
        Ok(round)
    }
    
    pub fn calculate_optimal_play(&mut self, tournament_id: &Uuid, round_number: u32) -> Result<OptimalPlay, String> {
        let engine = self.engine.as_mut()
            .ok_or("Engine not initialized")?;
        
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
        
        let round = tournament.rounds.iter_mut()
            .find(|r| r.number == round_number)
            .ok_or("Round not found")?;
        
        if round.optimal_play.is_some() {
            return Ok(round.optimal_play.clone().unwrap());
        }
        
        let optimal = engine.find_optimal_play(&round.board_state, &round.rack)?;
        round.optimal_play = Some(optimal.clone());
        
        Ok(optimal)
    }
    
    pub fn submit_player_play(
        &mut self,
        tournament_id: &Uuid,
        player_id: &Uuid,
        round_number: u32,
        word: String,
        position: Position,
    ) -> Result<PlaySubmissionResponse, String> {
        let engine = self.engine.as_mut()
            .ok_or("Engine not initialized")?;
        
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
        
        let round = tournament.rounds.iter()
            .find(|r| r.number == round_number)
            .ok_or("Round not found")?;
        
        // Check if submission is within 3 minutes
        let now = Utc::now();
        let mut score = 0;
        let mut is_late = false;
        
        if let Some(timer_started) = round.timer_started {
            let elapsed = now.signed_duration_since(timer_started);
            if elapsed.num_seconds() > 180 { // 3 minutes = 180 seconds
                is_late = true;
                eprintln!("Jugada tardía: {} segundos después del límite", elapsed.num_seconds() - 180);
            }
        }
        
        // Calculate score for this play (0 if late or invalid)
        if !is_late {
            score = engine.calculate_score(
                &round.board_state,
                &round.rack,
                &position,
                &word
            ).unwrap_or(0); // Si la jugada es inválida, score = 0
        }
        
        // Get optimal play score for this round (should already be calculated)
        let optimal_score = round.optimal_play.as_ref()
            .map(|op| op.score)
            .unwrap_or_else(|| {
                eprintln!("Warning: Optimal play not calculated for round {}", round_number);
                score // Fallback to player's score
            });
        
        // Calculate percentage of optimal
        let percentage = if is_late { 
            0.0 
        } else if optimal_score > 0 { 
            (score as f32 / optimal_score as f32) * 100.0 
        } else { 
            100.0 
        };
        
        // Find player to get current cumulative values
        let player = tournament.players.iter_mut()
            .find(|p| &p.id == player_id)
            .ok_or("Player not found")?;
        
        // Calculate cumulative score
        let cumulative_score = player.total_score + score;
        
        // Calculate difference from optimal
        let difference_from_optimal = optimal_score - score;
        
        // Calculate cumulative difference
        let cumulative_difference = player.plays.iter()
            .map(|p| p.difference_from_optimal)
            .sum::<i32>() + difference_from_optimal;
        
        let play = PlayerPlay {
            round_number,
            word: if is_late { 
                format!("{} (TIEMPO EXCEDIDO)", word) 
            } else if score == 0 && !word.is_empty() {
                format!("{} (INVÁLIDA)", word)
            } else { 
                word 
            },
            position,
            score,
            percentage_of_optimal: percentage,
            submitted_at: now,
            cumulative_score,
            difference_from_optimal,
            cumulative_difference,
        };
        
        player.plays.push(play.clone());
        player.total_score = cumulative_score;
        
        // Save tournament state after player submission
        use crate::persistence::PersistenceManager;
        let tournament_clone = tournament.clone();
        if let Err(e) = PersistenceManager::save_tournament(&tournament_clone, self, vec![]) {
            eprintln!("Failed to save tournament after player submission: {}", e);
        }
        
        // Return only confirmation, not the percentage
        Ok(PlaySubmissionResponse {
            success: true,
            message: if is_late {
                "Jugada recibida pero fuera de tiempo".to_string()
            } else {
                "Jugada registrada correctamente".to_string()
            }
        })
    }
    
    pub fn get_round_feedback(
        &self,
        tournament_id: &Uuid,
        round_number: u32,
        player_id: &Uuid,
    ) -> Result<RoundFeedback, String> {
        let tournament = self.tournaments.get(tournament_id)
            .ok_or("Tournament not found")?;
        
        let round = tournament.rounds.iter()
            .find(|r| r.number == round_number)
            .ok_or("Round not found")?;
        
        // IMPORTANT: Only return feedback if optimal play has been revealed
        if !round.optimal_revealed {
            return Err("La jugada óptima aún no ha sido revelada".to_string());
        }
        
        let player = tournament.players.iter()
            .find(|p| &p.id == player_id)
            .ok_or("Player not found")?;
        
        let optimal_score = round.optimal_play.as_ref()
            .map(|op| op.score)
            .unwrap_or(0);
        
        // Find player's play for this round
        let player_play = player.plays.iter()
            .find(|p| p.round_number == round_number);
        
        if let Some(play) = player_play {
            // Player submitted a play
            let late_submission = play.word.contains("TIEMPO EXCEDIDO");
            let invalid_play = play.word.contains("INVÁLIDA");
            
            // Format coordinate for display
            let coord_str = if play.position.down {
                format!("{}{}", play.position.col + 1, ('A' as u8 + play.position.row) as char)
            } else {
                format!("{}{}", ('A' as u8 + play.position.row) as char, play.position.col + 1)
            };
            
            Ok(RoundFeedback {
                round_number,
                submitted: true,
                word: Some(play.word.clone()),
                position: Some(play.position.clone()),
                score: play.score,
                percentage_of_optimal: play.percentage_of_optimal,
                optimal_score,
                feedback_message: if late_submission {
                    "Causa: Tiempo excedido - 0% del óptimo".to_string()
                } else if invalid_play {
                    // Extract original word from "(INVÁLIDA)" format
                    let original_word = play.word.replace(" (INVÁLIDA)", "");
                    format!("Causa: Jugada inválida '{}' en {} - 0% del óptimo", original_word, coord_str)
                } else if play.percentage_of_optimal >= 100.0 {
                    "¡Excelente! Encontraste la jugada óptima".to_string()
                } else if play.percentage_of_optimal >= 80.0 {
                    format!("Muy buena jugada - {}% del óptimo", play.percentage_of_optimal.round() as i32)
                } else if play.percentage_of_optimal >= 60.0 {
                    format!("Buena jugada - {}% del óptimo", play.percentage_of_optimal.round() as i32)
                } else {
                    format!("Jugada registrada - {}% del óptimo", play.percentage_of_optimal.round() as i32)
                },
                late_submission,
            })
        } else {
            // Player didn't submit
            Ok(RoundFeedback {
                round_number,
                submitted: false,
                word: None,
                position: None,
                score: 0,
                percentage_of_optimal: 0.0,
                optimal_score,
                feedback_message: "Causa: No jugó - 0% del óptimo".to_string(),
                late_submission: false,
            })
        }
    }
    
    pub fn finish_tournament_manually(&mut self, tournament_id: &Uuid) -> Result<(), String> {
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
        
        // Verificar que el torneo esté en progreso
        if tournament.status != TournamentStatus::InProgress {
            return Err("El torneo no está en progreso".to_string());
        }
        
        // Verificar que haya al menos una ronda completada
        let completed_rounds = tournament.rounds.iter()
            .filter(|r| r.status == RoundStatus::Completed)
            .count();
            
        if completed_rounds == 0 {
            return Err("Debe completarse al menos una ronda antes de terminar el torneo".to_string());
        }
        
        // Cambiar status a terminado
        tournament.status = TournamentStatus::Finished;
        
        // Obtener nombre del torneo antes de clonar
        let tournament_name = tournament.name.clone();
        
        // Guardar estado del torneo
        use crate::persistence::PersistenceManager;
        let tournament_clone = tournament.clone();
        drop(tournament); // Liberar el préstamo mutable
        
        if let Err(e) = PersistenceManager::save_tournament(&tournament_clone, self, vec![]) {
            eprintln!("Failed to save tournament after manual finish: {}", e);
        }
        
        println!("Tournament '{}' finished manually after {} rounds", 
                 tournament_name, completed_rounds);
        
        Ok(())
    }
    
    pub fn get_leaderboard(&self, tournament_id: &Uuid) -> Result<Vec<Player>, String> {
        let tournament = self.tournaments.get(tournament_id)
            .ok_or("Tournament not found")?;
        
        let mut players = tournament.players.clone();
        players.sort_by(|a, b| b.total_score.cmp(&a.total_score));
        
        Ok(players)
    }
    
    pub fn get_player_log(&self, tournament_id: &Uuid, player_id: &Uuid) -> Result<PlayerLog, String> {
        let tournament = self.tournaments.get(tournament_id)
            .ok_or("Tournament not found")?;
        
        let player = tournament.players.iter()
            .find(|p| &p.id == player_id)
            .ok_or("Player not found")?;
        
        // Build log entries for each round
        let mut log_entries = Vec::new();
        
        for round in &tournament.rounds {
            // Get the rack for this round
            let rack = &round.rack;
            
            // Find player's play for this round
            let player_play = player.plays.iter()
                .find(|p| p.round_number == round.number);
            
            // Get optimal play for this round
            let optimal_play = round.optimal_play.as_ref();
            
            // Get master play from tournament
            let master_play = tournament.master_plays.iter()
                .find(|mp| mp.round_number == round.number);
            
            if let Some(play) = player_play {
                let master_cumulative = master_play.map(|mp| mp.cumulative_score).unwrap_or(0);
                let cumulative_percentage = if master_cumulative > 0 {
                    (play.cumulative_score as f32 / master_cumulative as f32) * 100.0
                } else {
                    100.0 // Si master no tiene puntos, considerar 100%
                };
                
                log_entries.push(PlayerLogEntry {
                    round_number: round.number,
                    rack: rack.clone(),
                    player_coord: format_coordinate(&play.position),
                    player_word: play.word.clone(),
                    player_score: play.score,
                    player_cumulative: play.cumulative_score,
                    percentage: play.percentage_of_optimal,
                    cumulative_percentage,
                    difference: play.difference_from_optimal,
                    cumulative_difference: play.cumulative_difference,
                    master_coord: master_play.map(|mp| format_coordinate(&mp.position)).unwrap_or_default(),
                    master_word: master_play.map(|mp| mp.word.clone()).unwrap_or_default(),
                    master_score: master_play.map(|mp| mp.score).unwrap_or(0),
                    master_cumulative,
                });
            }
        }
        
        Ok(PlayerLog {
            player_name: player.name.clone(),
            entries: log_entries,
        })
    }
    
    fn apply_play_to_board(board: &mut BoardState, play: &OptimalPlay) -> Result<(), String> {
        let start_idx = if play.position.down {
            play.position.row as usize * 15 + play.position.col as usize
        } else {
            play.position.row as usize * 15 + play.position.col as usize
        };
        
        // First, validate that we're not overwriting existing tiles
        for (i, tile) in play.tiles_used.iter().enumerate() {
            if !tile.is_empty() {
                let idx = if play.position.down {
                    start_idx + i * 15
                } else {
                    start_idx + i
                };
                
                if idx >= 225 {
                    return Err("Play extends beyond board".to_string());
                }
                
                // Check if position is already occupied
                if !board.tiles[idx].is_empty() {
                    // Special case: wolges might be trying to place a tile that matches existing
                    // This happens when a word uses existing tiles as anchors
                    // We should only reject if the tiles don't match
                    let existing = &board.tiles[idx];
                    let mut new_tile = tile.clone();
                    if i < play.blank_positions.len() && play.blank_positions[i] {
                        new_tile = tile.to_lowercase();
                    }
                    
                    // Normalize for comparison (handle digraphs and case)
                    let existing_normalized = existing.to_uppercase();
                    let new_normalized = new_tile.to_uppercase();
                    
                    if existing_normalized != new_normalized {
                        eprintln!("ERROR: Attempting to overwrite tile at position {} (row:{}, col:{})", 
                            idx, idx / 15, idx % 15);
                        eprintln!("  Existing tile: '{}' (normalized: '{}')", existing, existing_normalized);
                        eprintln!("  New tile: '{}' (normalized: '{}')", new_tile, new_normalized);
                        eprintln!("  Full play: word='{}', position=({},{},{})", 
                            play.word, play.position.row, play.position.col, 
                            if play.position.down { "down" } else { "across" });
                        
                        // This is a critical error - the engine shouldn't allow this
                        return Err(format!("Cannot overwrite existing tile '{}' at position ({},{}) with '{}'",
                            existing, idx / 15, idx % 15, new_tile));
                    }
                    // If tiles match, skip updating (tile already there)
                    continue;
                }
                
                // Only update the board position if we have a tile to place
                // Check if this position uses a blank by looking at blank_positions
                let mut tile_to_place = tile.clone();
                if i < play.blank_positions.len() && play.blank_positions[i] {
                    // This is a blank tile - store as lowercase
                    tile_to_place = tile.to_lowercase();
                }
                board.tiles[idx] = tile_to_place;
            }
            // If tile is empty, we skip updating that position (preserving existing tiles)
        }
        
        Ok(())
    }
    
    fn generate_valid_rack(engine: &WolgesEngine, bag: &mut bag::Bag, round_number: u32) -> Result<(String, Option<String>, u8), String> {
        let alphabet = engine.get_alphabet();
        let mut rack_tiles = Vec::new();
        
        // Sacar hasta 7 fichas de la bolsa
        let tiles_to_draw = std::cmp::min(7, bag.0.len());
        for _ in 0..tiles_to_draw {
            if let Some(tile) = bag.0.pop() {
                rack_tiles.push(tile);
                let letter = alphabet.of_board(tile).unwrap_or("?");
                eprintln!("Drew tile {} ('{}') - internal: '{:?}'", tile, letter, letter.as_bytes());
            }
        }
        
        // Convertir a string para mostrar
        let rack_str = Self::tiles_to_string(&rack_tiles, alphabet);
        eprintln!("Generated rack: {} from tiles {:?}", rack_str, rack_tiles);
        
        // Verify no duplicate Ñ (critical bug check)
        let n_with_tilde_count = rack_str.matches('Ñ').count() + rack_str.matches('ñ').count();
        if n_with_tilde_count > 1 {
            eprintln!("ERROR: Generated rack has {} Ñ tiles! This should be impossible!", n_with_tilde_count);
            eprintln!("Rack tiles debug: {:?}", rack_tiles.iter().map(|&t| (t, alphabet.of_board(t))).collect::<Vec<_>>());
        }
        
        // Validate rack if we have 7 tiles
        if rack_tiles.len() == 7 {
            let (vowels, consonants, blanks) = Self::count_tile_types(&rack_tiles, alphabet);
            
            // Use unified validation function
            if let Some(rejection_reason) = Self::validate_rack_criteria(vowels, consonants, blanks, round_number) {
                // IMPORTANTE: Devolver las fichas a la bolsa antes de rechazar
                for tile in rack_tiles {
                    bag.0.push(tile);
                }
                // CRITICAL FIX: Shuffle the bag after returning tiles to avoid repeated patterns
                use rand::thread_rng;
                use rand::seq::SliceRandom;
                let mut rng = thread_rng();
                bag.0.shuffle(&mut rng);
                let tiles_remaining = bag.0.len() as u8;
                return Ok((rack_str, Some(rejection_reason), tiles_remaining));
            }
        }
        
        let tiles_remaining = bag.0.len() as u8;
        Ok((rack_str, None, tiles_remaining))
    }
    
    fn count_tile_types(tiles: &[u8], alphabet: &alphabet::Alphabet) -> (u8, u8, u8) {
        let mut vowels = 0;
        let mut consonants = 0;
        let mut blanks = 0;
        
        for &tile in tiles {
            if tile == 0 {
                blanks += 1;
            } else if let Some(letter) = alphabet.of_board(tile) {
                match letter {
                    "A" | "E" | "I" | "O" | "U" => vowels += 1,
                    _ => consonants += 1,
                }
            }
        }
        
        (vowels, consonants, blanks)
    }
    
    /// Unified rack validation function for Spanish Scrabble tournament rules
    fn validate_rack_criteria(vowels: u8, consonants: u8, blanks: u8, round_number: u32) -> Option<String> {
        if round_number <= 15 {
            // Rounds 1-15: Maximum 5 consonants OR maximum 5 vowels
            // Note: With blanks, minimums don't apply (e.g., 5 vowels + 2 blanks = valid)
            if vowels > 5 {
                return Some(format!("Atril inválido (ronda {}): {} vocales exceden el máximo de 5", 
                    round_number, vowels));
            }
            if consonants > 5 {
                return Some(format!("Atril inválido (ronda {}): {} consonantes exceden el máximo de 5", 
                    round_number, consonants));
            }
            // Only check minimums if there are no blanks to compensate
            if blanks == 0 {
                if vowels < 2 {
                    return Some(format!("Atril inválido (ronda {}): solo {} vocal{} (mínimo 2 cuando no hay comodines)", 
                        round_number, vowels, if vowels == 1 { "" } else { "es" }));
                }
                if consonants < 2 {
                    return Some(format!("Atril inválido (ronda {}): solo {} consonante{} (mínimo 2 cuando no hay comodines)", 
                        round_number, consonants, if consonants == 1 { "" } else { "s" }));
                }
            }
        } else {
            // Rounds 16+: At least 1 consonant OR vowel (blanks can substitute)
            if vowels == 0 && blanks == 0 {
                return Some(format!("Atril inválido (ronda {}): debe tener al menos 1 vocal o comodín", 
                    round_number));
            }
            if consonants == 0 && blanks == 0 {
                return Some(format!("Atril inválido (ronda {}): debe tener al menos 1 consonante o comodín", 
                    round_number));
            }
        }
        None
    }
    
    pub fn check_game_end_condition(&self, tournament_id: &Uuid) -> Result<(bool, Option<String>), String> {
        let engine = self.engine.as_ref()
            .ok_or("Engine not initialized")?;
        
        let bag = self.bags.get(tournament_id)
            .ok_or("Bag not found for tournament")?;
        
        let tournament = self.tournaments.get(tournament_id)
            .ok_or("Tournament not found")?;
        
        // REMOVED: Incorrect check for < 7 tiles
        // Games should only end when all vowels OR all consonants are on board
        
        let alphabet = engine.get_alphabet();
        
        // Count ALL vowels and consonants that exist in the game
        let mut total_vowels = 0;
        let mut total_consonants = 0;
        
        for tile in 0..alphabet.len() {
            if tile != 0 {  // Skip blanks
                if let Some(letter) = alphabet.of_board(tile) {
                    let freq = alphabet.freq(tile) as i32;
                    match letter {
                        "A" | "E" | "I" | "O" | "U" => total_vowels += freq,
                        _ => total_consonants += freq,
                    }
                }
            }
        }
        
        // Count vowels and consonants still in bag
        let mut vowels_in_bag = 0;
        let mut consonants_in_bag = 0;
        
        for &tile in &bag.0 {
            if tile != 0 {  // No es comodín
                if let Some(letter) = alphabet.of_board(tile) {
                    match letter {
                        "A" | "E" | "I" | "O" | "U" => vowels_in_bag += 1,
                        _ => consonants_in_bag += 1,
                    }
                }
            }
        }
        
        // Count vowels and consonants in current rack(s) - only for active rounds
        let mut vowels_in_racks = 0;
        let mut consonants_in_racks = 0;
        
        for round in &tournament.rounds {
            if round.status != crate::models::RoundStatus::Completed {
                // Parse the rack to count tiles
                let internal_rack = round.rack
                    .replace("[CH]", "ç")
                    .replace("[LL]", "k")
                    .replace("[RR]", "w");
                
                let rack_bytes = internal_rack.as_bytes();
                let rack_reader = alphabet::AlphabetReader::new_for_racks(alphabet);
                let mut idx = 0;
                
                while idx < rack_bytes.len() {
                    if let Some((tile, next_idx)) = rack_reader.next_tile(rack_bytes, idx) {
                        if tile != 0 {
                            if let Some(letter) = alphabet.of_board(tile) {
                                match letter {
                                    "A" | "E" | "I" | "O" | "U" => vowels_in_racks += 1,
                                    _ => consonants_in_racks += 1,
                                }
                            }
                        }
                        idx = next_idx;
                    } else {
                        break;
                    }
                }
            }
        }
        
        // Calculate how many vowels and consonants are on the board
        let vowels_on_board = total_vowels - vowels_in_bag - vowels_in_racks;
        let consonants_on_board = total_consonants - consonants_in_bag - consonants_in_racks;
        
        // Game ends when ALL vowels OR ALL consonants have been placed on the board
        if vowels_on_board >= total_vowels {
            return Ok((true, Some("Fin del juego: Todas las vocales han sido colocadas en el tablero".to_string())));
        }
        
        if consonants_on_board >= total_consonants {
            return Ok((true, Some("Fin del juego: Todas las consonantes han sido colocadas en el tablero".to_string())));
        }
        
        Ok((false, None))
    }
    
    fn tiles_to_string(tiles: &[u8], alphabet: &alphabet::Alphabet) -> String {
        // Use the provided alphabet and convert internal representation to display format
        tiles.iter()
            .filter_map(|&tile| {
                if tile == 0 {
                    Some("?".to_string())
                } else {
                    alphabet.of_board(tile).map(|s| {
                        // Debug Ñ issue
                        if s.contains("ñ") || s.contains("Ñ") || s.as_bytes() == &[195, 177] || s.as_bytes() == &[195, 145] {
                            eprintln!("DEBUG tiles_to_string: Found Ñ variant - tile: {}, str: '{}', bytes: {:?}", tile, s, s.as_bytes());
                        }
                        
                        // Convert internal representation to display format
                        // IMPORTANT: Only convert if these are the actual digraph tiles
                        // The digraph tiles in the internal alphabet are represented as Ç, K, W
                        // Individual C, H, L, R tiles should NOT be converted
                        match s {
                            "Ç" | "ç" => "[CH]".to_string(),
                            "K" | "k" => "[LL]".to_string(),
                            "W" | "w" => "[RR]".to_string(),
                            _ => s.to_uppercase() // Force uppercase for consistency
                        }
                    })
                }
            })
            .collect()
    }
    
    // Get tiles that remain in rack after a play
    fn get_remaining_rack_tiles(engine: &WolgesEngine, rack_str: &str, tiles_used: &[String], blank_positions: &[bool]) -> Result<Vec<u8>, String> {
        let alphabet = engine.get_alphabet();
        
        // Convert rack string to tiles
        let internal_rack = rack_str
            .replace("[CH]", "ç")
            .replace("[LL]", "k")
            .replace("[RR]", "w");
        
        let rack_bytes = internal_rack.as_bytes();
        let rack_reader = alphabet::AlphabetReader::new_for_racks(alphabet);
        let mut rack_tiles = Vec::new();
        let mut idx = 0;
        
        while idx < rack_bytes.len() {
            if let Some((tile, next_idx)) = rack_reader.next_tile(rack_bytes, idx) {
                rack_tiles.push(tile);
                let letter = alphabet.of_board(tile).unwrap_or("?");
                if letter.contains("ñ") || letter.contains("Ñ") || tile == 16 || tile == 17 {
                    eprintln!("DEBUG get_remaining_rack_tiles: Processing Ñ - tile: {}, letter: '{}'", tile, letter);
                }
                idx = next_idx;
            }
        }
        
        eprintln!("DEBUG: Original rack had {} tiles", rack_tiles.len());
        eprintln!("DEBUG: Rack tiles: {:?}", rack_tiles.iter().map(|&t| 
            if t == 0 { "?".to_string() } else { alphabet.of_board(t).unwrap_or("ERR").to_string() }
        ).collect::<Vec<_>>());
        
        // Remove used tiles from rack
        let mut remaining = rack_tiles.clone();
        for (i, tile_str) in tiles_used.iter().enumerate() {
            if !tile_str.is_empty() {
                // Check if this tile was a blank using the blank_positions array
                let is_blank = i < blank_positions.len() && blank_positions[i];
                
                if is_blank {
                    eprintln!("DEBUG: Tile '{}' at position {} is a blank", tile_str, i);
                    // Remove a blank (tile value 0) from the rack
                    if let Some(pos) = remaining.iter().position(|&t| t == 0) {
                        eprintln!("DEBUG: Removing blank from position {}", pos);
                        remaining.remove(pos);
                    } else {
                        eprintln!("WARNING: No blank found in rack to remove for '{}'", tile_str);
                    }
                } else {
                    // Normal tile removal
                    let internal_tile = tile_str
                        .replace("[CH]", "ç")
                        .replace("[LL]", "k")
                        .replace("[RR]", "w");
                    
                    let tile_bytes = internal_tile.as_bytes();
                    if let Some((tile, _)) = rack_reader.next_tile(tile_bytes, 0) {
                        // Remove first occurrence of this tile
                        if let Some(pos) = remaining.iter().position(|&t| t == tile) {
                            remaining.remove(pos);
                        }
                    }
                }
            }
        }
        
        eprintln!("DEBUG: After removing {} used tiles, {} tiles remain", 
                   tiles_used.iter().filter(|t| !t.is_empty()).count(), 
                   remaining.len());
        eprintln!("DEBUG: Remaining tiles: {:?}", remaining.iter().map(|&t| 
            if t == 0 { "?".to_string() } else { alphabet.of_board(t).unwrap_or("ERR").to_string() }
        ).collect::<Vec<_>>());
        
        Ok(remaining)
    }
    
    // Generate rack with remaining tiles from previous round
    fn generate_rack_with_remaining(
        engine: &WolgesEngine, 
        bag: &mut bag::Bag, 
        round_number: u32,
        remaining_tiles: &[u8]
    ) -> Result<(String, Option<String>, u8), String> {
        let alphabet = engine.get_alphabet();
        let mut rack_tiles = remaining_tiles.to_vec();
        let initial_remaining_count = remaining_tiles.len();
        
        eprintln!("DEBUG: Starting with {} remaining tiles from previous round", initial_remaining_count);
        
        // Track which tiles were drawn from bag
        let mut newly_drawn_tiles = Vec::new();
        
        // Draw new tiles to complete to 7
        let tiles_needed = 7 - rack_tiles.len();
        let tiles_to_draw = std::cmp::min(tiles_needed, bag.0.len());
        
        for _ in 0..tiles_to_draw {
            if let Some(tile) = bag.0.pop() {
                rack_tiles.push(tile);
                newly_drawn_tiles.push(tile);
                eprintln!("Drew tile {} ({})", tile, alphabet.of_board(tile).unwrap_or("?"));
            }
        }
        
        eprintln!("DEBUG: Drew {} new tiles from bag", newly_drawn_tiles.len());
        
        // Convert to string
        let rack_str = Self::tiles_to_string(&rack_tiles, alphabet);
        eprintln!("Generated rack: {} from {} tiles", rack_str, rack_tiles.len());
        
        // Validate rack if we have 7 tiles
        if rack_tiles.len() == 7 {
            let (vowels, consonants, blanks) = Self::count_tile_types(&rack_tiles, alphabet);
            
            // Use unified validation function
            if let Some(rejection_reason) = Self::validate_rack_criteria(vowels, consonants, blanks, round_number) {
                // IMPORTANTE: Devolver las fichas a la bolsa antes de rechazar
                for tile in rack_tiles {
                    bag.0.push(tile);
                }
                // CRITICAL FIX: Shuffle the bag after returning tiles to avoid repeated patterns
                use rand::thread_rng;
                use rand::seq::SliceRandom;
                let mut rng = thread_rng();
                bag.0.shuffle(&mut rng);
                let tiles_remaining = bag.0.len() as u8;
                return Ok((rack_str, Some(rejection_reason), tiles_remaining));
            }
        }
        
        let tiles_remaining = bag.0.len() as u8;
        Ok((rack_str, None, tiles_remaining))
    }
    
    pub fn reject_rack_and_regenerate(&mut self, tournament_id: &Uuid, round_number: u32) -> Result<Round, String> {
        let engine = self.engine.as_ref()
            .ok_or("Engine not initialized")?;
            
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
            
        let bag = self.bags.get_mut(tournament_id)
            .ok_or("Bag not found for tournament")?;
            
        // Buscar la ronda actual
        let round_idx = tournament.rounds.iter()
            .position(|r| r.number == round_number)
            .ok_or("Round not found")?;
            
        let current_rack = &tournament.rounds[round_idx].rack;
        let alphabet = engine.get_alphabet();
        
        // NUEVO COMPORTAMIENTO: Nunca preservar residuo en rechazos
        // Devolver TODAS las fichas del rack actual a la bolsa
        
        // Convertir el rack string de vuelta a tiles
        // IMPORTANTE: Usar mayúsculas para la representación interna
        let internal_rack = current_rack
            .replace("[CH]", "Ç")
            .replace("[LL]", "K")
            .replace("[RR]", "W");
        
        let mut tiles_to_return = Vec::new();
        let rack_bytes = internal_rack.as_bytes();
        let rack_reader = alphabet::AlphabetReader::new_for_racks(alphabet);
        let mut idx = 0;
        
        while idx < rack_bytes.len() {
            if let Some((tile, next_idx)) = rack_reader.next_tile(rack_bytes, idx) {
                tiles_to_return.push(tile);
                idx = next_idx;
            }
        }
        
        eprintln!("DEBUG: Rejecting rack - returning ALL {} tiles to bag", tiles_to_return.len());
        
        // Devolver TODAS las fichas a la bolsa y mezclar
        bag.0.extend_from_slice(&tiles_to_return);
        use rand::thread_rng;
        let mut rng = thread_rng();
        bag.shuffle(&mut rng);
        
        // Generar nuevo rack completamente desde cero (sin preservar residuo)
        let (new_rack, rejection_reason, tiles_remaining) = Self::generate_valid_rack(engine, bag, round_number)?;
        
        // Actualizar la ronda
        tournament.rounds[round_idx].rack = new_rack.clone();
        tournament.rounds[round_idx].rack_rejected = true;
        tournament.rounds[round_idx].rejection_reason = rejection_reason;
        tournament.rounds[round_idx].optimal_play = None; // Limpiar optimal_play para evitar residuos
        tournament.tiles_remaining = tiles_remaining;
        
        let result = tournament.rounds[round_idx].clone();
        
        // Save tournament state after rack rejection
        use crate::persistence::PersistenceManager;
        let tournament_clone = tournament.clone();
        if let Err(e) = PersistenceManager::save_tournament(&tournament_clone, self, vec![]) {
            eprintln!("Failed to save tournament after rack rejection: {}", e);
        }
        
        Ok(result)
    }
    
    pub fn start_round_timer(&mut self, tournament_id: &Uuid, round_number: u32) -> Result<(), String> {
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
        
        let round = tournament.rounds.iter_mut()
            .find(|r| r.number == round_number)
            .ok_or("Round not found")?;
        
        round.timer_started = Some(Utc::now());
        
        eprintln!("Timer iniciado para ronda {} a las {}", round_number, round.timer_started.unwrap());
        
        // Save tournament state after starting timer
        use crate::persistence::PersistenceManager;
        let tournament_clone = tournament.clone();
        if let Err(e) = PersistenceManager::save_tournament(&tournament_clone, self, vec![]) {
            eprintln!("Failed to save tournament after starting timer: {}", e);
        }
        
        Ok(())
    }
    
    pub fn reveal_optimal_play(&mut self, tournament_id: &Uuid, round_number: u32) -> Result<(), String> {
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
            
        let round = tournament.rounds.iter_mut()
            .find(|r| r.number == round_number)
            .ok_or("Round not found")?;
            
        round.optimal_revealed = true;
        
        // Save tournament state after revealing optimal play
        use crate::persistence::PersistenceManager;
        let tournament_clone = tournament.clone();
        if let Err(e) = PersistenceManager::save_tournament(&tournament_clone, self, vec![]) {
            eprintln!("Failed to save tournament after revealing optimal play: {}", e);
        }
        
        Ok(())
    }
    
    pub fn place_optimal_play(&mut self, tournament_id: &Uuid, round_number: u32) -> Result<(), String> {
        // First, get the optimal play data we need (to avoid borrowing conflicts)
        let (optimal_play_clone, board_state_clone, cumulative_score) = {
            let tournament = self.tournaments.get(tournament_id)
                .ok_or("Tournament not found")?;
                
            let round = tournament.rounds.iter()
                .find(|r| r.number == round_number)
                .ok_or("Round not found")?;
                
            let optimal_play = round.optimal_play.as_ref()
                .ok_or("No optimal play calculated for this round")?;
                
            let cumulative_score = tournament.master_plays.iter()
                .map(|p| p.score)
                .sum::<i32>() + optimal_play.score;
                
            (optimal_play.clone(), round.board_state.clone(), cumulative_score)
        };
        
        // Format the word with anchors if we have the play bytes
        let formatted_word = if let Some(play_bytes) = &optimal_play_clone.play_bytes {
            if let Some(engine) = &self.engine {
                // Format using wolges Display to show anchors
                match engine.format_play_word(&board_state_clone, play_bytes, &optimal_play_clone.position) {
                    Ok(formatted) => formatted,
                    Err(_) => optimal_play_clone.word.clone() // Fallback to simple word
                }
            } else {
                optimal_play_clone.word.clone()
            }
        } else {
            optimal_play_clone.word.clone()
        };
        
        // Now update the tournament with the mutable borrow
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
            
        // Verificar si ya existe un master_play para esta ronda (evitar duplicados)
        if tournament.master_plays.iter().any(|mp| mp.round_number == round_number) {
            return Err(format!("Master play already placed for round {}", round_number));
        }
            
        let master_play = MasterPlay {
            round_number,
            word: formatted_word,
            position: optimal_play_clone.position.clone(),
            score: optimal_play_clone.score,
            cumulative_score,
        };
        
        tournament.master_plays.push(master_play);
        
        let round = tournament.rounds.iter_mut()
            .find(|r| r.number == round_number)
            .ok_or("Round not found")?;
            
        round.optimal_revealed = true;
        round.status = RoundStatus::Completed;
        
        // Apply the optimal play to the board state
        if let Some(optimal_play) = &round.optimal_play {
            if let Err(e) = Self::apply_play_to_board(&mut round.board_state, optimal_play) {
                eprintln!("Failed to apply optimal play to board: {}", e);
                // Return the error to the client instead of silently continuing
                return Err(format!("Cannot place play: {}", e));
            }
        }
        
        // Log optimal play
        if let Err(e) = self.log_optimal_play(tournament_id, round_number) {
            eprintln!("Failed to log optimal play: {}", e);
        }
        
        // Verificar si el juego debe terminar
        match self.check_game_end_condition(tournament_id) {
            Ok((should_end, reason)) => {
                if should_end {
                    // Marcar el torneo como terminado
                    if let Some(tournament) = self.tournaments.get_mut(tournament_id) {
                        tournament.status = TournamentStatus::Finished;
                        eprintln!("Torneo terminado: {}", reason.unwrap_or_default());
                    }
                }
            }
            Err(e) => eprintln!("Error al verificar condición de fin: {}", e),
        }
        
        // Save tournament state after placing optimal play
        if let Some(tournament) = self.tournaments.get(tournament_id) {
            use crate::persistence::PersistenceManager;
            let tournament_clone = tournament.clone();
            if let Err(e) = PersistenceManager::save_tournament(&tournament_clone, self, vec![]) {
                eprintln!("Failed to save tournament after placing optimal play: {}", e);
            }
        }
        
        Ok(())
    }
    
    pub fn get_bag_tiles(&self, tournament_id: &Uuid) -> Result<Vec<(String, bool)>, String> {
        let engine = self.engine.as_ref()
            .ok_or("Engine not initialized")?;
            
        let bag = self.bags.get(tournament_id)
            .ok_or("Bag not found for tournament")?;
            
        let tournament = self.tournaments.get(tournament_id)
            .ok_or("Tournament not found")?;
            
        let alphabet = engine.get_alphabet();
        
        // Create a list of all tiles with their usage status
        let mut all_tiles = Vec::new();
        
        // Count tiles still in bag
        let mut tiles_in_bag = std::collections::HashMap::new();
        for &tile in &bag.0 {
            *tiles_in_bag.entry(tile).or_insert(0) += 1;
        }
        
        // Count tiles in ALL racks (current and from all previous rounds)
        let mut tiles_in_racks = std::collections::HashMap::new();
        for round in &tournament.rounds {
            // Convert rack string to tiles to count them
            let internal_rack = round.rack
                .replace("[CH]", "ç")
                .replace("[LL]", "k")
                .replace("[RR]", "w");
            
            let rack_bytes = internal_rack.as_bytes();
            let rack_reader = alphabet::AlphabetReader::new_for_racks(alphabet);
            let mut idx = 0;
            let mut rack_tiles = Vec::new();
            
            while idx < rack_bytes.len() {
                if let Some((tile, next_idx)) = rack_reader.next_tile(rack_bytes, idx) {
                    rack_tiles.push(tile);
                    idx = next_idx;
                }
            }
            
            // If round is completed, only count the remaining tiles (not used)
            if round.status == RoundStatus::Completed {
                if let Some(optimal) = &round.optimal_play {
                    // Remove used tiles from count
                    let mut remaining = rack_tiles.clone();
                    for tile_str in &optimal.tiles_used {
                        if !tile_str.is_empty() {
                            let internal_tile = tile_str
                                .replace("[CH]", "ç")
                                .replace("[LL]", "k")
                                .replace("[RR]", "w");
                            
                            let tile_bytes = internal_tile.as_bytes();
                            if let Some((tile, _)) = rack_reader.next_tile(tile_bytes, 0) {
                                if let Some(pos) = remaining.iter().position(|&t| t == tile) {
                                    remaining.remove(pos);
                                }
                            }
                        }
                    }
                    // Only count remaining tiles for completed rounds
                    for tile in remaining {
                        *tiles_in_racks.entry(tile).or_insert(0) += 1;
                    }
                }
            } else {
                // For active round, count all tiles in rack
                for tile in rack_tiles {
                    *tiles_in_racks.entry(tile).or_insert(0) += 1;
                }
            }
        }
        
        // Add all tiles from the alphabet
        for tile in 0..alphabet.len() {
            let tile_str = if tile == 0 {
                "?".to_string()
            } else {
                let internal_str = alphabet.of_board(tile).unwrap_or("").to_string();
                // Convert internal representation to display format
                match internal_str.as_str() {
                    "Ç" | "ç" => "[CH]".to_string(),
                    "K" | "k" => "[LL]".to_string(),
                    "W" | "w" => "[RR]".to_string(),
                    _ => internal_str.to_uppercase()
                }
            };
            
            let total_count = alphabet.freq(tile) as i32;
            let in_bag = tiles_in_bag.get(&tile).copied().unwrap_or(0);
            let in_racks = tiles_in_racks.get(&tile).copied().unwrap_or(0);
            
            // Add tiles still in bag (not used)
            for _ in 0..in_bag {
                all_tiles.push((tile_str.clone(), false));
            }
            
            // Add tiles that are in racks or on board (potentially/definitely used)
            for _ in 0..(total_count - in_bag) {
                all_tiles.push((tile_str.clone(), true));
            }
        }
        
        Ok(all_tiles)
    }
    
    pub fn undo_last_round(&mut self, tournament_id: &Uuid) -> Result<(), String> {
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
            
        if tournament.rounds.is_empty() {
            return Err("No rounds to undo".to_string());
        }
        
        // Get info about the last round before removing it
        let last_round_number;
        let last_round_status;
        {
            let last_round = tournament.rounds.last()
                .ok_or("No rounds found")?;
            
            // Can only undo completed rounds
            if last_round.status != RoundStatus::Completed {
                return Err("Can only undo completed rounds".to_string());
            }
            
            last_round_number = last_round.number;
            last_round_status = last_round.status.clone();
        }
        
        // Remove the last master play if it exists
        if !tournament.master_plays.is_empty() {
            let last_master_play = tournament.master_plays.last().unwrap();
            if last_master_play.round_number == last_round_number {
                tournament.master_plays.pop();
            }
        }
        
        // Return tiles to bag if they were from a manual rack
        // For auto-generated racks, tiles are already in the bag
        
        // Remove the round
        tournament.rounds.pop();
        
        // Capture data for logging before saving
        let log_name = tournament.name.replace(" ", "_");
        let log_date = tournament.created_at.format("%Y%m%d_%H%M%S");
        
        // Save tournament state after undo
        use crate::persistence::PersistenceManager;
        let tournament_clone = tournament.clone();
        if let Err(e) = PersistenceManager::save_tournament(&tournament_clone, self, vec![]) {
            eprintln!("Failed to save tournament after undo: {}", e);
        }
        
        // Log the undo action
        let filename = format!("tournament_{}_{}.log", log_name, log_date);
        
        if let Ok(mut file) = OpenOptions::new()
            .append(true)
            .open(&filename) {
            let _ = writeln!(file, "=== UNDO RONDA {} ===", last_round_number);
            let _ = writeln!(file, "Hora: {}", Utc::now().format("%H:%M:%S"));
            let _ = writeln!(file, "");
        }
        
        Ok(())
    }
    
    // Logging functions
    fn log_tournament_start(&self, tournament: &Tournament) -> Result<(), String> {
        let filename = format!("tournament_{}_{}.log", 
            tournament.name.replace(" ", "_"), 
            tournament.created_at.format("%Y%m%d_%H%M%S")
        );
        
        let mut file = File::create(&filename)
            .map_err(|e| format!("Failed to create log file: {}", e))?;
        
        writeln!(file, "=== TORNEO DE SCRABBLE DUPLICADO ===").map_err(|e| e.to_string())?;
        writeln!(file, "Nombre: {}", tournament.name).map_err(|e| e.to_string())?;
        writeln!(file, "Fecha: {}", tournament.created_at.format("%Y-%m-%d %H:%M:%S")).map_err(|e| e.to_string())?;
        writeln!(file, "Jugadores: {}", 
            tournament.players.iter()
                .map(|p| p.name.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        ).map_err(|e| e.to_string())?;
        writeln!(file, "").map_err(|e| e.to_string())?;
        
        Ok(())
    }
    
    fn log_round(&self, tournament_id: &Uuid, round: &Round) -> Result<(), String> {
        let tournament = self.tournaments.get(tournament_id)
            .ok_or("Tournament not found")?;
            
        let filename = format!("tournament_{}_{}.log", 
            tournament.name.replace(" ", "_"), 
            tournament.created_at.format("%Y%m%d_%H%M%S")
        );
        
        let mut file = OpenOptions::new()
            .append(true)
            .open(&filename)
            .map_err(|e| format!("Failed to open log file: {}", e))?;
        
        writeln!(file, "=== RONDA {} ===", round.number).map_err(|e| e.to_string())?;
        writeln!(file, "Atril: {}", round.rack).map_err(|e| e.to_string())?;
        
        if round.rack_rejected {
            writeln!(file, "Atril rechazado: {}", 
                round.rejection_reason.as_ref().unwrap_or(&"".to_string())
            ).map_err(|e| e.to_string())?;
        }
        
        Ok(())
    }
    
    pub fn restore_tournament(&mut self, tournament: Tournament) {
        let tournament_id = tournament.id.clone();
        
        // Recrear la bolsa basándose en las fichas restantes
        if let Some(engine) = &self.engine {
            let alphabet = engine.get_alphabet();
            let mut bag = bag::Bag::new(alphabet);
            
            // TODO: Reconstruir el estado exacto de la bolsa basándose en las fichas usadas
            // Por ahora, simplemente guardamos el torneo
            self.bags.insert(tournament_id, bag);
        }
        
        self.tournaments.insert(tournament_id, tournament);
    }
    
    fn log_optimal_play(&self, tournament_id: &Uuid, round_number: u32) -> Result<(), String> {
        let tournament = self.tournaments.get(tournament_id)
            .ok_or("Tournament not found")?;
            
        let round = tournament.rounds.iter()
            .find(|r| r.number == round_number)
            .ok_or("Round not found")?;
            
        if let Some(optimal) = &round.optimal_play {
            let filename = format!("tournament_{}_{}.log", 
                tournament.name.replace(" ", "_"), 
                tournament.created_at.format("%Y%m%d_%H%M%S")
            );
            
            let mut file = OpenOptions::new()
                .append(true)
                .open(&filename)
                .map_err(|e| format!("Failed to open log file: {}", e))?;
            
            // Formato español con convención de dirección:
            // Horizontal (→): Fila + Columna (ej: H8)
            // Vertical (↓): Columna + Fila (ej: 8H)
            let coord = if optimal.position.down {
                // Vertical: columna + fila
                format!("{}{}{}", 
                    optimal.position.col + 1,
                    ('A' as u8 + optimal.position.row) as char,
                    "↓"
                )
            } else {
                // Horizontal: fila + columna
                format!("{}{}{}", 
                    ('A' as u8 + optimal.position.row) as char,
                    optimal.position.col + 1,
                    "→"
                )
            };
            
            writeln!(file, "Jugada óptima: {} {} {} puntos", 
                coord, 
                optimal.word, 
                optimal.score
            ).map_err(|e| e.to_string())?;
            
            // Log tiles used (showing blanks as lowercase)
            // We need to track which tiles are blanks based on the word vs rack
            let tiles_str = optimal.tiles_used.iter()
                .enumerate()
                .filter(|(_, t)| !t.is_empty())
                .map(|(i, t)| {
                    // Check if this position uses a blank by looking at the word
                    // If the word has a lowercase letter at this position, it's a blank
                    if let Some(word_char) = optimal.word.chars().nth(i) {
                        if word_char.is_lowercase() {
                            format!("{}*", t) // Mark blanks with asterisk
                        } else {
                            t.to_string()
                        }
                    } else {
                        t.to_string()
                    }
                })
                .collect::<Vec<_>>()
                .join(" ");
            writeln!(file, "Fichas usadas: {}", tiles_str).map_err(|e| e.to_string())?;
            
            // Log cumulative score
            let cumulative_score = tournament.master_plays.iter()
                .map(|p| p.score)
                .sum::<i32>();
            writeln!(file, "Puntuación acumulada: {}", cumulative_score).map_err(|e| e.to_string())?;
            writeln!(file, "").map_err(|e| e.to_string())?;
        }
        
        Ok(())
    }
}

fn format_coordinate(position: &Position) -> String {
    let letters = "ABCDEFGHIJKLMNO";
    let row_letter = letters.chars().nth(position.row as usize).unwrap_or('?');
    
    if position.down {
        // Vertical: columna + fila
        format!("{}{}", position.col + 1, row_letter)
    } else {
        // Horizontal: fila + columna
        format!("{}{}", row_letter, position.col + 1)
    }
}