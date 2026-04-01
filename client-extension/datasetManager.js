// datasetManager.js

/**
 * A systems-level module for managing the Chrome Extension's Federated Learning Dataset.
 * Handles inserting samples, retrieving the dataset, and evaluating model thresholds.
 */

// A placeholder/stub for triggering local federated learning model training.
const triggerLocalModelTraining = async (dataset) => {
  console.log('================================================');
  console.log('🤖 Model Training Condition Met!');
  console.log(`📦 Triggering training with ${dataset.length} samples.`);
  console.log('📊 Current Dataset:', dataset);
  console.log('================================================');
  
  // TODO: Insert TensorFlow.js or FL framework training sequence here
};

/**
 * Adds a new training sample to the locally scaled dataset.
 * Evaluates the dataset threshold, and optionally triggers training dynamically.
 * 
 * @param {Object} sample - Expected format: { x: [screen_time, tab_switches, domain_count], y: mood_label }
 * @returns {Promise<void>}
 */
export const addSample = async (sample) => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['dataset'], (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      
      const dataset = result.dataset || [];
      dataset.push(sample);
      
      // Update the storage node with the new sample inclusive dataset list
      chrome.storage.local.set({ dataset }, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        
        console.log(`[datasetManager] Sample added successfully. Total size: ${dataset.length}`);
        
        // Evaluate model training condition (Dataset >= 10 examples)
        if (dataset.length >= 10) {
          triggerLocalModelTraining(dataset);
        }
        
        resolve();
      });
    });
  });
};

/**
 * Asynchronously retrieves the complete dataset payload.
 * 
 * @returns {Promise<Array>} The array of tracking objects stored in chrome storage.
 */
export const getDataset = async () => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['dataset'], (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(result.dataset || []);
    });
  });
};

/**
 * Returns the literal integer size of the overall dataset block.
 * 
 * @returns {Promise<number>} Current total length
 */
export const getDatasetSize = async () => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['dataset'], (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      const dataset = result.dataset || [];
      resolve(dataset.length);
    });
  });
};

/**
 * Cleans the data storage block, nullifying its length back to 0. 
 * Expected hook for post-training purges.
 * 
 * @returns {Promise<void>} 
 */
export const clearDataset = async () => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ dataset: [] }, () => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      console.log('[datasetManager] Dataset wiped from storage framework.');
      resolve();
    });
  });
};
