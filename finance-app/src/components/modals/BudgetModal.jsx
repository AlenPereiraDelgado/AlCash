import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { X, Trash2, Plus } from 'lucide-react';

const BudgetModal = ({ isOpen, onClose }) => {
    const { theme, t, activeColor } = useAuth();
    const { categories, budgets, setBudgets, transactions } = useFinance();
    const [newLabel, setNewLabel] = useState('');
    const [newLimit, setNewLimit] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    const suggestions = useMemo(() => {
        const cats = Object.keys(categories.expense || {});
        const subs = Object.values(categories.expense || {}).flat();
        return [...new Set([...cats, ...subs])].filter(s => s && !budgets[s]);
    }, [categories, budgets]);

    const filtered = suggestions.filter(s => newLabel && s.toLowerCase().includes(newLabel.toLowerCase()));

    const spendingByLabel = useMemo(() => {
        const now = new Date();
        const currentMonth = now.toISOString().slice(0, 7);
        const map = {};
        (transactions || []).forEach(tx => {
            if (tx.type === 'expense' && tx.date?.startsWith(currentMonth)) {
                [tx.category, tx.subCategory].forEach(k => {
                    if (k) map[k] = (map[k] || 0) + tx.amountVal;
                });
            }
        });
        return map;
    }, [transactions]);

    if (!isOpen) return null;

    const addEntry = () => {
        const label = newLabel.trim();
        if (!label || !newLimit) return;
        setBudgets({ ...budgets, [label]: parseFloat(newLimit) });
        setNewLabel(''); setNewLimit(''); setShowSuggestions(false);
    };

    const removeEntry = (key) => {
        const next = { ...budgets };
        delete next[key];
        setBudgets(next);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className={`w-full max-w-lg rounded-t-[32px] md:rounded-[40px] shadow-2xl overflow-hidden border animate-in slide-in-from-bottom-6 duration-300 md:zoom-in-95 ${t.card} ${t.bg}`} onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black">Presupuestos</h2>
                        <p className={`text-xs font-bold mt-0.5 ${t.textSec}`}>Límites mensuales por categoría, subcategoría o concepto.</p>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-xl ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><X size={20} /></button>
                </div>

                {/* AÑADIR NUEVO */}
                <div className={`px-6 pt-4 pb-2 border-b ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                    <div className="flex gap-2 items-center relative">
                        <div className="relative flex-1">
                            <input
                                value={newLabel}
                                onChange={e => { setNewLabel(e.target.value); setShowSuggestions(true); }}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                placeholder="Categoría, subcategoría o nombre…"
                                className={`w-full p-3 rounded-xl text-sm font-bold ${t.input}`}
                            />
                            {showSuggestions && filtered.length > 0 && (
                                <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-2xl overflow-hidden z-10 ${t.card} ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                                    {filtered.slice(0, 6).map(s => (
                                        <button key={s} type="button" onMouseDown={() => { setNewLabel(s); setShowSuggestions(false); }} className={`w-full text-left px-4 py-2 text-sm font-bold transition-all ${t.hover}`}>{s}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="relative w-24">
                            <input type="number" step="0.01" placeholder="Límite" value={newLimit} onChange={e => setNewLimit(e.target.value)} className={`w-full p-3 pr-6 rounded-xl text-sm font-bold text-right ${t.input}`} />
                            <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-30`}>€</span>
                        </div>
                        <button onClick={addEntry} disabled={!newLabel.trim() || !newLimit} className={`p-3 rounded-xl ${activeColor.bg} text-white disabled:opacity-40 transition-all active:scale-95`}>
                            <Plus size={18} />
                        </button>
                    </div>
                </div>

                {/* LISTA */}
                <div className="p-6 space-y-3 overflow-y-auto max-h-[50vh]">
                    {Object.keys(budgets).length === 0 && (
                        <p className={`text-center py-8 text-sm font-bold opacity-30 ${t.textSec}`}>Sin presupuestos configurados.</p>
                    )}
                    {Object.entries(budgets).map(([key, limit]) => {
                        const spent = spendingByLabel[key] || 0;
                        const pct = limit > 0 ? (spent / limit) * 100 : 0;
                        return (
                            <div key={key} className={`group p-4 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-white/[0.03] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-sm">{key}</span>
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <input type="number" value={limit || ''} onChange={e => setBudgets({ ...budgets, [key]: e.target.value ? parseFloat(e.target.value) : 0 })} className={`w-24 p-2 pr-5 rounded-xl text-right font-black text-sm outline-none ${t.input}`} />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-30">€</span>
                                        </div>
                                        <button onClick={() => removeEntry(key)} className="p-1.5 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 rounded-lg"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">
                                    <span>{spent.toFixed(0)}€ gastado</span>
                                    {limit > 0 && <span className={pct > 100 ? 'text-red-400 opacity-100' : ''}>{pct.toFixed(0)}%</span>}
                                </div>
                                <div className={`w-full h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-200'}`}>
                                    <div className={`h-full transition-all duration-700 ${pct > 100 ? 'bg-red-500' : pct > 85 ? 'bg-orange-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className={`px-6 pb-6 border-t border-white/5 pt-4`}>
                    <button onClick={onClose} className={`w-full py-3 rounded-2xl font-black text-sm ${activeColor.bg} text-white shadow-xl active:scale-95 transition-all`}>Listo</button>
                </div>
            </div>
        </div>
    );
};

export default BudgetModal;
