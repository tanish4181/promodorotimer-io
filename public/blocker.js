// Enhanced Website Blocker Content Script with Advanced Logic

class AdvancedWebsiteBlocker {
  constructor() {
    this.isBlocked = false;
    this.overlay = null;
    this.checkInterval = null;
    this.init();
  }

  async init() {
    console.log("[Blocker] Initializing advanced website blocker");
    
    try {
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
      });
      
    } catch (error) {
      console.error("[Blocker] Error initializing:", error);
    }
  }

  async checkAndBlock() {
    try {
      if (!chrome?.runtime?.sendMessage) {
        console.error("[Blocker] Chrome runtime not available");
        return;
      }

      const response = await chrome.runtime.sendMessage({
        type: "CHECK_WEBSITE_BLOCKED",
        url: window.location.href
      });

      if (response?.blocked && !this.isBlocked) {
        this.blockWebsite();
      } else if (!response?.blocked && this.isBlocked) {
        this.unblockWebsite();
      }

    } catch (error) {
      console.error("[Blocker] Error checking block status:", error);
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
    return `
      <div class="pomodoro-block-container">
        <div class="pomodoro-block-content">
          <div class="pomodoro-block-icon">🍅</div>
          <h1 class="pomodoro-block-title">Website Blocked</h1>
          <p class="pomodoro-block-message">This website is currently blocked by your Pomodoro timer.</p>
          <div class="pomodoro-block-reason" id="block-reason">
            Stay focused and get back to work!
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
              <li>Use this time to focus on your current task</li>
              <li>Take a short walk or stretch</li>
              <li>Practice deep breathing</li>
              <li>Review your goals</li>
            </ul>
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
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%) !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif !important;
        animation: pomodoroFadeIn 0.3s ease-out !important;
      }

      @keyframes pomodoroFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .pomodoro-block-container {
        max-width: 600px !important;
        margin: 0 auto !important;
        padding: 20px !important;
      }

      .pomodoro-block-content {
        text-align: center !important;
        color: #f8fafc !important;
        background: rgba(30, 41, 59, 0.8) !important;
        backdrop-filter: blur(20px) !important;
        border-radius: 24px !important;
        padding: 48px 40px !important;
        border: 1px solid rgba(148, 163, 184, 0.2) !important;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
      }

      .pomodoro-block-icon {
        font-size: 80px !important;
        margin-bottom: 24px !important;
        animation: pomodoroFloat 3s ease-in-out infinite !important;
      }

      @keyframes pomodoroFloat {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }

      .pomodoro-block-title {
        font-size: 42px !important;
        font-weight: 700 !important;
        margin-bottom: 16px !important;
        color: #ef4444 !important;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
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
        padding: 12px 24px !important;
        background: rgba(34, 197, 94, 0.1) !important;
        border-radius: 12px !important;
        border: 1px solid rgba(34, 197, 94, 0.2) !important;
      }

      .pomodoro-block-actions {
        display: flex !important;
        gap: 16px !important;
        justify-content: center !important;
        margin-bottom: 32px !important;
        flex-wrap: wrap !important;
      }

      .pomodoro-btn {
        padding: 14px 28px !important;
        border: none !important;
        border-radius: 12px !important;
        font-size: 16px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        text-decoration: none !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 140px !important;
        white-space: nowrap !important;
      }

      .pomodoro-btn-primary {
        background: linear-gradient(135deg, #ef4444, #dc2626) !important;
        color: white !important;
        box-shadow: 0 4px 14px 0 rgba(239, 68, 68, 0.3) !important;
      }

      .pomodoro-btn-primary:hover {
        background: linear-gradient(135deg, #dc2626, #b91c1c) !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 25px 0 rgba(239, 68, 68, 0.4) !important;
      }

      .pomodoro-btn-secondary {
        background: rgba(71, 85, 105, 0.8) !important;
        color: #f8fafc !important;
        border: 1px solid rgba(148, 163, 184, 0.3) !important;
        backdrop-filter: blur(10px) !important;
      }

      .pomodoro-btn-secondary:hover {
        background: rgba(100, 116, 139, 0.9) !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
      }

      .pomodoro-block-tips {
        text-align: left !important;
        background: rgba(15, 23, 42, 0.6) !important;
        padding: 24px !important;
        border-radius: 16px !important;
        border: 1px solid rgba(148, 163, 184, 0.1) !important;
      }

      .pomodoro-block-tips h3 {
        color: #22c55e !important;
        font-size: 18px !important;
        font-weight: 600 !important;
        margin-bottom: 16px !important;
        text-align: center !important;
      }

      .pomodoro-block-tips ul {
        list-style: none !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      .pomodoro-block-tips li {
        padding: 8px 0 !important;
        color: #e2e8f0 !important;
        font-size: 14px !important;
        position: relative !important;
        padding-left: 24px !important;
      }

      .pomodoro-block-tips li::before {
        content: "✨" !important;
        position: absolute !important;
        left: 0 !important;
        color: #22c55e !important;
      }

      /* Mobile responsive */
      @media (max-width: 768px) {
        .pomodoro-block-content {
          padding: 32px 24px !important;
          margin: 16px !important;
        }

        .pomodoro-block-title {
          font-size: 32px !important;
        }

        .pomodoro-block-actions {
          flex-direction: column !important;
        }

        .pomodoro-btn {
          width: 100% !important;
        }
      }

      /* Ensure overlay stays on top */
      #pomodoro-block-overlay * {
        pointer-events: auto !important;
      }

      /* Hide page scroll */
      html.pomodoro-blocked {
        overflow: hidden !important;
      }
    `;

    document.head.appendChild(style);
  }

  bindOverlayEvents() {
    const closeBtn = this.overlay.querySelector("#pomodoro-close-tab");
    const pauseBtn = this.overlay.querySelector("#pomodoro-pause-timer");
    const openTimerBtn = this.overlay.querySelector("#pomodoro-open-timer");

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        console.log("[Blocker] Closing tab");
        window.close();
      });
    }

    if (pauseBtn) {
      pauseBtn.addEventListener("click", async () => {
        try {
          console.log("[Blocker] Pausing timer");
          await chrome.runtime.sendMessage({ type: "PAUSE_TIMER" });
          // Give a moment for state to update, then check again
          setTimeout(() => this.checkAndBlock(), 500);
        } catch (error) {
          console.error("[Blocker] Error pausing timer:", error);
        }
      });
    }

    if (openTimerBtn) {
      openTimerBtn.addEventListener("click", () => {
        try {
          console.log("[Blocker] Opening timer popup");
          chrome.runtime.sendMessage({ type: "OPEN_POPUP" });
        } catch (error) {
          console.error("[Blocker] Error opening timer:", error);
        }
      });
    }
  }

  removeBlockingOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    // Remove styles
    const styleEl = document.getElementById("pomodoro-block-styles");
    if (styleEl) {
      styleEl.remove();
    }
  }

  hidePageContent() {
    // Prevent scrolling
    document.documentElement.classList.add("pomodoro-blocked");
    
    // Hide body content but keep our overlay visible
    document.body.style.visibility = "hidden";
    
    // Make sure our overlay is visible
    if (this.overlay) {
      this.overlay.style.visibility = "visible";
    }
  }

  showPageContent() {
    // Allow scrolling
    document.documentElement.classList.remove("pomodoro-blocked");

    // Show body content
    document.body.style.visibility = "visible";
  }