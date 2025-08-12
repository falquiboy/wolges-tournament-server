use std::path::Path;
use wolges::{
    alphabet, game_config, klv, kwg, movegen,
};
use wolges::kwg::Node;

fn main() {
    println!("=== Test de Generación de Jugadas WOLGES ===\n");
    
    // Cargar diccionario
    let kwg_path = Path::new("lexicon/FISE2016.kwg");
    let klv_path = Path::new("lexicon/spanish.klv");
    
    let kwg_bytes = std::fs::read(kwg_path).expect("Failed to read KWG file");
    let kwg = kwg::Kwg::from_bytes_alloc(&kwg_bytes);
    
    let klv_bytes = std::fs::read(klv_path).expect("Failed to read KLV file");
    let klv = klv::Klv::from_bytes_alloc(&klv_bytes);
    
    // Configurar juego español
    let game_config = game_config::make_spanish_game_config();
    let alphabet = game_config.alphabet();
    
    // Test 1: Tablero vacío, atril simple
    println!("Test 1: Tablero vacío con atril CASA");
    test_empty_board(&game_config, &kwg, &klv, "CASA");
    
    // Test 2: Tablero vacío, atril con comodín
    println!("\nTest 2: Tablero vacío con atril CAS?");
    test_empty_board(&game_config, &kwg, &klv, "CAS?");
    
    // Test 3: Tablero con una palabra
    println!("\nTest 3: Tablero con CASA horizontal en H8, atril MESA");
    test_board_with_word(&game_config, &kwg, &klv);
    
    // Test 4: Atril con muchas letras diferentes
    println!("\nTest 4: Tablero vacío con atril AEIOURS (7 letras diferentes)");
    test_empty_board(&game_config, &kwg, &klv, "AEIOURS");
}

fn test_empty_board<L: kwg::Node>(
    game_config: &game_config::GameConfig,
    kwg: &kwg::Kwg<L>,
    klv: &klv::Klv<L>,
    rack_str: &str,
) {
    let mut board_tiles = vec![0u8; 225];
    let rack_bytes = rack_str.as_bytes();
    let alphabet = game_config.alphabet();
    
    // Convertir rack a tiles
    let rack_reader = alphabet::AlphabetReader::new_for_racks(alphabet);
    let mut rack_tiles = Vec::new();
    let mut idx = 0;
    
    while idx < rack_bytes.len() {
        if let Some((tile, next_idx)) = rack_reader.next_tile(rack_bytes, idx) {
            rack_tiles.push(tile);
            idx = next_idx;
        }
    }
    
    println!("Rack: {} → tiles: {:?}", rack_str, rack_tiles);
    
    // Crear move generator
    let mut move_generator = movegen::KurniaMoveGenerator::new(game_config);
    
    let board_snapshot = movegen::BoardSnapshot {
        board_tiles: &board_tiles,
        game_config,
        kwg,
        klv,
    };
    
    let gen_moves_params = movegen::GenMovesParams {
        board_snapshot: &board_snapshot,
        rack: &rack_tiles,
        max_gen: 10000,  // Generar MUCHAS jugadas para el test
        num_exchanges_by_this_player: 0,
        always_include_pass: false,
    };
    
    move_generator.gen_moves_unfiltered(&gen_moves_params);
    
    println!("Jugadas generadas: {}", move_generator.plays.len());
    
    // Analizar las jugadas
    let mut plays_by_score = std::collections::HashMap::<i32, Vec<String>>::new();
    let mut plays_by_length = std::collections::HashMap::<usize, usize>::new();
    let mut unique_words = std::collections::HashSet::<String>::new();
    
    for valued_move in &move_generator.plays {
        match &valued_move.play {
            movegen::Play::Place { down, lane, idx, word, score } => {
                let word_str: String = word.iter()
                    .filter(|&&t| t != 0)
                    .map(|&t| alphabet.of_board(t).unwrap_or("?"))
                    .collect();
                
                unique_words.insert(word_str.clone());
                *plays_by_length.entry(word_str.len()).or_insert(0) += 1;
                
                let row = if *down { *idx } else { *lane };
                let col = if *down { *lane } else { *idx };
                let dir = if *down { "↓" } else { "→" };
                
                let play_str = format!("{} en {}{}{}",
                    word_str,
                    ('A' as u8 + row as u8) as char,
                    col + 1,
                    dir
                );
                
                plays_by_score.entry(*score).or_insert_with(Vec::new).push(play_str);
            },
            movegen::Play::Exchange { .. } => {
                // Ignorar intercambios para este test
            }
        }
    }
    
    println!("Palabras únicas generadas: {}", unique_words.len());
    
    // Mostrar distribución por longitud de palabra
    println!("\nDistribución por longitud:");
    let mut lengths: Vec<_> = plays_by_length.keys().copied().collect();
    lengths.sort();
    for len in lengths {
        println!("  {} letras: {} jugadas", len, plays_by_length[&len]);
    }
    
    // Mostrar jugadas ordenadas por puntuación
    let mut scores: Vec<_> = plays_by_score.keys().copied().collect();
    scores.sort_by(|a, b| b.cmp(a)); // Mayor a menor
    
    println!("\nTop 5 puntuaciones:");
    for score in scores.iter().take(5) {
        println!("  {} puntos: {} jugadas", score, plays_by_score[score].len());
        for play in plays_by_score[score].iter().take(2) {
            println!("    - {}", play);
        }
        if plays_by_score[score].len() > 2 {
            println!("    ... y {} más", plays_by_score[score].len() - 2);
        }
    }
    
    // Mostrar algunas palabras únicas como ejemplo
    println!("\nAlgunas palabras generadas:");
    let mut word_list: Vec<_> = unique_words.iter().cloned().collect();
    word_list.sort();
    for word in word_list.iter().take(20) {
        print!("{}, ", word);
    }
    println!("...");
}

