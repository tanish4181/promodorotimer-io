// Enhanced Stats page with GitHub-style vertical heatmap and comprehensive analytics

class PomodoroStats {
  constructor() {
    this.stats = {
      totalSessions: 0,
      totalFocusTime: 0,
      totalBreakTime: 0,
      averageSessionLength: 0,
      longestStreak: 0,
      currentStreak: 0,
      dailyStats: {},
      weeklyStats: {},
      monthlyStats: {},
      bestDay: null,
      productivityScore: 0
    }
    this.tooltipElement = null; // **ADD THIS**
    this.currentView = 'overview' // overview, trends, goals
    this.initializeStats()
  }

  async initializeStats() {
    console.log("[Stats] Initializing stats page")
    this.showLoading()
    
    try {
      await this.loadStats()
      await this.calculateAdvancedStats()
      this.renderPage()
      this.setupEventListeners()
      // Live refresh when background updates stats
      chrome.runtime.onMessage.addListener(async (message) => {
        if (message?.type === 'STATS_UPDATED') {
          await this.loadStats();
          await this.calculateAdvancedStats();
          this.switchView(this.currentView);
        }
      });
      console.log("[Stats] Stats page initialized successfully")
    } catch (error) {
      console.error("[Stats] Error initializing stats:", error)
      this.showError("Failed to load statistics")
    }
  }

