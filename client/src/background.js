// background.js

const INITIAL_METRICS = {
  screen_time_minutes: 0,
  tab_switches: 0,
  unique_domains: 0
};

// Listen for the extension being installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('Mood Tracker with Telemetry installed.');
  
  // Initialize storage with mood logs and initial telemetry metrics
  chrome.storage.local.set({ 
    moodLogs: [],
    telemetry: INITIAL_METRICS,
    domainsSet: [],
    lastResetTime: Date.now()
  }, () => {
    console.log('Storage initialized.');
  });
  
  // 5. Track active browsing time every minute
  // Using chrome.alarms is the Manifest V3 best practice to persist execution, 
  // as setInterval/setTimeout might pause when the service worker sleeps.
  chrome.alarms.create("telemetry_minute_tick", { periodInMinutes: 1 });
  
  // Reset metrics every 60 minutes
  chrome.alarms.create("telemetry_reset", { periodInMinutes: 60 });
});

// Alarm listeners for our timed events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "telemetry_minute_tick") {
    // Increment the active screen time every minute
    chrome.storage.local.get(['telemetry'], (result) => {
      let telemetry = result.telemetry || { ...INITIAL_METRICS };
      telemetry.screen_time_minutes += 1;
      chrome.storage.local.set({ telemetry });
      console.log(`[Telemetry] Screen time: ${telemetry.screen_time_minutes} min`);
    });
  } else if (alarm.name === "telemetry_reset") {
    // Reset the tracking metrics
    chrome.storage.local.set({ 
      telemetry: INITIAL_METRICS,
      domainsSet: [],
      lastResetTime: Date.now()
    }, () => {
      console.log('[Telemetry] Metrics reset (60 min).');
    });
  }
});

// 3. Extract domain name from URLs safely
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    // Ignore extension, chrome, or local protocols
    if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
      return urlObj.hostname;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// 1. Detect tab switches using chrome.tabs.onActivated
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.storage.local.get(['telemetry'], (result) => {
    let telemetry = result.telemetry || { ...INITIAL_METRICS };
    
    // Increment our tab switcher counter
    telemetry.tab_switches += 1;
    chrome.storage.local.set({ telemetry });
    console.log(`[Telemetry] Tab switched. Total: ${telemetry.tab_switches}`);
  });
});

// 2. Detect URL changes using chrome.tabs.onUpdated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only process if the URL actually changed during this update step
  if (changeInfo.url) {
    const domain = extractDomain(changeInfo.url);
    if (domain) {
      chrome.storage.local.get(['telemetry', 'domainsSet'], (result) => {
        let telemetry = result.telemetry || { ...INITIAL_METRICS };
        let domainsSet = result.domainsSet || [];
        
        // 4. Count unique domains visited by storing them in an array
        if (!domainsSet.includes(domain)) {
          domainsSet.push(domain);
          telemetry.unique_domains = domainsSet.length;
          
          chrome.storage.local.set({ telemetry, domainsSet }, () => {
             console.log(`[Telemetry] Unique Domain visited: ${domain} | Total unique: ${telemetry.unique_domains}`);
          });
        }
      });
    }
  }
});

// (Previous) Listen for messages sent from popup or other parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MOOD_LOGGED') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon128.png', 
      title: 'Mood Tracker',
      message: `You recorded your mood as: ${message.mood}`,
      priority: 1
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.warn("Notification error:", chrome.runtime.lastError.message);
      }
    });

    console.log(`Received mood log in background: ${message.mood}`);
    sendResponse({ status: 'success' });
  }
});
