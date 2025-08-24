class BreakEnforcer {
  constructor() {
    this.breakOverlayVisible = false;
    this.breakCountdownInterval = null;
    this.observer = null;
    this.currentState = null;
    this.activeOverlaySettings = {};
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "TIMER_UPDATE") {
        this.currentState = message.state;
        this.handleBreakOverlay(message.state);
      }
      return true;
    });

    // It's also a good idea to check the state when the script is first injected
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
      } else if (response && response.state) {
        this.currentState = response.state;
        this.handleBreakOverlay(response.state);
      }
    });
  }

  _isUrlInList(url, list) {
    if (!url || !list || list.length === 0) {
      return false;
    }
    try {
        const currentUrl = new URL(url);
        const currentUrlStr = `${currentUrl.hostname}${currentUrl.pathname}`.toLowerCase().replace(/\/$/, "");

        for (const rule of list) {
            const lowerCaseRule = rule.toLowerCase();
            if (!lowerCaseRule.includes('/')) {
                if (currentUrl.hostname === lowerCaseRule || currentUrl.hostname.endsWith(`.${lowerCaseRule}`)) {
                    return true;
                }
            } else {
                if (currentUrlStr.startsWith(lowerCaseRule)) {
                    return true;
                }
            }
        }
    } catch (error) {
      console.error(`[v0] Invalid URL format for blocking check: ${url}`, error);
      return false;
    }
    return false;
  }

  handleBreakOverlay(state) {
    const { currentMode, isRunning, settings, allowedWebsites } = state;
    const isBreak = currentMode === 'shortBreak' || currentMode === 'longBreak';

    // The overlay should appear if breaks are enforced AND the timer is running during a break.
    const shouldShowOverlay = isRunning && isBreak && settings.enforceBreaks && settings.websiteBlocking;

    if (shouldShowOverlay) {
        // Determine if the current page should be blocked based on break settings
        let isPageBlocked = false;
        if (settings.breakBlockAll) {
            isPageBlocked = true;
        } else if (settings.breakUseAllowlist) {
            if (!this._isUrlInList(window.location.href, allowedWebsites)) {
                isPageBlocked = true;
            }
        }

        // Only show the overlay on pages that are supposed to be blocked.
        if (!isPageBlocked) {
            this.removeBreakOverlay();
            return;
        }

        const newOverlaySettings = {
            countdown: settings.breakCountdown,
            nextSession: settings.nextSessionInfo,
        };

        if (!this.breakOverlayVisible || JSON.stringify(this.activeOverlaySettings) !== JSON.stringify(newOverlaySettings)) {
            this.removeBreakOverlay(); // Always remove before creating to apply changes
            this.createBreakOverlay(state);
            this.activeOverlaySettings = newOverlaySettings;
        } else {
            // If overlay is already visible and settings are the same, just update the timer
            this.updateBreakCountdown(state.currentTime);
        }
    } else {
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
      const nextFocusDuration = nextSessionInfo.nextDuration === 1 ? '1 minute' : `${nextSessionInfo.nextDuration} minutes`;
      const sessionsUntilText = nextSessionInfo.sessionsUntilLongBreak === 1 ? '1 session until long break' : `${nextSessionInfo.sessionsUntilLongBreak} sessions until long break`;

      overlayContent += `
        <div class="pomodoro-next-session">
          <div class="next-session-label">Next Focus Session:</div>
          <div class="next-session-info">${nextFocusDuration} <span>(${sessionsUntilText})</span></div>
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
        background: rgba(10, 10, 10, 0.75);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: white; text-align: center;
        animation: pomodoroFadeIn 0.5s cubic-bezier(0.25, 1, 0.5, 1);
      }
      @keyframes pomodoroFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .pomodoro-overlay-content { max-width: 550px; padding: 40px; }
      .pomodoro-overlay-content h1 {
        font-size: 3.5rem;
        font-weight: 700;
        margin-bottom: 16px;
        color: #ffffff;
        text-shadow: 0 2px 10px rgba(0,0,0,0.3);
      }
      .pomodoro-overlay-content p {
        font-size: 1.25rem;
        margin-bottom: 40px;
        line-height: 1.6;
        color: #d1d5db;
        text-shadow: 0 1px 5px rgba(0,0,0,0.2);
      }
      .pomodoro-countdown {
        margin: 30px auto;
        padding: 20px 30px;
        background: rgba(5, 150, 105, 0.15);
        border-radius: 16px;
        border: 1px solid rgba(5, 150, 105, 0.4);
        max-width: 300px;
      }
      .countdown-label { font-size: 1rem; color: #9ca3af; margin-bottom: 8px; }
      .countdown-timer {
        font-size: 3.5rem;
        font-weight: 700;
        color: #10b981;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        text-shadow: 0 0 15px rgba(16, 185, 129, 0.5);
      }
      .pomodoro-next-session {
        margin: 20px auto;
        padding: 16px 24px;
        background: rgba(59, 130, 246, 0.1);
        border-radius: 12px;
        border: 1px solid rgba(59, 130, 246, 0.3);
        max-width: 400px;
      }
      .next-session-label { font-size: 0.9rem; color: #9ca3af; margin-bottom: 6px; }
      .next-session-info { font-size: 1.1rem; font-weight: 600; color: #60a5fa; }
      .next-session-info span { font-size: 0.9rem; font-weight: 400; opacity: 0.8; }
    `;

    document.documentElement.appendChild(style);
    document.documentElement.appendChild(overlay);

    if (settings.breakCountdown) {
      this.startBreakCountdown(currentTime);
    }
    this.setupOverlayObserver();
  }

  setupOverlayObserver() {
    if (this.observer) this.observer.disconnect();

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.removedNodes) {
          mutation.removedNodes.forEach(node => {
            if (node.id === 'pomodoro-break-overlay') {
              console.log("Break overlay removed, re-injecting...");
              this.breakOverlayVisible = false; // Reset flag to allow recreation
              if (this.currentState) {
                  this.createBreakOverlay(this.currentState);
              }
            }
          });
        }
      }
    });

    this.observer.observe(document.documentElement, { childList: true });
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
    if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
    }

    const overlay = document.getElementById("pomodoro-break-overlay");
    if (overlay) overlay.remove();

    const styles = document.getElementById("pomodoro-break-overlay-styles");
    if (styles) styles.remove();

    if (this.breakCountdownInterval) {
      clearInterval(this.breakCountdownInterval);
      this.breakCountdownInterval = null;
    }
    this.breakOverlayVisible = false;
    this.activeOverlaySettings = {};
  }
}

new BreakEnforcer();