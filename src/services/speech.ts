import { LearnerLanguage } from '../types';

// Speech Synthesis (Text to Speech)
export class SpeechService {
  private static synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private static activeUtterance: SpeechSynthesisUtterance | null = null;
  private static onBoundaryCallback: ((charIndex: number, text: string) => void) | null = null;
  private static onEndCallback: (() => void) | null = null;

  private static speechRate = 1.15; // Add custom speech rate class variable for prompt quick responses

  static setSpeechRate(rate: number) {
    this.speechRate = rate;
  }

  static getSpeechRate(): number {
    return this.speechRate;
  }

  static speak(text: string, lang: LearnerLanguage, onEnd?: () => void, onBoundary?: (charIndex: number, text: string) => void) {
    if (!this.synth) return;

    // Fast-suspend active microphone input during playback to free audio threads and block loopback whispers
    if (VoiceRecognitionService.activeInstance) {
      VoiceRecognitionService.activeInstance.pauseListening();
    }

    this.stop(false); // Stop any current speech without resuming the microphone immediately

    this.onEndCallback = () => {
      if (VoiceRecognitionService.activeInstance) {
        VoiceRecognitionService.activeInstance.resumeListening();
      }
      if (onEnd) {
        onEnd();
      }
    };
    
    this.onBoundaryCallback = onBoundary || null;

    // Remove any special markers or unreadable layouts
    const cleanText = text
      .replace(/[*#_~`\[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang;
    
    // Choose voice based on locale if available
    if (this.synth.getVoices) {
      const voices = this.synth.getVoices();
      const targetVoice = voices.find(v => v.lang.startsWith(lang.split('-')[0])) || voices.find(v => v.lang.startsWith('en'));
      if (targetVoice) {
        utterance.voice = targetVoice;
      }
    }

    // Set custom rate (defaults to a prompt 1.15) so oral feedback sounds prompt and quick!
    utterance.rate = this.speechRate;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      this.activeUtterance = null;
      if (this.onEndCallback) {
        this.onEndCallback();
      }
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error:", e);
      this.activeUtterance = null;
      if (this.onEndCallback) {
        this.onEndCallback();
      }
    };

    utterance.onboundary = (event) => {
      if (event.name === 'word' && this.onBoundaryCallback) {
        this.onBoundaryCallback(event.charIndex, cleanText);
      }
    };

    this.activeUtterance = utterance;
    this.synth.speak(utterance);
  }

  static stop(resumeMic = true) {
    if (!this.synth) return;
    this.synth.cancel();
    this.activeUtterance = null;

    // Instantly bring back standard listener session if desired
    if (resumeMic && VoiceRecognitionService.activeInstance) {
      VoiceRecognitionService.activeInstance.resumeListening();
    }
  }

  static pause() {
    if (!this.synth) return;
    this.synth.pause();
  }

  static resume() {
    if (!this.synth) return;
    this.synth.resume();
  }

  static isSpeaking(): boolean {
    return this.synth ? this.synth.speaking : false;
  }
}

// Speech Recognition (Speech to Text)
export class VoiceRecognitionService {
  public static activeInstance: VoiceRecognitionService | null = null;
  private static sharedRecognition: any = null;

  // Track physical/underlying engine state and user desires statically
  private static isUserListening = false; // Programmatic gate: true if the user has activated Listening
  private static currentLang: LearnerLanguage = 'en-US';
  private static isEngineRunning = false;
  private static isEngineStarting = false;
  private static isEngineStopping = false;
  private static isLanguageChanging = false;
  
  // Custom conversational-turn hot-mic tracking:
  private static isSpeakingState = false;
  private static ignoreResultsEndTime = 0;
  private static watchdogTimer: any = null;

  private recognition: any = null;
  private onCommandCallback: (command: string, transcript: string) => void = () => {};
  private onTranscriptCallback: (text: string) => void = () => {};
  private onStatusChangeCallback: (status: 'idle' | 'listening' | 'processing') => void = () => {};

  constructor(lang: LearnerLanguage) {
    if (typeof window === 'undefined') return;

    VoiceRecognitionService.activeInstance = this;
    VoiceRecognitionService.currentLang = lang;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      if (!VoiceRecognitionService.sharedRecognition) {
        VoiceRecognitionService.sharedRecognition = new SpeechRecognition();
        VoiceRecognitionService.sharedRecognition.continuous = true;
        VoiceRecognitionService.sharedRecognition.interimResults = true;
        VoiceRecognitionService.sharedRecognition.maxAlternatives = 1;
      }
      this.recognition = VoiceRecognitionService.sharedRecognition;
      this.setupEventListeners();
      
      // Pre-heat physical engine instantly on construct so it is warm and ready!
      this.ensurePhysicalEngineRunning();
    }
  }

