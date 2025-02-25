chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.clearAll(() => {
    setupAlarms();
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    "master-toggle": false,
    "twenty-toggle": false,
    "movement-toggle": false,
    "hydration-toggle": false,
    "posture-toggle": false,
    "stretch-toggle": false,
    "movement-interval": 60,
    "hydration-interval": 60,
    "posture-interval": 30,
    "stretch-interval": 120,
    "sound-enabled": true,
  });
  chrome.alarms.clearAll();
});

function setupAlarms() {
  chrome.storage.sync.get(null, (data) => {
    if (!data["master-toggle"]) return;

    const alarms = {
      twenty: { toggle: "twenty-toggle", interval: 20 },
      movement: {
        toggle: "movement-toggle",
        interval: data["movement-interval"],
      },
      hydration: {
        toggle: "hydration-toggle",
        interval: data["hydration-interval"],
      },
      posture: { toggle: "posture-toggle", interval: data["posture-interval"] },
      stretch: { toggle: "stretch-toggle", interval: data["stretch-interval"] },
    };

    // Clear all existing alarms first
    chrome.alarms.clearAll(() => {
      // Then create fresh alarms
      Object.entries(alarms).forEach(([name, config]) => {
        if (data[config.toggle]) {
          chrome.alarms.create(name, {
            periodInMinutes: parseInt(config.interval),
            when: Date.now() + parseInt(config.interval) * 60000, // Fresh start
          });
        }
      });
    });
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  chrome.storage.sync.get(["master-toggle", "sound-enabled"], (data) => {
    if (!data["master-toggle"]) return;
    const soundEnabled = data["sound-enabled"] ?? true;

    const notifications = {
      twenty: {
        title: "20-20-20 Rule Reminder",
        message: "Look at something 20 feet away for 20 seconds",
      },
      movement: {
        title: "Movement Reminder",
        message: "Time to stand up and move around!",
      },
      hydration: {
        title: "Hydration Reminder",
        message: "Time to drink some water!",
      },
      posture: {
        title: "Posture Check",
        message: "Check your posture and adjust if needed",
      },
      stretch: {
        title: "Stretch Break",
        message: "Time for a quick stretch!",
      },
    };

    if (notifications[alarm.name]) {
      const notificationId = `${alarm.name}-${Date.now()}`;
      chrome.notifications.create(notificationId, {
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: notifications[alarm.name].title,
        message: notifications[alarm.name].message,
        priority: 2,
        requireInteraction: false,
        silent: !soundEnabled,
      });

      setTimeout(() => {
        chrome.notifications.clear(notificationId);
      }, 5000);
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "updateAlarm") {
    const { alarmName, enabled, interval } = message;
    if (enabled) {
      chrome.alarms.create(alarmName, {
        periodInMinutes: parseInt(interval),
        when: Date.now() + parseInt(interval) * 60000,
      });
    } else {
      chrome.alarms.clear(alarmName);
    }
  } else if (message.type === "getAlarmInfo") {
    chrome.alarms.getAll((alarms) => {
      sendResponse({ alarms: alarms });
    });
    return true;
  } else if (message.type === "resetAllAlarms") {
    chrome.alarms.clearAll(() => {
      setupAlarms();
    });
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
});
