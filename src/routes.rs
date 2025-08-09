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

#[post("/dictionary/load")]
pub async fn load_dictionary(
    manager: TournamentManagerData,
    req: web::Json<LoadDictionaryRequest>,
) -> HttpResponse {
    let mut manager = manager.write().await;
    
    match manager.load_dictionary(&req.kwg_path, req.klv_path.as_deref()) {
        Ok(_) => HttpResponse::Ok().json(ApiResponse::success("Dictionary loaded successfully")),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<()>::error(e)),
    }
}

#[post("/tournament/create")]
pub async fn create_tournament(
    manager: TournamentManagerData,
    req: web::Json<CreateTournamentRequest>,
) -> HttpResponse {
    let mut manager = manager.write().await;
    
    match manager.create_tournament(req.name.clone(), req.player_names.clone()) {
        Ok(tournament) => HttpResponse::Ok().json(ApiResponse::success(tournament)),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<Tournament>::error(e)),
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
    let mut manager = manager.write().await;
    let tournament_id = path.into_inner();
    
    match manager.start_new_round(&tournament_id) {
        Ok(round) => HttpResponse::Ok().json(ApiResponse::success(round)),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse::<Round>::error(e)),
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