#!/bin/bash

SERVER="http://localhost:8080"

echo "1. Creating tournament..."
RESPONSE=$(curl -s -X POST "$SERVER/tournament/create" -H "Content-Type: application/json" -d '{
  "name": "Test Tournament",
  "player_names": ["Player1"]
}')

TOURNAMENT_ID=$(echo $RESPONSE | jq -r '.data.id')
echo "   Tournament ID: $TOURNAMENT_ID"

echo "2. Starting round 1..."
ROUND_RESPONSE=$(curl -s -X POST "$SERVER/tournament/$TOURNAMENT_ID/round/start")
echo "   Rack: $(echo $ROUND_RESPONSE | jq -r '.data.rack // .error')"

echo "3. Getting tournament status..."
STATUS=$(curl -s "$SERVER/tournament/$TOURNAMENT_ID" | jq -r '.data.status // .error')
echo "   Status: $STATUS"

echo "4. Set manual rack for testing: ?O[RR]I[LL]OS"
MANUAL_RESPONSE=$(curl -s -X POST "$SERVER/tournament/$TOURNAMENT_ID/round/manual_rack" \
  -H "Content-Type: application/json" \
  -d '{"rack": "?O[RR]I[LL]OS"}')
echo "   Response: $(echo $MANUAL_RESPONSE | jq -r '.success // .error')"

echo "5. Calculate optimal play..."
OPTIMAL_RESPONSE=$(curl -s "$SERVER/tournament/$TOURNAMENT_ID/optimal_play")
echo "   Optimal: $(echo $OPTIMAL_RESPONSE | jq -c '.data // .error')"