  showLoading() {
    document.body.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <h2>Loading Your Productivity Stats</h2>
        <p>Analyzing your Pomodoro sessions...</p>
      </div>
    `
  }

  async loadStats() {
    try {
      const result = await chrome.storage.local.get([
        'dailyStats', 
        'totalSessions', 
        'settings',
        'todos',
        'sessionHistory', // New: detailed session history
        'goals' // New: user goals
      ])
      
      this.stats.dailyStats = result.dailyStats || {}
      this.stats.totalSessions = result.totalSessions || 0
      this.settings = result.settings || {}
      this.todos = result.todos || []
      this.sessionHistory = result.sessionHistory || []
      this.goals = result.goals || { daily: 8, weekly: 40, monthly: 160 }
      
      console.log("[Stats] Raw data loaded:", {
        dailyStatsCount: Object.keys(this.stats.dailyStats).length,
        totalSessions: this.stats.totalSessions,
        sessionHistoryCount: this.sessionHistory.length
      })
    } catch (error) {
      console.error("[Stats] Error loading stats:", error)
      throw error
    }
  }

  async calculateAdvancedStats() {
    console.log("[Stats] Calculating advanced statistics...")
    
    // Calculate totals from daily stats
    let totalFocusTime = 0
    let totalBreakTime = 0
    let totalSessions = 0
    let dailySessionCounts = []

    Object.entries(this.stats.dailyStats).forEach(([date, day]) => {
      const sessions = day.focusSessions || 0
      const focusTime = day.focusTime || 0
      const breakTime = day.breakTime || 0
      
      totalFocusTime += focusTime
      totalBreakTime += breakTime
      totalSessions += sessions
      
      if (sessions > 0) {
        dailySessionCounts.push({ date, sessions, focusTime })
      }
    })

    // Update stats
    this.stats.totalFocusTime = totalFocusTime
    this.stats.totalBreakTime = totalBreakTime
    this.stats.totalSessions = totalSessions
    this.stats.averageSessionLength = totalSessions > 0 ? Math.round(totalFocusTime / totalSessions) : 0
    
    // Calculate streaks
    this.stats.longestStreak = this.calculateLongestStreak()
    this.stats.currentStreak = this.calculateCurrentStreak()
    
    // Find best day
    this.stats.bestDay = dailySessionCounts.length > 0 
      ? dailySessionCounts.reduce((best, current) => 
          current.sessions > best.sessions ? current : best
        )
      : null

    // Calculate productivity score (0-100)
    this.stats.productivityScore = this.calculateProductivityScore()

    // Calculate time-based stats
    this.calculateWeeklyStats()
    this.calculateMonthlyStats()
    this.calculateTrendStats()

    console.log("[Stats] Advanced stats calculated:", {
      totalSessions: this.stats.totalSessions,
      totalFocusHours: Math.round(this.stats.totalFocusTime / 60),
      currentStreak: this.stats.currentStreak,
      longestStreak: this.stats.longestStreak,
      productivityScore: this.stats.productivityScore
    })
  }

/**
 * Calculates a more intelligent and demanding productivity score.
 * This version prioritizes the quality of focus sessions (longer sessions).
 * @returns {number} The productivity score from 0 to 100.
 */
calculateProductivityScore() {
    const last7Days = this.getLast7Days();
    let totalGoalAdherence = 0;
    let totalConsistency = 0;
    let totalFocusQuality = 0;
    let totalTaskCompletion = 0;
    let daysWithActivity = 0;

    last7Days.forEach(date => {
        const day = this.stats.dailyStats[date];
        if (day && day.focusSessions > 0) {
            daysWithActivity++;

            // 1. Goal Adherence Score (Weight: 20%)
            const dailyGoal = this.goals.daily || 8;
            const adherence = Math.min((day.focusSessions / dailyGoal) * 100, 100);
            totalGoalAdherence += adherence;

            // 2. Consistency Score (Weight: 30%)
            const streakBonus = Math.min((this.calculateCurrentStreak() / 7) * 100, 100);
            totalConsistency += streakBonus;

            // 3. Focus Quality Score (Weight: 40%) - MORE DEMANDING
            const avgSessionLength = day.focusTime / day.focusSessions;
            const configuredFocusTime = this.settings.focusTime || 25;
            // Using a squared ratio to heavily penalize shorter sessions.
            const qualityRatio = avgSessionLength / configuredFocusTime;
            const quality = Math.min(Math.pow(qualityRatio, 2) * 100, 100);
            totalFocusQuality += quality;

            // 4. Task Completion Score (Weight: 10%)
            const completedTasks = this.getCompletedTasksForDate(date);
            const taskScore = Math.min(completedTasks * 10, 100);
            totalTaskCompletion += taskScore;
        }
    });

    if (daysWithActivity === 0) return 0;

    // Calculate the average score for each component
    const avgGoalAdherence = totalGoalAdherence / daysWithActivity;
    const avgConsistency = totalConsistency / daysWithActivity;
    const avgFocusQuality = totalFocusQuality / daysWithActivity;
    const avgTaskCompletion = totalTaskCompletion / daysWithActivity;

    // Weighted average with new weights prioritizing focus quality
    const weightedScore = 
        (avgGoalAdherence * 0.20) + 
        (avgConsistency * 0.30) + 
        (avgFocusQuality * 0.40) + 
        (avgTaskCompletion * 0.10);

    return Math.round(weightedScore);
}


/**
 * Helper to get the number of completed tasks for a specific date.
 * @param {string} dateStr - The date in 'YYYY-MM-DD' format.
 * @returns {number} The number of tasks completed on that date.
 */
getCompletedTasksForDate(dateStr) {
    if (!this.todos || this.todos.length === 0) return 0;

    return this.todos.filter(todo => {
        return todo.completed && todo.completedAt && todo.completedAt.startsWith(dateStr);
    }).length;
}


  calculateTrendStats() {
    const last30Days = this.getLast30Days()
    const last7Days = this.getLast7Days()
    
    // Calculate averages
    let last30DaysSessions = 0
    let last7DaysSessions = 0
    
    last30Days.forEach(date => {
      const day = this.stats.dailyStats[date]
      if (day) last30DaysSessions += day.focusSessions || 0
    })
    
    last7Days.forEach(date => {
      const day = this.stats.dailyStats[date]
      if (day) last7DaysSessions += day.focusSessions || 0
    })
    
    this.stats.last30DaysAvg = last30Days.length > 0 ? last30DaysSessions / last30Days.length : 0
    this.stats.last7DaysAvg = last7Days.length > 0 ? last7DaysSessions / last7Days.length : 0
    
    // Calculate trend (positive = improving, negative = declining)
    this.stats.trend = this.stats.last7DaysAvg - this.stats.last30DaysAvg
  }

  calculateLongestStreak() {
    const dates = Object.keys(this.stats.dailyStats).sort()
    let longestStreak = 0
    let currentStreak = 0

    for (let i = 0; i < dates.length; i++) {
      const day = this.stats.dailyStats[dates[i]]
      if (day && (day.focusSessions || 0) > 0) {
        currentStreak++
        longestStreak = Math.max(longestStreak, currentStreak)
      } else {
        currentStreak = 0
      }
    }

    return longestStreak
  }

  calculateCurrentStreak() {
    const today = new Date().toISOString().split('T')[0]
    let currentDate = new Date()
    let streak = 0

    // Count backwards from today
    for (let i = 0; i < 365; i++) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const day = this.stats.dailyStats[dateStr]
      
      if (day && (day.focusSessions || 0) > 0) {
        streak++
      } else {
        break
      }
      
      currentDate.setDate(currentDate.getDate() - 1)
    }

    return streak
  }

  calculateWeeklyStats() {
    const last7Days = this.getLast7Days()
    
    this.stats.weeklyStats = {
      focusSessions: 0,
      focusTime: 0,
      breakTime: 0,
      daysActive: 0
    }

    last7Days.forEach(date => {
      const day = this.stats.dailyStats[date]
      if (day) {
        this.stats.weeklyStats.focusSessions += day.focusSessions || 0
        this.stats.weeklyStats.focusTime += day.focusTime || 0
        this.stats.weeklyStats.breakTime += day.breakTime || 0
        if ((day.focusSessions || 0) > 0) {
          this.stats.weeklyStats.daysActive++
        }
      }
    })
  }

  calculateMonthlyStats() {
    const last30Days = this.getLast30Days()
    
    this.stats.monthlyStats = {
      focusSessions: 0,
      focusTime: 0,
      breakTime: 0,
      daysActive: 0
    }

    last30Days.forEach(date => {
      const day = this.stats.dailyStats[date]
      if (day) {
        this.stats.monthlyStats.focusSessions += day.focusSessions || 0
        this.stats.monthlyStats.focusTime += day.focusTime || 0
        this.stats.monthlyStats.breakTime += day.breakTime || 0
        if ((day.focusSessions || 0) > 0) {
          this.stats.monthlyStats.daysActive++
        }
      }
    })
  }

  getLast7Days() {
    const dates = []
    const today = new Date()
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      dates.push(date.toISOString().split('T')[0])
    }
    
    return dates
  }

  getLast30Days() {
    const dates = []
    const today = new Date()
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      dates.push(date.toISOString().split('T')[0])
    }
    
    return dates
  }

  renderPage() {
    document.body.innerHTML = `
      <div class="container">
        ${this.renderHeader()}
        ${this.renderNavigation()}
        ${this.renderCurrentView()}
      </div>
    `
    
    // Add event listeners after rendering
    setTimeout(() => this.setupEventListeners(), 100)
  }

  renderHeader() {
    return `
      <div class="header">
        <div class="header-content">
          <h1>Productivity Dashboard</h1>
          <p>Track your focus sessions and boost your productivity</p>
        </div>
        <div class="header-stats">
          <div class="header-stat">
            <div class="stat-number">${this.stats.totalSessions}</div>
            <div class="stat-label">Total Sessions</div>
          </div>
          <div class="header-stat">
            <div class="stat-number">${Math.round(this.stats.totalFocusTime / 60)}h</div>
            <div class="stat-label">Total Focus Time</div>
          </div>
          <div class="header-stat">
            <div class="stat-number">${this.stats.productivityScore}%</div>
            <div class="stat-label">Productivity Score</div>
          </div>
        </div>
      </div>
    `
  }

  renderNavigation() {
    return `
      <div class="navigation">
        <button class="nav-btn ${this.currentView === 'overview' ? 'active' : ''}" data-view="overview">
          <span class="nav-icon"></span>
          <span class="nav-label">Overview</span>
        </button>
        <button class="nav-btn ${this.currentView === 'heatmap' ? 'active' : ''}" data-view="heatmap">
          <span class="nav-icon"></span>
          <span class="nav-label">Activity</span>
        </button>
        <button class="nav-btn ${this.currentView === 'trends' ? 'active' : ''}" data-view="trends">
          <span class="nav-icon"></span>
          <span class="nav-label">Trends</span>
        </button>
        <button class="nav-btn ${this.currentView === 'goals' ? 'active' : ''}" data-view="goals">
          <span class="nav-icon"></span>
          <span class="nav-label">Goals</span>
        </button>
      </div>
    `
  }

  renderCurrentView() {
    switch (this.currentView) {
      case 'overview':
        return this.renderOverview()
      case 'heatmap':
        return this.renderHeatmapView()
      case 'trends':
        return this.renderTrendsView()
      case 'goals':
        return this.renderGoalsView()
      default:
        return this.renderOverview()
    }
  }

  renderOverview() {
    if (this.stats.totalSessions === 0) {
      return this.renderEmptyState()
    }

    return `
      <div class="view-content">
        ${this.renderOverviewStats()}
        ${this.renderQuickHeatmap()}
        ${this.renderRecentActivity()}
      </div>
    `
  }

  renderOverviewStats() {
    const focusHours = Math.floor(this.stats.totalFocusTime / 60)
    const focusMinutes = this.stats.totalFocusTime % 60
    const avgSessionMins = this.stats.averageSessionLength

    return `
      <div class="stats-grid">
        <div class="stat-card primary">
          <div class="stat-header">
            <h3>Focus Sessions</h3>
            <div class="stat-trend ${this.stats.trend > 0 ? 'positive' : this.stats.trend < 0 ? 'negative' : 'neutral'}">
              ${this.stats.trend > 0 ? '📈' : this.stats.trend < 0 ? '📉' : '➡️'}
            </div>
          </div>
          <div class="stat-value">${this.stats.totalSessions}</div>
          <div class="stat-details">
            <div class="stat-detail">
              <span class="detail-label">This Week:</span>
              <span class="detail-value">${this.stats.weeklyStats.focusSessions}</span>
            </div>
            <div class="stat-detail">
              <span class="detail-label">This Month:</span>
              <span class="detail-value">${this.stats.monthlyStats.focusSessions}</span>
            </div>
          </div>
        </div>
        
        <div class="stat-card secondary">
          <div class="stat-header">
            <h3>Focus Time</h3>
          </div>
          <div class="stat-value">${focusHours}h ${focusMinutes}m</div>
          <div class="stat-details">
            <div class="stat-detail">
              <span class="detail-label">Avg Session:</span>
              <span class="detail-value">${avgSessionMins}m</span>
            </div>
            <div class="stat-detail">
              <span class="detail-label">This Week:</span>
              <span class="detail-value">${Math.round(this.stats.weeklyStats.focusTime / 60)}h</span>
            </div>
          </div>
        </div>
        
        <div class="stat-card accent">
          <div class="stat-header">
            <h3>Current Streak</h3>
          </div>
          <div class="stat-value">${this.stats.currentStreak}</div>
          <div class="stat-details">
            <div class="stat-detail">
              <span class="detail-label">Best Streak:</span>
              <span class="detail-value">${this.stats.longestStreak} days</span>
            </div>
            <div class="stat-detail">
              <span class="detail-label">Active Days:</span>
              <span class="detail-value">${this.stats.weeklyStats.daysActive}/7</span>
            </div>
          </div>
        </div>
        
        <div class="stat-card success">
          <div class="stat-header">
            <h3>Productivity</h3>
          </div>
          <div class="stat-value">${this.stats.productivityScore}%</div>
          <div class="stat-details">
            <div class="stat-detail">
              <span class="detail-label">7-day avg:</span>
              <span class="detail-value">${this.stats.last7DaysAvg.toFixed(1)}</span>
            </div>
            <div class="stat-detail">
              <span class="detail-label">30-day avg:</span>
              <span class="detail-value">${this.stats.last30DaysAvg.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderQuickHeatmap() {
    const heatmapData = this.generateHeatmapData()
    const recentData = this.getLast30Days().map(date => ({
      date,
      level: this.getActivityLevel((heatmapData[date] && heatmapData[date].sessions) || 0)
    }))

    return `
      <div class="quick-heatmap-container">
        <div class="section-header">
          <h2>Recent Activity (Last 30 Days)</h2>
          <button class="view-full-btn" data-view="heatmap">View Full Heatmap</button>
        </div>
        <div class="quick-heatmap">
          ${recentData.map(day => `
            <div class="quick-heatmap-cell" 
                 data-level="${day.level}" 
                 data-date="${day.date}"
                 title="${this.getTooltipText(heatmapData[day.date] || { sessions: 0, time: 0 })}">
            </div>
          `).join('')}
        </div>
        <div class="heatmap-legend">
          <span class="legend-label">Less</span>
          <div class="legend-levels">
            ${[0,1,2,3,4].map(level => `<div class="legend-cell" data-level="${level}"></div>`).join('')}
          </div>
          <span class="legend-label">More</span>
        </div>
      </div>
    `
  }

  renderHeatmapView() {
    return `
      <div class="view-content">
        <div class="heatmap-container">
          <div class="section-header">
            <h2>Activity Heatmap - Last 12 Months</h2>
            <div class="heatmap-stats">
              <span class="heatmap-stat">
                <strong>${this.stats.totalSessions}</strong> sessions in the last year
              </span>
              <span class="heatmap-stat">
                <strong>${this.stats.currentStreak}</strong> day current streak
              </span>
            </div>
          </div>
          ${this.renderVerticalHeatmap()}
        </div>
      </div>
    `
  }

  renderVerticalHeatmap() {
    const heatmapData = this.generateHeatmapData()
    const monthsData = this.generateVerticalHeatmapData(heatmapData)
    
    return `
      <div class="vertical-heatmap">
        <div class="heatmap-months">
          ${monthsData.map(month => `
            <div class="heatmap-month">
              <div class="month-header">
                <h3 class="month-name">${month.name}</h3>
                <div class="month-stats">
                  <span class="month-sessions">${month.totalSessions} sessions</span>
                  <span class="month-time">${Math.round(month.totalTime / 60)}h</span>
                </div>
              </div>
              <div class="month-grid">
                ${month.weeks.map(week => `
                  <div class="week-column">
                    ${week.map(day => `
                      <div class="heatmap-cell vertical" 
                           data-level="${day.level}" 
                           data-date="${day.date}"
                           data-sessions="${day.sessions}"
                           data-time="${day.time}"
                           title="${this.getTooltipText(day)}">
                      </div>
                    `).join('')}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="heatmap-legend">
          <div class="legend-content">
            <span class="legend-label">Less</span>
            <div class="legend-levels">
              ${[0,1,2,3,4].map(level => `<div class="legend-cell" data-level="${level}"></div>`).join('')}
            </div>
            <span class="legend-label">More</span>
          </div>
          <div class="legend-info">
            <span>Each square represents a day. Darker squares indicate more focus sessions.</span>
          </div>
        </div>
      </div>
    `
  }

  generateVerticalHeatmapData(heatmapData) {
    const months = []
    const today = new Date()
    
    // Generate last 12 months
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
      
      let totalSessions = 0
      let totalTime = 0
      const weeks = []
      let currentWeek = []
      
      // Add padding for first week if month doesn't start on Sunday
      const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay()
      for (let j = 0; j < firstDay; j++) {
        currentWeek.push({ date: '', sessions: 0, time: 0, level: 0, isEmpty: true })
      }
      
      // Add all days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
        const dateStr = date.toISOString().split('T')[0]
        const dayData = heatmapData[dateStr] || { sessions: 0, time: 0 }
        const level = this.getActivityLevel(dayData.sessions)
        
        totalSessions += dayData.sessions
        totalTime += dayData.time
        
        currentWeek.push({
          date: dateStr,
          sessions: dayData.sessions,
          time: dayData.time,
          level: level,
          isEmpty: false
        })
        
        // If week is complete (7 days) or it's the last day of month
        if (currentWeek.length === 7 || day === daysInMonth) {
          // Pad the last week if necessary
          while (currentWeek.length < 7) {
            currentWeek.push({ date: '', sessions: 0, time: 0, level: 0, isEmpty: true })
          }
          weeks.push([...currentWeek])
          currentWeek = []
        }
      }
      
      months.push({
        name: monthName,
        totalSessions,
        totalTime,
        weeks
      })
    }
    
    return months
  }

  renderTrendsView() {
    return `
      <div class="view-content">
        <div class="trends-container">
          <div class="section-header">
            <h2>Productivity Trends</h2>
          </div>
          <div class="trends-layout-wrapper">
            ${this.renderTrendCharts()}
            ${this.renderInsights()}
          </div>
        </div>
      </div>
    `
  }

  renderTrendCharts() {
    const weeklyData = this.generateWeeklyTrendData()
    const monthlyData = this.generateMonthlyTrendData()
    
    return `
      <div class="charts-grid">
        <div class="chart-container">
          <h3>Weekly Sessions Trend</h3>
          <div class="simple-chart weekly-chart">
            ${weeklyData.map((week, index) => `
              <div class="chart-bar" style="height: ${(week.sessions / Math.max(...weeklyData.map(w => w.sessions)) * 100) || 0}%">
                <div class="bar-value">${week.sessions}</div>
                <div class="bar-label">W${week.week}</div>
              </div>
            `).join('')}
          </div>
          <div class="chart-summary">
            Average: ${(weeklyData.reduce((sum, w) => sum + w.sessions, 0) / weeklyData.length).toFixed(1)} sessions/week
          </div>
        </div>
        
        <div class="chart-container">
          <h3>Daily Average Sessions</h3>
          <div class="daily-averages">
            ${this.renderDailyAverages()}
          </div>
        </div>
      </div>
    `
  }

  generateWeeklyTrendData() {
    const weeks = []
    const today = new Date()
    
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(today)
      weekStart.setDate(weekStart.getDate() - (i * 7) - today.getDay())
      
      let sessions = 0
      let time = 0
      
      for (let j = 0; j < 7; j++) {
        const date = new Date(weekStart)
        date.setDate(date.getDate() + j)
        const dateStr = date.toISOString().split('T')[0]
        const dayData = this.stats.dailyStats[dateStr]
        
        if (dayData) {
          sessions += dayData.focusSessions || 0
          time += dayData.focusTime || 0
        }
      }
      
      weeks.push({
        week: 12 - i,
        sessions,
        time,
        startDate: weekStart.toISOString().split('T')[0]
      })
    }
    
    return weeks
  }

  generateMonthlyTrendData() {
    const months = []
    const today = new Date()
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' })
      const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
      
      let sessions = 0
      let time = 0
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
        const dateStr = date.toISOString().split('T')[0]
        const dayData = this.stats.dailyStats[dateStr]
        
        if (dayData) {
          sessions += dayData.focusSessions || 0
          time += dayData.focusTime || 0
        }
      }
      
      months.push({ month: monthName, sessions, time })
    }
    
