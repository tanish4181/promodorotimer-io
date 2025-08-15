// Statistics page script for Pomodoro Timer Chrome Extension
const chrome = window.chrome // Declare the chrome variable

class PomodoroStats {
  constructor() {
    this.currentPeriod = "week"
    this.charts = {}
    this.data = {
      dailyStats: {},
      totalSessions: 0,
      settings: {},
    }

    this.initializeStats()
  }

  async initializeStats() {
    await this.loadData()
    this.bindEventListeners()
    this.renderOverviewStats()
    this.renderCharts()
    this.renderHeatmap()
    this.renderInsights()
    this.renderDetailedStats()
  }

  async loadData() {
    try {
      const result = await chrome.storage.local.get(["dailyStats", "totalSessions", "settings"])

      this.data = {
        dailyStats: result.dailyStats || {},
        totalSessions: result.totalSessions || 0,
        settings: result.settings || {},
      }

      console.log("[v0] Stats data loaded:", this.data)
    } catch (error) {
      console.error("[v0] Error loading stats data:", error)
    }
  }

  bindEventListeners() {
    // Period selector
    document.querySelectorAll(".period-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        document.querySelectorAll(".period-tab").forEach((t) => t.classList.remove("active"))
        e.target.classList.add("active")
        this.currentPeriod = e.target.dataset.period
        this.updateChartsForPeriod()
      })
    })

    // Action buttons
    document.getElementById("export-stats").addEventListener("click", () => this.exportStats())
    document.getElementById("settings-btn").addEventListener("click", () => this.openSettings())
    document.getElementById("clear-stats").addEventListener("click", () => this.clearStats())
  }

  renderOverviewStats() {
    const stats = this.calculateOverviewStats()

    document.getElementById("total-sessions").textContent = stats.totalSessions
    document.getElementById("total-focus-time").textContent = this.formatTime(stats.totalFocusTime)
    document.getElementById("break-adherence").textContent = `${stats.breakAdherence}%`
    document.getElementById("productivity-score").textContent = stats.productivityScore
  }

  calculateOverviewStats() {
    const dailyStats = this.data.dailyStats
    let totalSessions = 0
    let totalFocusTime = 0
    let totalBreaks = 0
    let breaksSkipped = 0

    Object.values(dailyStats).forEach((day) => {
      totalSessions += day.focusSessions || 0
      totalFocusTime += day.totalFocusTime || 0
      totalBreaks += day.breaks || 0
      breaksSkipped += day.breaksSkipped || 0
    })

    const breakAdherence = totalBreaks > 0 ? Math.round(((totalBreaks - breaksSkipped) / totalBreaks) * 100) : 0

    const productivityScore = this.calculateProductivityScore(totalSessions, totalFocusTime, breakAdherence)

    return {
      totalSessions,
      totalFocusTime,
      breakAdherence,
      productivityScore,
    }
  }

  calculateProductivityScore(sessions, focusTime, breakAdherence) {
    // Simple scoring algorithm
    const sessionScore = Math.min(sessions * 2, 40) // Max 40 points for sessions
    const timeScore = Math.min(focusTime / 60, 30) // Max 30 points for hours
    const breakScore = (breakAdherence / 100) * 30 // Max 30 points for break adherence

    return Math.round(sessionScore + timeScore + breakScore)
  }

  renderCharts() {
    this.renderDailyFocusChart()
    this.renderSessionDistributionChart()
  }

  renderDailyFocusChart() {
    const ctx = document.getElementById("daily-focus-chart").getContext("2d")
    const data = this.getDailyFocusData()

    if (this.charts.dailyFocus) {
      this.charts.dailyFocus.destroy()
    }

    const Chart = window.Chart // Use Chart.js from CDN
    this.charts.dailyFocus = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.labels,
        datasets: [
          {
            label: "Focus Time (minutes)",
            data: data.values,
            borderColor: "#8b5cf6",
            backgroundColor: "rgba(139, 92, 246, 0.1)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: "#e5e7eb",
            },
          },
          x: {
            grid: {
              color: "#e5e7eb",
            },
          },
        },
      },
    })
  }

  renderSessionDistributionChart() {
    const ctx = document.getElementById("session-distribution-chart").getContext("2d")
    const data = this.getSessionDistributionData()

    if (this.charts.sessionDistribution) {
      this.charts.sessionDistribution.destroy()
    }

    const Chart = window.Chart // Use Chart.js from CDN
    this.charts.sessionDistribution = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Completed Sessions", "Incomplete Sessions", "Breaks Taken", "Breaks Skipped"],
        datasets: [
          {
            data: data.values,
            backgroundColor: ["#8b5cf6", "#e5e7eb", "#34d399", "#fbbf24"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 20,
              usePointStyle: true,
            },
          },
        },
      },
    })
  }

  getDailyFocusData() {
    const days = this.getDateRange()
    const labels = []
    const values = []

    days.forEach((date) => {
      const dateStr = date.toDateString()
      const dayData = this.data.dailyStats[dateStr]

      labels.push(date.toLocaleDateString("en-US", { month: "short", day: "numeric" }))
      values.push(dayData ? dayData.totalFocusTime || 0 : 0)
    })

    return { labels, values }
  }

  getSessionDistributionData() {
    const stats = this.calculateOverviewStats()
    return {
      values: [
        stats.totalSessions,
        Math.max(0, stats.totalSessions * 0.1), // Estimated incomplete
        stats.totalSessions * 0.8, // Estimated breaks taken
        stats.totalSessions * 0.2, // Estimated breaks skipped
      ],
    }
  }

  getDateRange() {
    const today = new Date()
    const days = []

    let daysBack = 7
    if (this.currentPeriod === "month") daysBack = 30
    if (this.currentPeriod === "year") daysBack = 365
    if (this.currentPeriod === "all") daysBack = 365 // Max 1 year for performance

    for (let i = daysBack - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      days.push(date)
    }

    return days
  }

  renderHeatmap() {
    const heatmapContainer = document.getElementById("weekly-heatmap")
    heatmapContainer.innerHTML = ""

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const hours = Array.from({ length: 24 }, (_, i) => i)

    // Create header row
    const headerRow = document.createElement("div")
    headerRow.style.gridColumn = "1 / -1"
    headerRow.style.display = "grid"
    headerRow.style.gridTemplateColumns = "repeat(25, 1fr)"
    headerRow.style.gap = "2px"
    headerRow.style.marginBottom = "8px"

    // Empty cell for day labels
    const emptyCell = document.createElement("div")
    headerRow.appendChild(emptyCell)

    // Hour labels
    for (let hour = 0; hour < 24; hour++) {
      const hourLabel = document.createElement("div")
      hourLabel.textContent = hour % 6 === 0 ? `${hour}h` : ""
      hourLabel.style.fontSize = "10px"
      hourLabel.style.textAlign = "center"
      hourLabel.style.color = "var(--text-muted)"
      headerRow.appendChild(hourLabel)
    }

    heatmapContainer.appendChild(headerRow)

    // Create heatmap grid
    days.forEach((day, dayIndex) => {
      const dayRow = document.createElement("div")
      dayRow.style.display = "grid"
      dayRow.style.gridTemplateColumns = "repeat(25, 1fr)"
      dayRow.style.gap = "2px"
      dayRow.style.marginBottom = "2px"

      // Day label
      const dayLabel = document.createElement("div")
      dayLabel.textContent = day
      dayLabel.style.fontSize = "12px"
      dayLabel.style.fontWeight = "500"
      dayLabel.style.display = "flex"
      dayLabel.style.alignItems = "center"
      dayLabel.style.color = "var(--text-primary)"
      dayRow.appendChild(dayLabel)

      // Hour cells
      hours.forEach((hour) => {
        const cell = document.createElement("div")
        cell.className = "heatmap-day"

        // Calculate activity level (mock data for now)
        const activity = Math.random() * 4
        const intensity = Math.floor(activity)

        const colors = [
          "#f1f5f9", // No activity
          "rgba(139, 92, 246, 0.2)", // Low
          "rgba(139, 92, 246, 0.5)", // Medium
          "rgba(139, 92, 246, 0.8)", // High
          "#8b5cf6", // Very high
        ]

        cell.style.backgroundColor = colors[intensity]
        cell.title = `${day} ${hour}:00 - ${activity.toFixed(1)} sessions`

        dayRow.appendChild(cell)
      })

      heatmapContainer.appendChild(dayRow)
    })
  }

  renderInsights() {
    const insights = this.generateInsights()
    const container = document.getElementById("insights-container")
    container.innerHTML = ""

    insights.forEach((insight) => {
      const card = document.createElement("div")
      card.className = "insight-card"
      card.innerHTML = `
        <h4>${insight.title}</h4>
        <p>${insight.description}</p>
      `
      container.appendChild(card)
    })
  }

  generateInsights() {
    const stats = this.calculateOverviewStats()
    const insights = []

    // Productivity insights
    if (stats.productivityScore >= 80) {
      insights.push({
        title: "Excellent Productivity!",
        description: "You're maintaining great focus habits. Keep up the excellent work!",
      })
    } else if (stats.productivityScore >= 60) {
      insights.push({
        title: "Good Progress",
        description: "You're building solid productivity habits. Consider increasing your daily focus sessions.",
      })
    } else {
      insights.push({
        title: "Room for Improvement",
        description: "Try to complete more focus sessions and take regular breaks to boost your productivity score.",
      })
    }

    // Break adherence insights
    if (stats.breakAdherence < 70) {
      insights.push({
        title: "Take More Breaks",
        description: "You're skipping too many breaks. Regular breaks help maintain focus and prevent burnout.",
      })
    }

    // Session insights
    if (stats.totalSessions > 50) {
      insights.push({
        title: "Consistency Champion",
        description: "You've completed many focus sessions! This consistency will lead to great results.",
      })
    }

    return insights
  }

  renderDetailedStats() {
    const stats = this.calculateDetailedStats()

    document.getElementById("completed-sessions").textContent = stats.completedSessions
    document.getElementById("avg-session-duration").textContent = `${stats.avgSessionDuration} min`
    document.getElementById("longest-streak").textContent = `${stats.longestStreak} days`
    document.getElementById("breaks-taken").textContent = stats.breaksTaken
    document.getElementById("breaks-skipped").textContent = stats.breaksSkipped
    document.getElementById("avg-break-duration").textContent = `${stats.avgBreakDuration} min`
    document.getElementById("morning-time").textContent = `${stats.morningTime}%`
    document.getElementById("afternoon-time").textContent = `${stats.afternoonTime}%`
    document.getElementById("evening-time").textContent = `${stats.eveningTime}%`
  }

  calculateDetailedStats() {
    const dailyStats = this.data.dailyStats
    let completedSessions = 0
    let totalFocusTime = 0
    let breaksTaken = 0
    let breaksSkipped = 0
    let totalBreakTime = 0

    Object.values(dailyStats).forEach((day) => {
      completedSessions += day.focusSessions || 0
      totalFocusTime += day.totalFocusTime || 0
      breaksTaken += day.breaks || 0
      breaksSkipped += day.breaksSkipped || 0
      totalBreakTime += day.totalBreakTime || 0
    })

    const avgSessionDuration = completedSessions > 0 ? Math.round(totalFocusTime / completedSessions) : 0
    const avgBreakDuration = breaksTaken > 0 ? Math.round(totalBreakTime / breaksTaken) : 0

    // Mock data for time distribution and streak
    const morningTime = 35
    const afternoonTime = 45
    const eveningTime = 20
    const longestStreak = 7

    return {
      completedSessions,
      avgSessionDuration,
      longestStreak,
      breaksTaken,
      breaksSkipped,
      avgBreakDuration,
      morningTime,
      afternoonTime,
      eveningTime,
    }
  }

  updateChartsForPeriod() {
    this.renderCharts()
  }

  formatTime(minutes) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  async exportStats() {
    try {
      const exportData = {
        ...this.data,
        exportDate: new Date().toISOString(),
        summary: this.calculateOverviewStats(),
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `pomodoro-stats-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("[v0] Error exporting stats:", error)
    }
  }

  openSettings() {
    chrome.runtime.openOptionsPage()
  }

  async clearStats() {
    if (!confirm("Are you sure you want to clear all statistics? This action cannot be undone.")) {
      return
    }

    try {
      await chrome.storage.local.remove(["dailyStats", "totalSessions"])
      location.reload()
    } catch (error) {
      console.error("[v0] Error clearing stats:", error)
    }
  }
}

// Initialize stats page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new PomodoroStats()
})
