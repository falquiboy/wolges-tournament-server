#!/bin/bash

echo "=== Test de residuo de fichas en racks ==="
echo ""

# Crear torneo
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Residuo", "player_names": ["Test"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Torneo creado: $TOUR_ID"
echo ""

# Ronda 1: Generar rack automático
echo "Ronda 1: Generando rack automático..."
RESULT1=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start" \
  -k -s 2>/dev/null)
RACK1=$(echo "$RESULT1" | jq -r '.data.rack')
echo "Rack automático: $RACK1"

# Actualizar con rack manual
echo "Actualizando con rack manual: ABCDEFG..."
RESULT2=$(curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/update_rack" \
  -H "Content-Type: application/json" \
  -d '{"rack": "ABCDEFG"}' \
  -k -s 2>/dev/null)
RACK_UPDATED=$(echo "$RESULT2" | jq -r '.data.rack')
echo "Rack actualizado: $RACK_UPDATED"

# Colocar jugada óptima
echo "Colocando jugada óptima..."
curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/place_optimal" \
  -k -s 2>/dev/null > /dev/null

# Ronda 2: Verificar que NO hay residuo del rack manual
echo ""
echo "Ronda 2: Generando nuevo rack..."
RESULT3=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start" \
  -k -s 2>/dev/null)
RACK2=$(echo "$RESULT3" | jq -r '.data.rack')
echo "Rack ronda 2: $RACK2"

# Verificar que no contiene letras específicas del rack manual anterior
if [[ "$RACK2" == *"ABCDEFG"* ]] || [[ "$RACK2" == *"BCDEFG"* ]] || [[ "$RACK2" == *"CDEFG"* ]]; then
    echo "❌ ERROR: El rack de la ronda 2 contiene residuos del rack manual anterior"
else
    echo "✅ CORRECTO: El rack de la ronda 2 NO contiene residuos del rack manual"
fi

echo ""
echo "=== Test de regeneración de rack rechazado ==="
echo ""

# Crear nuevo torneo
TOUR_ID2=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Rechazo", "player_names": ["Test"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Torneo 2 creado: $TOUR_ID2"

# Intentar crear rack inválido
echo "Intentando crear rack inválido: BCDFGHI (6 consonantes, 1 vocal)..."
RESULT4=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID2}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "BCDFGHI"}' \
  -k -s 2>/dev/null)
REJECTED=$(echo "$RESULT4" | jq -r '.data.rack_rejected')
RACK_REJ=$(echo "$RESULT4" | jq -r '.data.rack')
echo "Rack rechazado: $REJECTED"
echo "Rack actual: $RACK_REJ"

# Regenerar rack
echo "Regenerando rack..."
RESULT5=$(curl -X PUT "https://localhost:8443/tournament/${TOUR_ID2}/round/1/reject_rack" \
  -k -s 2>/dev/null)
RACK_NEW=$(echo "$RESULT5" | jq -r '.data.rack')
echo "Rack regenerado: $RACK_NEW"

# Verificar que no es el mismo rack rechazado
if [ "$RACK_NEW" = "BCDFGHI" ]; then
    echo "❌ ERROR: El rack regenerado es igual al rechazado"
else
    echo "✅ CORRECTO: El rack regenerado es diferente del rechazado"
fi

# Colocar jugada y pasar a ronda 2
curl -X PUT "https://localhost:8443/tournament/${TOUR_ID2}/round/1/place_optimal" \
  -k -s 2>/dev/null > /dev/null

echo ""
echo "Generando rack para ronda 2..."
RESULT6=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID2}/round/start" \
  -k -s 2>/dev/null)
RACK_R2=$(echo "$RESULT6" | jq -r '.data.rack')
echo "Rack ronda 2: $RACK_R2"

# Verificar que no contiene el rack rechazado
if [ "$RACK_R2" = "BCDFGHI" ]; then
    echo "❌ ERROR: El rack de ronda 2 es igual al rack rechazado anteriormente"
else
    echo "✅ CORRECTO: El rack de ronda 2 es diferente y no tiene residuos"
fi
