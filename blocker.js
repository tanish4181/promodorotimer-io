// Enhanced Website Blocker Content Script with Advanced Logic

class AdvancedWebsiteBlocker {
  constructor() {
    this.isBlocked = false;
    this.overlay = null;
    this.observer = null; // For MutationObserver
    this.retryCount = 0;
    this.maxRetries = 3;
    this.init();
  }

  async init() {
    console.log("Initializing advanced website blocker");
    
    try {
      // Wait for chrome runtime to be available
      await this.waitForRuntime();

      // Listen for real-time updates from the background script
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "TIMER_UPDATE") {
          console.log("Blocker received TIMER_UPDATE, re-checking status.");
          this.checkAndBlock();
        }
        return true; // Keep message channel open for other listeners
      });
      
      await this.checkAndBlock();
      
      // Listen for URL changes to handle SPAs
      this.setupNavigationListener();
      
    } catch (error) {
      console.error("Error initializing:", error);
      this.retryInitialization();
    }
  }

  setupNavigationListener() {
    // Listen for standard navigation events
    window.addEventListener('popstate', () => this.checkAndBlock());
    window.addEventListener('hashchange', () => this.checkAndBlock());

    // Monkey-patch history.pushState to detect SPA navigation
    const originalPushState = history.pushState;
    history.pushState = (...args) => {
        originalPushState.apply(history, args);
        this.checkAndBlock();
    };

    // Also handle replaceState
    const originalReplaceState = history.replaceState;
    history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        this.checkAndBlock();
    };
  }

  async waitForRuntime() {
    return new Promise((resolve, reject) => {
      const maxAttempts = 10;
      const checkInterval = 100;
      let attempts = 0;

      // First check if runtime is immediately available
      if (this.isRuntimeAvailable()) {
        resolve();
        return;
      }

      // Setup connection check interval
      const checkRuntime = () => {
        attempts++;
        
        // Check if runtime is available and can make connections
        if (this.isRuntimeAvailable()) {
          // Verify connection with a test message
          chrome.runtime.sendMessage({ type: "PING" }, response => {
            if (chrome.runtime.lastError) {
              if (attempts < maxAttempts) {
                setTimeout(checkRuntime, checkInterval);
              } else {
                reject(new Error("Failed to establish connection to extension runtime"));
              }
            } else {
              resolve();
            }
          });
        } else if (attempts < maxAttempts) {
          setTimeout(checkRuntime, checkInterval);
        } else {
          reject(new Error("Chrome runtime not available after maximum attempts"));
        }
      };

      // Start checking
      setTimeout(checkRuntime, checkInterval);
    });
  }

  isRuntimeAvailable() {
    return Boolean(
      chrome?.runtime?.sendMessage && 
      !chrome.runtime.id?.endsWith('deactivated') &&
      chrome.runtime.getManifest
    );
  }

  retryInitialization() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`Retrying initialization (${this.retryCount}/${this.maxRetries})`);
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
        console.log("Context invalidated, reloading page to re-establish connection.");
        window.location.reload();
      } else if (error.message?.includes("Could not establish connection")) {
        console.log("Connection failed, retrying...");
        this.retryInitialization(); // Use the existing retry logic
      }
    }
  }

  blockWebsite(reason) {
    console.log("Blocking website:", window.location.hostname, `Reason: ${reason}`);
    
    this.isBlocked = true;
    this.createBlockingOverlay(reason);
    this.hidePageContent();
  }

  unblockWebsite() {
    console.log("Unblocking website:", window.location.hostname);
    
    this.isBlocked = false;
    this.removeBlockingOverlay();
    this.showPageContent();
  }

  createBlockingOverlay(reason) {
    // Don't create multiple overlays
    if (document.getElementById("pomodoro-block-overlay")) return;

    this.overlay = document.createElement("div");
    this.overlay.id = "pomodoro-block-overlay";
    this.overlay.innerHTML = this.getOverlayHTML(reason);

    // Add styles
    this.injectOverlayStyles();

    // Add to page
    if (!document.documentElement) {
      console.error("Cannot block page: documentElement not found.");
      return;
    }
    document.documentElement.appendChild(this.overlay);

    // Bind event listeners
    this.bindOverlayEvents();

    // Make the overlay resilient to removal
    this.setupOverlayObserver(reason);

    console.log("Blocking overlay created");
  }

  setupOverlayObserver(reason) {
    if (this.observer) this.observer.disconnect();

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.removedNodes) {
          mutation.removedNodes.forEach(node => {
            if (node.id === 'pomodoro-block-overlay') {
              console.log("Blocker overlay removed, re-injecting...");
              this.createBlockingOverlay(reason);
            }
          });
        }
      }
    });

    this.observer.observe(document.documentElement, { childList: true });
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
          <div class="pomodoro-block-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-shield">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <h1 class="pomodoro-block-title">${config.title}</h1>
          <p class="pomodoro-block-message">${config.message}</p>
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
        background: rgba(15, 23, 42, 0.8) !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif !important;
        animation: pomodoroFadeIn 0.5s cubic-bezier(0.25, 1, 0.5, 1) !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
      }

      @keyframes pomodoroFadeIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }

      .pomodoro-block-container {
        max-width: 500px !important;
        margin: 0 auto !important;
        padding: 40px !important;
        position: relative !important;
        background: rgba(255, 255, 255, 0.05) !important;
        border-radius: 24px !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37) !important;
      }

      .pomodoro-block-content {
        text-align: center !important;
      }

      .pomodoro-block-icon {
        margin-bottom: 24px;
        color: #059669;
      }

      .pomodoro-block-title {
        font-size: 24px !important;
        font-weight: 700 !important;
        color: #ffffff !important;
        margin-bottom: 16px !important;
      }

      .pomodoro-block-message {
        font-size: 16px !important;
        color: rgba(255, 255, 255, 0.8) !important;
        line-height: 1.6 !important;
        margin-bottom: 0 !important;
      }

      /* Hide page scroll */
      html.pomodoro-blocked {
        overflow: hidden !important;
        height: 100% !important;
      }
    `;

    const target = document.head || document.documentElement;
    if (target) {
      target.appendChild(style);
    } else {
      console.error("Could not inject overlay styles, head or documentElement not found.");
    }
  }

  bindOverlayEvents() {
    const closeBtn = this.overlay.querySelector("#pomodoro-close-tab");

    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("Closing tab");
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
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    const overlayEl = document.getElementById("pomodoro-block-overlay");
    if (overlayEl) {
      // Add fade out animation
      overlayEl.style.animation = "pomodoroFadeOut 0.3s ease-out";
      
      setTimeout(() => {
        overlayEl.remove();
        this.overlay = null;
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
    if (!document.documentElement || !document.body) return;
    // Prevent scrolling
    document.documentElement.classList.add("pomodoro-blocked");
    
    // Hide body content but keep our overlay visible
    document.body.style.visibility = "hidden";
    document.body.style.overflow = "hidden";
    
    // Make sure our overlay is visible
    const overlayEl = document.getElementById("pomodoro-block-overlay");
    if (overlayEl) {
      overlayEl.style.visibility = "visible";
    }

    console.log("Page content hidden");
  }

  showPageContent() {
    if (!document.documentElement || !document.body) return;
    // Remove body hiding
    document.body.style.visibility = "visible";
    document.body.style.overflow = "auto";
    
    // Remove blocked class
    document.documentElement.classList.remove("pomodoro-blocked");

    console.log("Page content shown");
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
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    if (this.isBlocked) {
      this.unblockWebsite();
    }
    
    console.log("Cleanup completed");
  }
}

// Initialize the advanced website blocker
(function() {
  try {
    console.log("Initializing AdvancedWebsiteBlocker");
    const blocker = new AdvancedWebsiteBlocker();
    // Store blocker instance in a way that doesn't rely on global scope
    if (typeof window !== 'undefined') {
      window.__pomodoroBlocker = blocker;
    }
  } catch (error) {
    console.error("Failed to initialize website blocker:", error);
  }
})();

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (window.__pomodoroBlocker) {
    window.__pomodoroBlocker.cleanup();
  }
});

// Handle extension context invalidation
chrome.runtime.onConnect.addListener(() => {
  // Connection established, extension context is valid
});

// Add fade out animation CSS
function addFadeOutStyle() {
    if (document.getElementById('pomodoro-fade-stylesheet')) return;
    const fadeOutStyle = document.createElement("style");
    fadeOutStyle.id = 'pomodoro-fade-stylesheet';
    fadeOutStyle.textContent = `
      @keyframes pomodoroFadeOut {
        from { opacity: 1; transform: scale(1); }
        to { opacity: 0; transform: scale(0.9); }
      }
    `;
    (document.head || document.documentElement).appendChild(fadeOutStyle);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addFadeOutStyle);
} else {
    addFadeOutStyle();
}