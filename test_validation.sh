#!/bin/bash

# Script para probar la validación de jugadas

echo "=== Test de Validación de Jugadas ==="
echo

# Primero, asegurar que el servidor esté compilado
cargo build --release 2>/dev/null

# Iniciar el servidor en background
echo "Iniciando servidor..."
./target/release/wolges-tournament-server > /tmp/server.log 2>&1 &
SERVER_PID=$!
sleep 2

# Función para hacer llamadas API
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X $method "http://localhost:8080$endpoint" -H "Content-Type: application/json"
    else
        curl -s -X $method "http://localhost:8080$endpoint" -H "Content-Type: application/json" -d "$data"
    fi
}

# Cargar diccionario
echo "Cargando diccionario FISE2016..."
api_call POST /dictionary/load '{"kwg_path": "lexicon/FISE2016.kwg", "klv_path": "lexicon/spanish.klv"}' | jq .

# Test 1: Validar palabras simples
echo -e "\n\nTest 1: Validación de palabras"
echo "================================"
words=("CASA" "PERRO" "GATO" "XYZ" "MESA" "SILLA")
for word in "${words[@]}"; do
    result=$(api_call GET /test/validate/$word | jq -r '.data.is_valid')
    echo "$word: $result"
done

# Test 2: Crear torneo con un jugador de prueba
echo -e "\n\nTest 2: Creando torneo de prueba"
echo "================================="
tournament_response=$(api_call POST /tournament/create '{"name": "Test Validación", "player_names": ["TestPlayer"]}')
tournament_id=$(echo $tournament_response | jq -r '.data.id')
player_id=$(echo $tournament_response | jq -r '.data.players[0].id')
echo "Tournament ID: $tournament_id"
echo "Player ID: $player_id"

# Test 3: Generar atril manual simple
echo -e "\n\nTest 3: Generando atril manual CASA"
echo "====================================="
round_response=$(api_call POST /tournament/$tournament_id/round/start_manual '{"rack": "CASA"}')
echo $round_response | jq .

# Obtener jugada óptima para comparar
echo -e "\nObteniendo jugada óptima..."
optimal_response=$(api_call GET /tournament/$tournament_id/round/1/optimal)
echo "Jugada óptima:"
echo $optimal_response | jq '.data | {word, score, position}'

# Test 4: Probar envío de jugadas válidas e inválidas
echo -e "\n\nTest 4: Probando jugadas de jugador"
echo "====================================="

# Jugada válida: CASA en H8 horizontal
echo -e "\nIntentando CASA en H8→..."
play_response=$(api_call POST /tournament/play/submit '{
    "tournament_id": "'$tournament_id'",
    "player_id": "'$player_id'",
    "round_number": 1,
    "word": "CASA",
    "position": {"row": 7, "col": 7, "down": false}
}')
echo $play_response | jq .

# Jugada inválida: palabra no en diccionario
echo -e "\nIntentando XYZ en H8→ (debería fallar)..."
play_response=$(api_call POST /tournament/play/submit '{
    "tournament_id": "'$tournament_id'",
    "player_id": "'$player_id'",
    "round_number": 1,
    "word": "XYZ",
    "position": {"row": 7, "col": 7, "down": false}
}')
echo $play_response | jq .

# Test 5: Probar con atril más complejo
echo -e "\n\nTest 5: Atril con comodín"
echo "=========================="
# Primero colocar la jugada óptima para avanzar
api_call PUT /tournament/$tournament_id/round/1/place_optimal > /dev/null

# Nuevo atril con comodín
round_response=$(api_call POST /tournament/$tournament_id/round/start_manual '{"rack": "CAS?"}')
echo "Atril: CAS?"

# Ver cuántas jugadas se generan
echo -e "\nSolicitando jugada óptima para ver debug..."
optimal_response=$(api_call GET /tournament/$tournament_id/round/2/optimal 2>&1)
# Los logs del servidor mostrarán cuántas jugadas se generaron

# Limpiar
echo -e "\n\nDeteniendo servidor..."
kill $SERVER_PID 2>/dev/null

echo -e "\n=== Fin de las pruebas ===\n"
echo "Revisa /tmp/server.log para ver los logs completos del servidor"
echo "Busca líneas como 'DEBUG: Generated X moves' para ver cuántas jugadas se generan"