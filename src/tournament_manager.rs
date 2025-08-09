use crate::models::*;
use crate::wolges_engine::WolgesEngine;
use std::collections::HashMap;
use uuid::Uuid;
use chrono::Utc;
use wolges::{alphabet, bag};

pub struct TournamentManager {
    tournaments: HashMap<Uuid, Tournament>,
    engine: Option<WolgesEngine>,
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
        Ok(tournament)
    }
    
    pub fn get_tournament(&self, id: &Uuid) -> Option<&Tournament> {
        self.tournaments.get(id)
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
        
        // Generate rack with validation
        let (rack, rejection_reason, tiles_remaining) = Self::generate_valid_rack(engine, bag, round_number)?;
        
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
        };
        
        tournament.rounds.push(round.clone());
        
        Ok(round)
    }
    
    pub fn start_new_round_manual(&mut self, tournament_id: &Uuid, manual_rack: &str) -> Result<Round, String> {
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
        
        // Validar el rack manual usando el alfabeto español estándar
        // (el usuario ingresa con formato [CH], [LL], [RR])
        let spanish_alphabet = wolges::alphabet::make_spanish_alphabet();
        let rack_bytes = manual_rack.as_bytes();
        let rack_reader = alphabet::AlphabetReader::new_for_racks(&spanish_alphabet);
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
        
        // No actualizamos tiles_remaining porque no sacamos fichas de la bolsa
        
        let round = Round {
            number: round_number,
            rack: manual_rack.to_string(),
            board_state,
            optimal_play: None,
            optimal_revealed: false,
            status: RoundStatus::Active,
            rack_rejected: false,
            rejection_reason: None,
        };
        
        tournament.rounds.push(round.clone());
        
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
    ) -> Result<PlayerPlay, String> {
        let engine = self.engine.as_mut()
            .ok_or("Engine not initialized")?;
        
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
        
        let round = tournament.rounds.iter()
            .find(|r| r.number == round_number)
            .ok_or("Round not found")?;
        
        // Calculate score for this play
        let score = engine.calculate_score(
            &round.board_state,
            &round.rack,
            &position,
            &word
        )?;
        
        // Calculate percentage later after releasing the mutable borrow
        let percentage = 100.0; // We'll calculate this properly later
        
        let play = PlayerPlay {
            round_number,
            word,
            position,
            score,
            percentage_of_optimal: percentage,
        };
        
        // Add play to player
        let player = tournament.players.iter_mut()
            .find(|p| &p.id == player_id)
            .ok_or("Player not found")?;
        
        player.plays.push(play.clone());
        player.total_score += score;
        
        Ok(play)
    }
    
    pub fn get_leaderboard(&self, tournament_id: &Uuid) -> Result<Vec<Player>, String> {
        let tournament = self.tournaments.get(tournament_id)
            .ok_or("Tournament not found")?;
        
        let mut players = tournament.players.clone();
        players.sort_by(|a, b| b.total_score.cmp(&a.total_score));
        
        Ok(players)
    }
    
    fn apply_play_to_board(board: &mut BoardState, play: &OptimalPlay) -> Result<(), String> {
        let start_idx = if play.position.down {
            play.position.row as usize * 15 + play.position.col as usize
        } else {
            play.position.row as usize * 15 + play.position.col as usize
        };
        
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
                
                board.tiles[idx] = tile.clone();
            }
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
            }
        }
        
        // Convertir a string para mostrar
        let rack_str = Self::tiles_to_string(&rack_tiles, alphabet);
        
        // Validar solo si es ronda 1-15 y tenemos 7 fichas
        if round_number <= 15 && rack_tiles.len() == 7 {
            let (vowels, consonants, _blanks) = Self::count_tile_types(&rack_tiles, alphabet);
            
            if vowels > 5 {
                // Devolver fichas a la bolsa
                bag.0.extend_from_slice(&rack_tiles);
                use rand::thread_rng;
                let mut rng = thread_rng();
                bag.shuffle(&mut rng);
                
                let tiles_remaining = bag.0.len() as u8;
                return Ok((rack_str, Some(format!("Atril rechazado: {} vocales (máximo 5)", vowels)), tiles_remaining));
            }
            
            if consonants > 5 {
                // Devolver fichas a la bolsa
                bag.0.extend_from_slice(&rack_tiles);
                use rand::thread_rng;
                let mut rng = thread_rng();
                bag.shuffle(&mut rng);
                
                let tiles_remaining = bag.0.len() as u8;
                return Ok((rack_str, Some(format!("Atril rechazado: {} consonantes (máximo 5)", consonants)), tiles_remaining));
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
    
    fn tiles_to_string(tiles: &[u8], alphabet: &alphabet::Alphabet) -> String {
        // Always use Spanish alphabet for display to show [CH], [LL], [RR]
        let spanish_alphabet = wolges::alphabet::make_spanish_alphabet();
        tiles.iter()
            .filter_map(|&tile| {
                if tile == 0 {
                    Some("?".to_string())
                } else {
                    spanish_alphabet.of_board(tile).map(|s| s.to_string())
                }
            })
            .collect()
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
        
        // Convertir el rack string de vuelta a tiles
        let mut tiles_to_return = Vec::new();
        let rack_bytes = current_rack.as_bytes();
        let rack_reader = alphabet::AlphabetReader::new_for_racks(alphabet);
        let mut idx = 0;
        
        while idx < rack_bytes.len() {
            if let Some((tile, next_idx)) = rack_reader.next_tile(rack_bytes, idx) {
                tiles_to_return.push(tile);
                idx = next_idx;
            }
        }
        
        // Devolver fichas a la bolsa y mezclar
        bag.0.extend_from_slice(&tiles_to_return);
        use rand::thread_rng;
        let mut rng = thread_rng();
        bag.shuffle(&mut rng);
        
        // Generar nuevo rack
        let (new_rack, rejection_reason, tiles_remaining) = Self::generate_valid_rack(engine, bag, round_number)?;
        
        // Actualizar la ronda
        tournament.rounds[round_idx].rack = new_rack.clone();
        tournament.rounds[round_idx].rack_rejected = true;
        tournament.rounds[round_idx].rejection_reason = rejection_reason;
        tournament.tiles_remaining = tiles_remaining;
        
        Ok(tournament.rounds[round_idx].clone())
    }
    
    pub fn reveal_optimal_play(&mut self, tournament_id: &Uuid, round_number: u32) -> Result<(), String> {
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
            
        let round = tournament.rounds.iter_mut()
            .find(|r| r.number == round_number)
            .ok_or("Round not found")?;
            
        round.optimal_revealed = true;
        Ok(())
    }
    
    pub fn place_optimal_play(&mut self, tournament_id: &Uuid, round_number: u32) -> Result<(), String> {
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
            
        let round = tournament.rounds.iter_mut()
            .find(|r| r.number == round_number)
            .ok_or("Round not found")?;
            
        if let Some(optimal_play) = &round.optimal_play {
            // Update Master player's history
            let cumulative_score = tournament.master_plays.iter()
                .map(|p| p.score)
                .sum::<i32>() + optimal_play.score;
                
            let master_play = MasterPlay {
                round_number,
                word: optimal_play.word.clone(),
                position: optimal_play.position.clone(),
                score: optimal_play.score,
                cumulative_score,
            };
            
            tournament.master_plays.push(master_play);
            round.optimal_revealed = true;
            round.status = RoundStatus::Completed;
        } else {
            return Err("No optimal play calculated for this round".to_string());
        }
        
        Ok(())
    }
    
    pub fn get_bag_tiles(&self, tournament_id: &Uuid) -> Result<Vec<(String, bool)>, String> {
        let engine = self.engine.as_ref()
            .ok_or("Engine not initialized")?;
            
        let bag = self.bags.get(tournament_id)
            .ok_or("Bag not found for tournament")?;
            
        let alphabet = engine.get_alphabet();
        
        // Create a list of all tiles with their usage status
        let mut all_tiles = Vec::new();
        
        // Count tiles still in bag
        let mut tiles_in_bag = std::collections::HashMap::new();
        for &tile in &bag.0 {
            *tiles_in_bag.entry(tile).or_insert(0) += 1;
        }
        
        // Add all tiles from the alphabet
        for tile in 0..alphabet.len() {
            let tile_str = if tile == 0 {
                "?".to_string()
            } else {
                alphabet.of_board(tile).unwrap_or("").to_string()
            };
            
            let total_count = alphabet.freq(tile) as i32;
            let in_bag = tiles_in_bag.get(&tile).copied().unwrap_or(0);
            
            // Add tiles still in bag (not used)
            for _ in 0..in_bag {
                all_tiles.push((tile_str.clone(), false));
            }
            
            // Add tiles that have been used
            for _ in 0..(total_count - in_bag) {
                all_tiles.push((tile_str.clone(), true));
            }
        }
        
        Ok(all_tiles)
    }
}