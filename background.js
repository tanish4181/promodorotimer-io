// This script runs in the background and manages the core logic of the Pomodoro timer.
class PomodoroBackground {
  constructor() {
    // The main state object for the extension.
    this.state = {
      currentTime: 25 * 60, // The current time in seconds.
      isRunning: false, // Whether the timer is currently running.
      currentMode: "focus", // The current timer mode.
      sessionCount: 1, // The number of focus sessions completed in the current cycle.
      totalSessions: 0, // The total number of focus sessions completed.
      isLockedIn: false,
      lockedInSessions: 0,
      lockInEndTime: null, // Failsafe timestamp for lock-in mode.
      targetCompletionTime: null, // Timestamp for when the current timer is expected to end.
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
      // Then try to load saved state
      try {
        await this.loadState();
      } catch (loadError) {
        console.error("Failed to load saved state:", loadError);
        // Continue with default state if load fails
      }

      // Validate state integrity
      this.validateState();

      // Listen for messages from other parts of the extension.
      this.messageListener = (message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // Indicates that the response will be sent asynchronously.
      };
      chrome.runtime.onMessage.addListener(this.messageListener);

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

      // Listen for the timer alarms.
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === this.alarmName + "_tick") {
          this.handleTimerTick();
        }
      });

      // Handle extension lifecycle events.
      chrome.runtime.onStartup.addListener(() => this.loadState());
      chrome.runtime.onInstalled.addListener((details) => {
        if (details.reason === 'install') {
          this.initializeDefaultState();
          chrome.tabs.create({ url: 'help.html' });
        }
      });
    } catch (error) {
      // console.error("Error initializing background script:", error);
    }
  }

  // Loads the extension's state from local storage.
  async loadState() {
    try {
      const result = await chrome.storage.local.get([
        "currentTime", "isRunning", "currentMode",
        "sessionCount", "totalSessions", "settings", "lastActiveTime",
        "blockedWebsites", "allowedWebsites", "todos", "isLockedIn", "lockedInSessions",
        "targetCompletionTime", "lockInEndTime"
      ]);

      if (result.currentMode) {
        const defaultSettings = this.state.settings;
        this.state = { ...this.state, ...result };
        // Merge loaded settings with defaults to ensure new settings are not missing.
        this.state.settings = { ...defaultSettings, ...this.state.settings };

        // Failsafe check for Lock-In Mode
        if (this.state.isLockedIn && this.state.lockInEndTime && Date.now() > this.state.lockInEndTime) {
            // console.log("Lock-in mode expired, disabling failsafe.");
            this.state.isLockedIn = false;
            this.state.lockedInSessions = 0;
            this.state.lockInEndTime = null;
        }

        // If the timer was running, recalculate currentTime based on the targetCompletionTime.
        if (this.state.isRunning && this.state.targetCompletionTime) {
          const remainingTime = Math.round((this.state.targetCompletionTime - Date.now()) / 1000);
          this.state.currentTime = Math.max(0, remainingTime);
          if (this.state.currentTime === 0) {
            // This ensures that if the timer finished while the worker was inactive, it completes.
            await this.handleTimerComplete();
          }
        }
      }
    } catch (error) {
      // console.error("Error loading state:", error);
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
      // Attempt to recover by retrying once
      try {
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay before retry
        await chrome.storage.local.set({
          ...this.state,
          lastActiveTime: Date.now(),
        });
      } catch (retryError) {
        // If retry fails, broadcast error state and try to recover
        console.error("State save retry failed:", retryError);
        this.broadcastUpdate({ error: "Storage error - Changes may not be saved" });
        // Attempt to save critical state only
        await chrome.storage.local.set({
          currentTime: this.state.currentTime,
          isRunning: this.state.isRunning,
          currentMode: this.state.currentMode
        });
      }
    }
  }

  // Validates the state structure and values
  validateState() {
    // Ensure all required properties exist
    const requiredProperties = {
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
      }
    };

    // Deep merge default values for missing properties
    this.state = this.deepMerge(requiredProperties, this.state || {});

    // Ensure settings exist and have valid values
    if (!this.state.settings) {
      this.state.settings = requiredProperties.settings;
    }

    // Validate numerical settings
    this.state.settings.focusTime = this.validateNumber(this.state.settings.focusTime, 25, 1, 120);
    this.state.settings.shortBreak = this.validateNumber(this.state.settings.shortBreak, 5, 1, 30);
    this.state.settings.longBreak = this.validateNumber(this.state.settings.longBreak, 15, 1, 60);
    this.state.settings.sessionsUntilLongBreak = this.validateNumber(this.state.settings.sessionsUntilLongBreak, 4, 1, 10);

    // Save validated state
    this.saveState();
  }

  validateNumber(value, defaultValue, min, max) {
    const num = parseInt(value);
    if (isNaN(num) || num < min || num > max) {
      return defaultValue;
    }
    return num;
  }

  deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] instanceof Object && key in target) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else if (source[key] !== undefined) {
        result[key] = source[key];
      }
    }
    return result;
  }

  // Initializes the default state of the extension.
  async initializeDefaultState() {
    this.state = {
      currentTime: 25 * 60,
      isRunning: false,
      currentMode: "focus",
      sessionCount: 1,
      totalSessions: 0,
      lockInEndTime: null,
      targetCompletionTime: null,
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
    await this.initializationPromise;
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
          const numSessions = message.sessions || this.state.settings.sessionsUntilLongBreak;
          this.state.lockedInSessions = numSessions;

          // Calculate lock-in end time for failsafe
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
        case "ADD_TODO":
          const newTodo = {
            id: Date.now(),
            text: message.todo.text,
            completed: false,
            createdAt: new Date().toISOString()
          };
          if (!this.state.todos) this.state.todos = [];
          this.state.todos.push(newTodo);
          await this.saveState();
          this.broadcastUpdate(); // Broadcast the change to all parts of the extension
          sendResponse({ success: true, todos: this.state.todos });
          break;

        case "TOGGLE_TODO":
          const todoToToggle = this.state.todos.find(t => t.id === message.todoId);
          if (todoToToggle) {
            todoToToggle.completed = !todoToToggle.completed;
            todoToToggle.completedAt = todoToToggle.completed ? new Date().toISOString() : null;
            await this.saveState();
            this.broadcastUpdate();
          }
          sendResponse({ success: true, todos: this.state.todos });
          break;

        case "DELETE_TODO":
          this.state.todos = this.state.todos.filter(t => t.id !== message.todoId);
          await this.saveState();
          this.broadcastUpdate();
          sendResponse({ success: true, todos: this.state.todos });
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
      // console.error("Error handling message:", error);
      sendResponse({ error: error.message });
    }
  }

  // Updates the settings and broadcasts the changes.
  async updateSettings(newSettings) {
    try {
      // Validate new settings
      const validatedSettings = this.validateSettings(newSettings);
      
      // Create new settings object
      const updatedSettings = { ...this.state.settings, ...validatedSettings };
      
      // Update state atomically
      const previousSettings = { ...this.state.settings };
      this.state.settings = updatedSettings;

      // Handle timer adjustments if needed
      if (!this.state.isRunning && this.state.currentMode === "focus") {
        this.state.currentTime = this.state.settings.focusTime * 60;
      }

      // Save state
      await this.saveState();

      // Broadcast update to all components
      await this.broadcastUpdate();

      // Notify all tabs about settings change
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          try {
            chrome.tabs.sendMessage(tab.id, {
              type: "SETTINGS_UPDATED",
              settings: updatedSettings,
              previousSettings
            });
          } catch (error) {
            // Ignore errors for tabs that don't have content scripts
          }
        });
      });

      return { success: true, settings: updatedSettings };
    } catch (error) {
      console.error("Error updating settings:", error);
      // Revert to previous settings if save failed
      this.state.settings = { ...previousSettings };
      throw error;
    }
  }

  validateSettings(settings) {
    const validated = {};
    
    // Validate numerical settings
    if ('focusTime' in settings) {
      validated.focusTime = Math.max(1, Math.min(120, parseInt(settings.focusTime) || 25));
    }
    if ('shortBreak' in settings) {
      validated.shortBreak = Math.max(1, Math.min(30, parseInt(settings.shortBreak) || 5));
    }
    if ('longBreak' in settings) {
      validated.longBreak = Math.max(1, Math.min(60, parseInt(settings.longBreak) || 15));
    }
    if ('sessionsUntilLongBreak' in settings) {
      validated.sessionsUntilLongBreak = Math.max(1, Math.min(10, parseInt(settings.sessionsUntilLongBreak) || 4));
    }

    // Validate boolean settings
    const booleanSettings = [
      'autoStartBreaks', 'autoStartPomodoros', 'notifications', 'sounds',
      'enforceBreaks', 'youtubeIntegration', 'websiteBlocking', 'collectStats'
    ];
    
    booleanSettings.forEach(setting => {
      if (setting in settings) {
        validated[setting] = Boolean(settings[setting]);
      }
    });

    return validated;
  }

  // Starts the timer.
  async startTimer() {
    this.state.isRunning = true;
    const remainingMilliseconds = this.state.currentTime * 1000;
    this.state.targetCompletionTime = Date.now() + remainingMilliseconds;
    
    // Periodic alarm every second for more accurate updates
    chrome.alarms.create(this.alarmName + "_tick", { 
      periodInMinutes: 1 / 60 
    });

    if (this.state.settings.youtubeIntegration && this.state.currentMode === "focus") {
      this.notifyContentScripts({ type: "TIMER_STARTED" });
    }

    await this.saveState();
    this.broadcastUpdate();
  }

  // Pauses the timer.
  async pauseTimer() {
    if (this.state.isLockedIn) return;

    // Recalculate remaining time when pausing to get the most accurate value.
    if (this.state.targetCompletionTime) {
      const remainingTime = Math.round((this.state.targetCompletionTime - Date.now()) / 1000);
      this.state.currentTime = Math.max(0, remainingTime);
    }

    this.state.isRunning = false;
    chrome.alarms.clear(this.alarmName + "_completion");
    chrome.alarms.clear(this.alarmName + "_tick");
    this.state.targetCompletionTime = null;

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

  // Skips the current break and starts the next focus session.
  async skipBreak() {
    if (this.state.isLockedIn) return;
    this.state.currentMode = "focus";
    this.state.currentTime = this.state.settings.focusTime * 60;
    this.state.isRunning = false;
    this.state.targetCompletionTime = null;
    this.state.nextSessionInfo = null; // Clear next session info

    this.notifyContentScripts({ type: "BREAK_SKIPPED" });

    await this.saveState();
    this.broadcastUpdate();
  }

  // Called by the alarm to update the timer every second.
  async handleTimerTick() {
    try {
      // Validate timer state
      if (!this.state.isRunning || !this.state.targetCompletionTime) {
        await Promise.all([
          chrome.alarms.clear(this.alarmName + "_completion"),
          chrome.alarms.clear(this.alarmName + "_tick")
        ]);
        return;
      }

      // Calculate remaining time
      const now = Date.now();
      const targetTime = this.state.targetCompletionTime;
      
      // Check for time drift
      if (Math.abs(now - this.lastTickTime) > 2000) {
        console.warn('Time drift detected, recalibrating timer');
        await this.recalibrateTimer();
        return;
      }
      
      const remainingTime = Math.round((targetTime - now) / 1000);
      this.state.currentTime = Math.max(0, remainingTime);
      this.lastTickTime = now;
      
      // Broadcast update
      await this.broadcastUpdate();

      // Handle timer completion
      if (this.state.currentTime <= 0) {
        await Promise.all([
          chrome.alarms.clear(this.alarmName + "_completion"),
          chrome.alarms.clear(this.alarmName + "_tick")
        ]);
        await this.handleTimerComplete();
      }
    } catch (error) {
      console.error('Error in timer tick:', error);
      // Attempt to recover
      try {
        await this.recalibrateTimer();
      } catch (recalError) {
        console.error('Timer recovery failed:', recalError);
        // Emergency stop of the timer
        this.state.isRunning = false;
        this.broadcastUpdate({ error: 'Timer error - please restart the timer' });
      }
    }
  }

  async recalibrateTimer() {
    if (!this.state.isRunning || !this.state.targetCompletionTime) return;
    
    // Clear existing alarms
    await Promise.all([
      chrome.alarms.clear(this.alarmName + "_completion"),
      chrome.alarms.clear(this.alarmName + "_tick")
    ]);

    // Recalculate remaining time
    const remainingTime = Math.max(0, Math.round((this.state.targetCompletionTime - Date.now()) / 1000));
    this.state.currentTime = remainingTime;

    if (remainingTime > 0) {
      // Recreate alarms with corrected timing
      await Promise.all([
        chrome.alarms.create(this.alarmName + "_completion", {
          when: this.state.targetCompletionTime
        }),
        chrome.alarms.create(this.alarmName + "_tick", {
          periodInMinutes: 1 / 60
        })
      ]);
    } else {
      await this.handleTimerComplete();
    }

    this.lastTickTime = Date.now();
    await this.broadcastUpdate();
  }

  // Handles the completion of a timer.
  async handleTimerComplete() {
    // Stop the timer first, ensuring all state changes are handled before saving.
    this.state.isRunning = false;
    this.state.currentTime = 0;
    this.state.targetCompletionTime = null;
    
    // Clear any existing alarms
    await chrome.alarms.clear(this.alarmName + "_completion");
    await chrome.alarms.clear(this.alarmName + "_tick");
    let lockInJustCompleted = false; // Flag to detect when the lock ends

    if (this.state.settings.notifications) {
      await this.showNotification();
    }

    if (this.state.settings.sounds) {
      try {
        await this.playSound();
      } catch (e) {
        // console.error("Error playing sound:", e);
      }
    }

    if (this.state.currentMode === "focus") {
      this.state.totalSessions++;
      await this.recordSession();

      // Handle lock-in mode state changes atomically
      if (this.state.isLockedIn) {
        const updatedState = {
          lockedInSessions: this.state.lockedInSessions - 1,
          isLockedIn: this.state.lockedInSessions > 1,
          lockInEndTime: this.state.lockedInSessions > 1 ? this.state.lockInEndTime : null
        };
        
        Object.assign(this.state, updatedState);
        lockInJustCompleted = updatedState.lockedInSessions <= 0;
      }
    }

    await this.switchToNextMode();
    await this.saveState();
    this.broadcastUpdate();

    // Only auto-start if the lock-in mode didn't just complete
    if (this.shouldAutoStart() && !lockInJustCompleted) {
      setTimeout(() => this.startTimer(), 1000);
    }
  }

  async switchToNextMode() {
    // Ensure timer is completely stopped before mode switch
    this.state.isRunning = false;
    this.state.currentTime = 0;
    this.state.targetCompletionTime = null;

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
    // Check if notifications are enabled in settings
    if (!this.state.settings.notifications) {
      return;
    }

    // Check notification permission
    try {
      const permission = await chrome.permissions.contains({
        permissions: ['notifications']
      });

      if (!permission) {
        console.warn('Notification permission not granted');
        // Update settings to reflect current permission state
        this.state.settings.notifications = false;
        await this.saveState();
        return;
      }

      const messages = {
        focus: "Time for a break! You've completed a focus session.",
        shortBreak: "Break time is over! Ready to focus?",
        longBreak: "Long break complete! Time to get back to work.",
      };

      const message = messages[this.state.currentMode] || "Timer completed!";

      // Ensure existing notification is cleared first
      await chrome.notifications.clear('pomodoroNotification');

      // Create new notification
      await chrome.notifications.create('pomodoroNotification', {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Pomodoro Timer",
        message: message,
        priority: 2,
        requireInteraction: false,
        silent: false
      });

    } catch (error) {
      console.error("Error handling notification:", error);
      // If there's an error with notifications, update settings
      this.state.settings.notifications = false;
      await this.saveState();
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
      // console.error('[v0] playSound failed:', e);
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
      // console.log("[v0] Session recorded for", today);
      try {
        chrome.runtime.sendMessage({ type: "STATS_UPDATED" });
      } catch (e) {
        // ignore if stats page not open
      }
    } catch (error) {
      // console.error("[v0] Error recording session:", error);
    }
  }

  async addBlockedWebsite(website) {
    if (!this.state.blockedWebsites.includes(website)) {
      this.state.blockedWebsites.push(website);
      await this.saveState();
      // console.log("[v0] Website blocked:", website);
    }
  }

  async removeBlockedWebsite(website) {
    this.state.blockedWebsites = this.state.blockedWebsites.filter(
      (w) => w !== website
    );
    await this.saveState();
    // console.log("[v0] Website unblocked:", website);
  }

  _isUrlInList(url, list) {
    if (!url || !list || !Array.isArray(list) || list.length === 0) {
      return false;
    }

    try {
      // Handle special URLs
      if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
        return false;
      }

      const currentUrl = new URL(url);
      
      // Ignore invalid or empty hostnames
      if (!currentUrl.hostname) {
        return false;
      }

      // Normalize the current URL for comparison
      const normalizedHostname = currentUrl.hostname.toLowerCase();
      const normalizedPathname = currentUrl.pathname.toLowerCase().replace(/\/$/, "");
      const currentUrlStr = `${normalizedHostname}${normalizedPathname}`;

      return list.some(pattern => {
        // Ensure pattern is string and not empty
        if (typeof pattern !== 'string' || !pattern.trim()) {
          return false;
        }

        const lowerCasePattern = pattern.toLowerCase().trim();
        
        // Handle wildcards (*.example.com)
        if (lowerCasePattern.startsWith('*.')) {
          const domain = lowerCasePattern.slice(2);
          return normalizedHostname.endsWith(domain);
        }

        // Handle domain-only patterns
        if (!lowerCasePattern.includes('/')) {
          return normalizedHostname === lowerCasePattern || 
                 normalizedHostname.endsWith(`.${lowerCasePattern}`);
        }

        // Handle full URL patterns with paths
        return currentUrlStr.startsWith(lowerCasePattern);
      });
    } catch (error) {
      console.error(`Invalid URL format for blocking check: ${url}`, error);
      // Return false for invalid URLs instead of throwing
      return false;
    }
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
    // console.log("[v0] Broadcasting update");

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
          // console.log(
          //   "Could not send message to tab:",
          //   tab.id,
          //   error.message
          // );
        }
      }
    } catch (error) {
      // console.error("Error notifying content scripts:", error);
    }
  }
}
// console.log("stoping thew backgrounf task with po")
// Initialize background script
// console.log("Creating PomodoroBackground instance");
new PomodoroBackground();

