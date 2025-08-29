// Manages the popup UI for the Pomodoro Timer extension.
class PomodoroPopup {
    constructor() {
        this.elements = {
            timerText: document.getElementById("timer-text"),
            timerLabel: document.getElementById("timer-label"),
            timerCircle: document.getElementById("timer-circle"),
            startBtn: document.getElementById("start-btn"),
            pauseBtn: document.getElementById("pause-btn"),
            resetBtn: document.getElementById("reset-btn"),
            skipBreakBtn: document.getElementById("skip-break-btn"),
            skipBreakContainer: document.getElementById("skip-break-container"),
            lockInBtn: document.getElementById("lock-in-btn"),
            lockInSettings: document.getElementById("lock-in-settings"),
            lockInSessions: document.getElementById("lock-in-sessions"),
            sessionCount: document.getElementById("session-count"),
            currentMode: document.getElementById("current-mode"),
            focusTimeSelect: document.getElementById("focus-time"),
            breakTimeSelect: document.getElementById("break-time"),
            helpBtn: document.getElementById("help-btn"),
            settingsBtn: document.getElementById("settings-btn"),
            statsBtn: document.getElementById("stats-btn"),
            supportBtn: document.getElementById("support-btn"),
            todoInput: document.getElementById("todo-input"),
            addTodoBtn: document.getElementById("add-todo-btn"),
            todoList: document.getElementById("todo-list"),
            supportBtnMain: document.getElementById("support-btn-main"),
            openStatsBtn: document.getElementById("open-stats"),
            openSettingsBtn: document.getElementById("open-settings"),
        };
        this.state = {};
        this.initialize();
    }

