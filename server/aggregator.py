import numpy as np
from typing import List, Dict, Any
from schemas import WeightUpdate
from storage import storage

def aggregate_weights(client_updates: List[Dict[str, Any]], num_samples_list: List[int] = None) -> Dict[str, np.ndarray]:
    """
    Perform Federated Averaging (FedAvg) using numpy on a list of client weight updates.
    
    Args:
        client_updates: A list containing dictionaries of client weights.
                        Example: [ weights_client1, weights_client2, ... ]
        num_samples_list: A list of integers representing the number of samples per client.
    
    Returns:
        aggregated_global_weights: A dictionary of the averaged layer weights.
    """
    if not client_updates:
        raise ValueError("No client updates provided for aggregation.")

    num_clients = len(client_updates)
    if num_samples_list is None:
        num_samples_list = [1] * num_clients
        
    total_samples = sum(num_samples_list)
    if total_samples == 0:
        total_samples = 1 # Avoid division by zero
    aggregated_weights = {}
    
    # Use the first client's update as the reference for shapes
    reference_weights = client_updates[0]
    
    for layer_name, layer_weights in reference_weights.items():
        # Convert to numpy array for numerical operations and shape validation
        ref_array = np.array(layer_weights)
        base_shape = ref_array.shape
        
        # Initialize accumulator for the mean
        accumulator = np.zeros(base_shape)
        
        for i, client_w in enumerate(client_updates):
            if layer_name not in client_w:
                raise ValueError(f"Missing layer '{layer_name}' in client update index {i}.")
            
            client_array = np.array(client_w[layer_name])
            
            # Validate shape matches the reference client exactly
            if client_array.shape != base_shape:
                raise ValueError(
                    f"Shape mismatch for layer '{layer_name}' in client update index {i}: "
                    f"expected {base_shape}, got {client_array.shape}."
                )
                
            accumulator += client_array * (num_samples_list[i] / total_samples)
            
        # Compute the weighted average for the current layer
        aggregated_global_weights = accumulator
        aggregated_weights[layer_name] = aggregated_global_weights
        
    return aggregated_weights

def check_and_aggregate(threshold: int = 3):
    """
    Check if we received enough client updates. If threshold is met, 
    aggregate them and update the global model.
    """
    updates = storage.get_updates()
    if len(updates) >= threshold:
        # Extract just the raw weights dictionary for the new aggregator function
        client_weights_list = [u.weights for u in updates]
        num_samples_list = [u.num_samples for u in updates]
        
        try:
            # Perform robust numpy averaging
            new_weights_np = aggregate_weights(client_weights_list, num_samples_list)
            
            # Convert numpy arrays back to standard Python lists for JSON serialization in the API
            new_weights_list = {k: v.tolist() for k, v in new_weights_np.items()}
            
            storage.update_global_model(new_weights_list)
            storage.clear_updates()
            return True
        except ValueError as e:
            print(f"Aggregation failed: {e}")
            # If clients send malformed data shapes, optionally clear updates and try again later
            storage.clear_updates()
            return False
            
    return False
