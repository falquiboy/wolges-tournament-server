#!/bin/bash

echo "=== Test de Rechazo de Atril por Validación ==="
echo "Verificando que las fichas se devuelvan a la bolsa cuando el rack es inválido"
echo ""

# Crear torneo
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Rack Inválido", "player_names": ["Jugador1"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Torneo creado: $TOUR_ID"
echo ""

# Función para contar fichas
count_tiles() {
    curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
      -k -s 2>/dev/null | jq -r '.data | map(select(.[1] == false)) | length'
}

# Estado inicial
INITIAL=$(count_tiles)
echo "Fichas iniciales en bolsa: $INITIAL"

# Generar ronda con rack que podría ser rechazado
echo -e "\nGenerando atril para ronda 1..."
R1=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start" \
  -k -s 2>/dev/null)

RACK=$(echo "$R1" | jq -r '.data.rack')
REJECTED=$(echo "$R1" | jq -r '.data.rack_rejected')
REASON=$(echo "$R1" | jq -r '.data.rejection_reason')

echo "Rack generado: $RACK"
echo "Rechazado: $REJECTED"

if [ "$REJECTED" = "true" ]; then
    echo "Razón de rechazo: $REASON"
    
    # Contar fichas después del rechazo
    AFTER_REJECT=$(count_tiles)
    echo "Fichas después del rechazo inicial: $AFTER_REJECT"
    
    # El rack fue rechazado pero se generó uno nuevo automáticamente
    # Las fichas deberían haberse devuelto y sacado nuevas
    if [ "$AFTER_REJECT" -eq "$((INITIAL - 7))" ]; then
        echo "✓ Conservación correcta: Se devolvieron las inválidas y se sacaron 7 nuevas"
    else
        echo "✗ ERROR: Se esperaban $((INITIAL - 7)) fichas, hay $AFTER_REJECT"
    fi
else
    echo "El rack no fue rechazado en la generación inicial"
    AFTER_REJECT=$((INITIAL - 7))
fi

# Forzar un rack inválido manualmente (todas consonantes)
echo -e "\n--- Test con rack manual de puras consonantes ---"
RESULT=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "BCDFGST"}' \
  -k -s 2>/dev/null 2>&1)

if echo "$RESULT" | jq -e '.data.rack_rejected == true' > /dev/null 2>&1; then
    echo "Rack BCDFGST fue rechazado como esperado"
    REASON=$(echo "$RESULT" | jq -r '.data.rejection_reason')
    echo "Razón: $REASON"
    
    # Verificar conservación
    TILES_NOW=$(count_tiles)
    echo "Fichas en bolsa: $TILES_NOW"
    
    if [ "$TILES_NOW" -eq "$AFTER_REJECT" ]; then
        echo "✓ Las fichas se devolvieron correctamente a la bolsa"
    else
        echo "✗ ERROR: Las fichas no se conservaron. Esperado: $AFTER_REJECT, Actual: $TILES_NOW"
    fi
fi

echo ""
echo "=== Resumen ==="
echo "El sistema debe:"
echo "1. Detectar racks inválidos (< 2 vocales o < 2 consonantes en rondas 1-15)"
echo "2. Devolver TODAS las fichas del rack inválido a la bolsa"
echo "3. Generar un nuevo rack válido"
echo "4. Mantener la conservación total de 100 fichas"