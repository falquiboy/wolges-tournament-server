#!/bin/bash

echo "=== Test detallado de rechazo de rack ==="
echo ""

# Crear torneo
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Detail", "player_names": ["Test"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Torneo creado: $TOUR_ID"

# Función para contar fichas específicas
count_tiles() {
    local letter="$1"
    local tiles_json="$2"
    echo "$tiles_json" | jq "[.data[] | select(.[0] == \"$letter\")] | length"
}

# Generar rack inválido con fichas específicas
echo "Generando rack inválido SRSCRBJ..."
RESULT=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "SRSCRBJ"}' \
  -k -s 2>/dev/null)

REJECTED=$(echo "$RESULT" | jq -r '.data.rack_rejected')
echo "Rack rechazado: $REJECTED"

# Ver estado de las fichas ANTES de intentar regenerar
echo ""
echo "Estado de fichas ANTES de regenerar:"
TILES_BEFORE=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
  -k -s 2>/dev/null)

echo "Total fichas: $(echo "$TILES_BEFORE" | jq '.data | length')"
echo "B total: $(count_tiles "B" "$TILES_BEFORE")"
echo "J total: $(count_tiles "J" "$TILES_BEFORE")"
echo "S total: $(count_tiles "S" "$TILES_BEFORE")"
echo "R total: $(count_tiles "R" "$TILES_BEFORE")"
echo "C total: $(count_tiles "C" "$TILES_BEFORE")"

# Contar cuántas están disponibles (no usadas)
echo ""
echo "Fichas disponibles en bolsa:"
echo "B disponibles: $(echo "$TILES_BEFORE" | jq '[.data[] | select(.[0] == "B" and .[1] == false)] | length')"
echo "J disponibles: $(echo "$TILES_BEFORE" | jq '[.data[] | select(.[0] == "J" and .[1] == false)] | length')"
echo "S disponibles: $(echo "$TILES_BEFORE" | jq '[.data[] | select(.[0] == "S" and .[1] == false)] | length')"
echo "R disponibles: $(echo "$TILES_BEFORE" | jq '[.data[] | select(.[0] == "R" and .[1] == false)] | length')"
echo "C disponibles: $(echo "$TILES_BEFORE" | jq '[.data[] | select(.[0] == "C" and .[1] == false)] | length')"

# Intentar actualizar con un rack que incluya las mismas fichas
echo ""
echo "Intentando actualizar con rack que contiene B y J..."
UPDATE=$(curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/update_rack" \
  -H "Content-Type: application/json" \
  -d '{"rack": "AEIOUBC"}' \
  -k -s 2>/dev/null)

SUCCESS=$(echo "$UPDATE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
    echo "✓ Update exitoso"
else
    echo "✗ Update falló: $(echo "$UPDATE" | jq -r '.error')"
fi

# Ver estado DESPUÉS
echo ""
echo "Estado de fichas DESPUÉS de regenerar:"
TILES_AFTER=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
  -k -s 2>/dev/null)

echo "Total fichas: $(echo "$TILES_AFTER" | jq '.data | length')"
echo "B total: $(count_tiles "B" "$TILES_AFTER")"
echo "J total: $(count_tiles "J" "$TILES_AFTER")"
echo "S total: $(count_tiles "S" "$TILES_AFTER")"
echo "R total: $(count_tiles "R" "$TILES_AFTER")"
echo "C total: $(count_tiles "C" "$TILES_AFTER")"

# Comparar
echo ""
echo "=== Cambios ==="
B_BEFORE=$(count_tiles "B" "$TILES_BEFORE")
B_AFTER=$(count_tiles "B" "$TILES_AFTER")
J_BEFORE=$(count_tiles "J" "$TILES_BEFORE")
J_AFTER=$(count_tiles "J" "$TILES_AFTER")

if [ "$B_AFTER" -gt "$B_BEFORE" ]; then
    echo "❌ B se duplicó: $B_BEFORE → $B_AFTER"
fi
if [ "$J_AFTER" -gt "$J_BEFORE" ]; then
    echo "❌ J se duplicó: $J_BEFORE → $J_AFTER"
fi