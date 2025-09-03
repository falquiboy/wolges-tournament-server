#!/usr/bin/env python3
"""
Test de carga para simular 50 jugadores enviando jugadas simultáneas
"""

import asyncio
import aiohttp
import json
import time
import random
import string
import uuid
from datetime import datetime

# Configuración
SERVER_URL = "http://localhost:8080"
NUM_PLAYERS = 50
TOURNAMENT_NAME = f"Test Torneo 50 Jugadores - {datetime.now().strftime('%H:%M:%S')}"

# Generar nombres de jugadores
PLAYER_NAMES = [f"Jugador_{i:02d}" for i in range(1, NUM_PLAYERS + 1)]

# Estadísticas
stats = {
    "total_plays": 0,
    "successful_plays": 0,
    "failed_plays": 0,
    "total_latency": 0,
    "max_latency": 0,
    "min_latency": float('inf'),
}

async def create_tournament():
    """Crear un torneo con 50 jugadores"""
    async with aiohttp.ClientSession() as session:
        payload = {
            "name": TOURNAMENT_NAME,
            "player_names": PLAYER_NAMES
        }
        async with session.post(f"{SERVER_URL}/tournament/create", json=payload) as resp:
            result = await resp.json()
            if resp.status == 200:
                print(f"✅ Torneo creado: {result['data']['tournament_id']}")
                return result['data']['tournament_id']
            else:
                print(f"❌ Error creando torneo: {result}")
                return None

async def enroll_player(session, tournament_id, player_name):
    """Inscribir un jugador en el torneo"""
    payload = {
        "tournament_id": tournament_id,
        "player_name": player_name
    }
    async with session.post(f"{SERVER_URL}/tournament/enroll", json=payload) as resp:
        result = await resp.json()
        if resp.status == 200:
            return result['data']['player_id']
        else:
            print(f"❌ Error inscribiendo {player_name}: {result}")
            return None

async def start_round(tournament_id, round_number):
    """Iniciar una ronda del torneo"""
    async with aiohttp.ClientSession() as session:
        async with session.post(f"{SERVER_URL}/tournament/{tournament_id}/round/start") as resp:
            result = await resp.json()
            if resp.status == 200:
                print(f"✅ Ronda {round_number} iniciada")
                return result['data']
            else:
                print(f"❌ Error iniciando ronda: {result}")
                return None

async def submit_play(session, tournament_id, player_id, round_number, word=None):
    """Enviar una jugada de un jugador"""
    if word is None:
        # Generar palabra aleatoria de 5-8 letras
        word_length = random.randint(5, 8)
        word = ''.join(random.choices(string.ascii_uppercase, k=word_length))
    
    payload = {
        "tournament_id": tournament_id,
        "player_id": player_id,
        "round_number": round_number,
        "word": word,
        "position": {
            "row": random.randint(0, 14),
            "col": random.randint(0, 14),
            "down": random.choice([True, False])
        }
    }
    
    start_time = time.time()
    try:
        async with session.post(f"{SERVER_URL}/tournament/play/submit", json=payload, timeout=5) as resp:
            latency = (time.time() - start_time) * 1000  # ms
            result = await resp.json()
            
            stats["total_plays"] += 1
            stats["total_latency"] += latency
            stats["max_latency"] = max(stats["max_latency"], latency)
            stats["min_latency"] = min(stats["min_latency"], latency)
            
            if resp.status == 200:
                stats["successful_plays"] += 1
                return True, latency
            else:
                stats["failed_plays"] += 1
                print(f"❌ Play failed for player {player_id}: {result.get('error', 'Unknown error')}")
                return False, latency
    except asyncio.TimeoutError:
        stats["total_plays"] += 1
        stats["failed_plays"] += 1
        print(f"⏱️ Timeout for player {player_id}")
        return False, 5000  # 5 segundos de timeout
    except Exception as e:
        stats["total_plays"] += 1
        stats["failed_plays"] += 1
        print(f"❌ Exception for player {player_id}: {e}")
        return False, 0

async def simulate_round(tournament_id, player_ids, round_number):
    """Simular una ronda con todos los jugadores enviando jugadas casi simultáneamente"""
    print(f"\n🎯 Simulando ronda {round_number} con {len(player_ids)} jugadores...")
    
    # Iniciar la ronda
    round_data = await start_round(tournament_id, round_number)
    if not round_data:
        return False
    
    # Pequeña pausa para que el servidor procese el inicio de ronda
    await asyncio.sleep(1)
    
    # Crear tareas para todos los jugadores
    async with aiohttp.ClientSession() as session:
        tasks = []
        for player_id in player_ids:
            # Añadir un pequeño delay aleatorio (0-500ms) para simular realismo
            delay = random.uniform(0, 0.5)
            task = asyncio.create_task(submit_play_with_delay(session, tournament_id, player_id, round_number, delay))
            tasks.append(task)
        
        # Esperar a que todas las jugadas se completen
        results = await asyncio.gather(*tasks)
    
    # Analizar resultados
    successful = sum(1 for success, _ in results if success)
    print(f"✅ Jugadas exitosas: {successful}/{len(player_ids)}")
    
    latencies = [latency for _, latency in results if latency > 0]
    if latencies:
        avg_latency = sum(latencies) / len(latencies)
        print(f"⏱️ Latencia promedio: {avg_latency:.2f}ms")
        print(f"⏱️ Latencia máxima: {max(latencies):.2f}ms")
        print(f"⏱️ Latencia mínima: {min(latencies):.2f}ms")
    
    return True

