#!/bin/bash

# Test to verify anchor counting issue
echo "========================================="
echo "  TEST: ANCHOR COUNTING IN TILES_USED"
echo "========================================="
echo ""

BASE_URL="http://localhost:8080"

# Create tournament
echo "1. Creating test tournament..."
TOUR_ID=$(curl -s -X POST $BASE_URL/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Anchor Count", "player_names": ["Test"]}' | jq -r '.data.id')

echo "   Tournament ID: $TOUR_ID"
echo ""

# Generate rounds and check tiles_used
for round in {1..10}; do
    # Generate round
    curl -s -X POST $BASE_URL/tournament/$TOUR_ID/round/start > /dev/null
    
    # Get tournament state to see optimal play
    TOURNAMENT=$(curl -s -X GET $BASE_URL/tournament/$TOUR_ID)
    
    # Get optimal play details
    OPTIMAL=$(echo "$TOURNAMENT" | jq -r ".data.rounds[$round - 1].optimal_play")
    
    if [ "$OPTIMAL" != "null" ]; then
        WORD=$(echo "$OPTIMAL" | jq -r '.word')
        TILES_USED=$(echo "$OPTIMAL" | jq -r '.tiles_used | @json')
        TILES_COUNT=$(echo "$OPTIMAL" | jq -r '.tiles_used | length')
        NON_EMPTY_COUNT=$(echo "$OPTIMAL" | jq -r '[.tiles_used[] | select(. != "")] | length')
        
        echo "Round $round:"
        echo "  Word: $WORD"
        echo "  tiles_used array: $TILES_USED"
        echo "  Total elements: $TILES_COUNT"
        echo "  Non-empty elements: $NON_EMPTY_COUNT"
        
        if [ "$TILES_COUNT" -ne "$NON_EMPTY_COUNT" ]; then
            echo "  ⚠️ ANCHORS DETECTED: $((TILES_COUNT - NON_EMPTY_COUNT)) empty elements"
        fi
    fi
    
    # Place optimal to continue
    curl -s -X PUT $BASE_URL/tournament/$TOUR_ID/round/$round/place_optimal > /dev/null
    
    echo ""
done

echo "========================================="
echo "  FIN DEL TEST"
echo "========================================="
