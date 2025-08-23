class BreakEnforcer {
  constructor() {
    this.breakOverlayVisible = false;
    this.breakCountdownInterval = null;
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "TIMER_UPDATE") {
        this.handleBreakOverlay(message.state);
      }
      return true;
    });

    // It's also a good idea to check the state when the script is first injected
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
      } else if (response && response.state) {
        this.handleBreakOverlay(response.state);
      }
    });
  }

  handleBreakOverlay(state) {
    const { currentMode, isRunning, settings } = state;
    const isBreak = currentMode === 'shortBreak' || currentMode === 'longBreak';
    // The key change: The setting is now breakOverlayEnabled
    const shouldShowOverlay = isRunning && isBreak && settings.breakOverlayEnabled;

    if (shouldShowOverlay && !this.breakOverlayVisible) {
      this.createBreakOverlay(state);
    } else if (!shouldShowOverlay && this.breakOverlayVisible) {
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
}

new BreakEnforcer();
