#!/bin/bash

# Test rápido para verificar condición de fin de partida
echo "========================================="
echo "  TEST: CONDICIÓN DE FIN DE PARTIDA"
echo "========================================="

BASE_URL="http://localhost:8080"

# Crear torneo
TOUR_ID=$(curl -s -X POST $BASE_URL/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Fin", "player_names": ["Test"]}' | jq -r '.data.id')

echo "Torneo ID: $TOUR_ID"
echo ""

# Simular muchas rondas
for round in {1..30}; do
    # Generar ronda
    ROUND_RESPONSE=$(curl -s -X POST $BASE_URL/tournament/$TOUR_ID/round/start 2>/dev/null)
    
    if [ -z "$ROUND_RESPONSE" ]; then
        echo "No hay respuesta en ronda $round - posible fin de partida"
        break
    fi
    
    # Obtener fichas restantes
    TILES_LEFT=$(curl -s -X GET $BASE_URL/tournament/$TOUR_ID | jq -r '.data.tiles_remaining // 0')
    
    echo "Ronda $round: $TILES_LEFT fichas en bolsa"
    
    # Verificar condición de fin
    END_CHECK=$(curl -s -X GET $BASE_URL/tournament/$TOUR_ID/check_end)
    GAME_ENDED=$(echo "$END_CHECK" | jq -r '.data.game_ended // false')
    END_REASON=$(echo "$END_CHECK" | jq -r '.data.reason // "N/A"')
    
    if [ "$GAME_ENDED" = "true" ]; then
        echo ""
        echo "🏁 PARTIDA TERMINADA EN RONDA $round"
        echo "   Razón: $END_REASON"
        echo "   Fichas restantes: $TILES_LEFT"
        
        if [ "$TILES_LEFT" -ge "7" ]; then
            echo "   ⚠️ PROBLEMA: Partida terminó con $TILES_LEFT fichas (>= 7)"
        else
            echo "   ✓ OK: Pocas fichas restantes"
        fi
        break
    fi
    
    # Colocar jugada óptima
    curl -s -X PUT $BASE_URL/tournament/$TOUR_ID/round/$round/place_optimal > /dev/null
    
    # Advertencia si quedan pocas fichas pero no termina
    if [ "$TILES_LEFT" -lt "7" ] && [ "$TILES_LEFT" -gt "0" ]; then
        echo "   📌 Nota: Solo $TILES_LEFT fichas pero el juego continúa (correcto)"
    fi
done

echo ""
echo "========================================="
