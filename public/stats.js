// Stats page script for Pomodoro Timer Chrome Extension

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
      monthlyStats: {}
    }
    
    this.initializeStats()
  }

  async initializeStats() {
    console.log("[v0] Initializing stats page")
    
    try {
      await this.loadStats()
      this.renderStats()
      this.setupEventListeners()
    } catch (error) {
      console.error("[v0] Error initializing stats:", error)
      this.showError("Failed to load statistics")
    }
  }

  async loadStats() {
    try {
      const result = await chrome.storage.local.get(['dailyStats', 'totalSessions', 'settings'])
      
      this.stats.dailyStats = result.dailyStats || {}
      this.stats.totalSessions = result.totalSessions || 0
      
      // Calculate additional stats
      this.calculateStats()
      
      console.log("[v0] Stats loaded:", this.stats)
    } catch (error) {
      console.error("[v0] Error loading stats:", error)
      throw error
    }
  }

  calculateStats() {
    // Calculate totals from daily stats
    let totalFocusTime = 0
    let totalBreakTime = 0
    let totalSessions = 0
    let maxSessionsInDay = 0

    Object.values(this.stats.dailyStats).forEach(day => {
      totalFocusTime += day.focusTime || 0
      totalBreakTime += day.breakTime || 0
      totalSessions += day.focusSessions || 0
      maxSessionsInDay = Math.max(maxSessionsInDay, day.focusSessions || 0)
    })

    this.stats.totalFocusTime = totalFocusTime
    this.stats.totalBreakTime = totalBreakTime
    this.stats.totalSessions = totalSessions
    this.stats.averageSessionLength = totalSessions > 0 ? Math.round(totalFocusTime / totalSessions) : 0
    this.stats.longestStreak = this.calculateLongestStreak()
    this.stats.currentStreak = this.calculateCurrentStreak()

    // Calculate weekly and monthly stats
    this.calculateWeeklyStats()
    this.calculateMonthlyStats()
  }

  calculateLongestStreak() {
    const dates = Object.keys(this.stats.dailyStats).sort()
    let longestStreak = 0
    let currentStreak = 0

    for (let i = 0; i < dates.length; i++) {
      const day = this.stats.dailyStats[dates[i]]
      if (day.focusSessions > 0) {
        currentStreak++
        longestStreak = Math.max(longestStreak, currentStreak)
      } else {
        currentStreak = 0
      }
    }

    return longestStreak
  }

  calculateCurrentStreak() {
    const dates = Object.keys(this.stats.dailyStats).sort()
    let currentStreak = 0

    for (let i = dates.length - 1; i >= 0; i--) {
      const day = this.stats.dailyStats[dates[i]]
      if (day.focusSessions > 0) {
        currentStreak++
      } else {
        break
      }
    }

    return currentStreak
  }

  calculateWeeklyStats() {
    const now = new Date()
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
    
    this.stats.weeklyStats = {
      focusSessions: 0,
      focusTime: 0,
      breakTime: 0
    }

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      
      if (this.stats.dailyStats[dateStr]) {
        const day = this.stats.dailyStats[dateStr]
        this.stats.weeklyStats.focusSessions += day.focusSessions || 0
        this.stats.weeklyStats.focusTime += day.focusTime || 0
        this.stats.weeklyStats.breakTime += day.breakTime || 0
      }
    }
  }

  calculateMonthlyStats() {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    this.stats.monthlyStats = {
      focusSessions: 0,
      focusTime: 0,
      breakTime: 0
    }

    for (let i = 0; i < now.getDate(); i++) {
      const date = new Date(monthStart)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      
      if (this.stats.dailyStats[dateStr]) {
        const day = this.stats.dailyStats[dateStr]
        this.stats.monthlyStats.focusSessions += day.focusSessions || 0
        this.stats.monthlyStats.focusTime += day.focusTime || 0
        this.stats.monthlyStats.breakTime += day.breakTime || 0
      }
    }
  }

  setupEventListeners() {
    // Add any event listeners if needed
  }

  renderStats() {
    if (this.stats.totalSessions === 0 && Object.keys(this.stats.dailyStats).length === 0) {
      this.showEmptyState()
      return
    }

    this.renderOverviewStats()
    this.renderHeatmap()
    this.renderTimeline()
  }

  renderOverviewStats() {
    const container = document.querySelector('.stats-grid')
    if (!container) return

    container.innerHTML = `
      <div class="stat-card">
        <h3>Total Sessions</h3>
        <div class="stat-value">${this.stats.totalSessions}</div>
        <div class="stat-label">Focus sessions completed</div>
      </div>
      
      <div class="stat-card">
        <h3>Focus Time</h3>
        <div class="stat-value">${Math.round(this.stats.totalFocusTime / 60)}h</div>
        <div class="stat-label">Total hours focused</div>
      </div>
      
      <div class="stat-card">
        <h3>Current Streak</h3>
        <div class="stat-value">${this.stats.currentStreak}</div>
        <div class="stat-label">Days in a row</div>
      </div>
      
      <div class="stat-card">
        <h3>Longest Streak</h3>
        <div class="stat-value">${this.stats.longestStreak}</div>
        <div class="stat-label">Best streak</div>
      </div>
    `
  }

  renderHeatmap() {
    const container = document.querySelector('.heatmap-container')
    if (!container) return

    const heatmapData = this.generateHeatmapData()
    
    container.innerHTML = `
      <h2>Activity Heatmap</h2>
      <div class="heatmap">
        ${this.generateHeatmapHTML(heatmapData)}
      </div>
    `
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

  generateHeatmapHTML(data) {
    const dates = Object.keys(data).sort()
    const weeks = []
    let currentWeek = []
    
    // Group dates into weeks (7 days per week)
    for (let i = 0; i < dates.length; i++) {
      currentWeek.push({ date: dates[i], ...data[dates[i]] })
      
      if (currentWeek.length === 7 || i === dates.length - 1) {
        // Pad the last week if it's not complete
        while (currentWeek.length < 7) {
          currentWeek.push({ date: '', sessions: 0, time: 0, level: 0 })
        }
        weeks.push([...currentWeek])
        currentWeek = []
      }
    }
    
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    
    return `
      <div class="heatmap-row">
        <div class="heatmap-day-label"></div>
        ${dayLabels.map(day => `<div class="heatmap-day-label">${day}</div>`).join('')}
      </div>
      ${weeks.map(week => `
        <div class="heatmap-row">
          <div class="heatmap-day-label">${this.getWeekLabel(week[0]?.date)}</div>
          <div class="heatmap-week">
            ${week.map(day => `
              <div class="heatmap-cell" 
                   data-level="${day.level}" 
                   data-date="${day.date}"
                   data-sessions="${day.sessions}"
                   data-time="${day.time}"
                   title="${this.getTooltipText(day)}">
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    `
  }

  getWeekLabel(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  getTooltipText(day) {
    if (!day.date || day.sessions === 0) {
      return "No activity"
    }
    return `${day.date}: ${day.sessions} sessions (${Math.round(day.time / 60)}h)`
  }

  renderTimeline() {
    const container = document.querySelector('.timeline-container')
    if (!container) return

    const recentActivity = this.getRecentActivity()
    
    if (recentActivity.length === 0) {
      container.innerHTML = `
        <h2>Recent Activity</h2>
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <h3>No activity yet</h3>
          <p>Start your first focus session to see your activity timeline here.</p>
        </div>
      `
      return
    }

    container.innerHTML = `
      <h2>Recent Activity</h2>
      <div class="timeline">
        ${recentActivity.map(activity => `
          <div class="timeline-item">
            <div class="timeline-icon focus">🍅</div>
            <div class="timeline-content">
              <div class="timeline-title">${activity.sessions} focus session${activity.sessions > 1 ? 's' : ''}</div>
              <div class="timeline-time">${activity.date}</div>
              <div class="timeline-duration">${Math.round(activity.time / 60)} hours focused</div>
            </div>
          </div>
        `).join('')}
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
      return {
        date: new Date(date).toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        }),
        sessions: day.focusSessions || 0,
        time: day.focusTime || 0
      }
    }).filter(activity => activity.sessions > 0)
  }

  showEmptyState() {
    const container = document.querySelector('.container')
    if (!container) return

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <h3>No Statistics Available</h3>
        <p>Start using the Pomodoro timer to see your productivity statistics here.</p>
      </div>
    `
  }

  showError(message) {
    const container = document.querySelector('.container')
    if (!container) return

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <h3>Error Loading Statistics</h3>
        <p>${message}</p>
      </div>
    `
  }
}

// Initialize stats page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] DOM loaded, initializing stats")
  new PomodoroStats()
})
