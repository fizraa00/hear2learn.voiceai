import React, { useState, useEffect } from 'react';
import { HelpCircle, Star, MessageSquareCode, Sparkles, CheckCircle2, XCircle, ArrowRight, RotateCcw, Volume2 } from 'lucide-react';
import { QuizQuestion, LearnerLanguage } from '../types';
import { SpeechService } from '../services/speech';

interface QuizViewProps {
  questions: QuizQuestion[];
  chapterTitle: string;
  language: LearnerLanguage;
  onQuizFinished: (score: number, total: number, weakAreas: string[]) => void;
  onRestartQuiz: () => void;
  isGenerating: boolean;
}

export default function QuizView({
  questions,
  chapterTitle,
  language,
  onQuizFinished,
  onRestartQuiz,
  isGenerating,
}: QuizViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [weakAreas, setWeakAreas] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  const activeQuestion = questions[currentIndex];
  const optionLetters = ["A", "B", "C", "D"];

  // Auto-read question on load
  useEffect(() => {
    if (activeQuestion && !isGenerating && !isFinished && !isAnswered && selectedOption === null) {
      // Small timeout to allow any ongoing transition speech to settle first
      const timer = setTimeout(() => {
        readActiveQuestion();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, activeQuestion, isGenerating, isFinished]);

  const readActiveQuestion = () => {
    if (!activeQuestion) return;
    SpeechService.stop();
    const cleanQuestion = activeQuestion.question;
    const spokenOptions = activeQuestion.options.map((opt, i) => `Option ${optionLetters[i]}. ${opt}`).join('. ');
    const fullText = `Question ${currentIndex + 1}. ${cleanQuestion}. ${spokenOptions}. Please say your answer: Option A, B, C, or D.`;
    SpeechService.speak(fullText, language);
  };

  const handleSelectOption = (option: string) => {
    if (isAnswered) return;
    SpeechService.stop();
    setSelectedOption(option);

    const optIdx = activeQuestion.options.indexOf(option);
    const letter = optionLetters[optIdx] || "A";

    const speakText = `You selected Option ${letter}. ${option}. Is this your final answer? Click or say Yes to confirm, or select another option to change.`;
    SpeechService.speak(speakText, language);
  };

  const confirmSelectedAnswer = () => {
    if (!activeQuestion || selectedOption === null || isAnswered) return;
    setIsAnswered(true);

    const isCorrect = selectedOption === activeQuestion.answer;
    let feedbackText = '';

    if (isCorrect) {
      setScore(prev => prev + 1);
      feedbackText = `Correct! Excellent job. ${activeQuestion.explanation}`;
    } else {
      const correctIdx = activeQuestion.options.indexOf(activeQuestion.answer);
      const correctLetter = optionLetters[correctIdx] || "A";
      
      // Trace weak topic
      const topicMatch = activeQuestion.explanation.match(/about ([A-Za-z ]+)/) || [null, chapterTitle];
      const weakTopicName = topicMatch[1] || chapterTitle;
      if (!weakAreas.includes(weakTopicName)) {
        setWeakAreas(prev => [...prev, weakTopicName]);
      }
      feedbackText = `Incorrect. You selected Option ${optionLetters[activeQuestion.options.indexOf(selectedOption)]}. The correct answer was Option ${correctLetter}: ${activeQuestion.answer}. ${activeQuestion.explanation}`;
    }

    const nextIndex = currentIndex + 1;
    const nextActionText = nextIndex < questions.length
      ? "Moving to the next question."
      : "Preparing your final scorecard report.";

    // Automatically proceed to the next card once feedback is vocalized
    SpeechService.speak(
      `${feedbackText} ${nextActionText}`,
      language,
      () => {
        if (nextIndex < questions.length) {
          setSelectedOption(null);
          setIsAnswered(false);
          setCurrentIndex(nextIndex);
        } else {
          const finalScore = isCorrect ? score + 1 : score;
          finishQuiz(finalScore);
        }
      }
    );
  };

  const handleNext = () => {
    SpeechService.stop();

    const nextIndex = currentIndex + 1;
    if (nextIndex < questions.length) {
      setSelectedOption(null);
      setIsAnswered(false);
      setCurrentIndex(nextIndex);
    } else {
      finishQuiz(score);
    }
  };

  const finishQuiz = (finalScore: number) => {
    setIsFinished(true);
    onQuizFinished(finalScore, questions.length, weakAreas);

    const passed = finalScore >= (questions.length / 2);
    const scoreText = `Quiz completed! You scored ${finalScore} out of ${questions.length} questions. ${
      passed
        ? "Excellent job! You have fully mastered this section."
        : "Good session! I suggest a brief revision of weak concepts to boost your scores."
    } You can retake this chapter quiz anytime by saying restart quiz.`;

    SpeechService.speak(scoreText, language);
  };

  // Setup voice commands listener specifically for the QuizView container
  useEffect(() => {
    const handleVoiceInput = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const text = customEvent.detail.toLowerCase().trim();
      console.log("[QUIZ INCOMING VOCAL]:", text);

      if (isFinished) {
        if (text.includes("restart") || text.includes("retake") || text.includes("start over")) {
          onRestartQuiz();
        }
        return;
      }

      if (isAnswered) {
        if (text.includes("next") || text.includes("continue") || text.includes("forward") || text.includes("view final report") || text.includes("report")) {
          handleNext();
        }
        return;
      }

      // If an option is selected but not yet confirmed
      if (selectedOption !== null) {
        const isYes = text === 'yes' || text.includes('yes') || text.includes('confirm') || text.includes('yeah') || text.includes('correct') || text.includes('ok');
        const isNo = text === 'no' || text.includes('no') || text.includes('cancel') || text.includes('change') || text.includes('nope');

        if (isYes) {
          confirmSelectedAnswer();
          return;
        } else if (isNo) {
          setSelectedOption(null);
          SpeechService.speak("Option canceled. Please say your answer option: A, B, C, or D.", language);
          return;
        }
      }

      // Check option letter selection (Stand-alone or phrase)
      let matchedIdx = -1;
      for (let i = 0; i < optionLetters.length; i++) {
        const letter = optionLetters[i].toLowerCase();
        const patterns = [
          new RegExp(`\\boption ${letter}\\b`, 'i'),
          new RegExp(`\\bchoice ${letter}\\b`, 'i'),
          new RegExp(`\\bselect ${letter}\\b`, 'i'),
          new RegExp(`\\boption ${i + 1}\\b`, 'i'),
          new RegExp(`\\bnumber ${i + 1}\\b`, 'i'),
        ];

        const matchesPattern = patterns.some(p => p.test(text));
        const isExactLetter = text === letter || text === `option ${letter}`;

        if (matchesPattern || isExactLetter) {
          matchedIdx = i;
          break;
        }
      }

      // If no letter matching, try matching on literal text strings of options
      if (matchedIdx === -1 && activeQuestion) {
        matchedIdx = activeQuestion.options.findIndex(opt =>
          text.includes(opt.toLowerCase())
        );
      }

      if (matchedIdx !== -1 && activeQuestion) {
        handleSelectOption(activeQuestion.options[matchedIdx]);
      } else {
        // Did not match letter, option text, or yes/n_o
        if (selectedOption !== null) {
          SpeechService.speak("Please say Yes to confirm your selected option, or say another option to change.", language);
        } else {
          SpeechService.speak("Answer not recognized. Please say option A, B, C, or D.", language);
        }
      }
    };

    window.addEventListener('voice-quiz-input', handleVoiceInput);
    return () => window.removeEventListener('voice-quiz-input', handleVoiceInput);
  }, [currentIndex, activeQuestion, isAnswered, isFinished, selectedOption, score, weakAreas]);

  if (isGenerating) {
    return (
      <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center text-slate-800 flex flex-col items-center justify-center min-h-[350px] shadow-sm shadow-slate-100">
        <svg className="animate-spin h-12 w-12 text-green-500 mb-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <h3 className="text-2xl font-bold font-display text-slate-800 mb-2">Assembling Your Quiz...</h3>
        <p className="text-slate-500 max-w-sm text-sm font-semibold">
          Our Hear2Learn AI is fetching textbook content to generate custom interactive test questions.
        </p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center text-slate-800 min-h-[350px] flex flex-col items-center justify-center shadow-sm shadow-slate-100">
        <HelpCircle className="h-14 w-14 text-slate-300 mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold font-display mb-2">No Active Quiz Questions</h2>
        <p className="text-slate-500 max-w-sm text-sm font-semibold mb-6">
          Generate an educational voice quiz by saying <strong className="text-green-600">"Start Quiz"</strong> or choosing a textbook chapter from the Study Reader.
        </p>
        <button
          onClick={onRestartQuiz}
          className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-sm shadow-green-100 cursor-pointer transition-transform hover:scale-[1.02] active:scale-95"
          aria-label="Initialize or generate custom quiz questions"
        >
          Check Options
        </button>
      </div>
    );
  }

  if (isFinished) {
    const passed = score >= (questions.length / 2);
    return (
      <div className="bg-white border border-slate-100 rounded-3xl p-8 max-w-2xl mx-auto shadow-xl shadow-slate-100 relative text-slate-800">
        <div className="absolute top-0 inset-x-0 h-2 bg-green-500 rounded-t-3xl" />

        <div className="text-center mb-8 mt-4">
          <div className="inline-flex p-4 bg-green-50 text-green-600 rounded-full mb-4">
            <Star className="h-10 w-10 animate-pulse" />
          </div>
          <h2 className="text-3xl font-bold font-display text-slate-800 mb-1">Quiz Finished!</h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">{chapterTitle}</p>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center mb-8">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1 font-bold">Your Score Card</p>
          <p className="text-6xl font-extrabold text-slate-800 mb-2 font-display">
            {score} <span className="text-3xl text-slate-400">/ {questions.length}</span>
          </p>
          <span className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full inline-block ${
            passed ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
          }`}>
            {passed ? "Chapter Mastered" : "Revision Suggested"}
          </span>
        </div>

        {weakAreas.length > 0 && (
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mb-8">
            <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-500" />
              Revision Recommendations
            </h4>
            <p className="text-xs text-slate-500 mb-4 font-semibold">
              Hear2Learn detected slight struggles in the following topic concepts:
            </p>
            <div className="flex flex-wrap gap-2">
              {weakAreas.map((item, idx) => (
                <span key={idx} className="px-3 py-1.5 bg-white border border-slate-100 text-xs text-green-600 font-bold rounded-lg shadow-2xs">
                  ⚠️ {item}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onRestartQuiz}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm shadow-sm hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            aria-label="Restart Chapter quiz evaluation immediately or say restart"
          >
            <RotateCcw className="h-4 w-4" /> Retake Chapter Evaluation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 max-w-3xl mx-auto shadow-xl shadow-slate-100 text-slate-800">
      
      {/* Header index */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <span className="text-xs text-green-600 font-bold uppercase tracking-wider">Question {currentIndex + 1} of {questions.length}</span>
          <h2 className="text-sm font-bold text-slate-400 truncate max-w-[200px] sm:max-w-md mt-0.5">{chapterTitle}</h2>
        </div>
        <button
          onClick={readActiveQuestion}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-50 hover:bg-green-50 border border-slate-150 rounded-xl text-slate-600 hover:text-green-650 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-green-400 cursor-pointer"
          aria-label="Re-read active quiz question and choices aloud"
        >
          <Volume2 className="h-4 w-4" /> Re-read Aloud
        </button>
      </div>

      {/* Voice commands accessibility banner */}
      {!isAnswered && (
        <div className="text-xs text-slate-600 font-bold mb-6 bg-green-50/50 border border-green-100 p-4 rounded-2xl flex items-start gap-2.5">
          <span className="text-base">🗣️</span>
          <div>
            <p className="text-green-800 font-semibold text-sm">Voice Navigation Active</p>
            <p className="text-green-600 text-xs font-medium mt-0.5">Simply say "Option A", "Option B", "Option C", or "Option D" to choose. Confirm by voice with "Yes", or say "No" to change.</p>
          </div>
        </div>
      )}

      {/* Present active statement */}
      <h3 className="text-xl md:text-2xl font-bold font-display leading-snug text-slate-800 mb-8" id={`q-title-${currentIndex}`}>
        {activeQuestion.question}
      </h3>

      {/* Option Selection Confirmation Panel */}
      {selectedOption !== null && !isAnswered && (
        <div className="bg-slate-50 border border-green-200 rounded-2xl p-5 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-0.5">
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider rounded">Confirm Your Choice</span>
            <p className="text-base font-bold text-slate-800">
              Selected Option <span className="text-green-600 font-extrabold">{optionLetters[activeQuestion.options.indexOf(selectedOption)]}</span>: "{selectedOption}"
            </p>
            <p className="text-slate-400 text-xs">Say <span className="font-bold text-slate-600">"Yes"</span> to submit, or say <span className="font-bold text-slate-600">"No"</span> to cancel.</p>
          </div>
          <div className="flex gap-2.5 w-full md:w-auto">
            <button
              onClick={confirmSelectedAnswer}
              className="flex-1 md:flex-none px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-xs hover:shadow-xs active:scale-95 transition-transform cursor-pointer"
              aria-label="Confirm selected answer option"
            >
              Verify [Yes]
            </button>
            <button
              onClick={() => {
                setSelectedOption(null);
                SpeechService.speak("Option canceled. Please say your answer option: A, B, C, or D.", language);
              }}
              className="flex-1 md:flex-none px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-600 font-bold border border-slate-200 rounded-xl text-xs active:scale-95 transition-transform cursor-pointer"
              aria-label="Cancel active option selection"
            >
              Cancel [No]
            </button>
          </div>
        </div>
      )}

      {/* Core Option Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8" role="radiogroup" aria-labelledby={`q-title-${currentIndex}`}>
        {activeQuestion.options.map((opt, optIdx) => {
          const isSelected = selectedOption === opt;
          const isCorrectAnswer = opt === activeQuestion.answer;
          
          let buttonStyle = 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-350';
          let icon = null;

          if (isAnswered) {
            if (isCorrectAnswer) {
              buttonStyle = 'bg-green-50 border-green-500 text-slate-800 font-bold border-2';
              icon = <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 animate-pulse" />;
            } else if (isSelected) {
              buttonStyle = 'bg-rose-50 border-rose-500 text-slate-800 font-bold border-2';
              icon = <XCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />;
            } else {
              buttonStyle = 'bg-slate-50 border-slate-100 text-slate-300 opacity-40';
            }
          } else if (isSelected) {
            buttonStyle = 'bg-green-50/50 border-green-500 text-slate-800 font-bold border-2 shadow-xs';
          }

          const optionLetter = optionLetters[optIdx];

          return (
            <button
              key={optIdx}
              onClick={() => handleSelectOption(opt)}
              disabled={isAnswered}
              className={`min-h-[76px] text-left p-5 rounded-2xl border transition-all flex items-center justify-between gap-4 font-sans text-base focus:outline-none focus:ring-4 focus:ring-green-100 cursor-pointer ${buttonStyle}`}
              aria-label={`Option ${optionLetter}: ${opt}`}
              aria-checked={isSelected}
              role="radio"
              id={`opt-${currentIndex}-${optIdx}`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-[11px] h-6 w-6 rounded-lg flex items-center justify-center font-bold flex-shrink-0 border ${
                  isAnswered && isCorrectAnswer 
                    ? 'border-green-600 bg-green-500 text-white' 
                    : isAnswered && isSelected 
                    ? 'border-rose-600 bg-rose-500 text-white'
                    : isSelected 
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}>
                  {optionLetter}
                </span>
                <span className="font-semibold leading-tight">{opt}</span>
              </div>
              {icon}
            </button>
          );
        })}
      </div>

      {/* Feedback explanation card */}
      {isAnswered && (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-8 animate-fade-in" aria-live="assertive">
          <p className="text-[10px] uppercase tracking-wider font-bold text-green-600 mb-2 flex items-center gap-1.5">
            <MessageSquareCode className="h-4 w-4" /> Voice Explanation & Context
          </p>
          <p className="text-sm text-slate-600 leading-relaxed font-sans font-medium">
            {activeQuestion.explanation}
          </p>
        </div>
      )}

      {/* Forward action */}
      {isAnswered && (
        <div className="flex justify-end">
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm shadow-sm hover:translate-x-0.5 active:translate-x-0 transition-all cursor-pointer"
            aria-label={currentIndex + 1 < questions.length ? "Proceed to subsequent quiz card question" : "Proceed to generate final score evaluation card"}
          >
            {currentIndex + 1 < questions.length ? "Next Question" : "View Final Report"}{' '}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

    </div>
  );
}
