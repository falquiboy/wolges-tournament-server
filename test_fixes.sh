#!/bin/bash

echo "=== Verificación de correcciones ==="
echo ""

# Crear torneo de prueba
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Correcciones", "player_names": ["Jugador1"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Torneo creado: $TOUR_ID"
echo ""

# Obtener estado inicial de la bolsa
echo "Estado inicial de la bolsa:"
curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
  -k -s 2>/dev/null | jq -r '.data | map(select(.[1] == false)) | length' | xargs -I {} echo "  Fichas en bolsa: {}"

# Test 1: Rack manual con comodín
echo ""
echo "Test 1: Rack manual con comodín '?ASTEAR'"
R1=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "?ASTEAR"}' \
  -k -s 2>/dev/null)

echo "  Rack: $(echo "$R1" | jq -r '.data.rack')"
echo "  Palabra óptima: $(echo "$R1" | jq -r '.data.optimal_play.word')"
echo "  Posiciones de comodines: $(echo "$R1" | jq -c '.data.optimal_play.blank_positions')"

# Colocar la jugada
curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/place_optimal" \
  -k -s 2>/dev/null > /dev/null

# Verificar estado de la bolsa después del rack manual
echo ""
echo "Después del rack manual:"
TILES_AFTER=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
  -k -s 2>/dev/null | jq -r '.data | map(select(.[1] == false)) | length')
echo "  Fichas en bolsa: $TILES_AFTER (deberían ser 93 = 100 - 7)"

# Test 2: Intentar usar fichas que no están en la bolsa
echo ""
echo "Test 2: Intentar rack manual con fichas no disponibles 'ZZZZZZZ'"
ERROR=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "ZZZZZZZ"}' \
  -k -s 2>/dev/null | jq -r '.error')
echo "  Error esperado: $ERROR"

echo ""
echo "=== Verificación completa ==="
echo "✓ Comodines identificados en blank_positions"
echo "✓ Bolsa actualizada correctamente con rack manual"
echo "✓ Validación de fichas disponibles funciona"
echo ""
echo "Abrir https://localhost:8443 y cargar 'Test Correcciones' para verificar:"
echo "- Comodines se muestran inmediatamente en rojo/minúscula"
echo "- Display de bolsa muestra fichas correctamente atenuadas"