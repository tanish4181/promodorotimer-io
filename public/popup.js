// Popup script for Pomodoro Timer Chrome Extension
class PomodoroPopup {
  constructor() {
    this.timerText = document.getElementById("timer-text")
    this.timerLabel = document.getElementById("timer-label")
    this.timerCircle = document.getElementById("timer-circle")
    this.startBtn = document.getElementById("start-btn")
    this.pauseBtn = document.getElementById("pause-btn")
    this.resetBtn = document.getElementById("reset-btn")
    this.sessionCount = document.getElementById("session-count")
    this.currentMode = document.getElementById("current-mode")
    this.focusTimeSelect = document.getElementById("focus-time")
    this.breakTimeSelect = document.getElementById("break-time")
    this.settingsBtn = document.getElementById("settings-btn")
    this.statsBtn = document.getElementById("stats-btn")

    this.initializeEventListeners()
    this.loadState()
    this.updateDisplay()
  }

  initializeEventListeners() {
    this.startBtn.addEventListener("click", () => this.startTimer())
    this.pauseBtn.addEventListener("click", () => this.pauseTimer())
    this.resetBtn.addEventListener("click", () => this.resetTimer())
    this.settingsBtn.addEventListener("click", () => this.openSettings())
    this.statsBtn.addEventListener("click", () => this.openStats())

    this.focusTimeSelect.addEventListener("change", () => this.updateSettings())
    this.breakTimeSelect.addEventListener("change", () => this.updateSettings())

    // Listen for background script updates
    window.chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "TIMER_UPDATE") {
        this.updateDisplay()
      }
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
        "settings",
      ])

      this.state = {
        timerState: result.timerState || "focus",
        currentTime: result.currentTime || 25 * 60,
        isRunning: result.isRunning || false,
        currentMode: result.currentMode || "focus",
        sessionCount: result.sessionCount || 1,
        settings: result.settings || {
          focusTime: 25,
          shortBreak: 5,
          longBreak: 15,
          sessionsUntilLongBreak: 4,
          autoStartBreaks: true,
          autoStartPomodoros: false,
          notifications: true,
          sounds: true,
        },
      }

      // Update UI elements
      this.focusTimeSelect.value = this.state.settings.focusTime
      this.breakTimeSelect.value = this.state.settings.shortBreak
    } catch (error) {
      console.error("Error loading state:", error)
      this.initializeDefaultState()
    }
  }

  initializeDefaultState() {
    this.state = {
      timerState: "focus",
      currentTime: 25 * 60,
      isRunning: false,
      currentMode: "focus",
      sessionCount: 1,
      settings: {
        focusTime: 25,
        shortBreak: 5,
        longBreak: 15,
        sessionsUntilLongBreak: 4,
        autoStartBreaks: true,
        autoStartPomodoros: false,
        notifications: true,
        sounds: true,
      },
    }
  }

  updateDisplay() {
    const minutes = Math.floor(this.state.currentTime / 60)
    const seconds = this.state.currentTime % 60
    this.timerText.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`

    // Update labels and modes
    const modeLabels = {
      focus: "Focus Time",
      shortBreak: "Short Break",
      longBreak: "Long Break",
    }

    this.timerLabel.textContent = modeLabels[this.state.currentMode] || "Focus Time"
    this.currentMode.textContent = this.state.currentMode === "focus" ? "Focus" : "Break"
    this.sessionCount.textContent = this.state.sessionCount

    // Update button states
    if (this.state.isRunning) {
      this.startBtn.style.display = "none"
      this.pauseBtn.style.display = "block"
      this.timerCircle.classList.add("active")
    } else {
      this.startBtn.style.display = "block"
      this.pauseBtn.style.display = "none"
      this.timerCircle.classList.remove("active")
    }

    // Update body class for styling
    document.body.className = ""
    if (this.state.currentMode === "shortBreak" || this.state.currentMode === "longBreak") {
      document.body.classList.add(this.state.currentMode === "longBreak" ? "long-break-mode" : "break-mode")
    }
  }

  async startTimer() {
    await window.chrome.runtime.sendMessage({ type: "START_TIMER" })
    this.loadState()
    this.updateDisplay()
  }

  async pauseTimer() {
    await window.chrome.runtime.sendMessage({ type: "PAUSE_TIMER" })
    this.loadState()
    this.updateDisplay()
  }

  async resetTimer() {
    await window.chrome.runtime.sendMessage({ type: "RESET_TIMER" })
    this.loadState()
    this.updateDisplay()
  }

  async updateSettings() {
    const newSettings = {
      ...this.state.settings,
      focusTime: Number.parseInt(this.focusTimeSelect.value),
      shortBreak: Number.parseInt(this.breakTimeSelect.value),
    }

    await window.chrome.storage.local.set({ settings: newSettings })
    await window.chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings: newSettings })

    this.state.settings = newSettings
  }

  openSettings() {
    window.chrome.runtime.openOptionsPage()
  }

  openStats() {
    window.chrome.tabs.create({ url: window.chrome.runtime.getURL("stats.html") })
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new PomodoroPopup()
})
