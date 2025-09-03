use actix_web::{get, post, web, HttpResponse};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::persistence_mode::{PersistenceConfig, PersistenceMode};

#[derive(Serialize)]
struct PersistenceModeResponse {
    current_mode: PersistenceMode,
    cloud_available: bool,
    modes: Vec<ModeInfo>,
}

#[derive(Serialize)]
struct ModeInfo {
    mode: PersistenceMode,
    name: &'static str,
    description: &'static str,
    recommended_when: &'static str,
}

#[derive(Deserialize)]
struct SetModeRequest {
    mode: PersistenceMode,
}

#[get("/persistence/mode")]
pub async fn get_persistence_mode(
    config: web::Data<Arc<PersistenceConfig>>,
) -> HttpResponse {
    let current_mode = config.get_mode().await;
    let cloud_available = config.is_cloud_available().await;
    
    let modes = vec![
        ModeInfo {
            mode: PersistenceMode::LocalOnly,
            name: "Solo Local",
            description: "Guarda todo localmente en archivos JSON",
            recommended_when: "Sin conexión a internet o pruebas rápidas",
        },
        ModeInfo {
            mode: PersistenceMode::CloudOnly,
            name: "Solo Nube",
            description: "Guarda todo en Supabase/PostgreSQL",
            recommended_when: "Múltiples dispositivos necesitan acceso en tiempo real",
        },
        ModeInfo {
            mode: PersistenceMode::DualLocalFirst,
            name: "Dual - Local Primero",
            description: "Guarda local primero, luego sincroniza con la nube",
            recommended_when: "Máxima resiliencia y velocidad (RECOMENDADO)",
        },
        ModeInfo {
            mode: PersistenceMode::DualCloudFirst,
            name: "Dual - Nube Primero",
            description: "Guarda en la nube primero, local como respaldo",
            recommended_when: "Prioridad en sincronización inmediata",
        },
    ];
    
    HttpResponse::Ok().json(PersistenceModeResponse {
        current_mode,
        cloud_available,
        modes,
    })
}

#[post("/persistence/mode")]
pub async fn set_persistence_mode(
    config: web::Data<Arc<PersistenceConfig>>,
    request: web::Json<SetModeRequest>,
) -> HttpResponse {
    config.set_mode(request.mode).await;
    
    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "new_mode": request.mode,
        "message": format!("Modo de persistencia cambiado a {:?}", request.mode),
    }))
}

#[get("/persistence/status")]
pub async fn get_persistence_status(
    config: web::Data<Arc<PersistenceConfig>>,
) -> HttpResponse {
    let mode = config.get_mode().await;
    let cloud_available = config.is_cloud_available().await;
    let write_local = config.should_write_local().await;
    let write_cloud = config.should_write_cloud().await;
    let priority = config.get_write_priority().await;
    
    HttpResponse::Ok().json(serde_json::json!({
        "mode": mode,
        "cloud_available": cloud_available,
        "writes_to_local": write_local,
        "writes_to_cloud": write_cloud,
        "priority": format!("{:?}", priority),
        "health": if cloud_available || write_local { "healthy" } else { "degraded" },
    }))
}