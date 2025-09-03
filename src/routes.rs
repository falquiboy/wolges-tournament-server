use actix_web::{get, post, put, web, HttpResponse, HttpRequest};
use actix_ws;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use chrono::Utc;

use crate::models::*;
use crate::tournament_manager::TournamentManager;
use crate::database::Database;

type TournamentManagerData = web::Data<Arc<RwLock<TournamentManager>>>;

#[get("/health")]
pub async fn health_check() -> HttpResponse {
    HttpResponse::Ok().json(ApiResponse::success("Server is running"))
}

#[get("/db/test")]
pub async fn test_database() -> HttpResponse {
    match Database::new().await {
        Ok(db) => {
            match db.test_connection().await {
                Ok(message) => HttpResponse::Ok().json(ApiResponse::success(&message)),
                Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!("Database connection failed: {}", e))),
            }
        },
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!("Database initialization failed: {}", e))),
    }
}

#[post("/db/test/tournament")]
pub async fn test_create_tournament_db(
    web::Json(req): web::Json<CreateTournamentRequest>,
) -> HttpResponse {
    match Database::new().await {
        Ok(db) => {
            match db.test_create_tournament(req.name, req.player_names).await {
                Ok(message) => HttpResponse::Ok().json(ApiResponse::success(&message)),
                Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!("Failed to create tournament: {}", e))),
            }
        },
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!("Database initialization failed: {}", e))),
    }
}

#[get("/db/tournaments")]  
pub async fn list_tournaments_db() -> HttpResponse {
    use sqlx::{PgPool, Row};
    
    // Direct connection to avoid prepared statement caching issues
    dotenv::dotenv().ok();
    let database_url = match std::env::var("DATABASE_URL") {
        Ok(url) => url,
        Err(_) => return HttpResponse::InternalServerError().json(
            ApiResponse::<String>::error("DATABASE_URL not found".to_string())
        ),
    };
    
    match PgPool::connect(&database_url).await {
        Ok(pool) => {
            let query_result = sqlx::query("SELECT id, name, created_at, status FROM tournaments ORDER BY created_at DESC LIMIT 10")
                .fetch_all(&pool)
                .await;
                
            match query_result {
                Ok(rows) => {
                    let mut result = String::from("Tournaments in database:\n");
                    for row in rows {
                        let id: uuid::Uuid = row.get("id");
                        let name: String = row.get("name");
                        let created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
                        let status: String = row.get("status");
                        result.push_str(&format!("- {} ({}): {} - {}\n", name, id, status, created_at.format("%Y-%m-%d %H:%M")));
                    }
                    HttpResponse::Ok().json(ApiResponse::success(&result))
                },
                Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!("Query failed: {}", e))),
            }
        },
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!("Connection failed: {}", e))),
    }
}

#[post("/db/test/enroll")]
pub async fn test_enroll_player_db(
    web::Json(req): web::Json<EnrollPlayerRequest>,
) -> HttpResponse {
    match Database::new().await {
        Ok(db) => {
            let player_id = Uuid::new_v4();
            let mock_ip = "127.0.0.1".to_string();
            let mock_user_agent = "Test Client".to_string();
            let hardware_id = req.hardware_id.unwrap_or_else(|| "test-hardware".to_string());
            
            match db.enroll_player(req.tournament_id, player_id, req.name, mock_ip, mock_user_agent, hardware_id).await {
                Ok(message) => HttpResponse::Ok().json(ApiResponse::success(&message)),
                Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!("Failed to enroll player: {}", e))),
            }
        },
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!("Database initialization failed: {}", e))),
    }
}

#[post("/db/test/round")]
pub async fn test_create_round_db(
    web::Json(req): web::Json<serde_json::Value>,
) -> HttpResponse {
    let tournament_id: Uuid = match req.get("tournament_id").and_then(|v| v.as_str()).and_then(|s| s.parse().ok()) {
        Some(id) => id,
        None => return HttpResponse::BadRequest().json(ApiResponse::<String>::error("Invalid tournament_id".to_string())),
    };
    
    let round_number: i32 = req.get("round_number").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
    let rack = req.get("rack").and_then(|v| v.as_str()).unwrap_or("ABCDEFG").to_string();
    let board_data = "{\"tiles\":[]}".to_string(); // Mock board state
    
    match Database::new().await {
        Ok(db) => {
            match db.create_round(tournament_id, round_number, rack, board_data).await {
                Ok(message) => HttpResponse::Ok().json(ApiResponse::success(&message)),
                Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!("Failed to create round: {}", e))),
            }
        },
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<String>::error(format!("Database initialization failed: {}", e))),
    }
}

