use wolges::{
    alphabet, game_config, klv, kwg, movegen,
};
use wolges::kwg::Node;
use crate::models::{BoardState, OptimalPlay, Position};
use std::fs;

/// Convert digraphs to internal representation
fn convert_digraphs_to_internal(s: &str) -> String {
    // IMPORTANT: Only convert explicitly marked digraphs with brackets
    // Do NOT convert sequences of individual letters (e.g., two separate Rs should not become [RR])
    // Handle both uppercase (real tiles) and lowercase (blanks played as digraphs)
    s.replace("[CH]", "Ç")    // Real CH tile -> uppercase Ç
        .replace("[ch]", "ç")  // Blank as CH -> lowercase ç  
        .replace("[LL]", "K")  // Real LL tile -> uppercase K
        .replace("[ll]", "k")  // Blank as LL -> lowercase k
        .replace("[RR]", "W")  // Real RR tile -> uppercase W
        .replace("[rr]", "w")  // Blank as RR -> lowercase w
        // Note: We do NOT replace "CH", "LL", "RR" without brackets
        // Those are individual letters that happen to be adjacent
}

/// Convert internal representation back to digraphs for display
fn convert_internal_to_digraphs(s: &str) -> String {
    s.replace("Ç", "[CH]")  // Real CH tile
        .replace("ç", "[ch]")  // Blank as CH
        .replace("K", "[LL]")  // Real LL tile
        .replace("k", "[ll]")  // Blank as LL
        .replace("W", "[RR]")  // Real RR tile
        .replace("w", "[rr]")  // Blank as RR
}


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
        
        // Use Spanish game configuration - check if we're using the internal alphabet
        let game_config = if kwg_path.contains("converted") {
            game_config::make_spanish_internal_game_config()
        } else {
            game_config::make_spanish_game_config()
        };
        
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
        // Convert digraphs to internal representation first
        let internal_word = convert_digraphs_to_internal(word);
        
        let alphabet = self.game_config.alphabet();
        let word_bytes = internal_word.as_bytes();
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
        eprintln!("DEBUG: find_optimal_play called with rack: '{}'", rack);
        
        // Convert rack digraphs to internal representation
        let internal_rack = convert_digraphs_to_internal(rack);
        eprintln!("DEBUG: internal_rack: '{}'", internal_rack);
        
        // Convert board state to tiles
        let alphabet = self.game_config.alphabet();
        let alphabet_reader = alphabet::AlphabetReader::new_for_plays(alphabet);
        let mut board_tiles = vec![0u8; 225];
        
        for (i, tile_str) in board_state.tiles.iter().enumerate() {
            if !tile_str.is_empty() {
                // Convert digraphs to internal format before parsing
                let internal_tile = convert_digraphs_to_internal(tile_str);
                let tile_bytes = internal_tile.as_bytes();
                if let Some((tile, _)) = alphabet_reader.next_tile(tile_bytes, 0) {
                    board_tiles[i] = tile;
                } else {
                    eprintln!("DEBUG: Failed to parse board tile at position {}: '{}'", i, tile_str);
                }
            }
        }
        
        // Convert rack to tiles using internal representation
        let rack_bytes = internal_rack.as_bytes();
        let rack_reader = alphabet::AlphabetReader::new_for_racks(alphabet);
        let mut rack_tiles = Vec::new();
        let mut rack_blanks = Vec::new(); // Track which tiles are blanks
        let mut idx = 0;
        
        eprintln!("DEBUG: Converting internal rack to tiles, rack_bytes.len() = {}", rack_bytes.len());
        use std::io::Write;
        std::io::stderr().flush().unwrap();
        eprintln!("DEBUG: rack_bytes = {:?}", rack_bytes);
        std::io::stderr().flush().unwrap();
        
        while idx < rack_bytes.len() {
            // Check if this is a lowercase letter (blank)
            let is_blank = if idx < rack_bytes.len() {
                let byte = rack_bytes[idx];
                // Check for lowercase letters (including special chars)
                (byte >= b'a' && byte <= b'z') || 
                // Check for lowercase ç (UTF-8: 195, 167)
                (idx + 1 < rack_bytes.len() && rack_bytes[idx] == 195 && rack_bytes[idx + 1] == 167) ||
                // Check for lowercase ñ (UTF-8: 195, 177)  
                (idx + 1 < rack_bytes.len() && rack_bytes[idx] == 195 && rack_bytes[idx + 1] == 177)
            } else {
                false
            };
            
            if let Some((tile, next_idx)) = rack_reader.next_tile(rack_bytes, idx) {
                eprintln!("DEBUG: Found tile {} at idx {}, next_idx = {}, is_blank = {}", tile, idx, next_idx, is_blank);
                rack_tiles.push(tile);
                rack_blanks.push(is_blank);
                idx = next_idx;
            } else {
                eprintln!("DEBUG: Failed to parse at idx {}, byte = {:?}", idx, rack_bytes.get(idx));
                return Err(format!("Invalid rack character at position {}: {:?}", idx, 
                    std::str::from_utf8(&rack_bytes[idx..idx+1]).unwrap_or("?")));
            }
        }
        
        eprintln!("DEBUG: rack_tiles = {:?}", rack_tiles);
        eprintln!("DEBUG: rack_tiles as strings: {:?}", 
            rack_tiles.iter().map(|&t| 
                if t == 0 { "?".to_string() } 
                else { alphabet.of_board(t).unwrap_or("ERROR").to_string() }
            ).collect::<Vec<_>>()
        );
        
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
        
        eprintln!("DEBUG: Generated {} moves", self.move_generator.plays.len());
        
        // Filter out plays that would overwrite existing tiles
        let valid_plays: Vec<_> = self.move_generator.plays.iter()
            .filter(|valued_move| {
                match &valued_move.play {
                    movegen::Play::Place { down, lane, idx, word, .. } => {
                        let start_idx = if *down {
                            (*idx as usize) * 15 + (*lane as usize)
                        } else {
                            (*lane as usize) * 15 + (*idx as usize)
                        };
                        
                        // Check if this play would overwrite any existing tiles
                        for (i, &tile) in word.iter().enumerate() {
                            if tile != 0 {  // 0 means use existing tile
                                let board_idx = if *down {
                                    start_idx + i * 15
                                } else {
                                    start_idx + i
                                };
                                
                                if board_idx < 225 && board_tiles[board_idx] != 0 {
                                    // Check if tiles match (ignoring blank bit)
                                    if (board_tiles[board_idx] & 0x7F) != (tile & 0x7F) {
                                        eprintln!("DEBUG: Filtering out play that would overwrite tile at position {}", board_idx);
                                        return false;  // This play would overwrite a different tile
                                    }
                                }
                            }
                        }
                        true  // Play is valid
                    },
                    _ => true,  // Non-place moves are always valid
                }
            })
            .cloned()
            .collect();
        
        eprintln!("DEBUG: {} valid plays after filtering", valid_plays.len());
        
        // Replace the plays with filtered valid ones
        self.move_generator.plays = valid_plays;
        
        // Debug: Show top 10 moves
        let mut sorted_moves = self.move_generator.plays.clone();
        sorted_moves.sort_by(|a, b| {
            let score_a = match &a.play {
                movegen::Play::Place { score, .. } => *score,
                _ => 0,
            };
            let score_b = match &b.play {
                movegen::Play::Place { score, .. } => *score,
                _ => 0,
            };
            score_b.cmp(&score_a)
        });
        
        eprintln!("DEBUG: Top 10 moves:");
        for (i, valued_move) in sorted_moves.iter().take(10).enumerate() {
            match &valued_move.play {
                movegen::Play::Place { down, lane, idx, word, score } => {
                    let word_str: String = word.iter()
                        .filter(|&&t| t != 0)
                        .map(|&t| alphabet.of_board(t).unwrap_or("?"))
                        .collect::<String>();
                    let word_str = convert_internal_to_digraphs(&word_str);
                    eprintln!("  {}. {} (score: {}, pos: {},{} {})", 
                        i + 1, word_str, score, lane, idx, 
                        if *down { "down" } else { "across" });
                },
                _ => {},
            }
        }
        
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
            
            // Before we process the play, let's validate it doesn't overwrite existing tiles
            // Get the starting position on the board
            let start_idx = if *down {
                (*idx as usize) * 15 + (*lane as usize)
            } else {
                (*lane as usize) * 15 + (*idx as usize)
            };
            
            // Check each position in the word
            for (i, &tile) in word.iter().enumerate() {
                if tile != 0 {  // 0 means use existing tile at this position
                    let board_idx = if *down {
                        start_idx + i * 15
                    } else {
                        start_idx + i
                    };
                    
                    if board_idx < 225 && board_tiles[board_idx] != 0 {
                        // There's already a tile here - this should only be valid if tiles match
                        let existing_tile = board_tiles[board_idx];
                        let existing_letter = alphabet.of_board(existing_tile & 0x7F).unwrap_or("?");
                        let new_letter = alphabet.of_board(tile & 0x7F).unwrap_or("?");
                        
                        eprintln!("WARNING: Play attempts to place '{}' over existing '{}' at position {}", 
                            new_letter, existing_letter, board_idx);
                        
                        // Check if they're the same letter (ignoring blank bit)
                        if (existing_tile & 0x7F) != (tile & 0x7F) {
                            eprintln!("ERROR: Wolges generated invalid play - overwriting different tile!");
                            eprintln!("  Existing: {} (tile {})", existing_letter, existing_tile);
                            eprintln!("  New: {} (tile {})", new_letter, tile);
                            eprintln!("  Position: board_idx={}, row={}, col={}", 
                                board_idx, board_idx / 15, board_idx % 15);
                        }
                    }
                }
            }
            
            // Convert tiles to strings
            let tiles_used: Vec<String> = word.iter().map(|&tile| {
                if tile == 0 {
                    "".to_string()
                } else {
                    convert_internal_to_digraphs(alphabet.of_board(tile).unwrap_or("?"))
                }
            }).collect();
            
            // Get the complete word formed including anchors
            // First, let's get just the tiles played (without anchors) for now
            let tiles_only: String = word.iter()
                .filter(|&&t| t != 0)
                .map(|&t| alphabet.of_board(t).unwrap_or("?"))
                .collect();
            let word_str = convert_internal_to_digraphs(&tiles_only);
            
            // TODO: Use wolges Display implementation to get full word with anchors
            // This would require creating a WriteablePlay with BoardSnapshot
            
            // Detect blank positions based on the original rack blanks
            // We need to track which tiles from the rack were used as blanks
            let mut blank_positions = vec![false; word.len()];
            let alphabet_len = alphabet.len() as u8;
            
            // Map word tiles back to rack tiles to identify blanks
            // This is a simplified approach - ideally wolges would track this
            for (i, &word_tile) in word.iter().enumerate() {
                if word_tile != 0 {
                    // Check if this tile came from a blank in the rack
                    // For now, use the > alphabet_len heuristic
                    blank_positions[i] = word_tile > alphabet_len;
                }
            }
            
            eprintln!("DEBUG: Alphabet length: {}", alphabet_len);
            eprintln!("DEBUG: Word tiles: {:?}", word);
            eprintln!("DEBUG: Blank positions: {:?}", blank_positions);
            
            // Create word string with blanks in lowercase
            let word_with_blanks: String = word.iter()
                .enumerate()
                .filter(|(_, &t)| t != 0)
                .map(|(i, &t)| {
                    // If it's a blank, subtract the alphabet length to get the actual letter
                    let actual_tile = if t > alphabet_len { t - alphabet_len } else { t };
                    let letter = alphabet.of_board(actual_tile).unwrap_or("?");
                    if blank_positions[i] {
                        letter.to_lowercase()
                    } else {
                        letter.to_string()
                    }
                })
                .collect();
            let word_str_with_blanks = convert_internal_to_digraphs(&word_with_blanks);
            
            Ok(OptimalPlay {
                word: word_str_with_blanks,
                position: Position {
                    row: if *down { *idx as u8 } else { *lane as u8 },
                    col: if *down { *lane as u8 } else { *idx as u8 },
                    down: *down,
                },
                score: *score,
                tiles_used,
                play_bytes: Some(word.to_vec()), // Save the word bytes for later formatting
                blank_positions,
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
        eprintln!("DEBUG calculate_score: rack='{}', word='{}', pos=({},{}){}", 
            rack, word, position.row, position.col, if position.down { "↓" } else { "→" });
        
        // Convert player's word to internal format (handle digraphs)
        let internal_word = convert_digraphs_to_internal(word);
        eprintln!("DEBUG: internal_word='{}'", internal_word);
        
        // Generate all moves for this board state and rack
        self.find_optimal_play(board_state, rack)?;
        
        // Find the matching play in generated moves
        let alphabet = self.game_config.alphabet();
        
        for valued_move in &self.move_generator.plays {
            match &valued_move.play {
                movegen::Play::Place { down, lane, idx, word: play_word, score } => {
                    let play_row = if *down { *idx as u8 } else { *lane as u8 };
                    let play_col = if *down { *lane as u8 } else { *idx as u8 };
                    
                    if play_row == position.row && 
                       play_col == position.col && 
                       *down == position.down {
                        // Get the actual tiles being placed (not anchors)
                        // In an empty board, all tiles are being placed
                        // In a board with tiles, some positions might be 0 (playing through existing tiles)
                        let mut tiles_placed = Vec::new();
                        let mut word_formed = String::new();
                        
                        for (i, &tile) in play_word.iter().enumerate() {
                            if tile != 0 {
                                // This is a tile being placed from rack
                                if tile > 127 {  // Blank tile (high bit set)
                                    let letter = alphabet.of_board(tile & 127).unwrap_or("?");
                                    tiles_placed.push(letter.to_lowercase());
                                    word_formed.push_str(&letter.to_lowercase());
                                } else {
                                    let letter = alphabet.of_board(tile).unwrap_or("?");
                                    tiles_placed.push(letter.to_string());
                                    word_formed.push_str(letter);
                                }
                            } else {
                                // This is an anchor (existing tile on board)
                                // Get the tile from board_state
                                let board_idx = if *down {
                                    (play_row as usize + i) * 15 + play_col as usize
                                } else {
                                    play_row as usize * 15 + (play_col as usize + i)
                                };
                                
                                if board_idx < board_state.tiles.len() && !board_state.tiles[board_idx].is_empty() {
                                    word_formed.push_str(&board_state.tiles[board_idx]);
                                }
                            }
                        }
                        
                        // Convert to display format
                        let word_with_digraphs = convert_internal_to_digraphs(&word_formed);
                        eprintln!("DEBUG: Play at ({},{}){}:", play_row, play_col, if *down { "↓" } else { "→" });
                        eprintln!("  - Word formed: '{}'", word_with_digraphs);
                        eprintln!("  - Player word: '{}'", word);
                        eprintln!("  - Score: {}", score);
                        
                        // Compare the complete word formed
                        if word_with_digraphs.eq_ignore_ascii_case(word) {
                            eprintln!("DEBUG: Match found!");
                            return Ok(*score);
                        }
                    }
                },
                _ => continue,
            }
        }
        
        Err(format!("Jugada '{}' en {}{}no encontrada en las jugadas válidas", 
            word, 
            if position.down {
                // Vertical: número + letra (ej: 8D)
                format!("{}{}", position.col + 1, ('A' as u8 + position.row) as char)
            } else {
                // Horizontal: letra + número (ej: D8)
                format!("{}{}", ('A' as u8 + position.row) as char, position.col + 1)
            },
            if position.down { "↓ " } else { "→ " }
        ))
    }
    
    pub fn get_alphabet(&self) -> &alphabet::Alphabet {
        self.game_config.alphabet()
    }
    
    // Format a play word including anchors using wolges Display implementation
    pub fn format_play_word(
        &self,
        board_state: &BoardState,
        play_bytes: &[u8],
        position: &Position,
    ) -> Result<String, String> {
        // Convert board state to tiles (same logic as in find_optimal_play)
        let alphabet = self.game_config.alphabet();
        let alphabet_reader = alphabet::AlphabetReader::new_for_plays(alphabet);
        let mut board_tiles = vec![0u8; 225];
        
        for (i, tile_str) in board_state.tiles.iter().enumerate() {
            if !tile_str.is_empty() {
                // Convert digraphs to internal format before parsing
                let internal_tile = convert_digraphs_to_internal(tile_str);
                let tile_bytes = internal_tile.as_bytes();
                if let Some((tile, _)) = alphabet_reader.next_tile(tile_bytes, 0) {
                    board_tiles[i] = tile;
                } else {
                    eprintln!("DEBUG: Failed to parse board tile at position {}: '{}'", i, tile_str);
                }
            }
        }
        
        // Create a temporary Play to use wolges formatting
        let play = movegen::Play::Place {
            down: position.down,
            lane: if position.down { position.col as i8 } else { position.row as i8 },
            idx: if position.down { position.row as i8 } else { position.col as i8 },
            word: play_bytes.into(),
            score: 0, // Score doesn't matter for formatting
        };
        
        // Create board snapshot
        let board_snapshot = movegen::BoardSnapshot {
            board_tiles: &board_tiles,
            game_config: &self.game_config,
            kwg: &self.kwg,
            klv: &self.klv,
        };
        
        // Format using wolges Display - this will show anchors as (letters)
        let formatted = format!("{}", play.fmt(&board_snapshot));
        eprintln!("DEBUG: Wolges formatted play: '{}'", formatted);
        
        // Extract just the word part (skip position and score)
        let parts: Vec<&str> = formatted.split_whitespace().collect();
        if parts.len() >= 2 {
            // Convert internal digraphs to display format
            let word_with_anchors = convert_internal_to_digraphs(parts[1]);
            eprintln!("DEBUG: Formatted word with anchors: '{}'", word_with_anchors);
            Ok(word_with_anchors)
        } else {
            Ok(convert_internal_to_digraphs(&formatted))
        }
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