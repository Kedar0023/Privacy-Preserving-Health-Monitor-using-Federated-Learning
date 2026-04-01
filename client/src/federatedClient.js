// federatedClient.js
// Communicates with the PyTorch federated server.
// No TensorFlow.js dependency.

const SERVER_URL = 'http://localhost:8000';

const getClientId = () => {
  let id = localStorage.getItem('fl_client_id');
  if (!id) {
    id = 'c_' + Math.random().toString(36).slice(2, 9);
    localStorage.setItem('fl_client_id', id);
  }
  return id;
};

/**
 * Send locally-computed weights to the server for FedAvg.
 * @param {{ getWeights: () => Array }} model
 * @param {number} numSamples
 */
export const sendModelUpdate = async (model, numSamples) => {
  const res = await fetch(`${SERVER_URL}/api/model-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: getClientId(),
      weights: model.getWeights(),
      num_samples: numSamples,
      timestamp: new Date().toISOString()
    })
  });
  if (!res.ok) throw new Error(`model-update failed: ${res.status}`);
  return res.json();
};

/**
 * Fetch current global model weights from server.
 * @returns {Promise<Array>}
 */
export const fetchGlobalModel = async () => {
  const res = await fetch(`${SERVER_URL}/api/global-model`);
  if (!res.ok) throw new Error(`global-model fetch failed: ${res.status}`);
  const { weights } = await res.json();
  return weights;
};

/**
 * Full federated round: send update → fetch global → return weights.
 * The caller is responsible for applying weights to the local model.
 *
 * @param {{ getWeights: () => Array }} localModel
 * @param {number} numSamples
 * @returns {Promise<Array>} updated global weights
 */
export const federatedLearningRound = async (localModel, numSamples) => {
  try {
    await sendModelUpdate(localModel, numSamples);
    const globalWeights = await fetchGlobalModel();
    console.log('[FederatedClient] Round complete.');
    return globalWeights;
  } catch (err) {
    console.warn('[FederatedClient] Round failed, keeping local model:', err.message);
    return null;
  }
};