fn test_board_with_word<L: kwg::Node>(
    game_config: &game_config::GameConfig,
    kwg: &kwg::Kwg<L>,
    klv: &klv::Klv<L>,
) {
    let mut board_tiles = vec![0u8; 225];
    let alphabet = game_config.alphabet();
    let alphabet_reader = alphabet::AlphabetReader::new_for_plays(alphabet);
    
    // Colocar CASA en H8 horizontal (fila 7, columna 7)
    let casa_bytes = "CASA".as_bytes();
    let mut casa_tiles = Vec::new();
    let mut idx = 0;
    
    while idx < casa_bytes.len() {
        if let Some((tile, next_idx)) = alphabet_reader.next_tile(casa_bytes, idx) {
            casa_tiles.push(tile);
            idx = next_idx;
        }
    }
    
    // H8 = fila 7, columna 7
    for (i, &tile) in casa_tiles.iter().enumerate() {
        board_tiles[7 * 15 + 7 + i] = tile;
    }
    
    // Rack MESA
    let rack_bytes = "MESA".as_bytes();
    let rack_reader = alphabet::AlphabetReader::new_for_racks(alphabet);
    let mut rack_tiles = Vec::new();
    idx = 0;
    
    while idx < rack_bytes.len() {
        if let Some((tile, next_idx)) = rack_reader.next_tile(rack_bytes, idx) {
            rack_tiles.push(tile);
            idx = next_idx;
        }
    }
    
    println!("Tablero tiene CASA en H8→");
    println!("Rack: MESA");
    
    // Generar jugadas
    let mut move_generator = movegen::KurniaMoveGenerator::new(game_config);
    
    let board_snapshot = movegen::BoardSnapshot {
        board_tiles: &board_tiles,
        game_config,
        kwg,
        klv,
    };
    
    let gen_moves_params = movegen::GenMovesParams {
        board_snapshot: &board_snapshot,
        rack: &rack_tiles,
        max_gen: 10000,
        num_exchanges_by_this_player: 0,
        always_include_pass: false,
    };
    
    move_generator.gen_moves_unfiltered(&gen_moves_params);
    
    println!("Jugadas generadas: {}", move_generator.plays.len());
    
    // Buscar específicamente MESA, AMES, MEAS, etc.
    println!("\nBuscando anagramas de MESA en las jugadas:");
    let mesa_anagrams = vec!["MESA", "MEAS", "AMES", "SEMA", "SAME"];
    
    for anagram in mesa_anagrams {
        let mut found = false;
        for valued_move in &move_generator.plays {
            match &valued_move.play {
                movegen::Play::Place { down, lane, idx, word, score } => {
                    let word_str: String = word.iter()
                        .filter(|&&t| t != 0)
                        .map(|&t| alphabet.of_board(t).unwrap_or("?"))
                        .collect();
                    
                    if word_str == anagram {
                        let row = if *down { *idx } else { *lane };
                        let col = if *down { *lane } else { *idx };
                        let dir = if *down { "↓" } else { "→" };
                        
                        println!("  ✓ {} encontrado en {}{}{} ({} puntos)",
                            word_str,
                            ('A' as u8 + row as u8) as char,
                            col + 1,
                            dir,
                            score
                        );
                        found = true;
                        break;
                    }
                },
                _ => {}
            }
        }
        if !found {
            println!("  ✗ {} NO encontrado", anagram);
        }
    }
    
    // Mostrar algunas jugadas que usan la S de CASA
    println!("\nAlgunas jugadas que usan la S de CASA (en H11):");
    let mut count = 0;
    for valued_move in &move_generator.plays {
        match &valued_move.play {
            movegen::Play::Place { down, lane, idx, word, score } => {
                if *down && *lane == 10 { // Columna 11 (índice 10)
                    let word_str: String = word.iter()
                        .filter(|&&t| t != 0)
                        .map(|&t| alphabet.of_board(t).unwrap_or("?"))
                        .collect();
                    
                    let row = *idx;
                    let col = *lane;
                    
                    println!("  {} en {}{}↓ ({} puntos)",
                        word_str,
                        ('A' as u8 + row as u8) as char,
                        col + 1,
                        score
                    );
                    
                    count += 1;
                    if count >= 5 {
                        break;
                    }
                }
            },
            _ => {}
        }
    }
}