import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Minus, Check, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import AppSelect from '../common/AppSelect';
import AddTabBar from '../common/AddTabBar';

const MULT_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

const formatMult = (v) => {
    const n = Number(v) || 0;
    if (Number.isInteger(n)) return `x${n}`;
    return `x${n.toFixed(2).replace(/\.?0+$/, '')}`;
};

const formatEur = (v) => {
    const n = Number(v) || 0;
    if (Number.isInteger(n)) return `${n}€`;
    return `${n.toFixed(2).replace(/\.?0+$/, '')}€`;
};

const WheelMultPicker = ({ mult, custom, customAmount, onPickMult, onPickCustom, theme, t, activeColor }) => {
    const [open, setOpen] = useState(false);
    const [customOpen, setCustomOpen] = useState(false);
    const [customVal, setCustomVal] = useState(String(custom ? customAmount : ''));
    const ref = useRef(null);
    const listRef = useRef(null);
    const ITEM_H = 36;

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (!ref.current?.contains(e.target)) { setOpen(false); setCustomOpen(false); } };
        const id = setTimeout(() => document.addEventListener('mousedown', handler), 100);
        return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
    }, [open]);

    useEffect(() => {
        if (!open || customOpen || custom || !listRef.current) return;
        const idx = MULT_OPTIONS.findIndex(v => Math.abs(v - mult) < 0.0001);
        if (idx >= 0) listRef.current.scrollTop = idx * ITEM_H;
    }, [open, mult, customOpen, custom]);

    const pickMult = (v) => { onPickMult(v); setOpen(false); setCustomOpen(false); };
    const onScrollEnd = () => {
        if (!listRef.current || custom) return;
        const idx = Math.round(listRef.current.scrollTop / ITEM_H);
        const v = MULT_OPTIONS[Math.max(0, Math.min(MULT_OPTIONS.length - 1, idx))];
        if (v !== undefined && Math.abs(v - mult) > 0.0001) onPickMult(v);
    };

    return (
        <div ref={ref} className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`min-w-14 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${activeColor.bg} text-white`}
            >
                {custom ? formatEur(customAmount) : formatMult(mult)}
            </button>
            {open && (
                <div className={`absolute z-30 right-0 top-full mt-1 w-32 rounded-2xl border shadow-2xl overflow-hidden ${theme === 'dark' ? 'bg-[#0E0E11] border-white/10' : 'bg-white border-gray-200'}`}>
                    {!customOpen ? (
                        <>
                            <div className="relative" style={{ height: 144 }}>
                                <div
                                    ref={listRef}
                                    onScroll={() => { clearTimeout(listRef.current._t); listRef.current._t = setTimeout(onScrollEnd, 120); }}
                                    className="h-full overflow-y-scroll snap-y snap-mandatory"
                                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                >
                                    <style>{`.wheel-list::-webkit-scrollbar{display:none}`}</style>
                                    <div style={{ height: 54 }} />
                                    {MULT_OPTIONS.map(v => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => pickMult(v)}
                                            className={`w-full snap-center flex items-center justify-center font-black transition-all ${!custom && Math.abs(v - mult) < 0.0001 ? `${activeColor.text} text-base` : 'opacity-40 text-sm'}`}
                                            style={{ height: ITEM_H }}
                                        >
                                            {formatMult(v)}
                                        </button>
                                    ))}
                                    <div style={{ height: 54 }} />
                                </div>
                                <div className={`pointer-events-none absolute left-2 right-2 top-1/2 -translate-y-1/2 rounded-lg border-y ${theme === 'dark' ? 'border-white/15' : 'border-gray-300'}`} style={{ height: ITEM_H }} />
                                <div className={`pointer-events-none absolute inset-x-0 top-0 h-12 ${theme === 'dark' ? 'bg-gradient-to-b from-[#0E0E11]' : 'bg-gradient-to-b from-white'} to-transparent`} />
                                <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-12 ${theme === 'dark' ? 'bg-gradient-to-t from-[#0E0E11]' : 'bg-gradient-to-t from-white'} to-transparent`} />
                            </div>
                            <button
                                type="button"
                                onClick={() => { setCustomVal(String(custom ? customAmount : '')); setCustomOpen(true); }}
                                className={`w-full py-2 text-[10px] font-black uppercase tracking-wider border-t ${theme === 'dark' ? 'border-white/10 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-50'}`}
                            >
                                Personalizado (€)
                            </button>
                        </>
                    ) : (
                        <div className="p-3 space-y-2">
                            <p className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>Importe fijo</p>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={customVal}
                                    onChange={e => setCustomVal(e.target.value)}
                                    autoFocus
                                    className={`w-full p-2 pr-7 rounded-lg text-center font-black ${t.input}`}
                                />
                                <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black ${t.textSec}`}>€</span>
                            </div>
                            <div className="flex gap-1.5">
                                <button type="button" onClick={() => setCustomOpen(false)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}>Atrás</button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const n = parseFloat(customVal);
                                        if (!Number.isNaN(n) && n >= 0) {
                                            onPickCustom(n);
                                            setOpen(false);
                                            setCustomOpen(false);
                                        }
                                    }}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase ${activeColor.bg} text-white`}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const buildParticipants = (count, names, includeMe) => {
    const list = [];
    if (includeMe) list.push({ id: 'me', name: 'Yo', mult: 1, custom: false, customAmount: 0, paid: true, paidAmount: 0, isMe: true });
    for (let i = 0; i < count; i++) {
        list.push({
            id: `p${i}`,
            name: names[i] || `Persona ${i + 1}`,
            mult: 1,
            custom: false,
            customAmount: 0,
            paid: false,
            paidAmount: 0,
            isMe: false,
        });
    }
    return list;
};

const SharedExpenseModal = ({ isOpen, onClose, onSwitchTab, prefill, onPrefillConsumed }) => {
    const { theme, t, activeColor } = useAuth();
    const { categories, addTransaction, deleteTransaction } = useFinance();

    const [total, setTotal] = useState('');
    const [category, setCategory] = useState('');
    const [subCategory, setSubCategory] = useState('');
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [count, setCount] = useState(2);
    const [names, setNames] = useState([]);
    const [includeMe, setIncludeMe] = useState(true);
    const [participants, setParticipants] = useState([]);
    const [replacingTxId, setReplacingTxId] = useState(null);

    // Hidratar desde prefill (al fraccionar un movimiento existente)
    useEffect(() => {
        if (!isOpen || !prefill) return;
        setTotal(String(prefill.total ?? ''));
        setCategory(prefill.category || '');
        setSubCategory(prefill.subCategory || '');
        setNote(prefill.note || '');
        setDate(prefill.date || new Date().toISOString().split('T')[0]);
        setReplacingTxId(prefill.originalTxId || null);
        onPrefillConsumed?.();
    }, [isOpen, prefill, onPrefillConsumed]);

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

    const totalNum = parseFloat(total) || 0;

    const computedShares = useMemo(() => {
        if (participants.length === 0) return [];
        const customSum = participants.reduce((a, p) => a + (p.custom ? (Number(p.customAmount) || 0) : 0), 0);
        const remaining = Math.max(0, totalNum - customSum);
        const multSum = participants.reduce((a, p) => a + (p.custom ? 0 : p.mult), 0);
        return participants.map(p => {
            if (p.custom) return { ...p, share: Number(p.customAmount) || 0 };
            if (multSum === 0) return { ...p, share: 0 };
            return { ...p, share: (remaining * p.mult) / multSum };
        });
    }, [participants, totalNum]);

    const totalAssigned = computedShares.reduce((a, p) => a + p.share, 0);
    const drift = totalNum - totalAssigned;

    if (!isOpen) return null;

    const setName = (i, value) => {
        const next = [...names];
        next[i] = value;
        setNames(next);
    };

    const setMult = (id, mult) => setParticipants(prev => prev.map(p => p.id === id ? { ...p, mult, custom: false, customAmount: 0 } : p));
    const setCustomAmount = (id, amount) => setParticipants(prev => prev.map(p => p.id === id ? { ...p, custom: true, customAmount: amount } : p));

    const allPaid = computedShares.every(p => p.paid);
    const myShare = computedShares.find(p => p.isMe)?.share || 0;

    const handleSave = async () => {
        if (!totalNum || !category) return;
        const shareList = computedShares.map(p => ({
            name: p.name,
            share: Number(p.share.toFixed(2)),
            paid: p.paid,
            paidAmount: p.isMe ? Number(p.share.toFixed(2)) : (p.paid ? Number(p.share.toFixed(2)) : 0),
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
        if (replacingTxId) {
            await deleteTransaction(replacingTxId, false);
        }
        setTotal(''); setNote(''); setCategory(''); setSubCategory('');
        setCount(2); setNames([]); setIncludeMe(true);
        setReplacingTxId(null);
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
                            Yo participo
                        </button>

                        <div className="space-y-1.5">
                            {computedShares.map(p => {
                                const personaIdx = !p.isMe ? parseInt(p.id.slice(1), 10) : -1;
                                return (
                                    <div key={p.id} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-white'}`}>
                                        {p.isMe ? (
                                            <div className={`flex-1 min-w-0 px-1.5 py-1 text-[11px] font-black ${activeColor.text}`}>Yo · tú</div>
                                        ) : (
                                            <input
                                                value={names[personaIdx] || ''}
                                                onChange={e => setName(personaIdx, e.target.value)}
                                                placeholder={`Persona ${personaIdx + 1}`}
                                                className={`flex-1 min-w-0 px-2 py-1 rounded-md text-[11px] font-bold ${t.input}`}
                                            />
                                        )}
                                        <span className="shrink-0 text-right text-[11px] font-black tabular-nums opacity-70 px-1">{p.share.toFixed(2)}€</span>
                                        <WheelMultPicker
                                            mult={p.mult}
                                            custom={p.custom}
                                            customAmount={p.customAmount}
                                            onPickMult={(v) => setMult(p.id, v)}
                                            onPickCustom={(v) => setCustomAmount(p.id, v)}
                                            theme={theme}
                                            t={t}
                                            activeColor={activeColor}
                                        />
                                    </div>
                                );
                            })}
                        </div>
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
