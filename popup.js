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
            helpBtn: document.getElementById("help-btn"),
            settingsBtn: document.getElementById("settings-btn"),
            statsBtn: document.getElementById("stats-btn"),
            todoInput: document.getElementById("todo-input"),
            addTodoBtn: document.getElementById("add-todo-btn"),
            todoList: document.getElementById("todo-list"),
            supportBtnMain: document.getElementById("support-btn-main"),
        };
        this.state = {};
        this.totalSessions = 0;
        this.initialize();
    }

    async initialize() {
        this.initializeEventListeners();
        await this.loadState();

        chrome.runtime.onMessage.addListener(async (message) => {
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
            if (message.type === "STATS_UPDATED") {
                await this.updateTotalSessions();
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
        // The progress circle is now handled entirely by CSS.
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
        this.elements.supportBtnMain?.addEventListener("click", () => this.openSupportPage());
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
                await this.updateTotalSessions();
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

    async updateTotalSessions() {
        try {
            const result = await chrome.storage.local.get(['dailyStats']);
            const dailyStats = result.dailyStats || {};
            let total = 0;
            for (const date in dailyStats) {
                total += dailyStats[date].focusSessions || 0;
            }
            this.totalSessions = total;
        } catch (error) {
            console.error("Error calculating total sessions:", error);
            this.totalSessions = 0;
        }
    }

    updateDisplay() {
        if (!this.state) return;
        this.updateTimerDisplay();
        if (this.elements.timerLabel) {
            const labelMap = { 'focus': 'Focus', 'shortBreak': 'Short Break', 'longBreak': 'Long Break' };
            this.elements.timerLabel.textContent = labelMap[this.state.currentMode] || 'Focus';
        }
        if (this.elements.sessionCount) {
             this.elements.sessionCount.textContent = this.totalSessions;
        }
        if (this.elements.timerCircle) {
            this.elements.timerCircle.classList.toggle("running", this.state.isRunning);
        }
        if (this.elements.startBtn) this.elements.startBtn.style.display = this.state.isRunning ? 'none' : 'flex';
        if (this.elements.pauseBtn) this.elements.pauseBtn.style.display = this.state.isRunning ? 'flex' : 'none';
        
        const isBreakMode = this.state.currentMode === "shortBreak" || this.state.currentMode === "longBreak";
        if (this.elements.skipBreakContainer) this.elements.skipBreakContainer.style.display = isBreakMode && !this.state.isRunning ? "flex" : "none";
        
        document.body.className = "";
        if (this.state.currentMode === "shortBreak") document.body.classList.add("break-mode");
        if (this.state.currentMode === "longBreak") document.body.classList.add("long-break-mode");
        
        if (this.state.isLockedIn) {
            this.elements.pauseBtn.disabled = true;
            this.elements.resetBtn.disabled = true;
            this.elements.skipBreakBtn.disabled = true;
            this.elements.lockInBtn.classList.add("active");
            this.elements.lockInBtn.disabled = true;
            this.elements.lockInSettings.classList.remove('visible');
        } else {
            this.elements.pauseBtn.disabled = false;
            this.elements.resetBtn.disabled = this.state.isRunning;
            this.elements.skipBreakBtn.disabled = false;
            this.elements.lockInBtn.disabled = this.state.isRunning;
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
      const activeTodos = this.state.todos?.filter(todo => !todo.completed) || [];
      const completedTodos = this.state.todos?.filter(todo => todo.completed) || [];
      let todoHtml = '';
      if (activeTodos.length === 0 && completedTodos.length === 0) {
        todoHtml = `<div class="todo-empty">No tasks yet.</div>`;
      } else {
        activeTodos.forEach(todo => {
          todoHtml += `<div class="todo-item" data-id="${todo.id}"><button class="todo-checkbox"></button><span class="todo-text">${todo.text}</span><button class="todo-delete">×</button></div>`;
        });
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

