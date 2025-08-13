use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc, Local};
use serde::{Serialize, Deserialize};
use std::io::Write;
use crate::models::{Tournament, Player};
use crate::tournament_manager::TournamentManager;

const SCHEMA_VERSION: &str = "1.0.0";
const TOURNAMENTS_DIR: &str = "tournaments";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TournamentMetadata {
    pub schema_version: String,
    pub tournament_id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub last_modified: DateTime<Utc>,
    pub dictionary_hash: String,
    pub current_round: u32,
    pub status: String,
    pub total_players: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerSession {
    pub player_id: String,
    pub name: String,
    pub ip_address: String,
    pub user_agent: String,
    pub hardware_id: Option<String>,  // Fingerprint del navegador
    pub enrolled_at: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TournamentSnapshot {
    pub metadata: TournamentMetadata,
    pub tournament: Tournament,
    pub player_sessions: Vec<PlayerSession>,
    pub checksum: String,  // Para verificar integridad
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TournamentListItem {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub last_modified: DateTime<Utc>,
    pub current_round: u32,
    pub status: String,
    pub players_count: usize,
    pub folder_path: String,
}

pub struct PersistenceManager;

impl PersistenceManager {
    pub fn new() -> Self {
        // Asegurar que existe el directorio de torneos
        fs::create_dir_all(TOURNAMENTS_DIR).unwrap_or_else(|e| {
            eprintln!("Error creando directorio tournaments: {}", e);
        });
        Self
    }

    pub fn get_tournament_dir(tournament_id: &str, name: &str) -> PathBuf {
        let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S");
        let safe_name = name.to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '-' })
            .collect::<String>();
        
        PathBuf::from(TOURNAMENTS_DIR)
            .join(format!("{}_{}", timestamp, safe_name))
    }

    pub fn save_tournament(
        tournament: &Tournament, 
        _manager: &TournamentManager,
        player_sessions: Vec<PlayerSession>
    ) -> Result<(), Box<dyn std::error::Error>> {
        let dir = Self::find_tournament_dir(&tournament.id.to_string())?;
        
        // Calcular hash del diccionario
        let dict_hash = Self::calculate_dictionary_hash(_manager);
        
        // Crear metadata
        let metadata = TournamentMetadata {
            schema_version: SCHEMA_VERSION.to_string(),
            tournament_id: tournament.id.to_string(),
            name: tournament.name.clone(),
            created_at: tournament.created_at,
            last_modified: Utc::now(),
            dictionary_hash: dict_hash,
            current_round: tournament.rounds.len() as u32,
            status: format!("{:?}", tournament.status),
            total_players: tournament.players.len(),
        };
        
        // Crear snapshot con checksum
        let mut snapshot = TournamentSnapshot {
            metadata,
            tournament: tournament.clone(),
            player_sessions,
            checksum: String::new(),
        };
        
        // Calcular checksum
        snapshot.checksum = Self::calculate_checksum(&snapshot);
        
        // Guardar archivo principal
        let snapshot_path = dir.join("tournament.json");
        let json = serde_json::to_string_pretty(&snapshot)?;
        fs::write(&snapshot_path, &json)?;
        
        // Guardar backup con timestamp
        let backup_path = dir.join(format!("backups/tournament_{}.json", 
            Utc::now().format("%Y%m%d_%H%M%S")));
        fs::create_dir_all(dir.join("backups"))?;
        fs::write(&backup_path, &json)?;
        
        // Guardar ronda actual en archivo separado
        if let Some(last_round) = tournament.rounds.last() {
            let round_path = dir.join(format!("rounds/round_{:03}.json", last_round.number));
            fs::create_dir_all(dir.join("rounds"))?;
            fs::write(&round_path, serde_json::to_string_pretty(&last_round)?)?;
        }
        
        Ok(())
    }

    pub fn create_tournament_directory(tournament_id: &str, name: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let dir = Self::get_tournament_dir(tournament_id, name);
        
        // Crear estructura de directorios
        fs::create_dir_all(&dir)?;
        fs::create_dir_all(dir.join("rounds"))?;
        fs::create_dir_all(dir.join("logs"))?;
        fs::create_dir_all(dir.join("logs/player_logs"))?;
        fs::create_dir_all(dir.join("backups"))?;
        
        // Crear archivo de configuración inicial
        let config = serde_json::json!({
            "schema_version": SCHEMA_VERSION,
            "created_at": Utc::now(),
            "tournament_id": tournament_id,
            "name": name
        });
        
        fs::write(dir.join("config.json"), serde_json::to_string_pretty(&config)?)?;
        
        Ok(dir)
    }

    pub fn list_tournaments() -> Result<Vec<TournamentListItem>, Box<dyn std::error::Error>> {
        let mut tournaments = Vec::new();
        
        if let Ok(entries) = fs::read_dir(TOURNAMENTS_DIR) {
            for entry in entries.filter_map(Result::ok) {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_dir() {
                        if let Ok(item) = Self::load_tournament_info(&entry.path()) {
                            tournaments.push(item);
                        }
                    }
                }
            }
        }
        
        // Ordenar por fecha de modificación (más reciente primero)
        tournaments.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
        
        Ok(tournaments)
    }

    fn load_tournament_info(dir: &Path) -> Result<TournamentListItem, Box<dyn std::error::Error>> {
        let snapshot_path = dir.join("tournament.json");
        let content = fs::read_to_string(&snapshot_path)?;
        let snapshot: TournamentSnapshot = serde_json::from_str(&content)?;
        
        // Verificar checksum
        // Por ahora, ignorar la verificación del checksum en la lista
        // let calculated = Self::calculate_checksum(&snapshot);
        // if calculated != snapshot.checksum {
        //     eprintln!("Warning: Checksum mismatch for tournament {}", snapshot.metadata.tournament_id);
        // }
        
        Ok(TournamentListItem {
            id: snapshot.metadata.tournament_id,
            name: snapshot.metadata.name,
            created_at: snapshot.metadata.created_at,
            last_modified: snapshot.metadata.last_modified,
            current_round: snapshot.metadata.current_round,
            status: snapshot.metadata.status,
            players_count: snapshot.metadata.total_players,
            folder_path: dir.to_string_lossy().to_string(),
        })
    }

    pub fn load_tournament(tournament_id: &str) -> Result<(Tournament, Vec<PlayerSession>), Box<dyn std::error::Error>> {
        let dir = Self::find_tournament_dir(tournament_id)?;
        let snapshot_path = dir.join("tournament.json");
        
        let content = fs::read_to_string(&snapshot_path)?;
        let snapshot: TournamentSnapshot = serde_json::from_str(&content)?;
        
        // Verificar checksum
        let calculated = Self::calculate_checksum(&snapshot);
        if calculated != snapshot.checksum {
            return Err("Checksum verification failed".into());
        }
        
        // Verificar versión del schema
        if snapshot.metadata.schema_version != SCHEMA_VERSION {
            eprintln!("Warning: Schema version mismatch. Expected {}, got {}", 
                SCHEMA_VERSION, snapshot.metadata.schema_version);
        }
        
        Ok((snapshot.tournament, snapshot.player_sessions))
    }

    fn find_tournament_dir(tournament_id: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
        if let Ok(entries) = fs::read_dir(TOURNAMENTS_DIR) {
            for entry in entries.filter_map(Result::ok) {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_dir() {
                        let config_path = entry.path().join("config.json");
                        if config_path.exists() {
                            if let Ok(content) = fs::read_to_string(&config_path) {
                                if let Ok(config) = serde_json::from_str::<serde_json::Value>(&content) {
                                    if config["tournament_id"] == tournament_id {
                                        return Ok(entry.path());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Err(format!("Tournament directory not found for ID: {}", tournament_id).into())
    }

    fn calculate_checksum(snapshot: &TournamentSnapshot) -> String {
        use sha2::{Sha256, Digest};
        
        // Crear una copia temporal para calcular el checksum
        let temp = TournamentSnapshot {
            metadata: snapshot.metadata.clone(),
            tournament: snapshot.tournament.clone(),
            player_sessions: snapshot.player_sessions.clone(),
            checksum: String::new(),
        };
        
        match serde_json::to_string(&temp) {
            Ok(json) => {
                let mut hasher = Sha256::new();
                hasher.update(json.as_bytes());
                format!("{:x}", hasher.finalize())
            }
            Err(_) => String::from("invalid_checksum")
        }
    }

    fn calculate_dictionary_hash(_manager: &TournamentManager) -> String {
        use sha2::{Sha256, Digest};
        
        // Por ahora, usar un hash dummy
        // TODO: Implementar hash real del diccionario cuando esté disponible
        let mut hasher = Sha256::new();
        hasher.update(b"FISE2016");
        format!("{:x}", hasher.finalize())
    }

    pub fn log_event(tournament_id: &str, event: &str) -> Result<(), Box<dyn std::error::Error>> {
        let dir = Self::find_tournament_dir(tournament_id)?;
        let log_path = dir.join("logs/game.log");
        
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_path)?;
        
        writeln!(file, "[{}] {}", Utc::now().format("%Y-%m-%d %H:%M:%S%.3f"), event)?;
        
        Ok(())
    }

    pub fn log_player_action(
        tournament_id: &str, 
        player_id: &str, 
        action: &str
    ) -> Result<(), Box<dyn std::error::Error>> {
        let dir = Self::find_tournament_dir(tournament_id)?;
        let log_path = dir.join(format!("logs/player_logs/{}.log", player_id));
        
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_path)?;
        
        writeln!(file, "[{}] {}", Utc::now().format("%Y-%m-%d %H:%M:%S%.3f"), action)?;
        
        Ok(())
    }
}