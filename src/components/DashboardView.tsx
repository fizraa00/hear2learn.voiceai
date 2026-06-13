import React, { useState } from 'react';
import { Award, BookOpen, Clock, AlertTriangle, Play, Sparkles, Plus, GraduationCap } from 'lucide-react';
import { MasteryProgress, QuizRecord, LearnerLanguage } from '../types';

interface DashboardViewProps {
  progressList: MasteryProgress[];
  quizHistory: QuizRecord[];
  totalMinutes: number;
  onAddStudyMinutes: (minutes: number) => void;
  onRecommendRevision: (topic: string) => void;
  language: LearnerLanguage;
}

export default function DashboardView({
  progressList,
  quizHistory,
  totalMinutes,
  onAddStudyMinutes,
  onRecommendRevision,
  language,
}: DashboardViewProps) {
  const [sessionMinutes, setSessionMinutes] = useState('15');

  // Aggregated analytics
  const completedCount = progressList.filter(p => p.status === 'completed').length;
  
  // Extract mastered concepts flat list
  const masteredConceptsSet = new Set<string>();
  progressList.forEach(p => p.masteredConcepts.forEach(c => masteredConceptsSet.add(c)));
  const masteredConcepts = Array.from(masteredConceptsSet);

  // Extract unique weak topics
  const weakTopicsSet = new Set<string>();
  progressList.forEach(p => p.weakTopics.forEach(t => weakTopicsSet.add(t)));
  quizHistory.forEach(q => q.weakAreasDetected.forEach(ta => weakTopicsSet.add(ta)));
  const weakTopics = Array.from(weakTopicsSet);

  // Compute average quiz accuracy
  const totalCorrect = quizHistory.reduce((sum, r) => sum + r.score, 0);
  const totalQuestions = quizHistory.reduce((sum, r) => sum + r.totalQuestions, 0);
  const averageAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const handleSimulateMinutes = () => {
    const mins = parseInt(sessionMinutes, 10);
    if (!isNaN(mins) && mins > 0) {
      onAddStudyMinutes(mins);
      setSessionMinutes('');
    }
  };

  return (
    <div className="space-y-8 text-slate-800">
      
      {/* SECTION 1: Bento Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Metric 1: Total Study Time */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 flex items-center gap-4 shadow-sm shadow-slate-100 hover:shadow-md transition-all duration-300">
          <div className="p-3.5 bg-green-50 text-green-600 rounded-xl">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Study Time</p>
            <p className="text-2xl font-extrabold font-display text-slate-800 mt-0.5">
              {totalMinutes} <span className="text-xs font-bold text-slate-400">mins</span>
            </p>
          </div>
        </div>

        {/* Metric 2: Completion Rate */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 flex items-center gap-4 shadow-sm shadow-slate-100 hover:shadow-md transition-all duration-300">
          <div className="p-3.5 bg-green-50 text-green-600 rounded-xl">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chapters</p>
            <p className="text-2xl font-extrabold font-display text-slate-800 mt-0.5">
              {progressList.length} <span className="text-xs font-bold text-slate-400">active</span>
            </p>
          </div>
        </div>

        {/* Metric 3: Concepts Mastered */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 flex items-center gap-4 shadow-sm shadow-slate-100 hover:shadow-md transition-all duration-300">
          <div className="p-3.5 bg-green-50 text-green-600 rounded-xl">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mastery level</p>
            <p className="text-2xl font-extrabold font-display text-slate-800 mt-0.5">
              {masteredConcepts.length} <span className="text-xs font-bold text-slate-400">topics</span>
            </p>
          </div>
        </div>

        {/* Metric 4: Quiz Score Accuracy */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 flex items-center gap-4 shadow-sm shadow-slate-100 hover:shadow-md transition-all duration-300">
          <div className="p-3.5 bg-green-100 text-green-700 rounded-xl">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Accuracy</p>
            <p className="text-2xl font-extrabold font-display text-green-600 mt-0.5">
              {averageAccuracy}%
            </p>
          </div>
        </div>

      </div>

      {/* SECTION 2: Visual Chart & Simulate controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Weekly Progress Graph */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-sm shadow-slate-100">
          <div>
            <h3 className="text-lg md:text-xl font-bold font-display text-slate-800 mb-1">
              Learning Activity Over Time
            </h3>
            <p className="text-xs font-medium text-slate-400 mb-6">Assesses retention spikes based on speech drills and user engagement</p>
          </div>

          {/* Clean High-Contrast Column Chart */}
          <div className="h-52 w-full flex items-end justify-between px-4 pb-2 border-b border-slate-100">
            {[
              { day: 'Mon', score: 20 },
              { day: 'Tue', score: 35 },
              { day: 'Wed', score: totalMinutes > 15 ? 50 : 25 },
              { day: 'Thu', score: 40 },
              { day: 'Fri', score: totalMinutes },
              { day: 'Sat', score: 10 },
              { day: 'Sun', score: 0 }
            ].map((pt, i) => (
              <div key={i} className="flex flex-col items-center gap-2 flex-grow">
                <span className="text-[10px] font-bold text-green-600 font-mono">{pt.score}m</span>
                <div 
                  className="w-8 md:w-10 bg-green-500 rounded-t-lg hover:bg-green-400 hover:scale-105 transition-all duration-300"
                  style={{ height: `${Math.max(pt.score * 1.6, 8)}px` }}
                />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{pt.day}</span>
              </div>
            ))}
          </div>

          {/* Time simulation log */}
          <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <div>
              <p className="font-bold text-slate-800 text-sm">Organize Self-Study Minutes</p>
              <p className="text-xs text-slate-400">Log study hours completed outside the application</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <input
                type="number"
                min="1"
                placeholder="Mins"
                value={sessionMinutes}
                onChange={(e) => setSessionMinutes(e.target.value)}
                className="w-20 px-3 py-2 bg-white border border-slate-200 text-slate-800 font-bold rounded-xl focus:border-green-400 focus:outline-none text-sm"
              />
              <button
                onClick={handleSimulateMinutes}
                className="flex-1 sm:flex-none px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-green-100 active:scale-95 transition-transform"
              >
                <Plus className="h-4 w-4" /> Add Time
              </button>
            </div>
          </div>
        </div>

        {/* Smart Revision Assistant Card */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-sm shadow-slate-100">
          <div>
            <h3 className="text-lg md:text-xl font-bold font-display text-slate-800 mb-1 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-green-500" />
              Smart Revision Guide
            </h3>
            <p className="text-xs font-medium text-slate-400 mb-6">
              Analyzes previous quiz outcomes to dynamically suggest focal focus concepts
            </p>

            {weakTopics.length > 0 ? (
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {weakTopics.map((topic, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-green-100 transition-colors">
                    <span className="font-bold text-slate-700 text-xs truncate">⚠️ {topic}</span>
                    <button
                      onClick={() => onRecommendRevision(topic)}
                      className="px-3 py-1.5 bg-white hover:bg-green-50 text-green-600 border border-slate-100 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer hover:border-green-200"
                    >
                      <Sparkles className="h-3 w-3 text-green-500" /> Revise
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 bg-slate-50 rounded-2xl text-center border border-dashed border-slate-200">
                <AlertTriangle className="h-8 w-8 text-green-500 mx-auto mb-2 animate-bounce" />
                <p className="font-bold text-slate-700 text-sm">Perfect Score!</p>
                <p className="text-xs text-slate-400 mt-0.5">No weak concepts flagged so far.</p>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-[10px] text-slate-400 leading-normal font-semibold">
              💡 Hear2Learn adjusts your quiz complexity and reads definitions twice for concepts identified on your Revision list.
            </p>
          </div>
        </div>

      </div>

      {/* SECTION 3: Conquered Mastery & Quiz history list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Quiz Historical Performance List */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-sm shadow-slate-100">
          <h3 className="text-lg md:text-xl font-bold font-display text-slate-800 mb-4">Quiz Session Logs</h3>
          <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
            {quizHistory.length > 0 ? (
              [...quizHistory].reverse().map((record, i) => {
                const passed = record.score >= (record.totalQuestions / 2);
                return (
                  <div key={record.id || i} className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between shadow-2xs hover:border-green-100 transition-all">
                    <div>
                      <p className="font-bold text-slate-700 text-sm line-clamp-1">{record.chapterTitle}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">
                        {record.createdAt.toLocaleDateString()} • Voice assessment
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-extrabold text-green-600">{record.score} / {record.totalQuestions}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-wider block ${passed ? 'text-green-600' : 'text-amber-600'}`}>
                        {passed ? "Completed" : "Review Needed"}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center font-bold">No quiz sessions logged yet.</p>
            )}
          </div>
        </div>

        {/* Mastered Concepts */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-sm shadow-slate-100">
          <h3 className="text-lg md:text-xl font-bold font-display text-slate-800 mb-4 font-black">Conquered Mastery Badge Set</h3>
          <div className="flex flex-wrap gap-2.5 max-h-[260px] overflow-y-auto pr-1">
            {masteredConcepts.length > 0 ? (
              masteredConcepts.map((concept, idx) => (
                <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 border border-green-100 rounded-xl font-bold text-xs hover:bg-green-100 transition-colors">
                  ⭐ {concept}
                </span>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-6 w-full text-center font-bold">Complete chapter assessments to unlock mastery achievements!</p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
