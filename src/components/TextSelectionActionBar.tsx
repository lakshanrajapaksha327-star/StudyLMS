import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, HelpCircle, RefreshCw, Languages, X, Check, Copy } from 'lucide-react';
import { transformSelectedText } from '../services/api';

interface TextSelectionActionBarProps {
  onInsertTransformedText?: (text: string) => void;
}

export const TextSelectionActionBar: React.FC<TextSelectionActionBarProps> = ({
  onInsertTransformedText,
}) => {
  const [selectedText, setSelectedText] = useState('');
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        if (!resultText && !loading) {
          setPosition(null);
          setSelectedText('');
        }
        return;
      }

      const text = selection.toString().trim();
      if (text.length < 5) return; // Only trigger for meaningful selections

      setSelectedText(text);

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Position above selected text
      setPosition({
        top: Math.max(10, rect.top + window.scrollY - 52),
        left: Math.max(10, rect.left + window.scrollX + rect.width / 2 - 140),
      });
    };

    document.addEventListener('mouseup', handleSelectionChange);
    return () => {
      document.removeEventListener('mouseup', handleSelectionChange);
    };
  }, [resultText, loading]);

  const handleTransform = async (
    action: 'explain' | 'rewrite' | 'translate',
    option: string = 'Standard'
  ) => {
    if (!selectedText) return;
    setLoading(true);
    setShowStyleMenu(false);
    setShowLangMenu(false);
    try {
      const res = await transformSelectedText(selectedText, action, option);
      setResultText(res.resultText);
    } catch (err) {
      setResultText('Failed to process selected text.');
    } finally {
      setLoading(false);
    }
  };

  const closeBar = () => {
    setPosition(null);
    setSelectedText('');
    setResultText(null);
  };

  if (!position) return null;

  return (
    <div
      ref={menuRef}
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      className="fixed z-50 bg-slate-900/95 text-white backdrop-blur-md border border-slate-700/80 shadow-2xl rounded-2xl p-1.5 flex flex-col gap-2 max-w-md transition-all animate-in fade-in zoom-in-95 duration-150"
    >
      {!resultText ? (
        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => handleTransform('explain')}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white flex items-center gap-1 transition-all shadow"
          >
            {loading ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <HelpCircle className="w-3.5 h-3.5" />}
            Explain
          </button>

          {/* Rewrite Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowStyleMenu(!showStyleMenu);
                setShowLangMenu(false);
              }}
              className="px-2.5 py-1.5 rounded-xl hover:bg-slate-800 font-semibold text-slate-200 flex items-center gap-1 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-purple-400" /> Rewrite
            </button>

            {showStyleMenu && (
              <div className="absolute top-full left-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl p-1.5 shadow-xl flex flex-col gap-1 w-36 z-50 text-[11px]">
                {['Shorter', 'Longer', 'Formal', 'Simple', 'Academic', 'Bullet points'].map((style) => (
                  <button
                    key={style}
                    onClick={() => handleTransform('rewrite', style)}
                    className="px-2 py-1 text-left rounded-lg hover:bg-indigo-600/30 text-slate-200 transition-colors"
                  >
                    {style}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Translate Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowLangMenu(!showLangMenu);
                setShowStyleMenu(false);
              }}
              className="px-2.5 py-1.5 rounded-xl hover:bg-slate-800 font-semibold text-slate-200 flex items-center gap-1 transition-all"
            >
              <Languages className="w-3.5 h-3.5 text-emerald-400" /> Translate
            </button>

            {showLangMenu && (
              <div className="absolute top-full left-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl p-1.5 shadow-xl flex flex-col gap-1 w-32 z-50 text-[11px]">
                {['Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Arabic'].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleTransform('translate', lang)}
                    className="px-2 py-1 text-left rounded-lg hover:bg-indigo-600/30 text-slate-200 transition-colors"
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={closeBar} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="p-2 space-y-2 max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between text-[11px] font-bold text-indigo-300 border-b border-slate-800 pb-1">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" /> AI Result
            </span>
            <button onClick={closeBar} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
            {resultText}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => navigator.clipboard.writeText(resultText)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
            {onInsertTransformedText && (
              <button
                onClick={() => {
                  onInsertTransformedText(resultText);
                  closeBar();
                }}
                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-[10px] text-white flex items-center gap-1 font-semibold"
              >
                <Check className="w-3 h-3" /> Insert into Notes
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
