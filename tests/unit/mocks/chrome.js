// Basic mock of the chrome API for Jest tests.
global.chrome = {
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
    },
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
    onStartup: {
      addListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
    sendMessage: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(() => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve()),
    },
    onChanged: {
      addListener: jest.fn(),
    },
  },
  notifications: {
    create: jest.fn(),
  },
  tabs: {
      remove: jest.fn(),
  }
};
