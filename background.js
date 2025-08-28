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
      lockInEndTime: null, // Failsafe timestamp for lock-in mode.
      targetCompletionTime: null, // Timestamp for when the current timer is expected to end.
      notificationSent: false, // FIX: Flag to prevent notification spam.
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
        enforceBreaks: true,
        youtubeIntegration: true,
        youtubeDistractionMode: "focus",
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

    this.alarmName = "pomodoroTimer"; // The name of the alarm used for the timer.

    this.initializationPromise = this.initialize();
  }

  // Initializes the background script by loading the state and setting up listeners.
  async initialize() {
    try {
      this.initializationPromise = this.loadState();

      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        (async () => {
            await this.initializationPromise;
            const response = await this.handleMessage(message, sender);
            sendResponse(response);
        })();
        return true;
      });

      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "local" && changes.settings) {
          this.state.settings = changes.settings.newValue;
          if (!this.state.isRunning) {
            this.resetTimer();
          }
          this.broadcastUpdate();
        }
      });

      chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name === this.alarmName) {
          await this.handleTimerTick();
        }
      });

      chrome.runtime.onStartup.addListener(() => this.loadState());
      chrome.runtime.onInstalled.addListener((details) => {
        this.initializeDefaultState();
        if (details.reason === 'install') {
          chrome.tabs.create({ url: 'help.html' });
        }
      });
    } catch (error) {
      console.error("Error initializing background script:", error);
    }
  }

  // Loads the extension's state from local storage.
  async loadState() {
    try {
      const result = await chrome.storage.local.get([
        "timerState", "isRunning", "currentMode", "sessionCount", "totalSessions",
        "settings", "blockedWebsites", "allowedWebsites", "todos", "isLockedIn",
        "lockedInSessions", "targetCompletionTime", "lockInEndTime"
      ]);

      if (result.settings) {
        // Keep user's settings, but use defaults for any missing properties
        this.state.settings = { ...this.state.settings, ...result.settings };
        // Overwrite the rest of the state
        Object.assign(this.state, result);
      }

      // **CRITICAL FIX**: If the timer was running, recalculate the current time
      // based on when it was supposed to end. This is the key to surviving
      // the service worker going to sleep.
      if (this.state.isRunning && this.state.targetCompletionTime) {
        const remainingTime = Math.round((this.state.targetCompletionTime - Date.now()) / 1000);
        this.state.currentTime = Math.max(0, remainingTime);

        // If the timer has already finished while the worker was asleep, handle completion.
        if (this.state.currentTime === 0) {
          await this.handleTimerComplete();
        }
      }
    } catch (error) {
      console.error("Error loading state, initializing defaults:", error);
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
      lockInEndTime: null,
      targetCompletionTime: null,
      notificationSent: false,
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

  async handleMessage(message, sender) {
      try {
          switch (message.type) {
              case "GET_STATE":
                  return { state: this.state };
              case "SETTINGS_UPDATED":
                  await this.updateSettings(message.settings);
                  return { success: true };
              case "START_TIMER":
                  await this.startTimer();
                  return { success: true };
              case "START_TIMER_LOCKED":
                  this.state.isLockedIn = true;
                  const numSessions = message.sessions || this.state.settings.sessionsUntilLongBreak;
                  this.state.lockedInSessions = numSessions;
                  let totalDurationInSeconds = 0;
                  const { focusTime, shortBreak, longBreak, sessionsUntilLongBreak } = this.state.settings;
                  let sessionCycle = this.state.sessionCount;
                  totalDurationInSeconds += numSessions * focusTime * 60;
                  for (let i = 0; i < numSessions - 1; i++) {
                      if (sessionCycle % sessionsUntilLongBreak === 0) {
                          totalDurationInSeconds += longBreak * 60;
                      } else {
                          totalDurationInSeconds += shortBreak * 60;
                      }
                      sessionCycle++;
                  }
                  this.state.lockInEndTime = Date.now() + totalDurationInSeconds * 1000;
                  await this.startTimer();
                  return { success: true };
              case "PAUSE_TIMER":
                  await this.pauseTimer();
                  return { success: true };
              case "RESET_TIMER":
                  await this.resetTimer();
                  return { success: true };
              case "SKIP_BREAK":
                  await this.skipBreak();
                  return { success: true };
              case "TEST_NOTIFICATION":
                  await this.showNotification();
                  return { success: true };
              case "TEST_SOUND":
                  await this.playSound(message.soundType);
                  return { success: true };
              case "ADD_TODO":
                  const newTodo = { id: Date.now(), text: message.todo.text, completed: false, createdAt: new Date().toISOString() };
                  if (!this.state.todos) this.state.todos = [];
                  this.state.todos.push(newTodo);
                  await this.saveState();
                  this.broadcastUpdate();
                  return { success: true, todos: this.state.todos };
              case "TOGGLE_TODO":
                  const todoToToggle = this.state.todos.find(t => t.id === message.todoId);
                  if (todoToToggle) {
                      todoToToggle.completed = !todoToToggle.completed;
                      todoToToggle.completedAt = todoToToggle.completed ? new Date().toISOString() : null;
                      await this.saveState();
                      this.broadcastUpdate();
                  }
                  return { success: true, todos: this.state.todos };
              case "DELETE_TODO":
                  this.state.todos = this.state.todos.filter(t => t.id !== message.todoId);
                  await this.saveState();
                  this.broadcastUpdate();
                  return { success: true, todos: this.state.todos };
              case "GET_TODOS":
                  return { todos: this.state.todos };
              case "WEBSITE_LISTS_UPDATED":
                  this.state.allowedWebsites = message.allowlist || [];
                  this.state.blockedWebsites = message.blocklist || [];
                  await this.saveState();
                  this.broadcastUpdate();
                  return { success: true };
              case "CHECK_WEBSITE_BLOCKED":
                  return this.isUrlBlocked(message.url);
              case "CLOSE_CURRENT_TAB":
                  if (sender.tab) {
                      chrome.tabs.remove(sender.tab.id);
                  }
                  return { success: true };
              default:
                  return { error: "Unknown message type" };
          }
      } catch (error) {
          console.error("Error in handleMessage:", error);
          return { error: error.message };
      }
  }

  async updateSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings };
    // If the timer isn't running, update the current time to reflect the new setting for the current mode.
    if (!this.state.isRunning) {
        const timeMap = {
            focus: this.state.settings.focusTime * 60,
            shortBreak: this.state.settings.shortBreak * 60,
            longBreak: this.state.settings.longBreak * 60,
        };
        // Ensure the current mode exists in the map before assigning.
        if (timeMap[this.state.currentMode]) {
            this.state.currentTime = timeMap[this.state.currentMode];
        }
    }
    await this.saveState();
    this.broadcastUpdate();
  }

  async startTimer() {
    if (this.state.isRunning) return; // Prevent multiple start calls

    this.state.isRunning = true;
    this.state.notificationSent = false;

    // Set the target completion time as the absolute truth
    const remainingMilliseconds = this.state.currentTime * 1000;
    this.state.targetCompletionTime = Date.now() + remainingMilliseconds;

    // Use a precise alarm that fires roughly every second.
    chrome.alarms.create(this.alarmName, { periodInMinutes: 1 / 60 });

    await this.saveState();
    this.broadcastUpdate();
  }

  async pauseTimer() {
    if (this.state.isLockedIn) return;

    if (this.state.targetCompletionTime) {
      const remainingTime = Math.round((this.state.targetCompletionTime - Date.now()) / 1000);
      this.state.currentTime = Math.max(0, remainingTime);
    }

    this.state.isRunning = false;
    chrome.alarms.clear(this.alarmName);
    this.state.targetCompletionTime = null;

    if (this.state.settings.youtubeIntegration) {
      this.notifyContentScripts({ type: "TIMER_PAUSED" });
    }

    await this.saveState();
    this.broadcastUpdate();
  }

  async resetTimer() {
    if (this.state.isLockedIn) return;
    this.state.isRunning = false;
    this.state.notificationSent = false;
    chrome.alarms.clear(this.alarmName);
    this.state.targetCompletionTime = null;

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
    if (this.state.isLockedIn) return;
    this.state.currentMode = "focus";
    this.state.currentTime = this.state.settings.focusTime * 60;
    this.state.isRunning = false;
    this.state.notificationSent = false;
    this.state.targetCompletionTime = null;
    this.state.nextSessionInfo = null;

    this.notifyContentScripts({ type: "BREAK_SKIPPED" });

    await this.saveState();
    this.broadcastUpdate();
  }

  async handleTimerTick() {
    if (!this.state.isRunning || !this.state.targetCompletionTime) {
      chrome.alarms.clear(this.alarmName);
      return;
    }

    const remainingTime = Math.round((this.state.targetCompletionTime - Date.now()) / 1000);
    this.state.currentTime = Math.max(0, remainingTime);
    await this.broadcastUpdate();

    if (this.state.currentTime <= 0) {
      await this.handleTimerComplete();
    }
  }

  async handleTimerComplete() {
    // **FIX**: The guard check and the flag set must be atomic.
    if (this.state.notificationSent) return;
    this.state.notificationSent = true; // Set the flag immediately to prevent re-entry.

    this.state.isRunning = false;
    chrome.alarms.clear(this.alarmName);
    this.state.targetCompletionTime = null;
    let lockInJustCompleted = false;

    if (this.state.settings.notifications) {
      await this.showNotification();
    }

    if (this.state.settings.sounds) {
      try {
        await this.playSound();
      } catch (e) {
        // Sound playback failed
      }
    }
    
    // The flag is now correctly set before any async operations or state changes.
    if (this.state.currentMode === "focus") {
      this.state.totalSessions++;
      await this.recordSession();

      if (this.state.isLockedIn) {
        this.state.lockedInSessions--;
        if (this.state.lockedInSessions <= 0) {
          this.state.isLockedIn = false;
          this.state.lockInEndTime = null;
          lockInJustCompleted = true;
        }
      }
    }

    await this.switchToNextMode();

    if (this.shouldAutoStart() && !lockInJustCompleted) {
      await this.startTimer();
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
      this.state.nextSessionInfo = this.getNextSessionInfo();

      if (this.state.settings.pauseYoutubeBreaks) {
        this.notifyContentScripts({ type: "PAUSE_ALL_YOUTUBE_TABS" });
      }

    } else {
      this.state.currentMode = "focus";
      this.state.currentTime = this.state.settings.focusTime * 60;
      this.state.nextSessionInfo = null;
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
        // Notification permission may not be granted
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
      // Sound playback failed
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
      try {
        chrome.runtime.sendMessage({ type: "STATS_UPDATED" });
      } catch (e) {
        // ignore if stats page not open
      }
    } catch (error) {
      // Error recording session
    }
  }

  _isUrlInList(url, list) {
    if (!url || !list || list.length === 0) {
      return false;
    }
    try {
      const currentUrl = new URL(url);
      const currentUrlStr = `${currentUrl.hostname}${currentUrl.pathname}`.toLowerCase().replace(/\/$/, "");

      for (const blocked of list) {
        const lowerCaseBlocked = blocked.toLowerCase();
        if (!lowerCaseBlocked.includes('/')) {
          if (currentUrl.hostname === lowerCaseBlocked || currentUrl.hostname.endsWith(`.${lowerCaseBlocked}`)) {
            return true;
          }
        } else {
          if (currentUrlStr.startsWith(lowerCaseBlocked)) {
            return true;
          }
        }
      }
    } catch (error) {
      return false;
    }
    return false;
  }

  isUrlBlocked(url) {
    if (!this.state.settings.websiteBlocking) {
      return { blocked: false };
    }

    const { isRunning, currentMode, settings, allowedWebsites, blockedWebsites } = this.state;
    const isBreak = currentMode === 'shortBreak' || currentMode === 'longBreak';

    // If it's on the allowlist, it's never blocked.
    if (this._isUrlInList(url, allowedWebsites)) {
      return { blocked: false };
    }

    // Break time logic
    if (isRunning && isBreak) {
        if (settings.breakBlockAll) {
            return { blocked: true, reason: 'break-all' };
        }
        if (settings.breakUseAllowlist) {
            // Since we already checked the allowlist, if this setting is on, block it.
            return { blocked: true, reason: 'break-allowlist' };
        }
    }

    // Focus time logic
    if (isRunning && currentMode === 'focus') {
      // Block everything that isn't on the allowlist (which we've already checked)
      return { blocked: true, reason: 'focus' };
    }

    // Idle timer logic
    if (!isRunning && this._isUrlInList(url, blockedWebsites)) {
      return { blocked: true, reason: 'blocklist' };
    }

    return { blocked: false };
  }

  async broadcastUpdate() {
      try {
          await chrome.runtime.sendMessage({
              type: "TIMER_UPDATE",
              state: this.state,
          });
      } catch (e) {
          // Popup/options are likely closed.
      }

      try {
          const tabs = await chrome.tabs.query({});
          for (const tab of tabs) {
              try {
                  await chrome.tabs.sendMessage(tab.id, {
                      type: "TIMER_UPDATE",
                      state: this.state,
                  });
              } catch (e) {
                  // Tab doesn't have a content script.
              }
          }
      } catch (e) {
          // Error querying tabs
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
          // Could not send message to tab
        }
      }
    } catch (error) {
      // Error notifying content scripts
    }
  }
}

new PomodoroBackground();
