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
use local_ip_address::local_ip;

mod models;
mod routes;
mod tournament_manager;
mod wolges_engine;
mod persistence;
mod database;
mod async_queue;
mod local_cache;
mod supabase_poller;
mod persistence_mode;

use tournament_manager::TournamentManager;

fn get_local_ip() -> std::io::Result<std::net::IpAddr> {
    // Método 1: Usar librería especializada
    if let Ok(ip) = local_ip() {
        if !ip.is_loopback() {
            return Ok(ip);
        }
    }
    
    // Método 2: Conectar a servidor externo (método original)
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

    // Initialize database connection (optional for now)
    let database = match database::Database::new().await {
        Ok(db) => {
            log::info!("Database connection established");
            Some(Arc::new(db))
        },
        Err(e) => {
            log::error!("Failed to connect to database: {}", e);
            log::warn!("Running in offline mode - data will not persist to Supabase");
            None
        }
    };
    
    // Initialize async queue and poller only if database is available
    let async_queue = if let Some(ref db) = database {
        Some(Arc::new(async_queue::AsyncQueue::new(db.clone()).await))
    } else {
        None
    };
    
    // Initialize local cache (store up to 10,000 plays)
    let local_cache = Arc::new(local_cache::LocalCache::new(10000));
    
    // Initialize persistence configuration
    let persistence_config = Arc::new(persistence_mode::PersistenceConfig::new());
    
    // Set cloud availability based on database connection
    if database.is_some() {
        persistence_config.set_cloud_status(true).await;
    }
    
    // Initialize tournament manager
    let mut manager = TournamentManager::new(local_ip);
    
    // Auto-load dictionary on startup
    match manager.load_dictionary("FISE2016_converted.kwg", None) {
        Ok(_) => log::info!("Dictionary FISE2016_converted.kwg loaded successfully on startup"),
        Err(e) => log::error!("Failed to load dictionary on startup: {}", e),
    }
    
    let tournament_manager = Arc::new(RwLock::new(manager));
    
    // Iniciar Supabase Poller solo si hay database
    if let Some(ref db) = database {
        let poller = Arc::new(supabase_poller::SupabasePoller::new(
            db.clone(),
            tournament_manager.clone(),
            500, // Poll cada 500ms
        ));
        
        // Spawn el poller en background
        let poller_clone = poller.clone();
        tokio::spawn(async move {
            poller_clone.start_polling().await;
        });
        
        log::info!("🔄 Supabase Poller iniciado - leyendo jugadas cada 500ms");
    } else {
        log::warn!("⚠️ Supabase Poller deshabilitado - modo offline");
    }

    // Start HTTPS server
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header();

        let mut app = App::new()
            .app_data(web::Data::new(tournament_manager.clone()))
            .app_data(web::Data::new(local_cache.clone()))
            .app_data(web::Data::new(persistence_config.clone()));
        
        // Solo agregar database y async_queue si están disponibles
        if let Some(ref db) = database {
            app = app.app_data(web::Data::new(db.clone()));
        }
        if let Some(ref queue) = async_queue {
            app = app.app_data(web::Data::new(queue.clone()));
        }
        
        app
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .service(routes::health_check)
            .service(routes::test_database)
            .service(routes::test_create_tournament_db)
            .service(routes::list_tournaments_db)
            .service(routes::test_enroll_player_db)
            .service(routes::test_create_round_db)
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
            .service(routes::get_queue_metrics)
            .service(routes::system_health_check)
            .service(routes::get_cache_stats)
            .service(routes::sync_cache_to_database)
            .service(routes::clear_synced_cache)
            .service(routes::get_persistence_mode)
            .service(routes::set_persistence_mode)
            .service(fs::Files::new("/", ".")
                .index_file("index.html"))
    })
    .bind(format!("0.0.0.0:{}", std::env::var("PORT").unwrap_or_else(|_| "8080".to_string())))?
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
