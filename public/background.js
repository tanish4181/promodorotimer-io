// This script runs in the background and manages the core logic of the Pomodoro timer.
class PomodoroBackground {
  constructor() {
    // The main state object for the extension.
    this.state = {
      timerState: "focus", // The current state of the timer ('focus', 'shortBreak', 'longBreak').
      currentTime: 25 * 60, // The current time in seconds.
      isRunning: false, // Whether the timer is currently running.
      currentMode: "focus", // The current timer mode.
      sessionCount: 1, // The number of focus sessions completed in the current cycle.
      totalSessions: 0, // The total number of focus sessions completed.
      isLockedIn: false,
      lockedInSessions: 0,
      settings: {
        focusTime: 25,
        shortBreak: 5,
        longBreak: 15,
        sessionsUntilLongBreak: 4,
        autoStartBreaks: true,
        autoStartPomodoros: false,
        notifications: true,
        sounds: true,
        soundType: "ding",
        breakReminders: true,
        enforceBreaks: true,
        youtubeIntegration: true,
        youtubeDistractionMode: "focus",
        breakOverlay: true,
        breakCountdown: true,
        nextSessionInfo: true,
        focusOverlay: false,
        hideDistractions: true,
        focusIndicator: true,
        websiteBlocking: true,
        breakBlockAll: false,
        breakUseAllowlist: true,
        hideYoutubeComments: false,
        hideYoutubeRecommendations: false,
        hideYoutubeShorts: false,
        pauseYoutubeBreaks: true,
        collectStats: true,
      },
      blockedWebsites: [], // A list of websites to block.
      allowedWebsites: [], // A list of websites to always allow.
      todos: [], // The user's to-do list.
      nextSessionInfo: null,
    };

    this.lastTickTime = 0; // Used to calculate time drift when the extension is inactive.
    this.alarmName = "pomodoroTimer"; // The name of the alarm used for the timer.

    this.initialize();
  }

  // Initializes the background script by loading the state and setting up listeners.
  async initialize() {
    try {
      await this.loadState();

      // Listen for messages from other parts of the extension.
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // Indicates that the response will be sent asynchronously.
      });

