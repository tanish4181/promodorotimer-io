// Background Service Worker for Pomodoro Timer Chrome Extension

const chrome = window.chrome // Declare the chrome variable

class PomodoroBackground {
  constructor() {
    this.state = {
      timerState: "focus", // 'focus', 'shortBreak', 'longBreak'
      currentTime: 25 * 60, // in seconds
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
        enforceBreaks: true,
        youtubeIntegration: true,
      },
    }

    this.alarmName = "pomodoroTimer"
    this.tickInterval = null

    this.initializeBackground()
  }

  async initializeBackground() {
    // Load saved state
    await this.loadState()

    // Set up message listeners
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse)
      return true // Keep message channel open for async responses
    })

    // Set up alarm listeners
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === this.alarmName) {
        this.handleTimerTick()
      }
    })

    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      this.loadState()
    })

    // Handle extension install
    chrome.runtime.onInstalled.addListener(() => {
      this.initializeDefaultState()
    })
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
      ])

      if (result.timerState) {
        this.state = { ...this.state, ...result }

        // Handle time drift if extension was inactive
        if (this.state.isRunning && result.lastActiveTime) {
          const timeDrift = Math.floor((Date.now() - result.lastActiveTime) / 1000)
          this.state.currentTime = Math.max(0, this.state.currentTime - timeDrift)

          if (this.state.currentTime === 0) {
            await this.handleTimerComplete()
          }
        }
      }
    } catch (error) {
      console.error("Error loading state:", error)
      await this.initializeDefaultState()
    }
  }

  async saveState() {
    try {
      await chrome.storage.local.set({
        ...this.state,
        lastActiveTime: Date.now(),
      })
    } catch (error) {
      console.error("Error saving state:", error)
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
        notifications: true,
        sounds: true,
        enforceBreaks: true,
        youtubeIntegration: true,
      },
    }

    await this.saveState()
  }

  async handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case "START_TIMER":
        await this.startTimer()
        sendResponse({ success: true })
        break

      case "PAUSE_TIMER":
        await this.pauseTimer()
        sendResponse({ success: true })
        break

      case "RESET_TIMER":
        await this.resetTimer()
        sendResponse({ success: true })
        break

      case "GET_STATE":
        sendResponse({ state: this.state })
        break

      case "SETTINGS_UPDATED":
        await this.updateSettings(message.settings)
        sendResponse({ success: true })
        break

      case "SKIP_BREAK":
        await this.skipBreak()
        sendResponse({ success: true })
        break

      default:
        sendResponse({ error: "Unknown message type" })
    }
  }

  async startTimer() {
    this.state.isRunning = true

    // Set up alarm for next tick
    chrome.alarms.create(this.alarmName, { delayInMinutes: 1 / 60 }) // 1 second

    // Notify content scripts if YouTube integration is enabled
    if (this.state.settings.youtubeIntegration && this.state.currentMode === "focus") {
      this.notifyContentScripts({ type: "TIMER_STARTED" })
    }

    await this.saveState()
    this.broadcastUpdate()
  }

  async pauseTimer() {
    this.state.isRunning = false
    chrome.alarms.clear(this.alarmName)

    // Notify content scripts
    if (this.state.settings.youtubeIntegration) {
      this.notifyContentScripts({ type: "TIMER_PAUSED" })
    }

    await this.saveState()
    this.broadcastUpdate()
  }

  async resetTimer() {
    this.state.isRunning = false
    chrome.alarms.clear(this.alarmName)

    // Reset to appropriate time based on current mode
    const timeMap = {
      focus: this.state.settings.focusTime * 60,
      shortBreak: this.state.settings.shortBreak * 60,
      longBreak: this.state.settings.longBreak * 60,
    }

    this.state.currentTime = timeMap[this.state.currentMode]

    await this.saveState()
    this.broadcastUpdate()
  }

  async handleTimerTick() {
    if (!this.state.isRunning) return

    this.state.currentTime--

    if (this.state.currentTime <= 0) {
      await this.handleTimerComplete()
    } else {
      // Schedule next tick
      chrome.alarms.create(this.alarmName, { delayInMinutes: 1 / 60 })
      await this.saveState()
      this.broadcastUpdate()
    }
  }

  async handleTimerComplete() {
    this.state.isRunning = false
    chrome.alarms.clear(this.alarmName)

    // Show notification
    if (this.state.settings.notifications) {
      await this.showNotification()
    }

    // Update session tracking
    if (this.state.currentMode === "focus") {
      this.state.totalSessions++
      await this.recordSession()
    }

    // Determine next mode
    await this.switchToNextMode()

    // Auto-start if enabled
    if (this.shouldAutoStart()) {
      setTimeout(() => this.startTimer(), 1000)
    }

    await this.saveState()
    this.broadcastUpdate()
  }

  async switchToNextMode() {
    if (this.state.currentMode === "focus") {
      // Determine if it's time for a long break
      const isLongBreak = this.state.sessionCount % this.state.settings.sessionsUntilLongBreak === 0

      this.state.currentMode = isLongBreak ? "longBreak" : "shortBreak"
      this.state.currentTime = isLongBreak ? this.state.settings.longBreak * 60 : this.state.settings.shortBreak * 60

      this.state.sessionCount++

      // Enforce break if enabled
      if (this.state.settings.enforceBreaks) {
        this.notifyContentScripts({ type: "ENFORCE_BREAK", mode: this.state.currentMode })
      }
    } else {
      // Switch back to focus mode
      this.state.currentMode = "focus"
      this.state.currentTime = this.state.settings.focusTime * 60
    }
  }

  shouldAutoStart() {
    return (
      (this.state.currentMode === "focus" && this.state.settings.autoStartPomodoros) ||
      ((this.state.currentMode === "shortBreak" || this.state.currentMode === "longBreak") &&
        this.state.settings.autoStartBreaks)
    )
  }

  async showNotification() {
    const messages = {
      focus: "Time for a break! You've completed a focus session.",
      shortBreak: "Break time is over! Ready to focus?",
      longBreak: "Long break complete! Time to get back to work.",
    }

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Pomodoro Timer",
      message: messages[this.state.currentMode] || "Timer complete!",
    })
  }

  async recordSession() {
    const today = new Date().toDateString()
    const result = await chrome.storage.local.get(["dailyStats"])
    const dailyStats = result.dailyStats || {}

    if (!dailyStats[today]) {
      dailyStats[today] = {
        focusSessions: 0,
        totalFocusTime: 0,
        breaks: 0,
        totalBreakTime: 0,
      }
    }

    dailyStats[today].focusSessions++
    dailyStats[today].totalFocusTime += this.state.settings.focusTime

    await chrome.storage.local.set({ dailyStats })
  }

  async updateSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings }

    // Update current time if timer is not running and we're in focus mode
    if (!this.state.isRunning && this.state.currentMode === "focus") {
      this.state.currentTime = this.state.settings.focusTime * 60
    }

    await this.saveState()
    this.broadcastUpdate()
  }

  async skipBreak() {
    if (this.state.currentMode === "shortBreak" || this.state.currentMode === "longBreak") {
      this.state.currentMode = "focus"
      this.state.currentTime = this.state.settings.focusTime * 60
      this.state.isRunning = false

      // Remove break enforcement
      this.notifyContentScripts({ type: "BREAK_SKIPPED" })

      await this.saveState()
      this.broadcastUpdate()
    }
  }

  broadcastUpdate() {
    // Send update to popup
    chrome.runtime.sendMessage({ type: "TIMER_UPDATE", state: this.state }).catch(() => {
      // Popup might not be open, ignore error
    })
  }

  async notifyContentScripts(message) {
    try {
      const tabs = await chrome.tabs.query({ url: ["https://www.youtube.com/*", "https://youtube.com/*"] })

      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Content script might not be loaded, ignore error
        })
      }
    } catch (error) {
      console.error("Error notifying content scripts:", error)
    }
  }
}

// Initialize background script
new PomodoroBackground()
