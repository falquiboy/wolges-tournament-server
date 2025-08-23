use actix_cors::Cors;
use actix_files as fs;
use actix_web::{middleware, web, App, HttpServer};
use std::sync::Arc;
use tokio::sync::RwLock;
use rustls::{Certificate, PrivateKey, ServerConfig};
use rustls_pemfile::{certs, pkcs8_private_keys};
use std::io::BufReader;
use std::fs::File;
use std::net::UdpSocket;

mod models;
mod routes;
mod tournament_manager;
mod wolges_engine;
mod persistence;

use tournament_manager::TournamentManager;

fn get_local_ip() -> std::io::Result<std::net::IpAddr> {
    let socket = UdpSocket::bind("0.0.0.0:0")?;
    socket.connect("8.8.8.8:80")?;
    let addr = socket.local_addr()?;
    Ok(addr.ip())
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    log::info!("Starting Spanish Scrabble Duplicate Tournament Server...");
    
    // Detect local IP address
    let local_ip = match get_local_ip() {
        Ok(ip) => {
            log::info!("Server accessible at: http://{}:8080", ip);
            ip
        },
        Err(e) => {
            log::warn!("Could not detect local IP: {}. Using localhost.", e);
            "127.0.0.1".parse().unwrap()
        }
    };

    // Using HTTP for mobile testing (previously HTTPS with TLS)

    // Initialize tournament manager
    let mut manager = TournamentManager::new(local_ip);
    
    // Auto-load dictionary on startup
    match manager.load_dictionary("FISE2016_converted.kwg", None) {
        Ok(_) => log::info!("Dictionary FISE2016_converted.kwg loaded successfully on startup"),
        Err(e) => log::error!("Failed to load dictionary on startup: {}", e),
    }
    
    let tournament_manager = Arc::new(RwLock::new(manager));

    // Start HTTPS server
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
            .service(routes::update_current_round_rack)
            .service(routes::submit_play)
            .service(routes::get_optimal_play)
            .service(routes::get_round_feedback)
            .service(routes::get_leaderboard)
            .service(routes::get_player_log)
            .service(routes::reject_rack)
            .service(routes::start_round_timer)
            .service(routes::reveal_optimal_play)
            .service(routes::place_optimal_play)
            .service(routes::finish_tournament_manually)
            .service(routes::get_bag_tiles)
            .service(routes::check_game_end)
            .service(routes::undo_last_round)
            .service(routes::ws_tournament_updates)
            .service(routes::list_tournaments)
            .service(routes::load_tournament)
            .service(routes::enroll_player)
            .service(fs::Files::new("/", ".")
                .index_file("index.html"))
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}

fn load_rustls_config() -> rustls::ServerConfig {
    // Load certificate
    let cert_file = &mut BufReader::new(File::open("certs/cert.pem").unwrap());
    let cert_chain = certs(cert_file)
        .unwrap()
        .into_iter()
        .map(Certificate)
        .collect();

    // Load private key
    let key_file = &mut BufReader::new(File::open("certs/key.pem").unwrap());
    let mut keys: Vec<PrivateKey> = pkcs8_private_keys(key_file)
        .unwrap()
        .into_iter()
        .map(PrivateKey)
        .collect();

    if keys.is_empty() {
        eprintln!("Could not locate PKCS 8 private keys.");
        std::process::exit(1);
    }

    let config = ServerConfig::builder()
        .with_safe_defaults()
        .with_no_client_auth()
        .with_single_cert(cert_chain, keys.remove(0))
        .expect("bad certificate/key");
    
    config
}
