export class Stats {
  constructor(state) {
    this.state = state;
  }

  async recordSession() {
    if (!this.state.settings.collectStats) return;

    const today = new Date().toISOString().split("T")[0];

    try {
      const result = await chrome.storage.local.get("dailyStats");
      const dailyStats = result.dailyStats || {};

      if (!dailyStats[today]) {
        dailyStats[today] = {
          focusSessions: 0,
          focusTime: 0,
          breakTime: 0,
        };
      }

      dailyStats[today].focusSessions++;
      dailyStats[today].focusTime += this.state.settings.focusTime;

      await chrome.storage.local.set({ dailyStats });
    } catch (error) {
      console.error("[v1][stats] Error recording session:", error);
    }
  }
}
