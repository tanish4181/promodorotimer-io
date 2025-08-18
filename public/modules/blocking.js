export class Blocking {
  constructor(state, broadcastUpdate) {
    this.state = state;
    this.broadcastUpdate = broadcastUpdate;
  }

  _isUrlInList(url, list) {
    if (!url || !list || list.length === 0) {
      return false;
    }
    try {
      const urlHostname = new URL(url).hostname.toLowerCase();
      for (const domain of list) {
        const lowerCaseDomain = domain.toLowerCase();
        if (urlHostname === lowerCaseDomain || urlHostname.endsWith(`.${lowerCaseDomain}`)) {
          return true;
        }
      }
    } catch (error) {
      console.error(`[v1][Blocking] Invalid URL format for blocking check: ${url}`, error);
      return false;
    }
    return false;
  }

  isUrlBlocked(url) {
    const { settings, allowedWebsites, blockedWebsites, isRunning, currentMode } = this.state;

    if (!settings.websiteBlocking) {
      return false;
    }

    if (this._isUrlInList(url, allowedWebsites)) {
      return false;
    }

    if (isRunning) {
      if (currentMode === 'focus') {
        return true;
      }
      if (currentMode === 'shortBreak' || currentMode === 'longBreak') {
        if (settings.enforceBreaks) {
            return this._isUrlInList(url, blockedWebsites);
        }
        return false;
      }
    }

    return this._isUrlInList(url, blockedWebsites);
  }

  async addBlockedWebsite(website) {
    if (!this.state.blockedWebsites.includes(website)) {
      this.state.blockedWebsites.push(website);
      this.broadcastUpdate();
      console.log("[v1][Blocking] Website blocked:", website);
    }
  }

  async removeBlockedWebsite(website) {
    this.state.blockedWebsites = this.state.blockedWebsites.filter(
      (w) => w !== website
    );
    this.broadcastUpdate();
    console.log("[v1][Blocking] Website unblocked:", website);
  }
}
