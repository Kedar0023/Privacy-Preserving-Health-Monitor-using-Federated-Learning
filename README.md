# Privacy-Preserving Health Monitor using Federated Learning

A Chrome extension that tracks mood and browsing behavior, training a neural network using federated learning — raw data never leaves your device.

## How it works

1. The extension passively tracks browsing metrics (screen time, tab switches, unique domains)
2. You log your mood via the popup
3. After 10 samples, training is sent to the PyTorch server
4. The server trains a local copy of the model on your data, then aggregates updates from all clients via FedAvg
5. Updated global weights are pushed back to your extension

## Architecture

```
Chrome Extension (client/)
├── background.js       — telemetry tracking via Chrome alarms + tab events
├── popup.js            — mood logging UI, triggers training flow
├── datasetManager.js   — sample storage, training threshold logic
├── trainer_pytorch.js  — JS neural net + delegates training to PyTorch server
└── federatedClient.js  — sends weights to server, fetches global model

Server (server.py)
└── FastAPI + PyTorch
    ├── POST /api/train         — receives raw samples, trains with PyTorch, queues for FedAvg
    ├── POST /api/model-update  — receives pre-computed weights (alternative path)
    ├── GET  /api/global-model  — returns current global weights
    ├── POST /api/predict       — runs inference on global model
    └── GET  /api/status        — round count, pending updates
```

### Model architecture

```
Input(3)  →  Linear(3→8)  →  ReLU  →  Linear(8→5)  →  Softmax
```

Features: `[screen_time_minutes, tab_switches, unique_domains]`  
Labels: `Happy(0), Sad(1), Angry(2), Tired(3), Stressed(4)`

## Setup

### Server

```bash
python -m venv venv
source venv/Scripts/activate   # Windows
pip install -r requirements.txt
python server.py
```

Runs on `http://localhost:8000`. Visit `/docs` for interactive API explorer.

### Chrome Extension

1. Go to `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked" → select the `client/` folder

No build step needed — the extension runs as plain ES modules.

## Verifying the model is actually learning

**Loss should decrease during training** — random baseline for 5 classes is `ln(5) ≈ 1.609`. If loss drops below that, the model is learning real patterns.

**Test predictions via curl:**
```bash
# High activity
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" -d "[120, 15, 8]"

# Low activity
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" -d "[5, 2, 1]"
```

**Inspect global weights:**
```bash
curl http://localhost:8000/api/global-model
```
Weights with varied magnitudes (not all near zero) indicate the model has trained. Biases and weight matrices will drift from their random initialization as more data is seen.

**Note:** With only 10 samples across 5 classes, predictions may cluster on one label. Accuracy improves as more mood entries are logged across different sessions and browsing patterns.

## API reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/train` | POST | Send raw samples for PyTorch training |
| `/api/model-update` | POST | Send pre-computed weights for FedAvg |
| `/api/global-model` | GET | Fetch current global model weights |
| `/api/predict` | POST | Predict mood from `[screen_time, tab_switches, domains]` |
| `/api/status` | GET | Round count and pending updates |
| `/health` | GET | Health check |
| `/docs` | GET | FastAPI interactive docs |

## Privacy

- Raw browsing data and mood logs never leave the device
- Only model weight updates are transmitted to the server
- No user identifiers beyond a randomly generated client ID stored in `localStorage`
- Telemetry resets every 60 minutes

## Federated averaging

The server aggregates client updates using weighted FedAvg (McMahan et al., 2017) — each client's contribution is weighted by its number of training samples. Aggregation runs every 3 client updates.

## Project structure

```
├── server.py               # FastAPI + PyTorch federated server
├── requirements.txt        # Python deps (torch, fastapi, uvicorn, pydantic, numpy)
├── client/
│   ├── manifest.json       # Chrome Manifest V3
│   ├── index.html          # Extension popup HTML
│   ├── style.css
│   └── src/
│       ├── background.js
│       ├── popup.js
│       ├── ui.js
│       ├── datasetManager.js
│       ├── trainer_pytorch.js
│       ├── federatedClient.js
│       └── storage.js
└── README.md
```

## Stack

- Chrome Extension — Manifest V3, ES modules, no bundler
- ML — PyTorch (server-side training), plain JS neural net (client-side fallback)
- Backend — FastAPI, Uvicorn
- Storage — Chrome `storage.local`

