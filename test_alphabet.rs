use wolges::{alphabet, game_config};

fn main() {
    println!("=== Spanish Standard Alphabet ===");
    let spanish_alphabet = alphabet::make_spanish_alphabet();
    print_alphabet(&spanish_alphabet);
    
    println!("\n=== Spanish Internal Alphabet ===");
    let spanish_internal = alphabet::make_spanish_internal_alphabet();
    print_alphabet(&spanish_internal);
    
    println!("\n=== Game Config Comparison ===");
    let config_standard = game_config::make_spanish_game_config();
    let config_internal = game_config::make_spanish_internal_game_config();
    
    println!("Standard config alphabet len: {}", config_standard.alphabet().len());
    println!("Internal config alphabet len: {}", config_internal.alphabet().len());
}

fn print_alphabet(alphabet: &alphabet::Alphabet) {
    println!("Total tiles: {}", alphabet.len());
    println!("Tiles with frequencies:");
    
    for tile in 0..alphabet.len() {
        let letter = alphabet.of_board(tile).unwrap_or("?");
        let freq = alphabet.freq(tile);
        let score = alphabet.score(tile);
        
        println!("  Tile {}: '{}' x{} (score: {})", 
            tile, letter, freq, score);
    }
    
    // Imprimir información adicional
    println!("\nVowels and Consonants:");
    for tile in 1..alphabet.len() {
        let letter = alphabet.of_board(tile).unwrap_or("?");
        let is_vowel = alphabet.is_vowel(tile);
        if is_vowel {
            println!("  {} is a vowel", letter);
        }
    }
}