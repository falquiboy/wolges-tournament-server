#!/bin/bash

echo "Generando certificado autofirmado para HTTPS..."

# Crear directorio para certificados si no existe
mkdir -p certs

# Generar clave privada y certificado autofirmado
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -days 365 \
  -nodes \
  -subj "/C=ES/ST=Madrid/L=Madrid/O=WOLGES/CN=192.168.157.187" \
  -addext "subjectAltName=IP:192.168.157.187,IP:127.0.0.1,DNS:localhost"

echo "Certificado generado en:"
echo "  - certs/cert.pem (certificado)"
echo "  - certs/key.pem (clave privada)"
echo ""
echo "Los navegadores mostrarán una advertencia de seguridad."
echo "Los usuarios deberán aceptar el certificado autofirmado para continuar."