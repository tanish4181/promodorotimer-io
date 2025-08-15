# Advanced Pomodoro Timer Chrome Extension

A sophisticated Pomodoro timer Chrome extension with break enforcement, YouTube integration, website blocking, and productivity tracking features.

## Features

### 🍅 Core Timer Functionality
- **Focus Sessions**: 25-minute focus periods (customizable)
- **Short Breaks**: 5-minute breaks between sessions (customizable)
- **Long Breaks**: 15-minute breaks after 4 sessions (customizable)
- **Auto-start**: Automatically start breaks and focus sessions
- **Session Tracking**: Keep track of completed sessions

### 🎯 Productivity Features
- **Task Management**: Add and track tasks for each session
- **Website Blocking**: Block distracting websites during focus time
- **YouTube Integration**: Automatically pause videos and hide distractions
- **Break Enforcement**: Overlay to ensure you take proper breaks

### 📊 Statistics & Analytics
- **Daily Statistics**: Track focus time, sessions, and break adherence
- **Productivity Score**: Get insights into your productivity patterns
- **Export Data**: Export your statistics for analysis
- **Visual Charts**: See your progress with interactive charts

### ⚙️ Customization
- **Flexible Settings**: Customize timer durations and behavior
- **Notification Control**: Desktop notifications and sound alerts
- **Break Enforcement**: Choose how strictly breaks are enforced
- **Data Privacy**: All data stored locally on your device

## Installation

### Method 1: Load Unpacked Extension (Recommended)

1. **Download the Extension**
   - Clone or download this repository to your computer
   - Extract the files if downloaded as a ZIP

2. **Open Chrome Extensions Page**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner

3. **Load the Extension**
   - Click "Load unpacked" button
   - Select the `public` folder from the downloaded extension
   - The extension should now appear in your extensions list

4. **Pin the Extension**
   - Click the puzzle piece icon in Chrome's toolbar
   - Find "Advanced Pomodoro Timer" and click the pin icon

### Method 2: Install from Chrome Web Store (Coming Soon)
- The extension will be available on the Chrome Web Store soon

## Usage

### Getting Started

1. **Open the Extension**
   - Click the Pomodoro Timer icon in your Chrome toolbar
   - The popup will show the current timer state

2. **Start Your First Session**
   - Click "Start" to begin a 25-minute focus session
   - The timer will count down and show your progress
   - When the session ends, you'll get a notification

3. **Take Breaks**
   - After each focus session, take a short break
   - After 4 sessions, take a longer break
   - Use the "Skip Break" option if needed

### Task Management

1. **Add Tasks**
   - In the popup, use the "Focus Tasks" section
   - Type a task and click "+" or press Enter
   - Tasks are saved and persist between sessions

2. **Complete Tasks**
   - Click the checkbox next to a task to mark it complete
   - Completed tasks move to the "Completed" section
   - Delete tasks using the "×" button

### Website Blocking

1. **Add Blocked Websites**
   - In the popup, go to "Website Blocking" section
   - Enter website domains (e.g., "facebook.com")
   - Click "+" to add them to the blocked list

2. **Enable Blocking**
   - Toggle the blocking feature on/off
   - Websites are blocked during active focus sessions
   - You can pause the timer to access blocked sites

### YouTube Integration

1. **Automatic Features**
   - When you visit YouTube during a focus session, distractions are hidden
   - Comments, recommendations, and other distracting elements are removed
   - A focus mode indicator appears

2. **Break Enforcement**
   - During breaks, videos are automatically paused
   - A break overlay appears with options to skip or start the break
   - Videos resume when you return to focus mode

### Settings & Customization

1. **Access Settings**
   - Click the gear icon (⚙️) in the popup
   - Or right-click the extension icon and select "Options"

2. **Timer Settings**
   - Adjust focus time (1-120 minutes)
   - Set short break duration (1-30 minutes)
   - Configure long break duration (5-60 minutes)
   - Set sessions until long break (2-10)

3. **Automation**
   - Enable/disable auto-start for breaks and focus sessions
   - Control notification settings
   - Manage break enforcement strictness

### Statistics & Analytics

1. **View Statistics**
   - Click "View Stats" in the popup
   - Or access via the settings page

2. **Track Progress**
   - See total sessions completed
   - Monitor focus time and break adherence
   - View productivity score and insights

3. **Export Data**
   - Export your statistics as JSON
   - Use for personal analysis or backup

## Troubleshooting

### Common Issues

**Extension not working:**
- Make sure the extension is enabled in `chrome://extensions/`
- Try refreshing the page you're on
- Check the browser console for error messages

**Timer not updating:**
- The timer runs in the background, so it should continue even if the popup is closed
- If the timer stops, try refreshing the extension

**Website blocking not working:**
- Make sure website blocking is enabled in settings
- Check that the timer is running and in focus mode
- Verify the website domain is correctly added to the blocked list

**YouTube integration issues:**
- Ensure you're on a YouTube page (youtube.com)
- Check that YouTube integration is enabled in settings
- Try refreshing the YouTube page

### Reset Extension

If you encounter persistent issues:

1. Go to `chrome://extensions/`
2. Find "Advanced Pomodoro Timer"
3. Click "Remove" to uninstall
4. Reload the extension using "Load unpacked"

## Privacy & Data

- **Local Storage**: All data is stored locally on your device
- **No Tracking**: The extension doesn't collect or send any data
- **Export Control**: You can export and delete your data at any time
- **Open Source**: The code is open source and can be reviewed

## Development

### Project Structure

```
public/
├── manifest.json          # Extension manifest
├── background.js          # Background service worker
├── popup.html/js/css      # Main popup interface
├── options.html/js/css    # Settings page
├── stats.html/js/css      # Statistics page
├── content.js             # YouTube integration
├── blocker.js             # Website blocking
└── blocked.html           # Blocked website page
```

### Building from Source

1. Clone the repository
2. Make your changes to the files in the `public/` directory
3. Load the extension in Chrome using "Load unpacked"
4. Test your changes

### Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

This project is open source and available under the MIT License.

## Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Review the browser console for error messages
3. Create an issue in the project repository

---

**Happy focusing! 🍅✨**
