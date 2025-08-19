#!/bin/bash

echo "=== Clean test with digraphs ==="

# Create new tournament
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Clean Test", "player_names": ["P1"]}' \
  -k -s | jq -r '.data.id')

echo "Tournament: $TOUR_ID"

# Round 1
echo -e "\n--- Round 1: ?O[RR]I[LL]OS ---"
curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "?O[RR]I[LL]OS"}' \
  -k -s | jq '{success: .success, rack: .data.rack}'

curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/reveal_optimal" \
  -k -s | jq '.success'

OPTIMAL1=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/round/1" \
  -k -s | jq '.data.optimal_play')
echo "Optimal play: $OPTIMAL1"

curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/place_optimal" \
  -k -s | jq

# Round 2  
echo -e "\n--- Round 2: C?SERON ---"
curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "C?SERON"}' \
  -k -s | jq '{success: .success, rack: .data.rack}'

curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/2/reveal_optimal" \
  -k -s | jq '.success'

OPTIMAL2=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/round/2" \
  -k -s | jq '.data.optimal_play')
echo "Optimal play: $OPTIMAL2"

echo -e "\nAttempting to place round 2 optimal..."
curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/2/place_optimal" \
  -k -s | jq
