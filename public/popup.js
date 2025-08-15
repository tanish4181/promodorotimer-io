// Popup script for Pomodoro Timer Chrome Extension
class PomodoroPopup {
  constructor() {
    console.log("[v0] Initializing PomodoroPopup")
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

    console.log("[v0] Elements found:", {
      timerText: !!this.timerText,
      startBtn: !!this.startBtn,
      pauseBtn: !!this.pauseBtn,
    })

    this.initializeEventListeners()
    this.loadState()
  }

  initializeEventListeners() {
    console.log("[v0] Setting up event listeners")

    this.startBtn.addEventListener("click", () => {
      console.log("[v0] Start button clicked")
      this.startTimer()
    })

    this.pauseBtn.addEventListener("click", () => {
      console.log("[v0] Pause button clicked")
      this.pauseTimer()
    })

    this.resetBtn.addEventListener("click", () => {
      console.log("[v0] Reset button clicked")
      this.resetTimer()
    })

    this.settingsBtn.addEventListener("click", () => {
      console.log("[v0] Settings button clicked")
      this.openSettings()
    })

    this.statsBtn.addEventListener("click", () => {
      console.log("[v0] Stats button clicked")
      this.openStats()
    })

    this.focusTimeSelect.addEventListener("change", () => {
      console.log("[v0] Focus time changed")
      this.updateSettings()
    })

    this.breakTimeSelect.addEventListener("change", () => {
      console.log("[v0] Break time changed")
      this.updateSettings()
    })

    window.chrome = window.chrome || {}
    window.chrome.runtime = window.chrome.runtime || {}
    window.chrome.runtime.onMessage = window.chrome.runtime.onMessage || {}
    window.chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("[v0] Message received:", message)
      if (message.type === "TIMER_UPDATE") {
        this.updateDisplay()
      }
    })
  }

  async loadState() {
    console.log("[v0] Loading state")
    try {
      const result = await window.chrome.storage.local.get([
        "timerState",
        "currentTime",
        "isRunning",
        "currentMode",
        "sessionCount",
        "settings",
      ])

      console.log("[v0] Loaded state:", result)

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

      this.updateDisplay()
    } catch (error) {
      console.error("[v0] Error loading state:", error)
      this.initializeDefaultState()
      this.updateDisplay()
    }
  }

  initializeDefaultState() {
    console.log("[v0] Initializing default state")
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
    console.log("[v0] Updating display with state:", this.state)

    if (!this.state) {
      console.log("[v0] No state available, skipping display update")
      return
    }

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
    console.log("[v0] Starting timer")
    try {
      await window.chrome.runtime.sendMessage({ type: "START_TIMER" })
      await this.loadState()
    } catch (error) {
      console.error("[v0] Error starting timer:", error)
    }
  }

  async pauseTimer() {
    console.log("[v0] Pausing timer")
    try {
      await window.chrome.runtime.sendMessage({ type: "PAUSE_TIMER" })
      await this.loadState()
    } catch (error) {
      console.error("[v0] Error pausing timer:", error)
    }
  }

  async resetTimer() {
    console.log("[v0] Resetting timer")
    try {
      await window.chrome.runtime.sendMessage({ type: "RESET_TIMER" })
      await this.loadState()
    } catch (error) {
      console.error("[v0] Error resetting timer:", error)
    }
  }

  async updateSettings() {
    console.log("[v0] Updating settings")
    try {
      const newSettings = {
        ...this.state.settings,
        focusTime: Number.parseInt(this.focusTimeSelect.value),
        shortBreak: Number.parseInt(this.breakTimeSelect.value),
      }

      await window.chrome.storage.local.set({ settings: newSettings })
      await window.chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings: newSettings })

      this.state.settings = newSettings
      console.log("[v0] Settings updated:", newSettings)
    } catch (error) {
      console.error("[v0] Error updating settings:", error)
    }
  }

  openSettings() {
    console.log("[v0] Opening settings")
    try {
      window.chrome.runtime.openOptionsPage()
    } catch (error) {
      console.error("[v0] Error opening settings:", error)
    }
  }

  openStats() {
    console.log("[v0] Opening stats")
    try {
      window.chrome.tabs.create({ url: window.chrome.runtime.getURL("stats.html") })
    } catch (error) {
      console.error("[v0] Error opening stats:", error)
    }
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] DOM loaded, initializing popup")
  new PomodoroPopup()
})
