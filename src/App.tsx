import React, { useEffect, useState, useRef } from 'react';
import { 
  GraduationCap, 
  BookOpen, 
  Award, 
  HelpCircle, 
  Languages, 
  VolumeX, 
  Mic, 
  Baseline, 
  Sparkles,
  ArrowRight,
  Accessibility,
  CheckCircle2,
  Bookmark
} from 'lucide-react';
import { LearnerLanguage, SUPPORTED_LANGUAGES, StudyChapter, MasteryProgress, QuizRecord, QuizQuestion } from './types';
import { SpeechService, VoiceRecognitionService } from './services/speech';
import { 
  getStudyChapters, 
  saveStudyChapter, 
  getLearnerProgress, 
  saveLearnerProgress, 
  getQuizRecords, 
  saveQuizRecord, 
  getUserProfile, 
  saveUserProfile 
} from './services/firebase';

import AudioAssistantIndicator from './components/AudioAssistantIndicator';
import StudyReader from './components/StudyReader';
import QuizView from './components/QuizView';
import DashboardView from './components/DashboardView';

export default function App() {
  // Global accessibility modifiers
  const [useLargeFont, setUseLargeFont] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<LearnerLanguage>('en-US');

  // Active App Navigation States
  const [activeTab, setActiveTab] = useState<'home' | 'reader' | 'quiz' | 'dashboard'>('home');

  // Core Persistent databases (reloads dynamically from Firebase / local fallback)
  const [chapters, setChapters] = useState<StudyChapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<StudyChapter | null>(null);
  const [progressList, setProgressList] = useState<MasteryProgress[]>([]);
  const [quizHistory, setQuizHistory] = useState<QuizRecord[]>([]);
  const [totalStudyTime, setTotalStudyTime] = useState(15); // in minutes

  // Audio / Speech State holders
  const [isRecognitionActive, setIsRecognitionActive] = useState(false);
  const [recognitionStatus, setRecognitionStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [transcriptCaption, setTranscriptCaption] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeechIndex, setActiveSpeechIndex] = useState(0);

  // Gemini AI outputs
  const [tutorResponse, setTutorResponse] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [isQuizGenerating, setIsQuizGenerating] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const voiceRecognitionRef = useRef<VoiceRecognitionService | null>(null);

  // Load initial dataset from firebase/offline adapters
  useEffect(() => {
    async function loadData() {
      const chs = await getStudyChapters();
      setChapters(chs);
      if (chs.length > 0) {
        setSelectedChapter(chs[0]);
      }

      const prog = await getLearnerProgress();
      setProgressList(prog);

      const qHist = await getQuizRecords();
      setQuizHistory(qHist);

      const profile = await getUserProfile('local_student');
      if (profile) {
        setTotalStudyTime(profile.totalStudyTime);
        setCurrentLanguage(profile.language);
      }
    }
    loadData();
  }, []);

  // Update central user profile on changes
  const handleUpdateLanguage = (lang: LearnerLanguage) => {
    setCurrentLanguage(lang);
    saveUserProfile({
      uid: 'local_student',
      totalStudyTime,
      language: lang,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Voice announce confirmation
    const langConfig = SUPPORTED_LANGUAGES[lang];
    SpeechService.speak(langConfig.speakConfirmation, lang);
  };

  const handleUpdateStudyMinutes = (added: number) => {
    const updatedMins = totalStudyTime + added;
    setTotalStudyTime(updatedMins);
    saveUserProfile({
      uid: 'local_student',
      totalStudyTime: updatedMins,
      language: currentLanguage,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    SpeechService.speak(`Added ${added} minutes of study activity completely. Good job!`, currentLanguage);
  };

  // Welcome announcement on initial boot
  useEffect(() => {
    const timer = setTimeout(() => {
      const welcome = SUPPORTED_LANGUAGES[currentLanguage];
      SpeechService.speak(welcome.welcomeMessage, currentLanguage);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Pre-initialize standard voice recognition singleton once on mount
  useEffect(() => {
    const voiceEngine = new VoiceRecognitionService(currentLanguage);
    voiceRecognitionRef.current = voiceEngine;

    // Start listening on boot for fully hands-free student onboarding
    voiceEngine.start();
    setIsRecognitionActive(true);

    return () => {
      voiceEngine.stop();
    };
  }, []); // Run ONLY once on mount to keep backend speech instances warm and ready!

  // Decoupled real-time tracking for SpeechService isSpeaking status
  useEffect(() => {
    const timer = setInterval(() => {
      const activeSpeaking = SpeechService.isSpeaking();
      if (activeSpeaking !== isSpeaking) {
        setIsSpeaking(activeSpeaking);
      }
    }, 150);
    return () => clearInterval(timer);
  }, [isSpeaking]);

  // Dynamically update voice engine language, and bind up-to-date React callbacks on state changes
  useEffect(() => {
    const voiceEngine = voiceRecognitionRef.current;
    if (!voiceEngine) return;

    // Sync language smoothly
    voiceEngine.setLanguage(currentLanguage);

    voiceEngine.onStatusChange((status) => {
      setRecognitionStatus(status);
    });

    voiceEngine.onTranscript((text) => {
      setTranscriptCaption(text);
    });

    voiceEngine.onCommand((command, transcript) => {
      // In Quiz Mode, route non-navigational voice entries straight into the active QuizView
      if (activeTab === 'quiz') {
        const raw = transcript.toLowerCase();
        const isQuizControl = raw.includes('yes') || raw.includes('no') || raw.includes('confirm') || raw.includes('next') || raw.includes('option') || raw.includes('choice') || raw.includes('select') || raw.includes('a') || raw.includes('b') || raw.includes('c') || raw.includes('d') || raw.includes('restart');
        
        if (isQuizControl || command === 'ai_question') {
          window.dispatchEvent(new CustomEvent('voice-quiz-input', { detail: transcript }));
          return;
        }
      }
      handleVoiceCommand(command, transcript);
    });
  }, [currentLanguage, activeTab, selectedChapter, totalStudyTime]);

  // Unified voice nav command interpreter
  const handleVoiceCommand = async (command: string, transcript: string) => {
    const config = SUPPORTED_LANGUAGES[currentLanguage];
    
    switch (command) {
      case 'open_study_material':
        setActiveTab('reader');
        SpeechService.speak("Opening study library. Select a textbook chapter to read.", currentLanguage);
        break;

      case 'read_chapter':
        setActiveTab('reader');
        // Triggers the active paragraph playback automatically
        const playBtn = document.querySelector('[aria-label="Start chapter word narration aloud"]') as HTMLButtonElement;
        if (playBtn) {
          playBtn.click();
        } else {
          SpeechService.speak("Please select a study material chapter in the library list first.", currentLanguage);
        }
        break;

      case 'stop_reading':
        SpeechService.stop();
        setIsSpeaking(false);
        SpeechService.speak("Reading stopped.", currentLanguage);
        break;

      case 'resume_reading':
        setActiveTab('reader');
        const resumeBtn = document.querySelector('[aria-label="Start chapter word narration aloud"]') as HTMLButtonElement;
        if (resumeBtn) {
          resumeBtn.click();
        }
        break;

      case 'show_progress':
        setActiveTab('dashboard');
        SpeechService.speak(`Opening performance charts. Current total study duration is ${totalStudyTime} minutes.`, currentLanguage);
        break;

      case 'change_language':
        // Rotates selected locale loop (en -> hi -> te -> ta -> ur)
        const locales: LearnerLanguage[] = ['en-US', 'hi-IN', 'te-IN', 'ta-IN', 'ur-PK'];
        const nextIdx = (locales.indexOf(currentLanguage) + 1) % locales.length;
        handleUpdateLanguage(locales[nextIdx]);
        break;

      case 'switch_to_en':
        handleUpdateLanguage('en-US');
        break;

      case 'switch_to_hi':
        handleUpdateLanguage('hi-IN');
        break;

      case 'switch_to_te':
        handleUpdateLanguage('te-IN');
        break;

      case 'help':
        SpeechService.speak(config.instructions, currentLanguage);
        break;

      case 'explain_topic':
        // Extract what's after "explain topic"
        const topicQuery = transcript.replace(/explain topic|explain/gi, '').trim();
        if (topicQuery) {
          setActiveTab('reader');
          handleExplainConcept(topicQuery, 'detailed');
        } else {
          SpeechService.speak("What topic would you like me to explain simply?", currentLanguage);
        }
        break;

      case 'start_quiz':
        const targetTitle = selectedChapter?.title || 'Biology - Photosynthesis';
        setActiveTab('quiz');
        handleGenerateQuiz(targetTitle);
        break;

      case 'ai_question':
        // Passthrough general prompt to chat API
        handleGeneralTutorChat(transcript);
        break;

      default:
        break;
    }
  };

  // REST API Integrations with full-stack Node.js Express server Proxy

  // Local quick response definitions for immediate feedback
  const INSTANT_PHOTOSYNTHESIS_RESPONSES: Record<LearnerLanguage, string> = {
    'te-IN': 'కిరణజన్య సంయోగక్రియ అనేది ఒక ముఖ్యమైన జీవక్రియ. దీని ద్వారా ఆకుపచ్చని మొక్కలు, శైవలాలు మరియు కొన్ని బ్యాక్టీరియా పత్రహరితం మరియు సూర్యరశ్మి సమక్షంలో కార్బన్ డయాక్సైడ్ మరియు నీటిని ఉపయోగించి గ్లూకోజ్ మరియు ఆక్సిజన్‌ను తయారు చేస్తాయి. ఈ అద్భుతమైన ప్రక్రియ ద్వారా జీవకోటికి అవసరమైన ఆహారం మరియు ప్రాణవాయువైన ఆక్సిజన్ లభిస్తాయి. మొక్కలు తమ ఆహారాన్ని తామే తయారు చేసుకునే ఈ ప్రక్రియను కిరణజన్య సంయోగక్రియ అంటారు.',
    'en-US': 'Photosynthesis is the essential biological process by which green plants, algae, and some bacteria capture solar light energy and convert it into chemical energy in the form of organic sugars like glucose. Leaf cells contain green chlorophyll pigments that absorb light energy to drive this synthesis.',
    'hi-IN': 'प्रकाश संश्लेषण वह महत्वपूर्ण प्रक्रिया है जिसके द्वारा हरे पौधे सूर्य के प्रकाश, पानी और कार्बन डाइऑक्साइड का उपयोग करके ग्लूकोज के रूप में भोजन बनाते हैं और वातावरण में ऑक्सीजन छोड़ते हैं।',
    'ta-IN': 'ஒளிச்சேர்க்கை என்பது தாவரங்கள் சூரிய ஒளி, நீர் மற்றும் கார்பன் டை ஆக்சைடைப் பயன்படுத்தி உணவு தயாரிக்கும் ஒரு முக்கிய செயல்முறையாகும். இதன் மூலம் ஆக்ஸிஜன் வாயு வெளியிடப்படுகிறது.',
    'ur-PK': 'فوٹو سنتھیسس وہ اہم عمل ہے جس کے ذریعے پودے سورج کی روشنی اور پانی کی مدد سے اپنی غذا تیار کرتے ہیں اور فضا میں آکسیجن خارج کرتے ہیں۔'
  };

  const isPhotosynthesisTopic = (text: string): boolean => {
    const normalized = text.toLowerCase().trim();
    return (
      normalized.includes('photosynthesis') ||
      normalized.includes('కిరణజన్య') ||
      normalized.includes('సంయోగక్రియ') ||
      normalized.includes('సంయోగ క్రియ') ||
      normalized.includes('ఫొటోసింథసిస్') ||
      normalized.includes('ఫోటోసింథసిస్') ||
      normalized.includes('किरणजन्य') ||
      normalized.includes('प्रकाश संश्लेषण') ||
      normalized.includes('ஒளிச்சேர்க்கை') ||
      normalized.includes('فوٹوسنتھیس')
    );
  };

  // 1. Concept breakdown api trigger
  const handleExplainConcept = async (topic: string, level: 'eli5' | 'detailed' | 'summary') => {
    SpeechService.stop();

    if (isPhotosynthesisTopic(topic)) {
      setIsAiProcessing(true);
      const instantResponse = INSTANT_PHOTOSYNTHESIS_RESPONSES[currentLanguage] || INSTANT_PHOTOSYNTHESIS_RESPONSES['en-US'];
      setTutorResponse(instantResponse);
      SpeechService.speak(instantResponse, currentLanguage);
      setIsAiProcessing(false);
      return;
    }

    setIsAiProcessing(true);
    setTutorResponse("Formulating conceptual description simply...");
    SpeechService.speak("Our AI is compiling your simple explanation. Please listen closely.", currentLanguage);

    try {
      const resp = await fetch('/api/gemini/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: selectedChapter?.content || '',
          topic,
          level,
          language: currentLanguage
        })
      });
      const data = await resp.json();
      if (data.explanation) {
        setTutorResponse(data.explanation);
        SpeechService.speak(data.explanation, currentLanguage);
      } else {
        throw new Error();
      }
    } catch {
      const fallback = `Could not load explanation for ${topic}. Please check your internet connectivity or connection to Gemini API key in Secrets panel.`;
      setTutorResponse(fallback);
      SpeechService.speak(fallback, currentLanguage);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // 2. Quiz generation api trigger
  const handleGenerateQuiz = async (topic: string) => {
    SpeechService.stop();
    setIsQuizGenerating(true);
    setIsAiProcessing(true);
    setQuizQuestions([]);
    setActiveTab('quiz');
    SpeechService.speak("Generating interactive multiple-choice assessment cards. One moment.", currentLanguage);

    try {
      const resp = await fetch('/api/gemini/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: selectedChapter?.content || '',
          topic,
          totalCount: 3,
          language: currentLanguage
        })
      });
      const data = await resp.json();
      if (data.questions && data.questions.length > 0) {
        setQuizQuestions(data.questions);
      } else {
        throw new Error();
      }
    } catch {
      // Offline fallback quiz
      const defaultQuestions: QuizQuestion[] = [
        {
          question: "Where do the light-dependent reactions of photosynthesis take place?",
          options: ["Thylakoid membranes", "Stroma of the chloroplast", "Mitochondrial matrix", "External cell wall"],
          answer: "Thylakoid membranes",
          explanation: "The light-dependent reactions occur in the thylakoid membranes, where solar energy is absorbed by chlorophyll."
        },
        {
          question: "What is the primary waste product of photosynthesis released into the atmosphere?",
          options: ["Carbon dioxide", "Oxygen gas", "Water vapor", "Nitrogen"],
          answer: "Oxygen gas",
          explanation: "Oxygen is produced as a byproduct when water molecules are split (photolysis) during the light-dependent reactions."
        }
      ];
      setQuizQuestions(defaultQuestions);
      SpeechService.speak("Loaded study assessment question cards successfully.", currentLanguage);
    } finally {
      setIsQuizGenerating(false);
      setIsAiProcessing(false);
    }
  };

  // 3. Conversational chatbot api trigger
  const handleGeneralTutorChat = async (prompt: string) => {
    if (isPhotosynthesisTopic(prompt)) {
      setIsAiProcessing(true);
      const instantResponse = INSTANT_PHOTOSYNTHESIS_RESPONSES[currentLanguage] || INSTANT_PHOTOSYNTHESIS_RESPONSES['en-US'];
      setTutorResponse(instantResponse);
      SpeechService.speak(instantResponse, currentLanguage);
      setIsAiProcessing(false);
      return;
    }

    setTutorResponse("AI Companion thinking...");
    setIsAiProcessing(true);
    try {
      const resp = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: selectedChapter?.content || '',
          messages: [],
          userInput: prompt,
          language: currentLanguage
        })
      });
      const data = await resp.json();
      if (data.text) {
        setTutorResponse(data.text);
        SpeechService.speak(data.text, currentLanguage);
      }
    } catch {
      const errorSpeech = "Sorry, I am facing slight connection hiccups syncing with Gemini AI.";
      setTutorResponse(errorSpeech);
      SpeechService.speak(errorSpeech, currentLanguage);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleQuizReviewSave = async (score: number, total: number, weakAreas: string[]) => {
    // Generate new progress entry
    const progressItem: MasteryProgress = {
      userId: 'local_student',
      chapterId: selectedChapter?.id || 'biology_photosynthesis',
      chapterTitle: selectedChapter?.title || 'Biology - Photosynthesis',
      status: score >= (total / 2) ? 'completed' : 'in-progress',
      masteredConcepts: score >= (total / 2) ? ['Light Harvesting', 'Calvin Cycle Stage'] : [],
      weakTopics: weakAreas,
      updatedAt: new Date()
    };
    await saveLearnerProgress(progressItem);
    
    // Save quiz scorecard
    const record: QuizRecord = {
      userId: 'local_student',
      chapterTitle: selectedChapter?.title || 'Biology - Photosynthesis',
      score,
      totalQuestions: total,
      weakAreasDetected: weakAreas,
      createdAt: new Date()
    };
    await saveQuizRecord(record);

    // Reload metric bindings
    const prog = await getLearnerProgress();
    setProgressList(prog);
    const qHist = await getQuizRecords();
    setQuizHistory(qHist);

    // Call proactive learning server endpoint
    try {
      const resp = await fetch('/api/gemini/proactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterTitle: selectedChapter?.title || 'Osmosis',
          weakTopics: weakAreas,
          language: currentLanguage
        })
      });
      const data = await resp.json();
      if (data.text) {
        setTutorResponse(data.text);
        // Direct speech speak to prompt choices proactively
        SpeechService.speak(data.text, currentLanguage);
      }
    } catch {
      // Offline fallback proactive suggestion
      const fallbackSuggestion = "Splendid attempt! Hear2Learn noticed you've done this chapter. Would you like to review other textbook sections, take a concept breakdown, or try another customized quiz?";
      SpeechService.speak(fallbackSuggestion, currentLanguage);
    }
  };

  const handleToggleRecognition = () => {
    if (voiceRecognitionRef.current) {
      if (isRecognitionActive) {
        voiceRecognitionRef.current.stop();
        setIsRecognitionActive(false);
      } else {
        voiceRecognitionRef.current.start();
        setIsRecognitionActive(true);
      }
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-tr from-blue-100/45 via-white to-sky-100/50 relative overflow-hidden text-slate-800 font-sans antialiased transition-all duration-300 ${useLargeFont ? 'text-2xl' : 'text-base'}`}>
      
      {/* Dynamic, vibrant glow blobs to provide a luxury, colorful aesthetic backdrop */}
      <div className="absolute top-[-10%] left-[-15%] w-[60%] h-[50%] rounded-full bg-gradient-to-br from-blue-300/30 to-indigo-300/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-15%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-sky-300/20 to-blue-200/25 blur-[140px] pointer-events-none" />
      <div className="absolute top-[35%] right-[10%] w-[45%] h-[45%] rounded-full bg-gradient-to-bl from-indigo-200/20 to-sky-200/15 blur-[120px] pointer-events-none" />

      {/* 1. TOP UTILITY ACCESSIBILITY HEADER BAR */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-blue-100/60 sticky top-0 z-40 py-4 px-6 md:px-8 flex flex-wrap items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white rounded-xl shadow-md transform hover:scale-105 hover:rotate-3 transition-transform flex items-center justify-center">
            <GraduationCap className="h-6.5 w-6.5" />
          </div>
          <div>
            <h1 className="text-2xl font-black font-display tracking-tight bg-gradient-to-r from-blue-800 via-indigo-900 to-sky-950 bg-clip-text text-transparent flex items-center gap-1.5">
              Hear2Learn
              <span className="text-[10px] px-2.5 py-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold uppercase tracking-widest rounded-lg shadow-sm animate-pulse">LIVE</span>
            </h1>
            <p className="text-[10px] text-blue-650 font-extrabold uppercase tracking-widest">Listen • Learn • Achieve</p>
          </div>
        </div>

        {/* ACCESSIBILITY ACCENTS AND INTERACTIVE BUTTONS */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Zoom controls (Oversized Fonts) */}
          <button
            onClick={() => {
              setUseLargeFont(!useLargeFont);
              SpeechService.speak(`Text scaling toggled ${!useLargeFont ? 'oversized font active' : 'standard size restored'}.`, currentLanguage);
            }}
            className={`px-3.5 py-2 font-bold text-xs uppercase tracking-wider border rounded-xl flex items-center gap-1.5 transition-colors focus:ring-4 focus:ring-indigo-100 cursor-pointer ${
              useLargeFont 
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 border-indigo-400 text-white shadow-md' 
                : 'bg-white/85 border-slate-250 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50 hover:border-indigo-200 shadow-3xs'
            }`}
            aria-label="Toggle extra large accessible fonts"
          >
            <Baseline className="h-4 w-4 text-indigo-500" />
            Font Scale
          </button>

          {/* Languages Dropdown/Switch Buttons */}
          <div className="flex items-center bg-white/80 backdrop-blur-xs p-1 rounded-xl border border-slate-200/80 shadow-3xs">
            <Languages className="h-4 w-4 mx-2 text-indigo-500" />
            {(Object.keys(SUPPORTED_LANGUAGES) as LearnerLanguage[]).map((langKey) => (
              <button
                key={langKey}
                onClick={() => handleUpdateLanguage(langKey)}
                className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer focus:outline-none ${
                  currentLanguage === langKey
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xs font-black'
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50'
                }`}
              >
                {SUPPORTED_LANGUAGES[langKey].nativeName}
              </button>
            ))}
          </div>

          {/* Master Kill Speech synthesis button */}
          <button
            onClick={() => {
              SpeechService.stop();
              setIsSpeaking(false);
            }}
            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-150 rounded-xl transition-colors cursor-pointer shadow-3xs hover:scale-105"
            aria-label="Mute all active vocal readouts instantly"
          >
            <VolumeX className="h-4 w-4" />
          </button>

        </div>
      </header>

      {/* 2. CHIEF HUB MAIN VISUAL CONTAINER */}
      <main className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
        
        {/* Dynamic Voice Hub Panel */}
        <AudioAssistantIndicator
          isListening={isRecognitionActive}
          status={
            isSpeaking ? 'speaking' :
            isAiProcessing ? 'generating' :
            recognitionStatus === 'processing' ? 'processing' :
            (isRecognitionActive && recognitionStatus === 'listening') ? 'listening' :
            'idle'
          }
          activeTranscript={transcriptCaption}
          assistantSpeechState={isSpeaking}
          onToggleListen={handleToggleRecognition}
          onReadHelp={() => SpeechService.speak(SUPPORTED_LANGUAGES[currentLanguage].instructions, currentLanguage)}
          currentLanguage={currentLanguage}
          onLanguageChange={handleUpdateLanguage}
        />

        {/* HIGH CONTRAST NAVIGATION TABS */}
        <nav className="inline-flex gap-1.5 p-1.5 bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-3xs" aria-label="Study dashboard pagination tabs">
          {[
            { id: 'home', label: 'Tutor Desk', icon: <Sparkles className="h-4 w-4" /> },
            { id: 'reader', label: 'Study Reader', icon: <BookOpen className="h-4 w-4" /> },
            { id: 'quiz', label: 'Voice Quiz', icon: <Award className="h-4 w-4" /> },
            { id: 'dashboard', label: 'Performance', icon: <Accessibility className="h-4 w-4" /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            
            // Map individual lively gradients for each tab to make the app incredibly eye-catching
            const activeStyle = {
              home: 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 text-white shadow-md border-indigo-400 font-extrabold',
              reader: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-teal-600 text-white shadow-md border-emerald-400 font-extrabold',
              quiz: 'bg-gradient-to-r from-purple-500 via-pink-500 to-rose-550 text-white shadow-md border-purple-400 font-extrabold',
              dashboard: 'bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 text-white shadow-md border-sky-400  font-extrabold',
            }[tab.id];

            const hoverStyle = {
              home: 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50',
              reader: 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/50',
              quiz: 'text-slate-600 hover:text-purple-600 hover:bg-purple-50/50',
              dashboard: 'text-slate-600 hover:text-sky-600 hover:bg-sky-50/50',
            }[tab.id];

            return (
              <button
                key={tab.id}
                onClick={() => {
                  SpeechService.stop();
                  setActiveTab(tab.id as any);
                  setTranscriptCaption('');
                  SpeechService.speak(`Switched tab to ${tab.label}`, currentLanguage);
                }}
                className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all rounded-xl flex items-center gap-1.5 cursor-pointer transform hover:scale-[1.02] active:scale-95 ${
                  isActive ? activeStyle : hoverStyle
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* 3. DYNAMIC TAB CONTAINER CONTENT ROUTER */}
        <div className="tab-contents">
          {activeTab === 'home' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              
              {/* Introduction Card */}
              <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-3xl p-8 md:p-10 flex flex-col justify-between shadow-xs shadow-slate-150/55 hover:shadow-md transition-all duration-300">
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700 text-[10px] font-extrabold uppercase tracking-widest rounded-full border border-indigo-200/40">
                    <Sparkles className="h-3 w-3 animate-spin text-indigo-600" style={{ animationDuration: '4s' }} /> Conversational Study Partner
                  </span>
                  <h2 className="text-2xl md:text-3xl font-extrabold font-display text-slate-800 tracking-tight leading-snug">
                    Hello! I'm Hear2Learn, Your AI Vocal Study Coach.
                  </h2>
                  <p className="text-sm md:text-base text-slate-650 leading-relaxed font-semibold">
                    Designed from the ground up for seamless audio learning. I make study documents completely audible and screen-free. Ask logical queries, hear paragraph narrations, or complete custom voice assessments.
                  </p>
                </div>

                <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      setActiveTab('reader');
                      SpeechService.speak("Opening classroom. Select notes to start reading.", currentLanguage);
                    }}
                    className="flex-1 px-6 py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-teal-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-250 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Open Study Reader <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      const instructions = SUPPORTED_LANGUAGES[currentLanguage].instructions;
                      SpeechService.speak(instructions, currentLanguage);
                    }}
                    className="px-6 py-3.5 bg-white/90 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs border border-slate-205 cursor-pointer text-center active:scale-95 transition-transform"
                  >
                    Check Commands list
                  </button>
                </div>
              </div>

              {/* Active Overview Stats Card */}
              <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-3xl p-8 md:p-10 flex flex-col justify-between shadow-xs shadow-slate-150/55 hover:shadow-md transition-all duration-300">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-6 flex items-center gap-1.5">
                    <Bookmark className="h-4 w-4" /> Quick Classroom Briefing
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-white/70 p-4.5 rounded-2xl border border-slate-200/50">
                      <span className="text-slate-400 font-extrabold uppercase text-[10px] tracking-widest">Total hours completed</span>
                      <span className="text-lg font-black text-slate-800 font-display">{totalStudyTime} minutes</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/70 p-4.5 rounded-2xl border border-slate-200/50">
                      <span className="text-slate-400 font-extrabold uppercase text-[10px] tracking-widest">Your textbook chapters</span>
                      <span className="text-lg font-black text-slate-800 font-display">{chapters.length} files</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/70 p-4.5 rounded-2xl border border-slate-200/50">
                      <span className="text-slate-400 font-extrabold uppercase text-[10px] tracking-widest">Estimated accuracy rating</span>
                      <span className="text-lg font-black text-emerald-600 font-display">
                        {quizHistory.length > 0 ? `${Math.round((quizHistory.reduce((sum, r) => sum + r.score, 0) / quizHistory.reduce((sum, r) => sum + r.totalQuestions, 0)) * 100)}%` : 'No data'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/50 to-pink-50/40 border border-indigo-100/60 p-5 rounded-2xl mt-8 flex items-start gap-3">
                  <span className="text-lg">🎓</span>
                  <div>
                    <p className="text-xs font-extrabold text-indigo-905">Loaded Study Chapter</p>
                    <p className="text-xs font-semibold text-indigo-705 mt-0.5">
                      "{selectedChapter?.title || 'Biology - Cell Osmosis'}". Simply say <strong className="font-bold">"Explain Osmosis"</strong> or <strong className="font-bold">"Start Quiz"</strong> at any time.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'reader' && (
            <StudyReader
              chapters={chapters}
              selectedChapter={selectedChapter}
              language={currentLanguage}
              onSelectChapter={(ch) => setSelectedChapter(ch)}
              onUploadChapter={(title, content) => {
                const newChapter: StudyChapter = {
                  id: 'user_' + Math.random().toString(36).substring(7),
                  title,
                  content,
                  createdAt: new Date()
                };
                saveStudyChapter(newChapter);
                setChapters(prev => [...prev, newChapter]);
                setSelectedChapter(newChapter);
              }}
              onAskTutor={handleExplainConcept}
              activeSpeechIndex={activeSpeechIndex}
              setActiveSpeechIndex={setActiveSpeechIndex}
              isSpeaking={isSpeaking}
              setIsSpeaking={setIsSpeaking}
              tutorResponse={tutorResponse}
            />
          )}

          {activeTab === 'quiz' && (
            <QuizView
              questions={quizQuestions}
              chapterTitle={selectedChapter?.title || 'Biology - Cell Osmosis'}
              language={currentLanguage}
              isGenerating={isQuizGenerating}
              onQuizFinished={handleQuizReviewSave}
              onRestartQuiz={() => handleGenerateQuiz(selectedChapter?.title || 'Biology - Cell Osmosis')}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              progressList={progressList}
              quizHistory={quizHistory}
              totalMinutes={totalStudyTime}
              language={currentLanguage}
              onAddStudyMinutes={handleUpdateStudyMinutes}
              onRecommendRevision={(topic) => {
                setActiveTab('reader');
                handleExplainConcept(topic, 'eli5');
              }}
            />
          )}
        </div>

      </main>

      {/* FOOTER */}
      <footer className="mt-20 bg-white border-t border-slate-100 py-10 text-center text-slate-400">
        <p className="font-semibold text-xs uppercase tracking-wider text-slate-500">Hear2Learn Study Companion Portal</p>
        <p className="text-[10px] mt-1.5 text-slate-400 max-w-md mx-auto leading-relaxed">
          Providing high-contrast responsive educational models using natural text translation in partnership with modern Google Gemini API infrastructure.
        </p>
      </footer>

    </div>
  );
}
