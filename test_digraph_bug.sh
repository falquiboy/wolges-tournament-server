#!/bin/bash

echo "=== Testing digraph overwrite bug fix ==="
echo

# Create tournament
echo "1. Creating tournament..."
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Digraph Bug Test", "player_names": ["Player1"]}' \
  -k -s | jq -r '.data.id')

echo "Tournament created: $TOUR_ID"
echo

# Round 1: ?O[RR]I[LL]OS which should generate CHOWIKOS
echo "2. Starting Round 1 with rack: ?O[RR]I[LL]OS"
curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "?O[RR]I[LL]OS"}' \
  -k -s | jq '.data.rack'

# Generate optimal play
echo "3. Generating optimal play for Round 1..."
curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/calculate_optimal" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -k -s > round1_optimal.json

echo "Optimal play generated:"
jq '.data.optimal_play' round1_optimal.json

# Place the optimal play
echo "4. Placing optimal play..."
curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/place_optimal" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -k -s | jq '.success'

# Get board state after first play
echo "5. Getting board state after Round 1..."
curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/round/1" \
  -k -s | jq '.data.board_state.tiles' | grep -v '""' | grep -v "^\[" | grep -v "^\]"

# Round 2: C?SERON which might generate CERONES
echo
echo "6. Starting Round 2 with rack: C?SERON"
ROUND2_RESPONSE=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "C?SERON"}' \
  -k -s)

echo "$ROUND2_RESPONSE" | jq '.data.rack'

# Generate optimal play for round 2
echo "7. Generating optimal play for Round 2..."
OPTIMAL2_RESPONSE=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/calculate_optimal" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -k -s)

echo "$OPTIMAL2_RESPONSE" > round2_optimal.json

# Check if there's an error
if [ $(echo "$OPTIMAL2_RESPONSE" | jq -r '.success') = "false" ]; then
  echo "ERROR generating optimal play:"
  echo "$OPTIMAL2_RESPONSE" | jq -r '.error'
else
  echo "Optimal play generated:"
  echo "$OPTIMAL2_RESPONSE" | jq '.data.optimal_play'
  
  # Try to place the optimal play
  echo "8. Attempting to place optimal play..."
  PLACE_RESPONSE=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/place_optimal" \
    -H "Content-Type: application/json" \
    -d '{}' \
    -k -s)
  
  if [ $(echo "$PLACE_RESPONSE" | jq -r '.success') = "false" ]; then
    echo "SUCCESS: Server correctly rejected invalid play that would overwrite tiles!"
    echo "Error message: $(echo "$PLACE_RESPONSE" | jq -r '.error')"
  else
    echo "WARNING: Server accepted the play. Checking board state..."
    curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/round/2" \
      -k -s | jq '.data.board_state.tiles' | grep -v '""' | grep -v "^\[" | grep -v "^\]"
  fi
fi

echo
echo "=== Test complete ==="