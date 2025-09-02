-- Esquema de base de datos para Wolges Tournament Server
-- Migración del sistema de archivos JSON a PostgreSQL

-- Tabla principal de torneos
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_modified TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'Created' CHECK (status IN ('Created', 'InProgress', 'Finished')),
    tiles_remaining INTEGER DEFAULT 100,
    dictionary_hash VARCHAR(64),
    current_round INTEGER DEFAULT 0
);

-- Tabla de jugadores
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    total_score INTEGER DEFAULT 0,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    hardware_id VARCHAR(255)
);

-- Tabla de rondas
CREATE TABLE rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    rack VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'Generated' CHECK (status IN ('Generated', 'InProgress', 'Completed')),
    optimal_revealed BOOLEAN DEFAULT FALSE,
    rack_rejected BOOLEAN DEFAULT FALSE,
    start_time TIMESTAMPTZ,
    timer_duration INTEGER DEFAULT 180, -- 3 minutos en segundos
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, number)
);

-- Tabla de jugadas del Master
CREATE TABLE master_plays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    word VARCHAR(50) NOT NULL,
    coord VARCHAR(10) NOT NULL, -- ej: "8H"
    score INTEGER NOT NULL,
    direction VARCHAR(10) CHECK (direction IN ('across', 'down')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, round_number)
);

-- Tabla de jugadas de jugadores
CREATE TABLE player_plays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    word VARCHAR(50),
    coord VARCHAR(10),
    score INTEGER DEFAULT 0,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id, round_number)
);

-- Tabla de estado del tablero por ronda
CREATE TABLE board_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    board_data JSONB NOT NULL, -- Estado completo del tablero
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, round_number)
);

-- Índices para optimizar consultas
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_players_tournament ON players(tournament_id);
CREATE INDEX idx_rounds_tournament ON rounds(tournament_id, number);
CREATE INDEX idx_master_plays_tournament ON master_plays(tournament_id, round_number);
CREATE INDEX idx_player_plays_tournament ON player_plays(tournament_id, round_number);
CREATE INDEX idx_player_plays_player ON player_plays(player_id, round_number);

-- Triggers para actualizar last_modified
CREATE OR REPLACE FUNCTION update_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tournaments 
    SET last_modified = NOW() 
    WHERE id = COALESCE(NEW.tournament_id, OLD.tournament_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tournament_modified_players
    AFTER INSERT OR UPDATE OR DELETE ON players
    FOR EACH ROW EXECUTE FUNCTION update_last_modified();

CREATE TRIGGER update_tournament_modified_rounds
    AFTER INSERT OR UPDATE OR DELETE ON rounds
    FOR EACH ROW EXECUTE FUNCTION update_last_modified();

CREATE TRIGGER update_tournament_modified_master_plays
    AFTER INSERT OR UPDATE OR DELETE ON master_plays
    FOR EACH ROW EXECUTE FUNCTION update_last_modified();

CREATE TRIGGER update_tournament_modified_player_plays
    AFTER INSERT OR UPDATE OR DELETE ON player_plays
    FOR EACH ROW EXECUTE FUNCTION update_last_modified();