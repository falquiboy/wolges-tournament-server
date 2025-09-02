-- Script para actualizar la tabla player_plays en Supabase
-- Ejecutar este script en el SQL Editor de Supabase

-- Primero, eliminar la tabla existente si tiene estructura incorrecta
DROP TABLE IF EXISTS player_plays CASCADE;

-- Recrear la tabla con la estructura correcta que coincide con el código
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

-- Crear índices para mejorar performance
CREATE INDEX idx_player_plays_tournament ON player_plays(tournament_id);
CREATE INDEX idx_player_plays_player ON player_plays(player_id);
CREATE INDEX idx_player_plays_round ON player_plays(tournament_id, round_number);