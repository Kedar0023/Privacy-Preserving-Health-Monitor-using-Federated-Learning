from typing import List, Dict
from schemas import WeightUpdate
from model import GlobalModel

class Storage:
    def __init__(self):
        self.global_model = GlobalModel()
        self.client_updates: List[WeightUpdate] = []

    def save_update(self, update: WeightUpdate):
        self.client_updates.append(update)

    def get_updates(self) -> List[WeightUpdate]:
        return self.client_updates

    def clear_updates(self):
        self.client_updates = []

    def update_global_model(self, new_weights: Dict[str, List[float]]):
        self.global_model.weights = new_weights
        self.global_model.version += 1

    def get_global_model(self) -> GlobalModel:
        return self.global_model

# Singleton instance for in-memory storage
storage = Storage()