#[get("/test/validate/{word}")]
pub async fn test_validate_word(
    manager: TournamentManagerData,
    path: web::Path<String>,
) -> HttpResponse {
    let manager = manager.read().await;
    let word = path.into_inner();
    
    match manager.validate_word(&word) {
        Ok(is_valid) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "word": word,
            "is_valid": is_valid
        }))),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<()>::error(e))
    }
}

#[post("/dictionary/load")]
pub async fn load_dictionary(
    manager: TournamentManagerData,
    req: web::Json<LoadDictionaryRequest>,
) -> HttpResponse {
    let mut manager = manager.write().await;
    
    eprintln!("Loading dictionary from: {}", req.kwg_path);
    
    match manager.load_dictionary(&req.kwg_path, req.klv_path.as_deref()) {
        Ok(_) => {
            eprintln!("Dictionary loaded successfully");
            HttpResponse::Ok().json(ApiResponse::success("Dictionary loaded successfully"))
        },
        Err(e) => {
            eprintln!("Failed to load dictionary: {}", e);
            HttpResponse::BadRequest().json(ApiResponse::<()>::error(e))
        }
    }
}

#[post("/tournament/create")]
pub async fn create_tournament(
    manager: TournamentManagerData,
    req: web::Json<CreateTournamentRequest>,
) -> HttpResponse {
    let mut manager = manager.write().await;
    
    eprintln!("Creating tournament: {} with players: {:?}", req.name, req.player_names);
    
    match manager.create_tournament(req.name.clone(), req.player_names.clone()) {
        Ok(tournament) => {
            eprintln!("Tournament created successfully with ID: {}", tournament.id);
            
            // También guardar en Supabase
            if let Ok(db) = Database::new().await {
                if let Err(e) = db.create_tournament_with_id(
                    tournament.id,
                    tournament.name.clone(), 
                    tournament.players.iter().map(|p| p.name.clone()).collect(),
                    tournament.created_at
                ).await {
                    eprintln!("Warning: Failed to save tournament to Supabase: {}", e);
                }
            }
            
            let player_url = manager.get_tournament_url(&tournament.id);
            let response = CreateTournamentResponse {
                tournament: tournament.clone(),
                player_url: player_url.clone(),
            };
            eprintln!("Creating response with player_url: {}", player_url);
            eprintln!("Response structure: tournament.id={}, player_url={}", response.tournament.id, response.player_url);
            HttpResponse::Ok().json(ApiResponse::success(response))
        },
        Err(e) => {
            eprintln!("Failed to create tournament: {}", e);
            HttpResponse::BadRequest().json(ApiResponse::<CreateTournamentResponse>::error(e))
        }
    }
}

#[get("/tournament/{id}")]
pub async fn get_tournament(
    manager: TournamentManagerData,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let tournament_id = path.into_inner();
    
    // Try to get tournament from Supabase first
    if let Ok(db) = Database::new().await {
        match db.get_tournament(tournament_id).await {
            Ok(Some(tournament_json)) => {
                return HttpResponse::Ok().json(ApiResponse::success(&tournament_json));
            },
            Ok(None) => {
                // Tournament not found in Supabase, try in-memory
            },
            Err(e) => {
                eprintln!("Warning: Failed to get tournament from Supabase: {}", e);
                // Fall back to in-memory
            }
        }
    }
    
    // Fall back to in-memory version
    let manager = manager.read().await;
    match manager.get_tournament(&tournament_id) {
        Some(tournament) => HttpResponse::Ok().json(ApiResponse::success(tournament)),
        None => HttpResponse::NotFound().json(
            ApiResponse::<Tournament>::error("Tournament not found".to_string())
        ),
    }
}

