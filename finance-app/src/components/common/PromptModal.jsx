import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const PromptModal = ({ isOpen, title, label, placeholder = '', initialValue = '', confirmText = 'Guardar', onConfirm, onClose }) => {
    const { t, theme, activeColor } = useAuth();
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const submit = (e) => {
        e?.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) return;
        onConfirm(trimmed);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className={`w-full max-w-sm rounded-[28px] shadow-2xl overflow-hidden border animate-in zoom-in-95 fade-in duration-200 ${t.card}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-lg font-black">{title}</h2>
                    <button onClick={onClose} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><X size={18} /></button>
                </div>
                <form onSubmit={submit} className="p-6 space-y-4">
                    {label && <p className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>{label}</p>}
                    <input
                        ref={inputRef}
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder={placeholder}
                        className={`w-full p-3 rounded-xl text-sm font-bold ${t.input}`}
                    />
                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}>Cancelar</button>
                        <button type="submit" disabled={!value.trim()} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-white disabled:opacity-40 ${activeColor.bg} shadow-lg`}>{confirmText}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PromptModal;
