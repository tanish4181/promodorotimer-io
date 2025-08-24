// Import the class we want to test
const PomodoroBackground = require('../../public/background.js');
// Import our mock
require('./mocks/chrome.js');

// Mock Date.now() to control time in tests
const RealDate = Date;
const mockDateNow = (timestamp) => {
  global.Date.now = jest.fn(() => timestamp);
};

describe('PomodoroBackground', () => {
  let background;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Set a consistent start time for all tests
    mockDateNow(new Date('2023-01-01T12:00:00.000Z').getTime());
    // We need to import the class *after* mocking chrome
    // This is tricky. Let's assume the global mock works or we find a better way.
    // For now, let's reinstantiate the class. The constructor calls initialize().
    // We need to prevent initialize from running in the constructor for pure unit tests.

    // A better approach: dynamic import or manual instantiation.
    // Let's manually create an instance without calling initialize, then call it with mocked storage.
    background = new PomodoroBackground();
  });

  afterEach(() => {
    global.Date = RealDate;
  });

  describe('Timer Logic', () => {
    it('should start the timer and set a targetCompletionTime', async () => {
      background.state.currentTime = 1500; // 25 minutes
      await background.startTimer();

      expect(background.state.isRunning).toBe(true);
      const expectedTarget = Date.now() + 1500 * 1000;
      expect(background.state.targetCompletionTime).toBe(expectedTarget);
      expect(chrome.alarms.create).toHaveBeenCalledWith('pomodoroTimer', { periodInMinutes: 1 / 60 });
    });

    it('should accurately calculate remaining time after a delay (simulating sleep)', () => {
      // Start with a 25 minute timer
      background.state.currentTime = 25 * 60;
      background.startTimer();

      const initialTarget = background.state.targetCompletionTime;

      // Simulate 10 minutes passing
      const futureTime = Date.now() + 10 * 60 * 1000;
      mockDateNow(futureTime);

      background.handleTimerTick();

      const expectedRemaining = Math.round((initialTarget - futureTime) / 1000);
      expect(background.state.currentTime).toBe(expectedRemaining);
      expect(background.state.currentTime).toBe(15 * 60); // Should be exactly 15 minutes left
    });

    it('should transition from focus to short break', async () => {
        background.state.currentMode = 'focus';
        background.state.currentTime = 0;
        await background.handleTimerComplete();

        expect(background.state.currentMode).toBe('shortBreak');
        expect(background.state.currentTime).toBe(background.state.settings.shortBreak * 60);
        expect(background.state.sessionCount).toBe(2);
    });

    it('should transition to long break after enough sessions', async () => {
        background.state.sessionCount = 4;
        background.state.settings.sessionsUntilLongBreak = 4;
        background.state.currentMode = 'focus';
        background.state.currentTime = 0;

        await background.handleTimerComplete();

        expect(background.state.currentMode).toBe('longBreak');
        expect(background.state.currentTime).toBe(background.state.settings.longBreak * 60);
    });
  });

  describe('Lock-In Mode', () => {
    it('should set lockInEndTime when starting a locked session', async () => {
        background.state.lockedInSessions = 4;
        await background.handleMessage({ type: 'START_TIMER_LOCKED' });

        expect(background.state.isLockedIn).toBe(true);
        expect(background.state.lockInEndTime).not.toBeNull();

        // Check if the time is roughly correct (4 focus + 3 short breaks)
        const focusTime = background.state.settings.focusTime * 60;
        const shortBreakTime = background.state.settings.shortBreak * 60;
        const expectedDuration = (4 * focusTime) + (3 * shortBreakTime);
        const expectedEndTime = Date.now() + expectedDuration * 1000;

        expect(background.state.lockInEndTime).toBeCloseTo(expectedEndTime, -3); // Accuracy within a few seconds
    });

    it('should disable lock-in mode if lockInEndTime has passed on load', async () => {
        const pastTime = Date.now() - 10000;
        chrome.storage.local.get.mockResolvedValue({
            timerState: 'focus',
            isLockedIn: true,
            lockInEndTime: pastTime
        });

        await background.loadState();

        expect(background.state.isLockedIn).toBe(false);
        expect(background.state.lockInEndTime).toBeNull();
    });
  });

  describe('URL Blocking', () => {
    beforeEach(() => {
        // Setup block/allow lists
        background.state.allowedWebsites = ['google.com/maps'];
        background.state.blockedWebsites = ['reddit.com/r/all', 'facebook.com'];
    });

    it('should not block an allowed URL, even if the domain is on the blocklist', () => {
        background.state.allowedWebsites.push('facebook.com/work');
        const result = background.isUrlBlocked('https://www.facebook.com/work/messages');
        expect(result.blocked).toBe(false);
    });

    it('should block a specific subreddit path', () => {
        const result = background.isUrlBlocked('https://www.reddit.com/r/all/top?t=day');
        expect(result.blocked).toBe(true);
    });

    it('should NOT block a different subreddit path', () => {
        const result = background.isUrlBlocked('https://www.reddit.com/r/programming');
        expect(result.blocked).toBe(false);
    });

    it('should block a base domain', () => {
        const result = background.isUrlBlocked('https://m.facebook.com/some/path');
        expect(result.blocked).toBe(true);
    });

    it('should correctly handle domain-only matching from a full URL in the list', () => {
        background.state.blockedWebsites = ['youtube.com'];
        const result = background.isUrlBlocked('https://www.youtube.com/watch?v=123');
        expect(result.blocked).toBe(true);
    });
  });

});