#[post("/tournament/{id}/round/start")]
pub async fn start_round(
    manager: TournamentManagerData,
    path: web::Path<Uuid>,
) -> HttpResponse {
    eprintln!("=== START_ROUND ENDPOINT CALLED ===");
    let mut manager = manager.write().await;
    let tournament_id = path.into_inner();
    
    eprintln!("start_round called for tournament {}", tournament_id);
    eprintln!("Engine loaded: {}", manager.engine.is_some());
    eprintln!("Tournament exists: {}", manager.get_tournament(&tournament_id).is_some());
    
    // Listar todos los torneos en memoria
    eprintln!("All tournament IDs in memory:");
    for (id, tournament) in manager.tournaments.iter() {
        eprintln!("  - {} ({})", id, tournament.name);
    }
    
    match manager.start_new_round(&tournament_id) {
        Ok(round) => {
            // También guardar en Supabase
            if let Ok(db) = Database::new().await {
                let board_json = serde_json::to_string(&round.board_state).unwrap_or_else(|_| "{}".to_string());
                if let Err(e) = db.create_round(
                    tournament_id,
                    round.number as i32,
                    round.rack.clone(),
                    board_json
                ).await {
                    eprintln!("Warning: Failed to save round to Supabase: {}", e);
                }
            }
            
            HttpResponse::Ok().json(ApiResponse::success(round))
        },
        Err(e) => {
            eprintln!("start_round error: {}", e);
            HttpResponse::BadRequest().json(ApiResponse::<Round>::error(e))
        }
    }
}

#[post("/tournament/{id}/round/start_manual")]
pub async fn start_manual_round(
    manager: TournamentManagerData,
    path: web::Path<Uuid>,
    req: web::Json<StartManualRoundRequest>,
) -> HttpResponse {
    let mut manager = manager.write().await;
    let tournament_id = path.into_inner();
    
    match manager.start_new_round_manual(&tournament_id, &req.rack) {
        Ok(round) => {
            // También guardar en Supabase
            if let Ok(db) = Database::new().await {
                let board_json = serde_json::to_string(&round.board_state).unwrap_or_else(|_| "{}".to_string());
                if let Err(e) = db.create_round(
                    tournament_id,
                    round.number as i32,
                    round.rack.clone(),
                    board_json
                ).await {
                    eprintln!("Warning: Failed to save manual round to Supabase: {}", e);
                }
            }
            
            HttpResponse::Ok().json(ApiResponse::success(round))
        },
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<Round>::error(e)),
    }
}

#[put("/tournament/{id}/round/{round}/update_rack")]
pub async fn update_current_round_rack(
    manager: TournamentManagerData,
    path: web::Path<(Uuid, u32)>,
    req: web::Json<StartManualRoundRequest>,
) -> HttpResponse {
    let mut manager = manager.write().await;
    let (tournament_id, round_number) = path.into_inner();
    
    match manager.update_round_rack(&tournament_id, round_number, &req.rack) {
        Ok(round) => HttpResponse::Ok().json(ApiResponse::success(round)),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<Round>::error(e)),
    }
}

#[post("/tournament/play/submit")]
pub async fn submit_play(
    manager: TournamentManagerData,
    async_queue: web::Data<Arc<crate::async_queue::AsyncQueue>>,
    local_cache: web::Data<Arc<crate::local_cache::LocalCache>>,
    req: web::Json<SubmitPlayRequest>,
) -> HttpResponse {
    let mut manager = manager.write().await;
    
    match manager.submit_player_play(
        &req.tournament_id,
        &req.player_id,
        req.round_number,
        req.word.clone(),
        req.position.clone(),
    ) {
        Ok(response) => {
            // Guardar en cache local primero (respuesta inmediata)
            if let Some(tournament) = manager.tournaments.get(&req.tournament_id) {
                if let Some(player) = tournament.players.iter().find(|p| p.id == req.player_id) {
                    if let Some(play) = player.plays.iter().find(|p| p.round_number == req.round_number) {
                        let play_data = crate::async_queue::PlayData {
                            tournament_id: req.tournament_id,
                            player_id: req.player_id,
                            round_number: req.round_number as i32,
                            word: play.word.clone(),
                            position_row: req.position.row as i32,
                            position_col: req.position.col as i32,
                            position_down: req.position.down,
                            score: play.score,
                            percentage_of_optimal: play.percentage_of_optimal,
                            cumulative_score: play.cumulative_score,
                            difference_from_optimal: play.difference_from_optimal,
                            cumulative_difference: play.cumulative_difference,
                        };
                        
                        // Guardar en cache local
                        if let Err(e) = local_cache.store_play(play_data.clone()).await {
                            log::warn!("Failed to cache play locally: {}", e);
                        }
                        
                        // Enviar a cola asíncrona para Supabase (no bloquea)
                        if let Err(e) = async_queue.submit_play(play_data).await {
                            log::error!("Failed to queue play for Supabase: {}", e);
                            // El juego continúa aunque falle el envío a Supabase
                        } else {
                            log::info!("Play queued for async Supabase sync: player {} round {}", 
                                     req.player_id, req.round_number);
                        }
                    }
                }
            }
            
            HttpResponse::Ok().json(ApiResponse::success(response))
        },
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<PlaySubmissionResponse>::error(e)),
    }
}

