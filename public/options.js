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
    this.elements.notifications = document.getElementById("notifications");
    this.elements.sounds = document.getElementById("sounds");
    this.elements.soundType = document.getElementById("sound-type");
    this.elements.breakReminders = document.getElementById("break-reminders");
    this.elements.enforceBreaks = document.getElementById("enforce-breaks");
    // YouTube options
    this.elements.youtubeDistractionMode = document.getElementById("youtube-distraction-mode");
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

    // Pet settings
    this.elements.petEnabled = document.getElementById("pet-enabled");

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
      this.elements.notifications,
      this.elements.sounds,
      this.elements.breakReminders,
      this.elements.enforceBreaks,
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
      this.elements.collectStats,
      this.elements.petEnabled
    ];

    toggleInputs.forEach(input => {
      if (input) {
        input.addEventListener("change", () => this.saveSettings());
      }
    });

    // Select inputs
    if (this.elements.youtubeDistractionMode) {
      this.elements.youtubeDistractionMode.addEventListener("change", () => this.saveSettings());
    }
    if (this.elements.soundType) {
      this.elements.soundType.addEventListener("change", () => this.saveSettings());
    }

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

    // Test buttons in notifications tab
    const testNotificationBtn = document.getElementById("test-notification");
    if (testNotificationBtn) {
      testNotificationBtn.addEventListener("click", async () => {
        try { await chrome.runtime.sendMessage({ type: "TEST_NOTIFICATION" }); } catch {}
      });
    }
    const testSoundBtn = document.getElementById("test-sound");
    if (testSoundBtn) {
      testSoundBtn.addEventListener("click", async () => {
        const soundType = this.elements.soundType?.value || "ding";
        try { await chrome.runtime.sendMessage({ type: "TEST_SOUND", soundType }); } catch {}
      });
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
    // Allowlist management with real-time validation
    if (this.elements.addAllowlistBtn) {
      this.elements.addAllowlistBtn.addEventListener("click", () => {
        this.addWebsiteToList("allowlist");
      });
    }

    if (this.elements.allowlistInput) {
      // Real-time validation
      this.elements.allowlistInput.addEventListener("input", (e) => {
        this.validateInputRealTime(e.target, "allowlist");
      });
      
      this.elements.allowlistInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.addWebsiteToList("allowlist");
        }
      });
    }

    // Blocklist management with real-time validation
    if (this.elements.addBlocklistBtn) {
      this.elements.addBlocklistBtn.addEventListener("click", () => {
        this.addWebsiteToList("blocklist");
      });
    }

    if (this.elements.blocklistInput) {
      // Real-time validation
      this.elements.blocklistInput.addEventListener("input", (e) => {
        this.validateInputRealTime(e.target, "blocklist");
      });
      
      this.elements.blocklistInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
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
      notifications: true,
      sounds: true,
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
      hideYoutubeComments: true,
      hideYoutubeRecommendations: true,
      hideYoutubeShorts: true,
      pauseYoutubeBreaks: true,
      collectStats: true,
      petEnabled: true,
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
      "autoStartBreaks", "autoStartPomodoros",
      "notifications", "sounds", "breakReminders", "enforceBreaks",
      "breakOverlay", "breakCountdown",
      "nextSessionInfo", "focusOverlay", "hideDistractions",
      "focusIndicator", "websiteBlocking", "breakBlockAll",
      "breakUseAllowlist", "hideYoutubeComments", "hideYoutubeRecommendations",
      "hideYoutubeShorts", "pauseYoutubeBreaks", "collectStats", "petEnabled"
    ];

    toggleSettings.forEach(setting => {
      const element = this.elements[setting];
      if (element) {
        element.checked = this.currentSettings[setting] !== undefined ? this.currentSettings[setting] : false;
      }
    });

    // Select inputs
    if (this.elements.youtubeDistractionMode) {
      this.elements.youtubeDistractionMode.value = this.currentSettings.youtubeDistractionMode || "focus";
    }
    if (this.elements.soundType) {
      this.elements.soundType.value = this.currentSettings.soundType || "ding";
    }

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
      notifications: this.elements.notifications?.checked || false,
      sounds: this.elements.sounds?.checked || false,
      soundType: this.elements.soundType?.value || "ding",
      breakReminders: this.elements.breakReminders?.checked || false,
      enforceBreaks: this.elements.enforceBreaks?.checked || false,
      // youtubeIntegration toggle removed; always respect mode
      youtubeDistractionMode: this.elements.youtubeDistractionMode?.value || "focus",
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
      petEnabled: this.elements.petEnabled?.checked || false,
    };

    try {
      // Update background script
      await chrome.runtime.sendMessage({
        type: "SETTINGS_UPDATED",
        settings: newSettings
      });
      
      this.currentSettings = newSettings;
      this.updateHeaderStats();
      this.showStatus("Settings saved successfully", "success");
      
      console.log("[v0] Settings saved:", newSettings);
    } catch (error) {
      console.error("[v0] Error saving settings:", error);
      this.showStatus("Error saving settings", "error");
    }
  }

  // Enhanced website addition with validation
  addWebsiteToList(listType) {
    const inputElement = listType === "allowlist" ? 
      this.elements.allowlistInput : this.elements.blocklistInput;
    
    if (!inputElement) return;
    
    const website = inputElement.value.trim();
    if (!website) {
      this.showValidationError(inputElement, "Please enter a website URL");
      return;
    }
    
    // Enhanced validation
    const validationResult = this.validateWebsiteUrl(website);
    if (!validationResult.isValid) {
      this.showValidationError(inputElement, validationResult.error);
      return;
    }
    
    const cleanedWebsite = validationResult.cleaned;
    const targetList = listType === "allowlist" ? this.allowlist : this.blocklist;
    const oppositeList = listType === "allowlist" ? this.blocklist : this.allowlist;
    
    // Check if already exists in current list
    if (targetList.includes(cleanedWebsite)) {
      this.showValidationError(inputElement, `Website already in ${listType}`);
      return;
    }
    
    // Check if exists in opposite list and ask for confirmation
    if (oppositeList.includes(cleanedWebsite)) {
      const confirmed = confirm(
        `"${cleanedWebsite}" is already in the ${listType === "allowlist" ? "blocklist" : "allowlist"}. ` +
        `Do you want to move it to the ${listType}?`
      );
      if (confirmed) {
        this.removeWebsiteFromList(listType === "allowlist" ? "blocklist" : "allowlist", cleanedWebsite);
      } else {
        return;
      }
    }
    
    // Add to list with animation
    targetList.push(cleanedWebsite);
    inputElement.value = "";
    this.clearValidationState(inputElement);
    
    // Save and render with success feedback
    this.saveWebsiteLists();
    this.renderWebsiteList(listType);
    
    this.showStatus(`"${cleanedWebsite}" added to ${listType}`, "success");
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

  // Enhanced URL validation
  validateWebsiteUrl(url) {
    // Remove common prefixes
    let cleaned = url.toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/^m\./, "")  // mobile subdomain
      .replace(/\/$/, "");  // trailing slash
    
    // Remove path, query, and fragment
    cleaned = cleaned.split('/')[0].split('?')[0].split('#')[0];
    
    // Basic format validation
    if (!cleaned) {
      return { isValid: false, error: "URL cannot be empty" };
    }
    
    // Must contain at least one dot for domain
    if (!cleaned.includes('.')) {
      return { isValid: false, error: "Please enter a valid domain (e.g., example.com)" };
    }
    
    // Check for invalid characters
    const invalidChars = /[^a-z0-9.-]/;
    if (invalidChars.test(cleaned)) {
      return { isValid: false, error: "Domain contains invalid characters" };
    }
    
    // Must not start or end with dot or dash
    if (cleaned.startsWith('.') || cleaned.endsWith('.') || 
        cleaned.startsWith('-') || cleaned.endsWith('-')) {
      return { isValid: false, error: "Invalid domain format" };
    }
    
    // Must have valid TLD (at least 2 chars after last dot)
    const parts = cleaned.split('.');
    if (parts.length < 2 || parts[parts.length - 1].length < 2) {
      return { isValid: false, error: "Invalid domain extension" };
    }
    
    return { 
      isValid: true, 
      cleaned: cleaned
    };
  }

  // Enhanced website list rendering with validation and status
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
        emptyElement.style.display = "block";
        container.appendChild(emptyElement.cloneNode(true));
      }
      return;
    }
    
    // Hide empty state
    if (emptyElement) {
      emptyElement.style.display = "none";
    }
    
    // Create website items with enhanced styling
    targetList.forEach((website, index) => {
      const item = document.createElement("div");
      item.className = "website-item";
      item.setAttribute("data-index", index);
      item.innerHTML = `
        <div class="website-name" title="${website}">${website}</div>
        <div class="website-actions">
          <button class="website-remove-btn" title="Remove ${website}" data-website="${website}">×</button>
        </div>
      `;
      
      // Add remove functionality with confirmation
      const removeBtn = item.querySelector(".website-remove-btn");
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const website = e.currentTarget.dataset.website;
        if (confirm(`Remove "${website}" from ${listType}?`)) {
          this.removeWebsiteFromList(listType, website);
        }
      });
      
      container.appendChild(item);
    });
  }

  // Validation UI helpers
  showValidationError(inputElement, message) {
    inputElement.classList.add("invalid");
    inputElement.classList.remove("valid");
    
    // Remove existing validation message
    const existingMessage = inputElement.parentNode.querySelector(".validation-message");
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Add new validation message
    const messageDiv = document.createElement("div");
    messageDiv.className = "validation-message error";
    messageDiv.textContent = message;
    inputElement.parentNode.appendChild(messageDiv);
    
    // Auto-clear after 5 seconds
    setTimeout(() => {
      this.clearValidationState(inputElement);
    }, 5000);
  }

  clearValidationState(inputElement) {
    inputElement.classList.remove("invalid", "valid");
    const message = inputElement.parentNode.querySelector(".validation-message");
    if (message) {
      message.remove();
    }
  }

  // Real-time input validation
  validateInputRealTime(inputElement, listType) {
    const value = inputElement.value.trim();
    
    if (!value) {
      this.clearValidationState(inputElement);
      return;
    }
    
    const validationResult = this.validateWebsiteUrl(value);
    
    if (validationResult.isValid) {
      inputElement.classList.remove("invalid");
      inputElement.classList.add("valid");
      
      // Check for duplicates
      const targetList = listType === "allowlist" ? this.allowlist : this.blocklist;
      if (targetList.includes(validationResult.cleaned)) {
        this.showValidationError(inputElement, "Website already exists in list");
      } else {
        this.clearValidationState(inputElement);
      }
    } else {
      this.showValidationError(inputElement, validationResult.error);
    }
  }

  async saveWebsiteLists() {
    try {
      await chrome.runtime.sendMessage({
        type: "WEBSITE_LISTS_UPDATED",
        allowlist: this.allowlist,
        blocklist: this.blocklist
      });
      
      console.log("[v0] Website lists saved");
    } catch (error) {
      console.error("[v0] Error saving website lists:", error);
    }
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