      // Listen for changes to the settings in storage.
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "local" && changes.settings) {
          this.state.settings = changes.settings.newValue;
          if (!this.state.isRunning) {
            this.resetTimer();
          }
          this.broadcastUpdate();
        }
      });

      // Listen for the timer alarm.
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === this.alarmName) {
          this.handleTimerTick();
        }
      });

      // Handle extension lifecycle events.
      chrome.runtime.onStartup.addListener(() => this.loadState());
      chrome.runtime.onInstalled.addListener(() => this.initializeDefaultState());
    } catch (error) {
      console.error("Error initializing background script:", error);
    }
  }

  // Loads the extension's state from local storage.
  async loadState() {
    try {
      const result = await chrome.storage.local.get([
        "timerState", "currentTime", "isRunning", "currentMode",
        "sessionCount", "totalSessions", "settings", "lastActiveTime",
        "blockedWebsites", "allowedWebsites", "todos", "isLockedIn", "lockedInSessions"
      ]);

      if (result.timerState) {
        const defaultSettings = this.state.settings;
        this.state = { ...this.state, ...result };
        // Merge loaded settings with defaults to ensure new settings are not missing.
        this.state.settings = { ...defaultSettings, ...this.state.settings };

        // Adjust for time drift if the timer was running while the extension was inactive.
        if (this.state.isRunning && result.lastActiveTime) {
          const timeDrift = Math.floor((Date.now() - result.lastActiveTime) / 1000);
          this.state.currentTime = Math.max(0, this.state.currentTime - timeDrift);
          if (this.state.currentTime === 0) {
            await this.handleTimerComplete();
          }
        }
      }
    } catch (error) {
      console.error("Error loading state:", error);
      await this.initializeDefaultState();
    }
  }

  // Saves the current state to local storage.
  async saveState() {
    try {
      await chrome.storage.local.set({
        ...this.state,
        lastActiveTime: Date.now(),
      });
    } catch (error) {
      console.error("Error saving state:", error);
    }
  }

  // Initializes the default state of the extension.
  async initializeDefaultState() {
    this.state = {
      timerState: "focus",
      currentTime: 25 * 60,
      isRunning: false,
      currentMode: "focus",
      sessionCount: 1,
      totalSessions: 0,
      settings: {
        focusTime: 25,
        shortBreak: 5,
        longBreak: 15,
        sessionsUntilLongBreak: 4,
        autoStartBreaks: true,
        autoStartPomodoros: false,
        notifications: true,
        sounds: true,
        soundType: "ding",
        breakReminders: true,
        enforceBreaks: true,
        youtubeIntegration: true,
        youtubeDistractionMode: "focus",
        breakOverlay: true,
        breakCountdown: true,
        nextSessionInfo: true,
        focusOverlay: false,
        hideDistractions: true,
        focusIndicator: true,
        websiteBlocking: true,
        breakBlockAll: false,
        breakUseAllowlist: true,
        hideYoutubeComments: false,
        hideYoutubeRecommendations: false,
        hideYoutubeShorts: false,
        pauseYoutubeBreaks: true,
        collectStats: true,
      },
      blockedWebsites: [],
      allowedWebsites: [],
      todos: [],
      nextSessionInfo: null,
    };
    await this.saveState();
  }

  // Handles messages from other parts of the extension.
  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case "GET_STATE":
          sendResponse({ state: this.state });
          break;
        case "SETTINGS_UPDATED":
          await this.updateSettings(message.settings);
          sendResponse({ success: true });
          break;
        case "START_TIMER":
          await this.startTimer();
          sendResponse({ success: true });
          break;
        case "START_TIMER_LOCKED":
          this.state.isLockedIn = true;
          this.state.lockedInSessions = message.sessions || this.state.settings.sessionsUntilLongBreak;
          await this.startTimer();
          sendResponse({ success: true });
          break;
        case "PAUSE_TIMER":
          await this.pauseTimer();
          sendResponse({ success: true });
          break;
        case "RESET_TIMER":
          await this.resetTimer();
          sendResponse({ success: true });
          break;
        case "SKIP_BREAK":
          await this.skipBreak();
          sendResponse({ success: true });
          break;
        case "TEST_NOTIFICATION":
          await this.showNotification();
          sendResponse({ success: true });
          break;
        case "TEST_SOUND":
          await this.playSound(message.soundType);
          sendResponse({ success: true });
          break;
        case "ADD_BLOCKED_WEBSITE":
          await this.addBlockedWebsite(message.website);
          sendResponse({ success: true });
          break;
        case "REMOVE_BLOCKED_WEBSITE":
          await this.removeBlockedWebsite(message.website);
          sendResponse({ success: true });
          break;
        case "GET_BLOCKED_WEBSITES":
          sendResponse({ websites: this.state.blockedWebsites });
          break;
        case "TODOS_UPDATED":
          this.state.todos = message.todos;
          await this.saveState();
          sendResponse({ success: true });
          break;
        case "GET_TODOS":
          sendResponse({ todos: this.state.todos });
          break;
        case "WEBSITE_LISTS_UPDATED":
          this.state.allowedWebsites = message.allowlist || [];
          this.state.blockedWebsites = message.blocklist || [];
          this.saveState();
          this.broadcastUpdate();
          sendResponse({ success: true });
          break;
        case "CHECK_WEBSITE_BLOCKED":
          sendResponse(this.isUrlBlocked(message.url));
          break;
        case "CLOSE_CURRENT_TAB":
          if (sender.tab) {
            chrome.tabs.remove(sender.tab.id);
          }
          break;
        default:
          sendResponse({ error: "Unknown message type" });
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({ error: error.message });
    }
  }

  // Updates the settings and broadcasts the changes.
  async updateSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings };
    if (!this.state.isRunning && this.state.currentMode === "focus") {
      this.state.currentTime = this.state.settings.focusTime * 60;
    }
    await this.saveState();
    this.broadcastUpdate();
  }

  // Starts the timer.
  async startTimer() {
    this.state.isRunning = true;
    this.lastTickTime = Date.now();
    chrome.alarms.create(this.alarmName, { periodInMinutes: 1 / 60 }); // Fire every second.

    if (this.state.settings.youtubeIntegration && this.state.currentMode === "focus") {
      this.notifyContentScripts({ type: "TIMER_STARTED" });
    }

    await this.saveState();
    this.broadcastUpdate();
  }

  // Pauses the timer.
  async pauseTimer() {
    if (this.state.isLockedIn) return;
    this.state.isRunning = false;
    chrome.alarms.clear(this.alarmName);

    if (this.state.settings.youtubeIntegration) {
      this.notifyContentScripts({ type: "TIMER_PAUSED" });
    }

    await this.saveState();
    this.broadcastUpdate();
  }

  // Resets the timer to the beginning of the current mode.
  async resetTimer() {
    if (this.state.isLockedIn) return;
    this.state.isRunning = false;
    chrome.alarms.clear(this.alarmName);

    const timeMap = {
      focus: this.state.settings.focusTime * 60,
      shortBreak: this.state.settings.shortBreak * 60,
      longBreak: this.state.settings.longBreak * 60,
    };
    this.state.currentTime = timeMap[this.state.currentMode];

    await this.saveState();
    this.broadcastUpdate();
  }

  // Skips the current break and starts the next focus session.
  async skipBreak() {
    if (this.state.isLockedIn) return;
    this.state.currentMode = "focus";
    this.state.currentTime = this.state.settings.focusTime * 60;
    this.state.isRunning = false;
    this.state.nextSessionInfo = null; // Clear next session info

    this.notifyContentScripts({ type: "BREAK_SKIPPED" });

    await this.saveState();
    this.broadcastUpdate();
  }

  // Called by the alarm to update the timer every second.
  handleTimerTick() {
    if (!this.state.isRunning) {
      chrome.alarms.clear(this.alarmName);
      return;
    }

    const now = Date.now();
    const elapsed = Math.round((now - this.lastTickTime) / 1000);
    this.lastTickTime = now;

    if (this.state.currentTime > 0) {
      this.state.currentTime = Math.max(0, this.state.currentTime - elapsed);
      this.broadcastUpdate();
    }

    if (this.state.currentTime === 0) {
      this.handleTimerComplete();
    }
  }

  // Handles the completion of a timer.
  async handleTimerComplete() {
    this.state.isRunning = false;
    chrome.alarms.clear(this.alarmName);
    let lockInJustCompleted = false; // Flag to detect when the lock ends

    if (this.state.settings.notifications) {
      await this.showNotification();
    }

    if (this.state.settings.sounds) {
      try {
        await this.playSound();
      } catch (e) {
        console.error("Error playing sound:", e);
      }
    }

    if (this.state.currentMode === "focus") {
      this.state.totalSessions++;
      await this.recordSession();

      if (this.state.isLockedIn) {
        this.state.lockedInSessions--;
        if (this.state.lockedInSessions <= 0) {
          this.state.isLockedIn = false;
          lockInJustCompleted = true; // Set the flag: the lock is now off
        }
      }
    }

    await this.switchToNextMode();

    // Only auto-start if the lock-in mode didn't just complete
    if (this.shouldAutoStart() && !lockInJustCompleted) {
      setTimeout(() => this.startTimer(), 1000);
    }

    await this.saveState();
    this.broadcastUpdate();
  }

  async switchToNextMode() {
    if (this.state.currentMode === "focus") {
      const isLongBreak =
        this.state.sessionCount % this.state.settings.sessionsUntilLongBreak ===
        0;

      this.state.currentMode = isLongBreak ? "longBreak" : "shortBreak";
      this.state.currentTime = isLongBreak
        ? this.state.settings.longBreak * 60
        : this.state.settings.shortBreak * 60;

      this.state.sessionCount++;
      this.state.nextSessionInfo = this.getNextSessionInfo(); // Store next session info in state

      if (this.state.settings.pauseYoutubeBreaks) {
        this.notifyContentScripts({ type: "PAUSE_ALL_YOUTUBE_TABS" });
      }

    } else {
      this.state.currentMode = "focus";
      this.state.currentTime = this.state.settings.focusTime * 60;
      this.state.nextSessionInfo = null; // Clear next session info
    }
  }

  getNextSessionInfo() {
    const isLongBreak =
      this.state.sessionCount % this.state.settings.sessionsUntilLongBreak ===
      0;
    const sessionsUntilLongBreak =
      this.state.settings.sessionsUntilLongBreak -
      (this.state.sessionCount % this.state.settings.sessionsUntilLongBreak);

    return {
      nextMode: "focus",
      nextDuration: this.state.settings.focusTime,
      sessionsUntilLongBreak: sessionsUntilLongBreak,
      isLongBreak: isLongBreak,
    };
  }

  shouldAutoStart() {
    return (
      (this.state.currentMode === "focus" &&
        this.state.settings.autoStartPomodoros) ||
      ((this.state.currentMode === "shortBreak" ||
        this.state.currentMode === "longBreak") &&
        this.state.settings.autoStartBreaks)
    );
  }

  async showNotification() {
    const messages = {
      focus: "Time for a break! You've completed a focus session.",
      shortBreak: "Break time is over! Ready to focus?",
      longBreak: "Long break complete! Time to get back to work.",
    };

    const message = messages[this.state.currentMode] || "Timer completed!";

    try {
      await chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Pomodoro Timer",
        message: message,
        priority: 2,
        requireInteraction: false,
        silent: false
      });
    } catch (error) {
      console.error("[v0] Error showing notification:", error);
    }
  }

  async ensureOffscreenDocument() {
    if (await chrome.offscreen.hasDocument?.()) return;
    try {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play short completion sounds when timers finish.'
      });
    } catch (e) {
      // Ignore if it already exists or offscreen unsupported
    }
  }

  async playSound(soundOverride) {
    try {
      await this.ensureOffscreenDocument();
      const sound = soundOverride || this.state.settings.soundType || 'ding'
      await chrome.runtime.sendMessage({ type: 'PLAY_SOUND', sound });
    } catch (e) {
      console.error('[v0] playSound failed:', e);
    }
  }

  async recordSession() {
    if (!this.state.settings.collectStats) return;

    const today = new Date().toISOString().split("T")[0];

    try {
      const result = await chrome.storage.local.get("dailyStats");
      const dailyStats = result.dailyStats || {};

      if (!dailyStats[today]) {
        dailyStats[today] = {
          focusSessions: 0,
          focusTime: 0,
          breakTime: 0,
        };
      }

      dailyStats[today].focusSessions++;
      dailyStats[today].focusTime += this.state.settings.focusTime;

      await chrome.storage.local.set({ dailyStats });
      console.log("[v0] Session recorded for", today);
      try {
        chrome.runtime.sendMessage({ type: "STATS_UPDATED" });
      } catch (e) {
        // ignore if stats page not open
      }
    } catch (error) {
      console.error("[v0] Error recording session:", error);
    }
  }

  async addBlockedWebsite(website) {
    if (!this.state.blockedWebsites.includes(website)) {
      this.state.blockedWebsites.push(website);
      await this.saveState();
      console.log("[v0] Website blocked:", website);
    }
  }

  async removeBlockedWebsite(website) {
    this.state.blockedWebsites = this.state.blockedWebsites.filter(
      (w) => w !== website
    );
    await this.saveState();
    console.log("[v0] Website unblocked:", website);
  }

  _isUrlInList(url, list) {
    if (!url || !list || list.length === 0) {
      return false;
    }
    try {
      const urlHostname = new URL(url).hostname.toLowerCase();
      for (const domain of list) {
        const lowerCaseDomain = domain.toLowerCase();
        if (urlHostname === lowerCaseDomain || urlHostname.endsWith(`.${lowerCaseDomain}`)) {
          return true;
        }
      }
    } catch (error) {
      console.error(`[v0] Invalid URL format for blocking check: ${url}`, error);
      return false;
    }
    return false;
  }

  isUrlBlocked(url) {
    // 1. Master switch for the entire feature
    if (!this.state.settings.websiteBlocking) {
      return { blocked: false };
    }

    const { isRunning, currentMode, settings } = this.state;
    const isBreak = currentMode === 'shortBreak' || currentMode === 'longBreak';

    // 2. Break-time blocking is now handled exclusively by break-enforcer.js
    if (isRunning && isBreak) {
        return { blocked: false };
    }

    // 3. Allowlist is the highest priority for focus and idle modes
    if (this._isUrlInList(url, this.state.allowedWebsites)) {
      return { blocked: false };
    }

    // 4. Focus-time blocking logic
    if (isRunning && currentMode === 'focus') {
      return { blocked: true, reason: 'focus' };
    }

    // 5. Idle-time blocking logic (timer is not running)
    if (!isRunning) {
      if (this._isUrlInList(url, this.state.blockedWebsites)) {
        return { blocked: true, reason: 'blocklist' };
      }
    }

    // 6. Default case: If no other rule applies, do not block the site.
    return { blocked: false };
  }

  broadcastUpdate() {
    console.log("[v0] Broadcasting update");

    // Send update to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        try {
          chrome.tabs.sendMessage(tab.id, {
            type: "TIMER_UPDATE",
            state: this.state,
          });
        } catch (error) {
          // Ignore errors for tabs that don't have content scripts
        }
      });
    });

    // Send update to popup if open
    try {
      chrome.runtime.sendMessage({
        type: "TIMER_UPDATE",
        state: this.state,
      });
    } catch (error) {
      // Popup might not be open
    }
  }

  async notifyContentScripts(message) {
    try {
      const tabs = await chrome.tabs.query({
        url: ["https://www.youtube.com/*", "https://youtube.com/*"],
      });

      for (const tab of tabs) {
        try {
          chrome.tabs.sendMessage(tab.id, message);
        } catch (error) {
          console.log(
            "Could not send message to tab:",
            tab.id,
            error.message
          );
        }
      }
    } catch (error) {
      console.error("Error notifying content scripts:", error);
    }
  }
}
console.log("stoping thew backgrounf task with po")
// Initialize background script
console.log("Creating PomodoroBackground instance");
new PomodoroBackground();