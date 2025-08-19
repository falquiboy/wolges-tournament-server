#!/bin/bash

echo "=== Testing with ?ORRILLOS and C?SERON ==="
echo

# Create tournament
echo "1. Creating tournament..."
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Specific", "player_names": ["Player1"]}' \
  -k -s | jq -r '.data.id')

echo "Tournament ID: $TOUR_ID"
echo

# Round 1: ?ORRILLOS
echo "2. Round 1 - Setting rack: ?ORRILLOS"
curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "?ORRILLOS"}' \
  -k -s | jq '{rack: .data.rack, success: .success}'

echo "3. Calculating optimal play for Round 1..."
OPTIMAL1=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/calculate_optimal" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -k -s)

echo "$OPTIMAL1" | jq '.data.optimal_play'

echo "4. Placing optimal play..."
curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/place_optimal" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -k -s | jq '.success'

echo "5. Board after Round 1:"
curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/round/1" \
  -k -s | jq '.data.board_state.tiles[105:120]' 

echo
echo "6. Round 2 - Setting rack: C?SERON"
curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "C?SERON"}' \
  -k -s | jq '{rack: .data.rack, success: .success}'

echo "7. Calculating optimal play for Round 2..."
OPTIMAL2=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/calculate_optimal" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -k -s)

if [ $(echo "$OPTIMAL2" | jq -r '.success') = "false" ]; then
  echo "Error: $(echo "$OPTIMAL2" | jq -r '.error')"
else
  echo "$OPTIMAL2" | jq '.data.optimal_play'
  
  echo "8. Attempting to place optimal play..."
  PLACE=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/place_optimal" \
    -H "Content-Type: application/json" \
    -d '{}' \
    -k -s)
  
  if [ $(echo "$PLACE" | jq -r '.success') = "false" ]; then
    echo "Play rejected: $(echo "$PLACE" | jq -r '.error')"
  else
    echo "Play accepted successfully"
  fi
fi
