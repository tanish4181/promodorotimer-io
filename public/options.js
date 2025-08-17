// Enhanced Options Page Script for Pomodoro Timer Chrome Extension

class ModernPomodoroOptions {
  constructor() {
    console.log("[v0] Initializing Modern PomodoroOptions");
    this.elements = {};
    this.currentSettings = {};
    this.backgroundAvailable = false;

    this.initializeElements();
    this.setupTabNavigation();
    this.bindEventListeners();
    this.initializeOptions();
  }

  initializeElements() {
    // Timer settings
    this.elements.focusTime = document.getElementById("focus-time");
    this.elements.shortBreak = document.getElementById("short-break");
    this.elements.longBreak = document.getElementById("long-break");
    this.elements.sessionsUntilLongBreak = document.getElementById(
      "sessions-until-long-break"
    );

    // Toggle settings - Fixed to properly get checkbox elements
    this.elements.autoStartBreaks = document.getElementById("auto-start-breaks");
    this.elements.autoStartPomodoros = document.getElementById("auto-start-pomodoros");
    this.elements.autoSwitchModes = document.getElementById("auto-switch-modes");
    this.elements.notifications = document.getElementById("notifications");
    this.elements.sounds = document.getElementById("sounds");
    this.elements.breakReminders = document.getElementById("break-reminders");
    this.elements.enforceBreaks = document.getElementById("enforce-breaks");
    this.elements.youtubeIntegration = document.getElementById("youtube-integration");
    this.elements.breakOverlay = document.getElementById("break-overlay");
    this.elements.breakCountdown = document.getElementById("break-countdown");
    this.elements.nextSessionInfo = document.getElementById("next-session-info");
    this.elements.focusOverlay = document.getElementById("focus-overlay");
    this.elements.hideDistractions = document.getElementById("hide-distractions");
    this.elements.focusIndicator = document.getElementById("focus-indicator");
    this.elements.websiteBlocking = document.getElementById("website-blocking");
    this.elements.hideYoutubeComments = document.getElementById("hide-youtube-comments");
    this.elements.hideYoutubeRecommendations = document.getElementById("hide-youtube-recommendations");
    this.elements.hideYoutubeShorts = document.getElementById("hide-youtube-shorts");
    this.elements.pauseYoutubeBreaks = document.getElementById("pause-youtube-breaks");
    this.elements.collectStats = document.getElementById("collect-stats");

    // Buttons
    this.elements.exportData = document.getElementById("export-data");
    this.elements.clearData = document.getElementById("clear-data");
    this.elements.viewStats = document.getElementById("view-stats");
    this.elements.resetDefaults = document.getElementById("reset-defaults");

    // Status and header elements
    this.elements.saveStatus = document.getElementById("save-status");
    this.elements.headerFocusTime = document.getElementById("header-focus-time");
    this.elements.headerBreakTime = document.getElementById("header-break-time");
    this.elements.storageUsage = document.getElementById("storage-usage");

    // Tab elements
    this.elements.tabButtons = document.querySelectorAll('.nav-tab');
    this.elements.tabContents = document.querySelectorAll('.tab-content');

    console.log("[v0] Elements initialized:", Object.keys(this.elements).length, "elements found");
  }

