document.addEventListener("DOMContentLoaded", () => {
  const soundToggle = document.getElementById("sound-toggle");

  chrome.storage.sync.get(["sound-enabled"], (data) => {
    soundToggle.classList.toggle("muted", data["sound-enabled"] === false);
  });

  soundToggle.addEventListener("click", () => {
    soundToggle.classList.toggle("muted");
    chrome.storage.sync.set({
      "sound-enabled": !soundToggle.classList.contains("muted"),
    });
  });

  chrome.storage.sync.get(null, (data) => {
    Object.keys(data).forEach((key) => {
      const element = document.getElementById(key);
      if (element) {
        if (element.type === "checkbox") {
          element.checked = data[key];
        } else if (element.type === "number") {
          element.value = data[key];
        }
      }
    });

    updateDisabledState(data["master-toggle"]);
  });

  const saveSettings = (event) => {
    const element = event.target;

    // If it's a number input, ensure valid value
    if (element.type === "number") {
      const value = element.value.trim();
      if (value === "" || isNaN(value) || value < 1 || value > 240) {
        // Restore previous valid value
        chrome.storage.sync.get([element.id], (data) => {
          element.value = data[element.id];
        });
        return;
      }
    }

    const value = element.type === "checkbox" ? element.checked : element.value;
    chrome.storage.sync.set({ [element.id]: value });

    if (element.id === "master-toggle") {
      updateDisabledState(value);
      if (value) {
        chrome.runtime.sendMessage({ type: "resetAllAlarms" });
      } else {
        chrome.alarms.clearAll();
      }
      return;
    }

    chrome.storage.sync.get(["master-toggle"], (data) => {
      if (!data["master-toggle"]) return;

      const alarmName = element.id.split("-")[0];
      if (element.type === "checkbox") {
        if (value) {
          chrome.storage.sync.get([`${alarmName}-interval`], (data) => {
            chrome.alarms.create(alarmName, {
              periodInMinutes: parseInt(data[`${alarmName}-interval`] || 20),
              when:
                Date.now() +
                parseInt(data[`${alarmName}-interval`] || 20) * 60000,
            });
          });
        } else {
          chrome.alarms.clear(alarmName);
        }
      } else if (element.type === "number") {
        chrome.storage.sync.get([`${alarmName}-toggle`], (data) => {
          if (data[`${alarmName}-toggle`]) {
            chrome.alarms.create(alarmName, {
              periodInMinutes: parseInt(value),
              when: Date.now() + parseInt(value) * 60000,
            });
          }
        });
      }
    });
  };

  function updateDisabledState(masterEnabled) {
    const cards = document.querySelectorAll(".reminder-card");
    cards.forEach((card) => {
      masterEnabled
        ? card.classList.remove("disabled")
        : card.classList.add("disabled");
    });
  }

  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", saveSettings);

    if (input.type === "number") {
      // Prevent non-numeric input
      input.addEventListener("keypress", (e) => {
        if (!/[0-9]/.test(e.key)) {
          e.preventDefault();
        }
      });

      // Validate on blur
      input.addEventListener("blur", () => {
        const value = input.value.trim();
        if (value === "" || isNaN(value) || value < 1 || value > 240) {
          chrome.storage.sync.get([input.id], (data) => {
            input.value = data[input.id];
          });
        }
      });
    }
  });

  function updateProgressBars() {
    chrome.runtime.sendMessage({ type: "getAlarmInfo" }, (response) => {
      if (!response || !response.alarms) return;

      const now = Date.now();
      response.alarms.forEach((alarm) => {
        const progressElement = document.getElementById(
          `${alarm.name}-progress`,
        );
        if (progressElement) {
          const timeLeft = alarm.scheduledTime - now;
          const interval = alarm.periodInMinutes * 60 * 1000;
          const progress = Math.min(
            100,
            Math.max(0, ((interval - timeLeft) / interval) * 100),
          );
          progressElement.style.width = `${progress}%`;
        }
      });
    });
  }

  updateProgressBars();
  const progressInterval = setInterval(updateProgressBars, 1000);

  window.addEventListener("unload", () => {
    clearInterval(progressInterval);
  });
});
