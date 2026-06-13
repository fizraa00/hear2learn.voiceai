import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Volume2, HelpCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LearnerLanguage, SUPPORTED_LANGUAGES } from '../types';

interface AudioAssistantIndicatorProps {
  isListening: boolean;
  status: 'idle' | 'listening' | 'processing' | 'generating' | 'speaking';
  activeTranscript: string;
  assistantSpeechState: boolean; // true if speaking
  onToggleListen: () => void;
  onReadHelp: () => void;
  currentLanguage: LearnerLanguage;
  onLanguageChange: (lang: LearnerLanguage) => void;
}

export default function AudioAssistantIndicator({
  isListening,
  status,
  activeTranscript,
  assistantSpeechState,
  onToggleListen,
  onReadHelp,
  currentLanguage,
  onLanguageChange,
}: AudioAssistantIndicatorProps) {

  // Accessible spacebar keydown listener to toggle listening
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        onToggleListen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleListen]);

  return (
    <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-3xl p-6 md:p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl shadow-indigo-100/30 transition-all duration-300">
      
      {/* Decorative gradient overlay representing intelligence/growth */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Content Area */}
      <div className="flex flex-col gap-4 flex-1 w-full">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center p-2 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white rounded-xl shadow-md">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <h2 className="text-xl md:text-2xl font-black font-display text-slate-800 tracking-tight">
            Voice Companion Hub
          </h2>
          <button
            onClick={onReadHelp}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Read voice command instructions aloud"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>

        {/* State Badges & Description */}
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <span className="text-sm font-semibold text-slate-500">Status</span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-extrabold uppercase tracking-wider rounded-full transition-all shadow-2xs ${
            status === 'listening' 
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse' 
              : status === 'processing' 
              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' 
              : status === 'generating'
              ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
              : status === 'speaking'
              ? 'bg-purple-100 text-purple-800 border border-purple-200'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}>
            <span className={`h-2.5 w-2.5 rounded-full ${
              status === 'listening' ? 'bg-emerald-600 scale-105' 
              : status === 'processing' ? 'bg-indigo-500' 
              : status === 'generating' ? 'bg-amber-500'
              : status === 'speaking' ? 'bg-purple-600 animate-ping'
              : 'bg-slate-400'
            }`} />
            {status === 'listening' ? 'Listening...' 
              : status === 'processing' ? 'Processing...' 
              : status === 'generating' ? 'Generating Response...' 
              : status === 'speaking' ? 'Speaking...' 
              : 'Idle'}
          </span>
        </div>

        {/* Tactile, Accessible Instant Language Selection Grid */}
        <div className="flex flex-col gap-2 mt-2 bg-white/70 border border-slate-200/50 p-3 rounded-2xl max-w-xl shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
              🗣️ Study Partner Language:
            </span>
            <span className="text-[10px] text-teal-700 font-extrabold bg-teal-100/80 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
              {SUPPORTED_LANGUAGES[currentLanguage].name} Mode
            </span>
          </div>
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-1.5 mt-1">
            {(Object.keys(SUPPORTED_LANGUAGES) as LearnerLanguage[]).map((langKey) => {
              const isActive = currentLanguage === langKey;
              return (
                <button
                  key={langKey}
                  onClick={() => onLanguageChange(langKey)}
                  className={`py-2 px-1 text-center font-bold text-xs rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-0.5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer focus:outline-none ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm font-extrabold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-indigo-50/50 hover:text-indigo-650'
                  }`}
                  aria-label={`Switch study language to ${SUPPORTED_LANGUAGES[langKey].name}`}
                >
                  <span className="text-xs tracking-tight">{SUPPORTED_LANGUAGES[langKey].nativeName}</span>
                  <span className={`text-[8px] font-bold uppercase tracking-wider ${isActive ? 'text-teal-100' : 'text-slate-400'}`}>
                    {SUPPORTED_LANGUAGES[langKey].name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Voice Waves indicator */}
        {isListening && (
          <div className="flex items-center gap-1.5 h-10 mt-2 bg-indigo-50/50 px-4 py-2 rounded-xl border border-indigo-100/50 max-w-[340px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mr-2">Vocal Wave</span>
            <div className="w-1 h-4 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s', animationDuration: '0.8s' }}></div>
            <div className="w-1 h-6 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '0.8s' }}></div>
            <div className="w-1 h-8 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s', animationDuration: '0.8s' }}></div>
            <div className="w-1 h-5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s', animationDuration: '0.8s' }}></div>
            <div className="w-1 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '0.8s' }}></div>
          </div>
        )}

        {/* Interactive Speech Captions Bubble */}
        <AnimatePresence mode="popLayout">
          {activeTranscript && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white border border-slate-200/60 rounded-2xl p-5 mt-2 shadow-xs"
            >
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block mb-1">Recognized Words</span>
              <p className="text-lg font-medium text-slate-700 italic leading-snug">
                "{activeTranscript}"
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Speaking Alert Bar */}
        {assistantSpeechState && (
          <div className="flex items-center gap-2 mt-2 text-indigo-600 font-extrabold tracking-tight text-sm animate-pulse">
            <Volume2 className="h-5 w-5 text-indigo-500" />
            <span>Assistant is speaking content aloud</span>
          </div>
        )}

        {/* Quick keyboard instruction tip */}
        <p className="text-xs text-slate-400 mt-2">
          💡 <span className="font-semibold text-slate-500">Shortcut:</span> Tap your <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-250 rounded text-slate-600 font-mono text-[10px]">Spacebar</kbd> at any point to toggle the microphone hands-free.
        </p>
      </div>

      {/* Round Minimalist Controller Block */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onToggleListen}
          className={`h-24 w-24 rounded-full flex items-center justify-center transition-all duration-300 border focus:outline-none focus:ring-4 focus:ring-indigo-150 cursor-pointer ${
            isListening 
              ? 'bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 text-white shadow-lg shadow-teal-200/50 border-none hover:scale-105 active:scale-95' 
              : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 shadow-sm hover:scale-105 active:scale-95'
          }`}
          aria-label={isListening ? "Stop listening commands" : "Start listening commands"}
        >
          {isListening ? (
            <div className="relative flex items-center justify-center">
              <Mic className="h-10 w-10 animate-pulse text-white" />
              <span className="absolute -inset-4 rounded-full border border-teal-400 animate-ping opacity-35" />
            </div>
          ) : (
            <MicOff className="h-10 w-10 text-slate-400" />
          )}
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 animate-pulse">
          {isListening ? "Listening Mode" : "Tap To Speak"}
        </span>
      </div>
    </div>
  );
}
