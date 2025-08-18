export class Settings {
  constructor(state, broadcastUpdate, broadcastSettingsUpdate) {
    this.state = state;
    this.broadcastUpdate = broadcastUpdate;
    this.broadcastSettingsUpdate = broadcastSettingsUpdate;
  }

  async updateSettings(newSettings) {
    console.log("[v1][Settings] Updating settings in background:", newSettings);

    // Merge new settings with existing settings
    this.state.settings = { ...this.state.settings, ...newSettings };

    // Update current time if timer is not running and we're in focus mode
    if (!this.state.isRunning && this.state.currentMode === "focus") {
      this.state.currentTime = this.state.settings.focusTime * 60;
    }

    console.log("[v1][Settings] Settings updated successfully:", this.state.settings);

    // Broadcast update to all connected clients
    this.broadcastUpdate();
    this.broadcastSettingsUpdate();
  }
}
