from pydantic import BaseModel
from typing import Dict, List

class WeightUpdate(BaseModel):
    client_id: str
    weights: Dict[str, List[float]]
    num_samples: int

class GlobalModelResponse(BaseModel):
    version: int
    weights: Dict[str, List[float]]
