#!/bin/bash

echo "=== Test de Creación de Torneo y Generación de Atril ==="

# 1. Crear torneo
echo -e "\n1. Creando torneo..."
CREATE_RESPONSE=$(curl -k -s -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Debug", "player_names": ["Jugador 1", "Jugador 2"]}')

echo "Respuesta: $CREATE_RESPONSE"

# Extraer ID del torneo
TOURNAMENT_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "ID del Torneo: $TOURNAMENT_ID"

if [ -z "$TOURNAMENT_ID" ]; then
    echo "ERROR: No se pudo obtener el ID del torneo"
    exit 1
fi

# 2. Verificar que el torneo existe
echo -e "\n2. Verificando que el torneo existe..."
GET_RESPONSE=$(curl -k -s -X GET "https://localhost:8443/tournament/$TOURNAMENT_ID")
echo "Torneo obtenido: $GET_RESPONSE" | head -c 200

# 3. Intentar generar atril
echo -e "\n\n3. Intentando generar atril de ronda 1..."
ROUND_RESPONSE=$(curl -k -s -X POST "https://localhost:8443/tournament/$TOURNAMENT_ID/round/start" \
  -H "Content-Type: application/json")

echo "Respuesta de ronda: $ROUND_RESPONSE"

# 4. Verificar logs del servidor
echo -e "\n4. Verificar los logs del servidor para más detalles..."