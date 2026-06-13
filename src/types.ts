export type LearnerLanguage = 'en-US' | 'hi-IN' | 'te-IN' | 'ta-IN' | 'ur-PK';

export interface LanguageConfig {
  code: LearnerLanguage;
  name: string;
  nativeName: string;
  speakConfirmation: string;
  welcomeMessage: string;
  instructions: string;
}

export const SUPPORTED_LANGUAGES: Record<LearnerLanguage, LanguageConfig> = {
  'en-US': {
    code: 'en-US',
    name: 'English',
    nativeName: 'English',
    speakConfirmation: 'Language changed to English.',
    welcomeMessage: 'Welcome to Hear to Learn, your voice study partner. Say "help" anytime to hear instructions.',
    instructions: 'You can navigate hands-free. Spoken commands are: "Open Study Material", "Read Chapter", "Explain Topic", "Start Quiz", "Show Progress", "Change Language", "Stop Reading", and "Resume Reading".'
  },
  'hi-IN': {
    code: 'hi-IN',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    speakConfirmation: 'भाषा बदलकर हिंदी हो गई है।',
    welcomeMessage: 'हियर टू लर्न में आपका स्वागत है। निर्देश सुनने के लिए किसी भी समय "सहायता" कहें।',
    instructions: 'आप बिना छुए नेविगेट कर सकते हैं। आप "ओपन स्टडी मटेरियल", "रीड चैप्टर", "एक्सप्लेन टॉपिक", "स्टार्ट क्विज़", "शो प्रोग्रेस", "चेंज लैंग्वेज", "स्टॉप रीडिंग", और "रेज़्युम रीडिंग" बोल सकते हैं।'
  },
  'te-IN': {
    code: 'te-IN',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    speakConfirmation: 'భాష తెలుగులోకి మార్చబడింది.',
    welcomeMessage: 'హియర్ టు లెర్న్ కు స్వాగతం. సూచనలు వినడానికి ఎప్పుడైనా "సహాయం" అని చెప్పండి.',
    instructions: 'మీరు హ్యాండ్స్-ఫ్రీగా నావిగేట్ చేయవచ్చు. ఆదేశాలు: "ఓపెన్ స్టడీ మెటీరియల్", "రీడ్ చాప్టర్", "ఎక్స్‌ప్లెయిన్ టాపిక్", "స్టార్ట్ క్విజ్", "షో ప్రోగ్రెస్", "చేంజ్ లాంగ్వేజ్", "స్టాప్ రీడింగ్", "రెజ్యూమ్ రీడింగ్".'
  },
  'ta-IN': {
    code: 'ta-IN',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    speakConfirmation: 'மொழி தமிழுக்கு மாற்றப்பட்டது.',
    welcomeMessage: 'ஹியர் டு லெர்ன் உங்களை வரவேற்கிறது. வழிமுறைகளைக் கேட்க எந்த நேரத்திலும் "உதவி" என்று கூறுங்கள்.',
    instructions: 'நீங்கள் கைகளைக் பயன்படுத்தாமல் வழிநடத்தலாம். கட்டளைகள்: "ஓபன் ஸ்டடி மெட்டீரியல்", "ரீட் சேப்டர்", "எக்ஸ்ப்ளைன் டாபிக்", "ஸ்டார்ட் க்விஸ்", "ஷோ ப்ரோக்ரஸ்", "சேஞ்ச் லாங்குவேஜ்", "ஸ்டாப் ரீடிங்", "ரெஸ்யூம் ரீடிங்".'
  },
  'ur-PK': {
    code: 'ur-PK',
    name: 'Urdu',
    nativeName: 'اردو',
    speakConfirmation: 'زبان کو اردو میں تبدیل کر دیا گیا ہے۔',
    welcomeMessage: 'ہیئر ٹو لرن میں آپ کا خیر مقدم ہے۔ ہدایات سننے کے لیے کسی بھی وقت "مدد" کہیں۔',
    instructions: 'آپ ہینڈز فری نیویگیٹ کر سکتے ہیں۔ ہدایات یہ ہیں: "اوپن اسٹڈی مٹیریل"، "ریڈ چیپٹر"، "ایکسپلین ٹاپک"، "اسٹارٹ کوئز"، "شو پروگریس"، "چینج لینگویج"، "اسٹاپ ریڈنگ"، اور "ریزوم ریڈنگ"۔'
  }
};

export interface StudyChapter {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
}

export interface MasteryProgress {
  userId: string;
  chapterId: string;
  chapterTitle: string;
  status: 'in-progress' | 'completed';
  masteredConcepts: string[];
  weakTopics: string[];
  updatedAt: Date;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string; // The text of the correct option
  explanation: string;
}

export interface QuizRecord {
  id?: string;
  userId: string;
  chapterTitle: string;
  score: number;
  totalQuestions: number;
  weakAreasDetected: string[];
  createdAt: Date;
}

export interface UserProfile {
  uid: string;
  totalStudyTime: number; // in minutes
  language: LearnerLanguage;
  createdAt: Date;
  updatedAt: Date;
}
