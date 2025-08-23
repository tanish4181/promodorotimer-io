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
    // Check if we're on YouTube
    if (!this.isYouTubePage()) {
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

    // Let the background script know the content script has loaded.
    chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_LOADED" });
    
    // Set up mutation observer for dynamic content
    this.setupMutationObserver()
    
    // Set up periodic state refresh
    this.setupPeriodicRefresh()

    // Listen for YouTube's own navigation events for faster updates
    document.addEventListener('yt-navigate-finish', () => {
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
    } catch (error) {
      console.error("Error loading timer state:", error)
      if (error.message?.includes("Extension context invalidated")) {
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
    if (!this.timerState) {
      this.showDistractions() // Show distractions if integration is disabled
      return
    }
    
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
    const settings = this.timerState?.settings || {}
    const mode = settings.youtubeDistractionMode || 'focus'
    if (mode === 'off') return false
    if (mode === 'always') return true

    // Default: only when actively focusing
    return this.timerState?.currentMode === 'focus' && this.timerState?.isRunning
  }

  hideDistractions() {
    if (!this.shouldHideDistractions()) {
      this.showDistractions()
      return
    }

    // Comments
    if (this.timerState.settings.hideYoutubeComments) {
      this.hideComments()
    } else {
      this.showComments()
    }

    // Recommendations
    if (this.timerState.settings.hideYoutubeRecommendations) {
      this.hideRecommendations()
    } else {
      this.showRecommendations()
    }

    // Shorts
    if (this.timerState.settings.hideYoutubeShorts) {
      this.hideShorts()
    } else {
      this.showShorts()
    }
  }

  showDistractions() {
    // Remove all distraction hiding styles
    const existingStyles = document.getElementById('pomodoro-youtube-styles')
    if (existingStyles) {
      existingStyles.remove()
    }
    
    // Show comments
    this.showComments()
    
    // Show sidebar
    this.showRecommendations()
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

  showRecommendations() {
    const sidebar = document.querySelector('#secondary')
    if (sidebar) {
      sidebar.style.display = ''
    }
    const endScreen = document.querySelector('ytd-player ytd-player-end-slot-renderer')
    if (endScreen) {
      endScreen.style.display = ''
    }
    const relatedVideos = document.querySelector('ytd-watch-next-secondary-results-renderer')
    if (relatedVideos) {
      relatedVideos.style.display = ''
    }
  }

  hideShorts() {
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
      ytd-reel-shelf-renderer,
      ytd-rich-section-renderer:has(ytd-reel-shelf-renderer),
      ytd-shelf-renderer:has([is-shorts]),
      ytd-rich-grid-row:has(ytd-rich-item-renderer ytd-thumbnail[is-shorts]),
      
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

  showShorts() {
    const style = document.getElementById('pomodoro-youtube-styles')
    if (style) style.remove()
  }

  showComments() {
    const commentsSection = document.querySelector('ytd-comments, ytd-engagement-panel-section-list-renderer')
    if (commentsSection) {
      commentsSection.style.display = ''
    }
    const commentElements = document.querySelectorAll('ytd-comments, ytd-engagement-panel-section-list-renderer')
    commentElements.forEach(el => {
      el.style.display = ''
    })
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
    switch (message.type) {
      case "TIMER_STARTED":
        await this.loadTimerState()
        this.setupYouTubeIntegration()
        break
        
      case "TIMER_PAUSED":
        await this.loadTimerState()
        this.hideFocusModeIndicator()
        this.showDistractions()
        if (this.breakCountdownInterval) {
          clearInterval(this.breakCountdownInterval);
        }
        break
        
      case "ENFORCE_BREAK":
        await this.loadTimerState()
        this.enforceBreak(message.mode, message.settings, message.nextSessionInfo)
        break
        
      case "BREAK_SKIPPED":
        this.removeBreakOverlay()
        break
        
      case "SETTINGS_UPDATED":
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

          // If the overlay is visible, update the countdown
          if (this.overlayElement && isBreak) {
            this.updateBreakCountdown(this.timerState.currentTime);
          }
        }
        break

      case "PAUSE_ALL_YOUTUBE_TABS":
        this.pauseYouTubeVideo();
        break
        
      default:
    }
  }

  enforceBreak(mode, settings, nextSessionInfo) {
    if (!settings.breakOverlay) {
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
      </div>
    `
    
    this.overlayElement.innerHTML = overlayContent

    document.body.appendChild(this.overlayElement)


    this.overlayElement.addEventListener('keydown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    this.overlayElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    // Start countdown if enabled
    if (settings.breakCountdown) {
      this.startBreakCountdown()
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
