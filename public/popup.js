// Manages the popup UI for the Pomodoro Timer extension.
class PomodoroPopup {
    constructor() {
        // Initializes the popup by caching DOM elements, setting up event listeners,
        // and loading the initial state from the background script.
        this.elements = {
            // Timer display elements
            timerText: document.getElementById("timer-text"),
            timerLabel: document.getElementById("timer-label"),
            timerCircle: document.getElementById("timer-circle"),

            // Timer control buttons
            startBtn: document.getElementById("start-btn"),
            pauseBtn: document.getElementById("pause-btn"),
            resetBtn: document.getElementById("reset-btn"),
            skipBreakBtn: document.getElementById("skip-break-btn"),
            skipBreakContainer: document.getElementById("skip-break-container"),
            lockInBtn: document.getElementById("lock-in-btn"),

            // Lock-in settings
            lockInSettings: document.getElementById("lock-in-settings"),
            lockInSessions: document.getElementById("lock-in-sessions"),

            // Session and mode display
            sessionCount: document.getElementById("session-count"),
            currentMode: document.getElementById("current-mode"),
            
            // Quick settings
            focusTimeSelect: document.getElementById("focus-time"),
            breakTimeSelect: document.getElementById("break-time"),

            // Header buttons
            settingsBtn: document.getElementById("settings-btn"),
            statsBtn: document.getElementById("stats-btn"),
            supportBtn: document.getElementById("support-btn"),

            // To-do list elements
            todoInput: document.getElementById("todo-input"),
            addTodoBtn: document.getElementById("add-todo-btn"),
            todoList: document.getElementById("todo-list"),

            // Footer and other buttons
            supportBtnMain: document.getElementById("support-btn-main"),
            openStatsBtn: document.getElementById("open-stats"),
            openSettingsBtn: document.getElementById("open-settings"),
        };

        this.state = {};
        
        this.initialize();
    }

