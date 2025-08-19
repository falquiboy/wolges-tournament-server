#!/bin/bash

echo "=== Testing Blank Tile Rendering ==="
echo "Testing blanks (comodines) display as lowercase red letters without values"
echo ""

# Create a test tournament
echo "Creating test tournament..."
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Blank Test", "player_names": ["TestPlayer"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Tournament ID: $TOUR_ID"
echo ""

# Test 1: Manual rack with blank as regular letter
echo "Test 1: Manual rack with blank '?ORRILLOS' (? as CH)"
R1=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "?ORRILLOS"}' \
  -k -s 2>/dev/null)

echo "Rack tiles: $(echo "$R1" | jq -r '.data.rack')"
echo "Optimal play: $(echo "$R1" | jq -r '.data.optimal_play.word')"
echo ""

# Place the play
curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/place_optimal" \
  -k -s 2>/dev/null > /dev/null

# Test 2: Manual rack with blank as digraph
echo "Test 2: Manual rack with blank digraph '[ch]OCOLATE'"
R2=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "[ch]OCOLATE"}' \
  -k -s 2>/dev/null)

echo "Rack tiles: $(echo "$R2" | jq -r '.data.rack')"
echo "Optimal play: $(echo "$R2" | jq -r '.data.optimal_play.word')"
echo ""

# Place the play
curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/2/place_optimal" \
  -k -s 2>/dev/null > /dev/null

# Test 3: Mixed blanks and regular tiles
echo "Test 3: Manual rack with mixed blanks '?A[ll]ERO'"
R3=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "?A[ll]ERO"}' \
  -k -s 2>/dev/null)

echo "Rack tiles: $(echo "$R3" | jq -r '.data.rack')"
echo "Optimal play: $(echo "$R3" | jq -r '.data.optimal_play.word')"
echo ""

echo "=== Test Complete ==="
echo ""
echo "EXPECTED RESULTS:"
echo "1. Blanks (?) should appear as lowercase letters in red"
echo "2. Blank digraphs ([ch], [ll], [rr]) should appear as lowercase in red"
echo "3. No point values should be shown for blanks (they have 0 value)"
echo "4. Regular tiles should appear as uppercase with their point values"
echo ""
echo "Please check the UI at https://localhost:8443 to verify:"
echo "- Tournament: 'Blank Test'"
echo "- Blanks appear in red lowercase without values"
echo "- Regular tiles appear normal with values"