    return months
  }

  renderDailyAverages() {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dailyAverages = new Array(7).fill(0)
    const dailyCounts = new Array(7).fill(0)
    
    Object.entries(this.stats.dailyStats).forEach(([dateStr, dayData]) => {
      const date = new Date(dateStr)
      const dayOfWeek = date.getDay()
      
      dailyAverages[dayOfWeek] += dayData.focusSessions || 0
      dailyCounts[dayOfWeek]++
    })
    
    const maxAvg = Math.max(...dailyAverages.map((sum, i) => dailyCounts[i] > 0 ? sum / dailyCounts[i] : 0))
    
    return daysOfWeek.map((day, index) => {
      const avg = dailyCounts[index] > 0 ? dailyAverages[index] / dailyCounts[index] : 0
      const percentage = maxAvg > 0 ? (avg / maxAvg) * 100 : 0
      
      return `
        <div class="daily-average-item">
          <div class="day-name">${day.slice(0, 3)}</div>
          <div class="average-bar">
            <div class="average-fill" style="height: ${percentage}%"></div>
          </div>
          <div class="average-value">${avg.toFixed(1)}</div>
        </div>
      `
    }).join('')
  }

  renderInsights() {
    const insights = this.generateInsights()
    
    return `
      <div class="insights-container">
        <h3>AI Insights</h3>
        <div class="insights-grid">
          ${insights.map(insight => `
            <div class="insight-card ${insight.type}">
              <div class="insight-icon">${insight.icon}</div>
              <div class="insight-content">
                <h4>${insight.title}</h4>
                <p>${insight.description}</p>
                ${insight.action ? `<button class="insight-action">${insight.action}</button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  generateInsights() {
    const insights = []
    
    // Streak insight
    if (this.stats.currentStreak > 7) {
      insights.push({
        type: 'success',
        icon: '🔥',
        title: 'Amazing Streak!',
        description: `You're on a ${this.stats.currentStreak}-day streak! Keep up the excellent work.`,
      })
    } else if (this.stats.currentStreak === 0) {
      insights.push({
        type: 'warning',
        icon: '⚡',
        title: 'Start Your Streak',
        description: 'Complete at least one focus session today to start building your streak!',
        action: 'Start Focus Session'
      })
    }
    
    // Productivity trend with thresholds
    if (this.stats.trend > 1) {
      insights.push({
        type: 'success',
        icon: '📈',
        title: 'Improving Productivity',
        description: `Your focus sessions increased by ${this.stats.trend.toFixed(1)} per day this week!`,
      })
    } else if (this.stats.trend < -1) {
      insights.push({
        type: 'warning',
        icon: '📉',
        title: 'Productivity Dip',
        description: `Your sessions decreased by ${Math.abs(this.stats.trend).toFixed(1)} per day. Consider adjusting your schedule.`,
      })
    }
    
    // Best day insight
    if (this.stats.bestDay) {
      const date = new Date(this.stats.bestDay.date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      })
      insights.push({
        type: 'info',
        icon: '🌟',
        title: 'Best Day Ever',
        description: `Your most productive day was ${date} with ${this.stats.bestDay.sessions} sessions!`,
      })
    }
    
    // Goal progress and suggestions
    const weeklyGoalProgress = (this.stats.weeklyStats.focusSessions / (this.goals.weekly || 40)) * 100
    if (weeklyGoalProgress >= 100) {
      insights.push({
        type: 'success',
        icon: '🎯',
        title: 'Goal Achieved!',
        description: `You've hit ${weeklyGoalProgress.toFixed(0)}% of your weekly goal. Excellent work!`,
      })
    } else if (weeklyGoalProgress > 70) {
      insights.push({
        type: 'info',
        icon: '🎯',
        title: 'Close to Goal',
        description: `You're at ${weeklyGoalProgress.toFixed(0)}% of your weekly goal. Just a little more to go!`,
      })
    }

    // Smart suggestion: best focus day/time recommendation
    const dayAverages = new Array(7).fill(0)
    const dayCounts = new Array(7).fill(0)
    Object.entries(this.stats.dailyStats).forEach(([dateStr, day]) => {
      const d = new Date(dateStr).getDay()
      const sessions = day.focusSessions || 0
      dayAverages[d] += sessions
      dayCounts[d]++
    })
    const avgPerDay = dayAverages.map((sum, i) => (dayCounts[i] ? sum / dayCounts[i] : 0))
    const bestDayIdx = avgPerDay.indexOf(Math.max(...avgPerDay))
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    if (avgPerDay[bestDayIdx] > 0) {
      insights.push({
        type: 'info',
        icon: '🗓️',
        title: 'Best Day For Deep Work',
        description: `You typically complete the most sessions on ${dayNames[bestDayIdx]}. Plan important tasks then.`,
      })
    }

    // Suggest session length tweak if average is far from preset
    const avg = this.stats.averageSessionLength
    const focusTime = (this.settings?.focusTime) || 25
    if (avg && Math.abs(avg - focusTime) >= 10) {
      const suggestion = avg > focusTime ? 'increase' : 'decrease'
      insights.push({
        type: 'info',
        icon: '⏱️',
        title: 'Tune Session Length',
        description: `Your average focus session is ${avg} min. Consider ${suggestion} your preset (${focusTime} min) for a better fit.`,
      })
    }
    
    return insights.slice(0, 4) // Show max 4 insights
  }

  renderGoalsView() {
    return `
      <div class="view-content">
        <div class="goals-container">
          <div class="section-header">
            <h2>Goals & Progress</h2>
            <button class="edit-goals-btn" id="editGoalsBtn">Edit Goals</button>
          </div>
          ${this.renderGoalProgress()}
          ${this.renderGoalSettings()}
        </div>
      </div>
    `
  }

  renderGoalProgress() {
    const dailyProgress = Math.min((this.getTodaysSessions() / this.goals.daily) * 100, 100)
    const weeklyProgress = Math.min((this.stats.weeklyStats.focusSessions / this.goals.weekly) * 100, 100)
    const monthlyProgress = Math.min((this.stats.monthlyStats.focusSessions / this.goals.monthly) * 100, 100)
    
    return `
      <div class="goals-progress">
        <div class="goal-item">
          <div class="goal-header">
            <h3>Daily Goal</h3>
            <span class="goal-value">${this.getTodaysSessions()} / ${this.goals.daily}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${dailyProgress}%"></div>
          </div>
          <div class="progress-text">${dailyProgress.toFixed(0)}% complete</div>
        </div>
        
        <div class="goal-item">
          <div class="goal-header">
            <h3>Weekly Goal</h3>
            <span class="goal-value">${this.stats.weeklyStats.focusSessions} / ${this.goals.weekly}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${weeklyProgress}%"></div>
          </div>
          <div class="progress-text">${weeklyProgress.toFixed(0)}% complete</div>
        </div>
        
        <div class="goal-item">
          <div class="goal-header">
            <h3>Monthly Goal</h3>
            <span class="goal-value">${this.stats.monthlyStats.focusSessions} / ${this.goals.monthly}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${monthlyProgress}%"></div>
          </div>
          <div class="progress-text">${monthlyProgress.toFixed(0)}% complete</div>
        </div>
      </div>
    `
  }

  renderGoalSettings() {
    return `
      <div class="goal-settings" style="display: none;">
        <h3>Goal Settings</h3>
        <div class="goal-inputs">
          <div class="goal-input">
            <label for="dailyGoal">Daily Sessions</label>
            <input type="number" id="dailyGoal" value="${this.goals.daily}" min="1" max="20">
          </div>
          <div class="goal-input">
            <label for="weeklyGoal">Weekly Sessions</label>
            <input type="number" id="weeklyGoal" value="${this.goals.weekly}" min="7" max="140">
          </div>
          <div class="goal-input">
            <label for="monthlyGoal">Monthly Sessions</label>
            <input type="number" id="monthlyGoal" value="${this.goals.monthly}" min="30" max="600">
          </div>
        </div>
        <div class="goal-actions">
          <button class="save-goals-btn" id="saveGoalsBtn">Save Goals</button>
          <button class="cancel-goals-btn" id="cancelGoalsBtn">Cancel</button>
        </div>
      </div>
    `
  }

  getTodaysSessions() {
    const today = new Date().toISOString().split('T')[0]
    const todayData = this.stats.dailyStats[today]
    return todayData ? (todayData.focusSessions || 0) : 0
  }

  renderRecentActivity() {
    const recentActivity = this.getRecentActivity()
    
    if (recentActivity.length === 0) {
      return `
        <div class="recent-activity-container">
          <h2> Recent Activity</h2>
          <div class="empty-activity">
            <div class="empty-icon">📊</div>
            <h3>No recent activity</h3>
            <p>Start your first focus session to see your activity here.</p>
          </div>
        </div>
      `
    }

    return `
      <div class="recent-activity-container">
        <div class="section-header">
          <h2> Recent Activity</h2>
        </div>
        <div class="activity-timeline">
          ${recentActivity.map(activity => `
            <div class="timeline-item">
              <div class="timeline-date">
                <div class="date-day">${activity.day}</div>
                <div class="date-month">${activity.month}</div>
              </div>
              <div class="timeline-content">
                <div class="activity-summary">
                  <span class="activity-sessions">${activity.sessions} session${activity.sessions > 1 ? 's' : ''}</span>
                  <span class="activity-time">${Math.round(activity.time / 60)} hours</span>
                </div>
                <div class="activity-details">
                  ${activity.sessions >= 8 ? '🔥 Excellent day!' : 
                    activity.sessions >= 4 ? '👍 Good progress' : 
                    activity.sessions >= 1 ? '✨ Getting started' : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  getRecentActivity() {
    const dates = Object.keys(this.stats.dailyStats)
      .sort()
      .reverse()
      .slice(0, 10)
    
    return dates.map(date => {
      const day = this.stats.dailyStats[date]
      const dateObj = new Date(date)
      
      return {
        date: date,
        day: dateObj.getDate(),
        month: dateObj.toLocaleDateString('en-US', { month: 'short' }),
        sessions: day.focusSessions || 0,
        time: day.focusTime || 0
      }
    }).filter(activity => activity.sessions > 0)
  }

  generateHeatmapData() {
    const data = {}
    const today = new Date()
    
    // Generate data for the last 365 days
    for (let i = 364; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      const dayData = this.stats.dailyStats[dateStr] || { focusSessions: 0, focusTime: 0 }
      data[dateStr] = {
        sessions: dayData.focusSessions || 0,
        time: dayData.focusTime || 0,
        level: this.getActivityLevel(dayData.focusSessions || 0)
      }
    }
    
    return data
  }

  getActivityLevel(sessions) {
    if (sessions === 0) return 0
    if (sessions <= 2) return 1
    if (sessions <= 4) return 2
    if (sessions <= 6) return 3
    return 4
  }

  getTooltipText(day) {
    if (!day || !day.sessions || day.sessions === 0) {
      return "No activity"
    }
    return `${day.sessions} session${day.sessions > 1 ? 's' : ''} (${Math.round(day.time / 60)}h ${day.time % 60}m)`
  }

  renderEmptyState() {
    return `
      <div class="empty-state">
        <div class="empty-state-icon"></div>
        <h3>Start Your Productivity Journey</h3>
        <p>Complete your first Pomodoro session to see detailed statistics and insights about your productivity.</p>
        <button class="start-session-btn" onclick="chrome.tabs.create({url: chrome.runtime.getURL('popup.html')})">
          Start Your First Session
        </button>
      </div>
    `
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view
        this.switchView(view)
      })
    })

    // View full heatmap button
    const viewFullBtn = document.querySelector('.view-full-btn')
    if (viewFullBtn) {
      viewFullBtn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view
        this.switchView(view)
      })
    }

    // Goals editing
    const editGoalsBtn = document.getElementById('editGoalsBtn')
    const saveGoalsBtn = document.getElementById('saveGoalsBtn')
    const cancelGoalsBtn = document.getElementById('cancelGoalsBtn')
    
    if (editGoalsBtn) {
      editGoalsBtn.addEventListener('click', () => {
        const goalSettings = document.querySelector('.goal-settings')
        const goalsHeader = document.querySelector('.section-header h2').closest('.section-header');
        goalsHeader.after(goalSettings); // Insert after the goals header
        goalSettings.style.display = 'block'; // Make it visible
        editGoalsBtn.style.display = 'none'
      })
    }

    if (saveGoalsBtn) {
      saveGoalsBtn.addEventListener('click', () => this.saveGoals())
    }

    if (cancelGoalsBtn) {
      cancelGoalsBtn.addEventListener('click', () => this.cancelGoalsEdit())
    }

    // **REFACTOR THIS PART**
    if (!this.tooltipElement) {
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = 'heatmap-tooltip';
        this.tooltipElement.style.display = 'none'; // Initially hidden
        document.body.appendChild(this.tooltipElement);
    }

    document.querySelectorAll('.heatmap-cell, .quick-heatmap-cell').forEach(cell => {
      cell.addEventListener('mouseenter', (e) => this.showTooltip(e));
      cell.addEventListener('mouseleave', () => this.hideTooltip());
    });
  }

  switchView(view) {
    this.currentView = view
    
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view)
    })
    
    // Update content
    const contentContainer = document.querySelector('.container')
    contentContainer.innerHTML = `
      ${this.renderHeader()}
      ${this.renderNavigation()}
      ${this.renderCurrentView()}
    `
    
    // Re-setup event listeners
    setTimeout(() => this.setupEventListeners(), 100)
  }

  async saveGoals() {
    const dailyGoal = parseInt(document.getElementById('dailyGoal').value)
    const weeklyGoal = parseInt(document.getElementById('weeklyGoal').value)
    const monthlyGoal = parseInt(document.getElementById('monthlyGoal').value)
    
    this.goals = {
      daily: dailyGoal,
      weekly: weeklyGoal,
      monthly: monthlyGoal
    }
    
    try {
      await chrome.storage.local.set({ goals: this.goals })
      console.log("[Stats] Goals saved successfully")
      
      // Recalculate stats with new goals
      await this.calculateAdvancedStats()
      
      // Switch back to goals view to show updated progress
      this.switchView('goals')
      
    } catch (error) {
      console.error("[Stats] Error saving goals:", error)
    }
  }

  cancelGoalsEdit() {
    document.querySelector('.goal-settings').style.display = 'none'
    document.getElementById('editGoalsBtn').style.display = 'inline-block'
    
    // Reset input values
    document.getElementById('dailyGoal').value = this.goals.daily
    document.getElementById('weeklyGoal').value = this.goals.weekly
    document.getElementById('monthlyGoal').value = this.goals.monthly
  }

  showTooltip(e) {
    const cell = e.currentTarget;
    this.tooltipElement.textContent = cell.title;

    const rect = cell.getBoundingClientRect();
    // **FIX**: The positioning was incorrect for a fixed tooltip.
    this.tooltipElement.style.position = 'fixed';
    this.tooltipElement.style.left = `${rect.left + rect.width / 2}px`;
    this.tooltipElement.style.top = `${rect.top - 10}px`;
    this.tooltipElement.style.transform = 'translate(-50%, -100%)';
    this.tooltipElement.style.display = 'block';
  }

  hideTooltip() {
    if (this.tooltipElement) {
        this.tooltipElement.style.display = 'none';
    }
  }

  showError(message) {
    document.body.innerHTML = `
      <div class="error-state">
        <div class="error-icon">❌</div>
        <h3>Error Loading Statistics</h3>
        <p>${message}</p>
        <button class="retry-btn" onclick="window.location.reload()">Retry</button>
      </div>
    `
  }
}

// Initialize stats page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("[Stats] DOM loaded, initializing stats")
  new PomodoroStats()
})
