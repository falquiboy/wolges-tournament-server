#!/bin/bash

echo "=== Test de Conservación de Bolsa ==="
echo "Verificando que las fichas no se pierdan ni dupliquen"
echo ""

# Crear torneo
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Conservación", "player_names": ["Jugador1"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Torneo creado: $TOUR_ID"
echo ""

# Función para contar fichas totales
count_tiles() {
    local status=$1
    local count=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
      -k -s 2>/dev/null | jq -r '.data | map(select(.[1] == false)) | length')
    echo "$status: $count fichas en bolsa"
    return $count
}

# Estado inicial
count_tiles "Estado inicial"
INITIAL_COUNT=$?

# Test 1: Rack manual
echo -e "\n--- Test 1: Rack manual ---"
curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "AEIOURT"}' \
  -k -s 2>/dev/null > /dev/null
count_tiles "Después de rack manual"
AFTER_MANUAL=$?

if [ $((INITIAL_COUNT - AFTER_MANUAL)) -eq 7 ]; then
    echo "✓ 7 fichas removidas correctamente"
else
    echo "✗ Error: Se esperaban $(( INITIAL_COUNT - 7 )) fichas, hay $AFTER_MANUAL"
fi

# Test 2: Actualizar rack (debe devolver las viejas y tomar nuevas)
echo -e "\n--- Test 2: Actualizar rack ---"
curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/update_rack" \
  -H "Content-Type: application/json" \
  -d '{"rack": "NSTELAO"}' \
  -k -s 2>/dev/null > /dev/null
count_tiles "Después de actualizar rack"
AFTER_UPDATE=$?

if [ "$AFTER_UPDATE" -eq "$AFTER_MANUAL" ]; then
    echo "✓ Conservación correcta (devolvió 7, tomó 7)"
else
    echo "✗ Error: El conteo cambió de $AFTER_MANUAL a $AFTER_UPDATE"
fi

# Test 3: Rechazar y regenerar atril
echo -e "\n--- Test 3: Rechazar y regenerar atril ---"
curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/reject_rack" \
  -k -s 2>/dev/null > /dev/null
count_tiles "Después de rechazar y regenerar"
AFTER_REJECT=$?

if [ "$AFTER_REJECT" -eq "$AFTER_UPDATE" ]; then
    echo "✓ Conservación correcta (devolvió 7, tomó 7)"
else
    echo "✗ Error: El conteo cambió de $AFTER_UPDATE a $AFTER_REJECT"
fi

# Test 4: Colocar jugada (debería mantener las no usadas y reponer)
echo -e "\n--- Test 4: Colocar jugada y siguiente ronda ---"
# Primero colocar la jugada óptima
curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/place_optimal" \
  -k -s 2>/dev/null > /dev/null

# Generar siguiente ronda (debería preservar fichas no usadas)
curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start" \
  -k -s 2>/dev/null > /dev/null
count_tiles "Después de colocar y nueva ronda"
AFTER_PLACE=$?

# Las fichas usadas se sacan de la bolsa para completar 7
echo "Fichas usadas + restantes = 7 para siguiente rack"

# Test 5: Verificar conteo total del juego
echo -e "\n--- Test 5: Verificación de conservación total ---"
USED_ON_BOARD=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}" \
  -k -s 2>/dev/null | jq -r '.data.board | map(select(. != "")) | length')
  
TILES_IN_BAG=$AFTER_PLACE
TILES_IN_RACK=7  # Siempre hay 7 en el rack actual

TOTAL=$((TILES_IN_BAG + TILES_IN_RACK + USED_ON_BOARD))

echo "Fichas en bolsa: $TILES_IN_BAG"
echo "Fichas en rack actual: $TILES_IN_RACK"
echo "Fichas en tablero: $USED_ON_BOARD"
echo "Total: $TOTAL (debe ser 100)"

if [ "$TOTAL" -eq 100 ]; then
    echo "✓ CONSERVACIÓN PERFECTA: Las 100 fichas están contabilizadas"
else
    echo "✗ ERROR DE CONSERVACIÓN: Faltan o sobran $((100 - TOTAL)) fichas"
fi

echo ""
echo "=== Resumen de Tests ==="
echo "1. Rack manual: $([ $((INITIAL_COUNT - AFTER_MANUAL)) -eq 7 ] && echo "✓" || echo "✗")"
echo "2. Actualizar rack: $([ "$AFTER_UPDATE" -eq "$AFTER_MANUAL" ] && echo "✓" || echo "✗")"
echo "3. Rechazar rack: $([ "$AFTER_REJECT" -eq "$AFTER_UPDATE" ] && echo "✓" || echo "✗")"
echo "4. Conservación total: $([ "$TOTAL" -eq 100 ] && echo "✓" || echo "✗")"