from typing import List, Dict
from schemas import WeightUpdate
from storage import storage

def aggregate_weights(updates: List[WeightUpdate]) -> Dict[str, List[float]]:
    """
    Perform Federated Averaging (FedAvg) on the collected updates.
    """
    if not updates:
        return storage.get_global_model().weights

    total_samples = sum(u.num_samples for u in updates)
    aggregated_weights: Dict[str, List[float]] = {}

    # Initialize the aggregated_weights structure based on the first client
    first_update_weights = updates[0].weights
    for layer_name, weights in first_update_weights.items():
        aggregated_weights[layer_name] = [0.0] * len(weights)

    # Calculate the weighted average of the weights across all clients
    for update in updates:
        weight_factor = update.num_samples / total_samples
        for layer_name, weights in update.weights.items():
            for i, val in enumerate(weights):
                aggregated_weights[layer_name][i] += val * weight_factor

    return aggregated_weights

def check_and_aggregate(threshold: int = 3):
    """
    Check if we received enough client updates. If threshold is met, 
    aggregate them and update the global model.
    """
    updates = storage.get_updates()
    if len(updates) >= threshold:
        new_weights = aggregate_weights(updates)
        storage.update_global_model(new_weights)
        storage.clear_updates()
        return True
    return False
