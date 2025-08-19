// New game management using wolges GameState

use wolges::{
    game_state::{GameState, GamePlayer},
    game_config::GameConfig,
    movegen,
    alphabet,
};
use crate::models::BoardState;
use crate::game_helpers::game_state_to_frontend_board;
use uuid::Uuid;
use rand::prelude::*;

/// Wrapper around wolges GameState that maintains compatibility with our frontend
pub struct GameManager {
    pub game_state: GameState,
    pub tournament_id: Uuid,
    pub round_history: Vec<RoundInfo>,
    pub alphabet_len: u8,
    pub rack_size: u8,
}

#[derive(Clone)]
pub struct RoundInfo {
    pub number: u32,
    pub rack: Vec<u8>,
    pub optimal_play: Option<movegen::Play>,
    pub score: i32,
}

impl GameManager {
    pub fn new(tournament_id: Uuid, game_config: &GameConfig, num_players: usize) -> Self {
        let mut game_state = GameState::new(game_config);
        
        // Initialize with correct number of players
        game_state.players = (0..num_players)
            .map(|_| GamePlayer {
                score: 0,
                rack: Vec::with_capacity(7),
                num_exchanges: 0,
            })
            .collect();
        
        GameManager {
            game_state,
            tournament_id,
            round_history: Vec::new(),
            alphabet_len: game_config.alphabet().len(),
            rack_size: game_config.rack_size(),
        }
    }
    
    /// Start a new game with shuffled tiles
    pub fn start_game(&mut self, game_config: &GameConfig, mut rng: &mut dyn RngCore) {
        self.game_state.reset_and_draw_tiles(game_config, &mut rng);
    }
    
    /// Get current rack for active player
    pub fn get_current_rack(&self) -> &[u8] {
        &self.game_state.current_player().rack
    }
    
    /// Set a specific rack for the current player (for manual rack setting)
    pub fn set_current_rack(&mut self, rack: &[u8]) {
        self.game_state.set_current_rack(rack);
    }
    
    /// Validate rack composition according to Spanish Scrabble tournament rules
    pub fn validate_rack(&self, rack: &[u8], round_number: u32, alphabet: &alphabet::Alphabet) -> Option<String> {
        let vowel_count = rack.iter()
            .filter(|&&t| t != 0 && alphabet.is_vowel(t))
            .count() as u8;
        let consonant_count = rack.iter()
            .filter(|&&t| t != 0 && !alphabet.is_vowel(t))
            .count() as u8;
        
        if round_number <= 15 {
            // Rounds 1-15: Maximum 5 consonants OR maximum 5 vowels (i.e., minimum 2 of each)
            if vowel_count < 2 {
                return Some(format!("Atril rechazado: {} vocales (mínimo 2 para rondas 1-15)", vowel_count));
            }
            if consonant_count < 2 {
                return Some(format!("Atril rechazado: {} consonantes (mínimo 2 para rondas 1-15)", consonant_count));
            }
            if vowel_count > 5 {
                return Some(format!("Atril rechazado: {} vocales (máximo 5)", vowel_count));
            }
            if consonant_count > 5 {
                return Some(format!("Atril rechazado: {} consonantes (máximo 5)", consonant_count));
            }
        } else {
            // Rounds 16+: At least 1 consonant AND at least 1 vowel
            if vowel_count == 0 {
                return Some(format!("Atril rechazado: sin vocales (mínimo 1 para rondas 16+)"));
            }
            if consonant_count == 0 {
                return Some(format!("Atril rechazado: sin consonantes (mínimo 1 para rondas 16+)"));
            }
        }
        None
    }
    
    /// Generate a new rack from the bag and replenish to full size
    pub fn draw_new_rack(&mut self) {
        let current_player_idx = self.game_state.turn as usize;
        self.game_state.players[current_player_idx].rack.clear();
        self.replenish_rack();
    }
    
    /// Apply a play to the board
    pub fn apply_play(&mut self, game_config: &GameConfig, play: &movegen::Play, mut rng: &mut dyn RngCore) -> Result<(), String> {
        self.game_state.play(game_config, &mut rng, play)
            .map_err(|e| format!("Failed to apply play: {:?}", e))
    }
    
    /// Move to next turn
    pub fn next_turn(&mut self) {
        self.game_state.next_turn();
    }
    
    /// Get board tiles array
    pub fn get_board_tiles(&self) -> &[u8] {
        &self.game_state.board_tiles
    }
    
    /// Get tiles remaining in bag
    pub fn tiles_remaining(&self) -> usize {
        self.game_state.bag.0.len()
    }
    
    /// Convert to frontend-compatible board representation
    pub fn get_frontend_board(&self, alphabet: &alphabet::Alphabet) -> BoardState {
        let frontend = game_state_to_frontend_board(&self.game_state, alphabet);
        BoardState { tiles: frontend.tiles }
    }
    
    /// Draw tiles to replenish rack
    pub fn replenish_rack(&mut self) {
        let current_player_idx = self.game_state.turn as usize;
        self.game_state.bag.replenish(
            &mut self.game_state.players[current_player_idx].rack,
            self.rack_size as usize,
        );
    }
    
    /// Check if game has ended
    pub fn is_game_ended(&self) -> bool {
        self.game_state.current_player().rack.is_empty() 
            || (self.game_state.bag.0.is_empty() && self.game_state.pass_turns >= 2)
    }
}