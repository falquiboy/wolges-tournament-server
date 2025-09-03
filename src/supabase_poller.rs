use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use log::{info, warn, error};
use serde::{Serialize, Deserialize};
use crate::tournament_manager::TournamentManager;
use crate::database::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupabasePlay {
    pub id: Uuid,
    pub tournament_id: Uuid,
    pub player_id: Uuid,
    pub round_number: i32,
    pub word: String,
    pub position_row: i32,
    pub position_col: i32,
    pub position_down: bool,
    pub submitted_at: DateTime<Utc>,
    pub processed: Option<bool>,
}

pub struct SupabasePoller {
    database: Arc<Database>,
    manager: Arc<RwLock<TournamentManager>>,
    poll_interval_ms: u64,
    last_poll_time: Arc<RwLock<DateTime<Utc>>>,
}

impl SupabasePoller {
    pub fn new(
        database: Arc<Database>,
        manager: Arc<RwLock<TournamentManager>>,
        poll_interval_ms: u64,
    ) -> Self {
        SupabasePoller {
            database,
            manager,
            poll_interval_ms,
            last_poll_time: Arc::new(RwLock::new(Utc::now())),
        }
    }
    
    pub async fn start_polling(self: Arc<Self>) {
        info!("🔄 Iniciando polling de Supabase cada {}ms", self.poll_interval_ms);
        
        loop {
            sleep(Duration::from_millis(self.poll_interval_ms)).await;
            
            match self.poll_and_process().await {
                Ok(count) => {
                    if count > 0 {
                        info!("✅ Procesadas {} jugadas desde Supabase", count);
                    }
                }
                Err(e) => {
                    error!("❌ Error en polling: {}", e);
                }
            }
        }
    }
    
    async fn poll_and_process(&self) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let last_time = *self.last_poll_time.read().await;
        
        // Consultar jugadas nuevas desde Supabase
        let new_plays = self.fetch_new_plays(last_time).await?;
        
        if new_plays.is_empty() {
            return Ok(0);
        }
        
        info!("📥 Encontradas {} jugadas nuevas para procesar", new_plays.len());
        
        let mut processed_count = 0;
        let mut manager = self.manager.write().await;
        
        for play in new_plays {
            // Procesar la jugada en el TournamentManager
            match self.process_single_play(&mut manager, &play).await {
                Ok(_) => {
                    processed_count += 1;
                    
                    // Marcar como procesada en Supabase
                    if let Err(e) = self.mark_as_processed(play.id).await {
                        warn!("⚠️ No se pudo marcar jugada {} como procesada: {}", play.id, e);
                    }
                }
                Err(e) => {
                    error!("❌ Error procesando jugada {}: {}", play.id, e);
                }
            }
        }
        
        // Actualizar última vez de polling
        *self.last_poll_time.write().await = Utc::now();
        
        Ok(processed_count)
    }
    
    async fn fetch_new_plays(&self, since: DateTime<Utc>) -> Result<Vec<SupabasePlay>, Box<dyn std::error::Error + Send + Sync>> {
        use sqlx::{PgPool, Row};
        use std::env;
        
        // Conectar directamente para la consulta
        let database_url = env::var("DATABASE_URL")?;
        let pool = PgPool::connect(&database_url).await?;
        
        let query = format!(
            "SELECT id, tournament_id, player_id, round_number, word, 
                    position_row, position_col, position_down, submitted_at, processed
             FROM player_plays 
             WHERE submitted_at > '{}'
               AND (processed IS NULL OR processed = false)
             ORDER BY submitted_at ASC
             LIMIT 100",
            since.format("%Y-%m-%d %H:%M:%S%.3f%:z")
        );
        
        let rows = sqlx::query(&query)
            .fetch_all(&pool)
            .await?;
        
        let mut plays = Vec::new();
        for row in rows {
            plays.push(SupabasePlay {
                id: row.get("id"),
                tournament_id: row.get("tournament_id"),
                player_id: row.get("player_id"),
                round_number: row.get("round_number"),
                word: row.get("word"),
                position_row: row.get("position_row"),
                position_col: row.get("position_col"),
                position_down: row.get("position_down"),
                submitted_at: row.get("submitted_at"),
                processed: row.get("processed"),
            });
        }
        
        Ok(plays)
    }
    
    async fn process_single_play(
        &self,
        manager: &mut TournamentManager,
        play: &SupabasePlay,
    ) -> Result<(), String> {
        info!("🎮 Procesando jugada: Torneo {} - Jugador {} - Palabra: {}", 
              play.tournament_id, play.player_id, play.word);
        
        // Convertir a formato del TournamentManager
        let position = crate::models::Position {
            row: play.position_row as u8,
            col: play.position_col as u8,
            down: play.position_down,
        };
        
        // Procesar la jugada
        match manager.submit_player_play(
            &play.tournament_id,
            &play.player_id,
            play.round_number as u32,
            play.word.clone(),
            position,
        ) {
            Ok(response) => {
                info!("✅ Jugada procesada: {}", response.message);
                Ok(())
            }
            Err(e) => {
                warn!("⚠️ Jugada inválida o error: {}", e);
                // Aún así la marcamos como procesada para no reintentarla
                Ok(())
            }
        }
    }
    
    async fn mark_as_processed(&self, play_id: Uuid) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        use sqlx::{PgPool};
        use std::env;
        
        let database_url = env::var("DATABASE_URL")?;
        let pool = PgPool::connect(&database_url).await?;
        
        let query = format!(
            "UPDATE player_plays 
             SET processed = true 
             WHERE id = '{}'",
            play_id
        );
        
        sqlx::query(&query)
            .execute(&pool)
            .await?;
        
        Ok(())
    }
    
    pub async fn get_pending_plays_count(&self) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        use sqlx::{PgPool, Row};
        use std::env;
        
        let database_url = env::var("DATABASE_URL")?;
        let pool = PgPool::connect(&database_url).await?;
        
        let query = "SELECT COUNT(*) as count FROM player_plays WHERE submitted_at > NOW() - INTERVAL '1 hour'";
        
        let row = sqlx::query(query)
            .fetch_one(&pool)
            .await?;
        
        let count: i64 = row.get("count");
        Ok(count as usize)
    }
}