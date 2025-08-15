// Options page script for Pomodoro Timer Chrome Extension
const chrome = window.chrome // Declare the chrome variable

class PomodoroOptions {
  constructor() {
    this.defaultSettings = {
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
      collectStats: true,
    }

    this.elements = {}
    this.saveTimeout = null

    this.initializeOptions()
  }

  async initializeOptions() {
    this.bindElements()
    await this.loadSettings()
    this.bindEventListeners()
    this.showSaveStatus("Settings loaded successfully", "success")
  }

  bindElements() {
    // Timer settings
    this.elements.focusTime = document.getElementById("focus-time")
    this.elements.shortBreak = document.getElementById("short-break")
    this.elements.longBreak = document.getElementById("long-break")
    this.elements.sessionsUntilLongBreak = document.getElementById("sessions-until-long-break")

    // Automation settings
    this.elements.autoStartBreaks = document.getElementById("auto-start-breaks")
    this.elements.autoStartPomodoros = document.getElementById("auto-start-pomodoros")

    // Notification settings
    this.elements.notifications = document.getElementById("notifications")
    this.elements.sounds = document.getElementById("sounds")

    // Break enforcement settings
    this.elements.enforceBreaks = document.getElementById("enforce-breaks")
    this.elements.youtubeIntegration = document.getElementById("youtube-integration")

    // Data settings
    this.elements.collectStats = document.getElementById("collect-stats")

    // Buttons
    this.elements.exportData = document.getElementById("export-data")
    this.elements.clearData = document.getElementById("clear-data")
    this.elements.viewStats = document.getElementById("view-stats")
    this.elements.resetDefaults = document.getElementById("reset-defaults")

    // Status
    this.elements.saveStatus = document.getElementById("save-status")
  }

