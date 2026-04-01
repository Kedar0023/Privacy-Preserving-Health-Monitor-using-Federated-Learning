// background.js

// Listen for the extension being installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('Mood Federated Learning Tracker extension installed.');
  
  // Initialize storage with an empty array for mood logs
  chrome.storage.local.set({ moodLogs: [] }, () => {
    console.log('Mood logs initialized.');
  });
});

// Event listener for messages sent from popup or other parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MOOD_LOGGED') {
    // Show a notification when a mood is logged
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon128.png', // Add an icon128.png file in the extension root for this to display properly
      title: 'Mood Tracker',
      message: `You recorded your mood as: ${message.mood}`,
      priority: 1
    }, (notificationId) => {
      // Check for errors (e.g. missing icon file)
      if (chrome.runtime.lastError) {
        console.warn("Notification error:", chrome.runtime.lastError.message);
      }
    });

    console.log(`Received mood log in background: ${message.mood}`);
    
    // Respond back to the sender
    sendResponse({ status: 'success' });
  }
});
