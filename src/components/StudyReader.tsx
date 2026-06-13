import React, { useState, useRef } from 'react';
import { FileText, Upload, Volume2, Square, Play, Sparkles, HelpCircle, FileImage, ArrowRight, BookOpen } from 'lucide-react';
import { StudyChapter, LearnerLanguage } from '../types';
import { extractTextFromPDF, extractTextFromImage } from '../services/documents';
import { SpeechService } from '../services/speech';

interface StudyReaderProps {
  chapters: StudyChapter[];
  selectedChapter: StudyChapter | null;
  language: LearnerLanguage;
  onSelectChapter: (chapter: StudyChapter) => void;
  onUploadChapter: (title: string, content: string) => void;
  onAskTutor: (topic: string, level: 'eli5' | 'detailed' | 'summary') => void;
  activeSpeechIndex: number;
  setActiveSpeechIndex: (index: number) => void;
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;
  tutorResponse: string;
}

export default function StudyReader({
  chapters,
  selectedChapter,
  language,
  onSelectChapter,
  onUploadChapter,
  onAskTutor,
  activeSpeechIndex,
  setActiveSpeechIndex,
  isSpeaking,
  setIsSpeaking,
  tutorResponse,
}: StudyReaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [customExplainText, setCustomExplainText] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Split chapter text into readable paragraphs
  const paragraphs = selectedChapter 
    ? selectedChapter.content.split('\n\n').filter(p => p.trim().length > 0)
    : [];

  // Speech playing controls
  const handleReadChapter = (startIndex: number = 0) => {
    if (paragraphs.length === 0) return;
    setIsSpeaking(true);
    setActiveSpeechIndex(startIndex);
    playParagraph(startIndex);
  };

  const playParagraph = (index: number) => {
    if (index >= paragraphs.length) {
      setIsSpeaking(false);
      setActiveSpeechIndex(0);
      return;
    }

    setActiveSpeechIndex(index);
    SpeechService.speak(
      paragraphs[index],
      language,
      () => {
        // Automatically play next paragraph when done
        if (isSpeaking) {
          playParagraph(index + 1);
        }
      }
    );
  };

  const handleStopReading = () => {
    SpeechService.stop();
    setIsSpeaking(false);
  };

  const handleResumeReading = () => {
    setIsSpeaking(true);
    playParagraph(activeSpeechIndex);
  };

  // Drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setUploadProgress('Analyzing upload...');
    try {
      let extractedText = '';
      if (file.type === 'application/pdf') {
        extractedText = await extractTextFromPDF(file, (percent) => {
          setUploadProgress(`Processing PDF pages... ${percent}%`);
        });
      } else if (file.type.startsWith('image/')) {
        extractedText = await extractTextFromImage(file, (status) => {
          setUploadProgress(status);
        });
      } else {
        throw new Error("Unsupported format. Please upload a PDF file or PNG/JPG image.");
      }

      if (!extractedText) {
        throw new Error("We couldn't extract any textbook text from this file. Is it empty?");
      }

      // Generate a user-friendly chapter title
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      onUploadChapter(cleanTitle, extractedText);
      setUploadProgress('Chapter scanned successfully!');
      
      // Let speech welcome user to newly uploaded notes
      SpeechService.speak(`Success! We parsed ${cleanTitle}. You can say "Read Chapter" to start studying it.`, language);
    } catch (err: any) {
      setUploadProgress('');
      alert(err.message || "Extraction error occurred.");
      SpeechService.speak("We were unable to parse your document. Please try a higher quality image.", language);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* LEFT COLUMN: Chapters list & Note Scanners */}
      <div className="lg:col-span-1 flex flex-col gap-6">
        
        {/* Document Uploader Card */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`bg-white border rounded-3xl p-6 md:p-8 text-center transition-all flex flex-col items-center justify-center min-h-[240px] relative overflow-hidden shadow-sm shadow-slate-100 ${
            isDragging 
              ? 'border-green-500 bg-green-50/30' 
              : 'border-slate-200 border-dashed hover:border-green-400 hover:shadow-md'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,image/*"
            className="hidden" 
          />

          {isProcessing ? (
            <div className="flex flex-col items-center gap-4 text-slate-800">
              <svg className="animate-spin h-9 w-9 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-sm font-bold text-green-600 uppercase tracking-wider">{uploadProgress}</p>
            </div>
          ) : (
            <>
              <div className="p-3.5 bg-green-50 rounded-2xl text-green-600 mb-4 border border-green-150">
                <Upload className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold font-display text-slate-800 mb-1">Upload Material</h3>
              <p className="text-xs text-slate-400 max-w-[240px] mb-5 font-semibold">
                Drag and drop or select a <span className="text-green-600 font-bold">PDF</span> chapter or a document <span className="text-green-600 font-bold">Image</span>.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-xs shadow-sm shadow-green-100 cursor-pointer active:scale-95 transition-transform"
              >
                Scan File
              </button>
            </>
          )}
        </div>

        {/* Chapters / Topics Catalog */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm shadow-slate-100">
          <h3 className="text-lg font-bold font-display text-slate-800 mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-green-500" />
            Study Materials
          </h3>

          <div className="flex flex-col gap-2.5 max-h-[350px] overflow-y-auto pr-1">
            {chapters.map((ch) => {
              const isActive = selectedChapter?.id === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    handleStopReading();
                    onSelectChapter(ch);
                  }}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3.5 focus:outline-none focus:ring-2 focus:ring-green-400 cursor-pointer ${
                    isActive
                      ? 'bg-green-50 border-green-200 text-green-900 shadow-2xs'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <FileText className={`h-5 w-5 mt-0.5 flex-shrink-0 ${isActive ? 'text-green-600' : 'text-slate-400'}`} />
                  <div className="overflow-hidden">
                    <p className={`font-bold text-sm tracking-tight line-clamp-1 ${isActive ? 'text-green-900' : 'text-slate-850'}`}>{ch.title}</p>
                    <p className={`text-[10px] mt-0.5 font-semibold uppercase tracking-wider ${isActive ? 'text-green-600' : 'text-slate-400'}`}>
                      {ch.content.split(/\s+/).length} words • Scanned Docs
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Voice Command panel Cheat Sheet */}
        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-green-700 mb-4 flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Vocal Navigation Tips
          </h4>
          <ul className="text-xs text-slate-600 space-y-3 font-semibold">
            <li className="flex items-center gap-2">🗣️ <span>"Open Study Material" <span className="text-slate-400 font-normal">to open list</span></span></li>
            <li className="flex items-center gap-2">🗣️ <span>"Read Chapter" <span className="text-slate-400 font-normal">to start voice reading</span></span></li>
            <li className="flex items-center gap-2">🗣️ <span>"Stop Reading" <span className="text-slate-400 font-normal">to pause voice reading</span></span></li>
            <li className="flex items-center gap-2">🗣️ <span>"Resume Reading" <span className="text-slate-400 font-normal">to continue</span></span></li>
            <li className="flex items-center gap-2">🗣️ <span>"Explain topic [Water]" <span className="text-slate-400 font-normal">to clarify</span></span></li>
            <li className="flex items-center gap-2">🗣️ <span>"Start Quiz" <span className="text-slate-400 font-normal">to test mastery</span></span></li>
            <li className="flex items-center gap-2">🗣️ <span>"Show Progress" <span className="text-slate-400 font-normal">to review marks</span></span></li>
          </ul>
        </div>
      </div>

      {/* RIGHT COLUMN: Scanned Notes Text Highlight & Smart Reader */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        
        {/* Active Study Panel */}
        {selectedChapter ? (
          <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-sm shadow-slate-100">
            
            {/* Header controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-xl md:text-2xl font-bold font-display text-slate-800 tracking-tight leading-none mb-1">{selectedChapter.title}</h2>
                <p className="text-xs text-slate-400 font-semibold">Continuous voice navigation active</p>
              </div>

              {/* Speech Controls row */}
              <div className="flex gap-2">
                {isSpeaking ? (
                  <button
                    onClick={handleStopReading}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs hover:shadow-sm active:scale-95 transition-transform cursor-pointer"
                    aria-label="Stop text reader narration"
                  >
                    <Square className="h-3.5 w-3.5" /> Stop
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleReadChapter(activeSpeechIndex)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-xs hover:shadow-md active:scale-95 transition-transform cursor-pointer"
                      aria-label="Start chapter word narration aloud"
                    >
                      <Play className="h-3.5 w-3.5" /> {activeSpeechIndex > 0 ? "Resume" : "Read aloud"}
                    </button>
                    {activeSpeechIndex > 0 && (
                      <button
                        onClick={() => handleReadChapter(0)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold rounded-xl text-xs active:scale-95 transition-transform cursor-pointer"
                      >
                        Restart
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Paragraph view high contrast */}
            <div className="rounded-2xl border border-slate-100 bg-[#F8FAFC] p-4 max-h-[400px] overflow-y-auto space-y-4">
              {paragraphs.map((p, pIdx) => {
                const isSelected = pIdx === activeSpeechIndex;
                return (
                  <div
                    key={pIdx}
                    onClick={() => {
                      handleStopReading();
                      handleReadChapter(pIdx);
                    }}
                    className={`p-5 rounded-2xl cursor-pointer border transition-all ${
                      isSelected
                        ? 'bg-white border-green-500 text-slate-800 shadow-sm ring-1 ring-green-100'
                        : 'border-transparent text-slate-600 hover:bg-white hover:border-slate-200'
                    }`}
                  >
                    {/* Read Speaker badge for accessibility view */}
                    {isSelected && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-semibold rounded-lg mb-2 animate-pulse">
                        <Volume2 className="h-3.5 w-3.5" /> Paragraph {pIdx + 1} Playing
                      </span>
                    )}
                    <p className={`text-base leading-relaxed ${isSelected ? 'font-bold text-slate-800' : 'font-medium'}`}>
                      {p}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* AI Assistant Rapid Prompter Card */}
            <div className="bg-slate-50 text-slate-800 p-6 rounded-2xl border border-slate-100 mt-4">
              <h4 className="text-base font-bold font-display flex items-center gap-1.5 mb-3 text-slate-800">
                <Sparkles className="h-4 w-4 text-green-600" />
                AI Study Coach Insights
              </h4>
              
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => onAskTutor(selectedChapter.title, 'eli5')}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-green-200 hover:bg-green-50 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  ELI5 Mode (Simple Analogy)
                </button>
                <button
                  onClick={() => onAskTutor(selectedChapter.title, 'summary')}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-green-200 hover:bg-green-50 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Generate Quick Summary
                </button>
              </div>

              {/* Custom prompt parser input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask any study question about this textbook chapter..."
                  value={customExplainText}
                  onChange={(e) => setCustomExplainText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customExplainText) {
                      onAskTutor(customExplainText, 'detailed');
                      setCustomExplainText('');
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 font-medium text-xs focus:border-green-400 focus:outline-none"
                />
                <button
                  onClick={() => {
                    if (customExplainText) {
                      onAskTutor(customExplainText, 'detailed');
                      setCustomExplainText('');
                    }
                  }}
                  className="px-4 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {/* Dynamic sidebar dialogue readout */}
              {tutorResponse && (
                <div className="mt-4 bg-white border border-slate-100 p-4 rounded-xl shadow-2xs">
                  <span className="text-[9px] font-bold text-green-600 uppercase tracking-widest block mb-1">Tutor Explanation</span>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">{tutorResponse}</p>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center text-slate-800 min-h-[350px] flex flex-col items-center justify-center shadow-sm shadow-slate-100">
            <BookOpen className="h-12 w-12 text-slate-300 mb-4 animate-pulse" />
            <h2 className="text-xl font-bold font-display mb-1 text-slate-850">No Document Selected</h2>
            <p className="text-slate-400 text-xs font-semibold max-w-sm mb-6">
              Please click on an active chapter from your Study Materials list or scan a new textbook PDF page above to start voice-command learning.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
