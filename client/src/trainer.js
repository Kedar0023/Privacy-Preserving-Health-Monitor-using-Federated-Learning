// trainer.js

// Note: This module relies on the global `tf` object from TensorFlow.js.
// You will need to import TensorFlow.js in your popup/background environment, typically:
// <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"></script> 
// Or via extreme ES modules if bundled.

// Global cache for our locally trained model
let localTrainedModel = null;

/**
 * Constructs the core TensorFlow network architecture.
 * @returns {tf.Sequential}
 */
const createModel = () => {
  const model = tf.sequential();
  
  // Input features: 3 (screen_time, tab_switches, domain_count)
  // Hidden Layer 1: Dense(8) with ReLU activation
  model.add(tf.layers.dense({
    inputShape: [3],
    units: 8,
    activation: 'relu'
  }));
  
  // Output Layer: Dense(5, softmax) for our 5 distinct mood classes
  model.add(tf.layers.dense({
    units: 5,
    activation: 'softmax'
  }));
  
  // We use Adam optimizer and Sparse Categorical Crossentropy 
  // since our target output (y) is an integer index (0-4), rather than a one-hot array.
  model.compile({
    optimizer: 'adam',
    loss: 'sparseCategoricalCrossentropy',
    metrics: ['accuracy']
  });
  
  return model;
};

/**
 * Preprocesses raw Javascript object arrays into TF-compatible Tensors.
 * Expected Dataset sample format: { x: [60, 20, 5], y: 1 }
 * 
 * @param {Array<Object>} dataset 
 * @returns {Object} Holds the parsed inputsTensor (2D) and labelsTensor (1D)
 */
const preprocessDataset = (dataset) => {
  // Map arrays from the raw standard object arrays into structural columns
  const features = dataset.map(sample => sample.x);
  const labels = dataset.map(sample => sample.y);
  
  // Convert into Tensors based on dimension properties
  const inputsTensor = tf.tensor2d(features, [features.length, 3]);
  const labelsTensor = tf.tensor1d(labels, 'int32');
  
  return { inputsTensor, labelsTensor };
};

/**
 * High-level orchestration for compiling the architecture, converting tensors, 
 * performing gradient descent, and evaluating parameters locally on edge.
 * 
 * @param {Array<Object>} dataset - Array dataset array holding metrics tracking.
 * @returns {Promise<tf.Sequential>} Returns the valid instantiated trained model instance.
 */
export const trainModel = async (dataset) => {
  if (!dataset || dataset.length === 0) {
    throw new Error('Federated dataset array is empty. Aborting local training loop.');
  }

  console.log(`[TF.js Model Trainer] Initializing Edge Training Sequence (${dataset.length} samples)`);
  
  // Parse inputs into specific multi-dimensional tensors
  const { inputsTensor, labelsTensor } = preprocessDataset(dataset);
  
  // Wipe legacy model states if updating iteratively
  if (localTrainedModel) {
     localTrainedModel.dispose();
  }
  
  localTrainedModel = createModel();
  
  console.log('[TF.js Model Trainer] Architecture instantiated. Training initialized...');
  
  // Execute rigid requirement of exactly 20 training epochs
  await localTrainedModel.fit(inputsTensor, labelsTensor, {
    epochs: 20,
    shuffle: true,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch + 1}/20 | Loss: ${logs.loss.toFixed(4)} | Accuracy: ${logs.acc.toFixed(4)}`);
      }
    }
  });

  console.log('[TF.js Model Trainer] Edge Training successfully processed!');

  // Actively manage browser memory by disposing tensors once computation finishes
  inputsTensor.dispose();
  labelsTensor.dispose();
  
  return localTrainedModel;
};

/**
 * Predicts output classification mapping (mood representation integer) based on 3 distinct metrics.
 * 
 * @param {Array<number>} features - e.g., [60, 20, 5] (screen_time, tab_switches, domain_count)
 * @returns {Promise<number>} Predicted label (integer index 0, 1, 2, 3, or 4).
 */
export const predictMood = async (features) => {
  if (!localTrainedModel) {
    throw new Error('Local Inference engine unavailable - Train initial model first.');
  }
  
  // Convert standard native Array into strict [1, 3] shaped Tensor validation format
  const inputTensor = tf.tensor2d([features], [1, 3]);
  
  // Predict evaluates our 5 probabilities SoftMax output array 
  const predictionProbsInfo = localTrainedModel.predict(inputTensor);
  
  // argMax quickly determines the actual literal Index representing max probabilistic score
  const predictedClassTensor = predictionProbsInfo.argMax(-1);
  const moodLabel = (await predictedClassTensor.data())[0];
  
  // Memory management
  inputTensor.dispose();
  predictionProbsInfo.dispose();
  predictedClassTensor.dispose();
  
  return moodLabel;
};
