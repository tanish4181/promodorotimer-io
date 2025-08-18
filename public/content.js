// YouTube Content Script for Pomodoro Timer Chrome Extension

class YouTubeIntegration {
  constructor() {
    this.timerState = null
    this.overlayElement = null
    this.breakCountdownInterval = null
    this.distractionSettings = {
      hideComments: "hideYoutubeComments",
      hideRecommendations: "hideYoutubeRecommendations", 
      hideShorts: "hideYoutubeShorts"
    }
    this.shortsSelectors = [
      // Home page shorts
      'ytd-rich-grid-renderer ytd-rich-item-renderer:has(ytd-thumbnail[is-shorts])',
      'ytd-rich-grid-renderer ytd-rich-item-renderer:has(a[href*="/shorts/"])',
      // Search results shorts
      'ytd-search ytd-video-renderer:has(a[href*="/shorts/"])',
      'ytd-search ytd-video-renderer:has(ytd-thumbnail[is-shorts])',
      // Channel page shorts
      'ytd-channel-renderer ytd-grid-video-renderer:has(a[href*="/shorts/"])',
      // Sidebar shorts
      'ytd-guide-entry-renderer:has(a[href*="/shorts/"])',
      // Shorts shelf
      'ytd-reel-shelf-renderer',
      'ytd-rich-section-renderer:has(ytd-reel-shelf-renderer)',
      // Shorts button in sidebar
      'ytd-guide-entry-renderer:has(a[href="/shorts"])',
      // Shorts tab
      'ytd-tab:has(a[href*="/shorts/"])',
      // Any element with shorts in URL
      '[href*="/shorts/"]',
      // Shorts video player
      'ytd-shorts',
      // Shorts navigation
      'ytd-mini-guide-entry-renderer:has(a[href="/shorts"])'
    ]
    
    this.initialize()
  }