// Cleanup function to handle extension unload
function cleanup() {
  if (pomodoroBackground) {
    // Clear all alarms
    chrome.alarms.clearAll();
    
    // Save final state
    pomodoroBackground.saveState();
    
    // Clean up any offscreen documents
    if (chrome.offscreen?.closeDocument) {
      chrome.offscreen.closeDocument();
    }
    
    // Remove listeners
    if (pomodoroBackground.messageListener) {
      chrome.runtime.onMessage.removeListener(pomodoroBackground.messageListener);
    }
    if (pomodoroBackground.storageListener) {
      chrome.storage.onChanged.removeListener(pomodoroBackground.storageListener);
    }
    if (pomodoroBackground.alarmListener) {
      chrome.alarms.onAlarm.removeListener(pomodoroBackground.alarmListener);
    }
    
    // Clear any pending tasks
    if (pomodoroBackground.pendingTasks) {
      pomodoroBackground.pendingTasks.forEach(task => clearTimeout(task));
    }
  }
}

// Register cleanup for extension unload
chrome.runtime.onSuspend.addListener(cleanup);

// Initialize background script as a service worker
const pomodoroBackground = new PomodoroBackground();

// Handle service worker activation
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Take control of all pages immediately
      self.clients.claim(),
      // Ensure storage is initialized
      pomodoroBackground.loadState()
    ])
  );
});

// Handle service worker installation
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      // Skip waiting to become active service worker
      self.skipWaiting(),
      // Initialize default state
      pomodoroBackground.initializeDefaultState()
    ])
  );
});

// Export for testing
try {
  module.exports = PomodoroBackground;
} catch (e) {
  // Ignore, this fails in a real extension context
}