import { Timer } from './modules/timer.js';
import { Todos } from './modules/todos.js';
import { Blocking } from './modules/blocking.js';
import { Settings } from './modules/settings.js';
import { Stats } from './modules/stats.js';

class PomodoroBackground {
  constructor() {
    console.log("[v1] Initializing Modular PomodoroBackground");

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
        youtubeHidingCondition: 'on-timer',
        collectStats: true,
      },
      blockedWebsites: [],
      allowedWebsites: [],
      todos: [],
    };

    this.alarmName = "pomodoroTimer";

    // Instantiate modules
    this.timer = new Timer(
      this.state,
      this.broadcastUpdate.bind(this),
      this.notifyContentScripts.bind(this),
      this.showNotification.bind(this),
      () => this.stats.recordSession(), // Pass recordSession from the stats module
      this.saveState.bind(this)
    );
    this.todos = new Todos(this.state, this.broadcastUpdate.bind(this));
    this.blocking = new Blocking(this.state, this.broadcastUpdate.bind(this));
    this.settings = new Settings(this.state, this.broadcastUpdate.bind(this), this.broadcastSettingsUpdate.bind(this));
    this.stats = new Stats(this.state);

    this.initialize();
  }

  async initialize() {
    try {
      console.log("[v1] Starting background initialization");
      await this.loadState();

      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true;
      });

      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "local" && changes.settings) {
          this.state.settings = { ...this.state.settings, ...changes.settings.newValue };
          if (!this.state.isRunning) {
            this.timer.resetTimer();
          }
        }
      });

      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === this.alarmName) {
            this.timer.handleTimerTick();
        }
      });

      chrome.runtime.onStartup.addListener(() => this.loadState());
      chrome.runtime.onInstalled.addListener(() => this.initializeDefaultState());

      console.log("[v1] Modular background script initialized successfully");
    } catch (error) {
      console.error("[v1] Error initializing background:", error);
    }
  }

  async loadState() {
    try {
      const result = await chrome.storage.local.get(Object.keys(this.state));
      if (result.timerState) {
        const defaultSettings = this.state.settings;
        this.state = { ...this.state, ...result };
        this.state.settings = { ...defaultSettings, ...this.state.settings };

        if (this.state.isRunning && result.lastActiveTime) {
          const timeDrift = Math.floor((Date.now() - result.lastActiveTime) / 1000);
          this.state.currentTime = Math.max(0, this.state.currentTime - timeDrift);
          if (this.state.currentTime === 0) {
            await this.timer.handleTimerComplete();
          }
        }
      }
      console.log("[v1] State loaded:", this.state);
    } catch (error) {
      console.error("[v1] Error loading state:", error);
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
      console.error("[v1] Error saving state:", error);
    }
  }

  async initializeDefaultState() {
    // The default state is already defined in the constructor.
    // This function is for ensuring defaults are set on installation.
    await this.saveState();
  }

  async handleMessage(message, sender, sendResponse) {
    console.log("[v1] Handling message:", message.type);
    let success = true;
    let response = {};

    try {
        switch (message.type) {
            case "GET_STATE":
                response = { state: this.state };
                break;
            case "SETTINGS_UPDATED":
                await this.settings.updateSettings(message.settings);
                break;
            case "START_TIMER":
                await this.timer.startTimer();
                break;
            case "PAUSE_TIMER":
                await this.timer.pauseTimer();
                break;
            case "RESET_TIMER":
                await this.timer.resetTimer();
                break;
            case "SKIP_BREAK":
                await this.timer.skipBreak();
                break;
            case "ADD_BLOCKED_WEBSITE":
                await this.blocking.addBlockedWebsite(message.website);
                break;
            case "REMOVE_BLOCKED_WEBSITE":
                await this.blocking.removeBlockedWebsite(message.website);
                break;
            case "ADD_TODO":
                await this.todos.addTodo(message.text);
                break;
            case "TOGGLE_TODO":
                await this.todos.toggleTodo(message.todoId);
                break;
            case "DELETE_TODO":
                await this.todos.deleteTodo(message.todoId);
                break;
            case "WEBSITE_LISTS_UPDATED":
                this.state.allowedWebsites = message.allowlist || [];
                this.state.blockedWebsites = message.blocklist || [];
                await this.saveState();
                break;
            case "CHECK_WEBSITE_BLOCKED":
                response = { blocked: this.blocking.isUrlBlocked(message.url) };
                break;
            case "CLOSE_CURRENT_TAB":
                if (sender.tab) chrome.tabs.remove(sender.tab.id);
                break;
            default:
                console.warn("[v1] Unknown message type:", message.type);
                success = false;
                response = { error: "Unknown message type" };
        }
    } catch (error) {
        console.error("[v1] Error handling message:", error);
        success = false;
        response = { error: error.message };
    }

    sendResponse({ success, ...response });
    // After handling the message, save the state
    await this.saveState();
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
      console.error("[v1] Error showing notification:", error);
    }
  }

  async broadcastUpdate() {
    console.log("[v1] Broadcasting state update");
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
    for (const tab of tabs) {
        try {
            await chrome.tabs.sendMessage(tab.id, { type: "TIMER_UPDATE", state: this.state });
        } catch (e) {
            if (!e.message.includes("Receiving end does not exist")) {
                console.error(`[v1] Failed to send message to tab ${tab.id}:`, e);
            }
        }
    }
    try {
        await chrome.runtime.sendMessage({ type: "TIMER_UPDATE", state: this.state });
    } catch (e) {
        if (!e.message.includes("The message port closed before a response was received")) {
            console.error("[v1] Failed to send message to popup:", e);
        }
    }
  }

  async broadcastSettingsUpdate() {
    console.log("[v1] Broadcasting settings update");
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
    for (const tab of tabs) {
        try {
            await chrome.tabs.sendMessage(tab.id, { type: "SETTINGS_UPDATED" });
        } catch (e) {
            if (!e.message.includes("Receiving end does not exist")) {
                console.error(`[v1] Failed to send settings update to tab ${tab.id}:`, e);
            }
        }
    }
  }

  async notifyContentScripts(message) {
    try {
      const tabs = await chrome.tabs.query({ url: ["https://www.youtube.com/*", "https://youtube.com/*"] });
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, message);
        } catch (error) {
          console.log("[v1] Could not send message to tab:", tab.id, error.message);
        }
      }
    } catch (error) {
      console.error("[v1] Error notifying content scripts:", error);
    }
  }
}

new PomodoroBackground();
