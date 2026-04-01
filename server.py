#!/usr/bin/env python3
"""
FastAPI Federated Learning Server — PyTorch backend
Receives raw samples from clients, trains locally, aggregates via FedAvg
"""

import torch
import torch.nn as nn
import torch.optim as optim
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Any
import asyncio
from datetime import datetime
import uvicorn

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Federated Learning Server (PyTorch) started on http://localhost:8000")
    yield

app = FastAPI(title="Federated Learning Server (PyTorch)", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*", "http://localhost:*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model Architecture ────────────────────────────────────────────────────────

class MoodNet(nn.Module):
    """3 → 8 → 5 mood classifier"""
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(3, 8),
            nn.ReLU(),
            nn.Linear(8, 5)
        )

    def forward(self, x):
        return self.net(x)

    def get_weights(self) -> List[List[float]]:
        return [p.data.tolist() for p in self.parameters()]

    def set_weights(self, weights: list):
        """Accept weights as [w1_rows, b1, w2_rows, b2].
        Each element can be a nested list (matrix) or flat list (bias)."""
        import itertools
        def to_flat(w):
            if w and isinstance(w[0], list):
                return list(itertools.chain.from_iterable(w))
            return w
        with torch.no_grad():
            for param, w in zip(self.parameters(), weights):
                flat = to_flat(w)
                param.copy_(torch.tensor(flat, dtype=torch.float32).reshape(param.shape))

# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class Sample(BaseModel):
    x: List[float]   # [screen_time, tab_switches, domain_count]
    y: int           # mood label 0-4

class TrainRequest(BaseModel):
    client_id: str
    dataset: List[Sample]
    timestamp: str

class ModelWeightsUpdate(BaseModel):
    client_id: str
    weights: List[Any]   # [w1_rows, b1, w2_rows, b2] — mixed nesting
    num_samples: int
    timestamp: str

class GlobalModelResponse(BaseModel):
    weights: List[Any]   # [w1_rows, b1, w2_rows, b2]
    round: int
    timestamp: str

# ── Federated Aggregator ──────────────────────────────────────────────────────

class FederatedAggregator:
    def __init__(self):
        self.global_model = MoodNet()
        self.round = 0
        self.pending: list = []
        self._lock = asyncio.Lock()

    def train_on_samples(self, dataset: List[Sample], epochs: int = 20) -> tuple:
        """Train a fresh local model on client samples, return weights + sample count."""
        model = MoodNet()
        model.load_state_dict(self.global_model.state_dict())  # start from global

        xs = torch.tensor([[s.x[0], s.x[1], s.x[2]] for s in dataset], dtype=torch.float32)
        ys = torch.tensor([s.y for s in dataset], dtype=torch.long)

        optimizer = optim.Adam(model.parameters(), lr=0.01)
        criterion = nn.CrossEntropyLoss()

        model.train()
        for epoch in range(epochs):
            optimizer.zero_grad()
            loss = criterion(model(xs), ys)
            loss.backward()
            optimizer.step()
            if (epoch + 1) % 5 == 0:
                print(f"  epoch {epoch+1}/{epochs}  loss={loss.item():.4f}")

        return model.get_weights(), len(dataset)

    def fedavg(self, updates: list):
        """Weighted average of client weight lists."""
        import itertools
        def to_flat(w):
            if w and isinstance(w[0], list):
                return list(itertools.chain.from_iterable(w))
            return list(w)

        total = sum(n for _, n in updates)
        # Work in flat-list space, then set via set_weights
        flat_updates = [([to_flat(layer) for layer in weights], n) for weights, n in updates]

        avg = None
        for flat_layers, n in flat_updates:
            factor = n / total
            if avg is None:
                avg = [[v * factor for v in layer] for layer in flat_layers]
            else:
                for i, layer in enumerate(flat_layers):
                    for j, v in enumerate(layer):
                        avg[i][j] += v * factor

        self.global_model.set_weights(avg)
        self.round += 1
        print(f"[Server] FedAvg round {self.round} — {len(updates)} clients, {total} samples")

aggregator = FederatedAggregator()

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/api/train")
async def train_and_aggregate(req: TrainRequest):
    """
    Client sends raw samples → server trains locally with PyTorch →
    accumulates updates → runs FedAvg every 3 clients.
    """
    if not req.dataset:
        raise HTTPException(status_code=400, detail="Empty dataset")

    print(f"[Server] Training for client {req.client_id} ({len(req.dataset)} samples)")
    weights, n = aggregator.train_on_samples(req.dataset)

    async with aggregator._lock:
        aggregator.pending.append((weights, n))
        if len(aggregator.pending) >= 3:
            aggregator.fedavg(aggregator.pending)
            aggregator.pending.clear()

    return {"status": "ok", "round": aggregator.round}


@app.post("/api/model-update")
async def receive_weights(update: ModelWeightsUpdate):
    """
    Alternative: client sends pre-computed weights (for JS-side training path).
    """
    async with aggregator._lock:
        aggregator.pending.append((update.weights, update.num_samples))
        if len(aggregator.pending) >= 3:
            aggregator.fedavg(aggregator.pending)
            aggregator.pending.clear()

    return {"status": "ok", "round": aggregator.round}


@app.get("/api/global-model", response_model=GlobalModelResponse)
async def get_global_model():
    return GlobalModelResponse(
        weights=aggregator.global_model.get_weights(),
        round=aggregator.round,
        timestamp=datetime.now().isoformat()
    )


@app.post("/api/predict")
async def predict(features: List[float]):
    """Run inference on the global model."""
    if len(features) != 3:
        raise HTTPException(status_code=400, detail="Expected 3 features")
    x = torch.tensor([features], dtype=torch.float32)
    aggregator.global_model.eval()
    with torch.no_grad():
        logits = aggregator.global_model(x)
        label = int(logits.argmax(dim=1).item())
    return {"mood": label}


@app.get("/api/status")
async def status():
    return {
        "status": "running",
        "round": aggregator.round,
        "pending_updates": len(aggregator.pending),
        "timestamp": datetime.now().isoformat()
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}



if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
