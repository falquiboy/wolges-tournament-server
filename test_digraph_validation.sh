#!/bin/bash

# Script para probar validación con dígrafos mostrando logs de debug

echo "=== Iniciando servidor con captura de logs de debug ==="
./target/release/wolges-tournament-server > server.stdout 2> server.stderr &
SERVER_PID=$!

# Esperar a que el servidor esté listo
sleep 2

echo -e "\n=== Ejecutando pruebas de validación ==="

# Crear torneo
TOURNAMENT_ID=$(curl -s -X POST "http://localhost:8080/tournament/create" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Dígrafos Debug", "player_names": ["P1"]}' | jq -r '.data.id')

echo "Torneo creado: $TOURNAMENT_ID"

# Probar diferentes atriles
echo -e "\n--- Probando atril con 7 consonantes (debe fallar) ---"
curl -s -X POST "http://localhost:8080/tournament/$TOURNAMENT_ID/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "B[CH][LL][RR]STZ"}' | jq '.error'

echo -e "\n--- Probando atril con 6 vocales (debe fallar) ---"
curl -s -X POST "http://localhost:8080/tournament/$TOURNAMENT_ID/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "AEIOUA[CH]"}' | jq '.error'

echo -e "\n--- Probando atril balanceado con dígrafos (debe funcionar) ---"
curl -s -X POST "http://localhost:8080/tournament/$TOURNAMENT_ID/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "AEI[CH]MNO"}' | jq '.data.number'

# Matar servidor
kill $SERVER_PID

echo -e "\n=== Logs DEBUG del servidor ==="
grep "DEBUG" server.stderr | head -20