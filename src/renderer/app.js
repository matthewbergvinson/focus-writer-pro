/**
 * Focus Writer Pro - Renderer Process
 * Handles all UI logic, session management, and user interactions
 */

class FocusWriterApp {
  constructor() {
    // Screens
    this.welcomeScreen = document.getElementById('welcomeScreen');
    this.writingScreen = document.getElementById('writingScreen');
    this.completionScreen = document.getElementById('completionScreen');

    // Welcome Screen Elements
    this.themeToggle = document.getElementById('themeToggle');
    this.draftSection = document.getElementById('draftSection');
    this.noDraftSection = document.getElementById('noDraftSection');
    this.draftCard = document.getElementById('draftCard');
    this.draftPreview = document.getElementById('draftPreview');
    this.draftWordCount = document.getElementById('draftWordCount');
    this.draftLastEdited = document.getElementById('draftLastEdited');
    this.startFreshBtn = document.getElementById('startFreshBtn');
    this.goalTypeBtns = document.querySelectorAll('.goal-type-btn');
    this.wordCountInput = document.getElementById('wordCountInput');
    this.timeInput = document.getElementById('timeInput');
    this.wordGoal = document.getElementById('wordGoal');
    this.timeGoal = document.getElementById('timeGoal');
    this.presetBtns = document.querySelectorAll('.preset-btn');
    this.strictModeToggle = document.getElementById('strictModeToggle');
    this.startSessionBtn = document.getElementById('startSessionBtn');
    this.sessionStats = document.getElementById('sessionStats');

    // Writing Screen Elements
    this.progressFill = document.getElementById('progressFill');
    this.progressText = document.getElementById('progressText');
    this.editor = document.getElementById('editor');
    this.currentWords = document.getElementById('currentWords');
    this.currentChars = document.getElementById('currentChars');
    this.sessionTime = document.getElementById('sessionTime');
    this.saveIndicator = document.getElementById('saveIndicator');

    // Completion Screen Elements
    this.completionStats = document.getElementById('completionStats');
    this.saveExitBtn = document.getElementById('saveExitBtn');
    this.keepWritingBtn = document.getElementById('keepWritingBtn');

    // Modals
    this.emergencyModal = document.getElementById('emergencyModal');
    this.emergencyInput = document.getElementById('emergencyInput');
    this.cancelEmergency = document.getElementById('cancelEmergency');
    this.confirmFreshModal = document.getElementById('confirmFreshModal');
    this.cancelFresh = document.getElementById('cancelFresh');
    this.confirmFresh = document.getElementById('confirmFresh');

    // Session State
    this.session = {
      active: false,
      goalType: 'words', // 'words' or 'time'
      goalValue: 500,
      strictMode: true,
      startTime: null,
      startWordCount: 0,
      currentWordCount: 0,
      timerInterval: null,
      autoSaveInterval: null,
      elapsedSeconds: 0
    };

    // Settings
    this.settings = {
      theme: 'dark',
      fontSize: 'medium',
      fontFamily: 'serif'
    };

    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.loadDraft();
    await this.loadSessionHistory();
    this.bindEvents();
    this.applyTheme();

    // Listen for exit warnings from main process
    window.focusWriter.onShowExitWarning(() => {
      this.showEmergencyModal();
    });
  }

  // ==================== EVENT BINDING ====================

