use actix_cors::Cors;
use actix_files as fs;
use actix_web::{middleware, web, App, HttpServer};
use std::sync::Arc;
use tokio::sync::RwLock;

mod models;
mod routes;
mod tournament_manager;
mod wolges_engine;

use tournament_manager::TournamentManager;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    log::info!("Starting Spanish Scrabble Duplicate Tournament Server...");

    // Initialize tournament manager
    let tournament_manager = Arc::new(RwLock::new(TournamentManager::new()));

    // Start HTTP server
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header();

        App::new()
            .app_data(web::Data::new(tournament_manager.clone()))
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .service(routes::health_check)
            .service(routes::test_validate_word)
            .service(routes::load_dictionary)
            .service(routes::create_tournament)
            .service(routes::get_tournament)
            .service(routes::start_round)
            .service(routes::start_manual_round)
            .service(routes::submit_play)
            .service(routes::get_optimal_play)
            .service(routes::get_leaderboard)
            .service(routes::reject_rack)
            .service(routes::reveal_optimal_play)
            .service(routes::place_optimal_play)
            .service(routes::get_bag_tiles)
            .service(routes::undo_last_round)
            .service(routes::ws_tournament_updates)
            .service(fs::Files::new("/", ".")
                .index_file("index.html"))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
