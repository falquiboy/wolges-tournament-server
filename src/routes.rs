use actix_web::{get, post, put, web, HttpResponse, HttpRequest};
use actix_ws;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::models::*;
use crate::tournament_manager::TournamentManager;

type TournamentManagerData = web::Data<Arc<RwLock<TournamentManager>>>;

#[get("/health")]
pub async fn health_check() -> HttpResponse {
    HttpResponse::Ok().json(ApiResponse::success("Server is running"))
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
            HttpResponse::Ok().json(ApiResponse::success(tournament))
        },
        Err(e) => {
            eprintln!("Failed to create tournament: {}", e);
            HttpResponse::BadRequest().json(ApiResponse::<Tournament>::error(e))
        }
    }
}

#[get("/tournament/{id}")]
pub async fn get_tournament(
    manager: TournamentManagerData,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let manager = manager.read().await;
    
    match manager.get_tournament(&path.into_inner()) {
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
        Ok(round) => HttpResponse::Ok().json(ApiResponse::success(round)),
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
        Ok(round) => HttpResponse::Ok().json(ApiResponse::success(round)),
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
        Ok(play) => HttpResponse::Ok().json(ApiResponse::success(play)),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<PlayerPlay>::error(e)),
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
            // Guardar sesión del jugador
            if let Err(e) = PersistenceManager::log_player_action(
                &body.tournament_id.to_string(),
                &player_id.to_string(),
                &format!("Player enrolled: {} from IP: {}", body.name, player_session.ip_address)
            ) {
                eprintln!("Error logging player action: {}", e);
            }
            
            HttpResponse::Ok().json(ApiResponse::success(serde_json::json!({
                "player_id": player_id,
                "tournament": tournament
            })))
        }
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<()>::error(e)),
    }
}