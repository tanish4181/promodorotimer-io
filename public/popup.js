// Popup script for Pomodoro Timer Chrome Extension

class PomodoroPopup {
  constructor() {
    console.log("[v0] Initializing PomodoroPopup")
    this.timerText = document.getElementById("timer-text")
    this.timerLabel = document.getElementById("timer-label")
    this.timerCircle = document.getElementById("timer-circle")
    this.startBtn = document.getElementById("start-btn")
    this.pauseBtn = document.getElementById("pause-btn")
    this.resetBtn = document.getElementById("reset-btn")
    this.skipBreakBtn = document.getElementById("skip-break-btn")
    this.skipBreakContainer = document.getElementById("skip-break-container")
    this.sessionCount = document.getElementById("session-count")
    this.currentMode = document.getElementById("current-mode")
    this.focusTimeSelect = document.getElementById("focus-time")
    this.breakTimeSelect = document.getElementById("break-time")
    this.settingsBtn = document.getElementById("settings-btn")
    this.statsBtn = document.getElementById("stats-btn")

    // Quick toggle buttons
    this.toggleBlockingBtn = document.getElementById("toggle-blocking")
    this.toggleBreakOverlayBtn = document.getElementById("toggle-break-overlay")
    this.toggleFocusIndicatorBtn = document.getElementById("toggle-focus-indicator")

    this.todoInput = document.getElementById("todo-input")
    this.addTodoBtn = document.getElementById("add-todo-btn")
    this.todoList = document.getElementById("todo-list")
    this.websiteInput = document.getElementById("website-input")
    this.addWebsiteBtn = document.getElementById("add-website-btn")
    this.blockedWebsitesList = document.getElementById("blocked-websites-list")

    console.log("[v0] Elements found:", {
      timerText: !!this.timerText,
      startBtn: !!this.startBtn,
      pauseBtn: !!this.pauseBtn,
      skipBreakBtn: !!this.skipBreakBtn,
      toggleBlockingBtn: !!this.toggleBlockingBtn,
      toggleBreakOverlayBtn: !!this.toggleBreakOverlayBtn,
      toggleFocusIndicatorBtn: !!this.toggleFocusIndicatorBtn,
    })

    this.initializeEventListeners()
    this.loadState()
  }

