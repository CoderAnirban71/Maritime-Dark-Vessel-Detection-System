import math
import requests
from datetime import datetime, timedelta

class TrajectoryEngine:
    def __init__(self):
        self.R = 6371.0  # Earth's radius in km

    def calculate_reverse_drift(self, lat, lon, speed_ms, direction_deg, hours_back):
        speed_kmh = speed_ms * 3.6
        distance_km = speed_kmh * hours_back
        reverse_direction = (direction_deg + 180) % 360
        
        lat_rad = math.radians(lat)
        lon_rad = math.radians(lon)
        bearing_rad = math.radians(reverse_direction)
        
        new_lat_rad = math.asin(
            math.sin(lat_rad) * math.cos(distance_km / self.R) +
            math.cos(lat_rad) * math.sin(distance_km / self.R) * math.cos(bearing_rad)
        )
        
        new_lon_rad = lon_rad + math.atan2(
            math.sin(bearing_rad) * math.sin(distance_km / self.R) * math.cos(lat_rad),
            math.cos(distance_km / self.R) - math.sin(lat_rad) * math.sin(new_lat_rad)
        )
        
        return round(math.degrees(new_lat_rad), 5), round(math.degrees(new_lon_rad), 5)

def run_sih_demo():
    print("🚀 Initiating SAMUDRA-NETRA Layer 5: Attribution Engine...")
    print("-" * 60)
    
    # 1. THE DISASTER (Ennore 2017) - Time adjusted for accurate backtracking
    spill_lat = 12.0957
    spill_lon = 80.8360
    spill_time_str = "2017-01-28T00:00:00Z"
    spill_time = datetime.strptime(spill_time_str, "%Y-%m-%dT%H:%M:%SZ")
    
    # 2. OCEAN CURRENTS - Realistic slow drift (0.2 m/s)
    current_speed = 0.2 
    current_dir = 45.0
    hours_to_backtrack = 12
    
    print(f"📍 Oil Spill Detected at: {spill_lat}, {spill_lon}")
    print(f"🌊 Ocean Currents: {current_speed} m/s towards {current_dir}°")
    print(f"⏪ Backtracking {hours_to_backtrack} hours using Dead Reckoning...")
    
    # 3. REVERSE MATH (Layer 5)
    engine = TrajectoryEngine()
    past_lat, past_lon = engine.calculate_reverse_drift(
        spill_lat, spill_lon, current_speed, current_dir, hours_to_backtrack
    )
    
    past_time = spill_time - timedelta(hours=hours_to_backtrack)
    past_time_str = past_time.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    print(f"🎯 Calculated Origin Point: {past_lat}, {past_lon} at {past_time_str}")
    print("-" * 60)
    
    # 4. QUERYING YOUR API (Layer 2 Integration) - Radius updated to 50km
    print("📡 Querying SAMUDRA-NETRA Backend for Suspects...")
    
    start_search = (past_time - timedelta(hours=12)).strftime("%Y-%m-%dT%H:%M:%SZ")
    end_search = (past_time + timedelta(hours=12)).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    api_url = f"http://localhost:8000/nearby?lat={past_lat}&lon={past_lon}&radius_km=50&start={start_search}&end={end_search}&limit=200"
    
    try:
        response = requests.get(api_url)
        if response.status_code == 200:
            data = response.json()
            suspects = data.get("results", [])
            
            if suspects:
                print(f"🚨 FOUND {len(suspects)} SUSPECT VESSEL(S) AT THE ORIGIN POINT!")
                for s in suspects:
                    print(f"   ☠️  MMSI: {s['mmsi']} | Speed: {s['speed_kn']} kn | Heading: {s['heading_deg']}° | Time: {s['ts']}")
                print("\n✅ CASE SOLVED: Cross-reference MMSI with registry to identify the culprits.")
            else:
                print("✅ No vessels found at the origin point in that time window.")
        else:
            print(f"❌ API Error: {response.status_code}")
    except Exception as e:
        print(f"❌ Could not connect to API. Make sure 'uvicorn query_api:app --reload' is running! Error: {e}")

if __name__ == "__main__":
    run_sih_demo()