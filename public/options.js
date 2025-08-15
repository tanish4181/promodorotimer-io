// Options page script for Pomodoro Timer Chrome Extension

class PomodoroOptions {
  constructor() {
    console.log("[v0] Initializing PomodoroOptions")
    this.elements = {}
    this.currentSettings = {}
    this.backgroundAvailable = false
    
    this.initializeElements()
    this.bindEventListeners()
    this.initializeOptions()
  }

  initializeElements() {
    // Timer settings
    this.elements.focusTime = document.getElementById("focus-time")
    this.elements.shortBreak = document.getElementById("short-break")
    this.elements.longBreak = document.getElementById("long-break")
    this.elements.sessionsUntilLongBreak = document.getElementById("sessions-until-long-break")

    // Toggle settings
    this.elements.autoStartBreaks = document.getElementById("auto-start-breaks")
    this.elements.autoStartPomodoros = document.getElementById("auto-start-pomodoros")
    this.elements.autoSwitchModes = document.getElementById("auto-switch-modes")
    this.elements.notifications = document.getElementById("notifications")
    this.elements.sounds = document.getElementById("sounds")
    this.elements.breakReminders = document.getElementById("break-reminders")
    this.elements.enforceBreaks = document.getElementById("enforce-breaks")
    this.elements.youtubeIntegration = document.getElementById("youtube-integration")
    this.elements.breakOverlay = document.getElementById("break-overlay")
    this.elements.breakCountdown = document.getElementById("break-countdown")
    this.elements.nextSessionInfo = document.getElementById("next-session-info")
    this.elements.focusOverlay = document.getElementById("focus-overlay")
    this.elements.hideDistractions = document.getElementById("hide-distractions")
    this.elements.focusIndicator = document.getElementById("focus-indicator")
    this.elements.websiteBlocking = document.getElementById("website-blocking")
    this.elements.hideYoutubeComments = document.getElementById("hide-youtube-comments")
    this.elements.hideYoutubeRecommendations = document.getElementById("hide-youtube-recommendations")
    this.elements.hideYoutubeShorts = document.getElementById("hide-youtube-shorts")
    this.elements.pauseYoutubeBreaks = document.getElementById("pause-youtube-breaks")
    this.elements.collectStats = document.getElementById("collect-stats")

    // Buttons
    this.elements.exportData = document.getElementById("export-data")
    this.elements.clearData = document.getElementById("clear-data")
    this.elements.viewStats = document.getElementById("view-stats")
    this.elements.resetDefaults = document.getElementById("reset-defaults")

    // Status
    this.elements.saveStatus = document.getElementById("save-status")

    console.log("[v0] Elements initialized:", Object.keys(this.elements).length, "elements found")
  }

