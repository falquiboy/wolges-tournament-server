#!/bin/bash

echo "=== Final test of digraph overwrite protection ==="

# Create tournament
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Final Test", "player_names": ["P1"]}' \
  -k -s | jq -r '.data.id')

echo "Tournament: $TOUR_ID"

# Round 1
echo -e "\n--- Round 1: ?O[RR]I[LL]OS ---"
R1=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "?O[RR]I[LL]OS"}' \
  -k -s)

echo "Rack set: $(echo "$R1" | jq -r '.data.rack')"
echo "Optimal play: $(echo "$R1" | jq '.data.optimal_play')"

# Place optimal play for round 1
echo "Placing optimal play..."
PLACE1=$(curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/place_optimal" \
  -k -s)
echo "Place result: $(echo "$PLACE1" | jq -r '.success')"

# Round 2
echo -e "\n--- Round 2: C?SERON ---"
R2=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "C?SERON"}' \
  -k -s)

echo "Rack set: $(echo "$R2" | jq -r '.data.rack')"
echo "Optimal play: $(echo "$R2" | jq '.data.optimal_play')"

# Try to place optimal play for round 2
echo "Attempting to place optimal play..."
PLACE2=$(curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/2/place_optimal" \
  -k -s)

if [ $(echo "$PLACE2" | jq -r '.success') = "false" ]; then
  echo "✅ SUCCESS: Server correctly prevented overwriting digraph!"
  echo "Error: $(echo "$PLACE2" | jq -r '.error')"
else
  echo "❌ FAILURE: Server allowed invalid play"
fi
