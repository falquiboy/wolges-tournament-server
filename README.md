# Spanish Scrabble Duplicate Tournament Server

Sistema de gestión de torneos de Scrabble Duplicado en español, construido sobre el motor wolges de Andy Kurnia.

## Descripción General

Este servidor proporciona una API REST y una interfaz web para administrar torneos de Scrabble en modalidad Duplicada, donde todos los jugadores reciben el mismo atril de fichas y el ganador es quien obtiene la mejor puntuación.

## Arquitectura

### Stack Tecnológico
- **Backend**: Rust con Actix-web
- **Motor Scrabble**: wolges (Andy Kurnia)
- **Frontend**: HTML5 + JavaScript vanilla
- **Diccionario**: FISE2016 (639,293 palabras españolas)

### Componentes Principales

#### 1. WolgesEngine (`src/wolges_engine.rs`)
Wrapper alrededor del motor wolges que proporciona:
- Carga de diccionarios KWG (Kurnia Word Graph)
- Búsqueda de jugadas óptimas
- Cálculo de puntuaciones
- Validación de palabras

#### 2. TournamentManager (`src/tournament_manager.rs`)
Gestión del estado del torneo:
- Creación y administración de torneos
- Generación de atriles con validación
- Gestión de la bolsa de fichas
- Seguimiento del jugador Master

#### 3. API REST (`src/routes.rs`)
Endpoints principales:
- `POST /dictionary/load` - Cargar diccionario KWG
- `POST /tournament/create` - Crear nuevo torneo
- `POST /tournament/{id}/round/start` - Iniciar nueva ronda
- `POST /tournament/{id}/round/start_manual` - Usar atril manual
- `GET /tournament/{id}/round/{round}/optimal` - Obtener jugada óptima
- `PUT /tournament/{id}/round/{round}/reveal_optimal` - Revelar jugada
- `PUT /tournament/{id}/round/{round}/place_optimal` - Colocar jugada

## Creación y Manejo del Diccionario KWG

### Generación del KWG desde CSV
El diccionario FISE2016.kwg se creó a partir de `lexicon_keys.csv`:

```python
# extract_first_column_no_transform.py
with open('lexicon_keys.csv', 'r', encoding='utf-8') as input_file:
    with open('FILE2016_original.txt', 'w', encoding='utf-8') as output_file:
        for line in input_file:
            if line.strip():
                word = line.split(',')[0].strip()
                output_file.write(word + '\n')
```

Luego se compiló usando wolges:
```bash
cargo run --release --bin buildlex -- FILE2016_original.txt FISE2016.kwg
```

Resultado: 639,293 palabras válidas en formato KWG (4MB).

### Lectura del KWG en Wolges
```rust
use wolges::kwg;
let kwg_bytes = std::fs::read("FISE2016.kwg")?;
let kwg = kwg::Kwg::from_bytes_alloc(&kwg_bytes);
```

## Solución al Problema de Dígrafos en Español

### El Problema

El Scrabble español tiene tres dígrafos que cuentan como fichas únicas:
- **CH** - 5 puntos
- **LL** - 8 puntos  
- **RR** - 8 puntos

El motor wolges esperaba que estos dígrafos se almacenaran como caracteres únicos en el KWG, pero el diccionario original los contenía como dos letras separadas (ej: "CACHORRO" en lugar de "CA[CH]O[RR]O"). Esto causaba que el generador de jugadas no encontrara palabras con dígrafos cuando estaban presentes en el rack.

### La Solución

Implementamos una conversión interna para mapear los dígrafos a caracteres únicos que no se usan en español:

1. **Conversión del diccionario** (`convert_digraphs.py`):
   ```python
   def convert_digraphs(text):
       text = text.replace('CH', 'ç')
       text = text.replace('LL', 'k')
       text = text.replace('RR', 'w')
       return text
   ```

2. **Alfabeto interno** (`spanish_internal.txt`):
   - Agregamos ç, k, w como representaciones internas de CH, LL, RR
   - Mantuvimos los mismos valores de puntos y frecuencias

