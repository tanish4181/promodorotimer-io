export class Settings {
  constructor(state, broadcastUpdate, broadcastSettingsUpdate) {
    this.state = state;
    this.broadcastUpdate = broadcastUpdate;
    this.broadcastSettingsUpdate = broadcastSettingsUpdate;
  }

  async updateSettings(newSettings) {
    // Merge new settings with existing settings
    this.state.settings = { ...this.state.settings, ...newSettings };

    // Update current time if timer is not running and we're in focus mode
    if (!this.state.isRunning && this.state.currentMode === "focus") {
      this.state.currentTime = this.state.settings.focusTime * 60;
    }

    // Broadcast update to all connected clients
    await this.broadcastUpdate();
    await this.broadcastSettingsUpdate();
  }
}
