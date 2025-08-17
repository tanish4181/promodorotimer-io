// Enhanced Options Page Script for Pomodoro Timer Chrome Extension with Website Blocking

class ModernPomodoroOptions {
  constructor() {
    console.log("[v0] Initializing Modern PomodoroOptions");
    this.elements = {};
    this.currentSettings = {};
    this.backgroundAvailable = false;
    this.allowlist = [];
    this.blocklist = [];

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
    this.elements.sessionsUntilLongBreak = document.getElementById("sessions-until-long-break");

    // Toggle settings
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
    this.elements.hideYoutubeComments = document.getElementById("hide-youtube-comments");
    this.elements.hideYoutubeRecommendations = document.getElementById("hide-youtube-recommendations");
    this.elements.hideYoutubeShorts = document.getElementById("hide-youtube-shorts");
    this.elements.pauseYoutubeBreaks = document.getElementById("pause-youtube-breaks");
    this.elements.collectStats = document.getElementById("collect-stats");

    // Website blocking elements
    this.elements.websiteBlocking = document.getElementById("website-blocking");
    this.elements.breakBlockAll = document.getElementById("break-block-all");
    this.elements.breakUseAllowlist = document.getElementById("break-use-allowlist");
    this.elements.allowlistInput = document.getElementById("allowlist-input");
    this.elements.addAllowlistBtn = document.getElementById("add-allowlist-btn");
    this.elements.allowlistContainer = document.getElementById("allowlist-container");
    this.elements.allowlistEmpty = document.getElementById("allowlist-empty");
    this.elements.blocklistInput = document.getElementById("blocklist-input");
    this.elements.addBlocklistBtn = document.getElementById("add-blocklist-btn");
    this.elements.blocklistContainer = document.getElementById("blocklist-container");
    this.elements.blocklistEmpty = document.getElementById("blocklist-empty");

    // Action buttons
    this.elements.exportDataBtn = document.getElementById("export-data");
    this.elements.viewStatsBtn = document.getElementById("view-stats");
    this.elements.resetDefaultsBtn = document.getElementById("reset-defaults");
    this.elements.clearDataBtn = document.getElementById("clear-data");

    // Header stats
    this.elements.headerFocusTime = document.getElementById("header-focus-time");
    this.elements.headerBreakTime = document.getElementById("header-break-time");

    console.log("[v0] All DOM elements initialized");
  }