  private static resetWatchdog() {
    if (VoiceRecognitionService.watchdogTimer) {
      clearTimeout(VoiceRecognitionService.watchdogTimer);
    }
    VoiceRecognitionService.watchdogTimer = setTimeout(() => {
      if (VoiceRecognitionService.isEngineStarting) {
        console.warn("[SPEECH] Watchdog triggered: restart stuck. Resetting engine state...");
        VoiceRecognitionService.isEngineStarting = false;
        const active = VoiceRecognitionService.activeInstance;
        if (active) {
          active.ensurePhysicalEngineRunning();
        }
      }
    }, 1500); // 1.5 second watchdog
  }

  private setupEventListeners() {
    const recognition = VoiceRecognitionService.sharedRecognition;
    if (!recognition) return;

    if ((recognition as any).__listenersAttached) {
      return;
    }
    (recognition as any).__listenersAttached = true;

    recognition.onstart = () => {
      console.log("[SPEECH] Physical Engine onstart fired.");
      VoiceRecognitionService.isEngineRunning = true;
      VoiceRecognitionService.isEngineStarting = false;
      
      if (VoiceRecognitionService.watchdogTimer) {
        clearTimeout(VoiceRecognitionService.watchdogTimer);
        VoiceRecognitionService.watchdogTimer = null;
      }

      const active = VoiceRecognitionService.activeInstance;
      if (active) {
        active.reportStatus();
      }
    };

    recognition.onend = () => {
      console.log("[SPEECH] Physical Engine onend fired.");
      VoiceRecognitionService.isEngineRunning = false;
      VoiceRecognitionService.isEngineStarting = false;
      
      const active = VoiceRecognitionService.activeInstance;
      if (active) {
        active.reportStatus();
        
        if (VoiceRecognitionService.isLanguageChanging) {
          console.log("[SPEECH] Executing clean language reboot on end.");
          VoiceRecognitionService.isLanguageChanging = false;
          VoiceRecognitionService.isEngineStopping = false;
          setTimeout(() => {
            active.ensurePhysicalEngineRunning();
            active.reportStatus();
          }, 40);
        } else if (!VoiceRecognitionService.isEngineStopping) {
          setTimeout(() => {
            active.ensurePhysicalEngineRunning();
          }, 30);
        }
      }
    };

    recognition.onresult = (event: any) => {
      const active = VoiceRecognitionService.activeInstance;
      if (!active) return;

      // Programmatic gate: Ignore Speech Recognition results unless active and user has unmuted,
      // or if we are actively speaking, or inside the echo-cancellation cooldown window.
      const now = Date.now();
      if (!VoiceRecognitionService.isUserListening || VoiceRecognitionService.isSpeakingState || now < VoiceRecognitionService.ignoreResultsEndTime) {
        return;
      }

      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const activeText = finalTranscript || interimTranscript;
      if (activeText.trim()) {
        active.onTranscriptCallback(activeText.trim());
      }

      if (finalTranscript.trim()) {
        active.onStatusChangeCallback('processing');
        active.processTranscript(finalTranscript.trim().toLowerCase());
        
        // Restore quickly back to listening state
        setTimeout(() => {
          if (!VoiceRecognitionService.isSpeakingState && VoiceRecognitionService.isUserListening) {
            active.onStatusChangeCallback('listening');
          }
        }, 100);
      }
    };

    recognition.onerror = (event: any) => {
      const active = VoiceRecognitionService.activeInstance;
      if (!active) return;

      console.warn("[SPEECH] Engine onerror fired:", event.error);
      VoiceRecognitionService.isEngineStarting = false;

      if (event.error === 'not-allowed') {
        console.error("[SPEECH] Physical permission error.");
        active.onTranscriptCallback("Microphone permission denied. Please allow mic access.");
      } else if (event.error === 'no-speech') {
        // Auto recover silently and quickly from silence timeout limits
        setTimeout(() => active.ensurePhysicalEngineRunning(), 30);
      } else {
        // Any other error (network, etc) - trigger a fast recovery start
        setTimeout(() => active.ensurePhysicalEngineRunning(), 200);
      }
    };
  }

