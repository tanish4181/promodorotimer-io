// Enhanced Website Blocker Content Script with Advanced Logic

class AdvancedWebsiteBlocker {
  constructor() {
    this.isBlocked = false;
    this.overlay = null;
    this.checkInterval = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.init();
  }

  async init() {
    console.log("[Blocker] Initializing advanced website blocker");
    
    try {
      // Wait for chrome runtime to be available
      await this.waitForRuntime();
      
      await this.checkAndBlock();
      
      // Set up periodic checking for dynamic blocking state changes
      this.checkInterval = setInterval(() => {
        this.checkAndBlock();
      }, 2000);
      
      // Listen for timer state changes
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "TIMER_UPDATE") {
          this.checkAndBlock();
        }
        return true;
      });
      
    } catch (error) {
      console.error("[Blocker] Error initializing:", error);
      this.retryInitialization();
    }
  }

  async waitForRuntime() {
    return new Promise((resolve, reject) => {
      if (chrome?.runtime?.sendMessage) {
        resolve();
        return;
      }
      
      let attempts = 0;
      const maxAttempts = 10;
      
      const checkRuntime = () => {
        attempts++;
        if (chrome?.runtime?.sendMessage) {
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(checkRuntime, 100);
        } else {
          reject(new Error("Chrome runtime not available"));
        }
      };
      
      setTimeout(checkRuntime, 100);
    });
  }

  retryInitialization() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`[Blocker] Retrying initialization (${this.retryCount}/${this.maxRetries})`);
      setTimeout(() => this.init(), 1000 * this.retryCount);
    } else {
      console.error("[Blocker] Max retries reached, blocker initialization failed");
    }
  }

  async checkAndBlock() {
    try {
      if (!chrome?.runtime?.sendMessage) {
        console.error("[Blocker] Chrome runtime not available");
        return;
      }

      // Send message and handle response
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: "CHECK_WEBSITE_BLOCKED",
          url: window.location.href
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });

      if (response?.blocked && !this.isBlocked) {
        this.blockWebsite();
      } else if (!response?.blocked && this.isBlocked) {
        this.unblockWebsite();
      }

    } catch (error) {
      console.error("[Blocker] Error checking block status:", error.message);
      
      if (error.message?.includes("Extension context invalidated")) {
        console.log("[Blocker] Context invalidated, reloading page to re-establish connection.");
        window.location.reload();
      } else if (error.message?.includes("Could not establish connection")) {
        console.log("[Blocker] Connection failed, retrying...");
        this.retryInitialization(); // Use the existing retry logic
      }
    }
  }

  blockWebsite() {
    console.log("[Blocker] Blocking website:", window.location.hostname);
    
    this.isBlocked = true;
    this.createBlockingOverlay();
    this.hidePageContent();
  }

  unblockWebsite() {
    console.log("[Blocker] Unblocking website:", window.location.hostname);
    
    this.isBlocked = false;
    this.removeBlockingOverlay();
    this.showPageContent();
  }

  createBlockingOverlay() {
    // Don't create multiple overlays
    if (this.overlay) return;

    this.overlay = document.createElement("div");
    this.overlay.id = "pomodoro-block-overlay";
    this.overlay.innerHTML = this.getOverlayHTML();

    // Add styles
    this.injectOverlayStyles();

    // Add to page
    document.documentElement.appendChild(this.overlay);

    // Bind event listeners
    this.bindOverlayEvents();

    console.log("[Blocker] Blocking overlay created");
  }

  getOverlayHTML() {
    const currentMode = this.getCurrentMode();
    const modeConfig = this.getModeConfig(currentMode);
    
    return `
      <div class="pomodoro-block-container">
        <div class="pomodoro-block-content">
          <h1 class="pomodoro-block-title">${modeConfig.title}</h1>
          <div class="pomodoro-block-actions">
            <button id="pomodoro-close-tab" class="pomodoro-btn pomodoro-btn-primary">
              Close Tab
            </button>
          </div>
        </div>
      </div>
    `;
  }

  getCurrentMode() {
    // Try to get current mode from URL or default to focus
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('pomodoroMode') || 'focus';
    } catch {
      return 'focus';
    }
  }

  getModeConfig(mode) {
    const configs = {
      focus: {
        title: 'Focus mode is on',
      },
      shortBreak: {
        title: 'Break Time',
      },
      longBreak: {
        title: 'Break Time',
      },
      idle: {
        title: 'Website is blocked',
      }
    };
    
    return configs[mode] || configs.focus;
  }

  injectOverlayStyles() {
    if (document.getElementById("pomodoro-block-styles")) return;

    const style = document.createElement("style");
    style.id = "pomodoro-block-styles";
    style.textContent = `
      #pomodoro-block-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(15, 23, 42, 0.75) !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif !important;
        animation: pomodoroFadeIn 0.3s ease-out !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
      }

      @keyframes pomodoroFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .pomodoro-block-container {
        max-width: 600px !important;
        margin: 0 auto !important;
        padding: 20px !important;
        position: relative !important;
      }

      .pomodoro-block-content {
        text-align: center !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
      }

      .pomodoro-block-title {
        font-size: 28px !important;
        font-weight: 600 !important;
        color: #ffffff !important;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5) !important;
        margin-bottom: 24px !important;
      }

      .pomodoro-block-actions {
        display: flex !important;
        justify-content: center !important;
      }

      .pomodoro-btn {
        padding: 12px 24px !important;
        border: 1px solid rgba(255, 255, 255, 0.5) !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        background: rgba(255, 255, 255, 0.1) !important;
        color: white !important;
      }

      .pomodoro-btn:hover {
        background: rgba(255, 255, 255, 0.2) !important;
        border-color: rgba(255, 255, 255, 0.8) !important;
      }

      /* Hide page scroll */
      html.pomodoro-blocked {
        overflow: hidden !important;
        height: 100% !important;
      }
    `;

    document.head.appendChild(style);
  }

  bindOverlayEvents() {
    const closeBtn = this.overlay.querySelector("#pomodoro-close-tab");

    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("[Blocker] Closing tab");
        this.closeTab();
      });
    }

    // Keyboard shortcuts
    document.addEventListener("keydown", this.handleKeyboardShortcuts.bind(this));

    // Prevent context menu on overlay
    this.overlay.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
  }

  handleKeyboardShortcuts(e) {
    if (!this.isBlocked) return;

    // ESC key to close tab
    if (e.key === "Escape") {
      e.preventDefault();
      this.closeTab();
    }
  }

  closeTab() {
    try {
      // Try to close the tab
      window.close();
      
      // If window.close() doesn't work (e.g., not opened by script), 
      // try to navigate to a neutral page after a brief delay
      setTimeout(() => {
        if (!window.closed) {
          window.location.href = "about:blank";
        }
      }, 100);
    } catch (error) {
      console.error("[Blocker] Error closing tab:", error);
      // Fallback: navigate to blank page
      window.location.href = "about:blank";
    }
  }

  removeBlockingOverlay() {
    if (this.overlay) {
      // Add fade out animation
      this.overlay.style.animation = "pomodoroFadeOut 0.3s ease-out";
      
      setTimeout(() => {
        if (this.overlay) {
          this.overlay.remove();
          this.overlay = null;
        }
      }, 300);
    }

    // Remove styles
    const styleEl = document.getElementById("pomodoro-block-styles");
    if (styleEl) {
      styleEl.remove();
    }

    // Remove keyboard event listener
    document.removeEventListener("keydown", this.handleKeyboardShortcuts.bind(this));
  }

  hidePageContent() {
    // Prevent scrolling
    document.documentElement.classList.add("pomodoro-blocked");
    
    // Hide body content but keep our overlay visible
    document.body.style.visibility = "hidden";
    document.body.style.overflow = "hidden";
    
    // Make sure our overlay is visible
    if (this.overlay) {
      this.overlay.style.visibility = "visible";
    }

    console.log("[Blocker] Page content hidden");
  }

  showPageContent() {
    // Remove body hiding
    document.body.style.visibility = "visible";
    document.body.style.overflow = "auto";
    
    // Remove blocked class
    document.documentElement.classList.remove("pomodoro-blocked");

    console.log("[Blocker] Page content shown");
  }

  showError(message) {
    if (!this.overlay) return;

    const reasonElement = this.overlay.querySelector("#block-reason");
    if (reasonElement) {
      reasonElement.innerHTML = `
        <div style="color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3);">
          ⚠️ ${message}
        </div>
      `;
    }
  }

  // Cleanup method for when the content script is unloaded
  cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    if (this.isBlocked) {
      this.unblockWebsite();
    }
    
    console.log("[Blocker] Cleanup completed");
  }
}

// Initialize the advanced website blocker
console.log("[Blocker] Initializing AdvancedWebsiteBlocker");
const blocker = new AdvancedWebsiteBlocker();

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (blocker) {
    blocker.cleanup();
  }
});

// Handle extension context invalidation
chrome.runtime.onConnect.addListener(() => {
  // Connection established, extension context is valid
});

// Add fade out animation CSS
const fadeOutStyle = document.createElement("style");
fadeOutStyle.textContent = `
  @keyframes pomodoroFadeOut {
    from { opacity: 1; transform: scale(1); }
    to { opacity: 0; transform: scale(0.9); }
  }
`;
document.head.appendChild(fadeOutStyle);