  bindEventListeners() {
    // Timer settings
    this.elements.focusTime.addEventListener("change", () => this.handleSettingChange())
    this.elements.shortBreak.addEventListener("change", () => this.handleSettingChange())
    this.elements.longBreak.addEventListener("change", () => this.handleSettingChange())
    this.elements.sessionsUntilLongBreak.addEventListener("change", () => this.handleSettingChange())

    // Toggle settings
    this.elements.autoStartBreaks.addEventListener("change", () => this.handleSettingChange())
    this.elements.autoStartPomodoros.addEventListener("change", () => this.handleSettingChange())
    this.elements.notifications.addEventListener("change", () => this.handleSettingChange())
    this.elements.sounds.addEventListener("change", () => this.handleSettingChange())
    this.elements.enforceBreaks.addEventListener("change", () => this.handleSettingChange())
    this.elements.youtubeIntegration.addEventListener("change", () => this.handleSettingChange())
    this.elements.collectStats.addEventListener("change", () => this.handleSettingChange())

    // Buttons
    this.elements.exportData.addEventListener("click", () => this.exportData())
    this.elements.clearData.addEventListener("click", () => this.clearData())
    this.elements.viewStats.addEventListener("click", () => this.viewStats())
    this.elements.resetDefaults.addEventListener("click", () => this.resetDefaults())
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(["settings"])
      const settings = result.settings || this.defaultSettings

      // Update UI elements
      this.elements.focusTime.value = settings.focusTime
      this.elements.shortBreak.value = settings.shortBreak
      this.elements.longBreak.value = settings.longBreak
      this.elements.sessionsUntilLongBreak.value = settings.sessionsUntilLongBreak

      this.elements.autoStartBreaks.checked = settings.autoStartBreaks
      this.elements.autoStartPomodoros.checked = settings.autoStartPomodoros
      this.elements.notifications.checked = settings.notifications
      this.elements.sounds.checked = settings.sounds
      this.elements.enforceBreaks.checked = settings.enforceBreaks
      this.elements.youtubeIntegration.checked = settings.youtubeIntegration
      this.elements.collectStats.checked = settings.collectStats

      console.log("[v0] Settings loaded:", settings)
    } catch (error) {
      console.error("[v0] Error loading settings:", error)
      this.showSaveStatus("Error loading settings", "error")
    }
  }

  handleSettingChange() {
    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    // Debounce save operation
    this.saveTimeout = setTimeout(() => {
      this.saveSettings()
    }, 500)

    this.showSaveStatus("Saving...", "info")
  }

  async saveSettings() {
    try {
      const settings = {
        focusTime: Number.parseInt(this.elements.focusTime.value),
        shortBreak: Number.parseInt(this.elements.shortBreak.value),
        longBreak: Number.parseInt(this.elements.longBreak.value),
        sessionsUntilLongBreak: Number.parseInt(this.elements.sessionsUntilLongBreak.value),
        autoStartBreaks: this.elements.autoStartBreaks.checked,
        autoStartPomodoros: this.elements.autoStartPomodoros.checked,
        notifications: this.elements.notifications.checked,
        sounds: this.elements.sounds.checked,
        enforceBreaks: this.elements.enforceBreaks.checked,
        youtubeIntegration: this.elements.youtubeIntegration.checked,
        collectStats: this.elements.collectStats.checked,
      }

      // Validate settings
      if (!this.validateSettings(settings)) {
        return
      }

      // Save to storage
      await chrome.storage.local.set({ settings })

      // Notify background script
      await chrome.runtime.sendMessage({
        type: "SETTINGS_UPDATED",
        settings,
      })

      this.showSaveStatus("Settings saved successfully", "success")
      console.log("[v0] Settings saved:", settings)
    } catch (error) {
      console.error("[v0] Error saving settings:", error)
      this.showSaveStatus("Error saving settings", "error")
    }
  }

  validateSettings(settings) {
    // Validate timer durations
    if (settings.focusTime < 1 || settings.focusTime > 120) {
      this.showSaveStatus("Focus time must be between 1-120 minutes", "error")
      return false
    }

    if (settings.shortBreak < 1 || settings.shortBreak > 30) {
      this.showSaveStatus("Short break must be between 1-30 minutes", "error")
      return false
    }

    if (settings.longBreak < 5 || settings.longBreak > 60) {
      this.showSaveStatus("Long break must be between 5-60 minutes", "error")
      return false
    }

    if (settings.sessionsUntilLongBreak < 2 || settings.sessionsUntilLongBreak > 10) {
      this.showSaveStatus("Sessions until long break must be between 2-10", "error")
      return false
    }

    return true
  }

  async exportData() {
    try {
      const data = await chrome.storage.local.get(null)
      const exportData = {
        settings: data.settings,
        dailyStats: data.dailyStats,
        totalSessions: data.totalSessions,
        exportDate: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `pomodoro-data-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      this.showSaveStatus("Data exported successfully", "success")
    } catch (error) {
      console.error("[v0] Error exporting data:", error)
      this.showSaveStatus("Error exporting data", "error")
    }
  }

  async clearData() {
    if (!confirm("Are you sure you want to clear all data? This action cannot be undone.")) {
      return
    }

    try {
      await chrome.storage.local.clear()
      await this.loadSettings() // Reload default settings
      this.showSaveStatus("All data cleared successfully", "success")
    } catch (error) {
      console.error("[v0] Error clearing data:", error)
      this.showSaveStatus("Error clearing data", "error")
    }
  }

  viewStats() {
    chrome.tabs.create({ url: chrome.runtime.getURL("stats.html") })
  }

  async resetDefaults() {
    if (!confirm("Reset all settings to default values?")) {
      return
    }

    try {
      await chrome.storage.local.set({ settings: this.defaultSettings })
      await this.loadSettings()
      this.showSaveStatus("Settings reset to defaults", "success")
    } catch (error) {
      console.error("[v0] Error resetting settings:", error)
      this.showSaveStatus("Error resetting settings", "error")
    }
  }

  showSaveStatus(message, type = "info") {
    const statusElement = this.elements.saveStatus.querySelector(".status-text")
    statusElement.textContent = message

    // Remove existing status classes
    statusElement.classList.remove("status-success", "status-error")

    // Add appropriate class
    if (type === "success") {
      statusElement.classList.add("status-success")
    } else if (type === "error") {
      statusElement.classList.add("status-error")
    }

    // Show animation
    this.elements.saveStatus.classList.remove("show")
    setTimeout(() => {
      this.elements.saveStatus.classList.add("show")
    }, 10)

    // Auto-hide after 3 seconds for success messages
    if (type === "success") {
      setTimeout(() => {
        statusElement.textContent = "Settings saved automatically"
        statusElement.classList.remove("status-success", "status-error")
      }, 3000)
    }
  }
}

// Initialize options page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new PomodoroOptions()
})
