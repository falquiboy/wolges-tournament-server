#!/bin/bash

# Test script to verify manual rack bag state management

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing Manual Rack Bag State Management${NC}"
echo "==========================================="

# Create tournament
echo -e "\n${YELLOW}1. Creating tournament...${NC}"
TOURNAMENT_RESPONSE=$(curl -s -X POST http://localhost:8080/tournament/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Manual Rack",
    "players": ["Player1", "Player2"]
  }')

TOURNAMENT_ID=$(echo $TOURNAMENT_RESPONSE | grep -o '"id":"[^"]*' | sed 's/"id":"//')
echo "Tournament ID: $TOURNAMENT_ID"

# Check initial bag count
echo -e "\n${YELLOW}2. Checking initial bag tiles...${NC}"
BAG_RESPONSE=$(curl -s http://localhost:8080/tournament/$TOURNAMENT_ID/bag_tiles)
INITIAL_COUNT=$(echo $BAG_RESPONSE | grep -o '"tiles_remaining":[0-9]*' | sed 's/.*://')
echo "Initial tiles in bag: $INITIAL_COUNT"

# Start automatic round
echo -e "\n${YELLOW}3. Starting automatic round...${NC}"
AUTO_ROUND=$(curl -s -X POST http://localhost:8080/tournament/$TOURNAMENT_ID/round/start)
AUTO_RACK=$(echo $AUTO_ROUND | grep -o '"rack":"[^"]*' | sed 's/"rack":"//')
echo "Automatic rack generated: $AUTO_RACK"

# Check bag after automatic round
BAG_RESPONSE=$(curl -s http://localhost:8080/tournament/$TOURNAMENT_ID/bag_tiles)
AFTER_AUTO=$(echo $BAG_RESPONSE | grep -o '"tiles_remaining":[0-9]*' | sed 's/.*://')
echo "Tiles in bag after automatic: $AFTER_AUTO"

# Now start manual round (should return automatic tiles to bag)
echo -e "\n${YELLOW}4. Starting manual round (should return auto tiles)...${NC}"
MANUAL_ROUND=$(curl -s -X POST http://localhost:8080/tournament/$TOURNAMENT_ID/round/start_manual \
  -H "Content-Type: application/json" \
  -d '{
    "rack": "ABCDEFG"
  }')

# Check bag after manual round
BAG_RESPONSE=$(curl -s http://localhost:8080/tournament/$TOURNAMENT_ID/bag_tiles)
AFTER_MANUAL=$(echo $BAG_RESPONSE | grep -o '"tiles_remaining":[0-9]*' | sed 's/.*://')
echo "Tiles in bag after manual: $AFTER_MANUAL"

# Verify the fix worked
echo -e "\n${YELLOW}5. Verification:${NC}"
if [ "$AFTER_MANUAL" -eq "$INITIAL_COUNT" ]; then
    echo -e "${GREEN}✓ SUCCESS: Tiles were correctly returned to bag!${NC}"
    echo "  Initial: $INITIAL_COUNT → After auto: $AFTER_AUTO → After manual: $AFTER_MANUAL"
else
    echo -e "${RED}✗ FAILED: Tiles were not returned correctly${NC}"
    echo "  Initial: $INITIAL_COUNT → After auto: $AFTER_AUTO → After manual: $AFTER_MANUAL"
    echo "  Expected $INITIAL_COUNT but got $AFTER_MANUAL"
fi

# Test 2: Start with manual, then automatic
echo -e "\n${YELLOW}Testing scenario 2: Manual then Automatic${NC}"
echo "==========================================="

# Create new tournament
echo -e "\n${YELLOW}1. Creating new tournament...${NC}"
TOURNAMENT_RESPONSE=$(curl -s -X POST http://localhost:8080/tournament/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Manual First",
    "players": ["Player3", "Player4"]
  }')

TOURNAMENT_ID2=$(echo $TOURNAMENT_RESPONSE | grep -o '"id":"[^"]*' | sed 's/"id":"//')
echo "Tournament ID: $TOURNAMENT_ID2"

# Check initial bag count
BAG_RESPONSE=$(curl -s http://localhost:8080/tournament/$TOURNAMENT_ID2/bag_tiles)
INITIAL_COUNT2=$(echo $BAG_RESPONSE | grep -o '"tiles_remaining":[0-9]*' | sed 's/.*://')
echo "Initial tiles in bag: $INITIAL_COUNT2"

# Start manual round first
echo -e "\n${YELLOW}2. Starting manual round first...${NC}"
MANUAL_FIRST=$(curl -s -X POST http://localhost:8080/tournament/$TOURNAMENT_ID2/round/start_manual \
  -H "Content-Type: application/json" \
  -d '{
    "rack": "HIJKLMN"
  }')

# Check bag after manual
BAG_RESPONSE=$(curl -s http://localhost:8080/tournament/$TOURNAMENT_ID2/bag_tiles)
AFTER_MANUAL_FIRST=$(echo $BAG_RESPONSE | grep -o '"tiles_remaining":[0-9]*' | sed 's/.*://')
echo "Tiles in bag after manual: $AFTER_MANUAL_FIRST"

# Place optimal play to complete the round
echo -e "\n${YELLOW}3. Completing manual round...${NC}"
curl -s -X PUT http://localhost:8080/tournament/$TOURNAMENT_ID2/round/1/place_optimal > /dev/null

# Start automatic round (should NOT modify bag incorrectly)
echo -e "\n${YELLOW}4. Starting automatic round after manual...${NC}"
AUTO_AFTER_MANUAL=$(curl -s -X POST http://localhost:8080/tournament/$TOURNAMENT_ID2/round/start)
AUTO_RACK2=$(echo $AUTO_AFTER_MANUAL | grep -o '"rack":"[^"]*' | sed 's/"rack":"//')
echo "Automatic rack generated: $AUTO_RACK2"

# Check bag after automatic
BAG_RESPONSE=$(curl -s http://localhost:8080/tournament/$TOURNAMENT_ID2/bag_tiles)
AFTER_AUTO2=$(echo $BAG_RESPONSE | grep -o '"tiles_remaining":[0-9]*' | sed 's/.*://')
echo "Tiles in bag after automatic: $AFTER_AUTO2"

echo -e "\n${YELLOW}5. Verification:${NC}"
EXPECTED_AFTER_AUTO=$((INITIAL_COUNT2 - 7))
if [ "$AFTER_AUTO2" -eq "$EXPECTED_AFTER_AUTO" ] || [ "$AFTER_AUTO2" -eq "$((EXPECTED_AFTER_AUTO + 1))" ] || [ "$AFTER_AUTO2" -eq "$((EXPECTED_AFTER_AUTO - 1))" ]; then
    echo -e "${GREEN}✓ SUCCESS: Bag count is correct after manual→automatic${NC}"
    echo "  Initial: $INITIAL_COUNT2 → After manual: $AFTER_MANUAL_FIRST → After auto: $AFTER_AUTO2"
else
    echo -e "${RED}✗ FAILED: Bag count incorrect${NC}"
    echo "  Initial: $INITIAL_COUNT2 → After manual: $AFTER_MANUAL_FIRST → After auto: $AFTER_AUTO2"
fi

echo -e "\n${GREEN}Test completed!${NC}"