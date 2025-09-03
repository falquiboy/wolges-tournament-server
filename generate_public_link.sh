#!/bin/bash

# Script para generar link público de MasLexico para un torneo

echo "🔗 GENERADOR DE LINKS PÚBLICOS - MASLEXICO"
echo "=========================================="
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar si se pasó un tournament_id
if [ $# -eq 0 ]; then
    echo "Uso: ./generate_public_link.sh <tournament_id>"
    echo ""
    echo "Ejemplo: ./generate_public_link.sh abc123-def456"
    exit 1
fi

TOURNAMENT_ID=$1

echo -e "${GREEN}✅ Links generados para torneo: ${TOURNAMENT_ID}${NC}"
echo ""
echo -e "${BLUE}📱 LINKS PARA COMPARTIR CON JUGADORES:${NC}"
echo ""
echo "1. Link directo largo:"
echo -e "${YELLOW}   https://maslexico.app/player.html?tournament_id=${TOURNAMENT_ID}${NC}"
echo ""
echo "2. Link corto (más fácil de compartir):"
echo -e "${YELLOW}   https://maslexico.app/t/${TOURNAMENT_ID}${NC}"
echo ""
echo "3. Link amigable:"
echo -e "${YELLOW}   https://maslexico.app/torneo/${TOURNAMENT_ID}${NC}"
echo ""
echo -e "${GREEN}📋 INSTRUCCIONES PARA JUGADORES:${NC}"
echo ""
echo "1. Abre el link en tu navegador (móvil o PC)"
echo "2. Ingresa tu nombre"
echo "3. ¡Espera a que comience la ronda!"
echo ""
echo -e "${BLUE}💡 TIPS:${NC}"
echo "- Los jugadores pueden usar WiFi o datos móviles"
echo "- No importa si cambian de red durante el juego"
echo "- Las jugadas se guardan automáticamente"
echo ""
echo "=========================================="
echo -e "${GREEN}✅ Comparte cualquiera de los links de arriba${NC}"
echo "=========================================="