#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8080"

def test_server():
    # Test health check
    print("1. Testing health check...")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Response: {response.json()}")
    print()

    # Load dictionary
    print("2. Loading dictionary...")
    payload = {
        "kwg_path": "../wolges/FISE2016.kwg",
        "klv_path": "../FILE2017.klv2"
    }
    response = requests.post(f"{BASE_URL}/dictionary/load", json=payload)
    print(f"Response: {response.json()}")
    print()

    # Create tournament
    print("3. Creating tournament...")
    payload = {
        "name": "Torneo Duplicado Español 2025",
        "player_names": ["Juan", "María", "Carlos", "Ana"]
    }
    response = requests.post(f"{BASE_URL}/tournament/create", json=payload)
    result = response.json()
    print(f"Response: {json.dumps(result, indent=2)}")
    
    if result['success']:
        tournament_id = result['data']['id']
        print(f"\nTournament ID: {tournament_id}")
        
        # Start first round
        print("\n4. Starting first round...")
        response = requests.post(f"{BASE_URL}/tournament/{tournament_id}/round/start")
        round_result = response.json()
        print(f"Response: {json.dumps(round_result, indent=2)}")
        
        if round_result['success']:
            round_number = round_result['data']['number']
            rack = round_result['data']['rack']
            print(f"\nRound {round_number} - Rack: {rack}")
            
            # Get optimal play
            print("\n5. Getting optimal play...")
            response = requests.get(f"{BASE_URL}/tournament/{tournament_id}/round/{round_number}/optimal")
            optimal_result = response.json()
            print(f"Response: {json.dumps(optimal_result, indent=2)}")
            
            # Submit a play for each player
            if optimal_result['success'] and result['success']:
                optimal_play = optimal_result['data']
                players = result['data']['players']
                
                print("\n6. Submitting plays for players...")
                for player in players:
                    # For demo, first player plays optimal, others play suboptimal
                    if player['name'] == "Juan":
                        # Juan plays the optimal move
                        payload = {
                            "tournament_id": tournament_id,
                            "player_id": player['id'],
                            "round_number": round_number,
                            "word": optimal_play['word'],
                            "position": optimal_play['position']
                        }
                    else:
                        # Others play a simple word (if possible)
                        payload = {
                            "tournament_id": tournament_id,
                            "player_id": player['id'],
                            "round_number": round_number,
                            "word": "CASA",  # Simple word
                            "position": {
                                "row": 7,
                                "col": 7,
                                "down": False
                            }
                        }
                    
                    response = requests.post(f"{BASE_URL}/tournament/play/submit", json=payload)
                    print(f"\n{player['name']}: {response.json()}")
                
                # Get leaderboard
                print("\n7. Getting leaderboard...")
                response = requests.get(f"{BASE_URL}/tournament/{tournament_id}/leaderboard")
                print(f"Response: {json.dumps(response.json(), indent=2)}")

if __name__ == "__main__":
    test_server()