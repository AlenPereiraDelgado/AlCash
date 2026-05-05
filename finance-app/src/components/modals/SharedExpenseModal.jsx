import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Minus, Check, Users, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import AppSelect from '../common/AppSelect';
import AddTabBar from '../common/AddTabBar';

const MULTIPLIERS = [
    { value: 0.5, label: 'x0.5' },
    { value: 1,   label: 'x1'   },
    { value: 1.5, label: 'x1.5' },
    { value: 2,   label: 'x2'   },
    { value: 3,   label: 'x3'   },
];

const buildParticipants = (count, names, includeMe) => {
    const list = [];
    if (includeMe) list.push({ id: 'me', name: 'Yo', mult: 1, custom: null, paid: true, isMe: true });
    for (let i = 0; i < count; i++) {
        list.push({
            id: `p${i}`,
            name: names[i] || `Persona ${i + 1}`,
            mult: 1,
            custom: null,
            paid: false,
            isMe: false,
        });
    }
    return list;
};

const SharedExpenseModal = ({ isOpen, onClose, onSwitchTab }) => {
    const { theme, t, activeColor } = useAuth();
    const { categories, addTransaction } = useFinance();

    const [total, setTotal] = useState('');
    const [category, setCategory] = useState('');
    const [subCategory, setSubCategory] = useState('');
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [count, setCount] = useState(2);
    const [names, setNames] = useState([]);
    const [includeMe, setIncludeMe] = useState(true);
    const [participants, setParticipants] = useState([]);
    const [customMode, setCustomMode] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setParticipants(buildParticipants(count, names, includeMe));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [count, includeMe, isOpen]);

    useEffect(() => {
        setParticipants(prev => prev.map(p => {
            if (p.isMe) return p;
            const idx = parseInt(p.id.slice(1), 10);
            return { ...p, name: names[idx] || `Persona ${idx + 1}` };
        }));
    }, [names]);

    if (!isOpen) return null;

    const totalNum = parseFloat(total) || 0;

    const computedShares = useMemo(() => {
        if (!totalNum || participants.length === 0) return participants.map(p => ({ ...p, share: 0 }));
        if (customMode) {
            const fixed = participants.filter(p => p.custom !== null && p.custom !== '');
            const fixedSum = fixed.reduce((a, p) => a + (parseFloat(p.custom) || 0), 0);
            const remaining = Math.max(0, totalNum - fixedSum);
            const flexMultSum = participants
                .filter(p => p.custom === null || p.custom === '')
                .reduce((a, p) => a + p.mult, 0);
            return participants.map(p => {
                if (p.custom !== null && p.custom !== '') return { ...p, share: parseFloat(p.custom) || 0 };
                if (flexMultSum === 0) return { ...p, share: 0 };
                return { ...p, share: (remaining * p.mult) / flexMultSum };
            });
        }
        const multSum = participants.reduce((a, p) => a + p.mult, 0);
        if (multSum === 0) return participants.map(p => ({ ...p, share: 0 }));
        return participants.map(p => ({ ...p, share: (totalNum * p.mult) / multSum }));
    }, [participants, totalNum, customMode]);

    const totalAssigned = computedShares.reduce((a, p) => a + p.share, 0);
    const drift = totalNum - totalAssigned;

    const setName = (i, value) => {
        const next = [...names];
        next[i] = value;
        setNames(next);
    };

    const setMult = (id, mult) => setParticipants(prev => prev.map(p => p.id === id ? { ...p, mult } : p));
    const setCustom = (id, custom) => setParticipants(prev => prev.map(p => p.id === id ? { ...p, custom } : p));
    const togglePaid = (id) => setParticipants(prev => prev.map(p => p.id === id ? { ...p, paid: !p.paid } : p));

    const allPaid = computedShares.every(p => p.paid);
    const myShare = computedShares.find(p => p.isMe)?.share || 0;

    const handleSave = async () => {
        if (!totalNum || !category) return;
        const shareList = computedShares.map(p => ({
            name: p.name,
            share: Number(p.share.toFixed(2)),
            paid: p.paid,
            isMe: p.isMe,
        }));
        const meta = {
            kind: 'shared',
            total: totalNum,
            participants: shareList,
            allPaid,
            createdAt: new Date().toISOString(),
        };
        const encoded = `__shared:${btoa(unescape(encodeURIComponent(JSON.stringify(meta))))}__`;
        const txAmount = includeMe ? myShare : totalNum;
        await addTransaction({
            amountVal: txAmount,
            originalAmount: txAmount,
            originalCurrency: 'EUR',
            type: 'expense',
            category,
            subCategory,
            date,
            note: note || `Compartido (${shareList.length}p)`,
            tags: ['Compartido', encoded],
            periodicity: 'puntual',
            is_joint: false,
        });
        setTotal(''); setNote(''); setCategory(''); setSubCategory('');
        setCount(2); setNames([]); setIncludeMe(true); setCustomMode(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className={`w-full max-w-2xl rounded-t-[32px] md:rounded-[40px] shadow-2xl overflow-hidden border animate-in slide-in-from-bottom-6 duration-300 md:zoom-in-95 ${t.card}`}
                onClick={e => e.stopPropagation()}
            >
                <div className={`p-5 border-b flex justify-between items-start gap-4 ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                    <div className="flex-1">
                        <h2 className="text-lg font-black flex items-center gap-2"><Users size={18} className={activeColor.text} /> Gasto compartido</h2>
                        <p className={`text-[11px] font-bold mt-0.5 ${t.textSec}`}>Reparte un gasto entre varias personas.</p>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-xl ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><X size={18} /></button>
                </div>

                <div className="px-5 pt-4">
                    <AddTabBar active="shared" onChange={onSwitchTab} />
                </div>

                <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
                    {/* TOTAL */}
                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${t.textSec}`}>Total</p>
                            <input type="number" step="0.01" placeholder="0.00" value={total} onChange={e => setTotal(e.target.value)} className="bg-transparent w-full text-3xl font-black outline-none border-b border-gray-500/30 pb-1" />
                        </div>
                        <span className={`pb-1 font-black text-lg ${t.textSec}`}>€</span>
                    </div>

                    {/* CATEGORÍA */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <AppSelect value={category} onChange={e => { setCategory(e.target.value); setSubCategory(''); }} className="p-3 rounded-xl font-bold text-sm">
                            <option value="">Categoría…</option>
                            {Object.keys(categories.expense || {}).map(c => <option key={c} value={c}>{c}</option>)}
                        </AppSelect>
                        <AppSelect value={subCategory} onChange={e => setSubCategory(e.target.value)} className="p-3 rounded-xl font-bold text-sm">
                            <option value="">Subcategoría…</option>
                            {(categories.expense?.[category] || []).map(s => <option key={s} value={s}>{s}</option>)}
                        </AppSelect>
                    </div>

                    {/* FECHA + NOTA */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`p-3 rounded-xl font-bold text-sm ${t.input}`} />
                        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Concepto" className={`p-3 rounded-xl font-bold text-sm ${t.input}`} />
                    </div>

                    {/* PERSONAS */}
                    <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <p className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>Personas</p>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setCount(c => Math.max(1, c - 1))} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-white hover:bg-gray-100 border border-gray-200'}`}><Minus size={14} /></button>
                                <span className="font-black text-base w-6 text-center">{count}</span>
                                <button onClick={() => setCount(c => Math.min(20, c + 1))} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-white hover:bg-gray-100 border border-gray-200'}`}><Plus size={14} /></button>
                            </div>
                        </div>

                        <button onClick={() => setIncludeMe(v => !v)} className={`flex items-center gap-2 mb-3 text-xs font-black ${includeMe ? activeColor.text : t.textSec}`}>
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center border-2 ${includeMe ? `${activeColor.bg} border-transparent` : 'border-gray-500/40'}`}>
                                {includeMe && <Check size={13} className="text-white" />}
                            </span>
                            Yo participo en el gasto
                        </button>

                        <div className="space-y-2">
                            {Array.from({ length: count }).map((_, i) => (
                                <input
                                    key={i}
                                    value={names[i] || ''}
                                    onChange={e => setName(i, e.target.value)}
                                    placeholder={`Persona ${i + 1}`}
                                    className={`w-full p-2.5 rounded-xl text-xs font-bold ${t.input}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* DISTRIBUCIÓN */}
                    <div className="flex items-center justify-between">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>Distribución</p>
                        <button
                            onClick={() => setCustomMode(v => !v)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                customMode ? `${activeColor.bg} text-white` : (theme === 'dark' ? 'bg-white/5 text-white/70' : 'bg-gray-100 text-gray-600')
                            }`}
                        >
                            {customMode ? 'Personalizada' : 'Equitativa'}
                        </button>
                    </div>

                    <div className="space-y-2">
                        {computedShares.map(p => (
                            <div key={p.id} className={`p-3 rounded-2xl border flex items-center gap-2 ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-white'}`}>
                                <button onClick={() => togglePaid(p.id)} className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${p.paid ? `${activeColor.bg}` : (theme === 'dark' ? 'bg-white/5' : 'bg-gray-100')}`}>
                                    {p.paid && <Check size={14} className="text-white" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-xs truncate">{p.name}{p.isMe && <span className={`ml-1.5 text-[9px] ${activeColor.text}`}>· tú</span>}</p>
                                    <p className={`text-[10px] font-bold ${t.textSec}`}>{p.share.toFixed(2)} €</p>
                                </div>
                                {customMode ? (
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="auto"
                                        value={p.custom ?? ''}
                                        onChange={e => setCustom(p.id, e.target.value === '' ? null : e.target.value)}
                                        className={`w-20 p-2 rounded-lg text-xs font-black text-right ${t.input}`}
                                    />
                                ) : (
                                    <AppSelect value={p.mult} onChange={e => setMult(p.id, parseFloat(e.target.value))} className="p-2 rounded-lg text-[10px] font-black" wrapperClass="w-20">
                                        {MULTIPLIERS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </AppSelect>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* RESUMEN */}
                    <div className={`p-3 rounded-2xl border flex items-center justify-between ${Math.abs(drift) > 0.01 ? 'border-yellow-500/40 bg-yellow-500/5' : (theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50')}`}>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>Repartido</span>
                        <span className={`font-black text-sm ${Math.abs(drift) > 0.01 ? 'text-yellow-500' : ''}`}>{totalAssigned.toFixed(2)} / {totalNum.toFixed(2)} €</span>
                    </div>

                    <button onClick={handleSave} disabled={!totalNum || !category} className={`w-full py-4 ${activeColor.bg} text-white rounded-xl font-black text-base disabled:opacity-40 ${activeColor.hover} shadow-lg active:scale-95 transition-all`}>
                        Guardar gasto compartido
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SharedExpenseModal;
