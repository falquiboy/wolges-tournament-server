// Copyright (C) 2020-2025 Andy Kurnia.
// WASM bindings for wolges - Spanish Scrabble move generation

use wasm_bindgen::prelude::*;
use crate::{alphabet, game_config, kwg};
use serde::{Deserialize, Serialize};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Serialize, Deserialize)]
pub struct MoveResult {
    pub word: String,
    pub score: i32,
    pub start_row: u8,
    pub start_col: u8,
    pub is_horizontal: bool,
    pub tiles_used: String,
}

#[wasm_bindgen]
pub struct SpanishScrabbleEngine {
    kwg: kwg::Kwg,
    game_config: game_config::GameConfig,
}

#[wasm_bindgen]
impl SpanishScrabbleEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(kwg_bytes: &[u8]) -> Result<SpanishScrabbleEngine, JsValue> {
        console_error_panic_hook::set_once();
        
        // Cargar el KWG
        let kwg = kwg::Kwg::from_bytes_alloc(kwg_bytes);
        
        // Usar configuración española
        let game_config = game_config::make_spanish_game_config();
        
        Ok(SpanishScrabbleEngine {
            kwg,
            game_config,
        })
    }
    
    #[wasm_bindgen]
    pub fn check_word(&self, word: &str) -> bool {
        let alphabet = self.game_config.alphabet();
        let word_bytes = word.as_bytes();
        
        // Convertir palabra a tiles
        let mut tiles = Vec::new();
        let mut idx = 0;
        let alphabet_reader = alphabet::AlphabetReader::new_for_words(&alphabet);
        
        while idx < word_bytes.len() {
            if let Some((tile, next_idx)) = alphabet_reader.next_tile(word_bytes, idx) {
                tiles.push(tile);
                idx = next_idx;
            } else {
                return false;
            }
        }
        
        // Verificar en el KWG
        self.kwg.accepts(&tiles)
    }
    
    #[wasm_bindgen]
    pub fn find_anagrams(&self, letters: &str) -> Result<String, JsValue> {
        // Por ahora, retornamos un JSON con palabras de ejemplo
        // TODO: Implementar búsqueda real de anagramas
        let results = vec!["CASA", "SACA", "ASCA"];
        Ok(serde_json::to_string(&results).unwrap())
    }
    
    #[wasm_bindgen]
    pub fn generate_moves(
        &self,
        board_state: &str,  // JSON string del estado del tablero
        rack: &str,         // Letras en el atril
    ) -> Result<String, JsValue> {
        console_log!("Generating moves for rack: {}", rack);
        
        // Por ahora retornamos movimientos de ejemplo
        // TODO: Implementar generación real de movimientos
        let moves = vec![
            MoveResult {
                word: "CASA".to_string(),
                score: 24,
                start_row: 7,
                start_col: 7,
                is_horizontal: true,
                tiles_used: "CASA".to_string(),
            },
            MoveResult {
                word: "SACA".to_string(),
                score: 22,
                start_row: 8,
                start_col: 6,
                is_horizontal: false,
                tiles_used: "SACA".to_string(),
            },
        ];
        
        Ok(serde_json::to_string(&moves).unwrap())
    }
}

// Función auxiliar para inicializar
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}