#!/bin/bash

echo "=== Comprehensive Digraph Test ==="

test_scenario() {
    local name=$1
    local rack1=$2
    local rack2=$3
    
    echo -e "\n--- Scenario: $name ---"
    
    TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"$name\", \"player_names\": [\"P1\"]}" \
      -k -s 2>/dev/null | jq -r '.data.id')
    
    # Round 1
    R1=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
      -H "Content-Type: application/json" \
      -d "{\"rack\": \"$rack1\"}" \
      -k -s 2>/dev/null)
    
    WORD1=$(echo "$R1" | jq -r '.data.optimal_play.word')
    echo "Round 1 ($rack1): $WORD1"
    
    curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/place_optimal" \
      -k -s 2>/dev/null > /dev/null
    
    # Round 2
    R2=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
      -H "Content-Type: application/json" \
      -d "{\"rack\": \"$rack2\"}" \
      -k -s 2>/dev/null)
    
    WORD2=$(echo "$R2" | jq -r '.data.optimal_play.word')
    POS2=$(echo "$R2" | jq -r '.data.optimal_play.position | "\(.row),\(.col)"')
    echo "Round 2 ($rack2): $WORD2 at $POS2"
    
    # Try to place
    PLACE=$(curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/2/place_optimal" \
      -k -s 2>/dev/null)
    
    if [ $(echo "$PLACE" | jq -r '.success') = "true" ]; then
        echo "✅ Success"
    else
        echo "❌ Failed: $(echo "$PLACE" | jq -r '.error' | head -c 50)..."
    fi
}

# Test different scenarios
test_scenario "Blank as CH" "?O[RR]I[LL]OS" "C?SERON"
test_scenario "Real CH tile" "[CH]ORITOS" "CA?ERON"
test_scenario "Mixed digraphs" "?[LL]AMOS" "[RR]?TONES"

echo -e "\n=== All tests completed ==="
