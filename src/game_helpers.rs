// Helper functions to work with wolges GameState and handle digraphs

use wolges::{alphabet, display, game_state::GameState};
use serde::{Serialize, Deserialize};

/// Representation of board for frontend (with digraphs as [CH], [LL], [RR])
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendBoard {
    pub tiles: Vec<String>,  // 225 positions, empty string for empty squares
}

/// Convert internal tile representation to display string
/// Handles digraphs (ç -> [CH], k -> [LL], w -> [RR]) and blanks (lowercase)
pub fn tile_to_display_string(tile: u8, alphabet: &alphabet::Alphabet) -> String {
    if tile == 0 {
        String::new()
    } else {
        let is_blank = tile >= 0x80;
        let actual_tile = tile & 0x7F;
        
        if let Some(letter) = alphabet.of_board(actual_tile) {
            let display = match letter {
                "Ç" => "[CH]".to_string(),  // Real CH tile
                "ç" => "[CH]".to_string(),  // Blank as CH (will be lowercased below)
                "K" => "[LL]".to_string(),  // Real LL tile
                "k" => "[LL]".to_string(),  // Blank as LL (will be lowercased below)
                "W" => "[RR]".to_string(),  // Real RR tile
                "w" => "[RR]".to_string(),  // Blank as RR (will be lowercased below)
                other => other.to_string(),
            };
            
            if is_blank {
                display.to_lowercase()
            } else {
                display
            }
        } else {
            String::new()
        }
    }
}

/// Convert GameState board to frontend representation
pub fn game_state_to_frontend_board(game_state: &GameState, alphabet: &alphabet::Alphabet) -> FrontendBoard {
    let tiles = game_state.board_tiles
        .iter()
        .map(|&tile| tile_to_display_string(tile, alphabet))
        .collect();
    
    FrontendBoard { tiles }
}

/// Convert user input with digraphs to internal representation
/// [CH] -> Ç (real tile), [ch] -> ç (blank as CH)
/// [LL] -> K (real tile), [ll] -> k (blank as LL)
/// [RR] -> W (real tile), [rr] -> w (blank as RR)
pub fn normalize_user_input(input: &str) -> String {
    input
        .replace("[CH]", "Ç")  // Real CH tile
        .replace("[ch]", "ç")  // blank played as CH
        .replace("[LL]", "K")  // Real LL tile
        .replace("[ll]", "k")  // blank played as LL
        .replace("[RR]", "W")  // Real RR tile
        .replace("[rr]", "w")  // blank played as RR
}

/// Convert rack string from user (with digraphs) to tile array
pub fn parse_rack_string(rack: &str, alphabet: &alphabet::Alphabet) -> Result<Vec<u8>, String> {
    let normalized = normalize_user_input(rack);
    let rack_bytes = normalized.as_bytes();
    let rack_reader = alphabet::AlphabetReader::new_for_racks(alphabet);
    let mut tiles = Vec::new();
    let mut idx = 0;
    
    while idx < rack_bytes.len() {
        if let Some((tile, next_idx)) = rack_reader.next_tile(rack_bytes, idx) {
            tiles.push(tile);
            idx = next_idx;
        } else {
            return Err(format!("Invalid character in rack at position {}", idx));
        }
    }
    
    Ok(tiles)
}

/// Convert a word with digraphs to internal format for validation
pub fn normalize_word(word: &str) -> String {
    normalize_user_input(word)
}

/// Format a play for display (including anchors)
pub fn format_play_with_anchors(
    play: &wolges::movegen::Play,
    board_snapshot: &wolges::movegen::BoardSnapshot<impl wolges::kwg::Node, impl wolges::kwg::Node>,
    alphabet: &alphabet::Alphabet,
) -> String {
    let formatted = format!("{}", play.fmt(board_snapshot));
    
    // Extract word part and convert digraphs back
    let parts: Vec<&str> = formatted.split_whitespace().collect();
    if parts.len() >= 2 {
        let word = parts[1];
        word.replace("ç", "[CH]")
            .replace("k", "[LL]")
            .replace("w", "[RR]")
    } else {
        formatted
    }
}

/// Convert a position from frontend format to wolges format
pub fn parse_position(row: u8, col: u8, down: bool) -> (bool, i8, i8) {
    (
        down,
        if down { col as i8 } else { row as i8 },  // lane
        if down { row as i8 } else { col as i8 },  // idx
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_digraph_conversion() {
        assert_eq!(normalize_user_input("[CH]ORRO"), "çORRO");
        assert_eq!(normalize_user_input("CA[LL]E"), "CAkE");
        assert_eq!(normalize_user_input("PE[RR]O"), "PEwO");
        assert_eq!(normalize_user_input("[ch]orro"), "çorro"); // blank
    }
    
    #[test]
    fn test_tile_display() {
        let alphabet = wolges::alphabet::make_spanish_internal_alphabet();
        
        // Regular tile CH (ç is tile 4 in spanish_internal)
        assert_eq!(tile_to_display_string(4, &alphabet), "[CH]");
        
        // Blank CH (4 + 0x80 = 132)
        assert_eq!(tile_to_display_string(132, &alphabet), "[ch]");
        
        // Regular A (tile 1)
        assert_eq!(tile_to_display_string(1, &alphabet), "A");
        
        // Blank A (1 + 0x80 = 129)
        assert_eq!(tile_to_display_string(129, &alphabet), "a");
        
        // Empty
        assert_eq!(tile_to_display_string(0, &alphabet), "");
    }
}