-- Agregar columna 'processed' a player_plays si no existe
ALTER TABLE player_plays 
ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false;

-- Agregar columna 'created_at' a players si no existe
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_player_plays_processed 
ON player_plays(processed, submitted_at) 
WHERE processed IS NULL OR processed = false;

CREATE INDEX IF NOT EXISTS idx_player_plays_tournament 
ON player_plays(tournament_id, round_number, submitted_at);

-- Verificar estructura de las tablas
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'player_plays'
ORDER BY ordinal_position;

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'players'
ORDER BY ordinal_position;