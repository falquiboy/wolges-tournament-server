use wolges::alphabet;
use crate::models::BoardState;

/// Convert a board state with string tiles to wolges internal format
/// Preserves blank information (lowercase = blank with high bit set)
pub fn board_state_to_tiles(
    board_state: &BoardState,
    alphabet: &alphabet::Alphabet,
) -> Vec<u8> {
    let alphabet_reader = alphabet::AlphabetReader::new_for_plays(alphabet);
    let mut board_tiles = vec![0u8; 225];
    
    for (i, tile_str) in board_state.tiles.iter().enumerate() {
        if !tile_str.is_empty() {
            // Detect blanks: lowercase letters or lowercase digraphs
            let is_blank = tile_str.chars().next().map_or(false, |c| c.is_lowercase());
            
            // Convert digraphs to internal format
            let internal_tile = convert_digraphs_to_internal(
                if is_blank {
                    &tile_str.to_uppercase()
                } else {
                    tile_str
                }
            );
            
            let tile_bytes = internal_tile.as_bytes();
            if let Some((mut tile, _)) = alphabet_reader.next_tile(tile_bytes, 0) {
                // Set high bit for blanks
                if is_blank {
                    tile |= 0x80;
                    eprintln!("DEBUG: Position {} has blank '{}' -> tile 0x{:02x}", 
                        i, tile_str, tile);
                }
                board_tiles[i] = tile;
            }
        }
    }
    
    board_tiles
}

fn convert_digraphs_to_internal(s: &str) -> String {
    s.replace("[CH]", "ç")
        .replace("[ch]", "ç")
        .replace("[LL]", "k")
        .replace("[ll]", "k")
        .replace("[RR]", "w")
        .replace("[rr]", "w")
}