    // Sets up initial state and listeners.
    async initialize() {
        this.initializeEventListeners();
        await this.loadState();

        // Listen for updates from the background script.
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === "TIMER_UPDATE") {
                this.state = message.state;
                this.updateDisplay();
                this.renderTodos(); // Re-render todos with the new state
            }
            if (message.type === "SETTINGS_UPDATED") {
                // Reflect settings changes immediately.
                if (message.settings) {
                    this.state.settings = { ...this.state.settings, ...message.settings };
                }
                this.updateDisplay();
            }
        });
    }

    // Updates the timer text display.
    updateTimerDisplay() {
        if (!this.state || !this.elements.timerText) {
            return;
        }

        const minutes = Math.floor(this.state.currentTime / 60);
        const seconds = this.state.currentTime % 60;
        this.elements.timerText.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        this.updateProgressCircle();
    }

    // Updates the circular progress bar.
    updateProgressCircle() {
        const circle = this.elements.timerCircle;
        if (!circle) return;

        const totalTime = this.getTotalTimeForCurrentMode();
        const progress = totalTime > 0 ? (totalTime - this.state.currentTime) / totalTime : 0;
        
        // Create or update the progress ring SVG.
        let progressRing = circle.querySelector('.progress-ring');
        if (!progressRing) {
            progressRing = document.createElement('div');
            progressRing.className = 'progress-ring';
            progressRing.innerHTML = `
                <svg class="progress-svg" viewBox="0 0 120 120">
                    <circle class="progress-track" cx="60" cy="60" r="54" />
                    <circle class="progress-fill" cx="60" cy="60" r="54" />
                </svg>
            `;
            circle.appendChild(progressRing);
        }

        const progressFill = progressRing.querySelector('.progress-fill');
        if (progressFill) {
            const circumference = 2 * Math.PI * 54;
            const strokeDashoffset = circumference - (progress * circumference);
            progressFill.style.strokeDashoffset = strokeDashoffset;
        }
    }

    // Gets the total time for the current timer mode from settings.
    getTotalTimeForCurrentMode() {
        if (!this.state || !this.state.settings) return 25 * 60;
        
        switch (this.state.currentMode) {
            case 'focus':
                return this.state.settings.focusTime * 60;
            case 'shortBreak':
                return this.state.settings.shortBreak * 60;
            case 'longBreak':
                return this.state.settings.longBreak * 60;
            default:
                return 25 * 60;
        }
    }

    // Binds event listeners to all interactive elements.
    initializeEventListeners() {
        this.elements.lockInBtn?.addEventListener("click", () => {
            this.elements.lockInBtn.classList.toggle("active");
            this.elements.lockInSettings.style.display = this.elements.lockInBtn.classList.contains("active") ? "flex" : "none";
        });

        this.elements.startBtn?.addEventListener("click", () => {
            const isLocked = this.elements.lockInBtn.classList.contains("active");
            if (isLocked) {
                const sessions = parseInt(this.elements.lockInSessions.value, 10);
                this.sendMessageToBackground("START_TIMER_LOCKED", { sessions });
            } else {
                this.sendMessageToBackground("START_TIMER");
            }

            if (this.state) {
                this.state.isRunning = true;
                this.updateDisplay();
            }
        });
        
        this.elements.pauseBtn?.addEventListener("click", () => {
            this.sendMessageToBackground("PAUSE_TIMER");
            if (this.state) {
                this.state.isRunning = false;
                this.updateDisplay();
            }
        });
        
        this.elements.resetBtn?.addEventListener("click", () => this.sendMessageToBackground("RESET_TIMER"));
        this.elements.skipBreakBtn?.addEventListener("click", () => this.sendMessageToBackground("SKIP_BREAK"));

        // Navigation buttons
        this.elements.settingsBtn?.addEventListener("click", () => this.openSettings());
        this.elements.statsBtn?.addEventListener("click", () => this.openStats());
        this.elements.supportBtn?.addEventListener("click", () => this.openSupportPage());
        this.elements.supportBtnMain?.addEventListener("click", () => this.openSupportPage());
        this.elements.openStatsBtn?.addEventListener("click", () => this.openStats());
        this.elements.openSettingsBtn?.addEventListener("click", () => this.openSettings());

        // Quick settings
        this.elements.focusTimeSelect?.addEventListener("change", () => this.updateSettings());
        this.elements.breakTimeSelect?.addEventListener("change", () => this.updateSettings());
        
        // To-do list
        this.elements.addTodoBtn?.addEventListener("click", () => this.addTodo());
        this.elements.todoInput?.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.addTodo();
        });
        this.elements.todoList?.addEventListener("click", (e) => this.handleTodoAction(e));
    }
    
    async toggleSetting(settingName) {
        if (!this.state || !this.state.settings) {
            console.error("No state or settings available");
            return;
        }

        const newValue = !this.state.settings[settingName];
        
        try {
            this.state.settings[settingName] = newValue;
            this.updateDisplay();

            const newSettings = { [settingName]: newValue };
            await chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings: newSettings });
            
            console.log(`Setting ${settingName} successfully toggled to ${newValue}`);
        } catch (error) {
            console.error(`Error toggling setting ${settingName}:`, error);
            this.state.settings[settingName] = !newValue;
            this.updateDisplay();
        }
    }
    
    updateToggleButton(button, isActive) {
        if (!button) return;
        button.classList.toggle("active", isActive);
    }

    async loadState() {
        console.log("Loading state from background script.");
        try {
            const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
            if (response && response.state) {
                this.state = response.state;
                this.updateDisplay();
                this.renderTodos();
                console.log("State loaded and rendered successfully.");
            }
        } catch (error) {
            console.error("Error loading state:", error);
            this.initializeDefaultState();
            this.updateDisplay();
            this.renderTodos();
        }
    }

    initializeDefaultState() {
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
      };
    }

    updateDisplay() {
        if (!this.state) return;

        // Update timer display
        this.updateTimerDisplay();
        
        if (this.elements.timerLabel) {
            const labelMap = {
                'focus': 'Focus Time',
                'shortBreak': 'Short Break',
                'longBreak': 'Long Break'
            };
            this.elements.timerLabel.textContent = labelMap[this.state.currentMode] || 'Focus Time';
        }
        
        if (this.elements.currentMode) {
            const modeMap = {
                'focus': 'Focus',
                'shortBreak': 'Short Break',
                'longBreak': 'Long Break'
            };
            this.elements.currentMode.textContent = modeMap[this.state.currentMode] || 'Focus';
        }
        
        if (this.elements.sessionCount) this.elements.sessionCount.textContent = this.state.sessionCount;

        // Update timer circle active state
        if (this.elements.timerCircle) {
            this.elements.timerCircle.classList.toggle("running", this.state.isRunning);
            this.elements.timerCircle.classList.toggle("focus", this.state.currentMode === 'focus');
            this.elements.timerCircle.classList.toggle("break", this.state.currentMode !== 'focus');
        }

        // Update control buttons
        if (this.elements.startBtn) this.elements.startBtn.style.display = this.state.isRunning ? 'none' : 'block';
        if (this.elements.pauseBtn) this.elements.pauseBtn.style.display = this.state.isRunning ? 'block' : 'none';
        
        // Update skip break visibility
        const isBreakMode = this.state.currentMode === "shortBreak" || this.state.currentMode === "longBreak";
        if (this.elements.skipBreakContainer) this.elements.skipBreakContainer.style.display = isBreakMode ? "flex" : "none";

        // Update body classes for theming
        document.body.className = "";
        if (this.state.currentMode === "shortBreak") document.body.classList.add("break-mode");
        if (this.state.currentMode === "longBreak") document.body.classList.add("long-break-mode");
        if (this.state.isRunning) document.body.classList.add("timer-running");
        
        // Update toggle buttons
        if (this.state.settings) {
            this.updateToggleButton(this.elements.toggleBlockingBtn, this.state.settings.websiteBlocking);
            this.updateToggleButton(this.elements.toggleBreakOverlayBtn, this.state.settings.breakOverlay);
            this.updateToggleButton(this.elements.toggleFocusIndicatorBtn, this.state.settings.focusIndicator);
        }

        // Update quick settings
        if (this.elements.focusTimeSelect) this.elements.focusTimeSelect.value = this.state.settings.focusTime;
        if (this.elements.breakTimeSelect) this.elements.breakTimeSelect.value = this.state.settings.shortBreak;

        // Handle Lock-In Mode UI
        if (this.state.isLockedIn) {
            this.elements.pauseBtn.disabled = true;
            this.elements.resetBtn.disabled = true;
            this.elements.skipBreakBtn.disabled = true;
            this.elements.lockInBtn.classList.add("active");
            this.elements.lockInBtn.disabled = true;
            this.elements.lockInSettings.style.display = 'none'; // Hide settings when running
        } else {
            this.elements.pauseBtn.disabled = false;
            this.elements.resetBtn.disabled = false;
            this.elements.skipBreakBtn.disabled = false;
            this.elements.lockInBtn.disabled = this.state.isRunning;
        }
    }

    async updateSettings() {
        const newSettings = {
            ...this.state.settings,
            focusTime: Number(this.elements.focusTimeSelect.value),
            shortBreak: Number(this.elements.breakTimeSelect.value),
        };
        try {
            // Wait for confirmation from the background script before updating local state
            const response = await chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings: newSettings });

            if (response && response.success) {
                // Now that the background has confirmed, update the local state
                this.state.settings = newSettings;
                this.updateDisplay();
                console.log("Quick settings updated and confirmed by background script.");
            } else {
                console.error("Background script failed to confirm settings update.", response);
                // NOTE: Here you could add logic to revert the UI if it were updated optimistically
            }
        } catch (error) {
            console.error("Error sending settings update to background:", error);
        }
    }
    
    addTodo() {
      const todoText = this.elements.todoInput.value.trim();
      if (!todoText) return;

      this.sendMessageToBackground("ADD_TODO", { todo: { text: todoText } });
      this.elements.todoInput.value = "";
    }
  
    toggleTodo(todoId) {
      this.sendMessageToBackground("TOGGLE_TODO", { todoId });
    }
  
    deleteTodo(todoId) {
      this.sendMessageToBackground("DELETE_TODO", { todoId });
    }
  
    renderTodos() {
      if (!this.elements.todoList) return;
      
      const activeTodos = this.state.todos.filter(todo => !todo.completed);
      const completedTodos = this.state.todos.filter(todo => todo.completed);
  
      let todoHtml = activeTodos.length > 0 ? `<div class="todo-section-title">Active Tasks (${activeTodos.length})</div>` : `<div class="todo-empty">No active tasks. Add one!</div>`;
      activeTodos.forEach(todo => {
        todoHtml += `<div class="todo-item" data-id="${todo.id}"><button class="todo-checkbox"></button><span class="todo-text">${todo.text}</span><button class="todo-delete">×</button></div>`;
      });
  
      if (completedTodos.length > 0) {
        todoHtml += `<div class="todo-section-title">Completed (${completedTodos.length})</div>`;
        completedTodos.forEach(todo => {
          todoHtml += `<div class="todo-item completed" data-id="${todo.id}"><button class="todo-checkbox">✓</button><span class="todo-text">${todo.text}</span><button class="todo-delete">×</button></div>`;
        });
      }
  
      this.elements.todoList.innerHTML = todoHtml;
    }
  
    handleTodoAction(e) {
      const target = e.target;
      const todoItem = target.closest(".todo-item");
      if (!todoItem) return;
      const todoId = Number(todoItem.dataset.id);
  
      if (target.classList.contains("todo-checkbox")) {
        this.toggleTodo(todoId);
      } else if (target.classList.contains("todo-delete")) {
        this.deleteTodo(todoId);
      }
    }
    
    sendMessageToBackground(type, payload = {}) {
        try {
            chrome.runtime.sendMessage({ type, ...payload });
        } catch (error) {
            console.error(`Error sending message of type ${type} to background:`, error);
        }
    }
    
    openSettings() {
        chrome.runtime.openOptionsPage();
    }

    openStats() {
        chrome.tabs.create({ url: chrome.runtime.getURL("stats.html") });
    }

    openSupportPage() {
        chrome.tabs.create({ url: chrome.runtime.getURL("support.html") });
    }

    // Cleanup when popup closes
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// Initialize popup and handle cleanup
let pomodoroPopup;
document.addEventListener("DOMContentLoaded", () => {
    pomodoroPopup = new PomodoroPopup();
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
    if (pomodoroPopup) {
        pomodoroPopup.destroy();
    }
});