#[get("/tournament/{id}/round/{round}/optimal")]
pub async fn get_optimal_play(
    manager: TournamentManagerData,
    path: web::Path<(Uuid, u32)>,
) -> HttpResponse {
    let mut manager = manager.write().await;
    let (tournament_id, round_number) = path.into_inner();
    
    match manager.calculate_optimal_play(&tournament_id, round_number) {
        Ok(optimal) => HttpResponse::Ok().json(ApiResponse::success(optimal)),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<OptimalPlay>::error(e)),
    }
}

#[get("/tournament/{id}/leaderboard")]
pub async fn get_leaderboard(
    manager: TournamentManagerData,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let manager = manager.read().await;
    
    match manager.get_leaderboard(&path.into_inner()) {
        Ok(players) => HttpResponse::Ok().json(ApiResponse::success(players)),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<Vec<Player>>::error(e)),
    }
}

#[get("/tournament/{id}/player/{player_id}/log")]
pub async fn get_player_log(
    manager: TournamentManagerData,
    path: web::Path<(Uuid, Uuid)>,
) -> HttpResponse {
    let manager = manager.read().await;
    let (tournament_id, player_id) = path.into_inner();
    
    match manager.get_player_log(&tournament_id, &player_id) {
        Ok(log) => HttpResponse::Ok().json(ApiResponse::success(log)),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<PlayerLog>::error(e)),
    }
}

#[put("/tournament/{id}/round/{round}/reject_rack")]
pub async fn reject_rack(
    manager: TournamentManagerData,
    path: web::Path<(Uuid, u32)>,
) -> HttpResponse {
    let mut manager = manager.write().await;
    let (tournament_id, round_number) = path.into_inner();
    
    match manager.reject_rack_and_regenerate(&tournament_id, round_number) {
        Ok(round) => HttpResponse::Ok().json(ApiResponse::success(round)),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<Round>::error(e)),
    }
}

#[put("/tournament/{id}/round/{round}/start_timer")]
pub async fn start_round_timer(
    manager: TournamentManagerData,
    path: web::Path<(Uuid, u32)>,
) -> HttpResponse {
    let mut manager = manager.write().await;
    let (tournament_id, round_number) = path.into_inner();
    
    match manager.start_round_timer(&tournament_id, round_number) {
        Ok(_) => HttpResponse::Ok().json(ApiResponse::success("Timer started")),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<()>::error(e)),
    }
}

#[put("/tournament/{id}/round/{round}/reveal_optimal")]
pub async fn reveal_optimal_play(
    manager: TournamentManagerData,
    path: web::Path<(Uuid, u32)>,
) -> HttpResponse {
    let mut manager = manager.write().await;
    let (tournament_id, round_number) = path.into_inner();
    
    match manager.reveal_optimal_play(&tournament_id, round_number) {
        Ok(_) => HttpResponse::Ok().json(ApiResponse::success("Optimal play revealed")),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<()>::error(e)),
    }
}

