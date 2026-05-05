import React, { useState } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const MagicInput = ({ onParse, isLoading, trailing = null }) => {
    const [text, setText] = useState('');
    const { theme, t, activeColor } = useAuth();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (text.trim() && !isLoading) {
            onParse(text);
            setText('');
        }
    };

    return (
        <div className={`w-full p-1.5 sm:p-2 rounded-[28px] sm:rounded-[32px] border shadow-lg transition-all ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-white border-gray-100'} focus-within:ring-2 focus-within:ring-blue-500/20`}>
            <form onSubmit={handleSubmit} className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1">
                <div className={`p-1.5 sm:p-2 rounded-2xl ${activeColor.bg} text-white shadow-lg shrink-0`}>
                    <Sparkles size={16} className="sm:hidden" />
                    <Sparkles size={18} className="hidden sm:block" />
                </div>
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Describe tu gasto…"
                    className="flex-1 min-w-0 bg-transparent border-none outline-none font-bold text-sm"
                />
                {text.trim() && (
                    <button
                        disabled={isLoading}
                        className={`p-2 sm:p-2.5 rounded-2xl transition-all shrink-0 ${activeColor.bg} text-white shadow-md active:scale-90`}
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    </button>
                )}
                {trailing}
            </form>
        </div>
    );
};

export default MagicInput;
