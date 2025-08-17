// Background script for Pomodoro Timer Chrome Extension

class PomodoroBackground {
  constructor() {
    console.log("[v0] Initializing PomodoroBackground");

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
        autoSwitchModes: true,
        notifications: true,
        sounds: true,
        breakReminders: true,
        enforceBreaks: true,
        youtubeIntegration: true,
        breakOverlay: true,
        breakCountdown: true,
        nextSessionInfo: true,
        focusOverlay: false,
        hideDistractions: true,
        focusIndicator: true,
        websiteBlocking: true,
        breakBlockAll: false,
        breakUseAllowlist: true,
        hideYoutubeComments: true,
        hideYoutubeRecommendations: true,
        hideYoutubeShorts: true,
        pauseYoutubeBreaks: true,
        collectStats: true,
      },
      blockedWebsites: [],
      allowedWebsites: [],
      todos: [],
    };

    this.timerInterval = null;
    this.lastTickTime = 0;

    this.initialize();
  }

  async initialize() {
    try {
      console.log("[v0] Starting background initialization");

      // Load saved state first
      await this.loadState();

      // Set up message listener
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("[v0] Background received message:", message.type);
        this.handleMessage(message, sender, sendResponse);
        return true; // Keep message channel open
      });
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "local" && changes.settings) {
          console.log("Background detected settings change, updating state.");
          this.state.settings = changes.settings.newValue;
          if (!this.state.isRunning) {
            this.resetTimer(); // Update timer if it's not running
          }
        }
      });

      // Set up periodic timer updates
      this.startPeriodicUpdates();

      // Handle extension lifecycle
      chrome.runtime.onStartup.addListener(() => {
        console.log("[v0] Extension startup");
        this.loadState();
      });

      chrome.runtime.onInstalled.addListener(() => {
        console.log("[v0] Extension installed/updated");
        this.initializeDefaultState();
      });

      console.log("[v0] Background script initialized successfully");
    } catch (error) {
      console.error("[v0] Error initializing background:", error);
    }
  }

  startPeriodicUpdates() {
    // Update timer every second when running
    setInterval(() => {
      if (this.state.isRunning) {
        this.handleTimerTick();
      }
    }, 1000);
  }

  async loadState() {
    try {
      const result = await chrome.storage.local.get([
        "timerState",
        "currentTime",
        "isRunning",
        "currentMode",
        "sessionCount",
        "totalSessions",
        "settings",
        "lastActiveTime",
        "blockedWebsites",
        "allowedWebsites",
        "todos",
      ]);

      if (result.timerState) {
        const defaultSettings = this.state.settings;
        this.state = { ...this.state, ...result };
        // Merge loaded settings with defaults to ensure new settings are not missing
        this.state.settings = { ...defaultSettings, ...this.state.settings };

        // Handle time drift if extension was inactive
        if (this.state.isRunning && result.lastActiveTime) {
          const timeDrift = Math.floor(
            (Date.now() - result.lastActiveTime) / 1000
          );
          this.state.currentTime = Math.max(
            0,
            this.state.currentTime - timeDrift
          );

          if (this.state.currentTime === 0) {
            await this.handleTimerComplete();
          }
        }
      }

      console.log("[v0] State loaded:", this.state);
    } catch (error) {
      console.error("[v0] Error loading state:", error);
      await this.initializeDefaultState();
    }
  }

  async saveState() {
    try {
      await chrome.storage.local.set({
        ...this.state,
        lastActiveTime: Date.now(),
      });
    } catch (error) {
      console.error("[v0] Error saving state:", error);
    }
  }

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
        autoSwitchModes: true,
        notifications: true,
        sounds: true,
        breakReminders: true,
        enforceBreaks: true,
        youtubeIntegration: true,
        breakOverlay: true,
        breakCountdown: true,
        nextSessionInfo: true,
        focusOverlay: false,
        hideDistractions: true,
        focusIndicator: true,
        websiteBlocking: true,
        hideYoutubeComments: true,
        hideYoutubeRecommendations: true,
        hideYoutubeShorts: true,
        pauseYoutubeBreaks: true,
        collectStats: true,
      },
      blockedWebsites: [],
      allowedWebsites: [],
      todos: [],
    };
    await this.saveState();
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      console.log("[v0] Handling message:", message.type);

      switch (message.type) {
        case "GET_STATE":
          sendResponse({ state: this.state });
          break;

        case "SETTINGS_UPDATED":
          console.log("[v0] Updating settings:", message.settings);
          await this.updateSettings(message.settings);
          sendResponse({ success: true });
          break;

        case "START_TIMER":
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
          sendResponse({ success: true });
          break;

        case "CHECK_WEBSITE_BLOCKED":
          const isBlocked = this.isUrlBlocked(message.url);
          sendResponse({ blocked: isBlocked });
          break;

        case "CLOSE_CURRENT_TAB":
          if (sender.tab) {
            chrome.tabs.remove(sender.tab.id);
          }
          break;

        default:
          console.warn("[v0] Unknown message type:", message.type);
          sendResponse({ error: "Unknown message type" });
      }
    } catch (error) {
      console.error("[v0] Error handling message:", error);
      sendResponse({ error: error.message });
    }
  }

  async updateSettings(newSettings) {
    console.log("[v0] Updating settings in background:", newSettings);

    // Merge new settings with existing settings
    this.state.settings = { ...this.state.settings, ...newSettings };

    // Update current time if timer is not running and we're in focus mode
    if (!this.state.isRunning && this.state.currentMode === "focus") {
      this.state.currentTime = this.state.settings.focusTime * 60;
    }

    // Save to storage
    await this.saveState();

    console.log("[v0] Settings updated successfully:", this.state.settings);

    // Broadcast update to all connected clients
    this.broadcastUpdate();
  }

  async startTimer() {
    console.log("[v0] Starting timer");
    this.state.isRunning = true;
    this.lastTickTime = Date.now();

    if (
      this.state.settings.youtubeIntegration &&
      this.state.currentMode === "focus"
    ) {
      this.notifyContentScripts({ type: "TIMER_STARTED" });
    }

    await this.saveState();
    this.broadcastUpdate();
  }

  async pauseTimer() {
    console.log("[v0] Pausing timer");
    this.state.isRunning = false;

    if (this.state.settings.youtubeIntegration) {
      this.notifyContentScripts({ type: "TIMER_PAUSED" });
    }

    await this.saveState();
    this.broadcastUpdate();
  }

  async resetTimer() {
    console.log("[v0] Resetting timer");
    this.state.isRunning = false;

    const timeMap = {
      focus: this.state.settings.focusTime * 60,
      shortBreak: this.state.settings.shortBreak * 60,
      longBreak: this.state.settings.longBreak * 60,
    };

    this.state.currentTime = timeMap[this.state.currentMode];

    await this.saveState();
    this.broadcastUpdate();
  }

  async skipBreak() {
    console.log("[v0] Skipping break");

    this.state.currentMode = "focus";
    this.state.currentTime = this.state.settings.focusTime * 60;
    this.state.isRunning = false;

    this.notifyContentScripts({ type: "BREAK_SKIPPED" });

    await this.saveState();
    this.broadcastUpdate();
  }

  handleTimerTick() {
    if (!this.state.isRunning) return;

    const now = Date.now();
    const timeDiff = Math.floor((now - this.lastTickTime) / 1000);
    this.lastTickTime = now;

    this.state.currentTime -= timeDiff;

    if (this.state.currentTime <= 0) {
      this.handleTimerComplete();
    } else {
      this.broadcastUpdate();
    }
  }

  async handleTimerComplete() {
    this.state.isRunning = false;

    if (this.state.settings.notifications) {
      await this.showNotification();
    }

    if (this.state.currentMode === "focus") {
      this.state.totalSessions++;
      await this.recordSession();
    }

    await this.switchToNextMode();

    if (this.shouldAutoStart()) {
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

      if (this.state.settings.enforceBreaks) {
        this.notifyContentScripts({
          type: "ENFORCE_BREAK",
          mode: this.state.currentMode,
          settings: this.state.settings,
          nextSessionInfo: this.getNextSessionInfo(),
        });
      }
    } else {
      this.state.currentMode = "focus";
      this.state.currentTime = this.state.settings.focusTime * 60;
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
    if (!this.state.settings.autoSwitchModes) return false;

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
        iconUrl:
          "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjMDU5NjY5Ii8+CjxwYXRoIGQ9Ik0yNCA0QzEyLjk1IDQgNCAxMi45NSA0IDI0czguOTUgMjAgMjAgMjAgMjAtOC45NSAyMC0yMFMzNS4wNSA0IDI0IDR6bTAgMzZjLTguODMgMC0xNi03LjE3LTE2LTE2czcuMTctMTYgMTYtMTYgMTYgNy4xNyAxNiAxNi03LjE3IDE2LTE2IDE2eiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTI0IDh2MTZsMTIgMTIiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=",
        title: "Pomodoro Timer",
        message: message,
      });
    } catch (error) {
      console.error("[v0] Error showing notification:", error);
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
      return false;
    }

    // 2. Allowlist is the highest priority and always overrides blocking
    if (this._isUrlInList(url, this.state.allowedWebsites)) {
      return false;
    }

    const { isRunning, currentMode, settings } = this.state;

    // 3. Logic for when the timer is active (Focus or Break)
    if (isRunning) {
      if (currentMode === 'focus') {
        // During focus, block everything that is not on the allowlist.
        return true;
      }

      if (currentMode === 'shortBreak' || currentMode === 'longBreak') {
        // During breaks, check user's break blocking preferences.
        if (settings.breakBlockAll) {
          // Option 1: Block all websites.
          return true;
        }
        if (settings.breakUseAllowlist) {
          // Option 2: Use allowlist (block everything else).
          return true;
        }
      }
    } else {
      // 4. Logic for when the timer is OFF (Idle state)
      // Block sites that are on the blocklist.
      if (this._isUrlInList(url, this.state.blockedWebsites)) {
        return true;
      }
    }

    // 5. Default case: If no other rule applies, do not block the site.
    return false;
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
          await chrome.tabs.sendMessage(tab.id, message);
        } catch (error) {
          console.log(
            "[v0] Could not send message to tab:",
            tab.id,
            error.message
          );
        }
      }
    } catch (error) {
      console.error("[v0] Error notifying content scripts:", error);
    }
  }
}

// Initialize background script
console.log("[v0] Creating PomodoroBackground instance");
new PomodoroBackground();