  bindEventListeners() {
    // Timer settings
    this.elements.focusTime.addEventListener("change", () => this.handleSettingChange())
    this.elements.shortBreak.addEventListener("change", () => this.handleSettingChange())
    this.elements.longBreak.addEventListener("change", () => this.handleSettingChange())
    this.elements.sessionsUntilLongBreak.addEventListener("change", () => this.handleSettingChange())

    // Toggle settings
    this.elements.autoStartBreaks.addEventListener("change", () => this.handleToggleChange("autoStartBreaks"))
    this.elements.autoStartPomodoros.addEventListener("change", () => this.handleToggleChange("autoStartPomodoros"))
    this.elements.autoSwitchModes.addEventListener("change", () => this.handleToggleChange("autoSwitchModes"))
    this.elements.notifications.addEventListener("change", () => this.handleToggleChange("notifications"))
    this.elements.sounds.addEventListener("change", () => this.handleToggleChange("sounds"))
    this.elements.breakReminders.addEventListener("change", () => this.handleToggleChange("breakReminders"))
    this.elements.enforceBreaks.addEventListener("change", () => this.handleToggleChange("enforceBreaks"))
    this.elements.youtubeIntegration.addEventListener("change", () => this.handleToggleChange("youtubeIntegration"))
    this.elements.breakOverlay.addEventListener("change", () => this.handleToggleChange("breakOverlay"))
    this.elements.breakCountdown.addEventListener("change", () => this.handleToggleChange("breakCountdown"))
    this.elements.nextSessionInfo.addEventListener("change", () => this.handleToggleChange("nextSessionInfo"))
    this.elements.focusOverlay.addEventListener("change", () => this.handleToggleChange("focusOverlay"))
    this.elements.hideDistractions.addEventListener("change", () => this.handleToggleChange("hideDistractions"))
    this.elements.focusIndicator.addEventListener("change", () => this.handleToggleChange("focusIndicator"))
    this.elements.websiteBlocking.addEventListener("change", () => this.handleToggleChange("websiteBlocking"))
    this.elements.hideYoutubeComments.addEventListener("change", () => this.handleToggleChange("hideYoutubeComments"))
    this.elements.hideYoutubeRecommendations.addEventListener("change", () => this.handleToggleChange("hideYoutubeRecommendations"))
    this.elements.hideYoutubeShorts.addEventListener("change", () => this.handleToggleChange("hideYoutubeShorts"))
    this.elements.pauseYoutubeBreaks.addEventListener("change", () => this.handleToggleChange("pauseYoutubeBreaks"))
    this.elements.collectStats.addEventListener("change", () => this.handleToggleChange("collectStats"))

    // Buttons
    this.elements.exportData.addEventListener("click", () => this.exportData())
    this.elements.clearData.addEventListener("click", () => this.clearData())
    this.elements.viewStats.addEventListener("click", () => this.viewStats())
    this.elements.resetDefaults.addEventListener("click", () => this.resetDefaults())
  }

  async initializeOptions() {
    try {
      console.log("[v0] Initializing options page")
      
      // Check if background script is available
      this.backgroundAvailable = await this.checkBackgroundScript()
      
      if (this.backgroundAvailable) {
        console.log("[v0] Background script is available")
      } else {
        console.warn("[v0] Background script not available, some features may be limited")
        this.showSaveStatus("Background script not available, settings will be saved locally", "warning")
        
        // Set up periodic check for background script availability
        this.setupBackgroundCheck()
      }
      
      // Load settings
      await this.loadSettings()
    } catch (error) {
      console.error("[v0] Error initializing options:", error)
      this.showSaveStatus("Error initializing options", "error")
    }
  }

  async checkBackgroundScript() {
    try {
      // Try to send a simple message to check if background script is available
      await chrome.runtime.sendMessage({ type: "GET_STATE" })
      return true
    } catch (error) {
      console.warn("[v0] Background script not available:", error.message)
      return false
    }
  }

  setupBackgroundCheck() {
    // Check every 5 seconds if background script becomes available
    setInterval(async () => {
      if (!this.backgroundAvailable) {
        const isAvailable = await this.checkBackgroundScript()
        if (isAvailable) {
          console.log("[v0] Background script is now available")
          this.backgroundAvailable = true
          this.showSaveStatus("Background script connected", "success")
        }
      }
    }, 5000)
  }