#[get("/tournament/{id}/round/{round}/player/{player_id}/feedback")]
pub async fn get_round_feedback(
    manager: TournamentManagerData,
    path: web::Path<(Uuid, u32, Uuid)>,
) -> HttpResponse {
    let manager = manager.read().await;
    let (tournament_id, round_number, player_id) = path.into_inner();
    
    match manager.get_round_feedback(&tournament_id, round_number, &player_id) {
        Ok(feedback) => HttpResponse::Ok().json(ApiResponse::success(feedback)),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<RoundFeedback>::error(e)),
    }
}

#[put("/tournament/{id}/round/{round}/place_optimal")]
pub async fn place_optimal_play(
    manager: TournamentManagerData,
    path: web::Path<(Uuid, u32)>,
) -> HttpResponse {
    let mut manager = manager.write().await;
    let (tournament_id, round_number) = path.into_inner();
    
    match manager.place_optimal_play(&tournament_id, round_number) {
        Ok(_) => HttpResponse::Ok().json(ApiResponse::success("Optimal play placed")),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<()>::error(e)),
    }
}

#[put("/tournament/{id}/finish")]
pub async fn finish_tournament_manually(
    manager: TournamentManagerData,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let mut manager = manager.write().await;
    let tournament_id = path.into_inner();
    
    match manager.finish_tournament_manually(&tournament_id) {
        Ok(_) => HttpResponse::Ok().json(ApiResponse::success("Tournament finished manually")),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<()>::error(e)),
    }
}

#[get("/tournament/{id}/bag_tiles")]
pub async fn get_bag_tiles(
    manager: TournamentManagerData,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let manager = manager.read().await;
    
    match manager.get_bag_tiles(&path.into_inner()) {
        Ok(tiles) => HttpResponse::Ok().json(ApiResponse::success(tiles)),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<Vec<(String, bool)>>::error(e)),
    }
}

#[get("/tournament/{id}/check_end")]
pub async fn check_game_end(
    manager: TournamentManagerData,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let manager = manager.read().await;
    
    match manager.check_game_end_condition(&path.into_inner()) {
        Ok((is_ended, reason)) => HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
            "game_ended": is_ended,
            "reason": reason
        }))),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<()>::error(e)),
    }
}

#[put("/tournament/{id}/undo")]
pub async fn undo_last_round(
    manager: TournamentManagerData,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let mut manager = manager.write().await;
    let tournament_id = path.into_inner();
    
    match manager.undo_last_round(&tournament_id) {
        Ok(_) => HttpResponse::Ok().json(ApiResponse::success("Last round undone")),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<()>::error(e)),
    }
}

#[get("/ws/tournament/{id}")]
pub async fn ws_tournament_updates(
    req: HttpRequest,
    stream: web::Payload,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, actix_web::Error> {
    let (res, session, _msg_stream) = actix_ws::handle(&req, stream)?;
    
    // TODO: Implement WebSocket updates for real-time tournament status
    
    Ok(res)
}

// Nuevos endpoints para persistencia

#[get("/tournaments")]
pub async fn list_tournaments() -> HttpResponse {
    use crate::persistence::PersistenceManager;
    
    match PersistenceManager::list_tournaments() {
        Ok(tournaments) => HttpResponse::Ok().json(ApiResponse::success(tournaments)),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse::<()>::error(format!("Error listing tournaments: {}", e))),
    }
}

#[post("/tournament/{id}/load")]
pub async fn load_tournament(
    manager: TournamentManagerData,
    path: web::Path<String>,
) -> HttpResponse {
    use crate::persistence::PersistenceManager;
    
    let tournament_id = path.into_inner();
    
    match PersistenceManager::load_tournament(&tournament_id) {
        Ok((tournament, _player_sessions)) => {
            let mut manager = manager.write().await;
            
            // Cargar el diccionario si no está cargado
            if manager.engine.is_none() {
                // Cargar el diccionario por defecto
                let kwg_path = "FISE2016.kwg";
                if let Err(e) = manager.load_dictionary(kwg_path, None) {
                    return HttpResponse::InternalServerError()
                        .json(ApiResponse::<()>::error(format!("Error loading dictionary: {}", e)));
                }
            }
            
            // Restaurar el torneo en el manager
            manager.restore_tournament(tournament.clone());
            
            HttpResponse::Ok().json(ApiResponse::success(tournament))
        }
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<()>::error(format!("Error loading tournament: {}", e))),
    }
}

