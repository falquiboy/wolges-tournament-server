#!/bin/bash
# Script para iniciar el servidor de torneos fácilmente

echo "🎯 Iniciando Servidor de Torneos de Scrabble Duplicado"
echo "=================================================="

# Obtener la IP local
IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
if [ -z "$IP" ]; then
    IP="localhost"
fi

echo ""
echo "📺 PANTALLA PRINCIPAL (Proyector):"
echo "   http://$IP:8080"
echo ""
echo "📱 JUGADORES (En sus móviles):"
echo "   http://$IP:8080/player.html"
echo ""
echo "💡 INSTRUCCIONES:"
echo "1. Abre la pantalla principal en la computadora conectada al proyector"
echo "2. Carga el diccionario y crea un torneo"
echo "3. Copia el ID del torneo y compártelo con los jugadores"
echo "4. Los jugadores acceden desde sus móviles a /player.html"
echo "5. ¡A jugar!"
echo ""
echo "📝 Notas:"
echo "- Todos deben estar en la misma red WiFi"
echo "- Los jugadores usan tableros físicos para planear"
echo "- Solo envían su jugada final desde el móvil"
echo ""
echo "Presiona Ctrl+C para detener el servidor"
echo "=================================================="
echo ""

# Iniciar el servidor
RUST_LOG=info cargo run