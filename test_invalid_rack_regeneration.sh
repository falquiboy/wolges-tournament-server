#!/bin/bash

echo "=== Test regeneración de rack inválido ==="
echo ""

# Crear torneo
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Regeneration", "player_names": ["Test"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Torneo creado: $TOUR_ID"

# Generar rack inválido
echo "Generando rack inválido BCDFGHY (1 vocal, 6 consonantes)..."
RESULT=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "BCDFGHY"}' \
  -k -s 2>/dev/null)

REJECTED=$(echo "$RESULT" | jq -r '.data.rack_rejected')
echo "Rack rechazado: $REJECTED"
echo ""

# Ver fichas disponibles
echo "Fichas disponibles antes de regenerar:"
TILES=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
  -k -s 2>/dev/null)

# Contar fichas no usadas
AVAILABLE=$(echo "$TILES" | jq '[.data[] | select(.[1] == false)] | length')
echo "Fichas disponibles en bolsa: $AVAILABLE"

# Intentar regenerar con varios racks aleatorios
echo ""
echo "Intentando regenerar con racks aleatorios..."

for i in {1..5}; do
    echo ""
    echo "Intento $i:"
    
    # Generar un rack aleatorio con las fichas disponibles
    RANDOM_RACK=$(echo "$TILES" | jq -r '[.data[] | .[0]] | .[0:100] | join("") | .[0:7]')
    echo "Probando rack: $RANDOM_RACK"
    
    UPDATE_RESULT=$(curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/update_rack" \
      -H "Content-Type: application/json" \
      -d "{\"rack\": \"$RANDOM_RACK\"}" \
      -k -s 2>/dev/null)
    
    SUCCESS=$(echo "$UPDATE_RESULT" | jq -r '.success')
    
    if [ "$SUCCESS" = "true" ]; then
        NEW_RACK=$(echo "$UPDATE_RESULT" | jq -r '.data.rack')
        REJECTED=$(echo "$UPDATE_RESULT" | jq -r '.data.rack_rejected')
        echo "✓ Éxito! Nuevo rack: $NEW_RACK (rechazado: $REJECTED)"
        
        # Si no fue rechazado, hemos encontrado uno válido
        if [ "$REJECTED" = "false" ] || [ "$REJECTED" = "null" ]; then
            echo "¡Rack válido generado!"
            break
        fi
    else
        ERROR=$(echo "$UPDATE_RESULT" | jq -r '.error')
        echo "✗ Error: $ERROR"
    fi
done