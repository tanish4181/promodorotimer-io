// Manages the options page for the Pomodoro Timer extension.
class ModernPomodoroOptions {
  constructor() {
    // Initializes the options page by caching DOM elements, setting up tabs,
    // binding event listeners, and loading the current settings.
    this.elements = {};
    this.currentSettings = {};
    this.isLockedIn = false;
    this.backgroundAvailable = false;
    this.allowlist = [];
    this.blocklist = [];

    this.initializeElements();
    this.setupTabNavigation();
    this.bindEventListeners();
    this.initializeOptions();
  }

  // Caches all necessary DOM elements for quick access.
  initializeElements() {
    // Timer settings
    this.elements.focusTime = document.getElementById("focus-time");
    this.elements.shortBreak = document.getElementById("short-break");
    this.elements.longBreak = document.getElementById("long-break");
    this.elements.sessionsUntilLongBreak = document.getElementById("sessions-until-long-break");

    // General toggle settings
    this.elements.autoStartBreaks = document.getElementById("auto-start-breaks");
    this.elements.autoStartPomodoros = document.getElementById("auto-start-pomodoros");
    this.elements.notifications = document.getElementById("notifications");
    this.elements.sounds = document.getElementById("sounds");
    this.elements.soundType = document.getElementById("sound-type");
    this.elements.enforceBreaks = document.getElementById("enforce-breaks");
    this.elements.breakOverlayEnabled = document.getElementById("break-overlay-enabled");
    this.elements.breakCountdown = document.getElementById("break-countdown");
    this.elements.nextSessionInfo = document.getElementById("next-session-info");
    this.elements.pauseYoutubeBreaks = document.getElementById("pause-youtube-breaks");
    this.elements.collectStats = document.getElementById("collect-stats");

    // YouTube specific settings
    this.elements.youtubeDistractionMode = document.getElementById("youtube-distraction-mode");
    this.elements.hideDistractions = document.getElementById("hide-distractions");
    this.elements.focusIndicator = document.getElementById("focus-indicator");
    this.elements.hideYoutubeComments = document.getElementById("hide-youtube-comments");
    this.elements.hideYoutubeRecommendations = document.getElementById("hide-youtube-recommendations");
    this.elements.hideYoutubeShorts = document.getElementById("hide-youtube-shorts");

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

    // Data and action buttons
    this.elements.exportDataBtn = document.getElementById("export-data");
    this.elements.viewStatsBtn = document.getElementById("view-stats");
    this.elements.resetDefaultsBtn = document.getElementById("reset-defaults");
    this.elements.clearDataBtn = document.getElementById("clear-data");

    // Header statistics display
    this.elements.headerFocusTime = document.getElementById("header-focus-time");
    this.elements.headerBreakTime = document.getElementById("header-break-time");
  }

