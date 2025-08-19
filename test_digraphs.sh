#!/bin/bash

# Test script para verificar validación de atriles con dígrafos

API_URL="http://localhost:8080"

echo "=== Test de validación de atriles con dígrafos ==="

# 1. Crear torneo
echo -e "\n1. Creando torneo..."
TOURNAMENT_RESPONSE=$(curl -s -X POST "$API_URL/tournament/create" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Dígrafos",
    "player_names": ["Jugador1", "Jugador2"]
  }')

TOURNAMENT_ID=$(echo $TOURNAMENT_RESPONSE | jq -r '.data.id')
echo "Torneo creado: $TOURNAMENT_ID"

# 2. Probar atril con dígrafos CH, LL, RR
echo -e "\n2. Iniciando ronda con atril manual que incluye dígrafos..."
RACK_WITH_DIGRAPHS="ACH[LL]E[RR]O"
echo "Atril: $RACK_WITH_DIGRAPHS"

ROUND_RESPONSE=$(curl -s -X POST "$API_URL/tournament/$TOURNAMENT_ID/round/start_manual" \
  -H "Content-Type: application/json" \
  -d "{
    \"rack\": \"$RACK_WITH_DIGRAPHS\"
  }")

echo "Respuesta del servidor:"
echo $ROUND_RESPONSE | jq '.'

# 3. Probar atril con muchas consonantes incluyendo dígrafos
echo -e "\n3. Probando atril con muchas consonantes (incluyendo dígrafos)..."
MANY_CONSONANTS="B[CH][LL][RR]STZ"
echo "Atril: $MANY_CONSONANTS"

ROUND_RESPONSE2=$(curl -s -X POST "$API_URL/tournament/$TOURNAMENT_ID/round/start_manual" \
  -H "Content-Type: application/json" \
  -d "{
    \"rack\": \"$MANY_CONSONANTS\"
  }")

echo "Respuesta del servidor:"
echo $ROUND_RESPONSE2 | jq '.'

# 4. Probar atril balanceado con dígrafos
echo -e "\n4. Probando atril balanceado con dígrafos..."
BALANCED="AEI[CH]MNO"
echo "Atril: $BALANCED"

ROUND_RESPONSE3=$(curl -s -X POST "$API_URL/tournament/$TOURNAMENT_ID/round/start_manual" \
  -H "Content-Type: application/json" \
  -d "{
    \"rack\": \"$BALANCED\"
  }")

echo "Respuesta del servidor:"
echo $ROUND_RESPONSE3 | jq '.'