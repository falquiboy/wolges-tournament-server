#!/bin/bash

echo "=== Probando alternativas para C?SERON ==="

# Crear torneo
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Alt Test", "player_names": ["P1"]}' \
  -k -s | jq -r '.data.id')

# Ronda 1: Colocar CHOWIKOS
curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "?O[RR]I[LL]OS"}' \
  -k -s > /dev/null

curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/place_optimal" \
  -k -s > /dev/null

echo "Ronda 1 colocada: [ch]O[RR]I[LL]OS en H8 horizontal"
echo

# Ronda 2: Ver qué jugada encuentra
echo "Ronda 2 con C?SERON..."
R2=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "C?SERON"}' \
  -k -s)

OPTIMAL=$(echo "$R2" | jq '.data.optimal_play')
echo "Jugada óptima generada:"
echo "$OPTIMAL" | jq '{word, position, score}'

echo -e "\nTablero actual en H8:"
echo "  H8: [ch]O[RR]I[LL]OS"
echo

if echo "$OPTIMAL" | jq -e '.position.row == 7 and .position.col == 7' > /dev/null; then
    echo "⚠️ PROBLEMA: Wolges generó una jugada en H8 que sobrescribiría el dígrafo"
    echo "Esta es una jugada inválida que nuestro sistema ahora bloquea correctamente"
else
    echo "✅ Wolges encontró una jugada válida en otra posición"
fi

# Intentar colocarla
echo -e "\nIntentando colocar la jugada..."
PLACE=$(curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/2/place_optimal" \
  -k -s)

if [ $(echo "$PLACE" | jq -r '.success') = "false" ]; then
    echo "❌ Jugada rechazada: $(echo "$PLACE" | jq -r '.error')"
    echo -e "\n⚠️ SITUACIÓN: El motor generó una jugada inválida y no hay alternativa"
    echo "Esto requiere que el motor wolges sea corregido para no generar jugadas inválidas"
else
    echo "✅ Jugada colocada exitosamente"
fi
