#!/bin/bash

# Test específico para el bug de residuo
# Problema: Con 1 ficha residual, solo se surtieron 5 nuevas (total 6) en lugar de 6 nuevas (total 7)

echo "========================================="
echo "  TEST: BUG DE RESIDUO CON DÍGRAFOS"
echo "========================================="
echo ""

BASE_URL="http://localhost:8080"

# Crear torneo
echo "1. Creando torneo de prueba..."
TOUR_ID=$(curl -s -X POST $BASE_URL/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Residuo Bug", "player_names": ["Test"]}' | jq -r '.data.id')

echo "   Torneo ID: $TOUR_ID"
echo ""

# Función para contar fichas reales
count_real_tiles() {
    local rack="$1"
    # Los dígrafos cuentan como 1 ficha cada uno
    local count=0
    local temp="$rack"
    
    # Contar y remover dígrafos
    while [[ "$temp" == *"[CH]"* ]]; do
        temp="${temp/\[CH\]/}"
        ((count++))
    done
    while [[ "$temp" == *"[LL]"* ]]; do
        temp="${temp/\[LL\]/}"
        ((count++))
    done
    while [[ "$temp" == *"[RR]"* ]]; do
        temp="${temp/\[RR\]/}"
        ((count++))
    done
    
    # Contar caracteres restantes
    count=$((count + ${#temp}))
    echo "$count"
}

echo "2. Simulando rondas hasta encontrar residuo..."
echo ""

for round in {1..20}; do
    # Generar ronda
    ROUND_RESPONSE=$(curl -s -X POST $BASE_URL/tournament/$TOUR_ID/round/start)
    
    if [ $? -ne 0 ] || [ -z "$ROUND_RESPONSE" ]; then
        echo "   Error generando ronda $round"
        break
    fi
    
    RACK=$(echo "$ROUND_RESPONSE" | jq -r '.data.rack // "N/A"')
    TILES_LEFT=$(curl -s -X GET $BASE_URL/tournament/$TOUR_ID | jq -r '.data.tiles_remaining // 0')
    
    # Contar fichas en el rack
    TILE_COUNT=$(count_real_tiles "$RACK")
    
    echo "   Ronda $round:"
    echo "     Rack recibido: $RACK"
    echo "     Fichas contadas: $TILE_COUNT"
    echo "     Fichas en bolsa: $TILES_LEFT"
    
    # Verificar si hay problema de conteo
    if [ "$TILE_COUNT" -ne 7 ] && [ "$TILES_LEFT" -ge 7 ]; then
        echo "     ⚠️  PROBLEMA DETECTADO!"
        echo "     El rack tiene $TILE_COUNT fichas, debería tener 7"
        
        # Analizar composición
        echo ""
        echo "     Análisis del rack:"
        
        # Contar dígrafos
        CH_COUNT=$(echo "$RACK" | grep -o "\[CH\]" | wc -l | tr -d ' ')
        LL_COUNT=$(echo "$RACK" | grep -o "\[LL\]" | wc -l | tr -d ' ')
        RR_COUNT=$(echo "$RACK" | grep -o "\[RR\]" | wc -l | tr -d ' ')
        
        echo "       - Dígrafos CH: $CH_COUNT"
        echo "       - Dígrafos LL: $LL_COUNT"
        echo "       - Dígrafos RR: $RR_COUNT"
        
        # Contar letras individuales
        INDIVIDUAL=$(echo "$RACK" | sed 's/\[CH\]//g' | sed 's/\[LL\]//g' | sed 's/\[RR\]//g')
        echo "       - Letras individuales: $INDIVIDUAL (${#INDIVIDUAL} fichas)"
        
        # Verificar si hubo residuo en la ronda anterior
        if [ $round -gt 1 ]; then
            PREV_ROUND=$((round - 1))
            PREV_OPTIMAL=$(curl -s -X GET $BASE_URL/tournament/$TOUR_ID | jq -r ".data.rounds[$PREV_ROUND - 1].optimal_play")
            
            if [ "$PREV_OPTIMAL" != "null" ]; then
                TILES_USED=$(echo "$PREV_OPTIMAL" | jq -r '.tiles_used | length')
                echo ""
                echo "     Ronda anterior:"
                echo "       - Fichas usadas en jugada: $TILES_USED"
                echo "       - Residuo esperado: $((7 - TILES_USED)) fichas"
            fi
        fi
        
        # Log del servidor para depuración
        echo ""
        echo "     🔍 Este es el escenario reportado por el usuario"
        echo "        Esperado: 1 residual + 6 nuevas = 7 total"
        echo "        Recibido: $TILE_COUNT fichas"
        
        break  # Detener al encontrar el problema
    fi
    
    # Colocar jugada óptima
    curl -s -X PUT $BASE_URL/tournament/$TOUR_ID/round/$round/place_optimal > /dev/null
done

echo ""
echo "========================================="
echo "  FIN DEL TEST"
echo "========================================="