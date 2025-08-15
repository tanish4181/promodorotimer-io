// Content Script for YouTube Integration - Pomodoro Timer Chrome Extension
const chrome = window.chrome // Declare the chrome variable

class YouTubeIntegration {
  constructor() {
    this.isVideoPlaying = false
    this.wasPlayingBeforePause = false
    this.currentVideo = null
    this.notificationElement = null
    this.overlayElement = null
    this.timerState = null

    this.initializeIntegration()
  }

  initializeIntegration() {
    // Wait for YouTube to load
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setupIntegration())
    } else {
      this.setupIntegration()
    }
  }

  setupIntegration() {
    // Set up message listener for background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message)
      sendResponse({ success: true })
    })

    // Monitor video state changes
    this.observeVideoChanges()

    // Get initial timer state
    this.requestTimerState()

    console.log("[v0] YouTube Pomodoro integration initialized")
  }

  async requestTimerState() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_STATE" })
      if (response && response.state) {
        this.timerState = response.state
        this.handleTimerStateChange()
      }
    } catch (error) {
      console.error("[v0] Error requesting timer state:", error)
    }
  }

  handleMessage(message) {
    console.log("[v0] Received message:", message.type)

    switch (message.type) {
      case "TIMER_STARTED":
        this.handleTimerStart()
        break

      case "TIMER_PAUSED":
        this.handleTimerPause()
        break

      case "ENFORCE_BREAK":
        this.enforceBreak(message.mode)
        break

      case "BREAK_SKIPPED":
        this.removeBreakOverlay()
        break

      case "TIMER_UPDATE":
        this.timerState = message.state
        this.handleTimerStateChange()
        break
    }
  }

  observeVideoChanges() {
    // Use MutationObserver to detect when videos change
    const observer = new MutationObserver(() => {
      this.findCurrentVideo()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Also check periodically
    setInterval(() => {
      this.findCurrentVideo()
      this.checkVideoPlayState()
    }, 2000)

    // Initial check
    this.findCurrentVideo()
  }

  findCurrentVideo() {
    const video = document.querySelector("video")
    if (video && video !== this.currentVideo) {
      this.currentVideo = video
      this.setupVideoListeners()
      console.log("[v0] Found new video element")
    }
  }

  setupVideoListeners() {
    if (!this.currentVideo) return

    this.currentVideo.addEventListener("play", () => {
      this.isVideoPlaying = true
      console.log("[v0] Video started playing")
    })

    this.currentVideo.addEventListener("pause", () => {
      this.isVideoPlaying = false
      console.log("[v0] Video paused")
    })

    this.currentVideo.addEventListener("ended", () => {
      this.isVideoPlaying = false
      console.log("[v0] Video ended")
    })
  }

  checkVideoPlayState() {
    if (this.currentVideo) {
      this.isVideoPlaying = !this.currentVideo.paused
    }
  }

  handleTimerStart() {
    if (this.timerState && this.timerState.currentMode === "focus") {
      this.showNotification("🍅 Focus time started! YouTube will pause during breaks.", "info")

      // If we're in a break and starting focus, resume video if it was playing
      if (this.wasPlayingBeforePause && this.currentVideo) {
        this.currentVideo.play().catch((e) => console.log("[v0] Could not resume video:", e))
        this.wasPlayingBeforePause = false
      }
    }
  }

  handleTimerPause() {
    this.showNotification("⏸️ Timer paused", "info")
  }

  handleTimerStateChange() {
    if (!this.timerState) return

    // Handle break modes
    if (this.timerState.currentMode === "shortBreak" || this.timerState.currentMode === "longBreak") {
      if (this.timerState.settings && this.timerState.settings.enforceBreaks) {
        // Don't pause immediately, let the break enforcement overlay handle it
        return
      } else {
        // Gentle break suggestion without pausing
        this.showNotification("☕ Break time! Consider taking a short break.", "break")
      }
    }
  }

  enforceBreak(mode) {
    console.log("[v0] Enforcing break mode:", mode)

    // Pause video if playing
    if (this.currentVideo && this.isVideoPlaying) {
      this.wasPlayingBeforePause = true
      this.currentVideo.pause()
      console.log("[v0] Paused video for break enforcement")
    }

    // Show break overlay
    this.showBreakOverlay(mode)

    // Show notification
    const message =
      mode === "longBreak"
        ? "🌟 Long break time! Step away from the screen."
        : "☕ Short break time! Rest your eyes and mind."
    this.showNotification(message, "break")
  }

  showBreakOverlay(mode) {
    // Remove existing overlay
    this.removeBreakOverlay()

    // Create overlay element
    this.overlayElement = document.createElement("div")
    this.overlayElement.id = "pomodoro-break-overlay"
    this.overlayElement.innerHTML = `
      <div class="pomodoro-overlay-content">
        <div class="pomodoro-overlay-icon">
          ${mode === "longBreak" ? "🌟" : "☕"}
        </div>
        <h2 class="pomodoro-overlay-title">
          ${mode === "longBreak" ? "Long Break Time!" : "Break Time!"}
        </h2>
        <p class="pomodoro-overlay-message">
          ${
            mode === "longBreak"
              ? "Take a longer break to recharge. Walk around, stretch, or grab a snack!"
              : "Take a short break to rest your eyes and mind."
          }
        </p>
        <div class="pomodoro-overlay-actions">
          <button id="pomodoro-skip-break" class="pomodoro-btn pomodoro-btn-secondary">
            Skip Break
          </button>
          <button id="pomodoro-start-break" class="pomodoro-btn pomodoro-btn-primary">
            Start Break
          </button>
        </div>
      </div>
    `

    // Add styles
    this.overlayElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(31, 41, 55, 0.95);
      backdrop-filter: blur(8px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white;
    `

    // Add content styles
    const style = document.createElement("style")
    style.textContent = `
      .pomodoro-overlay-content {
        text-align: center;
        max-width: 400px;
        padding: 40px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .pomodoro-overlay-icon {
        font-size: 64px;
        margin-bottom: 20px;
      }
      
      .pomodoro-overlay-title {
        font-size: 28px;
        font-weight: 600;
        margin-bottom: 16px;
        color: white;
      }
      
      .pomodoro-overlay-message {
        font-size: 16px;
        line-height: 1.5;
        margin-bottom: 32px;
        color: rgba(255, 255, 255, 0.8);
      }
      
      .pomodoro-overlay-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
      }
      
      .pomodoro-btn {
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .pomodoro-btn-primary {
        background: #8b5cf6;
        color: white;
      }
      
      .pomodoro-btn-primary:hover {
        background: #7c3aed;
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

    // Add event listeners
    document.getElementById("pomodoro-skip-break").addEventListener("click", () => {
      this.skipBreak()
    })

    document.getElementById("pomodoro-start-break").addEventListener("click", () => {
      this.startBreak()
    })

    console.log("[v0] Break overlay displayed")
  }

  removeBreakOverlay() {
    if (this.overlayElement) {
      this.overlayElement.remove()
      this.overlayElement = null
      console.log("[v0] Break overlay removed")
    }
  }

  async skipBreak() {
    try {
      await chrome.runtime.sendMessage({ type: "SKIP_BREAK" })
      this.removeBreakOverlay()

      // Resume video if it was playing
      if (this.wasPlayingBeforePause && this.currentVideo) {
        this.currentVideo.play().catch((e) => console.log("[v0] Could not resume video:", e))
        this.wasPlayingBeforePause = false
      }

      this.showNotification("⏭️ Break skipped. Back to focus!", "info")
    } catch (error) {
      console.error("[v0] Error skipping break:", error)
    }
  }

  async startBreak() {
    this.removeBreakOverlay()
    this.showNotification("☕ Break started. Enjoy your rest!", "break")

    // Start the break timer
    try {
      await chrome.runtime.sendMessage({ type: "START_TIMER" })
    } catch (error) {
      console.error("[v0] Error starting break timer:", error)
    }
  }

  showNotification(message, type = "info") {
    // Remove existing notification
    this.removeNotification()

    // Create notification element
    this.notificationElement = document.createElement("div")
    this.notificationElement.id = "pomodoro-notification"
    this.notificationElement.textContent = message

    // Style the notification
    const bgColors = {
      info: "rgba(139, 92, 246, 0.9)",
      break: "rgba(52, 211, 153, 0.9)",
      warning: "rgba(251, 191, 36, 0.9)",
    }

    this.notificationElement.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColors[type] || bgColors.info};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 999998;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(8px);
      max-width: 300px;
      animation: pomodoroSlideIn 0.3s ease-out;
    `

    // Add animation keyframes
    if (!document.getElementById("pomodoro-notification-styles")) {
      const style = document.createElement("style")
      style.id = "pomodoro-notification-styles"
      style.textContent = `
        @keyframes pomodoroSlideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes pomodoroSlideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `
      document.head.appendChild(style)
    }

    document.body.appendChild(this.notificationElement)

    // Auto-remove after 4 seconds
    setTimeout(() => {
      this.removeNotification()
    }, 4000)

    console.log("[v0] Notification shown:", message)
  }

  removeNotification() {
    if (this.notificationElement) {
      this.notificationElement.style.animation = "pomodoroSlideOut 0.3s ease-in"
      setTimeout(() => {
        if (this.notificationElement) {
          this.notificationElement.remove()
          this.notificationElement = null
        }
      }, 300)
    }
  }

  // Utility method to check if we're on a YouTube video page
  isOnVideoPage() {
    return window.location.pathname.includes("/watch") && window.location.search.includes("v=")
  }

  // Method to get current video title for analytics
  getCurrentVideoTitle() {
    const titleElement = document.querySelector("h1.ytd-video-primary-info-renderer")
    return titleElement ? titleElement.textContent.trim() : "Unknown Video"
  }

  // Method to get current channel name
  getCurrentChannelName() {
    const channelElement = document.querySelector("#channel-name a")
    return channelElement ? channelElement.textContent.trim() : "Unknown Channel"
  }
}

// Initialize YouTube integration when script loads
if (window.location.hostname.includes("youtube.com")) {
  console.log("[v0] Initializing YouTube Pomodoro integration")
  new YouTubeIntegration()
} else {
  console.log("[v0] Not on YouTube, skipping integration")
}