async def submit_play_with_delay(session, tournament_id, player_id, round_number, delay):
    """Enviar jugada con un delay inicial"""
    await asyncio.sleep(delay)
    return await submit_play(session, tournament_id, player_id, round_number)

async def check_metrics():
    """Verificar métricas del servidor"""
    async with aiohttp.ClientSession() as session:
        # Métricas de la cola
        async with session.get(f"{SERVER_URL}/api/metrics") as resp:
            if resp.status == 200:
                metrics = await resp.json()
                print("\n📊 Métricas de la cola asíncrona:")
                queue_metrics = metrics['queue_metrics']
                print(f"  - Enviadas: {queue_metrics['total_submitted']}")
                print(f"  - Procesadas: {queue_metrics['total_processed']}")
                print(f"  - Fallidas: {queue_metrics['total_failed']}")
                print(f"  - Latencia promedio: {queue_metrics['avg_latency_ms']:.2f}ms")
                print(f"  - Latencia máxima: {queue_metrics['max_latency_ms']:.2f}ms")
                print(f"  - Tamaño de cola: {queue_metrics['queue_size']}")
        
        # Health check
        async with session.get(f"{SERVER_URL}/api/health") as resp:
            if resp.status == 200:
                health = await resp.json()
                print(f"\n🏥 Estado del sistema: {'✅ Saludable' if health['healthy'] else '⚠️ Con problemas'}")
                cache_info = health['components']['cache']
                print(f"  - Cache: {cache_info['total_entries']} entradas ({cache_info['capacity_used']} capacidad)")
        
        # Estadísticas del cache
        async with session.get(f"{SERVER_URL}/api/cache/stats") as resp:
            if resp.status == 200:
                cache_stats = await resp.json()
                print(f"\n💾 Cache local:")
                print(f"  - Total: {cache_stats['total_entries']}")
                print(f"  - Sincronizadas: {cache_stats['synced_entries']}")
                print(f"  - Pendientes: {cache_stats['unsynced_entries']}")

async def main():
    """Función principal del test de carga"""
    print("=" * 60)
    print(f"🚀 TEST DE CARGA - {NUM_PLAYERS} JUGADORES SIMULTÁNEOS")
    print("=" * 60)
    
    # Crear torneo
    tournament_id = await create_tournament()
    if not tournament_id:
        print("❌ No se pudo crear el torneo")
        return
    
    # Inscribir jugadores
    print(f"\n📝 Inscribiendo {NUM_PLAYERS} jugadores...")
    player_ids = []
    async with aiohttp.ClientSession() as session:
        tasks = []
        for player_name in PLAYER_NAMES:
            task = asyncio.create_task(enroll_player(session, tournament_id, player_name))
            tasks.append(task)
        
        player_ids = await asyncio.gather(*tasks)
        player_ids = [pid for pid in player_ids if pid]  # Filtrar None
    
    print(f"✅ {len(player_ids)} jugadores inscritos")
    
    if len(player_ids) < NUM_PLAYERS:
        print(f"⚠️ Solo se pudieron inscribir {len(player_ids)} de {NUM_PLAYERS} jugadores")
    
    # Simular 3 rondas
    NUM_ROUNDS = 3
    for round_num in range(1, NUM_ROUNDS + 1):
        await simulate_round(tournament_id, player_ids, round_num)
        
        # Pausa entre rondas
        if round_num < NUM_ROUNDS:
            print(f"\n⏸️ Pausa de 3 segundos antes de la siguiente ronda...")
            await asyncio.sleep(3)
    
    # Esperar un poco para que se procesen todas las jugadas
    print("\n⏳ Esperando 5 segundos para que se procesen todas las jugadas...")
    await asyncio.sleep(5)
    
    # Verificar métricas finales
    await check_metrics()
    
    # Mostrar estadísticas finales
    print("\n" + "=" * 60)
    print("📈 ESTADÍSTICAS FINALES DEL TEST")
    print("=" * 60)
    print(f"Total de jugadas enviadas: {stats['total_plays']}")
    print(f"Jugadas exitosas: {stats['successful_plays']}")
    print(f"Jugadas fallidas: {stats['failed_plays']}")
    if stats['total_plays'] > 0:
        success_rate = (stats['successful_plays'] / stats['total_plays']) * 100
        print(f"Tasa de éxito: {success_rate:.2f}%")
        avg_latency = stats['total_latency'] / stats['total_plays']
        print(f"Latencia promedio: {avg_latency:.2f}ms")
        print(f"Latencia máxima: {stats['max_latency']:.2f}ms")
        print(f"Latencia mínima: {stats['min_latency']:.2f}ms")
    
    print("\n✅ Test de carga completado")

if __name__ == "__main__":
    asyncio.run(main())