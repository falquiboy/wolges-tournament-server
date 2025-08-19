#!/bin/bash

echo "=== Prueba final de validación de atriles ==="
echo ""

# Función para probar un rack específico
test_rack() {
    local rack="$1"
    local round="$2"
    local expected="$3"
    local description="$4"
    
    # Crear torneo
    TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
      -H "Content-Type: application/json" \
      -d '{"name": "Test", "player_names": ["Test"]}' \
      -k -s 2>/dev/null | jq -r '.data.id')
    
    # Generar rondas previas si es necesario
    if [ "$round" -gt 1 ]; then
        for i in $(seq 1 $((round - 1))); do
            curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start" \
              -k -s 2>/dev/null > /dev/null
            curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/$i/place_optimal" \
              -k -s 2>/dev/null > /dev/null
        done
    fi
    
    # Probar el rack
    RESULT=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
      -H "Content-Type: application/json" \
      -d "{\"rack\": \"$rack\"}" \
      -k -s 2>/dev/null)
    
    REJECTED=$(echo "$RESULT" | jq -r '.data.rack_rejected')
    REASON=$(echo "$RESULT" | jq -r '.data.rejection_reason')
    
    if [ "$expected" = "valid" ]; then
        if [ "$REJECTED" = "false" ] || [ "$REJECTED" = "null" ]; then
            echo "✅ $description: CORRECTO (aceptado)"
        else
            echo "❌ $description: ERROR (rechazado incorrectamente)"
            echo "   Razón: $REASON"
        fi
    else
        if [ "$REJECTED" = "true" ]; then
            echo "✅ $description: CORRECTO (rechazado)"
            echo "   Razón: $REASON"
        else
            echo "❌ $description: ERROR (aceptado incorrectamente)"
        fi
    fi
}

# Test fresh bag scenarios
echo "Escenario: Bolsa completa (ronda 1)"
echo "------------------------------------"
test_rack "AEIOUBC" 1 "valid" "AEIOUBC ronda 1 (5V, 2C) - válido"
test_rack "BCDFGHI" 1 "invalid" "BCDFGHI ronda 1 (1V, 6C) - excede máx consonantes"
test_rack "AEIOUIO" 1 "invalid" "AEIOUIO ronda 1 (7V, 0C) - excede máx vocales"
test_rack "??BCDEF" 1 "valid" "??BCDEF ronda 1 (1V, 4C, 2B) - válido con comodines"
test_rack "BCDHFST" 1 "invalid" "BCDHFST ronda 1 (0V, 7C) - sin vocales, sin blancos"

echo ""
echo "Escenario: Ronda 16+ (reglas diferentes)"
echo "-----------------------------------------"
# These tests start fresh so all tiles are available
test_rack "BCDFGHE" 16 "valid" "BCDFGHE ronda 16 (1V=E, 6C) - válido (tiene 1 vocal)"
test_rack "BCDFGHT" 16 "invalid" "BCDFGHT ronda 16 (0V, 7C) - inválido (sin vocales ni blancos)"
test_rack "B?CDFGT" 16 "valid" "B?CDFGT ronda 16 (0V, 6C, 1B) - válido (blank puede ser vocal)"
test_rack "UUUUUUU" 16 "invalid" "UUUUUUU ronda 16 (7V, 0C) - inválido (sin consonantes ni blancos)"
test_rack "?UUUUUU" 16 "valid" "?UUUUUU ronda 16 (6V, 0C, 1B) - válido (blank puede ser consonante)"
