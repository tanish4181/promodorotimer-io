// Enhanced Website Blocker Content Script with Advanced Logic

class AdvancedWebsiteBlocker {
  constructor() {
    this.isBlocked = false;
    this.overlay = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.init();
  }

  async init() {
    console.log("[v1][Blocker] Initializing advanced website blocker");
    
    try {
      // Wait for chrome runtime to be available
      await this.waitForRuntime();
      
      await this.checkAndBlock();
      
      // Listen for timer state changes from the background
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "TIMER_UPDATE" || message.type === "SETTINGS_UPDATED") {
          this.checkAndBlock();
        }
        return true; // Keep message channel open for async responses
      });
      
    } catch (error) {
      console.error("[v1][Blocker] Error initializing:", error);
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
      console.log(`[v1][Blocker] Retrying initialization (${this.retryCount}/${this.maxRetries})`);
      setTimeout(() => this.init(), 1000 * this.retryCount);
    } else {
      console.error("[v1][Blocker] Max retries reached, blocker initialization failed");
    }
  }

  async checkAndBlock() {
    try {
      if (!chrome?.runtime?.sendMessage) {
        console.error("[v1][Blocker] Chrome runtime not available");
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
      console.error("[v1][Blocker] Error checking block status:", error.message);
      
      if (error.message?.includes("Extension context invalidated")) {
        console.log("[v1][Blocker] Context invalidated, reloading page to re-establish connection.");
        window.location.reload();
      } else if (error.message?.includes("Could not establish connection")) {
        console.log("[v1][Blocker] Connection failed, retrying...");
        this.retryInitialization();
      }
    }
  }

  blockWebsite() {
    console.log("[v1][Blocker] Blocking website:", window.location.hostname);
    
    this.isBlocked = true;
    this.createBlockingOverlay();
    this.hidePageContent();
  }

  unblockWebsite() {
    console.log("[v1][Blocker] Unblocking website:", window.location.hostname);
    
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

    console.log("[v1][Blocker] Blocking overlay created");
  }

  getOverlayHTML() {
    return `
      <div class="pomodoro-block-container">
        <div class="pomodoro-block-content">
          <h1 class="pomodoro-block-title">Focus Mode Active</h1>
          <p class="pomodoro-block-subtitle">This site is currently blocked to help you stay on task.</p>
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
        background: rgba(15, 23, 42, 0.85) !important;
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
        font-size: 32px !important;
        font-weight: 700 !important;
        color: #ffffff !important;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5) !important;
        margin-bottom: 12px !important;
      }

      .pomodoro-block-subtitle {
        font-size: 18px !important;
        font-weight: 400 !important;
        color: rgba(255, 255, 255, 0.8) !important;
        margin-bottom: 32px !important;
      }

      .pomodoro-block-actions {
        display: flex !important;
        justify-content: center !important;
      }

      .pomodoro-btn {
        padding: 14px 28px !important;
        border: 1px solid rgba(255, 255, 255, 0.5) !important;
        border-radius: 12px !important;
        font-size: 16px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        background: rgba(255, 255, 255, 0.1) !important;
        color: white !important;
      }

      .pomodoro-btn:hover {
        background: rgba(255, 255, 255, 0.2) !important;
        border-color: rgba(255, 255, 255, 0.8) !important;
        transform: translateY(-2px);
      }

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
        console.log("[v1][Blocker] Closing tab via background message");
        this.closeTab();
      });
    }

    document.addEventListener("keydown", this.handleKeyboardShortcuts.bind(this));
    this.overlay.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  handleKeyboardShortcuts(e) {
    if (!this.isBlocked) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.closeTab();
    }
  }

  closeTab() {
    try {
      chrome.runtime.sendMessage({ type: "CLOSE_CURRENT_TAB" });
    } catch (error) {
      console.error("[v1][Blocker] Error sending CLOSE_CURRENT_TAB message:", error);
      // Fallback if messaging fails for some reason
      window.location.href = "about:blank";
    }
  }

  removeBlockingOverlay() {
    if (this.overlay) {
      this.overlay.style.animation = "pomodoroFadeOut 0.3s ease-out forwards";
      setTimeout(() => {
        if (this.overlay) {
          this.overlay.remove();
          this.overlay = null;
        }
      }, 300);
    }

    const styleEl = document.getElementById("pomodoro-block-styles");
    if (styleEl) styleEl.remove();

    document.removeEventListener("keydown", this.handleKeyboardShortcuts.bind(this));
  }

  hidePageContent() {
    document.documentElement.classList.add("pomodoro-blocked");
    document.body.style.visibility = "hidden";
    document.body.style.overflow = "hidden";
    if (this.overlay) {
      this.overlay.style.visibility = "visible";
    }
    console.log("[v1][Blocker] Page content hidden");
  }

  showPageContent() {
    document.documentElement.classList.remove("pomodoro-blocked");
    document.body.style.visibility = "visible";
    document.body.style.overflow = "auto";
    console.log("[v1][Blocker] Page content shown");
  }

  cleanup() {
    if (this.isBlocked) {
      this.unblockWebsite();
    }
    console.log("[v1][Blocker] Cleanup completed");
  }
}

// Initialize the advanced website blocker
console.log("[v1][Blocker] Initializing AdvancedWebsiteBlocker");
const blocker = new AdvancedWebsiteBlocker();

window.addEventListener("beforeunload", () => {
  if (blocker) {
    blocker.cleanup();
  }
});

const fadeOutStyle = document.createElement("style");
fadeOutStyle.textContent = `
  @keyframes pomodoroFadeOut {
    from { opacity: 1; transform: scale(1); }
    to { opacity: 0; transform: scale(0.9); }
  }
`;
document.head.appendChild(fadeOutStyle);