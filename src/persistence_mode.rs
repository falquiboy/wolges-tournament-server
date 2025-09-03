use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum PersistenceMode {
    /// Solo archivos JSON locales - rápido, sin red
    LocalOnly,
    
    /// Solo Supabase - todo en la nube
    CloudOnly,
    
    /// Ambos con prioridad local - escribe local primero, luego cloud async
    DualLocalFirst,
    
    /// Ambos con prioridad cloud - escribe cloud primero, local como backup
    DualCloudFirst,
}

impl Default for PersistenceMode {
    fn default() -> Self {
        // Por defecto: dual con prioridad local (más resiliente)
        PersistenceMode::DualLocalFirst
    }
}

pub struct PersistenceConfig {
    mode: Arc<RwLock<PersistenceMode>>,
    cloud_available: Arc<RwLock<bool>>,
}

impl PersistenceConfig {
    pub fn new() -> Self {
        Self {
            mode: Arc::new(RwLock::new(PersistenceMode::default())),
            cloud_available: Arc::new(RwLock::new(false)),
        }
    }
    
    pub async fn set_mode(&self, mode: PersistenceMode) {
        let mut current_mode = self.mode.write().await;
        *current_mode = mode;
        log::info!("🔄 Persistence mode changed to: {:?}", mode);
    }
    
    pub async fn get_mode(&self) -> PersistenceMode {
        *self.mode.read().await
    }
    
    pub async fn set_cloud_status(&self, available: bool) {
        let mut status = self.cloud_available.write().await;
        *status = available;
        
        if !available {
            log::warn!("☁️ Cloud persistence unavailable - falling back to local");
            // Auto-switch to LocalOnly if cloud fails
            let current_mode = *self.mode.read().await;
            if current_mode == PersistenceMode::CloudOnly {
                self.set_mode(PersistenceMode::LocalOnly).await;
            }
        } else {
            log::info!("✅ Cloud persistence available");
        }
    }
    
    pub async fn is_cloud_available(&self) -> bool {
        *self.cloud_available.read().await
    }
    
    pub async fn should_write_local(&self) -> bool {
        let mode = self.get_mode().await;
        matches!(mode, PersistenceMode::LocalOnly | PersistenceMode::DualLocalFirst | PersistenceMode::DualCloudFirst)
    }
    
    pub async fn should_write_cloud(&self) -> bool {
        let mode = self.get_mode().await;
        let cloud_available = self.is_cloud_available().await;
        
        cloud_available && matches!(mode, PersistenceMode::CloudOnly | PersistenceMode::DualLocalFirst | PersistenceMode::DualCloudFirst)
    }
    
    pub async fn get_write_priority(&self) -> WritePriority {
        let mode = self.get_mode().await;
        match mode {
            PersistenceMode::LocalOnly => WritePriority::LocalOnly,
            PersistenceMode::CloudOnly => WritePriority::CloudOnly,
            PersistenceMode::DualLocalFirst => WritePriority::LocalThenCloud,
            PersistenceMode::DualCloudFirst => WritePriority::CloudThenLocal,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum WritePriority {
    LocalOnly,
    CloudOnly,
    LocalThenCloud,
    CloudThenLocal,
}