use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use log::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedPlay {
    pub play_data: crate::async_queue::PlayData,
    pub timestamp: DateTime<Utc>,
    pub synced: bool,
}

#[derive(Debug, Clone)]
pub struct LocalCache {
    cache: Arc<RwLock<HashMap<String, CachedPlay>>>,
    max_size: usize,
}

impl LocalCache {
    pub fn new(max_size: usize) -> Self {
        LocalCache {
            cache: Arc::new(RwLock::new(HashMap::new())),
            max_size,
        }
    }
    
    pub async fn store_play(&self, play_data: crate::async_queue::PlayData) -> Result<(), String> {
        let key = format!("{}-{}-{}", 
                         play_data.tournament_id, 
                         play_data.player_id, 
                         play_data.round_number);
        
        let cached_play = CachedPlay {
            play_data: play_data.clone(),
            timestamp: Utc::now(),
            synced: false,
        };
        
        let mut cache = self.cache.write().await;
        
        // Check cache size and evict old entries if needed
        if cache.len() >= self.max_size {
            // Evict oldest synced entries first
            let mut synced_keys: Vec<(String, DateTime<Utc>)> = cache.iter()
                .filter(|(_, v)| v.synced)
                .map(|(k, v)| (k.clone(), v.timestamp))
                .collect();
            
            if !synced_keys.is_empty() {
                synced_keys.sort_by_key(|(_, t)| *t);
                let key_to_remove = &synced_keys[0].0;
                cache.remove(key_to_remove);
                info!("Evicted old synced entry from cache: {}", key_to_remove);
            } else {
                warn!("Cache is full with unsynced entries!");
                return Err("Cache is full with unsynced entries".to_string());
            }
        }
        
        cache.insert(key.clone(), cached_play);
        info!("Cached play for key: {}", key);
        Ok(())
    }
    
    pub async fn get_play(&self, tournament_id: Uuid, player_id: Uuid, round_number: i32) -> Option<CachedPlay> {
        let key = format!("{}-{}-{}", tournament_id, player_id, round_number);
        let cache = self.cache.read().await;
        cache.get(&key).cloned()
    }
    
    pub async fn mark_as_synced(&self, tournament_id: Uuid, player_id: Uuid, round_number: i32) {
        let key = format!("{}-{}-{}", tournament_id, player_id, round_number);
        let mut cache = self.cache.write().await;
        if let Some(play) = cache.get_mut(&key) {
            play.synced = true;
            info!("Marked play as synced: {}", key);
        }
    }
    
    pub async fn get_unsynced_plays(&self) -> Vec<CachedPlay> {
        let cache = self.cache.read().await;
        cache.values()
            .filter(|p| !p.synced)
            .cloned()
            .collect()
    }
    
    pub async fn get_stats(&self) -> (usize, usize) {
        let cache = self.cache.read().await;
        let total = cache.len();
        let synced = cache.values().filter(|p| p.synced).count();
        (total, synced)
    }
    
    pub async fn clear_synced(&self) {
        let mut cache = self.cache.write().await;
        cache.retain(|_, v| !v.synced);
        info!("Cleared all synced entries from cache");
    }
    
    pub async fn export_to_json(&self) -> Result<String, serde_json::Error> {
        let cache = self.cache.read().await;
        let plays: Vec<&CachedPlay> = cache.values().collect();
        serde_json::to_string_pretty(&plays)
    }
    
    pub async fn import_from_json(&self, json: &str) -> Result<usize, String> {
        let plays: Vec<CachedPlay> = serde_json::from_str(json)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;
        
        let mut cache = self.cache.write().await;
        let mut imported = 0;
        
        for play in plays {
            let key = format!("{}-{}-{}", 
                            play.play_data.tournament_id, 
                            play.play_data.player_id, 
                            play.play_data.round_number);
            if !cache.contains_key(&key) {
                cache.insert(key, play);
                imported += 1;
            }
        }
        
        Ok(imported)
    }
}