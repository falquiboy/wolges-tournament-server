#!/bin/bash

echo "=== Test de Patrón de Atriles Rechazados ==="
echo ""

# Crear torneo
TOUR_ID=$(curl -s -X POST http://localhost:8080/tournament/create \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Pattern", "player_names": ["Test"]}' | jq -r '.data.id')

echo "Torneo creado: $TOUR_ID"
echo ""

# Array para almacenar racks rechazados
declare -a rejected_racks

echo "Generando 20 rondas y registrando atriles rechazados..."
echo "================================================"

for i in {1..20}; do
    echo ""
    echo "Ronda $i:"
    
    # Generar nueva ronda
    RESULT=$(curl -s -X POST "http://localhost:8080/tournament/${TOUR_ID}/round/start" \
      -H "Content-Type: application/json")
    
    RACK=$(echo "$RESULT" | jq -r '.data.rack')
    REJECTED=$(echo "$RESULT" | jq -r '.data.rack_rejected')
    REASON=$(echo "$RESULT" | jq -r '.data.rejection_reason // "null"')
    
    echo "  Rack: $RACK"
    echo "  Rechazado: $REJECTED"
    
    if [ "$REJECTED" = "true" ]; then
        echo "  Razón: $REASON"
        rejected_racks+=("$RACK")
        
        # Intentar regenerar
        echo "  Regenerando..."
        REGEN=$(curl -s -X PUT "http://localhost:8080/tournament/${TOUR_ID}/round/${i}/update_rack" \
          -H "Content-Type: application/json" \
          -d '{"rack": "AEIOUBG"}')
        
        NEW_RACK=$(echo "$REGEN" | jq -r '.data.rack')
        echo "  Nuevo rack: $NEW_RACK"
    fi
    
    # Simular juego óptimo (bingo si es posible)
    curl -s -X PUT "http://localhost:8080/tournament/${TOUR_ID}/round/${i}/calculate_optimal" > /dev/null
    curl -s -X PUT "http://localhost:8080/tournament/${TOUR_ID}/round/${i}/place_optimal" > /dev/null
done

echo ""
echo "================================================"
echo "ANÁLISIS DE PATRONES:"
echo ""

# Contar duplicados
echo "Atriles rechazados y su frecuencia:"
printf '%s\n' "${rejected_racks[@]}" | sort | uniq -c | sort -rn

echo ""
echo "Total de rechazos: ${#rejected_racks[@]}"
echo "Atriles únicos rechazados: $(printf '%s\n' "${rejected_racks[@]}" | sort -u | wc -l)"

# Calcular porcentaje de duplicación
if [ ${#rejected_racks[@]} -gt 0 ]; then
    UNIQUE=$(printf '%s\n' "${rejected_racks[@]}" | sort -u | wc -l)
    TOTAL=${#rejected_racks[@]}
    DUPLICATION_RATE=$(echo "scale=2; (($TOTAL - $UNIQUE) * 100) / $TOTAL" | bc)
    echo "Tasa de duplicación: ${DUPLICATION_RATE}%"
fi