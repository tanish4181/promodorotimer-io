// Enhanced Website Blocker Content Script with Advanced Logic

class AdvancedWebsiteBlocker {
  constructor() {
    this.isBlocked = false;
    this.overlay = null;
    this.breakOverlayVisible = false;
    this.breakCountdownInterval = null;
    this.checkInterval = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.init();
  }

  async init() {
    console.log("Initializing advanced website blocker");
    
    try {
      // Wait for chrome runtime to be available
      await this.waitForRuntime();
      
      // Fetch initial state to handle persistence on refresh
      try {
        const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
        if (response && response.state) {
          this.handleBreakOverlay(response.state);
        }
      } catch (error) {
        console.error("Could not get initial state, will rely on updates.", error);
      }

      await this.checkAndBlock();
      
      // Set up periodic checking for dynamic blocking state changes
      this.checkInterval = setInterval(() => {
        this.checkAndBlock();
      }, 2000);
      
      // Listen for timer state changes
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "TIMER_UPDATE") {
          this.checkAndBlock();
          this.handleBreakOverlay(message.state);
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

    console.log("Blocking overlay created");
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

    document.head.appendChild(style);
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

    console.log("Page content hidden");
  }

  showPageContent() {
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

  handleBreakOverlay(state) {
    const { currentMode, isRunning, settings } = state;
    const isBreak = currentMode === 'shortBreak' || currentMode === 'longBreak';
    const showOverlay = isRunning && isBreak && (settings.globalBreakOverlay || settings.breakOverlay);

    if (showOverlay && !this.breakOverlayVisible) {
      this.createBreakOverlay(state);
    } else if (!showOverlay && this.breakOverlayVisible) {
      this.removeBreakOverlay();
    }
  }

  createBreakOverlay(state) {
    if (document.getElementById("pomodoro-break-overlay")) return;
    this.breakOverlayVisible = true;

    const { settings, nextSessionInfo, currentTime, currentMode } = state;

    const overlay = document.createElement("div");
    overlay.id = "pomodoro-break-overlay";

    let overlayContent = `
      <div class="pomodoro-overlay-content">
        <h1>${currentMode === "shortBreak" ? "Short Break" : "Long Break"}</h1>
        <p>It's time to relax and recharge. Take a moment away from your screen.</p>
    `;

    if (settings.breakCountdown) {
      overlayContent += `
        <div class="pomodoro-countdown">
          <div class="countdown-label">Break ends in:</div>
          <div class="countdown-timer" id="break-countdown-timer">--:--</div>
        </div>
      `;
    }

    if (settings.nextSessionInfo && nextSessionInfo) {
      overlayContent += `
        <div class="pomodoro-next-session">
          <div class="next-session-label">Next Focus Session:</div>
          <div class="next-session-info">
            <span class="next-duration">${nextSessionInfo.nextDuration} minutes</span>
            <span class="next-sessions-until-long">(${nextSessionInfo.sessionsUntilLongBreak} sessions until long break)</span>
          </div>
        </div>
      `;
    }

    overlayContent += `</div>`;
    overlay.innerHTML = overlayContent;

    const style = document.createElement('style');
    style.id = "pomodoro-break-overlay-styles";
    style.textContent = `
      #pomodoro-break-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.95); z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: white; text-align: center;
      }
      .pomodoro-overlay-content { max-width: 500px; padding: 40px; }
      .pomodoro-overlay-content h1 { font-size: 2.5rem; margin-bottom: 16px; color: #059669; }
      .pomodoro-overlay-content p { font-size: 1.2rem; margin-bottom: 30px; line-height: 1.6; color: #d1d5db; }
      .pomodoro-countdown { margin: 30px 0; padding: 20px; background: rgba(5, 150, 105, 0.1); border-radius: 12px; border: 1px solid rgba(5, 150, 105, 0.3); }
      .countdown-label { font-size: 1rem; color: #9ca3af; margin-bottom: 8px; }
      .countdown-timer { font-size: 2.5rem; font-weight: 700; color: #059669; font-family: monospace; }
      .pomodoro-next-session { margin: 20px 0; padding: 16px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3); }
      .next-session-label { font-size: 0.9rem; color: #9ca3af; margin-bottom: 4px; }
      .next-session-info { font-size: 1.1rem; color: #3b82f6; }
      .next-duration { font-weight: 600; }
      .next-sessions-until-long { font-size: 0.9rem; opacity: 0.8; }
    `;

    document.documentElement.appendChild(style);
    document.documentElement.appendChild(overlay);

    if (settings.breakCountdown) {
      this.startBreakCountdown(currentTime);
    }
  }

  updateBreakCountdown(currentTime) {
    const countdownElement = document.getElementById("break-countdown-timer");
    if (!countdownElement) return;

    const minutes = Math.floor(currentTime / 60);
    const seconds = currentTime % 60;
    countdownElement.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  startBreakCountdown(initialTime) {
    if (this.breakCountdownInterval) {
      clearInterval(this.breakCountdownInterval);
    }
    this.updateBreakCountdown(initialTime);
    this.breakCountdownInterval = setInterval(() => {
      const countdownElement = document.getElementById("break-countdown-timer");
      if (!countdownElement) {
        clearInterval(this.breakCountdownInterval);
        return;
      }
      const parts = countdownElement.textContent.split(":");
      let minutes = parseInt(parts[0], 10);
      let seconds = parseInt(parts[1], 10);
      if (seconds > 0) {
        seconds--;
      } else if (minutes > 0) {
        minutes--;
        seconds = 59;
      } else {
        clearInterval(this.breakCountdownInterval);
        return;
      }
      this.updateBreakCountdown(minutes * 60 + seconds);
    }, 1000);
  }

  removeBreakOverlay() {
    const overlay = document.getElementById("pomodoro-break-overlay");
    if (overlay) overlay.remove();

    const styles = document.getElementById("pomodoro-break-overlay-styles");
    if (styles) styles.remove();

    if (this.breakCountdownInterval) {
      clearInterval(this.breakCountdownInterval);
      this.breakCountdownInterval = null;
    }
    this.breakOverlayVisible = false;
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
    
    console.log("Cleanup completed");
  }
}

// Initialize the advanced website blocker
console.log("Initializing AdvancedWebsiteBlocker");
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