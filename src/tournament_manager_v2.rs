use crate::models::*;
use crate::wolges_engine::WolgesEngine;
use crate::game_manager::GameManager;
use crate::game_helpers::{parse_rack_string, normalize_word, format_play_with_anchors};
use std::collections::HashMap;
use uuid::Uuid;
use chrono::Utc;
use wolges::{alphabet, bag, game_config, movegen};
use std::fs::{File, OpenOptions};
use std::io::{Write, BufWriter};

pub struct TournamentManager {
    pub tournaments: HashMap<Uuid, Tournament>,
    pub engine: Option<WolgesEngine>,
    pub game_managers: HashMap<Uuid, GameManager>,  // GameManager per tournament
}

impl TournamentManager {
    pub fn new() -> Self {
        Self {
            tournaments: HashMap::new(),
            engine: None,
            game_managers: HashMap::new(),
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
        
        // Create GameManager for this tournament
        let game_config = engine.get_game_config();
        let mut game_manager = GameManager::new(id, game_config, 1); // 1 player for duplicate
        
        // Initialize game with shuffled tiles
        use rand::thread_rng;
        let mut rng = thread_rng();
        let game_config = engine.get_game_config();
        game_manager.start_game(game_config, &mut rng);
        
        let tiles_remaining = game_manager.tiles_remaining() as u8;
        
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
        self.game_managers.insert(id, game_manager);
        
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
        
        let game_manager = self.game_managers.get_mut(tournament_id)
            .ok_or("Game manager not found for tournament")?;
        
        // Update tournament status if needed
        if tournament.status == TournamentStatus::Created {
            tournament.status = TournamentStatus::InProgress;
        }
        
        let round_number = tournament.rounds.len() as u32 + 1;
        
        // Generate new rack with validation loop
        let mut rejection_reason = None;
        let rack_str;
        let rack_tiles;
        
        loop {
            // Draw a new rack
            game_manager.draw_new_rack();
            let current_rack = game_manager.get_current_rack().to_vec();
            
            // Check if rack is valid
            let alphabet = engine.get_alphabet();
            rejection_reason = game_manager.validate_rack(&current_rack, round_number, alphabet);
            
            if rejection_reason.is_none() {
                rack_tiles = current_rack;
                break;
            }
            // If invalid, continue loop to draw another rack
        }
        
        // Convert rack to display format
        let alphabet = engine.get_alphabet();
        rack_str = Self::tiles_to_display_string(&rack_tiles, alphabet)?;
        
        // Get current board state from GameManager
        let alphabet = engine.get_alphabet();
        let board_state = game_manager.get_frontend_board(alphabet);
        
        // Update tiles remaining
        tournament.tiles_remaining = game_manager.tiles_remaining() as u8;
        
        let round = Round {
            number: round_number,
            rack: rack_str,
            board_state,
            optimal_play: None,
            optimal_revealed: false,
            status: RoundStatus::Active,
            rack_rejected: false,  // Always false since we loop until valid
            rejection_reason: None,  // Always None since we ensure it's valid
            timer_started: None,
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
    
    pub fn start_new_round_manual(&mut self, tournament_id: &Uuid, manual_rack: &str) -> Result<Round, String> {
        let engine = self.engine.as_ref()
            .ok_or("Engine not initialized")?;
            
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
            
        let game_manager = self.game_managers.get_mut(tournament_id)
            .ok_or("Game manager not found for tournament")?;
            
        // Update tournament status if needed
        if tournament.status == TournamentStatus::Created {
            tournament.status = TournamentStatus::InProgress;
        }
        
        let round_number = tournament.rounds.len() as u32 + 1;
        
        // Parse manual rack with digraphs
        let alphabet = engine.get_alphabet();
        let rack_tiles = parse_rack_string(manual_rack, alphabet)?;
        
        if rack_tiles.len() != 7 {
            return Err(format!("El atril debe tener exactamente 7 fichas, se proporcionaron {}", rack_tiles.len()));
        }
        
        // Set the rack in GameManager
        game_manager.set_current_rack(&rack_tiles);
        
        // Get current board state from GameManager
        let alphabet = engine.get_alphabet();
        let board_state = game_manager.get_frontend_board(alphabet);
        
        // Check rack validity
        let alphabet = engine.get_alphabet();
        let rejection_reason = game_manager.validate_rack(&rack_tiles, round_number, alphabet);
        
        let round = Round {
            number: round_number,
            rack: manual_rack.to_string(),
            board_state,
            optimal_play: None,
            optimal_revealed: false,
            status: RoundStatus::Active,
            rack_rejected: rejection_reason.is_some(),
            rejection_reason,
            timer_started: None,
        };
        
        tournament.rounds.push(round.clone());
        
        // Save tournament state
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
    
    pub fn calculate_optimal_play(&mut self, tournament_id: &Uuid) -> Result<OptimalPlay, String> {
        let engine = self.engine.as_ref()
            .ok_or("Engine not initialized")?;
            
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
            
        let game_manager = self.game_managers.get(tournament_id)
            .ok_or("Game manager not found")?;
            
        let current_round = tournament.rounds.last_mut()
            .ok_or("No active round")?;
            
        if current_round.optimal_play.is_some() {
            return Ok(current_round.optimal_play.clone().unwrap());
        }
        
        // Get current board tiles from GameManager
        let board_tiles = game_manager.get_board_tiles();
        
        // Get current rack from GameManager
        let rack_tiles = game_manager.get_current_rack();
        
        // Calculate optimal play using wolges engine
        let optimal = engine.calculate_optimal_play(board_tiles, rack_tiles)?;
        
        // Convert to OptimalPlay model
        let optimal_play = Self::convert_to_optimal_play(&optimal, engine)?;
        
        current_round.optimal_play = Some(optimal_play.clone());
        
        Ok(optimal_play)
    }
    
    pub fn place_optimal_play(&mut self, tournament_id: &Uuid) -> Result<(), String> {
        let tournament = self.tournaments.get_mut(tournament_id)
            .ok_or("Tournament not found")?;
            
        let game_manager = self.game_managers.get_mut(tournament_id)
            .ok_or("Game manager not found")?;
            
        let current_round = tournament.rounds.last()
            .ok_or("No active round")?;
            
        let optimal = current_round.optimal_play.as_ref()
            .ok_or("No optimal play calculated for this round")?;
        
        // Apply the play to GameManager
        use rand::thread_rng;
        let mut rng = thread_rng();
        
        // Convert OptimalPlay back to wolges Play
        // This requires storing the original Play object or reconstructing it
        // For now, we'll need to recalculate it
        let engine = self.engine.as_ref()
            .ok_or("Engine not initialized")?;
        
        let board_tiles = game_manager.get_board_tiles();
        let rack_tiles = game_manager.get_current_rack();
        let wolges_play = engine.calculate_optimal_play(board_tiles, rack_tiles)?;
        
        // Apply the play
        let game_config = engine.get_game_config();
        game_manager.apply_play(game_config, &wolges_play, &mut rng)?;
        
        // Replenish rack for next round
        game_manager.replenish_rack();
        
        // Move to next turn
        game_manager.next_turn();
        
        // Update master plays
        let master_play = MasterPlay {
            round_number: current_round.number,
            word: optimal.word.clone(),
            position: optimal.position.clone(),
            score: optimal.score,
            cumulative_score: tournament.master_plays.last()
                .map(|p| p.cumulative_score + optimal.score)
                .unwrap_or(optimal.score),
        };
        
        tournament.master_plays.push(master_play);
        
        // Save state
        use crate::persistence::PersistenceManager;
        let tournament_clone = tournament.clone();
        if let Err(e) = PersistenceManager::save_tournament(&tournament_clone, self, vec![]) {
            eprintln!("Failed to save tournament after placing optimal play: {}", e);
        }
        
        Ok(())
    }
    
    // Helper functions
    fn tiles_to_display_string(tiles: &[u8], alphabet: &alphabet::Alphabet) -> Result<String, String> {
        use crate::game_helpers::tile_to_display_string;
        let strings: Vec<String> = tiles.iter()
            .map(|&t| tile_to_display_string(t, alphabet))
            .collect();
        Ok(strings.join(""))
    }
    
    
    fn convert_to_optimal_play(play: &movegen::Play, engine: &WolgesEngine) -> Result<OptimalPlay, String> {
        match play {
            movegen::Play::Place { down, lane, idx, word, score } => {
                let alphabet = engine.get_alphabet();
                
                // Extract position
                let position = Position {
                    row: if *down { *idx as u8 } else { *lane as u8 },
                    col: if *down { *lane as u8 } else { *idx as u8 },
                    down: *down,
                };
                
                // Convert tiles used to display format
                let tiles_used: Vec<String> = word.iter()
                    .filter(|&&t| t != 0)
                    .map(|&t| crate::game_helpers::tile_to_display_string(t, alphabet))
                    .collect();
                
                // Track blank positions
                let blank_positions: Vec<bool> = word.iter()
                    .map(|&t| t >= 0x80)
                    .collect();
                
                // Format word for display
                let word_str = tiles_used.join("");
                
                Ok(OptimalPlay {
                    word: word_str,
                    position,
                    score: *score,
                    tiles_used,
                    play_bytes: Some(word.to_vec()),
                    blank_positions,
                })
            },
            movegen::Play::Exchange { .. } => {
                Err("Exchange is not a valid optimal play".to_string())
            }
        }
    }
    
    // Log functions
    fn log_tournament_start(&self, tournament: &Tournament) -> std::io::Result<()> {
        use crate::persistence::PersistenceManager;
        let log_path = PersistenceManager::get_tournament_log_path(&tournament.id.to_string());
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)?;
        
        writeln!(file, "Tournament: {}", tournament.name)?;
        writeln!(file, "Created: {}", tournament.created_at)?;
        writeln!(file, "Players:")?;
        for player in &tournament.players {
            writeln!(file, "  - {} ({})", player.name, player.id)?;
        }
        writeln!(file, "")?;
        Ok(())
    }
    
    fn log_round(&self, tournament_id: &Uuid, round: &Round) -> std::io::Result<()> {
        use crate::persistence::PersistenceManager;
        let log_path = PersistenceManager::get_tournament_log_path(&tournament_id.to_string());
        let mut file = OpenOptions::new()
            .append(true)
            .open(&log_path)?;
        
        writeln!(file, "Round {}: {}", round.number, round.rack)?;
        if let Some(reason) = &round.rejection_reason {
            writeln!(file, "  Rejected: {}", reason)?;
        }
        Ok(())
    }
    
    pub fn get_bag(&self, tournament_id: &Uuid) -> Option<&bag::Bag> {
        self.game_managers.get(tournament_id)
            .map(|gm| &gm.game_state.bag)
    }
}