  async handleToggleChange(settingName) {
    console.log("[v0] Toggle changed:", settingName)
    
    // Get the current value from the checkbox
    const element = this.elements[settingName]
    if (!element) {
      console.error("[v0] Element not found for setting:", settingName)
      return
    }

    const newValue = element.checked
    console.log("[v0] Setting", settingName, "to", newValue)

    // Update the current settings object
    this.currentSettings[settingName] = newValue

    try {
      // Save the complete settings object to storage
      await chrome.storage.local.set({ settings: this.currentSettings })

      // Only try to notify background script if it's available
      if (this.backgroundAvailable) {
        // Try to notify background script with retry logic
        let retryCount = 0
        const maxRetries = 3
        
        while (retryCount < maxRetries) {
          try {
            await chrome.runtime.sendMessage({
              type: "SETTINGS_UPDATED",
              settings: this.currentSettings,
            })
            console.log("[v0] Setting", settingName, "updated successfully")
            this.showSaveStatus("Setting updated", "success")
            break // Success, exit retry loop
          } catch (error) {
            retryCount++
            console.warn(`[v0] Attempt ${retryCount} failed to send message to background:`, error.message)
            
            if (retryCount >= maxRetries) {
              console.error("[v0] Failed to send message to background after", maxRetries, "attempts")
              this.showSaveStatus("Setting saved locally, but background sync failed", "warning")
              this.backgroundAvailable = false // Mark as unavailable for future attempts
            } else {
              // Wait a bit before retrying
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          }
        }
      } else {
        // Background script not available, just save locally
        this.showSaveStatus("Setting saved locally", "success")
      }
    } catch (error) {
      console.error("[v0] Error updating setting:", error)
      this.showSaveStatus("Error updating setting", "error")
      // Revert the checkbox if there was an error
      element.checked = !newValue
      this.currentSettings[settingName] = !newValue
    }
  }

  async handleSettingChange() {
    console.log("[v0] Setting changed")
    try {
      // Update current settings with new values
      this.currentSettings.focusTime = Number.parseInt(this.elements.focusTime.value)
      this.currentSettings.shortBreak = Number.parseInt(this.elements.shortBreak.value)
      this.currentSettings.longBreak = Number.parseInt(this.elements.longBreak.value)
      this.currentSettings.sessionsUntilLongBreak = Number.parseInt(this.elements.sessionsUntilLongBreak.value)

      await chrome.storage.local.set({ settings: this.currentSettings })
      
      // Only try to notify background script if it's available
      if (this.backgroundAvailable) {
        // Try to notify background script with retry logic
        let retryCount = 0
        const maxRetries = 3
        
        while (retryCount < maxRetries) {
          try {
            await chrome.runtime.sendMessage({ 
              type: "SETTINGS_UPDATED", 
              settings: this.currentSettings 
            })
            console.log("[v0] Settings updated:", this.currentSettings)
            this.showSaveStatus("Settings saved", "success")
            break // Success, exit retry loop
          } catch (error) {
            retryCount++
            console.warn(`[v0] Attempt ${retryCount} failed to send message to background:`, error.message)
            
            if (retryCount >= maxRetries) {
              console.error("[v0] Failed to send message to background after", maxRetries, "attempts")
              this.showSaveStatus("Settings saved locally, but background sync failed", "warning")
              this.backgroundAvailable = false // Mark as unavailable for future attempts
            } else {
              // Wait a bit before retrying
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          }
        }
      } else {
        // Background script not available, just save locally
        this.showSaveStatus("Settings saved locally", "success")
      }
    } catch (error) {
      console.error("[v0] Error saving settings:", error)
      this.showSaveStatus("Error saving settings", "error")
    }
  }

  async loadSettings() {
    try {
      console.log("[v0] Loading settings")
      const result = await chrome.storage.local.get("settings")
      const defaultSettings = this.getDefaultSettings()
      
      // Merge existing settings with defaults
      this.currentSettings = { ...defaultSettings, ...result.settings }

      // Update form elements
      this.elements.focusTime.value = this.currentSettings.focusTime || 25
      this.elements.shortBreak.value = this.currentSettings.shortBreak || 5
      this.elements.longBreak.value = this.currentSettings.longBreak || 15
      this.elements.sessionsUntilLongBreak.value = this.currentSettings.sessionsUntilLongBreak || 4

      // Update toggle switches
      this.elements.autoStartBreaks.checked = this.currentSettings.autoStartBreaks !== false
      this.elements.autoStartPomodoros.checked = this.currentSettings.autoStartPomodoros === true
      this.elements.autoSwitchModes.checked = this.currentSettings.autoSwitchModes !== false
      this.elements.notifications.checked = this.currentSettings.notifications !== false
      this.elements.sounds.checked = this.currentSettings.sounds !== false
      this.elements.breakReminders.checked = this.currentSettings.breakReminders !== false
      this.elements.enforceBreaks.checked = this.currentSettings.enforceBreaks !== false
      this.elements.youtubeIntegration.checked = this.currentSettings.youtubeIntegration !== false
      this.elements.breakOverlay.checked = this.currentSettings.breakOverlay !== false
      this.elements.breakCountdown.checked = this.currentSettings.breakCountdown !== false
      this.elements.nextSessionInfo.checked = this.currentSettings.nextSessionInfo !== false
      this.elements.focusOverlay.checked = this.currentSettings.focusOverlay === true
      this.elements.hideDistractions.checked = this.currentSettings.hideDistractions !== false
      this.elements.focusIndicator.checked = this.currentSettings.focusIndicator !== false
      this.elements.websiteBlocking.checked = this.currentSettings.websiteBlocking !== false
      this.elements.hideYoutubeComments.checked = this.currentSettings.hideYoutubeComments !== false
      this.elements.hideYoutubeRecommendations.checked = this.currentSettings.hideYoutubeRecommendations !== false
      this.elements.hideYoutubeShorts.checked = this.currentSettings.hideYoutubeShorts !== false
      this.elements.pauseYoutubeBreaks.checked = this.currentSettings.pauseYoutubeBreaks !== false
      this.elements.collectStats.checked = this.currentSettings.collectStats !== false

      console.log("[v0] Settings loaded successfully:", this.currentSettings)
      this.showSaveStatus("Settings loaded", "success")
    } catch (error) {
      console.error("[v0] Error loading settings:", error)
      this.showSaveStatus("Error loading settings", "error")
    }
  }

  getDefaultSettings() {
    return {
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
    }
  }

  showSaveStatus(message, type = "info") {
    const statusElement = this.elements.saveStatus
    if (!statusElement) return

    const statusText = statusElement.querySelector(".status-text")
    if (statusText) {
      statusText.textContent = message
    }

    // Update status styling
    statusElement.className = `save-status ${type}`

    // Auto-hide after 3 seconds
    setTimeout(() => {
      statusElement.className = "save-status"
      if (statusText) {
        statusText.textContent = "Settings saved automatically"
      }
    }, 3000)
  }

  async exportData() {
    try {
      const result = await chrome.storage.local.get(null)
      const dataStr = JSON.stringify(result, null, 2)
      const dataBlob = new Blob([dataStr], { type: "application/json" })
      
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement("a")
      link.href = url
      link.download = `pomodoro-timer-data-${new Date().toISOString().split("T")[0]}.json`
      link.click()
      
      URL.revokeObjectURL(url)

      this.showSaveStatus("Data exported successfully", "success")
    } catch (error) {
      console.error("[v0] Error exporting data:", error)
      this.showSaveStatus("Error exporting data", "error")
    }
  }

  async clearData() {
    if (confirm("Are you sure you want to clear all data? This action cannot be undone.")) {
      try {
        await chrome.storage.local.clear()
        this.currentSettings = this.getDefaultSettings()
        this.loadSettings()
        this.showSaveStatus("All data cleared", "success")
      } catch (error) {
        console.error("[v0] Error clearing data:", error)
        this.showSaveStatus("Error clearing data", "error")
      }
    }
  }

  viewStats() {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL("stats.html") })
    } catch (error) {
      console.error("[v0] Error opening stats:", error)
      this.showSaveStatus("Error opening stats", "error")
    }
  }

  async resetDefaults() {
    if (confirm("Are you sure you want to reset all settings to defaults?")) {
      try {
        this.currentSettings = this.getDefaultSettings()
        await chrome.storage.local.set({ settings: this.currentSettings })
        
        if (this.backgroundAvailable) {
          await chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings: this.currentSettings })
        }
        
        this.loadSettings()
        this.showSaveStatus("Settings reset to defaults", "success")
      } catch (error) {
        console.error("[v0] Error resetting settings:", error)
        this.showSaveStatus("Error resetting settings", "error")
      }
    }
  }
}

// Initialize options page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] DOM loaded, initializing options")
  new PomodoroOptions()
})