// Endpoint para capturar información del jugador
#[derive(serde::Deserialize)]
pub struct EnrollPlayerRequest {
    pub name: String,
    pub tournament_id: Uuid,
    pub hardware_id: Option<String>,
}

#[post("/tournament/enroll")]
pub async fn enroll_player(
    manager: TournamentManagerData,
    body: web::Json<EnrollPlayerRequest>,
    req: HttpRequest,
) -> HttpResponse {
    use crate::persistence::{PlayerSession, PersistenceManager};
    
    let mut manager = manager.write().await;
    let player_id = Uuid::new_v4();
    
    // Capturar IP y User-Agent
    let ip_address = req.peer_addr()
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|| "Unknown".to_string());
    
    let user_agent = req.headers()
        .get("User-Agent")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("Unknown")
        .to_string();
    
    // Crear sesión del jugador
    let player_session = PlayerSession {
        player_id: player_id.to_string(),
        name: body.name.clone(),
        ip_address,
        user_agent,
        hardware_id: body.hardware_id.clone(),
        enrolled_at: chrono::Utc::now(),
        last_seen: chrono::Utc::now(),
    };
    
    // Agregar jugador al torneo
    match manager.add_player(&body.tournament_id, &body.name, player_id) {
        Ok(tournament) => {
            // Guardar sesión del jugador (JSON)
            if let Err(e) = PersistenceManager::log_player_action(
                &body.tournament_id.to_string(),
                &player_id.to_string(),
                &format!("Player enrolled: {} from IP: {}", body.name, player_session.ip_address)
            ) {
                eprintln!("Error logging player action: {}", e);
            }
            
            // También guardar en Supabase
            if let Ok(db) = Database::new().await {
                if let Err(e) = db.enroll_player(
                    body.tournament_id, 
                    player_id, 
                    body.name.clone(), 
                    player_session.ip_address.clone(), 
                    player_session.user_agent.clone(), 
                    player_session.hardware_id.unwrap_or_else(|| "unknown".to_string())
                ).await {
                    eprintln!("Warning: Failed to save player to Supabase: {}", e);
                }
            }
            
            HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
                "player_id": player_id,
                "tournament": tournament
            })))
        }
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<()>::error(e)),
    }
}

#[get("/api/metrics")]
pub async fn get_queue_metrics(
    async_queue: web::Data<Arc<crate::async_queue::AsyncQueue>>,
) -> HttpResponse {
    let metrics = async_queue.get_metrics().await;
    
    HttpResponse::Ok().json(serde_json::json!({
        "queue_metrics": {
            "total_submitted": metrics.total_submitted,
            "total_processed": metrics.total_processed,
            "total_failed": metrics.total_failed,
            "avg_latency_ms": metrics.avg_latency_ms,
            "max_latency_ms": metrics.max_latency_ms,
            "queue_size": metrics.queue_size,
            "last_error": metrics.last_error,
        }
    }))
}

#[get("/api/health")]
pub async fn system_health_check(
    async_queue: web::Data<Arc<crate::async_queue::AsyncQueue>>,
    local_cache: web::Data<Arc<crate::local_cache::LocalCache>>,
) -> HttpResponse {
    let queue_healthy = async_queue.health_check().await;
    let (cache_total, cache_synced) = local_cache.get_stats().await;
    
    let overall_healthy = queue_healthy && (cache_total < 9000); // Cache not too full
    
    HttpResponse::Ok().json(serde_json::json!({
        "healthy": overall_healthy,
        "components": {
            "async_queue": queue_healthy,
            "cache": {
                "total_entries": cache_total,
                "synced_entries": cache_synced,
                "capacity_used": format!("{:.1}%", (cache_total as f64 / 10000.0) * 100.0),
            }
        },
        "timestamp": Utc::now(),
    }))
}

