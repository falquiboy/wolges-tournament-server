# Análisis del Reglamento de Scrabble Duplicado vs Implementación Actual

## Resumen Ejecutivo

Este documento compara el reglamento oficial de la modalidad duplicada de Scrabble con la implementación actual en el tournament server de wolges. Se identifican diferencias, posibles mejoras y se propone un plan de implementación para los criterios de desempate cuando múltiples jugadas tienen el mismo puntaje máximo.

## Diferencias Principales

### 1. Composición del Atril

**Reglamento:**
- Hasta ronda 15: menos de 6 vocales y menos de 6 consonantes
- A partir de ronda 16: mínimo una vocal y una consonante (sin contar comodines)
- Los comodines pueden contar como vocales o consonantes
- La Y se considera consonante

**Implementación actual:**
- No hay validación de composición del atril
- Sistema genera atriles aleatorios sin restricciones de vocales/consonantes

**Acción requerida:** Implementar validación de atril según las reglas.

### 2. Condiciones de Fin de Partida

**Reglamento:**
- Se han utilizado todas las vocales o todas las consonantes
- Con las fichas restantes no se puede realizar ninguna jugada válida
- Número predeterminado de rondas (solo para iniciación)
- Decisión del Juez Árbitro por problemas técnicos

**Implementación actual:**
- Se ha colocado la última vocal en el tablero
- Se ha colocado la última consonante en el tablero
- (Falta: verificación de jugadas válidas posibles)

**Acción requerida:** La implementación actual es más estricta. Ajustar para seguir el reglamento.

### 3. Duración de Ronda

**Reglamento:**
- 3 minutos por ronda
- Avisos a 1 minuto y 30 segundos restantes
- "ALCEN" a 5 segundos del final

**Implementación actual:**
- Configurable, no hay valor por defecto
- No hay avisos automáticos de tiempo

**Acción requerida:** Establecer 3 minutos como tiempo por defecto y agregar avisos.

### 4. Criterios de Selección de Jugada Maestra

**Reglamento (cuando hay múltiples jugadas con la misma puntuación máxima):**
1. La jugada que no utilice el comodín
2. La jugada que deje el atril más equilibrado
3. La jugada que use el menor número de letras
4. La primera jugada en orden alfabético
5. Posición en el tablero (más cerca de A1)

**Implementación actual:**
- Selección al azar entre jugadas de máxima puntuación

**Acción requerida:** CRÍTICO - Implementar criterios de desempate según reglamento.

### 5. Bonificaciones

**Reglamento:**
- 10 puntos si eres el único en encontrar la jugada maestra
- 5 puntos si eres el único con máxima puntuación (no maestra)
- Máximo 25 puntos en bonificaciones
- No recomendado para menos de 10 jugadores

**Implementación actual:**
- No hay sistema de bonificaciones

**Acción requerida:** Implementar sistema de bonificaciones (opcional).

### 6. Penalizaciones

**Reglamento:**
- 0 puntos por comodín no marcado
- 0 puntos por jugada fuera de tiempo
- 0 puntos por papeleta mal anotada

**Implementación actual:**
- No hay sistema formal de penalizaciones
- Los comodines se manejan automáticamente

**Acción requerida:** Considerar penalizaciones para modo torneo presencial.

## Análisis de Criterios de Desempate

### Mi Opinión sobre la Ambigüedad

Concuerdo contigo en que los criterios son vagos y ambiguos, especialmente:

1. **"Atril más equilibrado"** - Este criterio es completamente subjetivo. ¿Qué es equilibrado? ¿Igual número de vocales y consonantes? ¿Distribución de valores? ¿Evitar duplicados?

2. **"Orden alfabético"** - No está claro si se refiere a:
   - La palabra formada (CASA vs COSA)
   - Las letras usadas del atril (ACL vs ACS)
   - El orden de las fichas colocadas

3. **"Menor número de letras"** - Podría crear situaciones contradictorias con maximizar puntos.

### Propuesta de Implementación

