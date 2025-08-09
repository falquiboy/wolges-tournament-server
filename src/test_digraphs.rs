use wolges::{alphabet, game_config, kwg};
use std::fs;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Cargar el diccionario
    let kwg_bytes = fs::read("../wolges/FISE2016.kwg")?;
    let kwg = kwg::Kwg::<kwg::Node22>::from_bytes_alloc(&kwg_bytes);
    
    // Configuración española
    let game_config = game_config::make_spanish_game_config();
    let alphabet = game_config.alphabet();
    
    // Palabras a probar con diferentes representaciones
    let test_words = vec![
        ("CHORRILLOS", "CHORRILLOS sin corchetes"),
        ("[CH]ORRILLOS", "[CH]ORRILLOS con CH entre corchetes"),
        ("C[H]ORRILLOS", "C[H]ORRILLOS con H entre corchetes (incorrecto)"),
        ("[CH]O[RR]I[LL]OS", "[CH]O[RR]I[LL]OS con todos los dígrafos"),
        ("CHORRO", "CHORRO sin corchetes"),
        ("[CH]ORRO", "[CH]ORRO con CH entre corchetes"),
        ("LLAMA", "LLAMA sin corchetes"),
        ("[LL]AMA", "[LL]AMA con LL entre corchetes"),
        ("CARRO", "CARRO sin corchetes"),
        ("CA[RR]O", "CA[RR]O con RR entre corchetes"),
    ];
    
    println!("=== Pruebas de validación de palabras con dígrafos ===\n");
    
    for (word, description) in test_words {
        println!("Probando: {} - {}", word, description);
        
        // Intentar parsear la palabra
        let word_bytes = word.as_bytes();
        let alphabet_reader = alphabet::AlphabetReader::new_for_words(alphabet);
        
        let mut tiles = Vec::new();
        let mut idx = 0;
        let mut parse_success = true;
        
        print!("  Parsing: ");
        while idx < word_bytes.len() {
            if let Some((tile, next_idx)) = alphabet_reader.next_tile(word_bytes, idx) {
                let tile_str = if tile == 0 { 
                    "?".to_string() 
                } else { 
                    alphabet.of_board(tile).unwrap_or("ERROR").to_string() 
                };
                print!("{} ", tile_str);
                tiles.push(tile);
                idx = next_idx;
            } else {
                println!("\n  ERROR: No se pudo parsear en posición {}", idx);
                parse_success = false;
                break;
            }
        }
        
        if parse_success {
            println!("(total {} tiles)", tiles.len());
            
            // Verificar en el KWG
            let mut p = 0i32;
            let mut kwg_valid = true;
            
            for &tile in &tiles {
                p = kwg.seek(p, tile);
                if p < 0 {
                    kwg_valid = false;
                    break;
                }
            }
            
            if kwg_valid && kwg[p].accepts() {
                println!("  ✓ VÁLIDA en el diccionario");
            } else {
                println!("  ✗ NO encontrada en el diccionario");
            }
        }
        
        println!();
    }
    
    Ok(())
}