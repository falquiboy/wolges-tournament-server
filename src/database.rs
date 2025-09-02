use sqlx::{PgPool, Row, Executor};
use std::env;

pub struct Database {
    pool: PgPool,
}

impl Database {
    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        dotenv::dotenv().ok(); // Cargar .env si existe
        
        let database_url = env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set in environment");
            
        let pool = PgPool::connect(&database_url).await?;
        
        Ok(Database { pool })
    }
    
    pub async fn test_connection(&self) -> Result<String, Box<dyn std::error::Error>> {
        let row = sqlx::query("SELECT 'Conexión exitosa a Supabase' as message")
            .fetch_one(&self.pool)
            .await?;
            
        let message: String = row.get("message");
        Ok(message)
    }
    
    pub async fn test_create_tournament(&self, name: String, player_names: Vec<String>) -> Result<String, Box<dyn std::error::Error>> {
        use uuid::Uuid;
        use chrono::Utc;
        
        let tournament_id = Uuid::new_v4();
        let created_at = Utc::now();
        
        self.create_tournament_with_id(tournament_id, name, player_names, created_at).await
    }
    
    pub async fn create_tournament_with_id(&self, tournament_id: uuid::Uuid, name: String, player_names: Vec<String>, created_at: chrono::DateTime<chrono::Utc>) -> Result<String, Box<dyn std::error::Error>> {
        
        // Insert tournament using raw SQL to avoid prepared statement conflicts
        let query = format!(
            "INSERT INTO tournaments (id, name, created_at, status, tiles_remaining, current_round) VALUES ('{}', '{}', '{}', 'Created', 100, 0)",
            tournament_id, name.replace("'", "''"), created_at.format("%Y-%m-%d %H:%M:%S%.3f%:z")
        );
        
        self.pool.execute(&*query).await?;
        
        // Insert players
        for player_name in &player_names {
            let player_id = uuid::Uuid::new_v4();
            let player_query = format!(
                "INSERT INTO players (id, tournament_id, name, total_score) VALUES ('{}', '{}', '{}', 0)",
                player_id, tournament_id, player_name.replace("'", "''")
            );
            self.pool.execute(&*player_query).await?;
        }
        
        Ok(format!("Tournament '{}' created successfully with ID: {}", name, tournament_id))
    }
    
    pub async fn list_tournaments(&self) -> Result<String, Box<dyn std::error::Error>> {
        use uuid::Uuid;
        use chrono::{DateTime, Utc};
        
        // Use a unique query string to avoid prepared statement conflicts
        let query_str = format!("SELECT id, name, created_at, status FROM tournaments ORDER BY created_at DESC /* {} */", Uuid::new_v4());
        let rows = sqlx::query(&query_str)
            .fetch_all(&self.pool)
            .await?;
            
        let mut result = String::from("Tournaments in database:\n");
        for row in rows {
            let id: Uuid = row.get("id");
            let name: String = row.get("name");
            let created_at: DateTime<Utc> = row.get("created_at");
            let status: String = row.get("status");
            result.push_str(&format!("- {} ({}): {} - {}\n", name, id, status, created_at.format("%Y-%m-%d %H:%M")));
        }
        
        Ok(result)
    }
    
    pub async fn enroll_player(&self, tournament_id: uuid::Uuid, player_id: uuid::Uuid, name: String, ip_address: String, user_agent: String, hardware_id: String) -> Result<String, Box<dyn std::error::Error>> {
        use chrono::Utc;
        
        let enrolled_at = Utc::now();
        
        // Insert player with session info  
        let query = format!(
            "INSERT INTO players (id, tournament_id, name, total_score, enrolled_at, ip_address, user_agent, hardware_id) VALUES ('{}', '{}', '{}', 0, '{}', CAST('{}' AS INET), '{}', '{}')",
            player_id, 
            tournament_id, 
            name.replace("'", "''"), 
            enrolled_at.format("%Y-%m-%d %H:%M:%S%.3f%:z"),
            ip_address.replace("'", "''"),
            user_agent.replace("'", "''"),
            hardware_id.replace("'", "''")
        );
        
        self.pool.execute(&*query).await?;
        
        Ok(format!("Player '{}' enrolled successfully in tournament {}", name, tournament_id))
    }
    
    pub async fn create_round(&self, tournament_id: uuid::Uuid, round_number: i32, rack: String, board_data: String) -> Result<String, Box<dyn std::error::Error>> {
        use chrono::Utc;
        
        let created_at = Utc::now();
        let round_id = uuid::Uuid::new_v4();
        
        // Insert round
        let round_query = format!(
            "INSERT INTO rounds (id, tournament_id, number, rack, status, created_at) VALUES ('{}', '{}', {}, '{}', 'Generated', '{}')",
            round_id,
            tournament_id,
            round_number,
            rack.replace("'", "''"),
            created_at.format("%Y-%m-%d %H:%M:%S%.3f%:z")
        );
        
        self.pool.execute(&*round_query).await?;
        
        // Insert board state
        let board_query = format!(
            "INSERT INTO board_states (tournament_id, round_number, board_data) VALUES ('{}', {}, '{}')",
            tournament_id,
            round_number,
            board_data.replace("'", "''")
        );
        
        self.pool.execute(&*board_query).await?;
        
        Ok(format!("Round {} created successfully for tournament {}", round_number, tournament_id))
    }
    
    pub async fn get_tournament(&self, tournament_id: uuid::Uuid) -> Result<Option<serde_json::Value>, Box<dyn std::error::Error>> {
        // Get tournament basic info
        let tournament_query = format!(
            "SELECT id, name, created_at, status, tiles_remaining, current_round FROM tournaments WHERE id = '{}' /* {} */",
            tournament_id, uuid::Uuid::new_v4()
        );
        
        let tournament_rows = sqlx::query(&tournament_query)
            .fetch_all(&self.pool)
            .await?;
        
        if tournament_rows.is_empty() {
            return Ok(None);
        }
        
        let tournament_row = &tournament_rows[0];
        
        // Get players for this tournament
        let players_query = format!(
            "SELECT id, name, total_score FROM players WHERE tournament_id = '{}' /* {} */",
            tournament_id, uuid::Uuid::new_v4()
        );
        
        let players_rows = sqlx::query(&players_query)
            .fetch_all(&self.pool)
            .await?;
        
        // Get rounds for this tournament
        let rounds_query = format!(
            "SELECT id, number, rack, status, created_at FROM rounds WHERE tournament_id = '{}' ORDER BY number /* {} */",
            tournament_id, uuid::Uuid::new_v4()
        );
        
        let rounds_rows = sqlx::query(&rounds_query)
            .fetch_all(&self.pool)
            .await?;
        
        // Build response JSON
        let mut tournament_json = serde_json::json!({
            "id": tournament_row.get::<uuid::Uuid, _>("id").to_string(),
            "name": tournament_row.get::<String, _>("name"),
            "created_at": tournament_row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "status": tournament_row.get::<String, _>("status"),
            "tiles_remaining": tournament_row.get::<i32, _>("tiles_remaining"),
            "current_round": tournament_row.get::<i32, _>("current_round"),
            "players": [],
            "rounds": [],
            "master_plays": []
        });
        
        // Add players
        let mut players = Vec::new();
        for player_row in players_rows {
            players.push(serde_json::json!({
                "id": player_row.get::<uuid::Uuid, _>("id").to_string(),
                "name": player_row.get::<String, _>("name"),
                "total_score": player_row.get::<i32, _>("total_score"),
                "plays": []
            }));
        }
        tournament_json["players"] = serde_json::Value::Array(players);
        
        // Add rounds (simplified structure)
        let mut rounds = Vec::new();
        for round_row in rounds_rows {
            rounds.push(serde_json::json!({
                "id": round_row.get::<uuid::Uuid, _>("id").to_string(),
                "number": round_row.get::<i32, _>("number"),
                "rack": round_row.get::<String, _>("rack"),
                "status": round_row.get::<String, _>("status"),
                "created_at": round_row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            }));
        }
        tournament_json["rounds"] = serde_json::Value::Array(rounds);
        
        Ok(Some(tournament_json))
    }
    
    pub async fn submit_player_play(&self, tournament_id: uuid::Uuid, player_id: uuid::Uuid, round_number: i32, word: String, position_row: i32, position_col: i32, position_down: bool, score: i32, percentage: f32, cumulative_score: i32, difference_from_optimal: i32, cumulative_difference: i32) -> Result<String, Box<dyn std::error::Error>> {
        use chrono::Utc;
        
        let submitted_at = Utc::now();
        let play_id = uuid::Uuid::new_v4();
        
        // Check if player play already exists for this round
        let check_query = format!(
            "SELECT id FROM player_plays WHERE tournament_id = '{}' AND player_id = '{}' AND round_number = {} /* {} */",
            tournament_id, player_id, round_number, uuid::Uuid::new_v4()
        );
        
        let existing_rows = sqlx::query(&check_query)
            .fetch_all(&self.pool)
            .await?;
        
        if !existing_rows.is_empty() {
            // Update existing play
            let existing_id: uuid::Uuid = existing_rows[0].get("id");
            let update_query = format!(
                "UPDATE player_plays SET word = '{}', position_row = {}, position_col = {}, position_down = {}, score = {}, percentage_of_optimal = {}, submitted_at = '{}', cumulative_score = {}, difference_from_optimal = {}, cumulative_difference = {} WHERE id = '{}'",
                word.replace("'", "''"),
                position_row,
                position_col,
                position_down,
                score,
                percentage,
                submitted_at.format("%Y-%m-%d %H:%M:%S%.3f%:z"),
                cumulative_score,
                difference_from_optimal,
                cumulative_difference,
                existing_id
            );
            self.pool.execute(&*update_query).await?;
            
            // Update player total score
            let update_player_query = format!(
                "UPDATE players SET total_score = {} WHERE id = '{}'",
                cumulative_score, player_id
            );
            self.pool.execute(&*update_player_query).await?;
            
            Ok("Player play updated successfully".to_string())
        } else {
            // Insert new play
            let insert_query = format!(
                "INSERT INTO player_plays (id, tournament_id, player_id, round_number, word, position_row, position_col, position_down, score, percentage_of_optimal, submitted_at, cumulative_score, difference_from_optimal, cumulative_difference) VALUES ('{}', '{}', '{}', {}, '{}', {}, {}, {}, {}, {}, '{}', {}, {}, {})",
                play_id,
                tournament_id,
                player_id,
                round_number,
                word.replace("'", "''"),
                position_row,
                position_col,
                position_down,
                score,
                percentage,
                submitted_at.format("%Y-%m-%d %H:%M:%S%.3f%:z"),
                cumulative_score,
                difference_from_optimal,
                cumulative_difference
            );
            self.pool.execute(&*insert_query).await?;
            
            // Update player total score
            let update_player_query = format!(
                "UPDATE players SET total_score = {} WHERE id = '{}'",
                cumulative_score, player_id
            );
            self.pool.execute(&*update_player_query).await?;
            
            Ok("Player play submitted successfully".to_string())
        }
    }
}