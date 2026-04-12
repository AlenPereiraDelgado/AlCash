import React, { useState } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const MagicInput = ({ onParse, isLoading }) => {
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
        <div className={`w-full p-2 rounded-[32px] border shadow-lg transition-all ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-white border-gray-100'} focus-within:ring-2 focus-within:ring-blue-500/20`}>
            <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-2">
                <div className={`p-2 rounded-2xl ${activeColor.bg} text-white shadow-lg shrink-0`}>
                    <Sparkles size={18} />
                </div>
                <input 
                    type="text" 
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Describe tu gasto... (ej: '30€ en gasolina hoy')"
                    className="flex-1 bg-transparent border-none outline-none font-bold text-sm"
                />
                <button 
                    disabled={!text.trim() || isLoading}
                    className={`p-3 rounded-2xl transition-all ${text.trim() ? activeColor.bg + ' text-white shadow-md' : 'opacity-20 cursor-not-allowed'} active:scale-90`}
                >
                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                </button>
            </form>
        </div>
    );
};

export default MagicInput;
