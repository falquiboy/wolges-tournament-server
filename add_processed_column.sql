-- Agregar columna 'processed' a player_plays para tracking de polling
ALTER TABLE player_plays 
ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false;

-- Índice para queries eficientes de jugadas no procesadas
CREATE INDEX IF NOT EXISTS idx_player_plays_processed 
ON player_plays(processed, submitted_at) 
WHERE processed = false OR processed IS NULL;

-- Marcar todas las jugadas existentes como procesadas
-- (solo si ya tienes jugadas y quieres evitar reprocesarlas)
-- UPDATE player_plays SET processed = true WHERE processed IS NULL;