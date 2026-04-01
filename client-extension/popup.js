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
          
          statusDiv.style.color = 'green';
          statusDiv.textContent = 'Feedback registered!';
          
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
