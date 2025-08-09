use wolges::{
    alphabet, game_config, klv, kwg, movegen,
};
use wolges::kwg::Node;
use crate::models::{BoardState, OptimalPlay, Position};
use std::fs;

pub struct WolgesEngine {
    kwg: kwg::Kwg<kwg::Node22>,
    klv: klv::Klv<kwg::Node22>,
    game_config: game_config::GameConfig,
    move_generator: movegen::KurniaMoveGenerator,
}

impl WolgesEngine {
    pub fn new(kwg_path: &str, klv_path: Option<&str>) -> Result<Self, String> {
        // Load KWG dictionary
        let kwg_bytes = fs::read(kwg_path)
            .map_err(|e| format!("Failed to read KWG file: {}", e))?;
        
        let kwg = kwg::Kwg::from_bytes_alloc(&kwg_bytes);
        
        // Load KLV if provided, otherwise use empty
        let klv = if let Some(klv_path) = klv_path {
            let klv_bytes = fs::read(klv_path)
                .map_err(|e| format!("Failed to read KLV file: {}", e))?;
            klv::Klv::from_bytes_alloc(&klv_bytes)
        } else {
            klv::Klv::from_bytes_alloc(klv::EMPTY_KLV_BYTES)
        };
        
        // Use Spanish game configuration
        let game_config = game_config::make_spanish_game_config();
        
        // Initialize move generator
        let move_generator = movegen::KurniaMoveGenerator::new(&game_config);
        
        Ok(WolgesEngine {
            kwg,
            klv,
            game_config,
            move_generator,
        })
    }
    
    pub fn validate_word(&self, word: &str) -> bool {
        let alphabet = self.game_config.alphabet();
        let word_bytes = word.as_bytes();
        let alphabet_reader = alphabet::AlphabetReader::new_for_words(alphabet);
        
        let mut tiles = Vec::new();
        let mut idx = 0;
        
        while idx < word_bytes.len() {
            if let Some((tile, next_idx)) = alphabet_reader.next_tile(word_bytes, idx) {
                tiles.push(tile);
                idx = next_idx;
            } else {
                return false;
            }
        }
        
        // Check in KWG
        let mut p = 0i32;
        for &tile in &tiles {
            p = self.kwg.seek(p, tile);
            if p < 0 {
                return false;
            }
        }
        
        self.kwg[p].accepts()
    }
    
    pub fn find_optimal_play(
        &mut self,
        board_state: &BoardState,
        rack: &str,
    ) -> Result<OptimalPlay, String> {
        // Convert board state to tiles
        let alphabet = self.game_config.alphabet();
        let alphabet_reader = alphabet::AlphabetReader::new_for_plays(alphabet);
        let mut board_tiles = vec![0u8; 225];
        
        for (i, tile_str) in board_state.tiles.iter().enumerate() {
            if !tile_str.is_empty() {
                let tile_bytes = tile_str.as_bytes();
                if let Some((tile, _)) = alphabet_reader.next_tile(tile_bytes, 0) {
                    board_tiles[i] = tile;
                }
            }
        }
        
        // Convert rack to tiles
        let rack_bytes = rack.as_bytes();
        let rack_reader = alphabet::AlphabetReader::new_for_racks(alphabet);
        let mut rack_tiles = Vec::new();
        let mut idx = 0;
        
        while idx < rack_bytes.len() {
            if let Some((tile, next_idx)) = rack_reader.next_tile(rack_bytes, idx) {
                rack_tiles.push(tile);
                idx = next_idx;
            } else {
                return Err(format!("Invalid rack character at position {}", idx));
            }
        }
        
        // Create board snapshot
        let board_snapshot = movegen::BoardSnapshot {
            board_tiles: &board_tiles,
            game_config: &self.game_config,
            kwg: &self.kwg,
            klv: &self.klv,
        };
        
        // Generate all possible moves
        let gen_moves_params = movegen::GenMovesParams {
            board_snapshot: &board_snapshot,
            rack: &rack_tiles,
            max_gen: 1000,  // Generate many moves to find the best
            num_exchanges_by_this_player: 0,
            always_include_pass: false,
        };
        
        self.move_generator.gen_moves_unfiltered(&gen_moves_params);
        
        // Find the highest scoring play
        if let Some(best_move) = self.move_generator.plays.iter()
            .filter_map(|valued_move| {
                match &valued_move.play {
                    movegen::Play::Place { down, lane, idx, word, score } => {
                        Some((valued_move, down, lane, idx, word, score))
                    },
                    _ => None,
                }
            })
            .max_by_key(|(_, _, _, _, _, score)| *score)
        {
            let (_, down, lane, idx, word, score) = best_move;
            
            // Convert tiles to strings
            let tiles_used: Vec<String> = word.iter().map(|&tile| {
                if tile == 0 {
                    "".to_string()
                } else {
                    alphabet.of_board(tile).unwrap_or("?").to_string()
                }
            }).collect();
            
            // Get the actual word formed
            let word_str = tiles_used.iter()
                .filter(|s| !s.is_empty())
                .cloned()
                .collect::<Vec<String>>()
                .join("");
            
            Ok(OptimalPlay {
                word: word_str,
                position: Position {
                    row: if *down { *idx as u8 } else { *lane as u8 },
                    col: if *down { *lane as u8 } else { *idx as u8 },
                    down: *down,
                },
                score: *score,
                tiles_used,
            })
        } else {
            Err("No valid plays found".to_string())
        }
    }
    
    pub fn calculate_score(
        &mut self,
        board_state: &BoardState,
        rack: &str,
        position: &Position,
        word: &str,
    ) -> Result<i32, String> {
        // This would calculate the score for a specific play
        // For now, we'll use the move generator to validate and score
        
        // Convert everything and generate moves
        self.find_optimal_play(board_state, rack)?;
        
        // Find the matching play in generated moves
        for valued_move in &self.move_generator.plays {
            match &valued_move.play {
                movegen::Play::Place { down, lane, idx, word: play_word, score } => {
                    let play_row = if *down { *idx as u8 } else { *lane as u8 };
                    let play_col = if *down { *lane as u8 } else { *idx as u8 };
                    
                    if play_row == position.row && 
                       play_col == position.col && 
                       *down == position.down {
                        // TODO: Verify it's the same word
                        return Ok(*score);
                    }
                },
                _ => continue,
            }
        }
        
        Err("Play not found in valid moves".to_string())
    }
    
    pub fn get_alphabet(&self) -> &alphabet::Alphabet {
        self.game_config.alphabet()
    }
    
    pub fn get_random_rack(&self) -> String {
        // Spanish Scrabble tile distribution
        let tiles = vec![
            ("A", 12), ("E", 12), ("O", 9), ("I", 6), ("S", 6),
            ("N", 5), ("R", 5), ("U", 5), ("L", 4), ("T", 4),
            ("D", 5), ("G", 2), ("C", 4), ("B", 2), ("M", 2),
            ("P", 2), ("H", 2), ("F", 1), ("V", 1), ("Y", 1),
            ("CH", 1), ("Q", 1), ("J", 1), ("LL", 1), ("Ñ", 1),
            ("RR", 1), ("X", 1), ("Z", 1),
        ];
        
        use rand::seq::SliceRandom;
        use rand::thread_rng;
        
        let mut bag: Vec<&str> = Vec::new();
        for (letter, count) in tiles {
            for _ in 0..count {
                bag.push(letter);
            }
        }
        
        let mut rng = thread_rng();
        bag.shuffle(&mut rng);
        
        bag.iter().take(7).map(|&s| s).collect::<Vec<_>>().join("")
    }
}