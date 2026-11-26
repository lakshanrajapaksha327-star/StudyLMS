import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, Timer, CheckCircle2 } from 'lucide-react';
import { createStudySessionApi } from '../services/api';
import { StudySessionItem } from '../types';

interface StudyTimerWidgetProps {
  activeNotebookId?: string;
  activeNotebookTitle?: string;
  isAuthenticated: boolean;
  onSessionSaved?: (session: StudySessionItem) => void;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const StudyTimerWidget: React.FC<StudyTimerWidgetProps> = ({
  activeNotebookId,
  activeNotebookTitle,
  isAuthenticated,
  onSessionSaved,
  onToast,
}) => {
  const [status, setStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [subject, setSubject] = useState<string>(activeNotebookTitle || 'General Study');
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [pausedSeconds, setPausedSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'idle' && activeNotebookTitle) {
      setSubject(activeNotebookTitle);
    }
  }, [activeNotebookTitle, status]);

  useEffect(() => {
    if (status === 'idle') return;
    const timer = setInterval(() => {
      if (status === 'running') {
        setActiveSeconds((s) => s + 1);
      } else if (status === 'paused') {
        setPausedSeconds((p) => p + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDropdown(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const formatDuration = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const rem = secs % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const handleStart = () => {
    if (!isAuthenticated) {
      onToast?.('Sign in to track and persist study sessions.', 'info');
      return;
    }
    if (status === 'idle') {
      setStartedAt(new Date().toISOString());
      setActiveSeconds(0);
      setPausedSeconds(0);
    }
    setStatus('running');
  };

  const handlePause = () => {
    if (status === 'running') setStatus('paused');
  };

  const handleStopAndSave = async () => {
    const finalActive = activeSeconds;
    const finalPaused = pausedSeconds;
    const startIso = startedAt || new Date().toISOString();
    const endIso = new Date().toISOString();

    if (finalActive < 1) {
      setStatus('idle');
      setActiveSeconds(0);
      setPausedSeconds(0);
      setStartedAt(null);
      return;
    }

    if (!isAuthenticated) {
      onToast?.('Sign in to save study sessions to analytics.', 'info');
      setStatus('idle');
      setActiveSeconds(0);
      setPausedSeconds(0);
      return;
    }

    setSaving(true);
    try {
      const saved = await createStudySessionApi({
        notebookId: activeNotebookId,
        subject: subject.trim() || activeNotebookTitle || 'General Study',
        activityType: 'general',
        startedAt: startIso,
        endedAt: endIso,
        activeDurationSeconds: finalActive,
        pausedSeconds: finalPaused,
      });
      onSessionSaved?.(saved);
      onToast?.(
        `Saved ${Math.max(1, Math.round(finalActive / 60))}m active study session for ${saved.subject}.`,
        'success'
      );
      setStatus('idle');
      setActiveSeconds(0);
      setPausedSeconds(0);
      setStartedAt(null);
      setShowDropdown(false);
    } catch (err: any) {
      onToast?.(err?.message || 'Failed to save study session.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setShowDropdown((v) => !v)}
          aria-expanded={showDropdown}
          aria-label="Study session timer details"
          className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
        >
          <Timer
            className={`w-3.5 h-3.5 ${
              status === 'running'
                ? 'text-emerald-500 animate-pulse'
                : status === 'paused'
                ? 'text-amber-500'
                : 'text-slate-400'
            }`}
          />
          <span>{formatDuration(activeSeconds)}</span>
        </button>

        {status === 'idle' && (
          <button
            type="button"
            onClick={handleStart}
            aria-label="Start study timer"
            title="Start study timer"
            className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            <Play className="w-3 h-3 fill-current" />
          </button>
        )}

        {status === 'running' && (
          <>
            <button
              type="button"
              onClick={handlePause}
              aria-label="Pause study timer"
              title="Pause"
              className="p-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
            >
              <Pause className="w-3 h-3 fill-current" />
            </button>
            <button
              type="button"
              onClick={handleStopAndSave}
              disabled={saving}
              aria-label="Stop and save study session"
              title="Stop & Save Session"
              className="p-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
          </>
        )}

        {status === 'paused' && (
          <>
            <button
              type="button"
              onClick={handleStart}
              aria-label="Resume study timer"
              title="Resume"
              className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              <Play className="w-3 h-3 fill-current" />
            </button>
            <button
              type="button"
              onClick={handleStopAndSave}
              disabled={saving}
              aria-label="Stop and save study session"
              title="Stop & Save Session"
              className="p-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
          </>
        )}
      </div>

      {showDropdown && (
        <div
          role="dialog"
          aria-label="Study session tracker settings"
          className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Study Session Tracker
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                status === 'running'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : status === 'paused'
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {status === 'running' ? 'Active' : status === 'paused' ? 'Paused' : 'Ready'}
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Subject / Focus Label
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Organic Chemistry"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl">
            <div>
              <span className="text-slate-400 block">Active Time</span>
              <strong className="font-mono text-slate-900 dark:text-slate-100">
                {formatDuration(activeSeconds)}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block">Paused (Excluded)</span>
              <strong className="font-mono text-slate-500 dark:text-slate-300">
                {formatDuration(pausedSeconds)}
              </strong>
            </div>
          </div>

          {status !== 'idle' && (
            <button
              type="button"
              onClick={handleStopAndSave}
              disabled={saving || activeSeconds < 1}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving Session...' : 'Save Study Session'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
