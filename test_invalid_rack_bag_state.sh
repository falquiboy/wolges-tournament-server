#!/bin/bash

echo "=== Test de estado de bolsa con atril inválido ==="
echo ""

# Crear torneo
TOUR_ID=$(curl -X POST https://localhost:8443/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Bolsa", "player_names": ["Test"]}' \
  -k -s 2>/dev/null | jq -r '.data.id')

echo "Torneo creado: $TOUR_ID"
echo ""

# Función para mostrar estado de fichas Y
check_y_tiles() {
    local desc="$1"
    echo "--- $desc ---"
    
    # Obtener todas las fichas
    TILES=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/bag_tiles" \
      -k -s 2>/dev/null)
    
    # Contar Y total, used y available
    Y_TOTAL=$(echo "$TILES" | jq '[.data[] | select(.[0] == "Y")] | length')
    Y_USED=$(echo "$TILES" | jq '[.data[] | select(.[0] == "Y" and .[1] == true)] | length')
    Y_AVAILABLE=$(echo "$TILES" | jq '[.data[] | select(.[0] == "Y" and .[1] == false)] | length')
    
    echo "Y total: $Y_TOTAL"
    echo "Y usadas (rack+tablero): $Y_USED"
    echo "Y disponibles (bolsa): $Y_AVAILABLE"
    
    # Obtener rack actual si existe
    CURRENT_ROUND=$(curl -X GET "https://localhost:8443/tournament/${TOUR_ID}/round/current" \
      -k -s 2>/dev/null)
    
    if [ "$(echo "$CURRENT_ROUND" | jq -r '.success')" = "true" ]; then
        RACK=$(echo "$CURRENT_ROUND" | jq -r '.data.rack')
        echo "Rack actual: $RACK"
        
        # Contar Y en el rack
        Y_IN_RACK=$(echo "$RACK" | grep -o "Y" | wc -l | tr -d ' ')
        echo "Y en el rack: $Y_IN_RACK"
    fi
    
    echo ""
}

# Estado inicial
check_y_tiles "Estado inicial (sin rondas)"

# Generar primera ronda con atril inválido forzado
echo "Generando ronda 1 con atril inválido (BCDFGHY - 1 vocal, 6 consonantes)..."
RESULT=$(curl -X POST "https://localhost:8443/tournament/${TOUR_ID}/round/start_manual" \
  -H "Content-Type: application/json" \
  -d '{"rack": "BCDFGHY"}' \
  -k -s 2>/dev/null)

REJECTED=$(echo "$RESULT" | jq -r '.data.rack_rejected')
echo "Atril rechazado: $REJECTED"
echo ""

# Ver estado después de generar atril inválido
check_y_tiles "Después de generar atril inválido"

# Esperar un segundo para asegurar que todo se actualice
sleep 1

# Ver estado otra vez
check_y_tiles "Un segundo después (sin hacer nada más)"

# Ahora intentar regenerar
echo "Intentando regenerar atril..."
# Simular presionar el botón de regenerar - esto normalmente lo haría la UI
# Necesitamos actualizar el rack con uno nuevo
REGEN_RESULT=$(curl -X PUT "https://localhost:8443/tournament/${TOUR_ID}/round/1/update_rack" \
  -H "Content-Type: application/json" \
  -d '{"rack": "AEIOUBC"}' \
  -k -s 2>/dev/null)

if [ "$(echo "$REGEN_RESULT" | jq -r '.success')" = "true" ]; then
    echo "Rack regenerado exitosamente"
    NEW_RACK=$(echo "$REGEN_RESULT" | jq -r '.data.rack')
    echo "Nuevo rack: $NEW_RACK"
else
    echo "Error regenerando: $(echo "$REGEN_RESULT" | jq -r '.error')"
fi
echo ""

# Ver estado después de regenerar
check_y_tiles "Después de regenerar atril"

echo "=== Resumen ==="
echo "Si hay duplicación, veremos que el total de fichas Y aumenta"
echo "Normalmente debe haber solo 1 Y en total en el juego"