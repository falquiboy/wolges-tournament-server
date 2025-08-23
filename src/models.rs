use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tournament {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub status: TournamentStatus,
    pub rounds: Vec<Round>,
    pub players: Vec<Player>,
    pub tiles_remaining: u8,  // Fichas restantes en la bolsa
    pub master_plays: Vec<MasterPlay>,  // Historial del jugador Master
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TournamentStatus {
    Created,
    InProgress,
    Finished,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: Uuid,
    pub name: String,
    pub total_score: i32,
    pub plays: Vec<PlayerPlay>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Round {
    pub number: u32,
    pub rack: String,  // Las 7 fichas para este turno
    pub board_state: BoardState,
    pub optimal_play: Option<OptimalPlay>,
    pub optimal_revealed: bool,  // Si la jugada óptima ha sido revelada
    pub status: RoundStatus,
    pub rack_rejected: bool,  // Si el atril fue rechazado por no cumplir requisitos
    pub rejection_reason: Option<String>,
    pub timer_started: Option<DateTime<Utc>>,  // Cuando se inició el timer de 3 minutos
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RoundStatus {
    Pending,
    Active,
    Completed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardState {
    pub tiles: Vec<String>,  // 225 tiles (15x15)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimalPlay {
    pub word: String,
    pub position: Position,
    pub score: i32,
    pub tiles_used: Vec<String>,
    #[serde(skip)]
    pub play_bytes: Option<Vec<u8>>, // Store the Play's word array for later formatting
    #[serde(default)]
    pub blank_positions: Vec<bool>, // Track which positions used blanks
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub row: u8,
    pub col: u8,
    pub down: bool,  // true = vertical, false = horizontal
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerPlay {
    pub round_number: u32,
    pub word: String,
    pub position: Position,
    pub score: i32,
    pub percentage_of_optimal: f32,
    pub submitted_at: DateTime<Utc>,  // Timestamp de cuando se envió la jugada
    pub cumulative_score: i32,  // Puntuación acumulada hasta esta ronda
    pub difference_from_optimal: i32,  // Diferencia con la jugada óptima
    pub cumulative_difference: i32,  // Diferencia acumulada
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasterPlay {
    pub round_number: u32,
    pub word: String,
    pub position: Position,
    pub score: i32,
    pub cumulative_score: i32,
}

// API Request/Response types
#[derive(Debug, Deserialize)]
pub struct CreateTournamentRequest {
    pub name: String,
    pub player_names: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateTournamentResponse {
    pub tournament: Tournament,
    pub player_url: String,
}

#[derive(Debug, Deserialize)]
pub struct LoadDictionaryRequest {
    pub kwg_path: String,
    pub klv_path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitPlayRequest {
    pub tournament_id: Uuid,
    pub player_id: Uuid,
    pub round_number: u32,
    pub word: String,
    pub position: Position,
}

#[derive(Debug, Deserialize)]
pub struct StartManualRoundRequest {
    pub rack: String,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(msg: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(msg),
        }
    }
}

// Response for play submission (without revealing percentage)
#[derive(Debug, Serialize, Deserialize)]
pub struct PlaySubmissionResponse {
    pub success: bool,
    pub message: String,
}

// Round feedback - only sent after optimal_revealed = true
#[derive(Debug, Serialize, Deserialize)]
pub struct RoundFeedback {
    pub round_number: u32,
    pub submitted: bool,
    pub word: Option<String>,
    pub position: Option<Position>,
    pub score: i32,
    pub percentage_of_optimal: f32,
    pub optimal_score: i32,
    pub feedback_message: String,
    pub late_submission: bool,
}

// Log structures for detailed player performance
#[derive(Debug, Serialize, Deserialize)]
pub struct PlayerLog {
    pub player_name: String,
    pub entries: Vec<PlayerLogEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlayerLogEntry {
    pub round_number: u32,
    pub rack: String,
    pub player_coord: String,
    pub player_word: String,
    pub player_score: i32,
    pub player_cumulative: i32,
    pub percentage: f32,
    pub cumulative_percentage: f32,  // Porcentaje acumulado
    pub difference: i32,
    pub cumulative_difference: i32,
    pub master_coord: String,
    pub master_word: String,
    pub master_score: i32,
    pub master_cumulative: i32,
}