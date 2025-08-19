#!/bin/bash

# Test a single rack to debug
rack="BCDFGHI"
echo "Testing rack: $rack"
echo "Letters: B C D F G H I"
echo "Expected: 1 vowel (I), 6 consonants (B,C,D,F,G,H)"
echo "Should be INVALID (exceeds 5 consonants max)"
echo ""

# Create tournament
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Debug Test", "player_names": ["Test"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Tournament ID: $TOUR_ID"

# Generate 4 rounds to get to round 5
for i in {1..4}; do
    curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start" \
      -k -s 2>/dev/null > /dev/null
    curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/$i/place_optimal" \
      -k -s 2>/dev/null > /dev/null
done

# Test the rack
echo "Testing rack in round 5..."
RESULT=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d "{\"rack\": \"$rack\"}" \
  -k -s 2>/dev/null)

echo "Full result:"
echo "$RESULT" | jq '.'

REJECTED=$(echo "$RESULT" | jq -r '.data.rack_rejected')
REASON=$(echo "$RESULT" | jq -r '.data.rejection_reason')

echo ""
echo "Rack rejected: $REJECTED"
echo "Rejection reason: $REASON"

if [ "$REJECTED" = "true" ]; then
    echo "✅ CORRECT: Rack was properly rejected"
else
    echo "❌ ERROR: Rack should have been rejected (6 consonants > 5 max)"
fi
