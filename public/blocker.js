// Website Blocker Content Script

const chrome = window.chrome // Declare the chrome variable

class WebsiteBlocker {
  constructor() {
    this.checkAndBlock()
  }

  async checkAndBlock() {
    try {
      if (!chrome || !chrome.runtime) {
        console.error("[v0] Chrome runtime API not available")
        return
      }

      const response = await chrome.runtime.sendMessage({
        type: "CHECK_WEBSITE_BLOCKED",
        url: window.location.href,
      })

      if (response && response.blocked) {
        this.blockWebsite()
      }
    } catch (error) {
      console.error("[v0] Website blocker error:", error)
    }
  }

  blockWebsite() {
    // Create blocking overlay
    const overlay = document.createElement("div")
    overlay.id = "pomodoro-block-overlay"
    overlay.innerHTML = `
      <div class="block-content">
        <div class="block-icon">🍅</div>
        <h1>Website Blocked</h1>
        <p>This website is blocked during your focus session.</p>
        <p>Stay focused and get back to work!</p>
        <div class="block-actions">
          <button id="close-tab-btn" class="primary-btn">Close Tab</button>
          <button id="pause-timer-btn" class="secondary-btn">Pause Timer</button>
        </div>
      </div>
    `

    // Add styles
    const style = document.createElement("style")
    style.textContent = `
      #pomodoro-block-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .block-content {
        text-align: center;
        color: white;
        max-width: 400px;
        padding: 2rem;
      }
      
      .block-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
      }
      
      .block-content h1 {
        font-size: 2rem;
        margin-bottom: 1rem;
        color: #059669;
      }
      
      .block-content p {
        font-size: 1.1rem;
        margin-bottom: 0.5rem;
        color: #d1d5db;
      }
      
      .block-actions {
        margin-top: 2rem;
        display: flex;
        gap: 1rem;
        justify-content: center;
      }
      
      .primary-btn, .secondary-btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 0.5rem;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .primary-btn {
        background: #059669;
        color: white;
      }
      
      .primary-btn:hover {
        background: #047857;
      }
      
      .secondary-btn {
        background: #374151;
        color: white;
        border: 1px solid #4b5563;
      }
      
      .secondary-btn:hover {
        background: #4b5563;
      }
    `

    document.head.appendChild(style)
    document.body.appendChild(overlay)

    // Add event listeners
    document.getElementById("close-tab-btn").addEventListener("click", () => {
      window.close()
    })

    document.getElementById("pause-timer-btn").addEventListener("click", async () => {
      try {
        await chrome.runtime.sendMessage({ type: "PAUSE_TIMER" })
        overlay.remove()
        style.remove()
      } catch (error) {
        console.error("[v0] Error pausing timer:", error)
      }
    })

    // Hide page content
    document.documentElement.style.overflow = "hidden"
  }
}

// Initialize blocker when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new WebsiteBlocker())
} else {
  new WebsiteBlocker()
}
