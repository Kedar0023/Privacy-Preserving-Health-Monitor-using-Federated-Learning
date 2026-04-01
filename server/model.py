from typing import Dict, List

class GlobalModel:
    def __init__(self):
        self.version: int = 0
        self.weights: Dict[str, List[float]] = {}
