#!/bin/bash

# Generar certificado autofirmado temporal
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"

# Iniciar servidor con HTTPS (requeriría modificar el código)
echo "Para HTTPS completo se requiere modificar el servidor Rust"
echo "Por ahora, usa HTTP con las instrucciones del navegador móvil"