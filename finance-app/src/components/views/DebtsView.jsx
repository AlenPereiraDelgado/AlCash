import { useMemo, useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import {
    Plus, ArrowRight, CheckCircle2, XCircle, Trash2, Users, Hand, Calendar, Bell,
    Group, ChevronDown, ChevronUp, ArrowRightLeft, X, Share2, Check, Pencil
} from 'lucide-react';
import {
    extractSharedMeta,
    replaceSharedMetaInTags,
    collectSharedDebtors,
    paidAmountOf,
} from '../../utils/sharedExpense';
import { settleGroup } from '../../utils/settlement';

const REPAY_PREFIX = '__sharedRepay:';
const repayTagFor = (txId, idx) => `${REPAY_PREFIX}${txId}:${idx}__`;

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`);

// ---- Sub-componente: Card de Grupo ----
const GROUP_TX_PREFIX = '__groupRef:';
const groupRefTagFor = (groupId, entryId) => `${GROUP_TX_PREFIX}${groupId}:${entryId}__`;
const parseGroupRefTag = (tag) => {
    if (!tag || !tag.startsWith(GROUP_TX_PREFIX)) return null;
    const body = tag.slice(GROUP_TX_PREFIX.length).replace(/__$/, '');
    const [groupId, entryId] = body.split(':');
    return { groupId, entryId };
};

const GroupCard = ({ group, onUpdate, onDelete, onShare }) => {
    const { t, theme, activeColor, user } = useAuth();
    const { transactions, addTransaction, updateTransaction, deleteTransaction } = useFinance();
    const [open, setOpen] = useState(false);
    const meId = useMemo(() => {
        const list = group.members || [];
        const byUser = user?.id && list.find(m => m.userId === user.id);
        if (byUser) return byUser.id;
        const byName = list.find(m => m.name === 'Yo');
        return byName?.id || list[0]?.id || '';
    }, [group.members, user]);
    const blankWeights = useMemo(() => {
        const w = {};
        (group.members || []).forEach(m => { w[m.id] = { mult: 1, custom: false, customAmount: 0 }; });
        return w;
    }, [group.members]);
    const initialForm = () => ({
        editingId: null,
        kind: 'expense',
        payerId: meId || group.members?.[0]?.id || '',
        amount: '',
        note: '',
        date: new Date().toISOString().split('T')[0],
        splitMode: 'all',
        splitWith: (group.members || []).map(m => m.id),
        weights: { ...blankWeights },
        toId: (group.members || []).find(m => m.id !== (meId || group.members?.[0]?.id))?.id || '',
    });
    const [entryForm, setEntryForm] = useState(initialForm);
    const [memberDraft, setMemberDraft] = useState('');
    const [copied, setCopied] = useState(false);
    const [confirmRemoveMember, setConfirmRemoveMember] = useState(null);
    const [confirmRemoveEntry, setConfirmRemoveEntry] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleShare = async () => {
        const link = await onShare(group.id);
        if (!link) return;
        const shareData = {
            title: `Únete al grupo "${group.name}"`,
            text: `Únete al grupo "${group.name}" en AlCash`,
            url: link,
        };
        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            } catch (err) {
                if (err?.name === 'AbortError') return;
            }
        }
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2200);
        } catch {
            window.prompt('Copia este enlace para invitar:', link);
        }
    };

    const claimedCount = (group.members || []).filter(m => m.userId).length;

    const { balance, transfers } = useMemo(() => settleGroup(group.members || [], group.entries || []), [group.members, group.entries]);
    const memberById = useMemo(() => Object.fromEntries((group.members || []).map(m => [m.id, m])), [group.members]);
    const total = (group.entries || []).reduce((a, e) => a + (Number(e.amount) || 0), 0);

    // ---- Sync de movimientos personales: cada entrada de gasto donde "Yo" pagó
    // crea/actualiza/borra una transacción tagged con __groupRef:groupId:entryId__
    // amount = mi parte justa (lo que realmente me cuesta tras liquidación).
    const myShareForEntry = (e, members, myId) => {
        if (!e || (e.amount || 0) <= 0) return 0;
        if (Array.isArray(e.splits) && e.splits.length > 0) {
            const found = e.splits.find(s => s.memberId === myId);
            return found ? Number(found.share) || 0 : 0;
        }
        const ids = Array.isArray(e.splitWith) && e.splitWith.length > 0 ? e.splitWith : (members || []).map(m => m.id);
        if (ids.length === 0 || !ids.includes(myId)) return 0;
        return Number((Number(e.amount) / ids.length).toFixed(2));
    };

    useEffect(() => {
        if (!meId || !group.id) return;
        let cancelled = false;
        (async () => {
            const myExpenseEntries = (group.entries || []).filter(e => e.payerId === meId && (e.kind || 'expense') === 'expense');
            const knownEntryIds = new Set(myExpenseEntries.map(e => e.id));
            const existingByEntry = {};
            (transactions || []).forEach(tx => {
                (tx.tags || []).forEach(tag => {
                    const ref = parseGroupRefTag(tag);
                    if (ref && ref.groupId === group.id) existingByEntry[ref.entryId] = tx;
                });
            });
            for (const e of myExpenseEntries) {
                if (cancelled) return;
                const myShare = Number(myShareForEntry(e, group.members || [], meId).toFixed(2));
                if (myShare <= 0) continue;
                const tag = groupRefTagFor(group.id, e.id);
                const note = `${group.name}${e.note ? ` · ${e.note}` : ''}`;
                const existing = existingByEntry[e.id];
                if (existing) {
                    const same = Math.abs((Number(existing.amount) || 0) - myShare) < 0.005
                        && existing.note === note
                        && existing.date === e.date;
                    if (!same) {
                        await updateTransaction(existing.id, {
                            amount: myShare,
                            originalAmount: myShare,
                            originalCurrency: 'EUR',
                            type: 'expense',
                            category: existing.category || 'Otros',
                            subCategory: existing.subCategory || 'Varios',
                            note,
                            date: e.date,
                            tags: existing.tags || ['Compartido', tag],
                            periodicity: existing.periodicity || 'puntual',
                            is_joint: !!existing.is_joint,
                        });
                    }
                } else {
                    await addTransaction({
                        amountVal: myShare,
                        originalAmount: myShare,
                        originalCurrency: 'EUR',
                        type: 'expense',
                        category: 'Otros',
                        subCategory: 'Varios',
                        note,
                        date: e.date,
                        tags: ['Compartido', tag],
                        periodicity: 'puntual',
                        is_joint: false,
                    });
                }
            }
            for (const [entryId, tx] of Object.entries(existingByEntry)) {
                if (!knownEntryIds.has(entryId)) {
                    if (cancelled) return;
                    await deleteTransaction(tx.id, !!tx.is_joint);
                }
            }
        })();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [group.id, group.entries, group.members, meId]);

    const addMember = async () => {
        const name = memberDraft.trim();
        if (!name) return;
        const next = [...(group.members || []), { id: newId(), name }];
        await onUpdate({ members: next });
        setMemberDraft('');
    };
    const removeMember = async (id) => {
        const stillReferenced = (group.entries || []).some(e => e.payerId === id || (e.splitWith || []).includes(id) || (e.splits || []).some(s => s.memberId === id));
        if (stillReferenced && confirmRemoveMember !== id) {
            setConfirmRemoveMember(id);
            setTimeout(() => setConfirmRemoveMember(prev => prev === id ? null : prev), 4000);
            return;
        }
        setConfirmRemoveMember(null);
        const nextMembers = (group.members || []).filter(m => m.id !== id);
        const nextEntries = (group.entries || []).filter(e => e.payerId !== id).map(e => ({
            ...e,
            splitWith: (e.splitWith || []).filter(x => x !== id),
            splits: (e.splits || []).filter(s => s.memberId !== id),
        }));
        await onUpdate({ members: nextMembers, entries: nextEntries });
    };

    // Compute share preview per selected member given current weights + total amount
    const previewShares = useMemo(() => {
        if (entryForm.kind !== 'expense' || entryForm.splitMode !== 'some') return {};
        const total = parseFloat(entryForm.amount) || 0;
        const ids = entryForm.splitWith;
        const customSum = ids.reduce((a, id) => a + (entryForm.weights[id]?.custom ? (Number(entryForm.weights[id].customAmount) || 0) : 0), 0);
        const remaining = Math.max(0, total - customSum);
        const multSum = ids.reduce((a, id) => a + (entryForm.weights[id]?.custom ? 0 : (Number(entryForm.weights[id]?.mult) || 0)), 0);
        const out = {};
        ids.forEach(id => {
            const w = entryForm.weights[id] || { mult: 1, custom: false, customAmount: 0 };
            out[id] = w.custom ? (Number(w.customAmount) || 0) : (multSum > 0 ? (remaining * (Number(w.mult) || 0)) / multSum : 0);
        });
        return out;
    }, [entryForm.amount, entryForm.kind, entryForm.splitMode, entryForm.splitWith, entryForm.weights]);

    const addEntry = async () => {
        const amount = parseFloat(entryForm.amount);
        if (!entryForm.payerId || !amount || amount <= 0) return;
        if (entryForm.kind === 'payment') {
            if (!entryForm.toId || entryForm.toId === entryForm.payerId) return;
        }
        let splitWith = [];
        let splits = null;
        if (entryForm.kind === 'payment') {
            splitWith = [entryForm.toId];
        } else if (entryForm.splitMode === 'some') {
            splitWith = entryForm.splitWith.filter(Boolean);
            if (splitWith.length === 0) return;
            splits = splitWith.map(id => ({
                memberId: id,
                share: Number((previewShares[id] || 0).toFixed(2)),
            }));
        } else {
            splitWith = []; // 'all' = todos los miembros
        }
        const base = {
            kind: entryForm.kind,
            payerId: entryForm.payerId,
            amount: Number(amount.toFixed(2)),
            note: entryForm.note.trim().slice(0, 200),
            date: entryForm.date,
            splitWith,
        };
        if (splits) base.splits = splits;
        let nextEntries;
        if (entryForm.editingId) {
            nextEntries = (group.entries || []).map(e => e.id === entryForm.editingId ? { ...e, ...base, splits: splits || null } : e);
        } else {
            nextEntries = [...(group.entries || []), { id: newId(), ...base }];
        }
        await onUpdate({ entries: nextEntries });
        setEntryForm(initialForm());
    };

    const startEditEntry = (e) => {
        const weights = { ...blankWeights };
        const splitWith = (e.splits && e.splits.length > 0)
            ? e.splits.map(s => s.memberId)
            : (Array.isArray(e.splitWith) && e.splitWith.length > 0 ? e.splitWith : (group.members || []).map(m => m.id));
        if (e.splits && e.splits.length > 0 && e.amount > 0) {
            // Detect if uniform (mult=1) or custom — store as custom amounts to preserve exact distribution.
            e.splits.forEach(s => {
                weights[s.memberId] = { mult: 1, custom: true, customAmount: Number(s.share) || 0 };
            });
        }
        const splitMode = e.kind === 'expense'
            ? ((!e.splitWith || e.splitWith.length === 0 || e.splitWith.length === (group.members || []).length) && (!e.splits || e.splits.length === 0)
                ? 'all'
                : 'some')
            : 'all';
        setEntryForm({
            editingId: e.id,
            kind: e.kind || 'expense',
            payerId: e.payerId,
            amount: String(e.amount),
            note: e.note || '',
            date: e.date || new Date().toISOString().split('T')[0],
            splitMode,
            splitWith,
            weights,
            toId: e.kind === 'payment' ? (e.splitWith || [])[0] || '' : '',
        });
    };

    const cancelEdit = () => setEntryForm(initialForm());

    const toggleSplitMember = (id) => {
        setEntryForm(f => {
            const set = new Set(f.splitWith);
            if (set.has(id)) set.delete(id); else set.add(id);
            const weights = { ...f.weights };
            if (set.has(id) && !weights[id]) weights[id] = { mult: 1, custom: false, customAmount: 0 };
            return { ...f, splitWith: [...set], weights };
        });
    };
    const setMemberWeight = (id, patch) => {
        setEntryForm(f => ({
            ...f,
            weights: { ...f.weights, [id]: { ...(f.weights[id] || { mult: 1, custom: false, customAmount: 0 }), ...patch } },
        }));
    };
    const removeEntry = async (id) => {
        if (confirmRemoveEntry !== id) {
            setConfirmRemoveEntry(id);
            setTimeout(() => setConfirmRemoveEntry(prev => prev === id ? null : prev), 4000);
            return;
        }
        setConfirmRemoveEntry(null);
        await onUpdate({ entries: (group.entries || []).filter(e => e.id !== id) });
    };

    const handleDeleteGroup = () => {
        if (!confirmDelete) {
            setConfirmDelete(true);
            setTimeout(() => setConfirmDelete(false), 4000);
            return;
        }
        setConfirmDelete(false);
        onDelete();
    };

    return (
        <div className={`rounded-2xl border ${t.card}`}>
            <div className="w-full p-4 flex items-center justify-between gap-3">
                <button onClick={() => setOpen(o => !o)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white ${activeColor.bg}`}>
                        <Group size={16} />
                    </div>
                    <div className="min-w-0">
                        <h5 className="font-black text-sm truncate">{group.name}</h5>
                        <p className={`text-[10px] font-bold ${t.textSec}`}>{(group.members || []).length} miembros · {(group.entries || []).length} mov · {total.toFixed(2)}€{claimedCount > 0 && ` · ${claimedCount} unido${claimedCount === 1 ? '' : 's'}`}</p>
                    </div>
                </button>
                {open && (
                    <button
                        onClick={handleDeleteGroup}
                        title={confirmDelete ? 'Toca otra vez para borrar' : 'Eliminar grupo'}
                        className={`p-1.5 rounded-lg shrink-0 transition-all ${confirmDelete ? 'bg-red-500 text-white' : 'text-red-500/70 hover:bg-red-500/10 hover:text-red-500'}`}
                    >
                        <Trash2 size={14} />
                    </button>
                )}
                <button onClick={() => setOpen(o => !o)} className="p-1 shrink-0">
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            </div>

            {open && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                    {/* MIEMBROS */}
                    <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${t.textSec}`}>Miembros</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {(group.members || []).map(m => {
                                const pending = confirmRemoveMember === m.id;
                                return (
                                    <span key={m.id} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${pending ? 'bg-red-500 text-white' : (theme === 'dark' ? 'bg-white/5' : 'bg-gray-100')}`}>
                                        {m.id === meId ? 'Yo' : m.name}
                                        <button onClick={() => removeMember(m.id)} title={pending ? 'Toca otra vez' : 'Eliminar'} className={pending ? '' : 'opacity-50 hover:opacity-100'}><X size={11} /></button>
                                    </span>
                                );
                            })}
                        </div>
                        <div className="flex gap-1.5">
                            <input value={memberDraft} onChange={e => setMemberDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMember()} placeholder="Añadir miembro" className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${t.input}`} />
                            <button onClick={addMember} className={`px-3 py-1.5 rounded-lg text-[11px] font-black ${activeColor.bg} text-white`}>+</button>
                        </div>
                    </div>

                    {/* AÑADIR ENTRADA (gasto o pago) */}
                    {(group.members || []).length > 1 && (
                        <div className={`p-3 rounded-2xl ${theme === 'dark' ? 'bg-white/[0.02] border border-white/5' : 'bg-gray-50 border border-gray-100'} space-y-2.5`}>
                            {/* Tabs Gasto / Pago */}
                            <div className={`flex p-1 rounded-xl ${theme === 'dark' ? 'bg-black/30' : 'bg-white border border-gray-200'}`}>
                                {[
                                    { id: 'expense', label: 'Gasto' },
                                    { id: 'payment', label: 'Pago directo' },
                                ].map(tk => (
                                    <button
                                        key={tk.id}
                                        onClick={() => setEntryForm(f => ({ ...f, kind: tk.id }))}
                                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-black transition-all ${entryForm.kind === tk.id ? `${activeColor.bg} text-white shadow` : t.textSec}`}
                                    >{tk.label}</button>
                                ))}
                            </div>

                            {entryForm.kind === 'expense' ? (
                                <>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <div>
                                            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${t.textSec}`}>Pagador</p>
                                            <select value={entryForm.payerId} onChange={e => setEntryForm(f => ({ ...f, payerId: e.target.value }))} className={`w-full px-2 py-2 rounded-lg text-[11px] font-bold ${t.input}`}>
                                                {(group.members || []).map(m => <option key={m.id} value={m.id}>{m.id === meId ? 'Yo' : m.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${t.textSec}`}>Importe</p>
                                            <input type="number" step="0.01" value={entryForm.amount} onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00 €" className={`w-full px-2 py-2 rounded-lg text-[11px] font-bold ${t.input}`} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <input type="date" value={entryForm.date} onChange={e => setEntryForm(f => ({ ...f, date: e.target.value }))} className={`px-2 py-2 rounded-lg text-[11px] font-bold ${t.input}`} />
                                        <input value={entryForm.note} onChange={e => setEntryForm(f => ({ ...f, note: e.target.value }))} placeholder="Concepto" className={`px-2 py-2 rounded-lg text-[11px] font-bold ${t.input}`} />
                                    </div>

                                    {/* Reparto */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <p className={`text-[9px] font-black uppercase tracking-widest ${t.textSec}`}>Reparto</p>
                                            <div className={`flex p-0.5 rounded-lg ${theme === 'dark' ? 'bg-black/30' : 'bg-white border border-gray-200'}`}>
                                                {[
                                                    { id: 'all', label: 'Todos' },
                                                    { id: 'some', label: 'Elegir' },
                                                ].map(s => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => setEntryForm(f => ({
                                                            ...f,
                                                            splitMode: s.id,
                                                            splitWith: s.id === 'all' ? (group.members || []).map(m => m.id) : (f.splitWith.length ? f.splitWith : (group.members || []).map(m => m.id)),
                                                        }))}
                                                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-black transition-all ${entryForm.splitMode === s.id ? `${activeColor.bg} text-white` : t.textSec}`}
                                                    >{s.label}</button>
                                                ))}
                                            </div>
                                        </div>
                                        {entryForm.splitMode === 'some' && (
                                            <div className="space-y-1.5">
                                                {(group.members || []).map(m => {
                                                    const on = entryForm.splitWith.includes(m.id);
                                                    const w = entryForm.weights[m.id] || { mult: 1, custom: false, customAmount: 0 };
                                                    const share = previewShares[m.id] || 0;
                                                    const sel = w.custom ? 'custom' : String(w.mult);
                                                    return (
                                                        <div key={m.id} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all ${on ? (theme === 'dark' ? 'bg-white/[0.03] border-white/10' : 'bg-white border-gray-200') : (theme === 'dark' ? 'bg-transparent border-white/5 opacity-50' : 'bg-gray-50 border-gray-100 opacity-60')}`}>
                                                            <button onClick={() => toggleSplitMember(m.id)} className={`w-5 h-5 rounded-md flex items-center justify-center border-2 shrink-0 ${on ? `${activeColor.bg} border-transparent` : 'border-gray-500/40'}`}>
                                                                {on && <Check size={11} className="text-white" />}
                                                            </button>
                                                            <span className="flex-1 min-w-0 text-[11px] font-black truncate">{m.id === meId ? 'Yo' : m.name}</span>
                                                            {on && (
                                                                <>
                                                                    <select
                                                                        value={sel}
                                                                        onChange={ev => {
                                                                            const v = ev.target.value;
                                                                            if (v === 'custom') setMemberWeight(m.id, { custom: true, customAmount: w.customAmount || 0 });
                                                                            else setMemberWeight(m.id, { custom: false, mult: parseFloat(v) });
                                                                        }}
                                                                        className={`text-[10px] font-black px-1.5 py-1 rounded-md ${t.input}`}
                                                                    >
                                                                        <option value="0.5">×½</option>
                                                                        <option value="1">×1</option>
                                                                        <option value="1.5">×1.5</option>
                                                                        <option value="2">×2</option>
                                                                        <option value="3">×3</option>
                                                                        <option value="custom">€ fijo</option>
                                                                    </select>
                                                                    {w.custom && (
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            value={w.customAmount}
                                                                            onChange={ev => setMemberWeight(m.id, { customAmount: parseFloat(ev.target.value) || 0 })}
                                                                            placeholder="€"
                                                                            className={`w-16 px-1.5 py-1 rounded-md text-[10px] font-black text-right ${t.input}`}
                                                                        />
                                                                    )}
                                                                    <span className="w-14 text-right text-[10px] font-black tabular-nums opacity-70">{share.toFixed(2)}€</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {(() => {
                                                    const totalAssigned = (entryForm.splitWith || []).reduce((a, id) => a + (previewShares[id] || 0), 0);
                                                    const totalNum = parseFloat(entryForm.amount) || 0;
                                                    const drift = totalNum - totalAssigned;
                                                    if (Math.abs(drift) <= 0.01) return null;
                                                    return (
                                                        <p className="text-[10px] font-black text-yellow-500">
                                                            Sin asignar: {drift.toFixed(2)}€ {drift < 0 && '(excede el total)'}
                                                        </p>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                        {entryForm.splitMode === 'all' && (
                                            <p className={`text-[10px] font-bold ${t.textSec}`}>Se reparte a partes iguales entre los {(group.members || []).length} miembros.</p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <div>
                                            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${t.textSec}`}>De</p>
                                            <select value={entryForm.payerId} onChange={e => setEntryForm(f => ({ ...f, payerId: e.target.value }))} className={`w-full px-2 py-2 rounded-lg text-[11px] font-bold ${t.input}`}>
                                                {(group.members || []).map(m => <option key={m.id} value={m.id}>{m.id === meId ? 'Yo' : m.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${t.textSec}`}>A</p>
                                            <select value={entryForm.toId} onChange={e => setEntryForm(f => ({ ...f, toId: e.target.value }))} className={`w-full px-2 py-2 rounded-lg text-[11px] font-bold ${t.input}`}>
                                                <option value="">Selecciona…</option>
                                                {(group.members || []).filter(m => m.id !== entryForm.payerId).map(m => (
                                                    <option key={m.id} value={m.id}>{m.id === meId ? 'Yo' : m.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <input type="number" step="0.01" value={entryForm.amount} onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))} placeholder="Importe €" className={`px-2 py-2 rounded-lg text-[11px] font-bold ${t.input}`} />
                                        <input type="date" value={entryForm.date} onChange={e => setEntryForm(f => ({ ...f, date: e.target.value }))} className={`px-2 py-2 rounded-lg text-[11px] font-bold ${t.input}`} />
                                    </div>
                                    <input value={entryForm.note} onChange={e => setEntryForm(f => ({ ...f, note: e.target.value }))} placeholder="Nota (opcional)" className={`w-full px-2 py-2 rounded-lg text-[11px] font-bold ${t.input}`} />
                                    <p className={`text-[10px] font-bold ${t.textSec}`}>Registra dinero ya entregado entre dos miembros. Se aplica al balance.</p>
                                </>
                            )}

                            <div className="flex gap-1.5">
                                <button
                                    onClick={addEntry}
                                    disabled={!entryForm.amount || (entryForm.kind === 'payment' && (!entryForm.toId || entryForm.toId === entryForm.payerId))}
                                    className={`flex-1 py-2 rounded-lg text-[11px] font-black text-white disabled:opacity-30 ${activeColor.bg} active:scale-95 transition-transform`}
                                >
                                    {entryForm.editingId ? 'Guardar cambios' : (entryForm.kind === 'payment' ? 'Registrar pago' : 'Añadir gasto')}
                                </button>
                                {entryForm.editingId && (
                                    <button onClick={cancelEdit} className={`px-3 py-2 rounded-lg text-[11px] font-black ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}>Cancelar</button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ENTRADAS */}
                    {(group.entries || []).length > 0 && (
                        <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${t.textSec}`}>Movimientos</p>
                            <div className="space-y-1">
                                {(group.entries || []).map(e => {
                                    const isPayment = e.kind === 'payment';
                                    const payerLabel = e.payerId === meId ? 'Yo' : (memberById[e.payerId]?.name || '—');
                                    const verbExpense = e.payerId === meId ? 'Pagué' : `${payerLabel} pagó`;
                                    const toId = (e.splitWith || [])[0];
                                    const toLabel = toId === meId ? 'mí' : (memberById[toId]?.name || '—');
                                    const allLikeAll = !e.splits || e.splits.length === 0;
                                    const memberCount = (group.members || []).length;
                                    const usedIds = (e.splits && e.splits.length > 0) ? e.splits.map(s => s.memberId) : (e.splitWith || []);
                                    const splitText = !isPayment && (allLikeAll && (!usedIds.length || usedIds.length === memberCount))
                                        ? 'todos'
                                        : `${usedIds.length || memberCount} pers.`;
                                    const isEditing = entryForm.editingId === e.id;
                                    const pendingDel = confirmRemoveEntry === e.id;
                                    return (
                                        <div key={e.id} className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border transition-all ${isEditing ? `${activeColor.border} ${theme === 'dark' ? 'bg-white/[0.04]' : 'bg-white'}` : isPayment ? (theme === 'dark' ? 'border-blue-500/20 bg-blue-500/5' : 'border-blue-500/30 bg-blue-50') : (theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50')}`}>
                                            <div className="min-w-0 flex-1">
                                                {isPayment ? (
                                                    <p className="text-[11px] font-bold truncate flex items-center gap-1">
                                                        <ArrowRightLeft size={10} className="text-blue-500 shrink-0" />
                                                        <span className="font-black">{payerLabel}</span>
                                                        <ArrowRight size={9} className={t.textSec} />
                                                        <span className="font-black">{toLabel}</span>
                                                        <span className="ml-1 tabular-nums">{Number(e.amount).toFixed(2)}€</span>
                                                    </p>
                                                ) : (
                                                    <p className="text-[11px] font-bold truncate">
                                                        <span className="font-black">{verbExpense}</span> {Number(e.amount).toFixed(2)}€ <span className={t.textSec}>· {splitText}</span>
                                                    </p>
                                                )}
                                                <p className={`text-[10px] ${t.textSec}`}>{e.note || (isPayment ? 'Pago' : '—')} · {e.date}</p>
                                            </div>
                                            <button onClick={() => startEditEntry(e)} className={`p-1 shrink-0 ${isEditing ? activeColor.text : `${t.textSec} hover:${activeColor.text}`}`} title="Editar"><Pencil size={12} /></button>
                                            <button onClick={() => removeEntry(e.id)} className={`p-1 shrink-0 rounded-md transition-all ${pendingDel ? 'bg-red-500 text-white' : 'text-red-500/70 hover:text-red-500'}`} title={pendingDel ? 'Toca otra vez' : 'Eliminar'}><Trash2 size={12} /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* BALANCE */}
                    {(group.members || []).length > 0 && (group.entries || []).length > 0 && (
                        <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${t.textSec}`}>Balance</p>
                            <div className="space-y-0.5">
                                {Object.entries(balance).map(([id, val]) => (
                                    <div key={id} className="flex items-center justify-between text-[11px]">
                                        <span className="font-bold">{id === meId ? 'Yo' : (memberById[id]?.name || '—')}</span>
                                        <span className={`font-black tabular-nums ${val > 0.01 ? 'text-green-500' : val < -0.01 ? 'text-red-500' : t.textSec}`}>
                                            {val > 0.01 ? '+' : ''}{val.toFixed(2)}€
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* LIQUIDACIÓN ÓPTIMA */}
                    {transfers.length > 0 && (
                        <div className={`p-2.5 rounded-xl border ${theme === 'dark' ? 'border-green-500/20 bg-green-500/5' : 'border-green-500/30 bg-green-50'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-green-500 mb-1.5 flex items-center gap-1"><ArrowRightLeft size={11} /> Liquidación óptima ({transfers.length} {transfers.length === 1 ? 'transferencia' : 'transferencias'})</p>
                            <div className="space-y-1">
                                {transfers.map((tr, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[11px] font-bold">
                                        <span className="text-red-500">{tr.from === meId ? 'Yo' : (memberById[tr.from]?.name || '—')}</span>
                                        <ArrowRight size={11} className={t.textSec} />
                                        <span className="text-green-500">{tr.to === meId ? 'Yo' : (memberById[tr.to]?.name || '—')}</span>
                                        <span className="ml-auto font-black tabular-nums">{tr.amount.toFixed(2)}€</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-1.5">
                        <button
                            onClick={handleShare}
                            className={`flex-1 py-2 rounded-lg text-[11px] font-black flex items-center justify-center gap-1 ${copied ? 'bg-green-500/15 text-green-500' : `${activeColor.bg} text-white`}`}
                        >
                            {copied ? <><Check size={12} /> Enlace copiado</> : <><Share2 size={12} /> Compartir</>}
                        </button>
                        <button
                            onClick={() => setOpen(false)}
                            className={`px-4 py-2 rounded-lg text-[11px] font-black ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const DebtsView = () => {
    const { t, activeColor, theme } = useAuth();
    const {
        debts, addDebt, updateDebt, deleteDebt,
        transactions, updateTransaction, addTransaction,
        expenseGroups, addExpenseGroup, updateExpenseGroup, deleteExpenseGroup,
        generateGroupInviteToken,
    } = useFinance();
    const [tab, setTab] = useState('owed'); // owed | owe | groups
    const [groupCreator, setGroupCreator] = useState({ open: false, name: '', count: 2, names: [''] });
    const [openShared, setOpenShared] = useState({});
    const [openManualForm, setOpenManualForm] = useState(false);
    const [openDebtor, setOpenDebtor] = useState({});
    const [partialInput, setPartialInput] = useState({});
    const manualFormRef = useRef(null);

    useEffect(() => {
        if (!openManualForm) return;
        const handler = (ev) => {
            if (manualFormRef.current && !manualFormRef.current.contains(ev.target)) {
                setOpenManualForm(false);
            }
        };
        const id = setTimeout(() => document.addEventListener('mousedown', handler), 50);
        return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
    }, [openManualForm]);

    useEffect(() => {
        if (typeof Notification === 'undefined') return;
        if (Notification.permission !== 'granted') return;
        const today = new Date(); today.setHours(0,0,0,0);
        const due = (debts || []).filter(d => d.type === 'owe' && !d.paid && d.due && new Date(d.due) <= today);
        if (due.length === 0) return;
        const total = due.reduce((a, b) => a + Number(b.amount || 0), 0);
        new Notification('Recordatorio de deudas', {
            body: `${due.length} deuda(s) vencen hoy o están atrasadas · ${total.toFixed(0)}€`,
            icon: '/icon-192.png',
        });
    }, [debts]);

    const sharedEntries = useMemo(() => collectSharedDebtors(transactions), [transactions]);
    const sharedUnpaid = sharedEntries; // collectSharedDebtors ya filtra remaining > 0

    const sharedByTx = useMemo(() => {
        const map = {};
        sharedUnpaid.forEach(e => {
            if (!map[e.txId]) map[e.txId] = { txId: e.txId, txNote: e.txNote, txDate: e.txDate, category: e.category, total: 0, items: [] };
            map[e.txId].total += e.remaining;
            map[e.txId].items.push(e);
        });
        return Object.values(map).sort((a, b) => new Date(b.txDate) - new Date(a.txDate));
    }, [sharedUnpaid]);

    const sharedOwedTotal = sharedUnpaid.reduce((a, b) => a + b.remaining, 0);
    const manualOwedTotal = debts.filter(d => d.type === 'owed' && !d.paid).reduce((a, b) => a + Number(b.amount || 0), 0);
    const manualOweTotal  = debts.filter(d => d.type === 'owe'  && !d.paid).reduce((a, b) => a + Number(b.amount || 0), 0);

    const totalOwed = sharedOwedTotal + manualOwedTotal;
    const totalOwe  = manualOweTotal;

    const addSharedPayment = async (txId, participantIdx, amount) => {
        const tx = transactions.find(t => t.id === txId);
        if (!tx) return;
        const meta = extractSharedMeta(tx);
        if (!meta) return;
        const participant = meta.participants[participantIdx];
        const remaining = (Number(participant.share) || 0) - paidAmountOf(participant);
        const add = Math.min(remaining, Number(amount) || 0);
        if (add <= 0) return;
        const next = {
            ...meta,
            participants: meta.participants.map((p, i) => {
                if (i !== participantIdx) return p;
                const newPaid = paidAmountOf(p) + add;
                const settled = newPaid >= (Number(p.share) || 0) - 0.005;
                return { ...p, paidAmount: Number(newPaid.toFixed(2)), paid: settled };
            }),
        };
        next.allPaid = next.participants.every(p => paidAmountOf(p) >= (Number(p.share) || 0) - 0.005);
        const newTags = replaceSharedMetaInTags(tx.tags, next);
        await updateTransaction(txId, { tags: newTags });

        await addTransaction({
            amountVal: Number(add.toFixed(2)),
            originalAmount: Number(add.toFixed(2)),
            originalCurrency: 'EUR',
            type: 'income',
            category: tx.category,
            subCategory: tx.subCategory || '',
            date: new Date().toISOString().split('T')[0],
            note: `Pago de ${participant.name} · ${tx.note || tx.category}`,
            tags: ['Reembolso', repayTagFor(txId, participantIdx)],
            periodicity: 'puntual',
            is_joint: false,
        });
        const k = `${txId}-${participantIdx}`;
        setPartialInput(s => ({ ...s, [k]: '' }));
        setOpenDebtor(s => ({ ...s, [k]: false }));
    };

    const handleCreateGroup = async () => {
        const name = groupCreator.name.trim();
        if (!name) return;
        const memberNames = (groupCreator.names || [])
            .map(s => (s || '').trim())
            .filter(Boolean);
        const members = [{ id: newId(), name: 'Yo' }, ...memberNames.map(n => ({ id: newId(), name: n }))];
        await addExpenseGroup({ name, members, entries: [] });
        setGroupCreator({ open: false, name: '', count: 2, names: [''] });
    };

    const setGroupCount = (next) => {
        setGroupCreator(c => {
            const n = Math.max(2, Math.min(12, next));
            const slots = n - 1;
            const names = Array.from({ length: slots }, (_, i) => c.names?.[i] || '');
            return { ...c, count: n, names };
        });
    };

    return (
        <div className="space-y-8 animate-in zoom-in-95">
            {/* RESUMEN */}
            <div className={`p-5 rounded-[32px] border space-y-4 ${t.card}`}>
                <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-2xl border ${theme === 'dark' ? 'border-green-500/20 bg-green-500/5' : 'border-green-500/30 bg-green-50'}`}>
                        <span className="block text-[9px] font-black text-green-500 uppercase tracking-widest">Por cobrar</span>
                        <span className="text-2xl font-black text-green-500">{totalOwed.toFixed(0)}€</span>
                    </div>
                    <div className={`p-3 rounded-2xl border ${theme === 'dark' ? 'border-red-500/20 bg-red-500/5' : 'border-red-500/30 bg-red-50'}`}>
                        <span className="block text-[9px] font-black text-red-500 uppercase tracking-widest">Por pagar</span>
                        <span className="text-2xl font-black text-red-500">{totalOwe.toFixed(0)}€</span>
                    </div>
                </div>

                {/* TABS */}
                <div className={`flex p-1 rounded-2xl border ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                    {[
                        { id: 'owed', label: 'Me deben', color: 'bg-green-500' },
                        { id: 'owe',  label: 'Yo debo',  color: 'bg-red-500' },
                        { id: 'groups', label: `Grupos · ${expenseGroups.length}`, color: activeColor.bg },
                    ].map(tb => (
                        <button
                            key={tb.id}
                            onClick={() => setTab(tb.id)}
                            className={`flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${tab === tb.id ? `${tb.color} text-white shadow` : t.textSec}`}
                        >
                            {tb.label}
                        </button>
                    ))}
                </div>
            </div>

            {tab !== 'groups' && (
                <div className="space-y-4">
                    {/* HEADER + BOTÓN MANUAL */}
                    {(() => {
                        const isOwed = tab === 'owed';
                        const accentBg = isOwed ? 'bg-emerald-500' : 'bg-rose-500';
                        const accentSoftBg = isOwed ? 'bg-emerald-500/10' : 'bg-rose-500/10';
                        const accentText = isOwed ? 'text-emerald-500' : 'text-rose-500';
                        const accentBorder = isOwed ? 'border-emerald-500/20' : 'border-rose-500/20';
                        return (
                            <div className={`p-4 rounded-3xl border flex items-center gap-3 ${accentBorder} ${accentSoftBg}`}>
                                <div className={`w-11 h-11 rounded-2xl ${accentBg} flex items-center justify-center text-white shadow-lg shrink-0`}>
                                    <Hand size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className={`text-sm font-black ${accentText}`}>{isOwed ? 'Por cobrar' : 'Por pagar'}</h4>
                                    <p className={`text-[11px] font-bold ${t.textSec}`}>{isOwed ? 'Lo que te deben · compartidos + manuales.' : 'Lo que debes · compartidos + manuales.'}</p>
                                </div>
                                <button
                                    onClick={() => setOpenManualForm(o => !o)}
                                    className={`px-3.5 py-2.5 rounded-xl text-[11px] font-black ${activeColor.bg} text-white flex items-center gap-1.5 shrink-0 shadow-lg active:scale-95 transition-all`}
                                >
                                    <Plus size={14} /> Nueva deuda
                                </button>
                            </div>
                        );
                    })()}

                    {openManualForm && (
                        <form ref={manualFormRef} onSubmit={async (e) => {
                            e.preventDefault();
                            const form = e.target;
                            await addDebt({
                                person: form.person.value,
                                amount: parseFloat(form.amount.value),
                                type: form.type.value,
                                note: form.note.value,
                                due: form.due.value || null,
                                paid: false,
                            });
                            form.reset();
                            setOpenManualForm(false);
                        }} className={`p-4 rounded-2xl border space-y-2 ${t.card}`}>
                            <div className="flex p-1 rounded-xl bg-black/20 border border-white/5">
                                <label className="flex-1 cursor-pointer">
                                    <input type="radio" name="type" value="owed" className="peer sr-only" defaultChecked={tab === 'owed'} />
                                    <span className="block text-center py-2 text-xs font-bold rounded-lg peer-checked:bg-green-600 peer-checked:text-white transition-all">Me deben</span>
                                </label>
                                <label className="flex-1 cursor-pointer">
                                    <input type="radio" name="type" value="owe" className="peer sr-only" defaultChecked={tab === 'owe'} />
                                    <span className="block text-center py-2 text-xs font-bold rounded-lg peer-checked:bg-red-600 peer-checked:text-white transition-all">Debo</span>
                                </label>
                            </div>
                            <input name="person" placeholder="Persona / Entidad" required className={`w-full p-2.5 rounded-xl text-sm font-bold outline-none ${t.input}`} />
                            <div className="grid grid-cols-2 gap-2">
                                <input name="amount" type="number" step="0.01" placeholder="Importe (€)" required className={`w-full p-2.5 rounded-xl text-sm font-bold outline-none ${t.input}`} />
                                <div className="relative">
                                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                                    <input name="due" type="date" defaultValue={new Date().toISOString().slice(0, 10)} placeholder="Fecha límite" className={`w-full p-2.5 pl-9 rounded-xl text-sm font-bold outline-none ${t.input}`} />
                                </div>
                            </div>
                            <input name="note" placeholder="Concepto (opcional)" className={`w-full p-2.5 rounded-xl text-sm font-bold outline-none ${t.input}`} />
                            <div className="flex gap-2">
                                <button type="submit" className={`flex-1 py-2.5 ${activeColor.bg} text-white rounded-xl font-black text-xs`}>Añadir</button>
                                <button type="button" onClick={() => setOpenManualForm(false)} className={`px-4 py-2.5 rounded-xl text-xs font-black ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>Cancelar</button>
                            </div>
                        </form>
                    )}

                    {/* LISTA */}
                    <div className="space-y-6">
                        {tab === 'owed' && sharedByTx.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Users size={14} className={activeColor.text} />
                                    <h4 className="text-xs font-black uppercase tracking-widest">Gastos compartidos</h4>
                                </div>
                                {sharedByTx.map(g => {
                                    const key = `tx:${g.txId}`;
                                    const isOpen = !!openShared[key];
                                    return (
                                    <div key={g.txId} className={`rounded-2xl border overflow-hidden ${t.card}`}>
                                        <button
                                            onClick={() => setOpenShared(s => ({ ...s, [key]: !s[key] }))}
                                            className="w-full p-4 flex items-center justify-between gap-3"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center text-white shrink-0">
                                                    <Hand size={16} />
                                                </div>
                                                <div className="text-left min-w-0">
                                                    <h5 className="font-black text-sm truncate">{g.txNote || g.category}</h5>
                                                    <p className={`text-[11px] ${t.textSec}`}>{new Date(g.txDate).toLocaleDateString('es-ES')} · {g.items.length} {g.items.length === 1 ? 'persona' : 'personas'} pendiente{g.items.length === 1 ? '' : 's'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xl font-black text-green-500">{g.total.toFixed(2)}€</span>
                                                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                        </button>
                                        {isOpen && (
                                            <div className={`px-4 pb-4 pt-3 space-y-1.5 border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                                                {g.items.map(it => {
                                                    const dk = `${it.txId}-${it.participantIdx}`;
                                                    const dOpen = !!openDebtor[dk];
                                                    return (
                                                    <div key={dk} className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                                        <button
                                                            onClick={() => setOpenDebtor(s => ({ ...s, [dk]: !s[dk] }))}
                                                            className="w-full flex items-center justify-between p-2.5 text-left"
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-bold truncate">{it.name}</p>
                                                                <p className={`text-[10px] ${t.textSec}`}>{it.paidAmount > 0 ? `pagado ${it.paidAmount.toFixed(2)} / ${it.share.toFixed(2)}€` : `pendiente ${it.share.toFixed(2)}€`}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="text-xs font-black tabular-nums">{it.remaining.toFixed(2)}€</span>
                                                                {dOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                            </div>
                                                        </button>
                                                        {dOpen && (
                                                            <div className={`px-2.5 pb-2.5 pt-2 flex items-center gap-1.5 border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    placeholder={`Añadir (max ${it.remaining.toFixed(2)})`}
                                                                    value={partialInput[dk] ?? ''}
                                                                    onChange={e => setPartialInput(s => ({ ...s, [dk]: e.target.value }))}
                                                                    className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[11px] font-bold ${t.input}`}
                                                                />
                                                                <button
                                                                    onClick={() => addSharedPayment(it.txId, it.participantIdx, parseFloat(partialInput[dk] || '0'))}
                                                                    disabled={!partialInput[dk] || parseFloat(partialInput[dk]) <= 0}
                                                                    title="Añadir pago parcial"
                                                                    className={`p-1.5 rounded-lg ${activeColor.bg} text-white disabled:opacity-30`}
                                                                >
                                                                    <Plus size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => addSharedPayment(it.txId, it.participantIdx, it.remaining)}
                                                                    title="Pagar todo"
                                                                    className="p-1.5 rounded-lg bg-green-500/15 text-green-500 hover:bg-green-500 hover:text-white transition-colors"
                                                                >
                                                                    <CheckCircle2 size={14} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>
                        )}

                        {(tab === 'owed' ? debts.filter(d => d.type === 'owed') : tab === 'owe' ? debts.filter(d => d.type === 'owe') : []).length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Plus size={14} className={activeColor.text} />
                                    <h4 className="text-xs font-black uppercase tracking-widest">{tab === 'owed' ? 'Manual' : 'Yo debo'}</h4>
                                </div>
                                {(tab === 'owed' ? debts.filter(d => d.type === 'owed') : debts.filter(d => d.type === 'owe')).map(debt => {
                                    const due = debt.due ? new Date(debt.due) : null;
                                    const today = new Date(); today.setHours(0,0,0,0);
                                    const overdue = due && !debt.paid && due < today;
                                    const soon = due && !debt.paid && !overdue && (due - today) / 86400000 <= 7;
                                    return (
                                    <div key={debt.id} className={`p-4 rounded-2xl border flex items-center justify-between group ${debt.paid ? 'opacity-50' : ''} ${t.card}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${debt.type === 'owed' ? 'bg-green-600' : 'bg-red-600'}`}>
                                                <ArrowRight size={18} className={debt.type === 'owed' ? '-rotate-45' : 'rotate-135'} />
                                            </div>
                                            <div>
                                                <h4 className={`font-bold ${debt.paid ? 'line-through' : ''}`}>{debt.person}</h4>
                                                <p className={`text-xs ${t.textSec}`}>{debt.note || new Date(debt.created_at || debt.date).toLocaleDateString()}</p>
                                                {due && (
                                                    <p className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest mt-1 ${overdue ? 'text-red-500' : soon ? 'text-orange-500' : t.textSec}`}>
                                                        <Bell size={10} /> {overdue ? 'Vencida' : soon ? 'Próxima' : 'Vence'} {due.toLocaleDateString('es-ES')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`text-lg font-black ${debt.type === 'owed' ? 'text-green-500' : 'text-red-500'}`}>{debt.amount}€</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => updateDebt(debt.id, { paid: !debt.paid })} className={`p-2 rounded-lg ${debt.paid ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'} hover:scale-110 transition-transform`}>
                                                    {debt.paid ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                                                </button>
                                                <button onClick={() => deleteDebt(debt.id)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"><Trash2 size={18} /></button>
                                            </div>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        )}

                        {sharedByTx.length === 0 && debts.length === 0 && (
                            <div className={`p-8 rounded-3xl border ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'} flex flex-col items-center text-center gap-4`}>
                                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${theme === 'dark' ? 'bg-white/5' : 'bg-white'} border ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
                                    <Hand size={28} className={`${t.textSec} opacity-60`} />
                                </div>
                                <div className="space-y-1.5 max-w-xs">
                                    <p className="text-sm font-black">{tab === 'owed' ? 'Nadie te debe nada' : 'No debes nada'}</p>
                                    <p className={`text-[11px] font-bold leading-relaxed ${t.textSec}`}>
                                        Pulsa <span className="font-black">Nueva deuda</span> arriba para registrar la primera.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB GRUPOS */}
            {tab === 'groups' && (
                <div className="space-y-4">
                    {/* HEADER CARD */}
                    <div className={`p-4 rounded-3xl border ${t.card} flex items-center gap-3`}>
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${activeColor.bg} text-white shadow-lg shrink-0`}>
                            <Group size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-black truncate">Grupos de gasto</h4>
                            <p className={`text-[11px] font-bold leading-snug ${t.textSec}`}>Reparte un viaje, una cena o un piso compartido.</p>
                        </div>
                        <button
                            onClick={() => setGroupCreator(c => ({ ...c, open: !c.open }))}
                            className={`px-3 py-2 rounded-xl text-[11px] font-black ${activeColor.bg} text-white flex items-center gap-1 shrink-0 active:scale-95 transition-transform`}
                        >
                            <Plus size={14} /> Nuevo
                        </button>
                    </div>

                    {groupCreator.open && (
                        <div className={`p-4 rounded-3xl border space-y-3 ${t.card}`}>
                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${t.textSec}`}>Nombre del grupo</p>
                                <input value={groupCreator.name} onChange={e => setGroupCreator(c => ({ ...c, name: e.target.value }))} placeholder="Ej. Viaje a Lisboa" className={`w-full p-3 rounded-xl text-sm font-bold ${t.input}`} />
                            </div>

                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${t.textSec}`}>¿Cuántos sois?</p>
                                <div className={`flex items-center gap-3 p-2 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                                    <button
                                        type="button"
                                        onClick={() => setGroupCount(groupCreator.count - 1)}
                                        disabled={groupCreator.count <= 2}
                                        className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-lg ${theme === 'dark' ? 'bg-white/10 hover:bg-white/15' : 'bg-white hover:bg-gray-50'} disabled:opacity-30 active:scale-95 transition-transform`}
                                    >−</button>
                                    <div className="flex-1 text-center">
                                        <p className="text-2xl font-black leading-none">{groupCreator.count}</p>
                                        <p className={`text-[10px] font-bold mt-0.5 ${t.textSec}`}>personas (tú incluido)</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setGroupCount(groupCreator.count + 1)}
                                        disabled={groupCreator.count >= 12}
                                        className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-lg ${theme === 'dark' ? 'bg-white/10 hover:bg-white/15' : 'bg-white hover:bg-gray-50'} disabled:opacity-30 active:scale-95 transition-transform`}
                                    >+</button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>Miembros</p>
                                <div className={`flex items-center gap-2 p-2.5 rounded-xl ${theme === 'dark' ? 'bg-white/[0.03] border border-white/5' : 'bg-gray-50 border border-gray-100'}`}>
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black ${activeColor.bg} shrink-0`}>1</div>
                                    <p className="text-sm font-black flex-1">Tú</p>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'} ${t.textSec}`}>fijo</span>
                                </div>
                                {groupCreator.names.map((n, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black ${activeColor.bg} shrink-0`}>{i + 2}</div>
                                        <input
                                            value={n}
                                            onChange={e => setGroupCreator(c => {
                                                const next = [...c.names];
                                                next[i] = e.target.value;
                                                return { ...c, names: next };
                                            })}
                                            placeholder={`Nombre del miembro ${i + 2}`}
                                            className={`flex-1 p-2.5 rounded-xl text-sm font-bold ${t.input}`}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2 pt-1">
                                <button onClick={handleCreateGroup} disabled={!groupCreator.name.trim()} className={`flex-1 py-3 rounded-xl text-xs font-black ${activeColor.bg} text-white disabled:opacity-30 active:scale-95 transition-transform`}>Crear grupo</button>
                                <button onClick={() => setGroupCreator({ open: false, name: '', count: 2, names: [''] })} className={`px-4 py-3 rounded-xl text-xs font-black ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}>Cancelar</button>
                            </div>
                        </div>
                    )}

                    {expenseGroups.length === 0 && !groupCreator.open && (
                        <div className={`p-8 rounded-3xl border flex flex-col items-center justify-center gap-3 text-center ${t.card}`}>
                            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'} border ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
                                <Group size={28} className={`${activeColor.text} opacity-80`} />
                            </div>
                            <div className="space-y-1 max-w-[260px]">
                                <p className="text-sm font-black">Aún no tienes grupos</p>
                                <p className={`text-[11px] font-bold leading-relaxed ${t.textSec}`}>
                                    Pulsa <span className="font-black">Nuevo</span> arriba para crear el primero.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {expenseGroups.map(g => (
                            <GroupCard
                                key={g.id}
                                group={g}
                                onUpdate={(updates) => updateExpenseGroup(g.id, updates)}
                                onDelete={() => deleteExpenseGroup(g.id)}
                                onShare={async (groupId) => {
                                    const token = await generateGroupInviteToken(groupId);
                                    if (!token) return null;
                                    return `${window.location.origin}${window.location.pathname}#join/${token}`;
                                }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DebtsView;
