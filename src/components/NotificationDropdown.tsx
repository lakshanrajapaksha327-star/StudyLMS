import React, { useState } from 'react';
import { Bell, Flame, Calendar, Layers, Sparkles, Check } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'reminder' | 'exam' | 'flashcard' | 'streak';
  read: boolean;
}

export const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'n1',
      title: 'Flashcards Due Today',
      message: '12 cards in "Computer Science" need review according to your SM-2 schedule.',
      time: '10m ago',
      type: 'flashcard',
      read: false,
    },
    {
      id: 'n2',
      title: 'Upcoming Midterm Exam',
      message: 'Calculus III Midterm scheduled in 3 days. Practice test recommended.',
      time: '1h ago',
      type: 'exam',
      read: false,
    },
    {
      id: 'n3',
      title: 'Study Streak Preserved!',
      message: 'You have maintained a 7-day study streak. Keep up active recall!',
      time: 'Today',
      type: 'streak',
      read: false,
    },
    {
      id: 'n4',
      title: 'AI Weak Spot Recommendation',
      message: 'Gemini detected lower score in Integration by Parts. AI review sheet created.',
      time: 'Yesterday',
      type: 'reminder',
      read: true,
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'flashcard':
        return <Layers className="w-4 h-4 text-amber-500" />;
      case 'exam':
        return <Calendar className="w-4 h-4 text-purple-500" />;
      case 'streak':
        return <Flame className="w-4 h-4 text-orange-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-indigo-500" /> Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-0.5"
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  setNotifications((prev) =>
                    prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
                  );
                }}
                className={`p-2.5 rounded-xl border transition-all text-xs cursor-pointer space-y-1 ${
                  n.read
                    ? 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/60 opacity-80'
                    : 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                    {getTypeIcon(n.type)}
                    <span>{n.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{n.time}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
