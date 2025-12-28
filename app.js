// Focus Writer - Cold Turkey Writer Clone
// A distraction-free writing application with timed sessions

class FocusWriter {
    constructor() {
        // DOM Elements
        this.editor = document.getElementById('editor');
        this.wordCount = document.getElementById('wordCount');
        this.charCount = document.getElementById('charCount');
        this.readingTime = document.getElementById('readingTime');
        this.saveStatus = document.getElementById('saveStatus');
        this.themeToggle = document.getElementById('themeToggle');
        this.timerBtn = document.getElementById('timerBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.topBar = document.getElementById('topBar');
        this.bottomBar = document.getElementById('bottomBar');

        // Settings Panel Elements
        this.settingsPanel = document.getElementById('settingsPanel');
        this.closeSettings = document.getElementById('closeSettings');
        this.hoursInput = document.getElementById('hoursInput');
        this.minutesInput = document.getElementById('minutesInput');
        this.presetBtns = document.querySelectorAll('.preset-btn');
        this.strictMode = document.getElementById('strictMode');
        this.startSession = document.getElementById('startSession');

        // Timer Elements
        this.sessionTimer = document.getElementById('sessionTimer');
        this.timerDisplay = document.getElementById('timerDisplay');
        this.lockScreen = document.getElementById('lockScreen');
        this.lockTimer = document.getElementById('lockTimer');
        this.lockWordCount = document.getElementById('lockWordCount');
        this.progressFill = document.getElementById('progressFill');

        // Emergency Exit Elements
        this.emergencyExit = document.getElementById('emergencyExit');
        this.emergencyInput = document.getElementById('emergencyInput');
        this.cancelEmergency = document.getElementById('cancelEmergency');

        // State
        this.saveTimeout = null;
        this.typingTimeout = null;
        this.timerInterval = null;
        this.sessionActive = false;
        this.sessionDuration = 0;
        this.timeRemaining = 0;
        this.isStrictMode = true;
        this.startWordCount = 0;

        // Storage keys
        this.STORAGE_KEY = 'focuswriter_content';
        this.THEME_KEY = 'focuswriter_theme';
        this.SESSION_KEY = 'focuswriter_session';

        this.init();
    }

    init() {
        this.loadContent();
        this.loadTheme();
        this.restoreSession();
        this.bindEvents();
        this.updateStats();
    }

    bindEvents() {
        // Editor events
        this.editor.addEventListener('input', () => this.handleInput());
        this.editor.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Timer button
        this.timerBtn.addEventListener('click', () => this.openSettings());

        // Fullscreen button
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

        // Settings panel
        this.closeSettings.addEventListener('click', () => this.closeSettingsPanel());
        this.settingsPanel.addEventListener('click', (e) => {
            if (e.target === this.settingsPanel) this.closeSettingsPanel();
        });

        // Preset buttons
        this.presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const minutes = parseInt(btn.dataset.minutes);
                this.hoursInput.value = Math.floor(minutes / 60);
                this.minutesInput.value = minutes % 60;
            });
        });

        // Start session
        this.startSession.addEventListener('click', () => this.startTimedSession());

        // Emergency exit
        this.emergencyInput.addEventListener('input', () => this.checkEmergencyExit());
        this.cancelEmergency.addEventListener('click', () => this.hideEmergencyExit());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));

        // Prevent leaving during session
        window.addEventListener('beforeunload', (e) => {
            if (this.sessionActive && this.isStrictMode) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        });

        // Handle visibility change (prevent tab switching in strict mode)
        document.addEventListener('visibilitychange', () => {
            if (this.sessionActive && this.isStrictMode && document.hidden) {
                // Flash the lock screen when user tries to leave
                this.lockScreen.classList.remove('hidden');
            }
        });
    }

    handleInput() {
        this.updateStats();
        this.scheduleSave();
        this.showTypingMode();

        // Update lock screen word count
        if (this.sessionActive) {
            const currentWords = this.getWordCount();
            this.lockWordCount.textContent = currentWords - this.startWordCount;
        }
    }

    handleKeydown(e) {
        // Allow Tab for indentation
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.editor.selectionStart;
            const end = this.editor.selectionEnd;
            const value = this.editor.value;
            this.editor.value = value.substring(0, start) + '\t' + value.substring(end);
            this.editor.selectionStart = this.editor.selectionEnd = start + 1;
            this.handleInput();
        }
    }

    handleGlobalKeydown(e) {
        // Escape to show emergency exit during strict session
        if (e.key === 'Escape' && this.sessionActive && this.isStrictMode) {
            e.preventDefault();
            this.showEmergencyExit();
        }

        // Cmd/Ctrl + S to save
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            this.saveContent();
        }

        // Cmd/Ctrl + Shift + F for fullscreen
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
            e.preventDefault();
            this.toggleFullscreen();
        }
    }

    showTypingMode() {
        document.body.classList.add('typing');

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            document.body.classList.remove('typing');
        }, 2000);
    }

    getWordCount() {
        const text = this.editor.value.trim();
        if (!text) return 0;
        return text.split(/\s+/).filter(word => word.length > 0).length;
    }

    getCharCount() {
        return this.editor.value.length;
    }

    updateStats() {
        const words = this.getWordCount();
        const chars = this.getCharCount();
        const minutes = Math.ceil(words / 200); // Average reading speed

        this.wordCount.textContent = words.toLocaleString();
        this.charCount.textContent = chars.toLocaleString();
        this.readingTime.textContent = `${minutes} min`;
    }

    // Auto-save functionality
    scheduleSave() {
        this.saveStatus.textContent = 'Saving...';
        this.saveStatus.className = 'save-status saving';

        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.saveContent();
        }, 1000);
    }

    saveContent() {
        try {
            localStorage.setItem(this.STORAGE_KEY, this.editor.value);
            this.saveStatus.textContent = 'All changes saved';
            this.saveStatus.className = 'save-status saved';
        } catch (e) {
            this.saveStatus.textContent = 'Error saving';
            this.saveStatus.className = 'save-status';
            console.error('Failed to save:', e);
        }
    }

    loadContent() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            this.editor.value = saved;
        }
    }

    // Theme functionality
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem(this.THEME_KEY, newTheme);
    }

    loadTheme() {
        const savedTheme = localStorage.getItem(this.THEME_KEY);
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }

    // Fullscreen functionality
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Fullscreen not available:', err);
            });
            document.body.classList.add('fullscreen');
        } else {
            document.exitFullscreen();
            document.body.classList.remove('fullscreen');
        }
    }

    // Settings panel
    openSettings() {
        if (this.sessionActive) return;
        this.settingsPanel.classList.remove('hidden');
    }

    closeSettingsPanel() {
        this.settingsPanel.classList.add('hidden');
    }

    // Timed session functionality
    startTimedSession() {
        const hours = parseInt(this.hoursInput.value) || 0;
        const minutes = parseInt(this.minutesInput.value) || 0;
        const totalSeconds = (hours * 60 + minutes) * 60;

        if (totalSeconds < 60) {
            alert('Please set at least 1 minute for your session.');
            return;
        }

        this.sessionDuration = totalSeconds;
        this.timeRemaining = totalSeconds;
        this.isStrictMode = this.strictMode.checked;
        this.startWordCount = this.getWordCount();
        this.sessionActive = true;

        // Save session to localStorage
        this.saveSession();

        // Close settings and show timer
        this.closeSettingsPanel();
        this.sessionTimer.classList.remove('hidden');

        // Start the timer
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => this.tick(), 1000);

        // Show lock screen if strict mode
        if (this.isStrictMode) {
            this.lockScreen.classList.remove('hidden');
            this.lockWordCount.textContent = '0';
        }

        // Focus editor
        this.editor.focus();
    }

    tick() {
        this.timeRemaining--;
        this.updateTimerDisplay();
        this.saveSession();

        // Update progress bar
        const progress = ((this.sessionDuration - this.timeRemaining) / this.sessionDuration) * 100;
        this.progressFill.style.width = `${progress}%`;

        if (this.timeRemaining <= 0) {
            this.endSession();
        }
    }

    updateTimerDisplay() {
        const hours = Math.floor(this.timeRemaining / 3600);
        const minutes = Math.floor((this.timeRemaining % 3600) / 60);
        const seconds = this.timeRemaining % 60;

        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        this.timerDisplay.textContent = timeString;
        this.lockTimer.textContent = timeString;
    }

    endSession() {
        clearInterval(this.timerInterval);
        this.sessionActive = false;

        // Clear saved session
        localStorage.removeItem(this.SESSION_KEY);

        // Hide UI elements
        this.sessionTimer.classList.add('hidden');
        this.lockScreen.classList.add('hidden');
        this.emergencyExit.classList.add('hidden');

        // Show completion notification
        const wordsWritten = this.getWordCount() - this.startWordCount;
        this.showNotification(`Session complete! You wrote ${wordsWritten} words.`);

        // Play sound if available
        this.playCompletionSound();
    }

    saveSession() {
        const sessionData = {
            duration: this.sessionDuration,
            remaining: this.timeRemaining,
            strict: this.isStrictMode,
            startWords: this.startWordCount,
            timestamp: Date.now()
        };
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
    }

    restoreSession() {
        const saved = localStorage.getItem(this.SESSION_KEY);
        if (!saved) return;

        try {
            const session = JSON.parse(saved);

            // Check if session is still valid (within last 24 hours)
            const hoursSince = (Date.now() - session.timestamp) / (1000 * 60 * 60);
            if (hoursSince > 24) {
                localStorage.removeItem(this.SESSION_KEY);
                return;
            }

            // Calculate how much time has passed
            const secondsPassed = Math.floor((Date.now() - session.timestamp) / 1000);
            const adjustedRemaining = session.remaining - secondsPassed;

            if (adjustedRemaining > 0) {
                this.sessionDuration = session.duration;
                this.timeRemaining = adjustedRemaining;
                this.isStrictMode = session.strict;
                this.startWordCount = session.startWords;
                this.sessionActive = true;

                // Show timer UI
                this.sessionTimer.classList.remove('hidden');
                if (this.isStrictMode) {
                    this.lockScreen.classList.remove('hidden');
                }

                // Start timer
                this.updateTimerDisplay();
                this.timerInterval = setInterval(() => this.tick(), 1000);
            } else {
                // Session expired while away
                localStorage.removeItem(this.SESSION_KEY);
            }
        } catch (e) {
            localStorage.removeItem(this.SESSION_KEY);
        }
    }

    // Emergency exit functionality
    showEmergencyExit() {
        this.emergencyExit.classList.remove('hidden');
        this.emergencyInput.value = '';
        this.emergencyInput.focus();
    }

    hideEmergencyExit() {
        this.emergencyExit.classList.add('hidden');
        this.emergencyInput.value = '';
        this.editor.focus();
    }

    checkEmergencyExit() {
        if (this.emergencyInput.value.toUpperCase() === 'EMERGENCY EXIT') {
            this.endSession();
        }
    }

    // Notifications
    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--accent-color);
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            z-index: 3000;
            animation: slideDown 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    playCompletionSound() {
        // Create a simple completion sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
            oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
            oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            // Audio not available
        }
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    window.focusWriter = new FocusWriter();
});

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }

    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);
