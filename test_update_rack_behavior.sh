#!/bin/bash

echo "=== Test de comportamiento de update_rack ==="
echo ""

# Crear torneo
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Update", "player_names": ["Test"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Torneo creado: $TOUR_ID"

# Función para contar fichas totales
count_tiles() {
    local desc="$1"
    echo "--- $desc ---"
    
    TILES=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
      -k -s 2>/dev/null)
    
    TOTAL=$(echo "$TILES" | jq '.data | length')
    echo "Total de fichas en el juego: $TOTAL"
    
    # Contar específicamente algunas letras
    for letter in Y M N S; do
        COUNT=$(echo "$TILES" | jq "[.data[] | select(.[0] == \"$letter\")] | length")
        echo "$letter: $COUNT fichas"
    done
    echo ""
}

# Estado inicial
count_tiles "Estado inicial"

# Generar primera ronda con atril específico
echo "Generando ronda con atril BCDFGHY..."
RESULT=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "BCDFGHY"}' \
  -k -s 2>/dev/null)

RACK1=$(echo "$RESULT" | jq -r '.data.rack')
echo "Rack generado: $RACK1"

count_tiles "Después de generar rack inicial"

# Ahora actualizar el rack
echo "Actualizando rack a AEIOUBC..."
UPDATE=$(curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/update_rack" \
  -H "Content-Type: application/json" \
  -d '{"rack": "AEIOUBC"}' \
  -k -s 2>/dev/null)

RACK2=$(echo "$UPDATE" | jq -r '.data.rack')
echo "Rack actualizado: $RACK2"

count_tiles "Después de update_rack"

# Verificar si las fichas se duplicaron
echo "=== Análisis ==="
echo "Si el total de fichas aumentó, hay duplicación en el servidor"
echo "El total debería mantenerse constante (103 fichas en Scrabble español)"