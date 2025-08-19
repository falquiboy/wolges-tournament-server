#!/bin/bash

TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Debug", "player_names": ["P1"]}' \
  -k -s | jq -r '.data.id')

# Round 1
curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "?O[RR]I[LL]OS"}' \
  -k -s > /dev/null

curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/place_optimal" \
  -k -s > /dev/null

# Check board state
echo "Board tiles at row 7 (H):"
curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/round/1" \
  -k -s | jq '.data.board_state.tiles[105:120]'
