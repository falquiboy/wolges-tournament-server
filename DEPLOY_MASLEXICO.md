# 🚀 Despliegue en MasLexico.app (Netlify)

## 📋 Resumen

Con maslexico.app en Netlify, los jugadores acceden desde **cualquier lugar** sin depender de IPs locales:

```
Jugadores → maslexico.app → Supabase ← Tu servidor local
           (desde cualquier red)       (administración)
```

## ✅ Ventajas de usar MasLexico.app

| Aspecto | Beneficio |
|---------|-----------|
| **URL fija** | `maslexico.app/t/TORNEO_ID` |
| **Sin IP local** | No necesitas ngrok ni IP pública |
| **Multi-dispositivo** | Funciona en móvil, tablet, PC |
| **Multi-red** | WiFi, 4G, 5G simultáneamente |
| **Siempre disponible** | Netlify tiene 99.99% uptime |
| **CDN global** | Rápido desde cualquier país |

## 🛠️ Configuración Inicial (Una sola vez)

### 1. Conectar con Netlify

```bash
# Instalar Netlify CLI si no lo tienes
npm install -g netlify-cli

# Login en Netlify
netlify login

# Conectar el sitio existente
cd netlify-player
netlify link --name maslexico
```

### 2. Configurar variables de entorno en Netlify

Ve a: https://app.netlify.com/sites/maslexico/settings/env

Agrega:
```
VITE_SUPABASE_URL = https://duxzmtvrcaphljakflod.supabase.co
VITE_SUPABASE_ANON_KEY = eyJ...tu_key_aqui
```

## 📦 Desplegar Cambios

### Opción A: Deploy Manual (Rápido)

```bash
cd netlify-player
netlify deploy --prod
```

### Opción B: Git Push (Automático)

```bash
git add netlify-player/
git commit -m "Update player interface"
git push
```

Netlify detecta cambios y despliega automáticamente.

## 🎮 Flujo de Torneo con MasLexico.app

### 1. Crear torneo (Servidor local)

```bash
# Iniciar servidor local
./start_tournament.sh

# Crear torneo via API o UI admin
# Obtienes: tournament_id = "abc123..."
```

### 2. Generar link público

```bash
./generate_public_link.sh abc123

# Resultado:
# https://maslexico.app/t/abc123
```

### 3. Compartir con jugadores

**WhatsApp/Telegram:**
```
🎮 ¡Torneo de Scrabble en vivo!
📱 Únete aquí: https://maslexico.app/t/abc123
✅ Funciona con WiFi o datos móviles
```

### 4. Jugadores se conectan

- Abren el link desde **cualquier dispositivo**
- Ingresan su nombre
- Envían jugadas directo a Supabase
- No importa si cambian de red

### 5. Tu servidor procesa

```
Servidor local (tu laptop):
- Lee jugadas de Supabase (polling)
- Valida con motor Wolges
- Actualiza rankings
- Controla rondas y timer
```

## 🔗 URLs Disponibles

### Producción (maslexico.app)

| URL | Descripción |
|-----|-------------|
| `maslexico.app` | Lista de torneos activos |
| `maslexico.app/t/ID` | Link corto para jugadores |
| `maslexico.app/torneo/ID` | Link amigable |
| `maslexico.app/player.html?tournament_id=ID` | Link directo |

### Desarrollo Local

```bash
# Probar localmente antes de desplegar
cd netlify-player
netlify dev

# Abre: http://localhost:8888
```

## 📊 Monitoreo

### Dashboard de Netlify
https://app.netlify.com/sites/maslexico/analytics

Puedes ver:
- Visitas en tiempo real
- Países de origen
- Dispositivos usados
- Ancho de banda

### Logs de Supabase
```sql
-- Ver jugadas recientes
SELECT * FROM player_plays 
WHERE submitted_at > NOW() - INTERVAL '1 hour'
ORDER BY submitted_at DESC;

-- Jugadores activos
SELECT DISTINCT player_id, COUNT(*) as plays
FROM player_plays
WHERE tournament_id = 'abc123'
GROUP BY player_id;
```

## 🚨 Troubleshooting

### Problema: Jugadores no pueden conectar

1. Verifica Supabase esté activo:
```bash
psql $DATABASE_URL -c "SELECT 1;"
```

2. Verifica el torneo existe:
```sql
SELECT * FROM tournaments WHERE id = 'abc123';
```

### Problema: Cambios no se reflejan

```bash
# Limpiar cache de Netlify
netlify deploy --prod --clear
```

### Problema: Error de CORS

Verificar en `netlify.toml` que no haya restricciones.

## 🎯 Mejores Prácticas

1. **Antes del torneo:**
   - Deploy a Netlify 1 hora antes
   - Test con 2-3 dispositivos
   - Generar link y guardarlo

2. **Durante el torneo:**
   - Monitorear `/api/metrics` local
   - Revisar Netlify Analytics
   - Tener link de respaldo

3. **Después del torneo:**
   - Exportar datos de Supabase
   - Generar reportes
   - Limpiar jugadas procesadas

## 📱 Links de Ejemplo

```bash
# Torneo de prueba
https://maslexico.app/t/test-123

# Torneo oficial
https://maslexico.app/torneo/campeonato-2025

# Con parámetros
https://maslexico.app/player.html?tournament_id=abc&round=1
```

---

**¡Listo!** Con maslexico.app los jugadores acceden desde cualquier lugar sin depender de tu IP local. 🎉