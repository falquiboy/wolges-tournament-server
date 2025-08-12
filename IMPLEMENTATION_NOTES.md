# Implementation Notes - WOLGES Tournament Server

## Current State (2025-08-11)

### Completed Features:
1. ✅ Spanish coordinate system (columns: numbers 1-15, rows: letters A-O)
2. ✅ Direction convention: H8→ (horizontal), 8H↓ (vertical)
3. ✅ Board with coordinates on all 4 borders
4. ✅ Minimalist player interface
5. ✅ Single player tournament support
6. ✅ Auto-uppercase except for blanks (Shift+letter)

### Pending Implementation:

#### 1. Timestamp System
- Add `timestamp: chrono::DateTime<Utc>` to `PlayerPlay` struct
- Add `timer_started: Option<chrono::DateTime<Utc>>` to `Round` struct
- Track when admin starts 3-minute timer

#### 2. Time Validation
- In `submit_player_play()`: check if submission is within 3 minutes
- If late: score = 0, add reason "Tiempo excedido"
- Store all plays (valid and invalid) for record

#### 3. Automatic Game End
- Already checks tiles remaining in `start_new_round()`
- Need to enhance to check vowels vs consonants specifically
- Add game end announcement with fanfare

#### 4. Final Leaderboard Display
- Add button in admin UI to toggle between board and final standings
- Include Master in final table
- Make it prominent for projection

### Testing Flow:
1. Admin creates tournament at http://localhost:8080
2. Players join at http://localhost:8080/player.html?t=TOURNAMENT_ID
3. Admin generates rack → validates → starts timer
4. Players submit within 3 minutes
5. Admin reveals optimal play
6. Repeat until game ends (no vowels/consonants)

### Key Files to Modify:
- `src/models.rs` - Add timestamp fields
- `src/tournament_manager.rs` - Add time validation logic
- `src/routes.rs` - Update endpoints
- `index.html` - Add final leaderboard view toggle
- `player.html` - Already updated with minimal interface

### Database Considerations:
- Currently all in-memory
- Player plays stored but need timestamp
- Consider persistence for tournament history (future enhancement)