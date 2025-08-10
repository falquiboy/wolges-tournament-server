#!/bin/bash

# Script de desarrollo con auto-reload usando cargo-watch
# Reinicia automáticamente el servidor cuando detecta cambios

echo "🚀 Iniciando servidor de desarrollo con auto-reload..."
echo "📁 Observando cambios en: src/, Cargo.toml, *.html"
echo "🔄 El servidor se reiniciará automáticamente al guardar cambios"
echo ""
echo "Presiona Ctrl+C para detener"
echo ""

# Ejecutar cargo-watch
# -x: ejecuta el comando
# -w: observa archivos/directorios específicos
# -c: limpia la pantalla antes de cada ejecución
# -d: delay en segundos antes de reiniciar (evita múltiples reinicios)
cargo watch \
    -x "run --release" \
    -w src \
    -w Cargo.toml \
    -w index.html \
    -w player.html \
    -c \
    -d 1