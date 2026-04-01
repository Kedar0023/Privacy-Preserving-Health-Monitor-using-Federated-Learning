// trainer_pytorch.js
// Lightweight JS neural net — mirrors the PyTorch MoodNet on the server.
// Architecture: Linear(3→8, ReLU) → Linear(8→5, softmax)

const SERVER_URL = 'http://localhost:8000';

// ── Math helpers ──────────────────────────────────────────────────────────────

const relu = x => Math.max(0, x);
const softmax = arr => {
  const max = Math.max(...arr);
  const exps = arr.map(v => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(v => v / sum);
};

// Matrix multiply: (m×n) · (n×p) stored as flat row-major arrays
const matmul = (A, B, m, n, p) => {
  const C = new Float32Array(m * p);
  for (let i = 0; i < m; i++)
    for (let k = 0; k < n; k++)
      for (let j = 0; j < p; j++)
        C[i * p + j] += A[i * n + k] * B[k * p + j];
  return C;
};

// ── Model state ───────────────────────────────────────────────────────────────

// Weights stored as flat Float32Arrays matching PyTorch parameter order:
//   w1 [3×8], b1 [8], w2 [8×5], b2 [5]
let w1 = new Float32Array(3 * 8).map(() => (Math.random() - 0.5) * 0.5);
let b1 = new Float32Array(8);
let w2 = new Float32Array(8 * 5).map(() => (Math.random() - 0.5) * 0.5);
let b2 = new Float32Array(5);

// ── Forward pass ──────────────────────────────────────────────────────────────

const forward = (x) => {
  // hidden = relu(x @ w1 + b1)
  const h = matmul(new Float32Array(x), w1, 1, 3, 8);
  for (let i = 0; i < 8; i++) h[i] = relu(h[i] + b1[i]);

  // logits = h @ w2 + b2
  const logits = matmul(h, w2, 1, 8, 5);
  for (let i = 0; i < 5; i++) logits[i] += b2[i];

  return Array.from(softmax(Array.from(logits)));
};

// ── Apply weights from server ─────────────────────────────────────────────────

const applyWeights = (weights) => {
  // weights = [w1_rows, b1, w2_rows, b2] — each is a nested or flat array
  const flat = (arr) => Float32Array.from(arr.flat ? arr.flat(Infinity) : arr);
  w1 = flat(weights[0]);
  b1 = flat(weights[1]);
  w2 = flat(weights[2]);
  b2 = flat(weights[3]);
};

const getWeights = () => [
  Array.from(w1).reduce((rows, v, i) => {
    const r = Math.floor(i / 8); rows[r] = rows[r] || []; rows[r].push(v); return rows;
  }, []),
  Array.from(b1),
  Array.from(w2).reduce((rows, v, i) => {
    const r = Math.floor(i / 5); rows[r] = rows[r] || []; rows[r].push(v); return rows;
  }, []),
  Array.from(b2)
];

// ── Training — delegated to PyTorch server ────────────────────────────────────

/**
 * Sends dataset to server for PyTorch training, then syncs global weights back.
 * Falls back to a simple JS SGD loop if the server is unreachable.
 *
 * @param {Array<{x: number[], y: number}>} dataset
 * @returns {Promise<{getWeights, forward}>}
 */
export const trainModel = async (dataset) => {
  if (!dataset || dataset.length === 0)
    throw new Error('Dataset is empty.');

  console.log(`[Trainer] Sending ${dataset.length} samples to PyTorch server...`);

  try {
    const clientId = localStorage.getItem('fl_client_id') ||
      (() => { const id = 'c_' + Math.random().toString(36).slice(2, 9); localStorage.setItem('fl_client_id', id); return id; })();

    const res = await fetch(`${SERVER_URL}/api/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, dataset, timestamp: new Date().toISOString() })
    });

    if (!res.ok) throw new Error(`Server ${res.status}`);
    console.log('[Trainer] Server training done, fetching global model...');

    // Pull updated global weights
    const modelRes = await fetch(`${SERVER_URL}/api/global-model`);
    if (modelRes.ok) {
      const { weights } = await modelRes.json();
      applyWeights(weights);
      console.log('[Trainer] Global weights applied.');
    }

  } catch (err) {
    console.warn('[Trainer] Server unreachable, running local JS fallback:', err.message);
    _localTrain(dataset);
  }

  return { getWeights, forward };
};

// ── Local JS fallback (SGD, cross-entropy) ────────────────────────────────────

const _localTrain = (dataset, lr = 0.01, epochs = 20) => {
  for (let ep = 0; ep < epochs; ep++) {
    let loss = 0;
    for (const { x, y } of dataset) {
      const probs = forward(x);
      loss -= Math.log(probs[y] + 1e-9);

      // Backprop — output layer gradient
      const dLogits = [...probs];
      dLogits[y] -= 1;

      // hidden activations
      const h = matmul(new Float32Array(x), w1, 1, 3, 8);
      for (let i = 0; i < 8; i++) h[i] = relu(h[i] + b1[i]);

      // dw2, db2
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 5; j++)
          w2[i * 5 + j] -= lr * h[i] * dLogits[j];
      for (let j = 0; j < 5; j++) b2[j] -= lr * dLogits[j];

      // dh
      const dh = new Float32Array(8);
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 5; j++)
          dh[i] += w2[i * 5 + j] * dLogits[j];

      // relu gate
      const preAct = matmul(new Float32Array(x), w1, 1, 3, 8);
      for (let i = 0; i < 8; i++) if (preAct[i] + b1[i] <= 0) dh[i] = 0;

      // dw1, db1
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 8; j++)
          w1[i * 8 + j] -= lr * x[i] * dh[j];
      for (let j = 0; j < 8; j++) b1[j] -= lr * dh[j];
    }
    if ((ep + 1) % 5 === 0)
      console.log(`[Trainer] epoch ${ep + 1}/${epochs}  loss=${(loss / dataset.length).toFixed(4)}`);
  }
};

// ── Predict ───────────────────────────────────────────────────────────────────

/**
 * @param {number[]} features - [screen_time, tab_switches, domain_count]
 * @returns {Promise<number>} mood label 0-4
 */
export const predictMood = async (features) => {
  const probs = forward(features);
  return probs.indexOf(Math.max(...probs));
};
