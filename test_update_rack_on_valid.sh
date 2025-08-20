#!/bin/bash

echo "=== Test de update_rack en rack válido ==="
echo ""

# Crear torneo
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Valid", "player_names": ["Test"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Torneo creado: $TOUR_ID"

count_tiles() {
    local desc="$1"
    echo "--- $desc ---"
    
    TILES=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
      -k -s 2>/dev/null)
    
    TOTAL=$(echo "$TILES" | jq '.data | length')
    echo "Total fichas: $TOTAL"
    
    # Contar Y específicamente
    Y_COUNT=$(echo "$TILES" | jq '[.data[] | select(.[0] == "Y")] | length')
    echo "Fichas Y: $Y_COUNT"
    echo ""
}

# Estado inicial
count_tiles "Estado inicial"

# Generar ronda con rack VÁLIDO
echo "Generando ronda con rack válido AEIOBCD..."
RESULT=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "AEIOBCD"}' \
  -k -s 2>/dev/null)

REJECTED=$(echo "$RESULT" | jq -r '.data.rack_rejected')
echo "Rack rechazado: $REJECTED"

count_tiles "Después de rack válido"

# Actualizar a otro rack válido
echo "Actualizando a otro rack válido AEIOUFG..."
UPDATE=$(curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/update_rack" \
  -H "Content-Type: application/json" \
  -d '{"rack": "AEIOUFG"}' \
  -k -s 2>/dev/null)

count_tiles "Después de update_rack en rack válido"

echo "=== Test 2: Con rack rechazado ==="

# Crear nuevo torneo
TOUR_ID2=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Invalid", "player_names": ["Test"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Nuevo torneo: $TOUR_ID2"
TOUR_ID=$TOUR_ID2

count_tiles "Estado inicial torneo 2"

# Generar ronda con rack INVÁLIDO
echo "Generando ronda con rack inválido BCDFGHY..."
RESULT=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "BCDFGHY"}' \
  -k -s 2>/dev/null)

REJECTED=$(echo "$RESULT" | jq -r '.data.rack_rejected')
echo "Rack rechazado: $REJECTED"

count_tiles "Después de rack inválido"

# Actualizar a rack válido
echo "Actualizando a rack válido AEIOBCD..."
UPDATE=$(curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/update_rack" \
  -H "Content-Type: application/json" \
  -d '{"rack": "AEIOBCD"}' \
  -k -s 2>/dev/null)

count_tiles "Después de update_rack en rack inválido"

echo "=== Conclusión ==="
echo "Si la duplicación solo ocurre con racks rechazados, es un bug específico del servidor con racks inválidos"