  private ensurePhysicalEngineRunning() {
    const recognition = VoiceRecognitionService.sharedRecognition;
    if (!recognition) return;

    if (VoiceRecognitionService.isEngineRunning || VoiceRecognitionService.isEngineStarting) {
      return;
    }

    VoiceRecognitionService.isEngineStarting = true;
    VoiceRecognitionService.isEngineStopping = false;
    VoiceRecognitionService.resetWatchdog();

    try {
      recognition.lang = VoiceRecognitionService.currentLang;
      recognition.start();
    } catch (e: any) {
      console.warn("[SPEECH] Web Speech SDK start exception:", e);
      VoiceRecognitionService.isEngineStarting = false;
      if (e.message && e.message.includes('already started')) {
        VoiceRecognitionService.isEngineRunning = true;
      }
    }
  }

  private reportStatus() {
    if (VoiceRecognitionService.isSpeakingState) {
      this.onStatusChangeCallback('idle');
    } else if (VoiceRecognitionService.isUserListening && VoiceRecognitionService.isEngineRunning) {
      this.onStatusChangeCallback('listening');
    } else {
      this.onStatusChangeCallback('idle');
    }
  }

  pauseListening() {
    VoiceRecognitionService.isSpeakingState = true;
    VoiceRecognitionService.ignoreResultsEndTime = 0;
    this.onStatusChangeCallback('idle');
  }

  resumeListening() {
    VoiceRecognitionService.isSpeakingState = false;
    // Echo cancellations window (350ms) to ignore self-speech loopbacks
    VoiceRecognitionService.ignoreResultsEndTime = Date.now() + 350;

    if (VoiceRecognitionService.isUserListening) {
      this.onStatusChangeCallback('listening');
    }
    this.ensurePhysicalEngineRunning();
  }

  setLanguage(lang: LearnerLanguage) {
    if (this.recognition) {
      if (VoiceRecognitionService.currentLang !== lang) {
        console.log(`[SPEECH] Hot swapping language to: ${lang}`);
        VoiceRecognitionService.currentLang = lang;
        this.recognition.lang = lang;

        if (VoiceRecognitionService.isEngineRunning || VoiceRecognitionService.isEngineStarting) {
          VoiceRecognitionService.isLanguageChanging = true;
          VoiceRecognitionService.isEngineStopping = true;
          try {
            this.recognition.abort();
          } catch (e) {
            console.error("[SPEECH] Abort during language change failed:", e);
            // Fallback reboot
            VoiceRecognitionService.isLanguageChanging = false;
            VoiceRecognitionService.isEngineStopping = false;
            this.ensurePhysicalEngineRunning();
          }
        } else {
          this.ensurePhysicalEngineRunning();
        }
      }
    }
  }

  start() {
    VoiceRecognitionService.isUserListening = true;
    this.ensurePhysicalEngineRunning();
    this.reportStatus();
  }

  stop() {
    VoiceRecognitionService.isUserListening = false;
    this.reportStatus();
  }

  isActive() {
    return VoiceRecognitionService.isUserListening;
  }

  onCommand(callback: (command: string, transcript: string) => void) {
    this.onCommandCallback = callback;
  }

  onTranscript(callback: (text: string) => void) {
    this.onTranscriptCallback = callback;
  }

  onStatusChange(callback: (status: 'idle' | 'listening' | 'processing') => void) {
    this.onStatusChangeCallback = callback;
  }

