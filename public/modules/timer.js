export class Timer {
  constructor(state, broadcastUpdate, notifyContentScripts, showNotification, recordSession, saveState) {
    this.state = state;
    this.broadcastUpdate = broadcastUpdate;
    this.notifyContentScripts = notifyContentScripts;
    this.showNotification = showNotification;
    this.recordSession = recordSession;
    this.saveState = saveState;
    this.alarmName = "pomodoroTimer";
  }

  async startTimer() {
    this.state.isRunning = true;
    chrome.alarms.create(this.alarmName, { periodInMinutes: 1 / 60 });

    if (this.state.settings.youtubeIntegration && this.state.currentMode === "focus") {
      await this.notifyContentScripts({ type: "TIMER_STARTED" });
    }

    await this.broadcastUpdate();
  }

  async pauseTimer() {
    this.state.isRunning = false;
    chrome.alarms.clear(this.alarmName);

    if (this.state.settings.youtubeIntegration) {
      await this.notifyContentScripts({ type: "TIMER_PAUSED" });
    }

    await this.broadcastUpdate();
  }

  async resetTimer() {
    this.state.isRunning = false;
    chrome.alarms.clear(this.alarmName);

    const timeMap = {
      focus: this.state.settings.focusTime * 60,
      shortBreak: this.state.settings.shortBreak * 60,
      longBreak: this.state.settings.longBreak * 60,
    };

    this.state.currentTime = timeMap[this.state.currentMode];
    await this.broadcastUpdate();
  }

  async skipBreak() {
    this.state.currentMode = "focus";
    this.state.currentTime = this.state.settings.focusTime * 60;
    this.state.isRunning = false;

    await this.notifyContentScripts({ type: "BREAK_SKIPPED" });
    await this.broadcastUpdate();
  }

  async handleTimerTick() {
    if (!this.state.isRunning) {
      chrome.alarms.clear(this.alarmName);
      return;
    }

    if (this.state.currentTime > 0) {
      this.state.currentTime -= 1;
      await this.saveState();
      await this.broadcastUpdate();
    } else {
      await this.handleTimerComplete();
    }
  }

  async handleTimerComplete() {
    this.state.isRunning = false;
    chrome.alarms.clear(this.alarmName);

    if (this.state.settings.notifications) {
      this.showNotification();
    }

    if (this.state.currentMode === "focus") {
      this.state.totalSessions++;
      this.recordSession();
    }

    await this.switchToNextMode();

    if (this.shouldAutoStart()) {
      setTimeout(() => this.startTimer(), 1000);
    }

    await this.saveState();
    await this.broadcastUpdate();
  }

  async switchToNextMode() {
    if (this.state.currentMode === "focus") {
      const isLongBreak = this.state.sessionCount % this.state.settings.sessionsUntilLongBreak === 0;
      this.state.currentMode = isLongBreak ? "longBreak" : "shortBreak";
      this.state.currentTime = isLongBreak
        ? this.state.settings.longBreak * 60
        : this.state.settings.shortBreak * 60;
      this.state.sessionCount++;

      if (this.state.settings.enforceBreaks) {
        this.notifyContentScripts({
          type: "ENFORCE_BREAK",
          mode: this.state.currentMode,
          settings: this.state.settings,
          nextSessionInfo: this.getNextSessionInfo(),
        });
      }
    } else {
      this.state.currentMode = "focus";
      this.state.currentTime = this.state.settings.focusTime * 60;
    }
  }

  getNextSessionInfo() {
    const isLongBreak = this.state.sessionCount % this.state.settings.sessionsUntilLongBreak === 0;
    const sessionsUntilLongBreak = this.state.settings.sessionsUntilLongBreak - (this.state.sessionCount % this.state.settings.sessionsUntilLongBreak);

    return {
      nextMode: "focus",
      nextDuration: this.state.settings.focusTime,
      sessionsUntilLongBreak: sessionsUntilLongBreak,
      isLongBreak: isLongBreak,
    };
  }

  shouldAutoStart() {
    if (!this.state.settings.autoSwitchModes) return false;

    return (
      (this.state.currentMode === "focus" && this.state.settings.autoStartPomodoros) ||
      ((this.state.currentMode === "shortBreak" || this.state.currentMode === "longBreak") && this.state.settings.autoStartBreaks)
    );
  }
}
