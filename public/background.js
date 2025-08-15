// Background Service Worker for Pomodoro Timer Chrome Extension

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
        websiteBlocking: true,
        blockDuringFocus: true,
        blockDuringBreaks: false,
      },
      blockedWebsites: [],
      todos: [],
    }

    this.alarmName = "pomodoroTimer"
    this.tickInterval = null

    this.initializeBackground()
  }

  async initializeBackground() {
    console.log("[v0] Initializing background script")

    // Load saved state
    await this.loadState()

    // Set up message listeners
    window.chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse)
      return true // Keep message channel open for async responses
    })

    // Set up alarm listeners
    window.chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === this.alarmName) {
        this.handleTimerTick()
      }
    })

    // Handle extension startup
    window.chrome.runtime.onStartup.addListener(() => {
      this.loadState()
    })

    // Handle extension install
    window.chrome.runtime.onInstalled.addListener(() => {
      this.initializeDefaultState()
    })
  }

  async loadState() {
    try {
      const result = await window.chrome.storage.local.get([
        "timerState",
        "currentTime",
        "isRunning",
        "currentMode",
        "sessionCount",
        "totalSessions",
        "settings",
        "lastActiveTime",
        "blockedWebsites",
        "todos",
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
      await window.chrome.storage.local.set({
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
        websiteBlocking: true,
        blockDuringFocus: true,
        blockDuringBreaks: false,
      },
      blockedWebsites: [],
      todos: [],
    }

    await this.saveState()
  }

  async handleMessage(message, sender, sendResponse) {
    console.log("[v0] Background received message:", message.type)

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

      case "ADD_BLOCKED_WEBSITE":
        await this.addBlockedWebsite(message.website)
        sendResponse({ success: true })
        break

      case "REMOVE_BLOCKED_WEBSITE":
        await this.removeBlockedWebsite(message.website)
        sendResponse({ success: true })
        break

      case "GET_BLOCKED_WEBSITES":
        sendResponse({ websites: this.state.blockedWebsites })
        break

      case "CHECK_WEBSITE_BLOCKED":
        const isBlocked = await this.isWebsiteBlocked(message.url)
        sendResponse({ blocked: isBlocked })
        break

      case "TODOS_UPDATED":
        this.state.todos = message.todos
        await this.saveState()
        sendResponse({ success: true })
        break

      case "GET_TODOS":
        sendResponse({ todos: this.state.todos })
        break

      default:
        sendResponse({ error: "Unknown message type" })
    }
  }

  async startTimer() {
    console.log("[v0] Starting timer in background")
    this.state.isRunning = true

    // Set up alarm for next tick
    window.chrome.alarms.create(this.alarmName, { delayInMinutes: 1 / 60 }) // 1 second

    // Notify content scripts if YouTube integration is enabled
    if (this.state.settings.youtubeIntegration && this.state.currentMode === "focus") {
      this.notifyContentScripts({ type: "TIMER_STARTED" })
    }

    await this.saveState()
    this.broadcastUpdate()
  }

  async pauseTimer() {
    console.log("[v0] Pausing timer in background")
    this.state.isRunning = false
    window.chrome.alarms.clear(this.alarmName)

    // Notify content scripts
    if (this.state.settings.youtubeIntegration) {
      this.notifyContentScripts({ type: "TIMER_PAUSED" })
    }

    await this.saveState()
    this.broadcastUpdate()
  }

  async resetTimer() {
    this.state.isRunning = false
    window.chrome.alarms.clear(this.alarmName)

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
      window.chrome.alarms.create(this.alarmName, { delayInMinutes: 1 / 60 })
      await this.saveState()
      this.broadcastUpdate()
    }
  }

  async handleTimerComplete() {
    this.state.isRunning = false
    window.chrome.alarms.clear(this.alarmName)

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

    window.chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Pomodoro Timer",
      message: messages[this.state.currentMode] || "Timer complete!",
    })
  }

  async recordSession() {
    const today = new Date().toDateString()
    const result = await window.chrome.storage.local.get(["dailyStats"])
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

    await window.chrome.storage.local.set({ dailyStats })
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

  async addBlockedWebsite(website) {
    const cleanUrl = this.cleanUrl(website)
    if (!this.state.blockedWebsites.includes(cleanUrl)) {
      this.state.blockedWebsites.push(cleanUrl)
      await this.saveState()
      this.broadcastUpdate()
    }
  }

  async removeBlockedWebsite(website) {
    const cleanUrl = this.cleanUrl(website)
    this.state.blockedWebsites = this.state.blockedWebsites.filter((url) => url !== cleanUrl)
    await this.saveState()
    this.broadcastUpdate()
  }

  cleanUrl(url) {
    // Remove protocol and www, keep just domain
    return url
      .replace(/^https?:\/\/(www\.)?/, "")
      .split("/")[0]
      .toLowerCase()
  }

  async isWebsiteBlocked(currentUrl) {
    if (!this.state.settings.websiteBlocking) return false

    const shouldBlock =
      (this.state.settings.blockDuringFocus && this.state.currentMode === "focus" && this.state.isRunning) ||
      (this.state.settings.blockDuringBreaks &&
        (this.state.currentMode === "shortBreak" || this.state.currentMode === "longBreak") &&
        this.state.isRunning)

    if (!shouldBlock) return false

    const cleanCurrentUrl = this.cleanUrl(currentUrl)
    return this.state.blockedWebsites.some(
      (blockedUrl) => cleanCurrentUrl.includes(blockedUrl) || blockedUrl.includes(cleanCurrentUrl),
    )
  }

  broadcastUpdate() {
    // Send update to popup
    window.chrome.runtime.sendMessage({ type: "TIMER_UPDATE", state: this.state }).catch(() => {
      // Popup might not be open, ignore error
    })
  }

  async notifyContentScripts(message) {
    try {
      const tabs = await window.chrome.tabs.query({ url: ["https://www.youtube.com/*", "https://youtube.com/*"] })

      for (const tab of tabs) {
        window.chrome.tabs.sendMessage(tab.id, message).catch(() => {
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
