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
      console.error("[Blocker] Error checking block status:", error);
      
      // If extension context is invalidated, try to reload the page
      if (error.message?.includes("Extension context invalidated")) {
        console.log("[Blocker] Extension context invalidated, attempting page reload");
        window.location.reload();
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
          <div class="pomodoro-block-icon">${modeConfig.icon}</div>
          <h1 class="pomodoro-block-title">${modeConfig.title}</h1>
          <p class="pomodoro-block-message">${modeConfig.message}</p>
          <div class="pomodoro-block-reason" id="block-reason">
            ${modeConfig.reason}
          </div>
          <div class="pomodoro-block-actions">
            <button id="pomodoro-close-tab" class="pomodoro-btn pomodoro-btn-primary">
              Close Tab
            </button>
            <button id="pomodoro-pause-timer" class="pomodoro-btn pomodoro-btn-secondary">
              Pause Timer
            </button>
            <button id="pomodoro-open-timer" class="pomodoro-btn pomodoro-btn-secondary">
              Open Timer
            </button>
          </div>
          <div class="pomodoro-block-tips">
            <h3>Productivity Tips:</h3>
            <ul>
              ${modeConfig.tips.map(tip => `<li>${tip}</li>`).join('')}
            </ul>
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
        icon: '🍅',
        title: 'Focus Mode Active',
        message: 'This website is blocked during your focus session.',
        reason: 'Stay focused and get back to work!',
        tips: [
          'Use this time to focus on your current task',
          'Review your goals and priorities',
          'Practice deep breathing exercises',
          'Take a moment to organize your workspace'
        ]
      },
      shortBreak: {
        icon: '☕',
        title: 'Break Time - Website Restricted',
        message: 'This website is restricted during your break time.',
        reason: 'Take a proper break away from the screen!',
        tips: [
          'Stand up and stretch your body',
          'Look away from the screen and rest your eyes',
          'Take a few deep breaths',
          'Hydrate yourself with some water'
        ]
      },
      longBreak: {
        icon: '🏖️',
        title: 'Long Break - Complete Rest',
        message: 'This website is blocked during your long break.',
        reason: 'Time for a complete mental break!',
        tips: [
          'Take a walk outside if possible',
          'Do some light stretching or yoga',
          'Have a healthy snack',
          'Chat with a friend or colleague'
        ]
      },
      idle: {
        icon: '🚫',
        title: 'Website Blocked',
        message: 'This website is in your blocklist.',
        reason: 'Avoiding distractions for better productivity!',
        tips: [
          'Focus on more important tasks',
          'Check your todo list',
          'Start a Pomodoro session',
          'Review your goals for today'
        ]
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
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%) !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif !important;
        animation: pomodoroFadeIn 0.3s ease-out !important;
        backdrop-filter: blur(20px) !important;
      }

      @keyframes pomodoroFadeIn {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
      }

      .pomodoro-block-container {
        max-width: 600px !important;
        margin: 0 auto !important;
        padding: 20px !important;
        position: relative !important;
      }

      .pomodoro-block-content {
        text-align: center !important;
        color: #f8fafc !important;
        background: rgba(30, 41, 59, 0.95) !important;
        backdrop-filter: blur(20px) !important;
        border-radius: 24px !important;
        padding: 48px 40px !important;
        border: 1px solid rgba(148, 163, 184, 0.3) !important;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7) !important;
        position: relative !important;
        overflow: hidden !important;
      }

      .pomodoro-block-content::before {
        content: '' !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 4px !important;
        background: linear-gradient(90deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6) !important;
        animation: shimmer 3s ease-in-out infinite !important;
      }

      @keyframes shimmer {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
      }

      .pomodoro-block-icon {
        font-size: 80px !important;
        margin-bottom: 24px !important;
        animation: pomodoroFloat 3s ease-in-out infinite !important;
        text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
      }

      @keyframes pomodoroFloat {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-10px) rotate(5deg); }
      }

      .pomodoro-block-title {
        font-size: 42px !important;
        font-weight: 800 !important;
        margin-bottom: 16px !important;
        color: #ef4444 !important;
        text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
        letter-spacing: -0.02em !important;
      }

      .pomodoro-block-message {
        font-size: 18px !important;
        margin-bottom: 24px !important;
        color: #cbd5e1 !important;
        line-height: 1.6 !important;
      }

      .pomodoro-block-reason {
        font-size: 16px !important;
        margin-bottom: 32px !important;
        color: #22c55e !important;
        font-weight: 600 !important;
        padding: 16px 24px !important;
        background: rgba(34, 197, 94, 0.15) !important;
        border-radius: 12px !important;
        border: 1px solid rgba(34, 197, 94, 0.3) !important;
        backdrop-filter: blur(10px) !important;
      }

      .pomodoro-block-actions {
        display: flex !important;
        gap: 16px !important;
        justify-content: center !important;
        margin-bottom: 32px !important;
        flex-wrap: wrap !important;
      }

      .pomodoro-btn {
        padding: 16px 28px !important;
        border: none !important;
        border-radius: 12px !important;
        font-size: 16px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        text-decoration: none !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 140px !important;
        white-space: nowrap !important;
        position: relative !important;
        overflow: hidden !important;
      }

      .pomodoro-btn::before {
        content: '' !important;
        position: absolute !important;
        top: 0 !important;
        left: -100% !important;
        width: 100% !important;
        height: 100% !important;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent) !important;
        transition: left 0.6s ease !important;
      }

      .pomodoro-btn:hover::before {
        left: 100% !important;
      }

      .pomodoro-btn-primary {
        background: linear-gradient(135deg, #ef4444, #dc2626) !important;
        color: white !important;
        box-shadow: 0 8px 20px 0 rgba(239, 68, 68, 0.4) !important;
      }

      .pomodoro-btn-primary:hover {
        background: linear-gradient(135deg, #dc2626, #b91c1c) !important;
        transform: translateY(-3px) !important;
        box-shadow: 0 12px 30px 0 rgba(239, 68, 68, 0.5) !important;
      }

      .pomodoro-btn-secondary {
        background: rgba(71, 85, 105, 0.9) !important;
        color: #f8fafc !important;
        border: 1px solid rgba(148, 163, 184, 0.4) !important;
        backdrop-filter: blur(10px) !important;
      }

      .pomodoro-btn-secondary:hover {
        background: rgba(100, 116, 139, 0.95) !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3) !important;
      }

      .pomodoro-block-tips {
        text-align: left !important;
        background: rgba(15, 23, 42, 0.8) !important;
        padding: 24px !important;
        border-radius: 16px !important;
        border: 1px solid rgba(148, 163, 184, 0.2) !important;
        backdrop-filter: blur(10px) !important;
      }

      .pomodoro-block-tips h3 {
        color: #22c55e !important;
        font-size: 18px !important;
        font-weight: 600 !important;
        margin-bottom: 16px !important;
        text-align: center !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
      }

      .pomodoro-block-tips h3::before {
        content: "💡" !important;
        font-size: 20px !important;
      }

      .pomodoro-block-tips ul {
        list-style: none !important;
        padding: 0 !important;
        margin: 0 !important;
        display: grid !important;
        gap: 12px !important;
      }

      .pomodoro-block-tips li {
        padding: 12px 16px !important;
        color: #e2e8f0 !important;
        font-size: 14px !important;
        position: relative !important;
        padding-left: 40px !important;
        background: rgba(30, 41, 59, 0.5) !important;
        border-radius: 8px !important;
        border-left: 3px solid #22c55e !important;
        transition: all 0.2s ease !important;
      }

      .pomodoro-block-tips li::before {
        content: "✨" !important;
        position: absolute !important;
        left: 12px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        color: #22c55e !important;
        font-size: 16px !important;
      }

      .pomodoro-block-tips li:hover {
        background: rgba(30, 41, 59, 0.8) !important;
        transform: translateX(4px) !important;
      }

      /* Mobile responsive */
      @media (max-width: 768px) {
        .pomodoro-block-content {
          padding: 32px 24px !important;
          margin: 16px !important;
        }

        .pomodoro-block-title {
          font-size: 28px !important;
        }

        .pomodoro-block-icon {
          font-size: 60px !important;
        }

        .pomodoro-block-actions {
          flex-direction: column !important;
        }

        .pomodoro-btn {
          width: 100% !important;
          min-width: auto !important;
        }

        .pomodoro-block-tips ul {
          grid-template-columns: 1fr !important;
        }
      }

      /* Ensure overlay stays on top and blocks interaction */
      #pomodoro-block-overlay * {
        pointer-events: auto !important;
      }

      /* Hide page scroll */
      html.pomodoro-blocked {
        overflow: hidden !important;
        height: 100% !important;
      }

      /* Accessibility improvements */
      .pomodoro-btn:focus {
        outline: 3px solid rgba(59, 130, 246, 0.6) !important;
        outline-offset: 2px !important;
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .pomodoro-block-content {
          background: rgba(0, 0, 0, 0.95) !important;
          border: 2px solid white !important;
        }
        
        .pomodoro-block-title {
          color: white !important;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        * {
          animation: none !important;
          transition: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  bindOverlayEvents() {
    const closeBtn = this.overlay.querySelector("#pomodoro-close-tab");
    const pauseBtn = this.overlay.querySelector("#pomodoro-pause-timer");
    const openTimerBtn = this.overlay.querySelector("#pomodoro-open-timer");

    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("[Blocker] Closing tab");
        this.closeTab();
      });
    }

    if (pauseBtn) {
      pauseBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          console.log("[Blocker] Pausing timer");
          await chrome.runtime.sendMessage({ type: "PAUSE_TIMER" });
          // Give a moment for state to update, then check again
          setTimeout(() => this.checkAndBlock(), 500);
        } catch (error) {
          console.error("[Blocker] Error pausing timer:", error);
          this.showError("Failed to pause timer. Please try refreshing the page.");
        }
      });
    }

    if (openTimerBtn) {
      openTimerBtn.addEventListener("click", (e) => {
        e.preventDefault();
        try {
          console.log("[Blocker] Opening timer popup");
          chrome.runtime.sendMessage({ type: "OPEN_POPUP" });
        } catch (error) {
          console.error("[Blocker] Error opening timer:", error);
        }
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
    
    // Space key to pause timer
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      const pauseBtn = this.overlay.querySelector("#pomodoro-pause-timer");
      if (pauseBtn) pauseBtn.click();
    }
    
    // Enter key to open timer
    if (e.key === "Enter") {
      e.preventDefault();
      const openTimerBtn = this.overlay.querySelector("#pomodoro-open-timer");
      if (openTimerBtn) openTimerBtn.click();
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