use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, Mutex};
use tokio::time::sleep;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use log::{info, warn, error};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayData {
    pub tournament_id: Uuid,
    pub player_id: Uuid,
    pub round_number: i32,
    pub word: String,
    pub position_row: i32,
    pub position_col: i32,
    pub position_down: bool,
    pub score: i32,
    pub percentage_of_optimal: f32,
    pub cumulative_score: i32,
    pub difference_from_optimal: i32,
    pub cumulative_difference: i32,
}

#[derive(Debug, Clone)]
pub struct QueueMetrics {
    pub total_submitted: u64,
    pub total_processed: u64,
    pub total_failed: u64,
    pub avg_latency_ms: f64,
    pub max_latency_ms: f64,
    pub queue_size: usize,
    pub last_error: Option<String>,
}

pub struct AsyncQueue {
    sender: mpsc::Sender<PlayData>,
    metrics: Arc<Mutex<QueueMetrics>>,
    database: Arc<crate::database::Database>,
}

impl AsyncQueue {
    pub async fn new(database: Arc<crate::database::Database>) -> Self {
        let (sender, mut receiver) = mpsc::channel::<PlayData>(1000); // Buffer for 1000 plays
        let metrics = Arc::new(Mutex::new(QueueMetrics {
            total_submitted: 0,
            total_processed: 0,
            total_failed: 0,
            avg_latency_ms: 0.0,
            max_latency_ms: 0.0,
            queue_size: 0,
            last_error: None,
        }));
        
        let metrics_clone = metrics.clone();
        let db_clone = database.clone();
        
        // Spawn background worker
        tokio::spawn(async move {
            let mut latencies: Vec<f64> = Vec::new();
            
            while let Some(play_data) = receiver.recv().await {
                let start = Instant::now();
                let mut retry_count = 0;
                let max_retries = 3;
                let mut success = false;
                
                // Update queue size
                {
                    let mut m = metrics_clone.lock().await;
                    m.queue_size = receiver.len();
                }
                
                // Retry logic with exponential backoff
                while retry_count < max_retries && !success {
                    let delay = Duration::from_millis(100 * (2_u64.pow(retry_count)));
                    
                    if retry_count > 0 {
                        sleep(delay).await;
                        info!("Retrying play submission (attempt {}/{})", retry_count + 1, max_retries);
                    }
                    
                    match db_clone.submit_player_play(
                        play_data.tournament_id,
                        play_data.player_id,
                        play_data.round_number,
                        play_data.word.clone(),
                        play_data.position_row,
                        play_data.position_col,
                        play_data.position_down,
                        play_data.score,
                        play_data.percentage_of_optimal,
                        play_data.cumulative_score,
                        play_data.difference_from_optimal,
                        play_data.cumulative_difference,
                    ).await {
                        Ok(_) => {
                            success = true;
                            let latency_ms = start.elapsed().as_millis() as f64;
                            latencies.push(latency_ms);
                            
                            // Update metrics
                            let mut m = metrics_clone.lock().await;
                            m.total_processed += 1;
                            m.avg_latency_ms = latencies.iter().sum::<f64>() / latencies.len() as f64;
                            m.max_latency_ms = latencies.iter().cloned().fold(0.0, f64::max);
                            
                            info!("Play processed in {}ms (tournament: {}, player: {}, round: {})", 
                                  latency_ms, play_data.tournament_id, play_data.player_id, play_data.round_number);
                        }
                        Err(e) => {
                            let error_string = e.to_string();
                            retry_count += 1;
                            if retry_count >= max_retries {
                                error!("Failed to submit play after {} retries: {}", max_retries, error_string);
                                let mut m = metrics_clone.lock().await;
                                m.total_failed += 1;
                                m.last_error = Some(error_string.clone());
                                
                                // TODO: Store failed plays for later sync
                                // For now, we just log the error
                            } else {
                                warn!("Error submitting play (will retry): {}", error_string);
                            }
                        }
                    }
                }
            }
        });
        
        AsyncQueue {
            sender,
            metrics,
            database,
        }
    }
    
    pub async fn submit_play(&self, play_data: PlayData) -> Result<(), String> {
        // Update submitted count
        {
            let mut m = self.metrics.lock().await;
            m.total_submitted += 1;
        }
        
        // Send to queue (non-blocking)
        self.sender.send(play_data).await
            .map_err(|e| format!("Failed to queue play: {}", e))?;
        
        Ok(())
    }
    
    pub async fn get_metrics(&self) -> QueueMetrics {
        self.metrics.lock().await.clone()
    }
    
    pub async fn health_check(&self) -> bool {
        let metrics = self.get_metrics().await;
        
        // Consider healthy if:
        // 1. Queue is not too full
        // 2. Failure rate is low
        // 3. Average latency is acceptable
        
        let queue_healthy = metrics.queue_size < 500;
        let failure_rate = if metrics.total_submitted > 0 {
            metrics.total_failed as f64 / metrics.total_submitted as f64
        } else {
            0.0
        };
        let failure_healthy = failure_rate < 0.1; // Less than 10% failure rate
        let latency_healthy = metrics.avg_latency_ms < 1000.0; // Less than 1 second average
        
        queue_healthy && failure_healthy && latency_healthy
    }
}