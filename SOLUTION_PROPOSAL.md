# Propuesta de Solución: Usar GameState de Wolges

## Problema Actual
Estamos duplicando funcionalidad que wolges ya tiene. Nuestro `BoardState` con `Vec<String>` pierde la información del bit alto que indica blanks.

## Solución: Usar GameState de wolges directamente

### Ventajas:
1. **Preserva blanks correctamente** - usa `[u8]` con bit alto para blanks
2. **Maneja todo el flujo del juego** - turnos, bolsa, racks, scores
3. **Ya está probado y funciona**
4. **Menos código que mantener**

### Cambios necesarios:

1. **En TournamentManager:**
```rust
pub struct Tournament {
    // ... otros campos ...
    pub game_state: wolges::game_state::GameState,  // En lugar de rounds con BoardState
}
```

2. **Para aplicar jugadas:**
```rust
// En lugar de nuestra función apply_play_to_board
game_state.play(&game_config, &mut rng, &play)?;
```

3. **Para serializar al frontend:**
```rust
// Usar BoardFenner para convertir a string
let fen = format!("{}", display::BoardFenner::new(
    alphabet,
    board_layout,
    &game_state.board_tiles,
));
```

4. **Para el frontend:**
- Podemos mantener la representación actual con strings
- Convertir desde/hacia FEN notation cuando sea necesario

### Alternativa mínima si no queremos cambiar tanto:

Solo cambiar `BoardState` para usar `Vec<u8>` en lugar de `Vec<String>`:

```rust
pub struct BoardState {
    pub tiles: Vec<u8>,  // 0 = vacío, 1-29 = tiles, 129-157 = blanks
}
```

Y agregar funciones de conversión para el frontend:
```rust
impl BoardState {
    pub fn to_display_strings(&self, alphabet: &Alphabet) -> Vec<String> {
        self.tiles.iter().map(|&tile| {
            if tile == 0 {
                String::new()
            } else if tile >= 0x80 {
                // Es un blank - mostrar en minúscula
                let letter = alphabet.of_board(tile & 0x7F).unwrap_or("");
                letter.to_lowercase()
            } else {
                alphabet.of_board(tile).unwrap_or("").to_string()
            }
        }).collect()
    }
}
```

## Recomendación

Usar GameState completo de wolges. Es la solución más robusta y ya está probada.