#!/bin/bash

# Crear torneo de prueba
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Alphabet Test", "player_names": ["P1"]}' \
  -k -s | jq -r '.data.id')

echo "Testing alphabet with tournament: $TOUR_ID"

# Probar letras normales
for letter in A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Ñ; do
  rack="${letter}ABCDEF"
  response=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
    -H "Content-Type: application/json" \
    -d "{\"rack\": \"$rack\"}" \
    -k -s 2>/dev/null)
  
  success=$(echo "$response" | jq -r '.success')
  if [ "$success" = "true" ]; then
    echo "✓ Letter $letter is valid"
  else
    error=$(echo "$response" | jq -r '.error')
    echo "✗ Letter $letter failed: $error"
  fi
done

# Probar dígrafos
echo -e "\nTesting digraphs:"
for digraph in "[CH]" "[LL]" "[RR]"; do
  rack="${digraph}ABCDE"
  response=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
    -H "Content-Type: application/json" \
    -d "{\"rack\": \"$rack\"}" \
    -k -s 2>/dev/null)
  
  success=$(echo "$response" | jq -r '.success')
  if [ "$success" = "true" ]; then
    returned_rack=$(echo "$response" | jq -r '.data.rack')
    echo "✓ Digraph $digraph is valid, returns as: $returned_rack"
  else
    error=$(echo "$response" | jq -r '.error')
    echo "✗ Digraph $digraph failed: $error"
  fi
done

# Probar comodín
echo -e "\nTesting blank:"
rack="?ABCDEF"
response=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d "{\"rack\": \"$rack\"}" \
  -k -s 2>/dev/null)

success=$(echo "$response" | jq -r '.success')
if [ "$success" = "true" ]; then
  echo "✓ Blank (?) is valid"
else
  error=$(echo "$response" | jq -r '.error')
  echo "✗ Blank (?) failed: $error"
fi
