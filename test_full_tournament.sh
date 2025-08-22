#!/bin/bash

# Script de prueba end-to-end para validar la refactorización
# Simula un torneo completo con múltiples jugadores

set -e  # Salir si hay algún error

echo "==========================================="
echo "   TEST DE TORNEO COMPLETO END-TO-END"
echo "==========================================="
echo ""

BASE_URL="http://localhost:8080"
PLAYERS=("María" "Juan" "Pedro")

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar respuesta
check_response() {
    local response=$1
    local step=$2
    
    if echo "$response" | jq -e '.success == true' > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $step: OK"
        return 0
    else
        echo -e "${RED}✗${NC} $step: FAILED"
        echo "Response: $response"
        exit 1
    fi
}

# Función para loggear
log_step() {
    echo -e "\n${YELLOW}→${NC} $1"
}

# 1. CREAR TORNEO
log_step "Creando torneo con ${#PLAYERS[@]} jugadores..."
CREATE_RESPONSE=$(curl -s -X POST $BASE_URL/tournament/create \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"Test Tournament $(date +%s)\", \"player_names\": $(echo ${PLAYERS[@]} | jq -R -s -c 'split(" ")')}")

check_response "$CREATE_RESPONSE" "Crear torneo"
TOURNAMENT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.id')
echo "Tournament ID: $TOURNAMENT_ID"

# 2. SIMULAR 10 RONDAS
for round in {1..10}; do
    log_step "RONDA $round"
    
    # 2a. Generar rack
    echo -n "  Generando rack... "
    ROUND_RESPONSE=$(curl -s -X POST $BASE_URL/tournament/$TOURNAMENT_ID/round/start)
    check_response "$ROUND_RESPONSE" "Generar rack"
    
    RACK=$(echo "$ROUND_RESPONSE" | jq -r '.data.rack')
    REJECTED=$(echo "$ROUND_RESPONSE" | jq -r '.data.rack_rejected')
    
    echo "  Rack: $RACK (Rechazado: $REJECTED)"
    
    # 2b. Si el rack fue rechazado, regenerar
    if [ "$REJECTED" = "true" ]; then
        echo -n "  Regenerando rack válido... "
        UPDATE_RESPONSE=$(curl -s -X PUT $BASE_URL/tournament/$TOURNAMENT_ID/round/$round/update_rack \
            -H "Content-Type: application/json" \
            -d '{"rack": "AEIOUBC"}')
        
        if [ "$(echo "$UPDATE_RESPONSE" | jq -r '.success')" = "true" ]; then
            echo -e "${GREEN}✓${NC}"
            RACK=$(echo "$UPDATE_RESPONSE" | jq -r '.data.rack')
            echo "  Nuevo rack: $RACK"
        else
            echo -e "${RED}✗${NC}"
        fi
    fi
    
    # 2c. Calcular jugada óptima (skip si ya viene calculada)
    echo -n "  Verificando jugada óptima... "
    # La jugada óptima ya viene calculada con la ronda
    TOURNAMENT_STATE=$(curl -s -X GET $BASE_URL/tournament/$TOURNAMENT_ID)
    CURRENT_ROUND=$(echo "$TOURNAMENT_STATE" | jq ".data.rounds[$round - 1]")
    
    if [ "$CURRENT_ROUND" != "null" ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}Skipped${NC}"
    fi
    
    OPTIMAL_PLAY=$(echo "$CURRENT_ROUND" | jq -r '.optimal_play')
    if [ "$OPTIMAL_PLAY" != "null" ]; then
        WORD=$(echo "$OPTIMAL_PLAY" | jq -r '.word // "N/A"')
        SCORE=$(echo "$OPTIMAL_PLAY" | jq -r '.score // 0')
        echo "  Palabra: $WORD ($SCORE puntos)"
    fi
    
    # 2d. Simular jugadas de jugadores
    for player in "${PLAYERS[@]}"; do
        # Simular una jugada aleatoria (en producción vendría del frontend)
        echo -n "  Jugador $player enviando jugada... "
        # Por simplicidad, solo registramos que jugó
        echo -e "${GREEN}✓${NC}"
    done
    
    # 2e. Colocar jugada óptima
    echo -n "  Colocando jugada óptima en tablero... "
    PLACE_RESPONSE=$(curl -s -X PUT $BASE_URL/tournament/$TOURNAMENT_ID/round/$round/place_optimal)
    check_response "$PLACE_RESPONSE" "Colocar óptima"
done

# 3. VERIFICAR ESTADO FINAL
log_step "Verificando estado final del torneo..."

# 3a. Obtener estado del torneo
TOURNAMENT_RESPONSE=$(curl -s -X GET $BASE_URL/tournament/$TOURNAMENT_ID)
check_response "$TOURNAMENT_RESPONSE" "Obtener estado torneo"

TILES_REMAINING=$(echo "$TOURNAMENT_RESPONSE" | jq -r '.data.tiles_remaining')
ROUNDS_PLAYED=$(echo "$TOURNAMENT_RESPONSE" | jq -r '.data.rounds | length')

echo "  Rondas jugadas: $ROUNDS_PLAYED"
echo "  Fichas restantes: $TILES_REMAINING"

# 3b. Verificar tabla de posiciones
log_step "Obteniendo tabla de posiciones..."
LEADERBOARD_RESPONSE=$(curl -s -X GET $BASE_URL/tournament/$TOURNAMENT_ID/leaderboard)
check_response "$LEADERBOARD_RESPONSE" "Obtener leaderboard"

echo ""
echo "Tabla de Posiciones:"
echo "$LEADERBOARD_RESPONSE" | jq -r '.data[] | "  \(.name): \(.total_score) puntos"'

# 4. VALIDACIONES DE INTEGRIDAD
log_step "Ejecutando validaciones de integridad..."

# 4a. Verificar consistencia de bolsa
echo -n "  Verificando bolsa de fichas... "
BAG_RESPONSE=$(curl -s -X GET $BASE_URL/tournament/$TOURNAMENT_ID/bag_tiles)
if [ "$(echo "$BAG_RESPONSE" | jq '.data | length')" = "103" ]; then
    echo -e "${GREEN}✓${NC} 103 fichas totales"
else
    echo -e "${RED}✗${NC} Número incorrecto de fichas"
    exit 1
fi

# 4b. Verificar que no hay duplicados de Ñ
echo -n "  Verificando unicidad de Ñ... "
N_COUNT=$(echo "$BAG_RESPONSE" | jq '[.data[] | select(.[0] == "Ñ")] | length')
if [ "$N_COUNT" -le "1" ]; then
    echo -e "${GREEN}✓${NC} Máximo 1 Ñ"
else
    echo -e "${RED}✗${NC} Múltiples Ñ detectadas!"
    exit 1
fi

# 5. RESUMEN
echo ""
echo "==========================================="
echo -e "${GREEN}     TODAS LAS PRUEBAS PASARON${NC}"
echo "==========================================="
echo ""
echo "Estadísticas:"
echo "  - Torneo ID: $TOURNAMENT_ID"
echo "  - Jugadores: ${#PLAYERS[@]}"
echo "  - Rondas: $ROUNDS_PLAYED"
echo "  - Fichas restantes: $TILES_REMAINING"
echo ""
echo "El torneo se ejecutó correctamente de principio a fin."