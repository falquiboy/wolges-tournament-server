#!/bin/bash

echo "=== Test específico para rack BB?UDSD ==="
echo ""

# Crear torneo
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test BB?UDSD", "player_names": ["Test"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Torneo creado: $TOUR_ID"

# Generar 4 rondas para llegar a la ronda 5
for i in {1..4}; do
    echo "Generando ronda $i..."
    curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start" \
      -k -s 2>/dev/null > /dev/null
    curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/$i/place_optimal" \
      -k -s 2>/dev/null > /dev/null
done

echo ""
echo "Probando rack BB?UDSD en ronda 5..."
RESULT=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "BB?UDSD"}' \
  -k -s 2>/dev/null)

SUCCESS=$(echo "$RESULT" | jq -r '.success')
ERROR=$(echo "$RESULT" | jq -r '.error')
RACK=$(echo "$RESULT" | jq -r '.data.rack')
REJECTED=$(echo "$RESULT" | jq -r '.data.rack_rejected')
REASON=$(echo "$RESULT" | jq -r '.data.rejection_reason')

echo "Resultado:"
echo "- Success: $SUCCESS"
echo "- Rack: $RACK"
echo "- Rejected: $REJECTED"
echo "- Reason: $REASON"
echo "- Error: $ERROR"

if [ "$SUCCESS" = "true" ] && [ "$REJECTED" != "true" ]; then
    echo ""
    echo "✅ CORRECTO: El rack BB?UDSD fue aceptado en ronda 5"
else
    echo ""
    echo "❌ ERROR: El rack BB?UDSD fue rechazado incorrectamente"
    echo "Este rack DEBERÍA ser válido porque:"
    echo "- Tiene 1 comodín que puede actuar como vocal"
    echo "- No excede el máximo de 5 consonantes"
    echo "- Con comodín, no se requieren mínimos"
fi