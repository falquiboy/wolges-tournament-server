#!/bin/bash

echo "=== Test de renderizado de dígrafos ==="
echo ""

# Crear torneo
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Dígrafos", "player_names": ["Test"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Torneo creado: $TOUR_ID"
echo ""

# Test con dígrafos
echo "Probando rack con dígrafos [CH], [LL], [RR]..."
RESULT=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "A[CH][LL][RR]BCD"}' \
  -k -s 2>/dev/null)

RACK=$(echo "$RESULT" | jq -r '.data.rack')
SUCCESS=$(echo "$RESULT" | jq -r '.success')

echo "Rack enviado: A[CH][LL][RR]BCD"
echo "Rack retornado: $RACK"
echo ""

if [ "$RACK" = "A[CH][LL][RR]BCD" ]; then
    echo "✅ CORRECTO: Los dígrafos se mantienen en formato natural [CH], [LL], [RR]"
else
    echo "❌ ERROR: Los dígrafos no se renderizaron correctamente"
    echo "   Se esperaba: A[CH][LL][RR]BCD"
    echo "   Se recibió: $RACK"
fi

# Generar rack automático y verificar
echo ""
echo "Generando rack automático para verificar dígrafos..."
RESULT2=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start" \
  -k -s 2>/dev/null)

RACK2=$(echo "$RESULT2" | jq -r '.data.rack')
echo "Rack generado: $RACK2"

# Verificar si contiene W, K o Ç (forma interna incorrecta)
if echo "$RACK2" | grep -q "[WKÇ]"; then
    echo "❌ ERROR: El rack contiene caracteres internos W, K o Ç"
else
    echo "✅ CORRECTO: El rack no contiene caracteres internos"
fi

# Verificar si contiene dígrafos en formato correcto
if echo "$RACK2" | grep -q "\[CH\]\|\[LL\]\|\[RR\]"; then
    echo "✅ INFO: El rack contiene dígrafos en formato correcto [CH], [LL] o [RR]"
fi
