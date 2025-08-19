#!/bin/bash

# Script para probar el bug de scoring con comodines
# Ronda 1: ?O[RR]I[LL]OS -> jugada óptima con [ch]O[RR]I[LL]OS
# Ronda 2: C?SERON -> debería formar [CH]ARCONES usando el [ch] del tablero

API_URL="http://localhost:8080"

echo "=== Test de Scoring con Comodines ==="
echo ""

# 1. Crear torneo
echo "1. Creando torneo..."
RESPONSE=$(curl -s -X POST "$API_URL/tournament/create" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Comodines",
    "players": ["Jugador1", "Jugador2"]
  }')

TOURNAMENT_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "   Torneo creado: $TOURNAMENT_ID"
echo ""

# 2. Iniciar ronda 1
echo "2. Iniciando ronda 1..."
curl -s -X POST "$API_URL/tournament/$TOURNAMENT_ID/round/start" > /dev/null
echo "   Ronda iniciada"
echo ""

# 3. Establecer atril manual: ?O[RR]I[LL]OS
echo "3. Estableciendo atril: ?O[RR]I[LL]OS"
curl -s -X PUT "$API_URL/tournament/$TOURNAMENT_ID/round/1/set_manual_rack" \
  -H "Content-Type: application/json" \
  -d '{"rack": "?O[RR]I[LL]OS"}' > /dev/null
echo "   Atril establecido"
echo ""

# 4. Obtener jugada óptima
echo "4. Obteniendo jugada óptima..."
OPTIMAL=$(curl -s "$API_URL/tournament/$TOURNAMENT_ID/round/1/optimal")
echo "   Jugada óptima: $OPTIMAL"
echo ""

# 5. Colocar jugada óptima
echo "5. Colocando jugada óptima en el tablero..."
curl -s -X PUT "$API_URL/tournament/$TOURNAMENT_ID/round/1/place_optimal" > /dev/null
echo "   Jugada colocada"
echo ""

# 6. Ver estado del tablero
echo "6. Estado del tablero después de ronda 1:"
BOARD_STATE=$(curl -s "$API_URL/tournament/$TOURNAMENT_ID" | grep -A 20 '"board_state"')
echo "$BOARD_STATE" | head -10
echo ""

# 7. Iniciar ronda 2
echo "7. Iniciando ronda 2..."
curl -s -X POST "$API_URL/tournament/$TOURNAMENT_ID/round/start" > /dev/null
echo "   Ronda iniciada"
echo ""

# 8. Establecer atril manual: C?SERON
echo "8. Estableciendo atril: C?SERON (debería formar [CH]ARCONES usando el [ch] del tablero)"
RESPONSE=$(curl -s -X PUT "$API_URL/tournament/$TOURNAMENT_ID/round/2/set_manual_rack" \
  -H "Content-Type: application/json" \
  -d '{"rack": "C?SERON"}')
echo "   Respuesta: $RESPONSE"
echo ""

# 9. Calcular score manual para CHARCONES
echo "9. Calculando score para CHARCONES en H2→..."
SCORE_RESPONSE=$(curl -s -X POST "$API_URL/tournament/$TOURNAMENT_ID/round/2/calculate_score" \
  -H "Content-Type: application/json" \
  -d '{
    "rack": "C?SERON",
    "position": {"row": 7, "col": 1, "down": false},
    "word": "[CH]ARCONES"
  }')
echo "   Score calculado: $SCORE_RESPONSE"
echo ""

# Parsear el score
SCORE=$(echo $SCORE_RESPONSE | grep -o '"score":[0-9]*' | cut -d':' -f2)
echo "=== RESULTADO ==="
echo "Score para [CH]ARCONES: $SCORE puntos"
echo ""

if [ "$SCORE" == "87" ]; then
  echo "✓ CORRECTO: El comodín [ch] se cuenta como 0 puntos"
else
  echo "✗ ERROR: El comodín [ch] se está contando con su valor facial (5 puntos)"
  echo "  Score esperado: 87 puntos"
  echo "  Score obtenido: $SCORE puntos"
fi
echo ""

# 10. Ver logs del servidor
echo "10. Verificando logs del servidor (últimas líneas con DEBUG)..."
echo "    (Los logs de debug deberían mostrar si el [ch] se detecta como blank)"