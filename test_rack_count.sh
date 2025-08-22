#!/bin/bash

# Test para verificar el conteo correcto de fichas con dígrafos

echo "========================================="
echo "  TEST: CONTEO DE FICHAS CON DÍGRAFOS"
echo "========================================="
echo ""

BASE_URL="http://localhost:8080"

# Crear torneo
echo "1. Creando torneo de prueba..."
TOUR_ID=$(curl -s -X POST $BASE_URL/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Conteo Dígrafos", "player_names": ["Test"]}' | jq -r '.data.id')

echo "   Torneo ID: $TOUR_ID"
echo ""

# Función para contar caracteres reales en el rack (considerando dígrafos)
count_tiles() {
    local rack="$1"
    # Remover los brackets de los dígrafos para contar fichas reales
    local cleaned=$(echo "$rack" | sed 's/\[CH\]/X/g' | sed 's/\[LL\]/X/g' | sed 's/\[RR\]/X/g')
    echo "${#cleaned}"
}

echo "2. Generando rondas y analizando racks..."
echo ""

for round in {1..10}; do
    # Generar ronda
    ROUND_RESPONSE=$(curl -s -X POST $BASE_URL/tournament/$TOUR_ID/round/start)
    
    RACK=$(echo "$ROUND_RESPONSE" | jq -r '.data.rack // "N/A"')
    TILES_LEFT=$(echo "$ROUND_RESPONSE" | jq -r '.data.tiles_remaining // 0')
    
    # Contar fichas en el rack
    TILE_COUNT=$(count_tiles "$RACK")
    
    echo "   Ronda $round:"
    echo "     Rack: $RACK"
    echo "     Fichas contadas: $TILE_COUNT"
    echo "     Fichas en bolsa: $TILES_LEFT"
    
    # Verificar si el conteo es correcto
    if [ "$TILE_COUNT" -ne 7 ] && [ "$TILES_LEFT" -ge 7 ]; then
        echo "     ⚠️  PROBLEMA: El rack tiene $TILE_COUNT fichas, debería tener 7"
        
        # Analizar el rack más detalladamente
        echo "     Análisis detallado:"
        if [[ "$RACK" == *"[CH]"* ]]; then
            echo "       - Contiene dígrafo CH"
        fi
        if [[ "$RACK" == *"[LL]"* ]]; then
            echo "       - Contiene dígrafo LL"
        fi
        if [[ "$RACK" == *"[RR]"* ]]; then
            echo "       - Contiene dígrafo RR"
        fi
    fi
    
    # Obtener jugada óptima
    OPTIMAL=$(curl -s -X GET $BASE_URL/tournament/$TOUR_ID | jq -r ".data.rounds[$round - 1].optimal_play")
    
    if [ "$OPTIMAL" != "null" ]; then
        TILES_USED=$(echo "$OPTIMAL" | jq -r '.tiles_used | length')
        echo "     Jugada óptima usa: $TILES_USED fichas"
    fi
    
    # Colocar jugada para avanzar
    curl -s -X PUT $BASE_URL/tournament/$TOUR_ID/round/$round/place_optimal > /dev/null
    
    echo ""
done

echo "========================================="
echo "  FIN DEL TEST"
echo "========================================="