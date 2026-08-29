import math
import json
from datetime import datetime
from dataclasses import dataclass
from typing import List, Dict
import h3
from geopy.distance import geodesic

# --- Data Structures ---
@dataclass
class OriginEstimate:
    lat: float
    lon: float
    time_window_start: datetime
    time_window_end: datetime
    slick_orientation_deg: float

@dataclass
class AISPing:
    mmsi: str
    vessel_name: str
    lat: float
    lon: float
    timestamp: datetime
    speed_knots: float
    heading_deg: float

# --- Layer 5 Sub-Modules ---
def compute_dead_reckoning_score(last_ping: AISPing, origin: OriginEstimate) -> float:
    dist_nm = geodesic((last_ping.lat, last_ping.lon), (origin.lat, origin.lon)).nautical
    time_diff_hours = abs((origin.time_window_start - last_ping.timestamp).total_seconds()) / 3600.0
    if time_diff_hours == 0:
        time_diff_hours = 0.01
    
    required_speed_knots = dist_nm / time_diff_hours
    speed_discrepancy = abs(required_speed_knots - last_ping.speed_knots)
    return max(0.0, 1.0 - (speed_discrepancy / 15.0))

def compute_heading_alignment_score(vessel_heading: float, slick_angle: float) -> float:
    diff = abs((vessel_heading - slick_angle + 180) % 360 - 180)
    diff = min(diff, abs(diff - 180))
    return max(0.0, 1.0 - (diff / 90.0))

def detect_dark_vessel_anomaly(vessel_pings: List[AISPing], origin: OriginEstimate) -> Dict:
    is_dark = False
    anomaly_penalty = 0.0
    ghost_path = []
    
    for i in range(len(vessel_pings) - 1):
        gap_mins = (vessel_pings[i+1].timestamp - vessel_pings[i].timestamp).total_seconds() / 60.0
        if gap_mins > 45:
            is_dark = True
            anomaly_penalty = 0.35
            ghost_path.append({
                "gap_start": vessel_pings[i].timestamp.isoformat(),
                "gap_end": vessel_pings[i+1].timestamp.isoformat(),
                "last_lat": vessel_pings[i].lat,
                "last_lon": vessel_pings[i].lon
            })
            
    return {"is_dark": is_dark, "penalty_bonus": anomaly_penalty, "ghost_path": ghost_path}

def run_attribution_engine(origin: OriginEstimate, vessel_database: Dict[str, List[AISPing]]):
    ranked_suspects = []
    
    for mmsi, pings in vessel_database.items():
        last_ping = pings[-1]
        
        s_dr = compute_dead_reckoning_score(last_ping, origin)
        s_orient = compute_heading_alignment_score(last_ping.heading_deg, origin.slick_orientation_deg)
        dark_data = detect_dark_vessel_anomaly(pings, origin)
        
        composite = (s_dr * 0.40) + (s_orient * 0.30) + dark_data["penalty_bonus"]
        final_score = min(1.0, composite)
        
        ranked_suspects.append({
            "mmsi": mmsi,
            "vessel_name": last_ping.vessel_name,
            "composite_score": round(final_score * 100, 2),
            "breakdown": {
                "dead_reckoning_match_pct": round(s_dr * 100, 1),
                "orientation_match_pct": round(s_orient * 100, 1),
                "ais_dark_anomaly": dark_data["is_dark"]
            },
            "ghost_path_data": dark_data["ghost_path"]
        })
    
    return sorted(ranked_suspects, key=lambda x: x["composite_score"], reverse=True)

# --- Test Data & Execution ---
if __name__ == "__main__":
    # Simulated output from Layer 3 & Layer 4
    origin_input = OriginEstimate(
        lat=22.4500,
        lon=69.0500,
        time_window_start=datetime(2026, 4, 10, 14, 0, 0),
        time_window_end=datetime(2026, 4, 10, 15, 0, 0),
        slick_orientation_deg=45.0
    )
    
    # Mock AIS records from Layer 2
    mock_ais_data = {
        "419001234": [
            AISPing("419001234", "MV Ocean Star", 22.3500, 68.9500, datetime(2026, 4, 10, 12, 0, 0), 12.0, 48.0),
            AISPing("419001234", "MV Ocean Star", 22.5200, 69.1200, datetime(2026, 4, 10, 16, 0, 0), 12.0, 44.0)  # 4-hr gap -> Dark Vessel!
        ],
        "419009876": [
            AISPing("419009876", "Tug Bravo", 22.8000, 69.5000, datetime(2026, 4, 10, 14, 0, 0), 5.0, 180.0),
            AISPing("419009876", "Tug Bravo", 22.8200, 69.5100, datetime(2026, 4, 10, 14, 30, 0), 5.0, 180.0)
        ]
    }
    
    results = run_attribution_engine(origin_input, mock_ais_data)
    
    # Save output to JSON for Layer 6
    with open("ranked_suspects_output.json", "w") as f:
        json.dump(results, f, indent=2)
        
    print("\n--- SAMUDRA-NETRA: Layer 5 Attribution Output ---")
    print(json.dumps(results, indent=2))
    print("\nSuccessfully exported results to 'ranked_suspects_output.json'")