// Generic Break Overlay Content Script

class BreakOverlay {
  constructor() {
    this.overlayElement = null;
    this.breakCountdownInterval = null;
    this.timerState = null;

    this.initialize();
  }

  async initialize() {
    // Load timer state
    await this.loadTimerState();

    // Set up message listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });

    // Let the background script know the content script has loaded.
    chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_LOADED" });
  }

  async loadTimerState() {
    try {
      const result = await chrome.storage.local.get(['timerState', 'currentTime', 'isRunning', 'currentMode', 'settings']);
      this.timerState = {
        timerState: result.timerState || 'focus',
        currentTime: result.currentTime || 25 * 60,
        isRunning: result.isRunning || false,
        currentMode: result.currentMode || 'focus',
        settings: result.settings || {}
      };
    } catch (error) {
      console.error("Error loading timer state:", error);
      if (error.message?.includes("Extension context invalidated")) {
        window.location.reload();
      }
    }
  }

  async handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case "ENFORCE_BREAK":
        await this.loadTimerState();
        this.enforceBreak(message.mode, message.settings, message.nextSessionInfo);
        break;
      case "BREAK_SKIPPED":
        this.removeBreakOverlay();
        break;
      case "TIMER_UPDATE":
        if (message.state) {
          this.timerState = message.state;
          const isBreak = this.timerState.currentMode === 'shortBreak' || this.timerState.currentMode === 'longBreak';
          if (!isBreak && this.overlayElement) {
            this.removeBreakOverlay();
          }
          if (this.overlayElement && isBreak) {
            this.updateBreakCountdown(this.timerState.currentTime);
          }
        }
        break;
    }
  }

  enforceBreak(mode, settings, nextSessionInfo) {
    if (!settings.enforceBreaks) {
      return;
    }
    if (!settings.breakOverlay) {
      return;
    }
    this.showBreakOverlay(mode, settings, nextSessionInfo);
  }

  showBreakOverlay(mode, settings, nextSessionInfo) {
    this.removeBreakOverlay();

    this.overlayElement = document.createElement('div');
    this.overlayElement.id = 'pomodoro-break-overlay';

    let overlayContent = `
      <div class="pomodoro-overlay-content">
        <h1>${mode === "shortBreak" ? "Short Break" : "Long Break"}</h1>
        <p>
          It's time to relax and recharge. Take a moment away from your screen.
        </p>
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

    overlayContent += `
      </div>
    `;

    this.overlayElement.innerHTML = overlayContent;
    document.body.appendChild(this.overlayElement);

    if (settings.breakCountdown) {
      this.startBreakCountdown();
    }
  }

  updateBreakCountdown(currentTime) {
    const countdownElement = document.getElementById("break-countdown-timer");
    if (!countdownElement) return;

    const minutes = Math.floor(currentTime / 60);
    const seconds = currentTime % 60;
    countdownElement.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  startBreakCountdown() {
    if (this.breakCountdownInterval) {
      clearInterval(this.breakCountdownInterval);
    }
    this.updateBreakCountdown(this.timerState.currentTime);
  }

  removeBreakOverlay() {
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
    }
    if (this.breakCountdownInterval) {
      clearInterval(this.breakCountdownInterval);
      this.breakCountdownInterval = null;
    }
  }
}

new BreakOverlay();
