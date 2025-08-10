#!/bin/bash

# Test script for rack residue preservation

BASE_URL="http://localhost:8080"

echo "=== Testing Rack Residue Preservation ==="
echo

# 1. Load dictionary
echo "1. Loading dictionary..."
curl -s -X POST "$BASE_URL/dictionary/load" \
  -H "Content-Type: application/json" \
  -d '{"kwg_path": "./FISE2016_converted.kwg"}' | jq

# 2. Create tournament
echo -e "\n2. Creating tournament..."
TOURNAMENT_RESPONSE=$(curl -s -X POST "$BASE_URL/tournament/create" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Residue", "player_names": ["Player1"]}')
TOURNAMENT_ID=$(echo $TOURNAMENT_RESPONSE | jq -r '.data.id')
echo "Tournament ID: $TOURNAMENT_ID"

# 3. Start first round with a specific rack
echo -e "\n3. Starting round 1 with manual rack AMONASE..."
ROUND1_RESPONSE=$(curl -s -X POST "$BASE_URL/tournament/$TOURNAMENT_ID/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "AMONASE"}')
echo $ROUND1_RESPONSE | jq '.data.rack'

# 4. Check bag tiles - all AMONASE tiles should be dim
echo -e "\n4. Checking bag tiles (AMONASE tiles should be marked as used)..."
curl -s "$BASE_URL/tournament/$TOURNAMENT_ID/bag_tiles" | jq '.data | map(select(.)) | group_by(.[0]) | map({tile: .[0][0], available: (map(select(.[1] == false)) | length), used: (map(select(.[1] == true)) | length)}) | map(select(.tile == "A" or .tile == "M" or .tile == "O" or .tile == "N" or .tile == "S" or .tile == "E"))'

# 5. Calculate and place optimal play (should be AMONASE)
echo -e "\n5. Calculating optimal play..."
OPTIMAL1=$(curl -s "$BASE_URL/tournament/$TOURNAMENT_ID/round/1/optimal")
echo "Optimal play: $(echo $OPTIMAL1 | jq -r '.data.word') using $(echo $OPTIMAL1 | jq -r '.data.tiles_used | map(select(. != "")) | length') tiles"

echo -e "\n6. Revealing and placing optimal play..."
curl -s -X PUT "$BASE_URL/tournament/$TOURNAMENT_ID/round/1/reveal_optimal" > /dev/null
curl -s -X PUT "$BASE_URL/tournament/$TOURNAMENT_ID/round/1/place_optimal" | jq

# 7. Start second round with manual rack that has residue
echo -e "\n7. Starting round 2 with manual rack XPENDGE (should place EXPONED using O anchor, leaving G)..."
ROUND2_RESPONSE=$(curl -s -X POST "$BASE_URL/tournament/$TOURNAMENT_ID/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "XPENDGE"}')
echo "Round 2 rack: $(echo $ROUND2_RESPONSE | jq -r '.data.rack')"

# 8. Check bag tiles - XPENDGE tiles should now be dim, AMONASE still dim
echo -e "\n8. Checking bag tiles after round 2 start..."
curl -s "$BASE_URL/tournament/$TOURNAMENT_ID/bag_tiles" | jq '.data | map(select(.)) | group_by(.[0]) | map({tile: .[0][0], available: (map(select(.[1] == false)) | length), used: (map(select(.[1] == true)) | length)}) | map(select(.tile == "X" or .tile == "P" or .tile == "E" or .tile == "N" or .tile == "D" or .tile == "G"))'

# 9. Calculate optimal play for round 2
echo -e "\n9. Calculating optimal play for round 2..."
OPTIMAL2=$(curl -s "$BASE_URL/tournament/$TOURNAMENT_ID/round/2/optimal")
echo "Optimal play: $(echo $OPTIMAL2 | jq -r '.data.word') using $(echo $OPTIMAL2 | jq -r '.data.tiles_used | map(select(. != "")) | length') tiles"
echo "Tiles used: $(echo $OPTIMAL2 | jq -r '.data.tiles_used')"

echo -e "\n10. Placing optimal play..."
curl -s -X PUT "$BASE_URL/tournament/$TOURNAMENT_ID/round/2/reveal_optimal" > /dev/null
curl -s -X PUT "$BASE_URL/tournament/$TOURNAMENT_ID/round/2/place_optimal" | jq

# 10. Start third round - should preserve the G
echo -e "\n11. Starting round 3 (should have G from previous rack + 6 new tiles)..."
ROUND3_RESPONSE=$(curl -s -X POST "$BASE_URL/tournament/$TOURNAMENT_ID/round/start" \
  -H "Content-Type: application/json")
echo "Round 3 rack: $(echo $ROUND3_RESPONSE | jq -r '.data.rack')"

# 11. Final bag state check
echo -e "\n12. Final bag state - G should still be dim (in rack)..."
curl -s "$BASE_URL/tournament/$TOURNAMENT_ID/bag_tiles" | jq '.data | map(select(.)) | group_by(.[0]) | map({tile: .[0][0], available: (map(select(.[1] == false)) | length), used: (map(select(.[1] == true)) | length)}) | map(select(.tile == "G"))'

echo -e "\n=== Test Complete ===