// YouTube Content Script for Pomodoro Timer Chrome Extension

class YouTubeIntegration {
  constructor() {
    this.timerState = null
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
    console.log("Initializing YouTube integration")
    
    // Check if we're on YouTube
    if (!this.isYouTubePage()) {
      console.log("Not on YouTube, skipping integration")
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
      console.log('YouTube navigation finished, re-running setup.');
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
      console.log("Timer state loaded:", this.timerState)
    } catch (error) {
      console.error("Error loading timer state:", error)
      if (error.message?.includes("Extension context invalidated")) {
        console.log("Context invalidated, reloading page to re-establish connection.");
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
      console.log("YouTube integration disabled")
      this.showDistractions() // Show distractions if integration is disabled
      return
    }

    console.log("Setting up YouTube integration")
    
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
        console.log("New content detected, updating distractions")
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
    const settings = this.timerState?.settings || {};

    // Master switch is the ultimate gatekeeper.
    if (!settings.hideDistractions) {
        return false;
    }

    const mode = settings.youtubeDistractionMode || 'focus';
    if (mode === 'off') return false;
    if (mode === 'always') return true;

    // Default 'focus' mode: only hide when timer is running in focus mode.
    return this.timerState?.currentMode === 'focus' && this.timerState?.isRunning;
  }

  hideDistractions() {
    console.log("Hiding YouTube distractions");

    // Comments
    if (this.timerState.settings.hideYoutubeComments) {
      this.hideComments();
    } else {
      this.showComments();
    }

    // Recommendations
    if (this.timerState.settings.hideYoutubeRecommendations) {
      this.hideRecommendations();
    } else {
      this.showRecommendations();
    }

    // Shorts
    if (this.timerState.settings.hideYoutubeShorts) {
      this.hideShorts();
    } else {
      this.showShorts();
    }
  }

  showDistractions() {
    console.log("Showing YouTube distractions");
    this.showComments();
    this.showRecommendations();
    this.showShorts();
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
    // Hide sidebar recommendations, targeting only the results renderer
    const recommendations = document.querySelector('ytd-watch-next-secondary-results-renderer');
    if (recommendations) {
      recommendations.style.display = 'none';
    }
    
    // Hide end screen recommendations
    const endScreen = document.querySelector('.videowall-endscreen');
    if (endScreen) {
      endScreen.style.display = 'none';
    }
  }

  showRecommendations() {
    // Show sidebar recommendations
    const recommendations = document.querySelector('ytd-watch-next-secondary-results-renderer');
    if (recommendations) {
      recommendations.style.display = '';
    }

    // Show end screen recommendations
    const endScreen = document.querySelector('.videowall-endscreen');
    if (endScreen) {
      endScreen.style.display = '';
    }
  }

  hideShorts() {
    console.log("Hiding all YouTube Shorts with enhanced selectors")

    const styleId = 'pomodoro-youtube-styles';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      if (document.head) {
        document.head.appendChild(style);
      }
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
    const commentElements = document.querySelectorAll('ytd-comments, ytd-engagement-panel-section-list-renderer');
    commentElements.forEach(el => {
      el.style.display = '';
    });
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
    if (document.body) {
      document.body.appendChild(indicator)
    }
  }

  hideFocusModeIndicator() {
    const indicator = document.getElementById('pomodoro-focus-indicator')
    if (indicator) {
      indicator.remove()
    }
  }

  async handleMessage(message, sender, sendResponse) {
    console.log("YouTube content script received message:", message.type)
    
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
        
      case "SETTINGS_UPDATED":
        console.log("Settings updated, reloading timer state")
        await this.loadTimerState()
        this.setupYouTubeIntegration()
        break
        
      case "TIMER_UPDATE":
        // Update local state with new timer state
        if (message.state) {
          this.timerState = message.state;
          this.setupYouTubeIntegration();
        }
        break

      case "PAUSE_ALL_YOUTUBE_TABS":
        this.pauseYouTubeVideo();
        break
        
      default:
        console.log("Unknown message type:", message.type)
    }
  }

  pauseYouTubeVideo() {
    const video = document.querySelector('video')
    if (video && !video.paused) {
      video.pause()
      console.log("YouTube video paused")
    }
  }
}

// Initialize YouTube integration
new YouTubeIntegration()