3. **Traducción bidireccional en el motor**:
   ```rust
   fn convert_digraphs_to_internal(s: &str) -> String {
       s.replace("[CH]", "ç")
        .replace("[LL]", "k")
        .replace("[RR]", "w")
   }
   
   fn convert_internal_to_digraphs(s: &str) -> String {
       s.replace("ç", "[CH]")
        .replace("k", "[LL]")
        .replace("w", "[RR]")
   }
   ```

4. **Generación del nuevo KWG**:
   ```bash
   python3 convert_digraphs.py FILE2016_original.txt FILE2016_converted.txt
   cargo run --release --bin buildlex -- spanish-internal-kwg FILE2016_converted.txt FISE2016_converted.kwg
   ```

### Resultado

- El rack `[CH]O[RR]I[LL]OS` ahora genera correctamente 184 jugadas posibles
- La mejor jugada es CHORRILLOS con 116 puntos
- También encuentra otras palabras con dígrafos como ARREAN, ARREEN, etc.
- La interfaz muestra correctamente los dígrafos como [CH], [LL], [RR]

### Flujo de Datos

1. **Entrada del usuario**: `[CH]O[RR]I[LL]OS`
2. **Conversión interna**: `çOwIkOS`
3. **Búsqueda en KWG**: Encuentra palabras con ç, k, w
4. **Salida al usuario**: `[CH]O[RR]I[LL]OS`

Esta solución mantiene la compatibilidad con el motor wolges mientras proporciona una experiencia transparente para los usuarios del Scrabble español.

## Integración con Wolges

### 1. Alfabeto Español y Dígrafos

#### Definición del Alfabeto (`wolges/src/alphabets/spanish.txt`)
```
?	?	2	0	0	0	0
A	a	12	1	1	0	0
B	b	2	3	0	0	0
C	c	4	3	0	0	0
[CH]	[ch]	1	5	0	1 1	0
D	d	5	2	0	0	0
...
[LL]	[ll]	1	8	0	1 2	0
...
[RR]	[rr]	1	8	0	1 3	0
```

Los dígrafos se definen con corchetes y tienen características especiales:
- **Valor**: CH=5 puntos, LL=8 puntos, RR=8 puntos
- **Frecuencia**: 1 ficha de cada uno
- **Alias**: Números que indican cómo manejarlos internamente

#### Manejo Interno de Dígrafos
Wolges representa los dígrafos de forma especial:
- En memoria: Se almacenan como tiles únicos con IDs específicos
- En strings: Se representan como `[CH]`, `[LL]`, `[RR]`
- En el tablero: Ocupan una sola casilla

### 2. Conversión de Representaciones

#### De String a Tiles (para racks)
```rust
let alphabet = engine.get_alphabet();
let rack_bytes = rack.as_bytes();
let rack_reader = alphabet::AlphabetReader::new_for_racks(alphabet);
let mut idx = 0;
let mut tiles = Vec::new();

while idx < rack_bytes.len() {
    if let Some((tile, next_idx)) = rack_reader.next_tile(rack_bytes, idx) {
        tiles.push(tile);
        idx = next_idx;
    }
}
```

#### De Tiles a String (para display)
```rust
fn tiles_to_string(tiles: &[u8], alphabet: &alphabet::Alphabet) -> String {
    tiles.iter()
        .filter_map(|&tile| {
            if tile == 0 {
                Some("?".to_string())
            } else {
                alphabet.of_board(tile).map(|s| s.to_string())
            }
        })
        .collect()
}
```

### 3. Manejo en la Interfaz Web

Para hacer la experiencia más intuitiva, procesamos los dígrafos en el frontend:

```javascript
// Detectar y contar dígrafos
function countTilesInRack(rack) {
    let count = 0;
    let i = 0;
    while (i < rack.length) {
        if (i < rack.length - 1) {
            const digraph = rack.substring(i, i + 2);
            if (digraph === 'CH' || digraph === 'LL' || digraph === 'RR') {
                count++;
                i += 2;
                continue;
            }
        }
        count++;
        i++;
    }
    return count;
}

// Limpiar corchetes para display
const cleanWord = word.replace(/\[([^\]]+)\]/g, '$1').toUpperCase();
```

### 4. Validación de Palabras con Dígrafos

