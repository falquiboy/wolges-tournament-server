# 🎯 Contexto: Migración Supabase y Arquitectura Híbrida para Torneos

## Estado Actual (2 de Septiembre 2025)

### ✅ Completado
1. **Migración base a Supabase** - Dual persistence (JSON local + PostgreSQL online)
2. **Rutas migradas con persistencia dual:**
   - `/tournament/create` ✅
   - `/tournament/enroll` ✅ 
   - `/tournament/{id}/round/start` ✅
   - `/tournament/{id}` (GET) ✅
   - `/tournament/play/submit` ⚠️ (código listo, pero falla en runtime)

3. **URLs públicas funcionando** - `BASE_URL=https://wolges-tournament-server.onrender.com`
4. **Servidor deployed en Render** - Free tier con cold starts
5. **MCP Supabase configurado** - Service key instalado

### 🔴 Problema Actual: Jugadas NO Persisten en Supabase

**Causa identificada:** Schema mismatch en tabla `player_plays`

**Tabla actual (incorrecta):**
```sql
coord VARCHAR(10)  -- Espera "H8"
```

**Código envía:**
```sql
position_row INTEGER
position_col INTEGER  
position_down BOOLEAN
```

**Solución pendiente:** Ejecutar fix SQL en Supabase Dashboard

## 🎮 Objetivo Principal: Arquitectura Híbrida para 50 Jugadores

### Escenario Real
- **Torneos presenciales** con 50+ jugadores en mismo recinto
- **Red WiFi compartida** (potencial cuello de botella)
- **Timer de 3 minutos** proyectado para todos
- **Crítico:** Todos envían jugadas casi simultáneamente

### Arquitectura Propuesta
```
┌─────────────────┐
│  Local Server   │ ← Baja latencia para jugadas
│  (In-memory)    │ ← Timer sincronizado
└────────┬────────┘
         │
         ↓ Async
┌─────────────────┐
│    Supabase     │ ← Backup/Persistencia
│  (PostgreSQL)   │ ← Reportes post-torneo
└─────────────────┘
```

### Requisitos Críticos
1. **Latencia mínima** - Respuesta inmediata al jugador
2. **No bloquear** - Guardar en Supabase asíncronamente
3. **Resiliente** - Si Supabase falla, el torneo continúa
4. **Reportes** - Datos completos post-torneo desde Supabase

## 📋 Tareas Inmediatas

### 1. FIX URGENTE - Ejecutar en Supabase SQL Editor:
```sql
DROP TABLE IF EXISTS player_plays CASCADE;

CREATE TABLE player_plays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    word VARCHAR(100),
    position_row INTEGER,
    position_col INTEGER, 
    position_down BOOLEAN,
    score INTEGER DEFAULT 0,
    percentage_of_optimal REAL DEFAULT 0,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    cumulative_score INTEGER DEFAULT 0,
    difference_from_optimal INTEGER DEFAULT 0,
    cumulative_difference INTEGER DEFAULT 0,
    UNIQUE(tournament_id, player_id, round_number)
);

CREATE INDEX idx_player_plays_tournament ON player_plays(tournament_id);
CREATE INDEX idx_player_plays_player ON player_plays(player_id);
CREATE INDEX idx_player_plays_round ON player_plays(tournament_id, round_number);
```

### 2. Verificar con MCP Supabase
- Usar `mcp__supabase__query` para verificar tabla
- Confirmar columnas correctas
- Test insert de jugada

### 3. Optimizaciones para 50 Jugadores Concurrentes
- [ ] Implementar cola asíncrona para Supabase
- [ ] Añadir retry logic con exponential backoff
- [ ] Métricas de latencia y timeouts
- [ ] Cache local con sync diferido

## 🚀 Próximos Pasos Post-Fix

1. **Test de carga** - Simular 50 jugadas simultáneas
2. **Monitoreo** - Dashboard de latencias y errores
3. **Fallback automático** - Si Supabase timeout > 1s, solo JSON
4. **Sync post-torneo** - Bulk upload de jugadas perdidas

## 📝 Notas Técnicas

- **Logs mejorados** ya deployed en Render (commit ef8230e)
- **DATABASE_URL** configurada en Render environment
- **Cold starts** de ~1-2 min en free tier (normal)
- **Supabase connection pooling** usando pooler URL

## 🔧 Archivos Clave

- `/src/database.rs` - Módulo de persistencia Supabase
- `/src/routes.rs:343-397` - Ruta submit_play con dual persistence
- `/fix_player_plays_schema.sql` - Script para arreglar tabla
- `/supabase_schema.sql` - Schema completo actualizado

---

**Para continuar:** Lee este archivo y ejecuta el SQL fix en Supabase Dashboard primero.