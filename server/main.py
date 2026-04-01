from fastapi import FastAPI, BackgroundTasks
from schemas import WeightUpdate, GlobalModelResponse
from storage import storage
from aggregator import check_and_aggregate

app = FastAPI(title="Federated Learning Server")

@app.post("/update", response_model=dict)
async def receive_update(update: WeightUpdate, background_tasks: BackgroundTasks):
    """
    Receive client weights and periodically run aggregation.
    """
    # Bootstrap the model dimension if it's completely empty
    current_model = storage.get_global_model()
    if not current_model.weights:
        empty_weights = {k: [0.0] * len(v) for k, v in update.weights.items()}
        storage.update_global_model(empty_weights)

    # Store the client update
    storage.save_update(update)
    
    # Trigger an aggregation check (e.g. requires 3 updates to perform an aggregation step)
    background_tasks.add_task(check_and_aggregate, threshold=3)

    return {"status": "success", "message": "Weights received successfully."}

@app.get("/global-model", response_model=GlobalModelResponse)
async def get_global_model():
    """
    Return the current state of the global model.
    """
    model = storage.get_global_model()
    return GlobalModelResponse(
        version=model.version,
        weights=model.weights
    )

if __name__ == "__main__":
    import uvicorn
    # uvicorn main:app --reload can be run from the CLI
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