  initializeEventListeners() {
    console.log("[v0] Setting up event listeners")

    if (this.startBtn) {
      this.startBtn.addEventListener("click", () => {
        console.log("[v0] Start button clicked")
        this.startTimer()
      })
    }

    if (this.pauseBtn) {
      this.pauseBtn.addEventListener("click", () => {
        console.log("[v0] Pause button clicked")
        this.pauseTimer()
      })
    }

    if (this.resetBtn) {
      this.resetBtn.addEventListener("click", () => {
        console.log("[v0] Reset button clicked")
        this.resetTimer()
      })
    }

    if (this.skipBreakBtn) {
      this.skipBreakBtn.addEventListener("click", () => {
        console.log("[v0] Skip break button clicked")
        this.skipBreak()
      })
    }

    if (this.settingsBtn) {
      this.settingsBtn.addEventListener("click", () => {
        console.log("[v0] Settings button clicked")
        this.openSettings()
      })
    }

    if (this.statsBtn) {
      this.statsBtn.addEventListener("click", () => {
        console.log("[v0] Stats button clicked")
        this.openStats()
      })
    }

    if (this.focusTimeSelect) {
      this.focusTimeSelect.addEventListener("change", () => {
        console.log("[v0] Focus time changed")
        this.updateSettings()
      })
    }

    if (this.breakTimeSelect) {
      this.breakTimeSelect.addEventListener("change", () => {
        console.log("[v0] Break time changed")
        this.updateSettings()
      })
    }

    // Quick toggle buttons
    if (this.toggleBlockingBtn) {
      this.toggleBlockingBtn.addEventListener("click", () => {
        console.log("[v0] Toggle blocking clicked")
        this.toggleSetting("websiteBlocking", this.toggleBlockingBtn)
      })
    }

    if (this.toggleBreakOverlayBtn) {
      this.toggleBreakOverlayBtn.addEventListener("click", () => {
        console.log("[v0] Toggle break overlay clicked")
        this.toggleSetting("breakOverlay", this.toggleBreakOverlayBtn)
      })
    }

    if (this.toggleFocusIndicatorBtn) {
      this.toggleFocusIndicatorBtn.addEventListener("click", () => {
        console.log("[v0] Toggle focus indicator clicked")
        this.toggleSetting("focusIndicator", this.toggleFocusIndicatorBtn)
      })
    }

    if (this.addTodoBtn) {
      this.addTodoBtn.addEventListener("click", () => {
        this.addTodo()
      })
    }

    if (this.todoInput) {
      this.todoInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.addTodo()
        }
      })
    }

    if (this.addWebsiteBtn) {
      this.addWebsiteBtn.addEventListener("click", () => {
        this.addBlockedWebsite()
      })
    }

    if (this.websiteInput) {
      this.websiteInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.addBlockedWebsite()
        }
      })
    }

    // Event delegation for todo items and website items
    if (this.todoList) {
      this.todoList.addEventListener("click", (e) => {
        const target = e.target
        const todoItem = target.closest('.todo-item')
        
        if (!todoItem) return
        
        const todoId = parseInt(todoItem.dataset.id)
        
        if (target.classList.contains('todo-checkbox')) {
          this.toggleTodo(todoId)
        } else if (target.classList.contains('todo-delete')) {
          this.deleteTodo(todoId)
        }
      })
    }

    if (this.blockedWebsitesList) {
      this.blockedWebsitesList.addEventListener("click", (e) => {
        const target = e.target
        
        if (target.classList.contains('website-remove')) {
          const websiteName = target.dataset.website
          this.removeBlockedWebsite(websiteName)
        }
      })
    }

    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("[v0] Message received:", message)
        if (message.type === "TIMER_UPDATE") {
          this.state = message.state
          this.updateDisplay()
        }
      })
    }
  }

  async toggleSetting(settingName, button) {
    console.log("[v0] Toggling setting:", settingName)
    
    if (!this.state || !this.state.settings) {
      console.error("[v0] No state or settings available")
      return
    }

    const currentValue = this.state.settings[settingName]
    const newValue = !currentValue
    
    console.log("[v0] Setting", settingName, "changing from", currentValue, "to", newValue)

    // Update UI immediately for instant feedback
    this.state.settings[settingName] = newValue
    this.updateToggleButton(button, newValue)

    const newSettings = { ...this.state.settings, [settingName]: newValue }

    try {
      // Save to storage
      await chrome.storage.local.set({ settings: newSettings })

      // Notify background script
      await chrome.runtime.sendMessage({ 
        type: "SETTINGS_UPDATED", 
        settings: newSettings 
      })

      console.log("[v0] Setting", settingName, "successfully toggled to", newValue)
    } catch (error) {
      console.error("[v0] Error toggling setting:", error)
      // Revert the change if there was an error
      this.state.settings[settingName] = currentValue
      this.updateToggleButton(button, currentValue)
    }
  }

  updateToggleButton(button, isActive) {
    if (!button) {
      console.error("[v0] Button element not found")
      return
    }

    console.log("[v0] Updating toggle button, isActive:", isActive)

    if (isActive) {
      button.classList.add("active")
      button.style.background = "var(--primary-color)"
      button.style.color = "white"
      button.style.transform = "scale(1.1)"
    } else {
      button.classList.remove("active")
      button.style.background = "none"
      button.style.color = "inherit"
      button.style.transform = "scale(1)"
    }
  }

  async loadState() {
    console.log("[v0] Loading state")
    try {
      if (!chrome || !chrome.storage) {
        throw new Error("Chrome storage API not available")
      }

      const result = await chrome.storage.local.get([
        "timerState",
        "currentTime",
        "isRunning",
        "currentMode",
        "sessionCount",
        "settings",
        "todos",
        "blockedWebsites",
      ])

      console.log("[v0] Loaded state:", result)

      this.state = {
        timerState: result.timerState || "focus",
        currentTime: result.currentTime || 25 * 60,
        isRunning: result.isRunning || false,
        currentMode: result.currentMode || "focus",
        sessionCount: result.sessionCount || 1,
        settings: result.settings || {
          focusTime: 25,
          shortBreak: 5,
          longBreak: 15,
          sessionsUntilLongBreak: 4,
          autoStartBreaks: true,
          autoStartPomodoros: false,
          autoSwitchModes: true,
          notifications: true,
          sounds: true,
          breakReminders: true,
          enforceBreaks: true,
          youtubeIntegration: true,
          breakOverlay: true,
          breakCountdown: true,
          nextSessionInfo: true,
          focusOverlay: false,
          hideDistractions: true,
          focusIndicator: true,
          websiteBlocking: true,
          hideYoutubeComments: true,
          hideYoutubeRecommendations: true,
          hideYoutubeShorts: true,
          pauseYoutubeBreaks: true,
          collectStats: true,
        },
        todos: result.todos || [],
        blockedWebsites: result.blockedWebsites || [],
      }

      // Update UI elements with null checks
      if (this.focusTimeSelect) this.focusTimeSelect.value = this.state.settings.focusTime
      if (this.breakTimeSelect) this.breakTimeSelect.value = this.state.settings.shortBreak

      this.updateDisplay()
      this.updateToggleButtons()
      this.renderTodos()
      this.renderBlockedWebsites()
    } catch (error) {
      console.error("[v0] Error loading state:", error)
      this.initializeDefaultState()
      this.updateDisplay()
    }
  }

  updateToggleButtons() {
    if (!this.state || !this.state.settings) {
      console.error("[v0] No state or settings available for toggle buttons")
      return
    }

    console.log("[v0] Updating toggle buttons with settings:", this.state.settings)

    // Update each toggle button with proper null checks
    if (this.toggleBlockingBtn) {
      this.updateToggleButton(this.toggleBlockingBtn, this.state.settings.websiteBlocking)
    }
    if (this.toggleBreakOverlayBtn) {
      this.updateToggleButton(this.toggleBreakOverlayBtn, this.state.settings.breakOverlay)
    }
    if (this.toggleFocusIndicatorBtn) {
      this.updateToggleButton(this.toggleFocusIndicatorBtn, this.state.settings.focusIndicator)
    }
  }

  initializeDefaultState() {
    console.log("[v0] Initializing default state")
    this.state = {
      timerState: "focus",
      currentTime: 25 * 60,
      isRunning: false,
      currentMode: "focus",
      sessionCount: 1,
      settings: {
        focusTime: 25,
        shortBreak: 5,
        longBreak: 15,
        sessionsUntilLongBreak: 4,
        autoStartBreaks: true,
        autoStartPomodoros: false,
        autoSwitchModes: true,
        notifications: true,
        sounds: true,
        breakReminders: true,
        enforceBreaks: true,
        youtubeIntegration: true,
        breakOverlay: true,
        breakCountdown: true,
        nextSessionInfo: true,
        focusOverlay: false,
        hideDistractions: true,
        focusIndicator: true,
        websiteBlocking: true,
        hideYoutubeComments: true,
        hideYoutubeRecommendations: true,
        hideYoutubeShorts: true,
        pauseYoutubeBreaks: true,
        collectStats: true,
      },
      todos: [],
      blockedWebsites: [],
    }
  }

  async addTodo() {
    if (!this.todoInput) return

    const todoText = this.todoInput.value.trim()
    if (!todoText) return

    const newTodo = {
      id: Date.now(),
      text: todoText,
      completed: false,
      createdAt: new Date().toISOString(),
    }

    this.state.todos.push(newTodo)
    await this.saveTodos()
    this.todoInput.value = ""
    this.renderTodos()
  }

  async toggleTodo(todoId) {
    const todo = this.state.todos.find((t) => t.id === todoId)
    if (todo) {
      todo.completed = !todo.completed
      todo.completedAt = todo.completed ? new Date().toISOString() : null
      await this.saveTodos()
      this.renderTodos()
    }
  }

  async deleteTodo(todoId) {
    this.state.todos = this.state.todos.filter((t) => t.id !== todoId)
    await this.saveTodos()
    this.renderTodos()
  }

  async saveTodos() {
    try {
      if (!chrome || !chrome.storage) {
        throw new Error("Chrome storage API not available")
      }

      await chrome.storage.local.set({ todos: this.state.todos })
      await chrome.runtime.sendMessage({ type: "TODOS_UPDATED", todos: this.state.todos })
    } catch (error) {
      console.error("[v0] Error saving todos:", error)
    }
  }

  renderTodos() {
    if (!this.todoList) return

    const activeTodos = this.state.todos.filter((todo) => !todo.completed)
    const completedTodos = this.state.todos.filter((todo) => todo.completed)

    this.todoList.innerHTML = `
      <div class="todo-section">
        <h4 class="todo-section-title">Active Tasks (${activeTodos.length})</h4>
        ${activeTodos
          .map(
            (todo) => `
          <div class="todo-item" data-id="${todo.id}">
            <button class="todo-checkbox">
              <span class="checkbox-icon">${todo.completed ? "✓" : ""}</span>
            </button>
            <span class="todo-text ${todo.completed ? "completed" : ""}">${todo.text}</span>
            <button class="todo-delete" title="Delete task">×</button>
          </div>
        `,
          )
          .join("")}
        ${activeTodos.length === 0 ? '<div class="todo-empty">No active tasks. Add one above!</div>' : ""}
      </div>
      
      ${
        completedTodos.length > 0
          ? `
        <div class="todo-section">
          <h4 class="todo-section-title">Completed (${completedTodos.length})</h4>
          ${completedTodos
            .map(
              (todo) => `
            <div class="todo-item completed" data-id="${todo.id}">
              <button class="todo-checkbox">
                <span class="checkbox-icon">✓</span>
              </button>
              <span class="todo-text completed">${todo.text}</span>
              <button class="todo-delete" title="Delete task">×</button>
            </div>
          `,
            )
            .join("")}
        </div>
      `
          : ""
      }
    `
  }

  async addBlockedWebsite() {
    if (!this.websiteInput) return

    const website = this.websiteInput.value.trim()
    if (!website) return

    try {
      if (!chrome || !chrome.runtime) {
        throw new Error("Chrome runtime API not available")
      }

      await chrome.runtime.sendMessage({ type: "ADD_BLOCKED_WEBSITE", website })
      this.websiteInput.value = ""
      await this.loadBlockedWebsites()
    } catch (error) {
      console.error("[v0] Error adding blocked website:", error)
    }
  }

  async removeBlockedWebsite(website) {
    try {
      if (!chrome || !chrome.runtime) {
        throw new Error("Chrome runtime API not available")
      }

      await chrome.runtime.sendMessage({ type: "REMOVE_BLOCKED_WEBSITE", website })
      await this.loadBlockedWebsites()
    } catch (error) {
      console.error("[v0] Error removing blocked website:", error)
    }
  }

  async loadBlockedWebsites() {
    try {
      if (!chrome || !chrome.runtime) {
        throw new Error("Chrome runtime API not available")
      }

      const response = await chrome.runtime.sendMessage({ type: "GET_BLOCKED_WEBSITES" })
      if (response && response.websites) {
        this.state.blockedWebsites = response.websites
        this.renderBlockedWebsites()
      }
    } catch (error) {
      console.error("[v0] Error loading blocked websites:", error)
    }
  }

  renderBlockedWebsites() {
    if (!this.blockedWebsitesList) return

    if (this.state.blockedWebsites.length === 0) {
      this.blockedWebsitesList.innerHTML = '<div class="websites-empty">No blocked websites</div>'
      return
    }

    this.blockedWebsitesList.innerHTML = this.state.blockedWebsites
      .map(
        (website) => `
      <div class="website-item">
        <span class="website-name">${website}</span>
        <button class="website-remove" data-website="${website}" title="Remove website">×</button>
      </div>
    `,
      )
      .join("")
  }

  updateDisplay() {
    console.log("[v0] Updating display with state:", this.state)

    if (!this.state) {
      console.log("[v0] No state available, skipping display update")
      return
    }

    const minutes = Math.floor(this.state.currentTime / 60)
    const seconds = this.state.currentTime % 60
    if (this.timerText) {
      this.timerText.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    }

    // Update labels and modes
    const modeLabels = {
      focus: "Focus Time",
      shortBreak: "Short Break",
      longBreak: "Long Break",
    }

    if (this.timerLabel) {
      this.timerLabel.textContent = modeLabels[this.state.currentMode] || "Focus Time"
    }
    if (this.currentMode) {
      this.currentMode.textContent = this.state.currentMode === "focus" ? "Focus" : "Break"
    }
    if (this.sessionCount) {
      this.sessionCount.textContent = this.state.sessionCount
    }

    // Update button states
    if (this.state.isRunning) {
      if (this.startBtn) this.startBtn.style.display = "none"
      if (this.pauseBtn) this.pauseBtn.style.display = "block"
      if (this.timerCircle) this.timerCircle.classList.add("active")
    } else {
      if (this.startBtn) this.startBtn.style.display = "block"
      if (this.pauseBtn) this.pauseBtn.style.display = "none"
      if (this.timerCircle) this.timerCircle.classList.remove("active")
    }

    // Show/hide skip break button
    if (this.skipBreakContainer) {
      const isBreakMode = this.state.currentMode === "shortBreak" || this.state.currentMode === "longBreak"
      this.skipBreakContainer.style.display = isBreakMode ? "flex" : "none"
    }

    // Update toggle buttons
    this.updateToggleButtons()

    // Update body class for styling
    document.body.className = ""
    if (this.state.currentMode === "shortBreak" || this.state.currentMode === "longBreak") {
      document.body.classList.add(this.state.currentMode === "longBreak" ? "long-break-mode" : "break-mode")
    }
  }

  async startTimer() {
    console.log("[v0] Starting timer")
    try {
      if (!chrome || !chrome.runtime) {
        throw new Error("Chrome runtime API not available")
      }

      const response = await chrome.runtime.sendMessage({ type: "START_TIMER" })
      console.log("[v0] Start timer response:", response)
      await this.loadState()
    } catch (error) {
      console.error("[v0] Error starting timer:", error)
    }
  }

  async pauseTimer() {
    console.log("[v0] Pausing timer")
    try {
      if (!chrome || !chrome.runtime) {
        throw new Error("Chrome runtime API not available")
      }

      await chrome.runtime.sendMessage({ type: "PAUSE_TIMER" })
      await this.loadState()
    } catch (error) {
      console.error("[v0] Error pausing timer:", error)
    }
  }

  async resetTimer() {
    console.log("[v0] Resetting timer")
    try {
      if (!chrome || !chrome.runtime) {
        throw new Error("Chrome runtime API not available")
      }

      await chrome.runtime.sendMessage({ type: "RESET_TIMER" })
      await this.loadState()
    } catch (error) {
      console.error("[v0] Error resetting timer:", error)
    }
  }

  async skipBreak() {
    console.log("[v0] Skipping break")
    try {
      if (!chrome || !chrome.runtime) {
        throw new Error("Chrome runtime API not available")
      }

      await chrome.runtime.sendMessage({ type: "SKIP_BREAK" })
      await this.loadState()
    } catch (error) {
      console.error("[v0] Error skipping break:", error)
    }
  }

  async updateSettings() {
    console.log("[v0] Updating settings")
    try {
      const newSettings = {
        ...this.state.settings,
        focusTime: Number.parseInt(this.focusTimeSelect.value),
        shortBreak: Number.parseInt(this.breakTimeSelect.value),
      }

      if (!chrome || !chrome.storage) {
        throw new Error("Chrome storage API not available")
      }

      await chrome.storage.local.set({ settings: newSettings })
      await chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings: newSettings })

      this.state.settings = newSettings
      console.log("[v0] Settings updated:", newSettings)
    } catch (error) {
      console.error("[v0] Error updating settings:", error)
    }
  }

  openSettings() {
    console.log("[v0] Opening settings")
    try {
      chrome.runtime.openOptionsPage()
    } catch (error) {
      console.error("[v0] Error opening settings:", error)
    }
  }

  openStats() {
    console.log("[v0] Opening stats")
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL("stats.html") })
    } catch (error) {
      console.error("[v0] Error opening stats:", error)
    }
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }
}

let popup

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] DOM loaded, initializing popup")
  popup = new PomodoroPopup()
})
