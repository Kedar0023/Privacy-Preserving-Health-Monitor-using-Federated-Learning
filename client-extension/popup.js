// popup.js

// Import the saveMood function from our ES6 storage module
import { saveMood } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.mood-btn');
  const statusDiv = document.getElementById('status');
  
  // Attach click event listeners to all 5 mood buttons
  buttons.forEach(button => {
    button.addEventListener('click', async (e) => {
      // Get the mood value from the data-mood attribute of the clicked button
      const mood = e.currentTarget.getAttribute('data-mood');
      
      try {
        // Save the chosen mood using the storage module
        await saveMood(mood);
        
        // Display a brief success message in the popup
        statusDiv.textContent = `Successfully logged: ${mood}`;
        statusDiv.style.color = '#10b981';
        
        // Clear the status message after 2 seconds
        setTimeout(() => {
          statusDiv.textContent = '';
        }, 2000);
        
        // Send a message to the background service worker to trigger a notification
        chrome.runtime.sendMessage({ type: 'MOOD_LOGGED', mood }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending message to background script:', chrome.runtime.lastError);
          } else {
            console.log('Background processed the log:', response);
          }
        });
        
        // Demonstrate usage of the "tabs" permission by logging the active tab URL
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
           if (tabs.length > 0) {
               const activeTab = tabs[0];
               console.log(`Mood logged while on tab: ${activeTab.url}`);
               // Later, this could be used to associate the mood log with a specific URL for Federated Learning
           }
        });

      } catch (error) {
        // Handle potential errors (e.g. storage quota exceeded)
        console.error('Failed to log mood:', error);
        statusDiv.textContent = 'Error logging mood.';
        statusDiv.style.color = '#ef4444';
      }
    });
  });
});
