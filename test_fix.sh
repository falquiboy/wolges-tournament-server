#!/bin/bash

echo "=== Testing if wolges handles digraphs correctly ==="

TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Fix Test", "player_names": ["P1"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

# Round 1
echo "Round 1: ?O[RR]I[LL]OS"
R1=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "?O[RR]I[LL]OS"}' \
  -k -s 2>/dev/null)

WORD1=$(echo "$R1" | jq -r '.data.optimal_play.word')
POS1=$(echo "$R1" | jq -r '.data.optimal_play.position | "\(.row),\(.col) \(if .down then "↓" else "→" end)"')
echo "  Optimal: $WORD1 at $POS1"

curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/place_optimal" \
  -k -s 2>/dev/null | jq -r '.success' > /dev/null

# Round 2
echo -e "\nRound 2: C?SERON"
R2=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "C?SERON"}' \
  -k -s 2>/dev/null)

WORD2=$(echo "$R2" | jq -r '.data.optimal_play.word')
POS2=$(echo "$R2" | jq -r '.data.optimal_play.position | "\(.row),\(.col) \(if .down then "↓" else "→" end)"')
SCORE2=$(echo "$R2" | jq -r '.data.optimal_play.score')

echo "  Optimal: $WORD2 at $POS2 ($SCORE2 points)"

# Check if it's trying to overwrite
if [ "$POS2" = "7,7 ↓" ]; then
    echo "  ⚠️ Still trying to place at H8 vertical (would overwrite [ch])"
else
    echo "  ✅ Found alternative position!"
fi

# Try to place
PLACE=$(curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/2/place_optimal" \
  -k -s 2>/dev/null)

if [ $(echo "$PLACE" | jq -r '.success') = "true" ]; then
    echo "  ✅ Play placed successfully!"
else
    echo "  ❌ Play rejected: $(echo "$PLACE" | jq -r '.error')"
fi