  setupTabNavigation() {
    this.elements.tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const targetTab = e.target.closest('.nav-tab').dataset.tab;
        this.switchTab(targetTab);
      });
    });
  }

  switchTab(tabName) {
    // Remove active class from all tabs and contents
    this.elements.tabButtons.forEach(btn => btn.classList.remove('active'));
    this.elements.tabContents.forEach(content => content.classList.remove('active'));

    // Add active class to selected tab and content
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(tabName);
    
    if (activeButton && activeContent) {
      activeButton.classList.add('active');
      activeContent.classList.add('active');
    }
  }

  bindEventListeners() {
    // Timer settings
    if (this.elements.focusTime) {
      this.elements.focusTime.addEventListener("change", () => this.handleSettingChange());
    }
    if (this.elements.shortBreak) {
      this.elements.shortBreak.addEventListener("change", () => this.handleSettingChange());
    }
    if (this.elements.longBreak) {
      this.elements.longBreak.addEventListener("change", () => this.handleSettingChange());
    }
    if (this.elements.sessionsUntilLongBreak) {
      this.elements.sessionsUntilLongBreak.addEventListener("change", () => this.handleSettingChange());
    }

    // Toggle settings
    this.bindToggleListener("autoStartBreaks");
    this.bindToggleListener("autoStartPomodoros");
    this.bindToggleListener("autoSwitchModes");
    this.bindToggleListener("notifications");
    this.bindToggleListener("sounds");
    this.bindToggleListener("breakReminders");
    this.bindToggleListener("enforceBreaks");
    this.bindToggleListener("youtubeIntegration");
    this.bindToggleListener("breakOverlay");
    this.bindToggleListener("breakCountdown");
    this.bindToggleListener("nextSessionInfo");
    this.bindToggleListener("focusOverlay");
    this.bindToggleListener("hideDistractions");
    this.bindToggleListener("focusIndicator");
    this.bindToggleListener("websiteBlocking");
    this.bindToggleListener("hideYoutubeComments");
    this.bindToggleListener("hideYoutubeRecommendations");
    this.bindToggleListener("hideYoutubeShorts");
    this.bindToggleListener("pauseYoutubeBreaks");
    this.bindToggleListener("collectStats");

    // Buttons
    if (this.elements.exportData) {
      this.elements.exportData.addEventListener("click", () => this.exportData());
    }
    if (this.elements.clearData) {
      this.elements.clearData.addEventListener("click", () => this.clearData());
    }
    if (this.elements.viewStats) {
      this.elements.viewStats.addEventListener("click", () => this.viewStats());
    }
    if (this.elements.resetDefaults) {
      this.elements.resetDefaults.addEventListener("click", () => this.resetDefaults());
    }
  }

  bindToggleListener(settingKey) {
    const element = this.elements[settingKey];
    if (element) {
      element.addEventListener("change", () => {
        console.log(`[v0] Toggle changed: ${settingKey} = ${element.checked}`);
        this.handleToggleChange(settingKey);
      });
      console.log(`[v0] Bound event listener for ${settingKey}`);
    } else {
      console.warn(`[v0] Could not bind event listener for ${settingKey} - element not found`);
    }
  }

  async initializeOptions() {
    try {
      console.log("[v0] Initializing options page");

      // Check if background script is available
      this.backgroundAvailable = await this.checkBackgroundScript();

      if (this.backgroundAvailable) {
        console.log("[v0] Background script is available");
      } else {
        console.warn("[v0] Background script not available, using local storage only");
        this.showSaveStatus("Using local storage mode", "warning");
      }

      // Load settings
      await this.loadSettings();
      
      // Update storage usage
      await this.updateStorageUsage();
      
    } catch (error) {
      console.error("[v0] Error initializing options:", error);
      this.showSaveStatus("Error initializing options", "error");
    }
  }

  async checkBackgroundScript() {
    try {
      await chrome.runtime.sendMessage({ type: "GET_STATE" });
      return true;
    } catch (error) {
      console.warn("[v0] Background script not available:", error.message);
      return false;
    }
  }

  async handleToggleChange(settingName) {
    const element = this.elements[settingName];
    const newValue = element.checked;
    this.currentSettings[settingName] = newValue;

    try {
      // Save directly to storage
      await chrome.storage.local.set({ settings: this.currentSettings });
      
      // Also try to notify background script if available
      if (this.backgroundAvailable) {
        try {
          await chrome.runtime.sendMessage({
            type: "SETTINGS_UPDATED",
            settings: { [settingName]: newValue }
          });
        } catch (error) {
          console.warn("[v0] Could not notify background script:", error);
        }
      }
      
      this.showSaveStatus("Setting updated", "success");
      console.log(`[v0] Setting ${settingName} updated to ${newValue}`);
    } catch (error) {
      console.error("[v0] Error saving setting:", error);
      this.showSaveStatus("Error saving setting", "error");
      // Revert the toggle
      element.checked = !newValue;
      this.currentSettings[settingName] = !newValue;
    }
  }

  async handleSettingChange() {
    try {
      // Update the settings object from the form
      this.currentSettings.focusTime = parseInt(this.elements.focusTime.value);
      this.currentSettings.shortBreak = parseInt(this.elements.shortBreak.value);
      this.currentSettings.longBreak = parseInt(this.elements.longBreak.value);
      this.currentSettings.sessionsUntilLongBreak = parseInt(this.elements.sessionsUntilLongBreak.value);

      // Update header display
      this.updateHeaderStats();

      // Save to storage
      await chrome.storage.local.set({ settings: this.currentSettings });
      
      // Notify background script if available
      if (this.backgroundAvailable) {
        try {
          await chrome.runtime.sendMessage({
            type: "SETTINGS_UPDATED",
            settings: this.currentSettings
          });
        } catch (error) {
          console.warn("[v0] Could not notify background script:", error);
        }
      }
      
      this.showSaveStatus("Settings saved", "success");
    } catch (error) {
      console.error("[v0] Error saving settings:", error);
      this.showSaveStatus("Error saving settings", "error");
    }
  }

  updateHeaderStats() {
    if (this.elements.headerFocusTime) {
      this.elements.headerFocusTime.textContent = this.currentSettings.focusTime || 25;
    }
    if (this.elements.headerBreakTime) {
      this.elements.headerBreakTime.textContent = this.currentSettings.shortBreak || 5;
    }
  }

  async loadSettings() {
    try {
      console.log("[v0] Loading settings");
      const result = await chrome.storage.local.get("settings");
      const defaultSettings = this.getDefaultSettings();

      // Merge existing settings with defaults
      this.currentSettings = { ...defaultSettings, ...result.settings };
      console.log("[v0] Merged settings:", this.currentSettings);

      // Update form elements
      this.updateFormElements();
      
      console.log("[v0] Settings loaded successfully");
      this.showSaveStatus("Settings loaded", "success");
    } catch (error) {
      console.error("[v0] Error loading settings:", error);
      this.showSaveStatus("Error loading settings", "error");
    }
  }

  updateFormElements() {
    // Update number inputs
    if (this.elements.focusTime) {
      this.elements.focusTime.value = this.currentSettings.focusTime || 25;
    }
    if (this.elements.shortBreak) {
      this.elements.shortBreak.value = this.currentSettings.shortBreak || 5;
    }
    if (this.elements.longBreak) {
      this.elements.longBreak.value = this.currentSettings.longBreak || 15;
    }
    if (this.elements.sessionsUntilLongBreak) {
      this.elements.sessionsUntilLongBreak.value = this.currentSettings.sessionsUntilLongBreak || 4;
    }

    // Update toggle switches
    this.setToggleValue("autoStartBreaks", this.currentSettings.autoStartBreaks !== false);
    this.setToggleValue("autoStartPomodoros", this.currentSettings.autoStartPomodoros === true);
    this.setToggleValue("autoSwitchModes", this.currentSettings.autoSwitchModes !== false);
    this.setToggleValue("notifications", this.currentSettings.notifications !== false);
    this.setToggleValue("sounds", this.currentSettings.sounds !== false);
    this.setToggleValue("breakReminders", this.currentSettings.breakReminders !== false);
    this.setToggleValue("enforceBreaks", this.currentSettings.enforceBreaks !== false);
    this.setToggleValue("youtubeIntegration", this.currentSettings.youtubeIntegration !== false);
    this.setToggleValue("breakOverlay", this.currentSettings.breakOverlay !== false);
    this.setToggleValue("breakCountdown", this.currentSettings.breakCountdown !== false);
    this.setToggleValue("nextSessionInfo", this.currentSettings.nextSessionInfo !== false);
    this.setToggleValue("focusOverlay", this.currentSettings.focusOverlay === true);
    this.setToggleValue("hideDistractions", this.currentSettings.hideDistractions !== false);
    this.setToggleValue("focusIndicator", this.currentSettings.focusIndicator !== false);
    this.setToggleValue("websiteBlocking", this.currentSettings.websiteBlocking !== false);
    this.setToggleValue("hideYoutubeComments", this.currentSettings.hideYoutubeComments !== false);
    this.setToggleValue("hideYoutubeRecommendations", this.currentSettings.hideYoutubeRecommendations !== false);
    this.setToggleValue("hideYoutubeShorts", this.currentSettings.hideYoutubeShorts !== false);
    this.setToggleValue("pauseYoutubeBreaks", this.currentSettings.pauseYoutubeBreaks !== false);
    this.setToggleValue("collectStats", this.currentSettings.collectStats !== false);

    // Update header stats
    this.updateHeaderStats();
  }

  setToggleValue(settingKey, value) {
    const element = this.elements[settingKey];
    if (element) {
      element.checked = value;
      console.log(`[v0] Set toggle ${settingKey} to ${value}`);
    } else {
      console.warn(`[v0] Could not set toggle ${settingKey} - element not found`);
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
    };
  }

  showSaveStatus(message, type = "info") {
    const statusElement = this.elements.saveStatus;
    if (!statusElement) return;

    const statusText = statusElement.querySelector(".status-text");
    if (statusText) {
      statusText.textContent = message;
    }

    // Update status styling
    statusElement.className = `save-status ${type}`;

    // Auto-hide after 3 seconds
    setTimeout(() => {
      statusElement.className = "save-status";
      if (statusText) {
        statusText.textContent = "Settings saved automatically";
      }
    }, 3000);
  }

  async exportData() {
    try {
      const result = await chrome.storage.local.get(null);
      const dataStr = JSON.stringify(result, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });

      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pomodoro-timer-data-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.showSaveStatus("Data exported successfully", "success");
    } catch (error) {
      console.error("[v0] Error exporting data:", error);
      this.showSaveStatus("Error exporting data", "error");
    }
  }

  async clearData() {
    if (confirm("Are you sure you want to clear all data? This action cannot be undone.")) {
      try {
        await chrome.storage.local.clear();
        this.currentSettings = this.getDefaultSettings();
        this.updateFormElements();
        this.showSaveStatus("All data cleared", "success");
        await this.updateStorageUsage();
      } catch (error) {
        console.error("[v0] Error clearing data:", error);
        this.showSaveStatus("Error clearing data", "error");
      }
    }
  }

  viewStats() {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL("stats.html") });
    } catch (error) {
      console.error("[v0] Error opening stats:", error);
      this.showSaveStatus("Error opening stats", "error");
    }
  }

  async resetDefaults() {
    if (confirm("Are you sure you want to reset all settings to defaults?")) {
      try {
        this.currentSettings = this.getDefaultSettings();
        await chrome.storage.local.set({ settings: this.currentSettings });

        if (this.backgroundAvailable) {
          try {
            await chrome.runtime.sendMessage({
              type: "SETTINGS_UPDATED",
              settings: this.currentSettings,
            });
          } catch (error) {
            console.warn("[v0] Could not notify background script:", error);
          }
        }

        this.updateFormElements();
        this.showSaveStatus("Settings reset to defaults", "success");
      } catch (error) {
        console.error("[v0] Error resetting settings:", error);
        this.showSaveStatus("Error resetting settings", "error");
      }
    }
  }

  async updateStorageUsage() {
    try {
      const result = await chrome.storage.local.get(null);
      const dataStr = JSON.stringify(result);
      const sizeInBytes = new Blob([dataStr]).size;
      const sizeInKB = Math.round(sizeInBytes / 1024 * 100) / 100;
      
      if (this.elements.storageUsage) {
        this.elements.storageUsage.textContent = `${sizeInKB} KB`;
      }
    } catch (error) {
      console.error("[v0] Error calculating storage usage:", error);
      if (this.elements.storageUsage) {
        this.elements.storageUsage.textContent = "Unknown";
      }
    }
  }
}

// Initialize options page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] DOM loaded, initializing modern options");
  new ModernPomodoroOptions();
});