```rust
#[derive(Debug, Clone)]
pub struct PlayEvaluation {
    pub score: i32,
    pub uses_blank: bool,
    pub tiles_used: u8,
    pub word: String,
    pub position: Position,
    pub rack_balance_score: f32, // Métrica objetiva de balance
}

impl PlayEvaluation {
    // Calcula un score de balance del atril resultante
    fn calculate_rack_balance(&self, remaining_rack: &[u8]) -> f32 {
        let (vowels, consonants, blanks) = count_tile_types(remaining_rack);
        
        // Penalizar desbalances extremos
        let vowel_ratio = vowels as f32 / (vowels + consonants) as f32;
        let balance_penalty = (vowel_ratio - 0.5).abs();
        
        // Bonus por tener al menos un comodín
        let blank_bonus = if blanks > 0 { 0.1 } else { 0.0 };
        
        // Penalizar duplicados excesivos
        let duplicate_penalty = calculate_duplicate_penalty(remaining_rack);
        
        1.0 - balance_penalty - duplicate_penalty + blank_bonus
    }
}

// Comparador según reglamento
fn compare_plays(a: &PlayEvaluation, b: &PlayEvaluation) -> Ordering {
    // 1. La jugada que no utilice comodín
    match (a.uses_blank, b.uses_blank) {
        (false, true) => return Ordering::Less,
        (true, false) => return Ordering::Greater,
        _ => {}
    }
    
    // 2. Atril más equilibrado (usando métrica objetiva)
    if (a.rack_balance_score - b.rack_balance_score).abs() > 0.1 {
        return b.rack_balance_score.partial_cmp(&a.rack_balance_score).unwrap();
    }
    
    // 3. Menor número de letras
    match a.tiles_used.cmp(&b.tiles_used) {
        Ordering::Equal => {},
        other => return other,
    }
    
    // 4. Orden alfabético de la palabra
    match a.word.cmp(&b.word) {
        Ordering::Equal => {},
        other => return other,
    }
    
    // 5. Posición en tablero (más cerca de A1)
    let a_distance = a.position.row + a.position.col;
    let b_distance = b.position.row + b.position.col;
    a_distance.cmp(&b_distance)
}
```

## Plan de Implementación Prioritario

### Fase 1: Criterios de Jugada Maestra (CRÍTICO)
1. Modificar `find_optimal_play` para devolver TODAS las jugadas de máxima puntuación
2. Implementar estructura `PlayEvaluation` con métricas necesarias
3. Implementar comparador según reglamento
4. Definir métrica objetiva para "atril equilibrado"
5. Testing exhaustivo con casos edge

### Fase 2: Validación de Atril
1. Implementar `validate_rack_composition` con reglas por ronda
2. Agregar rechazo y regeneración automática de atriles inválidos
3. Logging de cambios de atril

### Fase 3: Condiciones de Fin
1. Implementar verificación de jugadas posibles con atril actual
2. Ajustar criterios de fin según reglamento
3. Agregar endpoint para forzar fin de partida (Juez Árbitro)

### Fase 4: Mejoras de Tiempo
1. Establecer 3 minutos como default
2. Implementar avisos de tiempo
3. Sistema de penalizaciones por tiempo (opcional)

### Fase 5: Bonificaciones (Opcional)
1. Tracking de jugadores que encuentran jugada maestra
2. Cálculo y aplicación de bonificaciones
3. Configuración por torneo

## Conclusiones

1. **La implementación actual es funcional pero no sigue el reglamento oficial**. Esto es aceptable para juego casual pero problemático para torneos oficiales.

2. **Los criterios de desempate son el cambio más crítico**. La selección aleatoria actual puede ser frustrante para jugadores serios.

3. **La ambigüedad del "atril equilibrado" requiere una decisión de diseño**. Propongo una métrica objetiva basada en proporción de vocales/consonantes y penalización de duplicados.

4. **Recomiendo implementación por fases**, priorizando los criterios de jugada maestra que afectan directamente la experiencia de juego.

5. **Considerar un "modo reglamento"** vs "modo casual" para mantener flexibilidad.

## Siguientes Pasos

1. Revisar y aprobar la métrica propuesta para "atril equilibrado"
2. Decidir si implementar todos los criterios o un subconjunto
3. Definir si crear modo reglamento separado
4. Comenzar con Fase 1 (criterios de jugada maestra)