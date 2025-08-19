#!/bin/bash

echo "=== Test de Tracking de Bolsa con Dígrafos ==="
echo ""

# Crear torneo
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Dígrafos", "player_names": ["Jugador1"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Torneo creado: $TOUR_ID"
echo ""

# Verificar cuántas fichas CH, LL, RR hay inicialmente
echo "Estado inicial de dígrafos en la bolsa:"
INITIAL_CH=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
  -k -s 2>/dev/null | jq -r '.data | map(select(.[0] == "[CH]" and .[1] == false)) | length')
INITIAL_LL=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
  -k -s 2>/dev/null | jq -r '.data | map(select(.[0] == "[LL]" and .[1] == false)) | length')
INITIAL_RR=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
  -k -s 2>/dev/null | jq -r '.data | map(select(.[0] == "[RR]" and .[1] == false)) | length')

echo "  [CH] disponibles: $INITIAL_CH"
echo "  [LL] disponibles: $INITIAL_LL"
echo "  [RR] disponibles: $INITIAL_RR"

# Total de fichas iniciales
TOTAL_INITIAL=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
  -k -s 2>/dev/null | jq -r '.data | map(select(.[1] == false)) | length')
echo "  Total fichas en bolsa: $TOTAL_INITIAL"
echo ""

# Test 1: Rack manual con dígrafo CH
echo "Test 1: Rack manual con dígrafo '[CH]ANTAS'"
R1=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "[CH]ANTAS"}' \
  -k -s 2>/dev/null)

if [ "$(echo "$R1" | jq -r '.success')" = "true" ]; then
    echo "  ✓ Rack aceptado: $(echo "$R1" | jq -r '.data.rack')"
    
    # Verificar que CH fue removido de la bolsa
    AFTER_CH=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
      -k -s 2>/dev/null | jq -r '.data | map(select(.[0] == "[CH]" and .[1] == false)) | length')
    TOTAL_AFTER=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
      -k -s 2>/dev/null | jq -r '.data | map(select(.[1] == false)) | length')
    
    echo "  [CH] disponibles después: $AFTER_CH (esperado: $((INITIAL_CH - 1)))"
    echo "  Total fichas después: $TOTAL_AFTER (esperado: $((TOTAL_INITIAL - 7)))"
    
    if [ "$AFTER_CH" -eq "$((INITIAL_CH - 1))" ] && [ "$TOTAL_AFTER" -eq "$((TOTAL_INITIAL - 7))" ]; then
        echo "  ✓ Bolsa actualizada correctamente"
    else
        echo "  ❌ Error en actualización de bolsa"
    fi
else
    echo "  ❌ Error: $(echo "$R1" | jq -r '.error')"
fi

# Colocar la jugada
curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/place_optimal" \
  -k -s 2>/dev/null > /dev/null

echo ""

# Test 2: Rack manual con múltiples dígrafos
echo "Test 2: Rack manual con '[LL]O[RR]ITO'"
R2=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "[LL]O[RR]ITO"}' \
  -k -s 2>/dev/null)

if [ "$(echo "$R2" | jq -r '.success')" = "true" ]; then
    echo "  ✓ Rack aceptado: $(echo "$R2" | jq -r '.data.rack')"
    
    # Verificar que LL y RR fueron removidos
    AFTER_LL=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
      -k -s 2>/dev/null | jq -r '.data | map(select(.[0] == "[LL]" and .[1] == false)) | length')
    AFTER_RR=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
      -k -s 2>/dev/null | jq -r '.data | map(select(.[0] == "[RR]" and .[1] == false)) | length')
    
    echo "  [LL] disponibles después: $AFTER_LL (esperado: $((INITIAL_LL - 1)))"
    echo "  [RR] disponibles después: $AFTER_RR (esperado: $((INITIAL_RR - 1)))"
    
    if [ "$AFTER_LL" -eq "$((INITIAL_LL - 1))" ] && [ "$AFTER_RR" -eq "$((INITIAL_RR - 1))" ]; then
        echo "  ✓ Dígrafos actualizados correctamente en la bolsa"
    else
        echo "  ❌ Error en actualización de dígrafos"
    fi
else
    echo "  ❌ Error: $(echo "$R2" | jq -r '.error')"
fi

echo ""
echo "=== Test Completo ==="
echo "Verificar en https://localhost:8443 torneo 'Test Dígrafos':"
echo "- Las fichas de dígrafos ([CH], [LL], [RR]) deben estar atenuadas en el display de bolsa"
echo "- El conteo de fichas debe ser consistente"
echo "- Los comodines deben mostrarse en rojo/minúscula"