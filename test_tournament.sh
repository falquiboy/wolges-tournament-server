#!/bin/bash

# Test tournament creation and rack generation

echo "1. Creating tournament..."
RESPONSE=$(curl -k -s -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Tournament", "player_names": ["Player 1", "Player 2"]}')

echo "Response: $RESPONSE"

# Extract tournament ID from response
TOURNAMENT_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Tournament ID: $TOURNAMENT_ID"

sleep 1

echo -e "\n2. Starting round..."
ROUND_RESPONSE=$(curl -k -s -X POST "https://localhost:8443/tournament/$TOURNAMENT_ID/round/start" \
  -H "Content-Type: application/json")

echo "Round Response: $ROUND_RESPONSE"