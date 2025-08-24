document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-now-btn');
    if (startButton) {
        startButton.addEventListener('click', () => {
            // This will open the extension's popup.
            // Note: Programmatically opening the popup is restricted by browsers.
            // This alerts the user on how to open it.
            alert("Great! Click the Pomodoro Timer icon in your browser's toolbar to start.");
            // A better approach for installed pages is to direct them to options if needed.
            // Or simply close the welcome tab.
            window.close();
        });
    }
});