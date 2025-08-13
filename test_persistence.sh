#!/bin/bash

echo "=== Prueba del Sistema de Persistencia ==="

# 1. Crear un nuevo torneo
echo -e "\n1. Creando nuevo torneo..."
RESPONSE=$(curl -k -s -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Torneo Persistencia Test", "player_names": ["Jugador 1", "Jugador 2", "Jugador 3"]}')

TOURNAMENT_ID=$(echo $RESPONSE | jq -r '.data.id')
echo "Torneo creado con ID: $TOURNAMENT_ID"

# 2. Verificar que se creó el directorio
echo -e "\n2. Verificando directorio del torneo..."
ls -la tournaments/2025-*persistencia-test/ 2>/dev/null | head -5

# 3. Generar primera ronda
echo -e "\n3. Generando ronda 1..."
ROUND1=$(curl -k -s -X POST "https://localhost:8443/tournament/$TOURNAMENT_ID/round/start")
RACK1=$(echo $ROUND1 | jq -r '.data.rack')
echo "Atril ronda 1: $RACK1"

# 4. Iniciar timer
echo -e "\n4. Iniciando timer..."
curl -k -s -X PUT "https://localhost:8443/tournament/$TOURNAMENT_ID/round/1/start_timer" | jq '.success'

# 5. Simular jugada de un jugador
echo -e "\n5. Enviando jugada del Jugador 1..."
PLAYER1_ID=$(echo $RESPONSE | jq -r '.data.players[0].id')
PLAY_RESPONSE=$(curl -k -s -X POST https://localhost:8443/tournament/play/submit \
  -H "Content-Type: application/json" \
  -d "{
    \"tournament_id\": \"$TOURNAMENT_ID\",
    \"player_id\": \"$PLAYER1_ID\",
    \"round_number\": 1,
    \"word\": \"TEST\",
    \"position\": {\"row\": 7, \"col\": 7, \"down\": false}
  }")
echo "Jugada enviada: $(echo $PLAY_RESPONSE | jq '.success')"

# 6. Verificar archivos guardados
echo -e "\n6. Verificando archivos guardados..."
echo "Archivo principal:"
ls -la tournaments/2025-*persistencia-test/tournament.json | head -1

echo -e "\nArchivos de respaldo:"
ls -la tournaments/2025-*persistencia-test/backups/ | head -3

echo -e "\nRondas guardadas:"
ls -la tournaments/2025-*persistencia-test/rounds/ | head -3

# 7. Simular caída del servidor - listar torneos de nuevo
echo -e "\n7. Listando torneos (simulando reinicio)..."
TOURNAMENTS=$(curl -k -s https://localhost:8443/tournaments)
echo "Torneos encontrados: $(echo $TOURNAMENTS | jq '.data | length')"

# 8. Buscar nuestro torneo en la lista
echo -e "\n8. Verificando nuestro torneo en la lista..."
echo $TOURNAMENTS | jq ".data[] | select(.id == \"$TOURNAMENT_ID\")" | jq '{id, name, current_round, status}'

# 9. Cargar el torneo
echo -e "\n9. Cargando torneo desde archivo..."
LOAD_RESPONSE=$(curl -k -s -X POST "https://localhost:8443/tournament/$TOURNAMENT_ID/load")
echo "Torneo cargado: $(echo $LOAD_RESPONSE | jq '.success')"

# 10. Verificar estado restaurado
echo -e "\n10. Verificando estado restaurado..."
LOADED_TOURNAMENT=$(curl -k -s "https://localhost:8443/tournament/$TOURNAMENT_ID")
echo "Rondas: $(echo $LOADED_TOURNAMENT | jq '.data.rounds | length')"
echo "Jugadores: $(echo $LOADED_TOURNAMENT | jq '.data.players | length')"
echo "Estado: $(echo $LOADED_TOURNAMENT | jq -r '.data.status')"

echo -e "\n=== Prueba completada ==="