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

    // Goal Banner Elements (subtle notification)
    this.goalBanner = document.getElementById('goalBanner');
    this.goalBannerText = document.getElementById('goalBannerText');
    this.saveExitBannerBtn = document.getElementById('saveExitBannerBtn');
    this.closeBanner = document.getElementById('closeBanner');

    // Completion Screen Elements (keeping for backwards compat)
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
      elapsedSeconds: 0,
      goalTriggered: false, // Prevent multiple goal triggers
      goalCompleted: false   // Track if goal is reached (user can exit freely)
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

    // Completion Actions (old screen - kept for backwards compat)
    this.saveExitBtn.addEventListener('click', () => this.saveAndExit());
    this.keepWritingBtn.addEventListener('click', () => this.keepWriting());

    // Goal Banner Actions (new subtle notification)
    this.saveExitBannerBtn.addEventListener('click', () => this.saveAndExit());
    this.closeBanner.addEventListener('click', () => this.hideGoalBanner());

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
    // Validation constants
    const MIN_WORDS = 10;
    const MAX_WORDS = 50000;
    const MIN_MINUTES = 1;
    const MAX_MINUTES = 480; // 8 hours max

    // Get and validate goal value
    if (this.session.goalType === 'words') {
      const rawValue = parseInt(this.wordGoal.value);
      if (isNaN(rawValue) || rawValue < MIN_WORDS) {
        this.showValidationError(`Word goal must be at least ${MIN_WORDS} words`);
        return;
      }
      if (rawValue > MAX_WORDS) {
        this.showValidationError(`Word goal cannot exceed ${MAX_WORDS.toLocaleString()} words`);
        return;
      }
      this.session.goalValue = rawValue;
    } else {
      const rawValue = parseInt(this.timeGoal.value);
      if (isNaN(rawValue) || rawValue < MIN_MINUTES) {
        this.showValidationError(`Time goal must be at least ${MIN_MINUTES} minute`);
        return;
      }
      if (rawValue > MAX_MINUTES) {
        this.showValidationError(`Time goal cannot exceed ${MAX_MINUTES} minutes (8 hours)`);
        return;
      }
      this.session.goalValue = rawValue;
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
    // Calculate actual elapsed time from start (handles system sleep/wake)
    const actualElapsed = Math.floor((Date.now() - this.session.startTime) / 1000);

    // Detect large jumps (sleep/wake) - more than 5 seconds gap
    const timeDrift = actualElapsed - this.session.elapsedSeconds;
    if (timeDrift > 5) {
      console.log(`Detected time jump of ${timeDrift} seconds (system sleep/wake)`);
    }

    this.session.elapsedSeconds = actualElapsed;
    this.updateStats();

    // Check time-based goal (with guard to prevent multiple triggers)
    if (this.session.goalType === 'time' && !this.session.goalTriggered) {
      this.updateProgress();
      if (this.session.elapsedSeconds >= this.session.goalValue * 60) {
        this.session.goalTriggered = true;
        this.goalReached();
      }
    }
  }

  handleEditorInput() {
    const content = this.editor.value;
    this.session.currentWordCount = this.countWords(content);
    this.updateStats();
    this.updateProgress();

    // Check word-based goal (with guard to prevent multiple triggers)
    if (this.session.goalType === 'words' && !this.session.goalTriggered) {
      const wordsWritten = this.session.currentWordCount - this.session.startWordCount;
      if (wordsWritten >= this.session.goalValue) {
        this.session.goalTriggered = true;
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
    if (!this.session.active && !this.session.goalCompleted) return;

    const content = this.editor.value;
    const result = await window.focusWriter.saveContent(content);

    if (result.success) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.saveIndicator.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Saved at ${timeStr}
      `;
      this.saveIndicator.classList.remove('saving', 'error');
      this.saveIndicator.style.color = '';
    } else {
      // Show error state
      this.saveIndicator.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        Save failed
      `;
      this.saveIndicator.classList.remove('saving');
      this.saveIndicator.classList.add('error');
      this.saveIndicator.style.color = '#ef4444';
      this.saveIndicator.title = result.error || 'Failed to save content';

      // Show persistent error banner for critical errors
      this.showSaveError(result.error || 'Failed to save your work');
    }
  }

  showSaveError(message) {
    // Don't show duplicate banners
    if (document.getElementById('saveErrorBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'saveErrorBanner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      padding: 12px 20px;
      text-align: center;
      z-index: 10000;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    banner.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      <span><strong>Warning:</strong> ${message}</span>
      <button onclick="this.parentElement.remove()" style="
        margin-left: 12px;
        padding: 4px 12px;
        background: rgba(255,255,255,0.2);
        border: none;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        font-size: 13px;
      ">Dismiss</button>
    `;
    document.body.prepend(banner);

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (banner.parentElement) {
        banner.style.opacity = '0';
        banner.style.transition = 'opacity 0.3s';
        setTimeout(() => banner.remove(), 300);
      }
    }, 10000);
  }

  async goalReached() {
    // Mark session as no longer locked (user is free to continue or exit)
    this.session.active = false;
    this.session.goalCompleted = true;

    // Stop the auto-save interval (keep timer for display if they continue)
    clearInterval(this.session.autoSaveInterval);

    // Final save
    await this.autoSave();

    // Tell main process to exit lockdown (user is free now!)
    try {
      await window.focusWriter.goalReached();
    } catch (e) {
      console.error('Failed to release lockdown:', e);
    }

    // Calculate stats for the banner
    const wordsWritten = this.session.currentWordCount - this.session.startWordCount;
    const timeSpent = this.formatTime(this.session.elapsedSeconds);

    // Update banner text
    if (this.session.goalType === 'words') {
      this.goalBannerText.textContent = `Goal reached! ${wordsWritten.toLocaleString()} words in ${timeSpent}. You're free to go.`;
    } else {
      this.goalBannerText.textContent = `Session complete! ${wordsWritten.toLocaleString()} words written. You're free to go.`;
    }

    // Show the subtle banner (not a full screen takeover)
    this.showGoalBanner();

    // Show persistent exit button in case user dismisses banner
    this.showPersistentExitButton();

    // Play subtle completion sound
    this.playCompletionSound();

    // Update progress bar to show 100%
    this.progressFill.style.width = '100%';
    this.progressText.textContent = 'Goal reached!';
  }

  showGoalBanner() {
    this.goalBanner.classList.remove('hidden');
    // Trigger animation by adding class after a tiny delay
    requestAnimationFrame(() => {
      this.goalBanner.classList.add('visible');
    });
  }

  hideGoalBanner() {
    this.goalBanner.classList.remove('visible');
    setTimeout(() => {
      this.goalBanner.classList.add('hidden');
    }, 300);
  }

  showPersistentExitButton() {
    // Remove existing exit button if any
    const existing = document.getElementById('persistentExitBtn');
    if (existing) existing.remove();

    // Create persistent exit button in the stats bar
    const exitBtn = document.createElement('button');
    exitBtn.id = 'persistentExitBtn';
    exitBtn.className = 'persistent-exit-btn';
    exitBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
      </svg>
      Save & Exit
    `;
    exitBtn.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-left: 16px;
    `;
    exitBtn.addEventListener('click', () => this.saveAndExit());
    exitBtn.addEventListener('mouseenter', () => {
      exitBtn.style.transform = 'scale(1.02)';
      exitBtn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
    });
    exitBtn.addEventListener('mouseleave', () => {
      exitBtn.style.transform = 'scale(1)';
      exitBtn.style.boxShadow = 'none';
    });

    // Add to the writing stats area
    const statsArea = document.querySelector('.writing-stats');
    if (statsArea) {
      statsArea.appendChild(exitBtn);
    }
  }

  hidePersistentExitButton() {
    const exitBtn = document.getElementById('persistentExitBtn');
    if (exitBtn) exitBtn.remove();
  }

  async saveAndExit() {
    const content = this.editor.value;
    const wordsWritten = this.session.currentWordCount - this.session.startWordCount;

    // Hide the goal banner if visible
    this.hideGoalBanner();

    await window.focusWriter.endSession({
      content: content,
      stats: {
        words: wordsWritten,
        duration: this.formatTime(this.session.elapsedSeconds),
        goalType: this.session.goalType,
        goalValue: this.session.goalValue,
        completed: this.session.goalTriggered
      }
    });

    this.resetSession();
    await this.loadDraft();
    await this.loadSessionHistory();
    this.showScreen('welcome');
  }

  keepWriting() {
    // Clear any existing timers first to prevent stacking
    if (this.session.timerInterval) {
      clearInterval(this.session.timerInterval);
      this.session.timerInterval = null;
    }
    if (this.session.autoSaveInterval) {
      clearInterval(this.session.autoSaveInterval);
      this.session.autoSaveInterval = null;
    }

    // Add 10 more minutes / 20% more words
    if (this.session.goalType === 'time') {
      this.session.goalValue += 10;
    } else {
      // Add 20% more words
      this.session.goalValue = Math.ceil(this.session.goalValue * 1.2);
    }

    // Reset goal tracking so user can reach the new goal
    this.session.goalTriggered = false;
    this.session.goalCompleted = false;
    this.session.active = true;

    // Hide goal banner and persistent exit button
    this.hideGoalBanner();
    this.hidePersistentExitButton();

    // Restart timers
    this.session.timerInterval = setInterval(() => this.tick(), 1000);
    this.session.autoSaveInterval = setInterval(() => this.autoSave(), 10000);

    // Update progress display
    this.updateProgress();

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
      elapsedSeconds: 0,
      goalTriggered: false,
      goalCompleted: false
    };

    // Hide goal banner if visible
    this.hideGoalBanner();

    // Hide persistent exit button
    this.hidePersistentExitButton();
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

  showValidationError(message) {
    // Remove any existing validation toast
    const existingToast = document.querySelector('.validation-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'validation-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #ef4444;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

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