  bindEvents() {
    // Theme Toggle
    this.themeToggle.addEventListener('click', () => this.toggleTheme());

    // Goal Type Toggle
    this.goalTypeBtns.forEach(btn => {
      btn.addEventListener('click', () => this.setGoalType(btn.dataset.type));
    });

    // Preset Buttons
    this.presetBtns.forEach(btn => {
      btn.addEventListener('click', (e) => this.handlePresetClick(e));
    });

    // Goal Inputs
    this.wordGoal.addEventListener('input', () => this.updatePresetSelection());
    this.timeGoal.addEventListener('input', () => this.updatePresetSelection());

    // Draft Card Click
    this.draftCard.addEventListener('click', () => this.startSessionBtn.focus());

    // Start Fresh
    this.startFreshBtn.addEventListener('click', () => this.showConfirmFreshModal());
    this.cancelFresh.addEventListener('click', () => this.hideConfirmFreshModal());
    this.confirmFresh.addEventListener('click', () => this.confirmStartFresh());

    // Start Session
    this.startSessionBtn.addEventListener('click', () => this.startSession());

    // Editor
    this.editor.addEventListener('input', () => this.handleEditorInput());
    this.editor.addEventListener('keydown', (e) => this.handleEditorKeydown(e));

    // Completion Actions
    this.saveExitBtn.addEventListener('click', () => this.saveAndExit());
    this.keepWritingBtn.addEventListener('click', () => this.keepWriting());

    // Emergency Exit
    this.cancelEmergency.addEventListener('click', () => this.hideEmergencyModal());
    this.emergencyInput.addEventListener('input', () => this.checkEmergencyPhrase());

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));
  }

  // ==================== THEME ====================

  async loadSettings() {
    const result = await window.focusWriter.loadSettings();
    if (result.success && result.settings) {
      this.settings = { ...this.settings, ...result.settings };
      this.strictModeToggle.checked = this.settings.strictMode !== false;
    }
  }

  async saveSettings() {
    this.settings.strictMode = this.strictModeToggle.checked;
    await window.focusWriter.saveSettings(this.settings);
  }

  toggleTheme() {
    this.settings.theme = this.settings.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme();
    this.saveSettings();
  }

  applyTheme() {
    document.body.setAttribute('data-theme', this.settings.theme);
  }

  // ==================== DRAFT MANAGEMENT ====================

  async loadDraft() {
    const result = await window.focusWriter.loadDraft();
    if (result.success && result.content && result.content.trim()) {
      this.showDraftSection(result.content, result.lastModified);
    } else {
      this.showNoDraftSection();
    }
  }

  showDraftSection(content, lastModified) {
    this.draftSection.classList.remove('hidden');
    this.noDraftSection.classList.add('hidden');

    // Show preview (first 200 chars)
    const preview = content.substring(0, 200).trim();
    this.draftPreview.textContent = preview + (content.length > 200 ? '...' : '');

    // Word count
    const words = this.countWords(content);
    this.draftWordCount.textContent = `${words.toLocaleString()} words`;

    // Last edited
    if (lastModified) {
      this.draftLastEdited.textContent = `Last edited ${this.formatRelativeTime(new Date(lastModified))}`;
    }

    // Store for later
    this.currentDraft = content;
  }

  showNoDraftSection() {
    this.draftSection.classList.add('hidden');
    this.noDraftSection.classList.remove('hidden');
    this.currentDraft = '';
  }

  showConfirmFreshModal() {
    this.confirmFreshModal.classList.remove('hidden');
  }

  hideConfirmFreshModal() {
    this.confirmFreshModal.classList.add('hidden');
  }

  async confirmStartFresh() {
    // Archive current draft first
    if (this.currentDraft) {
      await window.focusWriter.saveContent(this.currentDraft);
    }
    await window.focusWriter.clearDraft();
    this.currentDraft = '';
    this.showNoDraftSection();
    this.hideConfirmFreshModal();
  }

  // ==================== SESSION HISTORY ====================

  async loadSessionHistory() {
    const result = await window.focusWriter.loadSessions();
    if (result.success && result.sessions && result.sessions.length > 0) {
      this.displaySessionStats(result.sessions);
    }
  }

  displaySessionStats(sessions) {
    const totalWords = sessions.reduce((sum, s) => sum + (s.words || 0), 0);
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.completed).length;

    this.sessionStats.innerHTML = `
      <span>${totalWords.toLocaleString()} total words</span>
      <span>${completedSessions}/${totalSessions} sessions completed</span>
    `;
  }

  // ==================== GOAL TYPE ====================

  setGoalType(type) {
    this.session.goalType = type;

    this.goalTypeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });

    if (type === 'words') {
      this.wordCountInput.classList.remove('hidden');
      this.timeInput.classList.add('hidden');
    } else {
      this.wordCountInput.classList.add('hidden');
      this.timeInput.classList.remove('hidden');
    }
  }

  handlePresetClick(e) {
    const btn = e.target;
    const value = parseInt(btn.dataset.value);
    const container = btn.closest('.goal-input-section');

    // Update active state
    container.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update input value
    if (this.session.goalType === 'words') {
      this.wordGoal.value = value;
    } else {
      this.timeGoal.value = value;
    }
  }

  updatePresetSelection() {
    const input = this.session.goalType === 'words' ? this.wordGoal : this.timeGoal;
    const value = parseInt(input.value);
    const container = input.closest('.goal-input-section');

    container.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.value) === value);
    });
  }

  // ==================== SESSION MANAGEMENT ====================

  async startSession() {
    // Get goal value
    if (this.session.goalType === 'words') {
      this.session.goalValue = parseInt(this.wordGoal.value) || 500;
    } else {
      this.session.goalValue = parseInt(this.timeGoal.value) || 25;
    }

    this.session.strictMode = this.strictModeToggle.checked;

    // Load existing draft content
    this.editor.value = this.currentDraft || '';
    this.session.startWordCount = this.countWords(this.editor.value);
    this.session.currentWordCount = this.session.startWordCount;
    this.session.startTime = Date.now();
    this.session.elapsedSeconds = 0;
    this.session.active = true;

    // Start lockdown via main process
    await window.focusWriter.startSession({
      goalType: this.session.goalType,
      goalValue: this.session.goalValue,
      strictMode: this.session.strictMode
    });

    // Switch to writing screen
    this.showScreen('writing');

    // Update UI
    this.updateProgress();
    this.updateStats();

    // Start timers
    this.session.timerInterval = setInterval(() => this.tick(), 1000);
    this.session.autoSaveInterval = setInterval(() => this.autoSave(), 10000);

    // Focus editor
    this.editor.focus();
  }

  tick() {
    this.session.elapsedSeconds++;
    this.updateStats();

    // Check time-based goal
    if (this.session.goalType === 'time') {
      this.updateProgress();
      if (this.session.elapsedSeconds >= this.session.goalValue * 60) {
        this.goalReached();
      }
    }
  }

  handleEditorInput() {
    const content = this.editor.value;
    this.session.currentWordCount = this.countWords(content);
    this.updateStats();
    this.updateProgress();

    // Check word-based goal
    if (this.session.goalType === 'words') {
      const wordsWritten = this.session.currentWordCount - this.session.startWordCount;
      if (wordsWritten >= this.session.goalValue) {
        this.goalReached();
      }
    }

    // Mark as unsaved
    this.saveIndicator.textContent = 'Saving...';
    this.saveIndicator.classList.add('saving');
  }

  handleEditorKeydown(e) {
    // Allow Tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = this.editor.selectionStart;
      const end = this.editor.selectionEnd;
      const value = this.editor.value;
      this.editor.value = value.substring(0, start) + '\t' + value.substring(end);
      this.editor.selectionStart = this.editor.selectionEnd = start + 1;
      this.handleEditorInput();
    }
  }

  updateProgress() {
    let progress = 0;
    let text = '';

    if (this.session.goalType === 'words') {
      const wordsWritten = Math.max(0, this.session.currentWordCount - this.session.startWordCount);
      progress = Math.min(100, (wordsWritten / this.session.goalValue) * 100);
      text = `${wordsWritten.toLocaleString()} / ${this.session.goalValue.toLocaleString()} words`;
    } else {
      const targetSeconds = this.session.goalValue * 60;
      progress = Math.min(100, (this.session.elapsedSeconds / targetSeconds) * 100);
      const remaining = Math.max(0, targetSeconds - this.session.elapsedSeconds);
      text = `${this.formatTime(remaining)} remaining`;
    }

    this.progressFill.style.width = `${progress}%`;
    this.progressText.textContent = text;
  }

  updateStats() {
    this.currentWords.textContent = this.session.currentWordCount.toLocaleString();
    this.currentChars.textContent = this.editor.value.length.toLocaleString();
    this.sessionTime.textContent = this.formatTime(this.session.elapsedSeconds);
  }

  async autoSave() {
    if (!this.session.active) return;

    const content = this.editor.value;
    const result = await window.focusWriter.saveContent(content);

    if (result.success) {
      this.saveIndicator.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Saved
      `;
      this.saveIndicator.classList.remove('saving');
    }
  }

  goalReached() {
    // Stop timers
    clearInterval(this.session.timerInterval);
    clearInterval(this.session.autoSaveInterval);

    // Final save
    this.autoSave();

    // Calculate stats
    const wordsWritten = this.session.currentWordCount - this.session.startWordCount;
    const timeSpent = this.formatTime(this.session.elapsedSeconds);

    if (this.session.goalType === 'words') {
      this.completionStats.textContent = `You wrote ${wordsWritten.toLocaleString()} words in ${timeSpent}`;
    } else {
      this.completionStats.textContent = `You wrote ${wordsWritten.toLocaleString()} words during your ${this.session.goalValue} minute session`;
    }

    // Show completion screen
    this.showScreen('completion');

    // Play completion sound
    this.playCompletionSound();
  }

  async saveAndExit() {
    const content = this.editor.value;
    const wordsWritten = this.session.currentWordCount - this.session.startWordCount;

    await window.focusWriter.endSession({
      content: content,
      stats: {
        words: wordsWritten,
        duration: this.formatTime(this.session.elapsedSeconds),
        goalType: this.session.goalType,
        goalValue: this.session.goalValue,
        completed: true
      }
    });

    this.resetSession();
    await this.loadDraft();
    await this.loadSessionHistory();
    this.showScreen('welcome');
  }

  keepWriting() {
    // Add 10 more minutes
    if (this.session.goalType === 'time') {
      this.session.goalValue += 10;
    } else {
      // Add 20% more words
      this.session.goalValue = Math.ceil(this.session.goalValue * 1.2);
    }

    // Restart timers
    this.session.timerInterval = setInterval(() => this.tick(), 1000);
    this.session.autoSaveInterval = setInterval(() => this.autoSave(), 10000);

    // Go back to writing
    this.showScreen('writing');
    this.editor.focus();
  }

  resetSession() {
    clearInterval(this.session.timerInterval);
    clearInterval(this.session.autoSaveInterval);

    this.session = {
      active: false,
      goalType: 'words',
      goalValue: 500,
      strictMode: true,
      startTime: null,
      startWordCount: 0,
      currentWordCount: 0,
      timerInterval: null,
      autoSaveInterval: null,
      elapsedSeconds: 0
    };
  }

  // ==================== EMERGENCY EXIT ====================

  handleGlobalKeydown(e) {
    // Escape to show emergency exit during active session
    if (e.key === 'Escape' && this.session.active) {
      e.preventDefault();
      this.showEmergencyModal();
    }
  }

  showEmergencyModal() {
    this.emergencyModal.classList.remove('hidden');
    this.emergencyInput.value = '';
    this.emergencyInput.focus();
  }

  hideEmergencyModal() {
    this.emergencyModal.classList.add('hidden');
    this.editor.focus();
  }

  checkEmergencyPhrase() {
    const phrase = this.emergencyInput.value.toUpperCase().trim();
    if (phrase === 'I GIVE UP') {
      this.emergencyExit();
    }
  }

  async emergencyExit() {
    // Stop timers
    clearInterval(this.session.timerInterval);
    clearInterval(this.session.autoSaveInterval);

    const content = this.editor.value;

    await window.focusWriter.emergencyExit({ content });

    this.hideEmergencyModal();
    this.resetSession();
    await this.loadDraft();
    this.showScreen('welcome');
  }

  // ==================== UTILITIES ====================

  showScreen(screenName) {
    this.welcomeScreen.classList.remove('active');
    this.writingScreen.classList.remove('active');
    this.completionScreen.classList.remove('active');

    switch (screenName) {
      case 'welcome':
        this.welcomeScreen.classList.add('active');
        break;
      case 'writing':
        this.writingScreen.classList.add('active');
        break;
      case 'completion':
        this.completionScreen.classList.add('active');
        break;
    }
  }

  countWords(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }

  playCompletionSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Play a pleasant three-note chime
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.15);
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + i * 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.5);

        oscillator.start(audioContext.currentTime + i * 0.15);
        oscillator.stop(audioContext.currentTime + i * 0.15 + 0.5);
      });
    } catch (e) {
      // Audio not available
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new FocusWriterApp();
});