  setupTabNavigation() {
    const navTabs = document.querySelectorAll(".nav-tab");
    const tabContents = document.querySelectorAll(".tab-content");

    navTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        const targetTab = tab.dataset.tab;
        
        // Update active tab
        navTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        
        // Update active content
        tabContents.forEach(content => {
          content.classList.toggle("active", content.id === targetTab);
        });
        
        console.log(`[v0] Switched to tab: ${targetTab}`);
      });
    });
  }

  bindEventListeners() {
    // Number inputs
    const numberInputs = [
      this.elements.focusTime,
      this.elements.shortBreak,
      this.elements.longBreak,
      this.elements.sessionsUntilLongBreak
    ];
    
    numberInputs.forEach(input => {
      if (input) {
        input.addEventListener("change", () => this.saveSettings());
        input.addEventListener("input", () => this.updateHeaderStats());
      }
    });

    // Toggle inputs
    const toggleInputs = [
      this.elements.autoStartBreaks,
      this.elements.autoStartPomodoros,
      this.elements.autoSwitchModes,
      this.elements.notifications,
      this.elements.sounds,
      this.elements.breakReminders,
      this.elements.enforceBreaks,
      this.elements.youtubeIntegration,
      this.elements.breakOverlay,
      this.elements.breakCountdown,
      this.elements.nextSessionInfo,
      this.elements.focusOverlay,
      this.elements.hideDistractions,
      this.elements.focusIndicator,
      this.elements.websiteBlocking,
      this.elements.breakBlockAll,
      this.elements.breakUseAllowlist,
      this.elements.hideYoutubeComments,
      this.elements.hideYoutubeRecommendations,
      this.elements.hideYoutubeShorts,
      this.elements.pauseYoutubeBreaks,
      this.elements.collectStats
    ];

    toggleInputs.forEach(input => {
      if (input) {
        input.addEventListener("change", () => this.saveSettings());
      }
    });

    // Website blocking specific listeners
    this.setupWebsiteBlockingListeners();

    // Action buttons
    if (this.elements.exportDataBtn) {
      this.elements.exportDataBtn.addEventListener("click", () => this.exportData());
    }
    if (this.elements.viewStatsBtn) {
      this.elements.viewStatsBtn.addEventListener("click", () => this.openStats());
    }
    if (this.elements.resetDefaultsBtn) {
      this.elements.resetDefaultsBtn.addEventListener("click", () => this.resetDefaults());
    }
    if (this.elements.clearDataBtn) {
      this.elements.clearDataBtn.addEventListener("click", () => this.clearAllData());
    }

    // Break mode mutual exclusion
    if (this.elements.breakBlockAll && this.elements.breakUseAllowlist) {
      this.elements.breakBlockAll.addEventListener("change", (e) => {
        if (e.target.checked) {
          this.elements.breakUseAllowlist.checked = false;
        }
        this.saveSettings();
      });

      this.elements.breakUseAllowlist.addEventListener("change", (e) => {
        if (e.target.checked) {
          this.elements.breakBlockAll.checked = false;
        }
        this.saveSettings();
      });
    }

    console.log("[v0] All event listeners bound");
  }

  setupWebsiteBlockingListeners() {
    // Allowlist management
    if (this.elements.addAllowlistBtn) {
      this.elements.addAllowlistBtn.addEventListener("click", () => {
        this.addWebsiteToList("allowlist");
      });
    }

    if (this.elements.allowlistInput) {
      this.elements.allowlistInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.addWebsiteToList("allowlist");
        }
      });
    }

    // Blocklist management
    if (this.elements.addBlocklistBtn) {
      this.elements.addBlocklistBtn.addEventListener("click", () => {
        this.addWebsiteToList("blocklist");
      });
    }

    if (this.elements.blocklistInput) {
      this.elements.blocklistInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.addWebsiteToList("blocklist");
        }
      });
    }
  }

  async initializeOptions() {
    console.log("[v0] Initializing options page");
    this.showStatus("Loading settings...", "loading");
    
    try {
      await this.loadSettings();
      await this.loadWebsiteLists();
      this.updateHeaderStats();
      this.calculateStorageUsage();
      this.showStatus("Settings loaded successfully", "success");
      console.log("[v0] Options initialized successfully");
    } catch (error) {
      console.error("[v0] Error initializing options:", error);
      this.showStatus("Error loading settings", "error");
    }
  }

  async loadSettings() {
    try {
      // Try to get settings from background script first
      const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
      
      if (response && response.state && response.state.settings) {
        this.currentSettings = response.state.settings;
        this.backgroundAvailable = true;
        console.log("[v0] Settings loaded from background script");
      } else {
        throw new Error("Background not available");
      }
    } catch (error) {
      console.log("[v0] Background not available, loading from storage");
      // Fallback to direct storage access
      const result = await chrome.storage.local.get("settings");
      this.currentSettings = result.settings || this.getDefaultSettings();
      this.backgroundAvailable = false;
    }
    
    this.populateSettings();
  }

  async loadWebsiteLists() {
    try {
      const result = await chrome.storage.local.get(["allowedWebsites", "blockedWebsites"]);
      this.allowlist = result.allowedWebsites || [];
      this.blocklist = result.blockedWebsites || [];
      
      this.renderWebsiteList("allowlist");
      this.renderWebsiteList("blocklist");
      
      console.log("[v0] Website lists loaded:", {
        allowlist: this.allowlist.length,
        blocklist: this.blocklist.length
      });
    } catch (error) {
      console.error("[v0] Error loading website lists:", error);
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
      breakBlockAll: false,
      breakUseAllowlist: true,
      hideYoutubeComments: true,
      hideYoutubeRecommendations: true,
      hideYoutubeShorts: true,
      pauseYoutubeBreaks: true,
      collectStats: true,
    };
  }

  populateSettings() {
    // Number inputs
    if (this.elements.focusTime) this.elements.focusTime.value = this.currentSettings.focusTime || 25;
    if (this.elements.shortBreak) this.elements.shortBreak.value = this.currentSettings.shortBreak || 5;
    if (this.elements.longBreak) this.elements.longBreak.value = this.currentSettings.longBreak || 15;
    if (this.elements.sessionsUntilLongBreak) this.elements.sessionsUntilLongBreak.value = this.currentSettings.sessionsUntilLongBreak || 4;

    // Toggle inputs
    const toggleSettings = [
      "autoStartBreaks", "autoStartPomodoros", "autoSwitchModes",
      "notifications", "sounds", "breakReminders", "enforceBreaks",
      "youtubeIntegration", "breakOverlay", "breakCountdown",
      "nextSessionInfo", "focusOverlay", "hideDistractions",
      "focusIndicator", "websiteBlocking", "breakBlockAll",
      "breakUseAllowlist", "hideYoutubeComments", "hideYoutubeRecommendations",
      "hideYoutubeShorts", "pauseYoutubeBreaks", "collectStats"
    ];

    toggleSettings.forEach(setting => {
      const element = this.elements[setting];
      if (element) {
        element.checked = this.currentSettings[setting] !== undefined ? this.currentSettings[setting] : false;
      }
    });

    console.log("[v0] Settings populated in UI");
  }

  async saveSettings() {
    const newSettings = {
      focusTime: parseInt(this.elements.focusTime?.value) || 25,
      shortBreak: parseInt(this.elements.shortBreak?.value) || 5,
      longBreak: parseInt(this.elements.longBreak?.value) || 15,
      sessionsUntilLongBreak: parseInt(this.elements.sessionsUntilLongBreak?.value) || 4,
      autoStartBreaks: this.elements.autoStartBreaks?.checked || false,
      autoStartPomodoros: this.elements.autoStartPomodoros?.checked || false,
      autoSwitchModes: this.elements.autoSwitchModes?.checked || false,
      notifications: this.elements.notifications?.checked || false,
      sounds: this.elements.sounds?.checked || false,
      breakReminders: this.elements.breakReminders?.checked || false,
      enforceBreaks: this.elements.enforceBreaks?.checked || false,
      youtubeIntegration: this.elements.youtubeIntegration?.checked || false,
      breakOverlay: this.elements.breakOverlay?.checked || false,
      breakCountdown: this.elements.breakCountdown?.checked || false,
      nextSessionInfo: this.elements.nextSessionInfo?.checked || false,
      focusOverlay: this.elements.focusOverlay?.checked || false,
      hideDistractions: this.elements.hideDistractions?.checked || false,
      focusIndicator: this.elements.focusIndicator?.checked || false,
      websiteBlocking: this.elements.websiteBlocking?.checked || false,
      breakBlockAll: this.elements.breakBlockAll?.checked || false,
      breakUseAllowlist: this.elements.breakUseAllowlist?.checked || false,
      hideYoutubeComments: this.elements.hideYoutubeComments?.checked || false,
      hideYoutubeRecommendations: this.elements.hideYoutubeRecommendations?.checked || false,
      hideYoutubeShorts: this.elements.hideYoutubeShorts?.checked || false,
      pauseYoutubeBreaks: this.elements.pauseYoutubeBreaks?.checked || false,
      collectStats: this.elements.collectStats?.checked || false,
    };

    try {
      // Save to storage
      await chrome.storage.local.set({ settings: newSettings });
      
      // Update background script if available
      if (this.backgroundAvailable) {
        await chrome.runtime.sendMessage({
          type: "SETTINGS_UPDATED",
          settings: newSettings
        });
      }
      
      this.currentSettings = newSettings;
      this.updateHeaderStats();
      this.showStatus("Settings saved successfully", "success");
      
      console.log("[v0] Settings saved:", newSettings);
    } catch (error) {
      console.error("[v0] Error saving settings:", error);
      this.showStatus("Error saving settings", "error");
    }
  }

  addWebsiteToList(listType) {
    const inputElement = listType === "allowlist" ? 
      this.elements.allowlistInput : this.elements.blocklistInput;
    
    if (!inputElement) return;
    
    const website = inputElement.value.trim();
    if (!website) return;
    
    // Clean and validate URL
    const cleanedWebsite = this.cleanWebsiteUrl(website);
    if (!cleanedWebsite) {
      this.showStatus("Please enter a valid website URL", "error");
      return;
    }
    
    const targetList = listType === "allowlist" ? this.allowlist : this.blocklist;
    
    // Check if already exists
    if (targetList.includes(cleanedWebsite)) {
      this.showStatus(`Website already in ${listType}`, "error");
      return;
    }
    
    // Add to list
    targetList.push(cleanedWebsite);
    inputElement.value = "";
    
    // Save and render
    this.saveWebsiteLists();
    this.renderWebsiteList(listType);
    
    this.showStatus(`Website added to ${listType}`, "success");
    console.log(`[v0] Website added to ${listType}:`, cleanedWebsite);
  }

  removeWebsiteFromList(listType, website) {
    const targetList = listType === "allowlist" ? this.allowlist : this.blocklist;
    const index = targetList.indexOf(website);
    
    if (index > -1) {
      targetList.splice(index, 1);
      this.saveWebsiteLists();
      this.renderWebsiteList(listType);
      this.showStatus(`Website removed from ${listType}`, "success");
      console.log(`[v0] Website removed from ${listType}:`, website);
    }
  }

  cleanWebsiteUrl(url) {
    // Remove protocol and www
    let cleaned = url.replace(/^https?:\/\//, "").replace(/^www\./, "");
    
    // Remove trailing slash
    cleaned = cleaned.replace(/\/$/, "");
    
    // Basic validation
    if (!cleaned || !cleaned.includes(".")) {
      return null;
    }
    
    return cleaned;
  }

  async saveWebsiteLists() {
    try {
      await chrome.storage.local.set({
        allowedWebsites: this.allowlist,
        blockedWebsites: this.blocklist
      });
      
      // Update background script if available
      if (this.backgroundAvailable) {
        await chrome.runtime.sendMessage({
          type: "WEBSITE_LISTS_UPDATED",
          allowlist: this.allowlist,
          blocklist: this.blocklist
        });
      }
      
      console.log("[v0] Website lists saved");
    } catch (error) {
      console.error("[v0] Error saving website lists:", error);
    }
  }

  renderWebsiteList(listType) {
    const container = listType === "allowlist" ? 
      this.elements.allowlistContainer : this.elements.blocklistContainer;
    const emptyElement = listType === "allowlist" ? 
      this.elements.allowlistEmpty : this.elements.blocklistEmpty;
    const targetList = listType === "allowlist" ? this.allowlist : this.blocklist;
    
    if (!container) return;
    
    // Clear existing content
    container.innerHTML = "";
    
    if (targetList.length === 0) {
      if (emptyElement) {
        container.appendChild(emptyElement);
      }
      return;
    }
    
    // Create website items
    targetList.forEach(website => {
      const item = document.createElement("div");
      item.className = "website-item";
      item.innerHTML = `
        <span class="website-name">${website}</span>
        <div class="website-actions">
          <button class="website-remove-btn" title="Remove website">×</button>
        </div>
      `;
      
      // Add remove functionality
      const removeBtn = item.querySelector(".website-remove-btn");
      removeBtn.addEventListener("click", () => {
        this.removeWebsiteFromList(listType, website);
      });
      
      container.appendChild(item);
    });
  }

  updateHeaderStats() {
    if (this.elements.headerFocusTime) {
      this.elements.headerFocusTime.textContent = this.elements.focusTime?.value || 25;
    }
    if (this.elements.headerBreakTime) {
      this.elements.headerBreakTime.textContent = this.elements.shortBreak?.value || 5;
    }
  }

  async calculateStorageUsage() {
    try {
      const result = await chrome.storage.local.get();
      const dataSize = JSON.stringify(result).length;
      const usageKB = Math.round(dataSize / 1024);
      
      const storageElement = document.getElementById("storage-usage");
      if (storageElement) {
        storageElement.textContent = `${usageKB} KB`;
      }
      
      console.log(`[v0] Storage usage calculated: ${usageKB} KB`);
    } catch (error) {
      console.error("[v0] Error calculating storage usage:", error);
    }
  }

  async exportData() {
    try {
      const data = await chrome.storage.local.get();
      const exportData = {
        settings: data.settings,
        dailyStats: data.dailyStats,
        allowedWebsites: data.allowedWebsites,
        blockedWebsites: data.blockedWebsites,
        todos: data.todos,
        exportDate: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json"
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pomodoro-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      this.showStatus("Data exported successfully", "success");
      
      console.log("[v0] Data exported");
    } catch (error) {
      console.error("[v0] Error exporting data:", error);
      this.showStatus("Error exporting data", "error");
    }
  }

  openStats() {
    chrome.tabs.create({ url: chrome.runtime.getURL("stats.html") });
  }

  async resetDefaults() {
    const confirmed = confirm("Are you sure you want to reset all settings to default values?");
    if (!confirmed) return;
    
    try {
      const defaultSettings = this.getDefaultSettings();
      await chrome.storage.local.set({ settings: defaultSettings });
      
      // Update background script if available
      if (this.backgroundAvailable) {
        await chrome.runtime.sendMessage({
          type: "SETTINGS_UPDATED",
          settings: defaultSettings
        });
      }
      
      this.currentSettings = defaultSettings;
      this.populateSettings();
      this.updateHeaderStats();
      this.showStatus("Settings reset to defaults", "success");
      
      console.log("[v0] Settings reset to defaults");
    } catch (error) {
      console.error("[v0] Error resetting defaults:", error);
      this.showStatus("Error resetting defaults", "error");
    }
  }

  async clearAllData() {
    const confirmed = confirm("Are you sure you want to clear all data? This cannot be undone.");
    if (!confirmed) return;
    
    const doubleConfirmed = confirm("This will delete all your statistics, settings, and website lists. Are you absolutely sure?");
    if (!doubleConfirmed) return;
    
    try {
      await chrome.storage.local.clear();
      
      // Reset local data
      this.currentSettings = this.getDefaultSettings();
      this.allowlist = [];
      this.blocklist = [];
      
      // Repopulate UI
      this.populateSettings();
      this.renderWebsiteList("allowlist");
      this.renderWebsiteList("blocklist");
      this.updateHeaderStats();
      this.calculateStorageUsage();
      
      this.showStatus("All data cleared successfully", "success");
      console.log("[v0] All data cleared");
    } catch (error) {
      console.error("[v0] Error clearing data:", error);
      this.showStatus("Error clearing data", "error");
    }
  }

  showStatus(message, type = "success") {
    const statusElement = document.getElementById("save-status");
    if (!statusElement) return;
    
    statusElement.textContent = message;
    statusElement.className = `save-status ${type}`;
    statusElement.style.opacity = "1";
    statusElement.style.transform = "translateY(0)";
    
    // Auto hide after 3 seconds
    setTimeout(() => {
      statusElement.style.opacity = "0";
      statusElement.style.transform = "translateY(20px)";
    }, 3000);
    
    console.log(`[v0] Status: ${message} (${type})`);
  }
}

// Initialize options when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] DOM loaded, initializing options");
  new ModernPomodoroOptions();
});