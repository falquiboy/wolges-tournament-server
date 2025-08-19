#!/bin/bash

echo "=== Debug Board State ==="

TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "BoardDebug", "player_names": ["P1"]}' \
  -k -s | jq -r '.data.id')

echo "Tournament: $TOUR_ID"

# Round 1 manual
R1=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "?O[RR]I[LL]OS"}' \
  -k -s)

echo -e "\nOptimal play generated:"
echo "$R1" | jq '.data.optimal_play.word'

# Place it
curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/place_optimal" \
  -k -s | jq '.success'

# Start round 2 to see board state
echo -e "\nStarting round 2..."
R2=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "C?SERON"}' \
  -k -s)

echo "Board state in round 2 (positions 105-119, row H):"
echo "$R2" | jq '.data.board_state.tiles[105:120]'
