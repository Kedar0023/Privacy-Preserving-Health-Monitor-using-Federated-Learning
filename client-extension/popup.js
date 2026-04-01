// popup.js

// 2. Convert mood to numeric label mapping
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
      
      // 1. Retrieve activity metrics from chrome.storage.local
      chrome.storage.local.get(['telemetry', 'dataset'], (result) => {
        
        // Safely extract metrics; default to zero if tracking hasn't fully initialized yet
        const telemetry = result.telemetry || {
          screen_time_minutes: 0,
          tab_switches: 0,
          unique_domains: 0
        };
        
        // Ensure the dataset array is initialized
        let dataset = result.dataset || [];

        // 3. Create training sample formatting { x: [metrics...], y: label }
        const sample = {
          x: [
            telemetry.screen_time_minutes,
            telemetry.tab_switches,
            telemetry.unique_domains
          ],
          y: moodLabel
        };
        
        // 4. Save sample to dataset array stored in chrome.storage.local
        dataset.push(sample);
        
        chrome.storage.local.set({ dataset }, () => {
          if (chrome.runtime.lastError) {
            statusDiv.style.color = 'red';
            statusDiv.textContent = 'Error saving sample.';
            console.error(chrome.runtime.lastError);
            return;
          }
          
          statusDiv.style.color = 'green';
          statusDiv.textContent = 'Sample saved!';
          
          // Debugging console logs so you can verify the ML dataset looks correct
          console.log(`[ML Dataset] Added sample:`, sample);
          console.log(`[ML Dataset] Entire dataset:`, dataset);
          
          // Clear notification text after 2 seconds
          setTimeout(() => {
            statusDiv.textContent = '';
          }, 2000);
          
          // (Optional) Retained the ping to background scripts so desktop notifications still work
          chrome.runtime.sendMessage({ type: 'MOOD_LOGGED', mood });
        });
      });
    });
  });
});
