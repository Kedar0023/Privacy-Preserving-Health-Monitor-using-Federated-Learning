// popup.js

// Import the specific function from our new systems-level datasetManager
import { addSample } from './datasetManager.js';

const MOOD_LABELS = {
  'Happy': 0,
  'Sad': 1,
  'Angry': 2,
  'Tired': 3,
  'Stressed': 4
};

document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.mood-btn');
  const statusDiv = document.getElementById('status');
  const datasetStatusDiv = document.getElementById('dataset-status');

  // Check if training is pending on popup open
  chrome.storage.local.get(['pendingTraining'], async (result) => {
    if (result.pendingTraining) {
      console.log('[Popup] Found pending training, starting...');
      await handleTraining(result.pendingTraining);
      chrome.storage.local.set({ pendingTraining: null });
    }
  });

  // Listen for training messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_TRAINING') {
      console.log('[Popup] Received training request with dataset:', message.dataset);
      handleTraining(message.dataset);
      sendResponse({ status: 'training_started' });
    }
  });

  // Handle training in popup context where TensorFlow.js is available
  async function handleTraining(dataset) {
    try {
      console.log('[Popup] Starting federated learning training...');

      // 1. Train local model (delegates to PyTorch server)
      const { trainModel } = await import('./trainer_pytorch.js');
      const { federatedLearningRound } = await import('./federatedClient.js');

      const localModel = await trainModel(dataset);

      // 2. Perform federated learning round
      const updatedModel = await federatedLearningRound(localModel, dataset.length);

      // 3. Clear dataset after successful federated update
      const { clearDataset } = await import('./datasetManager.js');
      await clearDataset();

      console.log('[Popup] Federated learning round completed successfully');
      statusDiv.textContent = '✅ Training completed! Dataset cleared.';
      statusDiv.style.color = 'green';

      // Update dataset status
      datasetStatusDiv.textContent = 'Dataset: 0/10 samples | Training completed!';

    } catch (error) {
      console.error('[Popup] Federated learning failed:', error);
      statusDiv.textContent = '❌ Training failed. Check console.';
      statusDiv.style.color = 'red';
    }
  }

  // Update dataset status on load
  chrome.storage.local.get(['dataset', 'telemetry'], (result) => {
    const dataset = result.dataset || [];
    const telemetry = result.telemetry || { screen_time_minutes: 0, tab_switches: 0, unique_domains: 0 };
    datasetStatusDiv.textContent = `Dataset: ${dataset.length}/10 samples | Screen: ${telemetry.screen_time_minutes}m | Tabs: ${telemetry.tab_switches} | Sites: ${telemetry.unique_domains}`;
  });

  buttons.forEach(button => {
    button.addEventListener('click', (e) => {
      const mood = e.currentTarget.getAttribute('data-mood');
      const moodLabel = MOOD_LABELS[mood];

      // We no longer pull 'dataset' manually! Just telemetry metrics.
      chrome.storage.local.get(['telemetry'], async (result) => {

        const telemetry = result.telemetry || {
          screen_time_minutes: 0,
          tab_switches: 0,
          unique_domains: 0
        };

        const sample = {
          x: [
            telemetry.screen_time_minutes,
            telemetry.tab_switches,
            telemetry.unique_domains
          ],
          y: moodLabel
        };

        // Pass strictly to the designated system module manager to do dataset parsing.
        try {
          await addSample(sample);

          // Check dataset size for debugging
          chrome.storage.local.get(['dataset', 'telemetry'], (result) => {
            const dataset = result.dataset || [];
            const telemetry = result.telemetry || { screen_time_minutes: 0, tab_switches: 0, unique_domains: 0 };
            console.log(`[Popup] Dataset size after adding sample: ${dataset.length}`);
            console.log(`[Popup] Latest sample:`, sample);

            // Update status display
            datasetStatusDiv.textContent = `Dataset: ${dataset.length}/10 samples | Screen: ${telemetry.screen_time_minutes}m | Tabs: ${telemetry.tab_switches} | Sites: ${telemetry.unique_domains}`;
          });

          statusDiv.style.color = 'green';
          statusDiv.textContent = `Feedback registered! Dataset growing...`;

          setTimeout(() => {
            statusDiv.textContent = '';
          }, 2000);

        } catch (error) {
          console.error('[Popup] Systems integration failure:', error);
          statusDiv.style.color = 'red';
          statusDiv.textContent = 'Failed logic injection.';
        }
      });
    });
  });
});