  async initialize() {
    console.log("[v0] Initializing YouTube integration")
    
    // Check if we're on YouTube
    if (!this.isYouTubePage()) {
      console.log("[v0] Not on YouTube, skipping integration")
      return
    }

    // Load timer state
    await this.loadTimerState()
    
    // Set up message listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse)
    })

    // Initial setup
    this.setupYouTubeIntegration()
    
    // Set up mutation observer for dynamic content
    this.setupMutationObserver()
    
    // Set up periodic state refresh
    this.setupPeriodicRefresh()

    // Listen for YouTube's own navigation events for faster updates
    document.addEventListener('yt-navigate-finish', () => {
      console.log('[v0] YouTube navigation finished, re-running setup.');
      this.setupYouTubeIntegration();
    });
  }

  isYouTubePage() {
    return window.location.hostname.includes('youtube.com') || window.location.hostname.includes('youtu.be')
  }

  async loadTimerState() {
    try {
      const result = await chrome.storage.local.get(['timerState', 'currentTime', 'isRunning', 'currentMode', 'settings'])
      this.timerState = {
        timerState: result.timerState || 'focus',
        currentTime: result.currentTime || 25 * 60,
        isRunning: result.isRunning || false,
        currentMode: result.currentMode || 'focus',
        settings: result.settings || {}
      }
      console.log("[v0] Timer state loaded:", this.timerState)
    } catch (error) {
      console.error("[v0] Error loading timer state:", error)
      if (error.message?.includes("Extension context invalidated")) {
        console.log("[ContentScript] Context invalidated, reloading page to re-establish connection.");
        window.location.reload();
      }
    }
  }

  setupPeriodicRefresh() {
    // Refresh timer state every 5 seconds to stay in sync
    setInterval(async () => {
      await this.loadTimerState()
      this.setupYouTubeIntegration()
    }, 5000)
  }

  setupYouTubeIntegration() {
    if (!this.timerState || !this.timerState.settings.youtubeIntegration) {
      console.log("[v0] YouTube integration disabled")
      this.showDistractions() // Show distractions if integration is disabled
      return
    }

    console.log("[v0] Setting up YouTube integration")
    
    // Apply distraction hiding based on current state
    if (this.shouldHideDistractions()) {
      this.hideDistractions()
    } else {
      this.showDistractions()
    }
    
    // Show focus indicator if enabled and in focus mode
    if (this.timerState.settings.focusIndicator && this.timerState.currentMode === 'focus' && this.timerState.isRunning) {
      this.showFocusModeIndicator()
    } else {
      this.hideFocusModeIndicator()
    }
  }

  setupMutationObserver() {
    // Watch for dynamic content changes
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if new nodes contain distractions
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (this.containsDistractions(node)) {
                shouldUpdate = true
              }
            }
          })
        }
      })
      
      if (shouldUpdate) {
        console.log("[v0] New content detected, updating distractions")
        setTimeout(() => {
          if (this.shouldHideDistractions()) {
            this.hideDistractions()
          }
        }, 100)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  }

  containsDistractions(node) {
    // Check if the node or its children contain distraction elements
    const selectors = [
      'ytd-comments',
      'ytd-rich-grid-renderer',
      'ytd-reel-shelf-renderer',
      '[href*="/shorts/"]',
      'ytd-guide-entry-renderer'
    ]
    
    return selectors.some(selector => {
      return node.matches?.(selector) || node.querySelector?.(selector)
    })
  }

  shouldHideDistractions() {
    if (!this.timerState?.settings?.hideDistractions) {
      return false;
    }

    if (this.timerState.settings.youtubeHidingCondition === 'always') {
      return true;
    }

    // Default 'on-timer' behavior
    return this.timerState?.currentMode === 'focus' && this.timerState?.isRunning;
  }

  hideDistractions() {
    if (!this.shouldHideDistractions()) {
      this.showDistractions()
      return
    }

    console.log("[v0] Hiding YouTube distractions")

    // Hide comments
    if (this.timerState.settings.hideYoutubeComments) {
      this.hideComments()
    }

    // Hide recommendations
    if (this.timerState.settings.hideYoutubeRecommendations) {
      this.hideRecommendations()
    }

    // Hide Shorts completely
    if (this.timerState.settings.hideYoutubeShorts) {
      this.hideShorts()
    }
  }

  showDistractions() {
    console.log("[v0] Showing YouTube distractions")
    
    // Remove all distraction hiding styles
    const existingStyles = document.getElementById('pomodoro-youtube-styles')
    if (existingStyles) {
      existingStyles.remove()
    }
    
    // Show comments
    const commentsSection = document.querySelector('ytd-comments')
    if (commentsSection) {
      commentsSection.style.display = ''
    }
    
    // Show sidebar
    const sidebar = document.querySelector('#secondary')
    if (sidebar) {
      sidebar.style.display = ''
    }
  }

  hideComments() {
    const commentsSection = document.querySelector('ytd-comments')
    if (commentsSection) {
      commentsSection.style.display = 'none'
    }
    
    // Also hide comment sections in video descriptions
    const commentElements = document.querySelectorAll('ytd-comments, ytd-engagement-panel-section-list-renderer')
    commentElements.forEach(el => {
      el.style.display = 'none'
    })
  }

  hideRecommendations() {
    // Hide sidebar recommendations
    const sidebar = document.querySelector('#secondary')
    if (sidebar) {
      sidebar.style.display = 'none'
    }
    
    // Hide end screen recommendations
    const endScreen = document.querySelector('ytd-player ytd-player-end-slot-renderer')
    if (endScreen) {
      endScreen.style.display = 'none'
    }
    
    // Hide related videos
    const relatedVideos = document.querySelector('ytd-watch-next-secondary-results-renderer')
    if (relatedVideos) {
      relatedVideos.style.display = 'none'
    }
  }

  hideShorts() {
    console.log("[v0] Hiding all YouTube Shorts with enhanced selectors")

    const styleId = 'pomodoro-youtube-styles';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    
    style.textContent = `
      /* General catch-all for any element linking to shorts */
      a[href*="/shorts/"],

      /* Shorts tab in main navigation sidebar */
      ytd-guide-entry-renderer:has(a[title="Shorts"]),
      
      /* Shorts shelf on home page and other pages */
      ytd-rich-shelf-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]),
      
      /* Individual shorts videos in grids (home page, search, etc.) */
      ytd-rich-item-renderer:has(a[href*="/shorts/"]),
      ytd-grid-video-renderer:has(a[href*="/shorts/"]),
      ytd-video-renderer:has(a[href*="/shorts/"]),

      /* Shorts in 'Up next' recommendations on watch page */
      ytd-compact-video-renderer:has(a[href*="/shorts/"]),

      /* The entire Shorts player UI */
      ytd-shorts,
      ytd-reel-video-renderer,

      /* Mini-player for shorts */
      ytd-miniplayer[miniplayer-active] ytd-reel-video-renderer {
        display: none !important;
      }
    `;
  }

  showFocusModeIndicator() {
    // Create focus mode indicator
    const indicator = document.createElement('div')
    indicator.id = 'pomodoro-focus-indicator'
    indicator.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #059669;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <span>🍅</span>
        <span>Focus Mode</span>
      </div>
    `
    
    // Remove existing indicator and add new one
    const existingIndicator = document.getElementById('pomodoro-focus-indicator')
    if (existingIndicator) {
      existingIndicator.remove()
    }
    document.body.appendChild(indicator)
  }

  hideFocusModeIndicator() {
    const indicator = document.getElementById('pomodoro-focus-indicator')
    if (indicator) {
      indicator.remove()
    }
  }

  async handleMessage(message, sender, sendResponse) {
    console.log("[v0] YouTube content script received message:", message.type)
    
    switch (message.type) {
      case "TIMER_STARTED":
        await this.loadTimerState()
        this.setupYouTubeIntegration()
        break
        
      case "TIMER_PAUSED":
        await this.loadTimerState()
        this.hideFocusModeIndicator()
        this.showDistractions()
        break
        
      case "ENFORCE_BREAK":
        await this.loadTimerState()
        this.enforceBreak(message.mode, message.settings, message.nextSessionInfo)
        break
        
      case "BREAK_SKIPPED":
        this.removeBreakOverlay()
        break
        
      case "SETTINGS_UPDATED":
        console.log("[v0] Settings updated, reloading timer state")
        await this.loadTimerState()
        this.setupYouTubeIntegration()
        break
        
      case "TIMER_UPDATE":
        // Update local state with new timer state
        if (message.state) {
          this.timerState = message.state;
          this.setupYouTubeIntegration();

          // If the mode is no longer a break, ensure the overlay is removed.
          const isBreak = this.timerState.currentMode === 'shortBreak' || this.timerState.currentMode === 'longBreak';
          if (!isBreak && this.overlayElement) {
            this.removeBreakOverlay();
          }
        }
        break
        
      default:
        console.log("[v0] Unknown message type:", message.type)
    }
  }

  enforceBreak(mode, settings, nextSessionInfo) {
    console.log("[v0] Enforcing break:", mode)
    
    if (!settings.breakOverlay) {
      console.log("[v0] Break overlay disabled")
      return
    }

    // Pause YouTube video if enabled
    if (settings.pauseYoutubeBreaks) {
      this.pauseYouTubeVideo()
    }

    // Show break overlay
    this.showBreakOverlay(mode, settings, nextSessionInfo)
  }

  pauseYouTubeVideo() {
    const video = document.querySelector('video')
    if (video && !video.paused) {
      video.pause()
      console.log("[v0] YouTube video paused")
    }
  }

  showBreakOverlay(mode, settings, nextSessionInfo) {
    // Remove existing overlay
    this.removeBreakOverlay()

    // Create overlay
    this.overlayElement = document.createElement('div')
    this.overlayElement.id = 'pomodoro-break-overlay'
    
    let overlayContent = `
      <div class="pomodoro-overlay-content">
        <div class="pomodoro-overlay-icon">
          ${mode === "shortBreak" ? "☕" : "🏖️"}
        </div>
        <h1>${mode === "shortBreak" ? "Short Break" : "Long Break"}</h1>
        <p>
          It's time to relax and recharge. Take a moment away from your screen.
        </p>
    `
    
    if (settings.breakCountdown) {
      overlayContent += `
        <div class="pomodoro-countdown">
          <div class="countdown-label">Break ends in:</div>
          <div class="countdown-timer" id="break-countdown-timer">--:--</div>
        </div>
      `
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
      `
    }
    
    overlayContent += `
        <div class="pomodoro-overlay-actions">
          <button id="pomodoro-skip-break" class="pomodoro-btn pomodoro-btn-secondary">
            Skip Break
          </button>
          <button id="pomodoro-start-focus" class="pomodoro-btn pomodoro-btn-primary">
            Start Focus Now
          </button>
        </div>
      </div>
    `
    
    this.overlayElement.innerHTML = overlayContent

    // Add styles
    const style = document.createElement('style')
    style.textContent = `
      #pomodoro-break-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.95);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .pomodoro-overlay-content {
        text-align: center;
        color: white;
        max-width: 500px;
        padding: 40px;
      }
      
      .pomodoro-overlay-icon {
        font-size: 4rem;
        margin-bottom: 20px;
      }
      
      .pomodoro-overlay-content h1 {
        font-size: 2.5rem;
        margin-bottom: 16px;
        color: #059669;
      }
      
      .pomodoro-overlay-content p {
        font-size: 1.2rem;
        margin-bottom: 30px;
        line-height: 1.6;
        color: #d1d5db;
      }
      
      .pomodoro-countdown {
        margin: 30px 0;
        padding: 20px;
        background: rgba(5, 150, 105, 0.1);
        border-radius: 12px;
        border: 1px solid rgba(5, 150, 105, 0.3);
      }
      
      .countdown-label {
        font-size: 1rem;
        color: #9ca3af;
        margin-bottom: 8px;
      }
      
      .countdown-timer {
        font-size: 2.5rem;
        font-weight: 700;
        color: #059669;
        font-family: monospace;
      }
      
      .pomodoro-next-session {
        margin: 20px 0;
        padding: 16px;
        background: rgba(59, 130, 246, 0.1);
        border-radius: 8px;
        border: 1px solid rgba(59, 130, 246, 0.3);
      }
      
      .next-session-label {
        font-size: 0.9rem;
        color: #9ca3af;
        margin-bottom: 4px;
      }
      
      .next-session-info {
        font-size: 1.1rem;
        color: #3b82f6;
      }
      
      .next-duration {
        font-weight: 600;
      }
      
      .next-sessions-until-long {
        font-size: 0.9rem;
        opacity: 0.8;
      }
      
      .pomodoro-overlay-actions {
        display: flex;
        gap: 16px;
        justify-content: center;
        margin-top: 30px;
      }
      
      .pomodoro-btn {
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 120px;
      }
      
      .pomodoro-btn-primary {
        background: #059669;
        color: white;
      }
      
      .pomodoro-btn-primary:hover {
        background: #047857;
        transform: translateY(-1px);
      }
      
      .pomodoro-btn-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
      }
      
      .pomodoro-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: translateY(-1px);
      }
    `
    
    document.head.appendChild(style)
    document.body.appendChild(this.overlayElement)

    // Add event listeners using event delegation
    this.overlayElement.addEventListener('click', (e) => {
      const target = e.target
      
      if (target.id === 'pomodoro-skip-break' || target.id === 'pomodoro-start-focus') {
        chrome.runtime.sendMessage({ type: "SKIP_BREAK" })
      }
    })

    // Start countdown if enabled
    if (settings.breakCountdown) {
      this.startBreakCountdown()
    }
    
    console.log("[v0] Break overlay displayed")
  }

  startBreakCountdown() {
    if (this.breakCountdownInterval) {
      clearInterval(this.breakCountdownInterval)
    }
    
    const countdownElement = document.getElementById("break-countdown-timer")
    if (!countdownElement) return
    
    const breakDuration = this.timerState.currentMode === "longBreak" 
      ? this.timerState.settings.longBreak * 60 
      : this.timerState.settings.shortBreak * 60
    
    let timeLeft = breakDuration
    
    const updateCountdown = () => {
      const minutes = Math.floor(timeLeft / 60)
      const seconds = timeLeft % 60
      countdownElement.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      timeLeft--
      
      if (timeLeft < 0) {
        clearInterval(this.breakCountdownInterval)
        countdownElement.textContent = "00:00"
      }
    }
    
    updateCountdown()
    this.breakCountdownInterval = setInterval(updateCountdown, 1000)
  }

  removeBreakOverlay() {
    if (this.overlayElement) {
      this.overlayElement.remove()
      this.overlayElement = null
    }
    
    if (this.breakCountdownInterval) {
      clearInterval(this.breakCountdownInterval)
      this.breakCountdownInterval = null
    }
    
    // Remove overlay styles
    const overlayStyles = document.querySelector('style')
    if (overlayStyles && overlayStyles.textContent.includes('#pomodoro-break-overlay')) {
      overlayStyles.remove()
    }
  }
}

// Initialize YouTube integration
new YouTubeIntegration()
