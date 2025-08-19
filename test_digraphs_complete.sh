#!/bin/bash

# Test completo de dígrafos en rack manual
# Verifica conversión natural → interna → display

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Test Completo de Dígrafos ===${NC}"
echo "Probando conversión: [CH]→ç, [LL]→k, [RR]→w"
echo ""

# Test 1: Rack con todos los dígrafos
echo -e "${YELLOW}Test 1: Rack con todos los dígrafos${NC}"
TOURNAMENT=$(curl -s -X POST http://localhost:8080/tournament/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test All Digraphs",
    "player_names": ["TestPlayer"]
  }')

TOURNAMENT_ID=$(echo $TOURNAMENT | grep -o '"id":"[^"]*' | sed 's/"id":"//')
echo "Tournament ID: $TOURNAMENT_ID"

# Definir rack con CH, LL, RR
MANUAL_RACK="A[CH][LL][RR]OSA"
echo "Rack entrada natural: $MANUAL_RACK"

ROUND=$(curl -s -X POST http://localhost:8080/tournament/$TOURNAMENT_ID/round/start_manual \
  -H "Content-Type: application/json" \
  -d "{\"rack\": \"$MANUAL_RACK\"}")

RETURNED_RACK=$(echo "$ROUND" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['data']['rack'] if 'data' in data and 'rack' in data['data'] else 'ERROR')")
echo "Rack retornado: $RETURNED_RACK"

# Verificar bolsa
BAG=$(curl -s http://localhost:8080/tournament/$TOURNAMENT_ID/bag_tiles)

# Contar fichas usadas
CEDILLA_USED=$(echo "$BAG" | python3 -c "import sys, json; data = json.load(sys.stdin); print(sum(1 for t in data['data'] if t[0] == 'Ç' and t[1]))")
K_USED=$(echo "$BAG" | python3 -c "import sys, json; data = json.load(sys.stdin); print(sum(1 for t in data['data'] if t[0] == 'K' and t[1]))")
W_USED=$(echo "$BAG" | python3 -c "import sys, json; data = json.load(sys.stdin); print(sum(1 for t in data['data'] if t[0] == 'W' and t[1]))")

echo "Fichas usadas de la bolsa:"
echo "  Ç (CH): $CEDILLA_USED"
echo "  K (LL): $K_USED"
echo "  W (RR): $W_USED"

if [ "$CEDILLA_USED" -eq "1" ] && [ "$K_USED" -eq "1" ] && [ "$W_USED" -eq "1" ]; then
    echo -e "${GREEN}✓ Test 1 PASADO: Dígrafos descontados correctamente${NC}"
else
    echo -e "${RED}✗ Test 1 FALLIDO: Dígrafos no descontados correctamente${NC}"
fi

echo ""

# Test 2: Rack con dígrafos sin corchetes (formato natural simple)
echo -e "${YELLOW}Test 2: Rack con dígrafos sin corchetes${NC}"
TOURNAMENT2=$(curl -s -X POST http://localhost:8080/tournament/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Simple Format",
    "player_names": ["TestPlayer2"]
  }')

TOURNAMENT_ID2=$(echo $TOURNAMENT2 | grep -o '"id":"[^"]*' | sed 's/"id":"//')

MANUAL_RACK2="ACHILLO"
echo "Rack entrada (sin corchetes): $MANUAL_RACK2"

ROUND2=$(curl -s -X POST http://localhost:8080/tournament/$TOURNAMENT_ID2/round/start_manual \
  -H "Content-Type: application/json" \
  -d "{\"rack\": \"$MANUAL_RACK2\"}")

RETURNED_RACK2=$(echo "$ROUND2" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['data']['rack'] if 'data' in data and 'rack' in data['data'] else 'ERROR')")
echo "Rack retornado: $RETURNED_RACK2"

# Verificar que se interpretó correctamente
BAG2=$(curl -s http://localhost:8080/tournament/$TOURNAMENT_ID2/bag_tiles)
CEDILLA_USED2=$(echo "$BAG2" | python3 -c "import sys, json; data = json.load(sys.stdin); print(sum(1 for t in data['data'] if t[0] == 'Ç' and t[1]))")
K_USED2=$(echo "$BAG2" | python3 -c "import sys, json; data = json.load(sys.stdin); print(sum(1 for t in data['data'] if t[0] == 'K' and t[1]))")

echo "Fichas usadas:"
echo "  Ç (CH): $CEDILLA_USED2"
echo "  K (LL): $K_USED2"

if [ "$CEDILLA_USED2" -eq "1" ] && [ "$K_USED2" -eq "1" ]; then
    echo -e "${GREEN}✓ Test 2 PASADO: Dígrafos sin corchetes procesados correctamente${NC}"
else
    echo -e "${RED}✗ Test 2 FALLIDO: Error procesando dígrafos sin corchetes${NC}"
fi

echo ""

# Test 3: Verificar que no se descuentan letras individuales
echo -e "${YELLOW}Test 3: Verificar que no se usan letras individuales${NC}"
TOURNAMENT3=$(curl -s -X POST http://localhost:8080/tournament/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test No Individual Letters",
    "player_names": ["TestPlayer3"]
  }')

TOURNAMENT_ID3=$(echo $TOURNAMENT3 | grep -o '"id":"[^"]*' | sed 's/"id":"//')

# Rack con RR (doble erre) - debe usar W, no dos R
MANUAL_RACK3="CA[RR]OSA"
echo "Rack con doble erre: $MANUAL_RACK3"

ROUND3=$(curl -s -X POST http://localhost:8080/tournament/$TOURNAMENT_ID3/round/start_manual \
  -H "Content-Type: application/json" \
  -d "{\"rack\": \"$MANUAL_RACK3\"}")

# Verificar bolsa
BAG3=$(curl -s http://localhost:8080/tournament/$TOURNAMENT_ID3/bag_tiles)

# Contar R individuales usadas vs W (RR)
R_USED=$(echo "$BAG3" | python3 -c "import sys, json; data = json.load(sys.stdin); print(sum(1 for t in data['data'] if t[0] == 'R' and t[1]))")
W_USED3=$(echo "$BAG3" | python3 -c "import sys, json; data = json.load(sys.stdin); print(sum(1 for t in data['data'] if t[0] == 'W' and t[1]))")

echo "Fichas usadas:"
echo "  R (individual): $R_USED"
echo "  W (RR/doble erre): $W_USED3"

if [ "$R_USED" -eq "1" ] && [ "$W_USED3" -eq "1" ]; then
    echo -e "${GREEN}✓ Test 3 PASADO: RR usa W, no dos R individuales${NC}"
else
    echo -e "${RED}✗ Test 3 FALLIDO: RR debería usar W, no R individuales${NC}"
    echo "  Esperado: R=1 (de CAROSA), W=1 (de RR)"
    echo "  Obtenido: R=$R_USED, W=$W_USED3"
fi

echo ""
echo -e "${YELLOW}=== Resumen de Pruebas ===${NC}"
echo "Todas las pruebas verifican que:"
echo "1. [CH] se convierte a Ç internamente"
echo "2. [LL] se convierte a K internamente"
echo "3. [RR] se convierte a W internamente"
echo "4. Los dígrafos usan fichas especiales, no letras individuales"
echo ""
echo -e "${GREEN}Pruebas completadas!${NC}"