#[get("/api/cache/stats")]
pub async fn get_cache_stats(
    local_cache: web::Data<Arc<crate::local_cache::LocalCache>>,
) -> HttpResponse {
    let (total, synced) = local_cache.get_stats().await;
    let unsynced = local_cache.get_unsynced_plays().await;
    
    HttpResponse::Ok().json(serde_json::json!({
        "total_entries": total,
        "synced_entries": synced,
        "unsynced_entries": unsynced.len(),
        "unsynced_plays": unsynced.iter().map(|p| {
            serde_json::json!({
                "tournament_id": p.play_data.tournament_id,
                "player_id": p.play_data.player_id,
                "round": p.play_data.round_number,
                "score": p.play_data.score,
                "timestamp": p.timestamp,
            })
        }).collect::<Vec<_>>(),
    }))
}

#[post("/api/cache/sync")]
pub async fn sync_cache_to_database(
    local_cache: web::Data<Arc<crate::local_cache::LocalCache>>,
    async_queue: web::Data<Arc<crate::async_queue::AsyncQueue>>,
) -> HttpResponse {
    let unsynced = local_cache.get_unsynced_plays().await;
    let mut synced_count = 0;
    
    for play in unsynced {
        if let Ok(_) = async_queue.submit_play(play.play_data.clone()).await {
            local_cache.mark_as_synced(
                play.play_data.tournament_id,
                play.play_data.player_id,
                play.play_data.round_number,
            ).await;
            synced_count += 1;
        }
    }
    
    HttpResponse::Ok().json(serde_json::json!({
        "synced": synced_count,
        "message": format!("Synced {} plays to database", synced_count),
    }))
}

#[post("/api/cache/clear")]
pub async fn clear_synced_cache(
    local_cache: web::Data<Arc<crate::local_cache::LocalCache>>,
) -> HttpResponse {
    local_cache.clear_synced().await;
    
    HttpResponse::Ok().json(serde_json::json!({
        "message": "Cleared all synced entries from cache",
    }))
}
// ==================== PERSISTENCE MODE ROUTES ====================

#[get("/api/persistence/mode")]
pub async fn get_persistence_mode(
    config: web::Data<Arc<crate::persistence_mode::PersistenceConfig>>,
) -> HttpResponse {
    let current_mode = config.get_mode().await;
    let cloud_available = config.is_cloud_available().await;
    
    let modes = vec![
        serde_json::json!({
            "value": "LocalOnly",
            "name": "Solo Local",
            "description": "Guarda todo localmente en archivos JSON",
            "recommended_when": "Sin conexión a internet o pruebas rápidas",
        }),
        serde_json::json!({
            "value": "CloudOnly",
            "name": "Solo Nube",
            "description": "Guarda todo en Supabase/PostgreSQL",
            "recommended_when": "Múltiples dispositivos necesitan acceso en tiempo real",
        }),
        serde_json::json!({
            "value": "DualLocalFirst",
            "name": "Dual - Local Primero",
            "description": "Guarda local primero, luego sincroniza con la nube",
            "recommended_when": "Máxima resiliencia y velocidad (RECOMENDADO)",
        }),
        serde_json::json!({
            "value": "DualCloudFirst",
            "name": "Dual - Nube Primero",
            "description": "Guarda en la nube primero, local como respaldo",
            "recommended_when": "Prioridad en sincronización inmediata",
        }),
    ];
    
    HttpResponse::Ok().json(serde_json::json!({
        "current_mode": current_mode,
        "cloud_available": cloud_available,
        "modes": modes,
    }))
}

#[post("/api/persistence/mode")]
pub async fn set_persistence_mode(
    config: web::Data<Arc<crate::persistence_mode::PersistenceConfig>>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    if let Some(mode_str) = body.get("mode").and_then(|m| m.as_str()) {
        let mode = match mode_str {
            "LocalOnly" => crate::persistence_mode::PersistenceMode::LocalOnly,
            "CloudOnly" => crate::persistence_mode::PersistenceMode::CloudOnly,
            "DualLocalFirst" => crate::persistence_mode::PersistenceMode::DualLocalFirst,
            "DualCloudFirst" => crate::persistence_mode::PersistenceMode::DualCloudFirst,
            _ => {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "Invalid persistence mode"
                }));
            }
        };
        
        config.set_mode(mode).await;
        
        HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "new_mode": mode_str,
            "message": format!("Modo de persistencia cambiado a {}", mode_str),
        }))
    } else {
        HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Mode field is required"
        }))
    }
}
