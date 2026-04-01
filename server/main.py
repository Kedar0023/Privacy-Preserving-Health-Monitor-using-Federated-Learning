import asyncio
from fastapi import FastAPI
from schemas import WeightUpdate, GlobalModelResponse
from storage import storage
from aggregator import check_and_aggregate

app = FastAPI(title="Federated Learning Server")

# Condition to synchronize clients during a round
round_condition = asyncio.Condition()

@app.post("/update", response_model=GlobalModelResponse)
async def receive_update(update: WeightUpdate):
    """
    Receive client weights, wait for the threshold, and return the aggregated global model.
    """
    # Bootstrap the model dimension if it's completely empty
    current_model = storage.get_global_model()
    if not current_model.weights:
        empty_weights = {k: [0.0] * len(v) for k, v in update.weights.items()}
        storage.update_global_model(empty_weights)

    async with round_condition:
        # Store the client update
        storage.save_update(update)
        
        # Trigger an aggregation check (e.g. requires 3 updates to perform an aggregation step)
        if len(storage.get_updates()) >= 3:
            check_and_aggregate(threshold=3)
            # Notify all other clients waiting for this round to complete
            round_condition.notify_all()
        else:
            # Wait for the threshold to be reached by other clients
            await round_condition.wait()

    # Return the newly updated model
    model = storage.get_global_model()
    return GlobalModelResponse(
        version=model.version,
        weights=model.weights
    )

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
