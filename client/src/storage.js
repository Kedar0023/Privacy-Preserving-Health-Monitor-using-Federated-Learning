// storage.js

/**
 * Save a new mood entry to Chrome's local storage.
 * @param {string} mood - The logged mood.
 * @returns {Promise<void>} Resolves when the mood is successfully saved.
 */
export const saveMood = async (mood) => {
  return new Promise((resolve, reject) => {
    // Retrieve the existing array of mood logs
    chrome.storage.local.get(['moodLogs'], (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      
      const logs = result.moodLogs || [];
      const newEntry = {
        mood,
        timestamp: new Date().toISOString()
      };
      
      // Append the new entry
      logs.push(newEntry);
      
      // Save the updated array back to storage
      chrome.storage.local.set({ moodLogs: logs }, () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        console.log('Mood saved successfully:', newEntry);
        resolve();
      });
    });
  });
};

/**
 * Retrieve all saved mood entries.
 * @returns {Promise<Array>} A promise resolving to an array of mood logs.
 */
export const getMoods = async () => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['moodLogs'], (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(result.moodLogs || []);
    });
  });
};
