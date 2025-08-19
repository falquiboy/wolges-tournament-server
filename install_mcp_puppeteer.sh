#!/bin/bash

echo "=== Instalador de MCP Puppeteer para Claude Desktop ==="
echo ""

# Detectar el sistema operativo
if [[ "$OSTYPE" == "darwin"* ]]; then
    CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
    echo "✓ Sistema detectado: macOS"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    CONFIG_PATH="$APPDATA/Claude/claude_desktop_config.json"
    echo "✓ Sistema detectado: Windows"
else
    CONFIG_PATH="$HOME/.config/Claude/claude_desktop_config.json"
    echo "✓ Sistema detectado: Linux"
fi

echo "✓ Ruta de configuración: $CONFIG_PATH"
echo ""

# Verificar si el directorio existe
CONFIG_DIR=$(dirname "$CONFIG_PATH")
if [ ! -d "$CONFIG_DIR" ]; then
    echo "⚠️  El directorio de Claude Desktop no existe: $CONFIG_DIR"
    echo "   ¿Tienes Claude Desktop instalado?"
    echo "   Puedes descargarlo de: https://claude.ai/download"
    exit 1
fi

# Hacer backup si existe el archivo
if [ -f "$CONFIG_PATH" ]; then
    BACKUP_PATH="${CONFIG_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "📋 Creando backup del archivo de configuración actual..."
    cp "$CONFIG_PATH" "$BACKUP_PATH"
    echo "✓ Backup guardado en: $BACKUP_PATH"
    
    # Leer configuración existente
    echo ""
    echo "📖 Configuración actual:"
    cat "$CONFIG_PATH"
    echo ""
else
    echo "📝 No se encontró archivo de configuración. Se creará uno nuevo."
fi

# Crear la nueva configuración
echo ""
echo "🔧 Creando nueva configuración con MCP Puppeteer..."

# Si el archivo existe, intentar preservar otras configuraciones
if [ -f "$CONFIG_PATH" ]; then
    # Verificar si ya tiene mcpServers
    if grep -q '"mcpServers"' "$CONFIG_PATH"; then
        echo "⚠️  Ya existe una sección mcpServers en la configuración."
        echo "   Por favor, agrega manualmente la siguiente configuración:"
        echo ""
        echo '  "puppeteer": {'
        echo '    "command": "npx",'
        echo '    "args": ["-y", "@modelcontextprotocol/server-puppeteer"]'
        echo '  }'
        echo ""
        echo "   Dentro de la sección mcpServers existente."
        exit 0
    fi
fi

# Crear nueva configuración
cat > "$CONFIG_PATH" << 'EOF'
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    }
  }
}
EOF

echo "✓ Configuración creada exitosamente!"
echo ""
echo "📋 Nueva configuración:"
cat "$CONFIG_PATH"
echo ""

# Verificar instalación de puppeteer
echo "🔍 Verificando instalación de Puppeteer MCP..."
npx -y @modelcontextprotocol/server-puppeteer --version 2>/dev/null || echo "Se instalará automáticamente al primer uso"

echo ""
echo "✅ ¡Instalación completada!"
echo ""
echo "📌 Próximos pasos:"
echo "   1. Cierra completamente Claude Desktop (Cmd+Q en macOS)"
echo "   2. Vuelve a abrir Claude Desktop"
echo "   3. Prueba escribiendo: 'Toma un screenshot de google.com'"
echo ""
echo "🎯 Para usar con tu servidor de Scrabble:"
echo "   Puedes pedirme: 'Toma un screenshot de http://localhost:8080'"
echo ""
echo "⚡ Si algo no funciona, ejecuta Claude Desktop con debug:"
echo "   /Applications/Claude.app/Contents/MacOS/Claude --mcp-debug"
echo ""