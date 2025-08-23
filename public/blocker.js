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
      console.error("Error initializing:", error);
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
      setTimeout(() => this.init(), 1000 * this.retryCount);
    } else {
      console.error("Max retries reached, blocker initialization failed");
    }
  }

  async checkAndBlock() {
    try {
      if (!chrome?.runtime?.sendMessage) {
        console.error("Chrome runtime not available");
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
        this.blockWebsite(response.reason);
      } else if (!response?.blocked && this.isBlocked) {
        this.unblockWebsite();
      }

    } catch (error) {
      console.error("Error checking block status:", error.message);
      
      if (error.message?.includes("Extension context invalidated")) {
        window.location.reload();
      } else if (error.message?.includes("Could not establish connection")) {
        this.retryInitialization(); // Use the existing retry logic
      }
    }
  }

  blockWebsite(reason) {
    this.isBlocked = true;
    this.createBlockingOverlay(reason);
    this.hidePageContent();
  }

  unblockWebsite() {
    this.isBlocked = false;
    this.removeBlockingOverlay();
    this.showPageContent();
  }

  createBlockingOverlay(reason) {
    // Don't create multiple overlays
    if (this.overlay) return;

    this.overlay = document.createElement("div");
    this.overlay.id = "pomodoro-block-overlay";
    this.overlay.innerHTML = this.getOverlayHTML(reason);

    // Add styles
    this.injectOverlayStyles();

    // Add to page
    document.documentElement.appendChild(this.overlay);

    // Bind event listeners
    this.bindOverlayEvents();
  }

  getOverlayHTML(reason) {
    const messages = {
      'focus': {
        title: 'Focus Mode is On',
        message: 'This website is blocked to help you stay focused. If you need to access it during focus sessions, please add it to your allowlist in the extension options.'
      },
      'blocklist': {
        title: 'Website Blocked',
        message: 'This website is in your blocklist.'
      },
      'break-all': {
        title: 'Break Time',
        message: 'All websites are blocked during your break to help you disconnect.'
      },
      'break-allowlist': {
        title: 'Break Time',
        message: 'This website is not in your allowlist and is blocked during your break.'
      },
      'default': {
        title: 'Website Blocked',
        message: 'This website is currently blocked by the Pomodoro Timer extension.'
      }
    };

    const config = messages[reason] || messages['default'];

    return `
      <div class="pomodoro-block-container">
        <div class="pomodoro-block-content">
          <h1 class="pomodoro-block-title">${config.title}</h1>
          <p class="pomodoro-block-message">${config.message}</p>
          <div class="pomodoro-block-actions">
            <button id="pomodoro-close-tab" class="pomodoro-btn pomodoro-btn-primary">
              Close Tab
            </button>
          </div>
        </div>
      </div>
    `;
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
        margin-bottom: 16px !important;
      }

      .pomodoro-block-message {
        font-size: 16px !important;
        color: rgba(255, 255, 255, 0.8) !important;
        margin-bottom: 24px !important;
        line-height: 1.5 !important;
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
    chrome.runtime.sendMessage({ type: "CLOSE_CURRENT_TAB" });
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
  }

  showPageContent() {
    // Remove body hiding
    document.body.style.visibility = "visible";
    document.body.style.overflow = "auto";
    
    // Remove blocked class
    document.documentElement.classList.remove("pomodoro-blocked");
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
  }
}

// Initialize the advanced website blocker
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