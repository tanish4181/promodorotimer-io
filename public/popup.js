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
    this.sessionCount = document.getElementById("session-count")
    this.currentMode = document.getElementById("current-mode")
    this.focusTimeSelect = document.getElementById("focus-time")
    this.breakTimeSelect = document.getElementById("break-time")
    this.settingsBtn = document.getElementById("settings-btn")
    this.statsBtn = document.getElementById("stats-btn")

    this.todoInput = document.getElementById("todo-input")
    this.addTodoBtn = document.getElementById("add-todo-btn")
    this.todoList = document.getElementById("todo-list")
    this.websiteInput = document.getElementById("website-input")
    this.addWebsiteBtn = document.getElementById("add-website-btn")
    this.blockedWebsitesList = document.getElementById("blocked-websites-list")
    this.toggleBlockingBtn = document.getElementById("toggle-blocking")

    console.log("[v0] Elements found:", {
      timerText: !!this.timerText,
      startBtn: !!this.startBtn,
      pauseBtn: !!this.pauseBtn,
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

    if (this.toggleBlockingBtn) {
      this.toggleBlockingBtn.addEventListener("click", () => {
        this.toggleWebsiteBlocking()
      })
    }

    const chrome = window.chrome // Declare chrome variable
    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("[v0] Message received:", message)
        if (message.type === "TIMER_UPDATE") {
          this.updateDisplay()
        }
      })
    }
  }

  async loadState() {
    console.log("[v0] Loading state")
    try {
      const chrome = window.chrome // Declare chrome variable
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
          notifications: true,
          sounds: true,
          websiteBlocking: true,
        },
        todos: result.todos || [],
        blockedWebsites: result.blockedWebsites || [],
      }

      // Update UI elements with null checks
      if (this.focusTimeSelect) this.focusTimeSelect.value = this.state.settings.focusTime
      if (this.breakTimeSelect) this.breakTimeSelect.value = this.state.settings.shortBreak

      this.updateDisplay()
      this.renderTodos()
      this.renderBlockedWebsites()
    } catch (error) {
      console.error("[v0] Error loading state:", error)
      this.initializeDefaultState()
      this.updateDisplay()
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
        notifications: true,
        sounds: true,
        websiteBlocking: true,
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
      const chrome = window.chrome // Declare chrome variable
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
            <button class="todo-checkbox" onclick="popup.toggleTodo(${todo.id})">
              <span class="checkbox-icon">${todo.completed ? "✓" : ""}</span>
            </button>
            <span class="todo-text ${todo.completed ? "completed" : ""}">${todo.text}</span>
            <button class="todo-delete" onclick="popup.deleteTodo(${todo.id})" title="Delete task">×</button>
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
              <button class="todo-checkbox" onclick="popup.toggleTodo(${todo.id})">
                <span class="checkbox-icon">✓</span>
              </button>
              <span class="todo-text completed">${todo.text}</span>
              <button class="todo-delete" onclick="popup.deleteTodo(${todo.id})" title="Delete task">×</button>
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
      const chrome = window.chrome // Declare chrome variable
      await chrome.runtime.sendMessage({ type: "ADD_BLOCKED_WEBSITE", website })
      this.websiteInput.value = ""
      await this.loadBlockedWebsites()
    } catch (error) {
      console.error("[v0] Error adding blocked website:", error)
    }
  }

  async removeBlockedWebsite(website) {
    try {
      const chrome = window.chrome // Declare chrome variable
      await chrome.runtime.sendMessage({ type: "REMOVE_BLOCKED_WEBSITE", website })
      await this.loadBlockedWebsites()
    } catch (error) {
      console.error("[v0] Error removing blocked website:", error)
    }
  }

  async loadBlockedWebsites() {
    try {
      const chrome = window.chrome // Declare chrome variable
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
        <button class="website-remove" onclick="popup.removeBlockedWebsite('${website}')" title="Remove website">×</button>
      </div>
    `,
      )
      .join("")
  }

  async toggleWebsiteBlocking() {
    const newState = !this.state.settings.websiteBlocking
    const newSettings = { ...this.state.settings, websiteBlocking: newState }

    try {
      const chrome = window.chrome // Declare chrome variable
      await chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings: newSettings })
      this.state.settings = newSettings

      if (this.toggleBlockingBtn) {
        this.toggleBlockingBtn.textContent = newState ? "🚫" : "✅"
        this.toggleBlockingBtn.title = newState ? "Disable website blocking" : "Enable website blocking"
      }
    } catch (error) {
      console.error("[v0] Error toggling website blocking:", error)
    }
  }

  updateDisplay() {
    console.log("[v0] Updating display with state:", this.state)

    if (!this.state) {
      console.log("[v0] No state available, skipping display update")
      return
    }

    const minutes = Math.floor(this.state.currentTime / 60)
    const seconds = this.state.currentTime % 60
    this.timerText.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`

    // Update labels and modes
    const modeLabels = {
      focus: "Focus Time",
      shortBreak: "Short Break",
      longBreak: "Long Break",
    }

    this.timerLabel.textContent = modeLabels[this.state.currentMode] || "Focus Time"
    this.currentMode.textContent = this.state.currentMode === "focus" ? "Focus" : "Break"
    this.sessionCount.textContent = this.state.sessionCount

    // Update button states
    if (this.state.isRunning) {
      this.startBtn.style.display = "none"
      this.pauseBtn.style.display = "block"
      this.timerCircle.classList.add("active")
    } else {
      this.startBtn.style.display = "block"
      this.pauseBtn.style.display = "none"
      this.timerCircle.classList.remove("active")
    }

    if (this.toggleBlockingBtn && this.state.settings) {
      this.toggleBlockingBtn.textContent = this.state.settings.websiteBlocking ? "🚫" : "✅"
      this.toggleBlockingBtn.title = this.state.settings.websiteBlocking
        ? "Disable website blocking"
        : "Enable website blocking"
    }

    // Update body class for styling
    document.body.className = ""
    if (this.state.currentMode === "shortBreak" || this.state.currentMode === "longBreak") {
      document.body.classList.add(this.state.currentMode === "longBreak" ? "long-break-mode" : "break-mode")
    }
  }

  async startTimer() {
    console.log("[v0] Starting timer")
    try {
      const chrome = window.chrome // Declare chrome variable
      if (!chrome || !chrome.runtime) {
        throw new Error("Chrome runtime API not available")
      }

      await chrome.runtime.sendMessage({ type: "START_TIMER" })
      await this.loadState()
    } catch (error) {
      console.error("[v0] Error starting timer:", error)
    }
  }

  async pauseTimer() {
    console.log("[v0] Pausing timer")
    try {
      const chrome = window.chrome // Declare chrome variable
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
      const chrome = window.chrome // Declare chrome variable
      if (!chrome || !chrome.runtime) {
        throw new Error("Chrome runtime API not available")
      }

      await chrome.runtime.sendMessage({ type: "RESET_TIMER" })
      await this.loadState()
    } catch (error) {
      console.error("[v0] Error resetting timer:", error)
    }
  }

  async updateSettings() {
    console.log("[v0] Updating settings")
    try {
      const chrome = window.chrome // Declare chrome variable
      const newSettings = {
        ...this.state.settings,
        focusTime: Number.parseInt(this.focusTimeSelect.value),
        shortBreak: Number.parseInt(this.breakTimeSelect.value),
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
      const chrome = window.chrome // Declare chrome variable
      chrome.runtime.openOptionsPage()
    } catch (error) {
      console.error("[v0] Error opening settings:", error)
    }
  }

  openStats() {
    console.log("[v0] Opening stats")
    try {
      const chrome = window.chrome // Declare chrome variable
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
