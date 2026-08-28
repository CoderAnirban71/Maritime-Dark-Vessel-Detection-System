import math
from datetime import datetime, timedelta
import h3_utils

class TrajectoryEngine:
    def __init__(self):
        # Earth's radius in kilometers for coordinate math
        self.R = 6371.0  

    def calculate_reverse_drift(self, lat, lon, speed_ms, direction_deg, hours_back):
        """
        Yeh function lehron ke bahao ko ULTA (reverse) karke past location nikalta hai.
        """
        # Speed ko m/s se km/h mein convert karo
        speed_kmh = speed_ms * 3.6
        
        # Total distance jo oil ne travel kiya hoga
        distance_km = speed_kmh * hours_back
        
        # Kyunki hum PAST mein ja rahe hain, direction ko 180 degrees flip karna hoga
        reverse_direction = (direction_deg + 180) % 360
        
        # Math for calculating new Lat/Lon (Haversine formula reverse)
        # Convert to radians
        lat_rad = math.radians(lat)
        lon_rad = math.radians(lon)
        bearing_rad = math.radians(reverse_direction)
        
        # Calculate new latitude
        new_lat_rad = math.asin(
            math.sin(lat_rad) * math.cos(distance_km / self.R) +
            math.cos(lat_rad) * math.sin(distance_km / self.R) * math.cos(bearing_rad)
        )
        
        # Calculate new longitude
        new_lon_rad = lon_rad + math.atan2(
            math.sin(bearing_rad) * math.sin(distance_km / self.R) * math.cos(lat_rad),
            math.cos(distance_km / self.R) - math.sin(lat_rad) * math.sin(new_lat_rad)
        )
        
        new_lat = math.degrees(new_lat_rad)
        new_lon = math.degrees(new_lon_rad)
        
        return round(new_lat, 5), round(new_lon, 5)

# Testing the logic standalone
if __name__ == "__main__":
    engine = TrajectoryEngine()
    
    # Example: Ennore Spill (Dawn Kanchipuram)
    spill_lat = 12.0957
    spill_lon = 80.8360
    current_speed = 0.5  # meters per second
    current_dir = 45.0   # flowing North-East
    
    print(f"Oil found at: {spill_lat}, {spill_lon}")
    
    # 12 ghante pehle tel kahan tha?
    past_lat, past_lon = engine.calculate_reverse_drift(
        spill_lat, spill_lon, current_speed, current_dir, hours_back=12
    )
    
    print(f"12 Hours ago, Oil was leaked near: {past_lat}, {past_lon}")