  // Sets up the tab navigation functionality.
  setupTabNavigation() {
    const navTabs = document.querySelectorAll(".nav-tab");
    const tabContents = document.querySelectorAll(".tab-content");

    navTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        const targetTab = tab.dataset.tab;
        
        navTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        
        tabContents.forEach(content => {
          content.classList.toggle("active", content.id === targetTab);
        });
      });
    });
  }

  // Binds event listeners to all interactive elements.
  bindEventListeners() {
    // Event listeners for number input fields
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

    // Event listeners for all toggle switches
    const toggleInputs = [
      this.elements.autoStartBreaks, this.elements.autoStartPomodoros,
      this.elements.notifications, this.elements.sounds,
      this.elements.enforceBreaks, this.elements.breakOverlayEnabled,
      this.elements.breakCountdown, this.elements.nextSessionInfo,
      this.elements.hideDistractions, this.elements.focusIndicator,
      this.elements.websiteBlocking, this.elements.breakBlockAll,
      this.elements.breakUseAllowlist, this.elements.hideYoutubeComments,
      this.elements.hideYoutubeRecommendations, this.elements.hideYoutubeShorts,
      this.elements.pauseYoutubeBreaks, this.elements.collectStats
    ];

    toggleInputs.forEach(input => {
      if (input) {
        input.addEventListener("change", () => this.saveSettings());
      }
    });

    // Event listeners for dropdown select inputs
    if (this.elements.youtubeDistractionMode) {
      this.elements.youtubeDistractionMode.addEventListener("change", () => this.saveSettings());
    }
    if (this.elements.soundType) {
      this.elements.soundType.addEventListener("change", () => this.saveSettings());
    }

    this.setupWebsiteBlockingListeners();

    // Event listeners for action buttons
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

    // Test buttons in the notifications tab
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

    // Ensure "Block all" and "Use allowlist" for breaks are mutually exclusive.
    if (this.elements.breakBlockAll && this.elements.breakUseAllowlist) {
      this.elements.breakBlockAll.addEventListener("change", (e) => {
        if (e.target.checked) this.elements.breakUseAllowlist.checked = false;
        this.saveSettings();
      });

      this.elements.breakUseAllowlist.addEventListener("change", (e) => {
        if (e.target.checked) this.elements.breakBlockAll.checked = false;
        this.saveSettings();
      });
    }

    // Add logic to enable/disable toggles based on master switches
    if (this.elements.enforceBreaks) {
      this.elements.enforceBreaks.addEventListener("change", () => this.updateAllToggleStates());
    }
    if (this.elements.websiteBlocking) {
      this.elements.websiteBlocking.addEventListener("change", () => this.updateAllToggleStates());
    }
  }

  updateAllToggleStates() {
    const enforceBreaks = this.elements.enforceBreaks.checked;
    const websiteBlocking = this.elements.websiteBlocking.checked;

    // These depend only on enforceBreaks
    const breakSubToggles = [
        this.elements.breakOverlayEnabled,
        this.elements.breakCountdown,
        this.elements.nextSessionInfo,
        this.elements.pauseYoutubeBreaks,
    ];
    breakSubToggles.forEach(toggle => {
        if (toggle) {
            toggle.disabled = !enforceBreaks;
            toggle.closest('.toggle-setting').classList.toggle('disabled', !enforceBreaks);
        }
    });

    // These depend on BOTH enforceBreaks and websiteBlocking
    const breakBlockingToggles = [
        this.elements.breakBlockAll,
        this.elements.breakUseAllowlist
    ];
    breakBlockingToggles.forEach(toggle => {
        if (toggle) {
            const shouldBeDisabled = !enforceBreaks || !websiteBlocking;
            toggle.disabled = shouldBeDisabled;
            toggle.closest('.toggle-setting').classList.toggle('disabled', shouldBeDisabled);
        }
    });
  }

  // Sets up event listeners for website blocking inputs and buttons.
  setupWebsiteBlockingListeners() {
    // Allowlist management
    if (this.elements.addAllowlistBtn) {
      this.elements.addAllowlistBtn.addEventListener("click", () => this.addWebsiteToList("allowlist"));
    }
    if (this.elements.allowlistInput) {
      this.elements.allowlistInput.addEventListener("input", (e) => this.validateInputRealTime(e.target, "allowlist"));
      this.elements.allowlistInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.addWebsiteToList("allowlist");
        }
      });
    }

    // Blocklist management
    if (this.elements.addBlocklistBtn) {
      this.elements.addBlocklistBtn.addEventListener("click", () => this.addWebsiteToList("blocklist"));
    }
    if (this.elements.blocklistInput) {
      this.elements.blocklistInput.addEventListener("input", (e) => this.validateInputRealTime(e.target, "blocklist"));
      this.elements.blocklistInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.addWebsiteToList("blocklist");
        }
      });
    }
  }

  // Main initialization function for the options page.
  async initializeOptions() {
    this.showStatus("Loading settings...", "loading");
    try {
      await this.loadSettings();
      await this.loadWebsiteLists();
      this.updateHeaderStats();
      this.calculateStorageUsage();
      this.showStatus("Settings loaded successfully", "success");
      this.updateLockInUI();
    } catch (error) {
      console.error("Error initializing options:", error);
      this.showStatus("Error loading settings", "error");
    }
  }

  // Loads settings from the background script or chrome.storage as a fallback.
  async loadSettings() {
    try {
      // Prioritize getting settings from the active background script.
      const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
      if (response && response.state) {
        this.currentSettings = response.state.settings;
        this.isLockedIn = response.state.isLockedIn; // Store the lock-in state
        this.backgroundAvailable = true;
    } else {
        throw new Error("Background script not available or returned invalid state.");
      }
    } catch (error) {
      // Fallback to direct storage access if the background script is inactive.
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
      youtubeIntegration: true,
      youtubeDistractionMode: "focus",
      breakOverlayEnabled: true,
      breakCountdown: true,
      nextSessionInfo: true,
      hideDistractions: true,
      focusIndicator: true,
      websiteBlocking: true,
      breakBlockAll: false,
      breakUseAllowlist: true,
      hideYoutubeComments: false,
      hideYoutubeRecommendations: false,
      hideYoutubeShorts: false,
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
      "autoStartBreaks", "autoStartPomodoros",
      "notifications", "sounds", "enforceBreaks",
      "breakOverlayEnabled", "breakCountdown",
      "nextSessionInfo", "hideDistractions",
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

    // Select inputs
    if (this.elements.youtubeDistractionMode) {
      this.elements.youtubeDistractionMode.value = this.currentSettings.youtubeDistractionMode || "focus";
    }
    if (this.elements.soundType) {
      this.elements.soundType.value = this.currentSettings.soundType || "ding";
    }

    this.updateAllToggleStates();
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
      enforceBreaks: this.elements.enforceBreaks?.checked || false,
      youtubeDistractionMode: this.elements.youtubeDistractionMode?.value || "focus",
      breakOverlayEnabled: this.elements.breakOverlayEnabled?.checked || false,
      breakCountdown: this.elements.breakCountdown?.checked || false,
      nextSessionInfo: this.elements.nextSessionInfo?.checked || false,
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

  updateLockInUI() {
    const lockInBanner = document.getElementById("lock-in-banner");
    if (this.isLockedIn) {
        if (lockInBanner) lockInBanner.style.display = 'block';

        const elementsToDisable = [
            this.elements.websiteBlocking,
            this.elements.breakBlockAll,
            this.elements.breakUseAllowlist,
            this.elements.allowlistInput,
            this.elements.addAllowlistBtn,
            this.elements.blocklistInput,
            this.elements.addBlocklistBtn,
            ...document.querySelectorAll('.website-remove-btn'),
            this.elements.enforceBreaks,
            this.elements.breakOverlayEnabled,
            this.elements.resetDefaultsBtn,
            this.elements.clearDataBtn
        ];

        elementsToDisable.forEach(el => {
            if (el) {
                el.disabled = true;
                el.closest('.setting-card, .toggle-setting, .input-group, .btn-group')?.classList.add('locked');
            }
        });
    } else {
        if (lockInBanner) lockInBanner.style.display = 'none';
    }
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