import json
import threading
import os
from typing import List, Dict
from schemas import WeightUpdate
from model import GlobalModel

GLOBAL_MODEL_FILE = "global_model.json"
_model_lock = threading.Lock()

def save_global_model(weights: Dict[str, List[float]]):
    """
    Save the global model weights securely to a JSON file.
    Thread-safe using a lock.
    """
    with _model_lock:
        data = {"weights": weights}
        with open(GLOBAL_MODEL_FILE, "w") as f:
            json.dump(data, f)

def load_global_model() -> Dict[str, List[float]]:
    """
    Load the global model weights from the JSON file safely.
    """
    with _model_lock:
        if not os.path.exists(GLOBAL_MODEL_FILE):
            return {}
            
        try:
            with open(GLOBAL_MODEL_FILE, "r") as f:
                data = json.load(f)
                return data.get("weights", {})
        except json.JSONDecodeError:
            print("Warning: Failed to decode global_model.json. Loading empty weights.")
            return {}

class Storage:
    def __init__(self):
        self.global_model = GlobalModel()
        self.client_updates: List[WeightUpdate] = []
        
        # Lock for safely collecting client updates from multiple concurrent HTTP threads
        self.updates_lock = threading.Lock()
        
        # Restore persistent model on startup
        loaded_weights = load_global_model()
        if loaded_weights:
            self.global_model.weights = loaded_weights
            # Note: We reset version tracking here on reboot, but you could 
            # choose to persist version inside the JSON file in the future.
            self.global_model.version = 1 

    def save_update(self, update: WeightUpdate):
        with self.updates_lock:
            self.client_updates.append(update)

    def get_updates(self) -> List[WeightUpdate]:
        with self.updates_lock:
            # Return a copy to prevent race conditions during iteration
            return list(self.client_updates)

    def clear_updates(self):
        with self.updates_lock:
            self.client_updates = []

    def update_global_model(self, new_weights: Dict[str, List[float]]):
        # Update in-memory state
        self.global_model.weights = new_weights
        self.global_model.version += 1
        
        # Persist to disk
        save_global_model(new_weights)

    def get_global_model(self) -> GlobalModel:
        return self.global_model

# Singleton instance for in-memory tracking & file synchronization
storage = Storage()