El KWG contiene todas las formas válidas incluyendo palabras con dígrafos:
- CHORRILLOS (con CH y RR)
- LLAMA (con LL)
- CARRO (con RR)
- ACHICHINQUE (con múltiples CH)

La búsqueda en el KWG maneja automáticamente estos casos especiales.

### 2. Estructuras de Datos de Wolges

#### Bag (Bolsa de fichas)
```rust
use wolges::bag;
let mut bag = bag::Bag::new(alphabet);
bag.shuffle(&mut rng);
let tile = bag.pop();
```

#### Alphabet (Alfabeto)
```rust
use wolges::alphabet;
let alphabet = alphabet::make_spanish_alphabet();
let tile_string = alphabet.of_board(tile);
```

#### Game State
```rust
use wolges::game_state;
let mut game_state = game_state::GameState::new(&game_config);
game_state.set_current_player(0);
game_state.set_tile_on_board(row, col, tile);
```

#### Move Generator
```rust
use wolges::movegen;
let mut move_generator = movegen::KurniaMoveGenerator::new(&game_config);
move_generator.gen_moves_unfiltered(&movegen::BoardSnapshot<'_>, &rack);
```

### 3. Funcionalidades Clave de Wolges Utilizadas

#### Generación de Jugadas Óptimas
El motor analiza todas las jugadas posibles y encuentra la de mayor puntuación:
```rust
pub fn find_optimal_play(&mut self, board_state: &BoardState, rack: &str) 
    -> Result<OptimalPlay, String> {
    // Configurar el estado del juego
    let mut game_state = self.setup_game_state(board_state)?;
    
    // Generar todas las jugadas posibles
    let board_snapshot = &movegen::BoardSnapshot {
        board_tiles: &board_tiles,
        game_config: &self.game_config,
        kwg: &self.kwg,
        klv: &klv,
    };
    
    move_generator.gen_moves_unfiltered(&board_snapshot, &rack_tiles, true);
    let plays = move_generator.plays();
    
    // Encontrar la mejor jugada
    let best_play = plays.iter().max_by_key(|p| p.score);
}
```

#### Validación de Atriles
Para la modalidad duplicada, validamos restricciones especiales:
```rust
// Máximo 5 vocales o consonantes en rondas 1-15
if round_number <= 15 && rack_tiles.len() == 7 {
    let (vowels, consonants, _) = Self::count_tile_types(&rack_tiles, alphabet);
    if vowels > 5 || consonants > 5 {
        // Rechazar y regenerar
    }
}
```

### 4. Características Especiales para Duplicada

#### Gestión Persistente de la Bolsa
A diferencia del Scrabble clásico, mantenemos una bolsa por torneo:
```rust
bags: HashMap<Uuid, bag::Bag>  // Bolsa persistente por torneo
```

#### Sin Consideraciones Estratégicas
En duplicada solo importa la puntuación máxima:
- No se usan valores de leave (KLV)
- No hay estrategia de intercambio
- Solo cuenta la jugada de mayor puntuación inmediata

#### Transparencia Total
- Visualización de todas las fichas (usadas y disponibles)
- Historial completo del jugador Master
- Revelación controlada de jugadas óptimas

## Flujo de Juego

1. **Preparación**
   - Cargar diccionario FISE2016.kwg
   - Crear torneo con jugadores

2. **Por cada ronda**
   - Generar atril (automático o manual)
   - Validar restricciones (rondas 1-15)
   - Iniciar temporizador de 3 minutos
   - Los jugadores envían sus jugadas

3. **Fin de ronda**
   - Admin revela y coloca jugada óptima
   - Se actualiza el Master
   - Se prepara siguiente ronda

## Instalación y Uso

### Requisitos
- Rust 1.70+
- Diccionario FISE2016.kwg compilado
- Navegador web moderno

### Ejecución
```bash
cargo build --release
./run-server.sh
# Abrir http://localhost:8080
```

### Desarrollo
```bash
cargo watch -x run
```

## Contribuciones

Este proyecto es una implementación específica para torneos de Scrabble Duplicado en español, basada en el excelente trabajo de Andy Kurnia con wolges.

## Licencia

Ver licencia de wolges para el motor base.