  private processTranscript(text: string) {
    const raw = text.toLowerCase().trim();
    
    // Direct Language switching verbal shortcuts
    if (
      raw.includes('switch to english') || 
      raw.includes('change to english') || 
      raw.includes('english please') || 
      raw.includes('अंग्रेजी') || 
      raw.includes('इंगलिश') || 
      raw === 'english' || 
      raw === 'इंग्लिश' || 
      raw === 'ఇంగ్లీష్'
    ) {
      this.onCommandCallback('switch_to_en', text);
      return;
    }
    
    if (
      raw.includes('switch to hindi') || 
      raw.includes('change to hindi') || 
      raw.includes('hindi please') || 
      raw.includes('हिंदी') || 
      raw.includes('हिन्दी') || 
      raw === 'hindi' || 
      raw === 'హిందీ'
    ) {
      this.onCommandCallback('switch_to_hi', text);
      return;
    }
    
    if (
      raw.includes('switch to telugu') || 
      raw.includes('change to telugu') || 
      raw.includes('telugu please') || 
      raw.includes('తెలుగు') || 
      raw.includes('తేలుగూ') || 
      raw.includes('తెలుగులో') || 
      raw.includes('तेलुगु') || 
      raw === 'telugu' ||
      raw === 'telgu' ||
      raw === 'telugulo'
    ) {
      this.onCommandCallback('switch_to_te', text);
      return;
    }
    // Already defined 'raw' at top of processTranscript, removing local redeclaration.
    
    // Check voice navigation match patterns across supported languages (vocal translations mapped simply)
    if (raw.includes('open study material') || raw.includes('study material') || raw.includes('किताब') || raw.includes('స్టడీ మెటీరియల్') || raw.includes('ఓపెన్ స్టడీ') || raw.includes('మొదలు పెట్టు') || raw.includes('పుస్తకం') || raw.includes('స్టడీ') || raw.includes('படிப்பு பொருள்') || raw.includes('مطالعہ کا مواد')) {
      this.onCommandCallback('open_study_material', text);
    } else if (raw.includes('read chapter') || raw.includes('read aloud') || raw.includes('read text') || raw.includes('start reading') || raw.includes('narrate') || raw.includes('speak') || raw.includes('aloud') || raw === 'read' || raw.includes('पढ़ें') || raw.includes('सुनाओ') || raw.includes('రీడ్') || raw.includes('చాప్టర్ చదువు') || raw.includes('చదువు') || raw.includes('చదవండి') || raw.includes('వినిపించు') || raw.includes('చదువుకోడానికి') || raw.includes('రీడింగ్')) {
      this.onCommandCallback('read_chapter', text);
    } else if (raw.match(/explain topic|explain|समझाएं|వివరించు|వివరించండి|వివరణ|చెప్పు|వివరణ ఇవ్వు|వివరించుము|விளக்கு|وضاحت کریں/i) || raw.includes('explain') || raw.includes('వివరించు') || raw.includes('వివరించండి') || raw.includes('వివరణ') || raw.includes('చెప్పు')) {
      this.onCommandCallback('explain_topic', text);
    } else if (raw.includes('start quiz') || raw.includes('take quiz') || raw.includes('క్విజ్') || raw.includes('క్విజ్ ప్రారంభించు') || raw.includes('క్విజ్ స్టార్ట్') || raw.includes('పరీక్ష') || raw.includes('క్విజ్ చేయి') || raw.includes('క్విస్') || raw.includes('क्विज़') || raw.includes('क्విజ్ ప్రారంభించు') || raw.includes('க்விస్ ஆரம்பி') || raw.includes('کوئز شروع کریں')) {
      this.onCommandCallback('start_quiz', text);
    } else if (raw.includes('show progress') || raw.includes('progress') || raw.includes('ప్రోగ్రెస్ చూపి') || raw.includes('ప్రోగ్రెస్') || raw.includes('రిపోర్ట్') || raw.includes('డ్యాష్ బోర్డ్') || raw.includes('డ్యాష్‌బోర్డ్') || raw.includes('ప్రాగ్రెస్') || raw.includes('गतिविधि') || raw.includes('ప్రోగ్రెస్ చూపి') || raw.includes('முன்னேற்றத்தை காட்டு') || raw.includes('کارکردگی دکھائیں') || raw.includes('ڈیش بورڈ')) {
      this.onCommandCallback('show_progress', text);
    } else if (raw.includes('change language') || raw.includes('language') || raw.includes('भाषा') || raw.includes('భాష మార్చు') || raw.includes('மொழியை మాற்று') || raw.includes('زبان تبدیل کریں')) {
      this.onCommandCallback('change_language', text);
    } else if (raw.includes('stop reading') || raw.includes('stop') || raw.includes('చదవడం ఆపు') || raw.includes('ఆపు') || raw.includes('ఆపండి') || raw.includes('స్టాప్') || raw.includes('रुको') || raw.includes('చదవడం ఆపు') || raw.includes('படிப்பதை நிறுத்து') || raw.includes('پڑھنا بند کریں')) {
      this.onCommandCallback('stop_reading', text);
    } else if (raw.includes('resume reading') || raw.includes('resume') || raw.includes('చదవడం కొనసాగించు') || raw.includes('కొనసాగించు') || raw.includes('మళ్లీ చదువు') || raw.includes('మళ్ళీ చదువు') || raw.includes('మళ్ళీ') || raw.includes('కనెక్ట్') || raw.includes('రెజ్యూమ్') || raw.includes('दोबारा') || raw.includes('చదవడం కొనసాగించు') || raw.includes('మీண்டும் படி') || raw.includes('پڑھنا جاری رکھیں')) {
      this.onCommandCallback('resume_reading', text);
    } else if (raw.includes('help') || raw.includes('instructions') || raw.includes('assistance') || raw.includes('సహాయం') || raw.includes('సహాయం చేయండి') || raw.includes('హెల్ప్') || raw.includes('सहायता') || raw.includes('సహాయం') || raw.includes('உதவி') || raw.includes('مدد')) {
      this.onCommandCallback('help', text);
    } else {
      // General question to AI Tutor which doesn't match direct commands
      this.onCommandCallback('ai_question', text);
    }
  }
}
