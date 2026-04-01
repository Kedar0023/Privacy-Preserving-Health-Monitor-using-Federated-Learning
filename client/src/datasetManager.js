// datasetManager.js

import { trainModel } from './trainer_pytorch.js';
import { federatedLearningRound } from './federatedClient.js';

const TRAINING_THRESHOLD = 10;

const triggerLocalModelTraining = async (dataset) => {
  console.log(`[datasetManager] ${dataset.length} samples — triggering training...`);

  chrome.runtime.sendMessage({ type: 'START_TRAINING', dataset }, (response) => {
    if (chrome.runtime.lastError) {
      // Popup is closed — store for next open
      chrome.storage.local.set({ pendingTraining: dataset });
      console.log('[datasetManager] Popup closed, dataset stored as pending.');
    } else {
      console.log('[datasetManager] Training started in popup.');
    }
  });
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

        // Trigger training exactly when threshold is hit, then clear will reset it
        if (dataset.length >= TRAINING_THRESHOLD) {
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
