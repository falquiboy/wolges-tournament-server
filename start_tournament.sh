#!/bin/bash

# 🎮 Script de inicio para Torneo de Scrabble con arquitectura Supabase-first
# ========================================================================

echo "🎯 INICIANDO SERVIDOR DE TORNEO SCRABBLE DUPLICADO"
echo "=================================================="
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Verificar que el .env existe
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: No se encuentra archivo .env${NC}"
    echo "Por favor, copia .env.example a .env y configura tus credenciales de Supabase"
    exit 1
fi

# 2. Verificar conexión a Supabase
echo -e "${YELLOW}🔄 Verificando conexión con Supabase...${NC}"
source .env
psql "$DATABASE_URL" -c "SELECT 'OK' as status;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Conexión a Supabase exitosa${NC}"
else
    echo -e "${RED}❌ No se pudo conectar a Supabase${NC}"
    echo "Verifica tu DATABASE_URL en el archivo .env"
    exit 1
fi

# 3. Verificar que la columna 'processed' existe
echo -e "${YELLOW}🔄 Verificando schema de base de datos...${NC}"
psql "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'player_plays' AND column_name = 'processed';" | grep -q processed
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}📝 Agregando columna 'processed' a player_plays...${NC}"
    psql "$DATABASE_URL" -c "ALTER TABLE player_plays ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false;" > /dev/null 2>&1
    psql "$DATABASE_URL" -c "CREATE INDEX IF NOT EXISTS idx_player_plays_processed ON player_plays(processed, submitted_at) WHERE processed = false OR processed IS NULL;" > /dev/null 2>&1
    echo -e "${GREEN}✅ Schema actualizado${NC}"
else
    echo -e "${GREEN}✅ Schema correcto${NC}"
fi

# 4. Compilar en modo release si hay cambios
echo -e "${YELLOW}🔧 Compilando servidor...${NC}"
cargo build --release
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error de compilación${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Servidor compilado${NC}"

# 5. Obtener IP local
LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "localhost")

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🚀 INICIANDO SERVIDOR${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}📋 INFORMACIÓN IMPORTANTE:${NC}"
echo ""
echo "1. SERVIDOR LOCAL:"
echo "   URL: http://$LOCAL_IP:8080"
echo "   Admin: http://$LOCAL_IP:8080/index.html"
echo ""
echo "2. ARQUITECTURA:"
echo "   - Servidor: Control de torneo (local)"
echo "   - Jugadas: Directo a Supabase"
echo "   - Polling: Cada 500ms"
echo ""
echo "3. PARA JUGADORES:"
echo "   a) En red local (mismo WiFi):"
echo "      http://$LOCAL_IP:8080/player_supabase.html?tournament_id=TU_ID"
echo ""
echo "   b) Desde Internet (con ngrok):"
echo "      - Abre nueva terminal"
echo "      - Ejecuta: ngrok http 8080"
echo "      - Comparte el link https://xxx.ngrok-free.app"
echo ""
echo "4. MONITOREO:"
echo "   - Métricas: http://$LOCAL_IP:8080/api/metrics"
echo "   - Health: http://$LOCAL_IP:8080/api/health"
echo "   - Cache: http://$LOCAL_IP:8080/api/cache/stats"
echo ""
echo -e "${YELLOW}⚠️  NO CIERRES ESTA TERMINAL DURANTE EL TORNEO${NC}"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Servidor iniciando en puerto 8080...${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 6. Iniciar servidor
RUST_LOG=info ./target/release/wolges-tournament-server