    async initialize() {
        this.initializeEventListeners();
        await this.loadState();
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === "TIMER_UPDATE") {
                this.state = message.state;
                this.updateDisplay();
                this.renderTodos();
            }
            if (message.type === "SETTINGS_UPDATED") {
                if (message.settings) {
                    this.state.settings = { ...this.state.settings, ...message.settings };
                }
                this.updateDisplay();
            }
        });
    }

    updateTimerDisplay() {
        if (!this.state || !this.elements.timerText) {
            return;
        }
        let currentTime = this.state.currentTime;
        if (this.state.isRunning && this.state.targetCompletionTime) {
            currentTime = Math.max(0, Math.round((this.state.targetCompletionTime - Date.now()) / 1000));
        }
        const minutes = Math.floor(currentTime / 60);
        const seconds = currentTime % 60;
        this.elements.timerText.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        this.updateProgressCircle();
        if (currentTime === 0 && this.state.isRunning) {
            this.sendMessageToBackground("GET_STATE");
        }
    }

    updateProgressCircle() {
        const circle = this.elements.timerCircle;
        if (!circle) return;
        const totalTime = this.getTotalTimeForCurrentMode();
        const progress = totalTime > 0 ? (totalTime - this.state.currentTime) / totalTime : 0;
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

    initializeEventListeners() {
        const updateTimer = () => {
            if (!this.isDestroyed && this.state?.isRunning && this.state?.targetCompletionTime) {
                const remainingTime = Math.round((this.state.targetCompletionTime - Date.now()) / 1000);
                this.state.currentTime = Math.max(0, remainingTime);
                this.updateDisplay();
            }
            if (!this.isDestroyed && document.visibilityState === 'visible') {
                if (this.animationFrameId) {
                    cancelAnimationFrame(this.animationFrameId);
                }
                this.animationFrameId = requestAnimationFrame(updateTimer);
            }
        };
        this.isDestroyed = false;
        updateTimer();
        this.visibilityHandler = () => {
            if (document.visibilityState === 'visible') {
                this.loadState();
                updateTimer();
            } else {
                if (this.animationFrameId) {
                    cancelAnimationFrame(this.animationFrameId);
                    this.animationFrameId = null;
                }
            }
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);

        this.elements.lockInBtn?.addEventListener("click", () => {
            this.elements.lockInBtn.classList.toggle("active");
            this.elements.lockInSettings.classList.toggle("visible");
        });

        this.elements.startBtn?.addEventListener("click", () => {
            const isLocked = this.elements.lockInBtn.classList.contains("active");
            if (isLocked) {
                const sessions = parseInt(this.elements.lockInSessions.value, 10);
                this.sendMessageToBackground("START_TIMER_LOCKED", { sessions });
            } else {
                this.sendMessageToBackground("START_TIMER");
            }
        });

        this.elements.pauseBtn?.addEventListener("click", () => {
            this.sendMessageToBackground("PAUSE_TIMER");
        });

        this.elements.resetBtn?.addEventListener("click", () => this.sendMessageToBackground("RESET_TIMER"));
        this.elements.skipBreakBtn?.addEventListener("click", () => this.sendMessageToBackground("SKIP_BREAK"));
        this.elements.helpBtn?.addEventListener("click", () => this.openHelpPage());
        this.elements.settingsBtn?.addEventListener("click", () => this.openSettings());
        this.elements.statsBtn?.addEventListener("click", () => this.openStats());
        this.elements.supportBtn?.addEventListener("click", () => this.openSupportPage());
        this.elements.supportBtnMain?.addEventListener("click", () => this.openSupportPage());
        this.elements.openStatsBtn?.addEventListener("click", () => this.openStats());
        this.elements.openSettingsBtn?.addEventListener("click", () => this.openSettings());
        this.elements.focusTimeSelect?.addEventListener("change", () => this.updateSettings());
        this.elements.breakTimeSelect?.addEventListener("change", () => this.updateSettings());
        this.elements.addTodoBtn?.addEventListener("click", () => this.addTodo());
        this.elements.todoInput?.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.addTodo();
        });
        this.elements.todoList?.addEventListener("click", (e) => this.handleTodoAction(e));
    }

    async loadState() {
        try {
            const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
            if (response && response.state) {
                this.state = response.state;
                if (this.state.isRunning && this.state.targetCompletionTime) {
                    const remainingTime = Math.round((this.state.targetCompletionTime - Date.now()) / 1000);
                    this.state.currentTime = Math.max(0, remainingTime);
                }
                this.updateDisplay();
                this.renderTodos();
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
        currentTime: 25 * 60,
        isRunning: false,
        currentMode: "focus",
        sessionCount: 1,
        settings: {
          focusTime: 25,
          shortBreak: 5,
        },
        todos: [],
      };
    }

    updateDisplay() {
        if (!this.state) return;
        this.updateTimerDisplay();
        if (this.elements.timerLabel) {
            const labelMap = { 'focus': 'Focus Time', 'shortBreak': 'Short Break', 'longBreak': 'Long Break' };
            this.elements.timerLabel.textContent = labelMap[this.state.currentMode] || 'Focus Time';
        }
        if (this.elements.currentMode) {
            const modeMap = { 'focus': 'Focus', 'shortBreak': 'Short Break', 'longBreak': 'Long Break' };
            this.elements.currentMode.textContent = modeMap[this.state.currentMode] || 'Focus';
        }
        if (this.elements.sessionCount) this.elements.sessionCount.textContent = this.state.sessionCount;
        if (this.elements.timerCircle) {
            this.elements.timerCircle.classList.toggle("running", this.state.isRunning);
            this.elements.timerCircle.classList.toggle("focus", this.state.currentMode === 'focus');
        }
        if (this.elements.startBtn) this.elements.startBtn.style.display = this.state.isRunning ? 'none' : 'block';
        if (this.elements.pauseBtn) this.elements.pauseBtn.style.display = this.state.isRunning ? 'block' : 'none';
        const isBreakMode = this.state.currentMode === "shortBreak" || this.state.currentMode === "longBreak";
        if (this.elements.skipBreakContainer) this.elements.skipBreakContainer.style.display = isBreakMode ? "flex" : "none";
        document.body.className = "";
        if (this.state.currentMode === "shortBreak") document.body.classList.add("break-mode");
        if (this.state.currentMode === "longBreak") document.body.classList.add("long-break-mode");
        if (this.elements.focusTimeSelect) this.elements.focusTimeSelect.value = this.state.settings.focusTime;
        if (this.elements.breakTimeSelect) this.elements.breakTimeSelect.value = this.state.settings.shortBreak;
        if (this.state.isLockedIn) {
            this.elements.pauseBtn.disabled = true;
            this.elements.resetBtn.disabled = true;
            this.elements.skipBreakBtn.disabled = true;
            this.elements.lockInBtn.classList.add("active");
            this.elements.lockInBtn.disabled = true;
            this.elements.lockInSettings.classList.remove('visible');
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
            const response = await chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED", settings: newSettings });
            if (response && response.success) {
                this.state.settings = newSettings;
                this.updateDisplay();
            }
        } catch (error) {
            console.error("Error sending settings update to background:", error);
        }
    }
    
    async addTodo() {
      const todoText = this.elements.todoInput.value.trim();
      if (!todoText) return;
      const todoInput = this.elements.todoInput;
      const addButton = this.elements.addTodoBtn;
      try {
        todoInput.disabled = true;
        addButton.disabled = true;
        const response = await chrome.runtime.sendMessage({ type: "ADD_TODO", todo: { text: todoText } });
        if (response && response.success) {
          todoInput.value = "";
          if (response.todos) {
            this.state.todos = response.todos;
            this.renderTodos();
          }
        }
      } catch (error) {
        console.error("Error adding todo:", error);
      } finally {
        todoInput.disabled = false;
        addButton.disabled = false;
        todoInput.focus();
      }
    }
  
    toggleTodo(todoId) { this.sendMessageToBackground("TOGGLE_TODO", { todoId }); }
    deleteTodo(todoId) { this.sendMessageToBackground("DELETE_TODO", { todoId }); }
  
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
      if (target.classList.contains("todo-checkbox")) this.toggleTodo(todoId);
      else if (target.classList.contains("todo-delete")) this.deleteTodo(todoId);
    }
    
    sendMessageToBackground(type, payload = {}) {
        try { chrome.runtime.sendMessage({ type, ...payload }); } catch (error) { console.error(`Error sending message of type ${type} to background:`, error); }
    }
    
    openSettings() { chrome.runtime.openOptionsPage(); }
    openStats() { chrome.tabs.create({ url: chrome.runtime.getURL("stats.html") }); }
    openSupportPage() { chrome.tabs.create({ url: chrome.runtime.getURL("support.html") }); }
    openHelpPage() { chrome.tabs.create({ url: chrome.runtime.getURL("help.html") }); }
    destroy() { if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId); }
}

let pomodoroPopup;
document.addEventListener("DOMContentLoaded", () => {
    pomodoroPopup = new PomodoroPopup();
});
window.addEventListener("beforeunload", () => {
    if (pomodoroPopup) pomodoroPopup.destroy();
});