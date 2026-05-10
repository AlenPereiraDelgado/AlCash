import { useState, useMemo } from 'react';
import { X, Users, Check, Plus, RotateCcw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import {
    extractSharedMeta,
    replaceSharedMetaInTags,
    paidAmountOf,
    remainingOf,
} from '../../utils/sharedExpense';

const REPAY_PREFIX = '__sharedRepay:';
const repayTagFor = (txId, idx) => `${REPAY_PREFIX}${txId}:${idx}__`;

const SharedDetailModal = ({ isOpen, onClose, txId }) => {
    const { theme, t, activeColor } = useAuth();
    const { transactions, jointTransactions, updateTransaction, addTransaction, deleteTransaction } = useFinance();
    const [partialInputs, setPartialInputs] = useState({});

    const tx = useMemo(() => {
        if (!txId) return null;
        return transactions.find(t => t.id === txId) || jointTransactions.find(t => t.id === txId) || null;
    }, [txId, transactions, jointTransactions]);

    const meta = useMemo(() => extractSharedMeta(tx), [tx]);

    if (!isOpen || !tx) return null;

    if (!meta) {
        return (
            <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
                <div
                    className={`w-full max-w-md rounded-t-[32px] md:rounded-[40px] shadow-2xl overflow-hidden border ${t.card}`}
                    onClick={e => e.stopPropagation()}
                >
                    <div className={`p-5 border-b flex justify-between items-start gap-4 ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                        <h2 className="text-base font-black flex items-center gap-2"><Users size={16} className={activeColor.text} /> Gasto compartido</h2>
                        <button onClick={onClose} className={`p-2 rounded-xl ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><X size={18} /></button>
                    </div>
                    <div className="p-5 space-y-3">
                        <p className="text-sm font-bold">No se pudo cargar este gasto compartido.</p>
                        <p className={`text-xs ${t.textSec}`}>
                            El registro se creó antes de una actualización y los datos del reparto quedaron truncados en la base de datos.
                            Bórralo desde la lista de movimientos y créalo de nuevo.
                        </p>
                        <button onClick={onClose} className={`w-full py-3 rounded-xl ${activeColor.bg} text-white font-black text-sm`}>Entendido</button>
                    </div>
                </div>
            </div>
        );
    }

    const total = Number(meta.total) || 0;
    const totalPaid = (meta.participants || []).reduce((a, p) => a + paidAmountOf(p), 0);
    const totalPending = Math.max(0, total - totalPaid);

    const persistMeta = async (nextParticipants) => {
        const next = {
            ...meta,
            participants: nextParticipants,
        };
        next.allPaid = nextParticipants.every(p => paidAmountOf(p) >= (Number(p.share) || 0) - 0.005);
        const newTags = replaceSharedMetaInTags(tx.tags, next);
        await updateTransaction(tx.id, { tags: newTags });
    };

    const recordRepayTx = async (participant, amount) => {
        if (!amount || amount <= 0) return;
        await addTransaction({
            amountVal: Number(amount.toFixed(2)),
            originalAmount: Number(amount.toFixed(2)),
            originalCurrency: 'EUR',
            type: 'income',
            category: tx.category,
            subCategory: tx.subCategory || '',
            date: new Date().toISOString().split('T')[0],
            note: `Pago de ${participant.name} · ${tx.note || tx.category}`,
            tags: ['Reembolso', `${REPAY_PREFIX}${tx.id}:any__`],
            periodicity: 'puntual',
            is_joint: false,
        });
    };

    const handleAddPayment = async (idx, amount) => {
        const p = meta.participants[idx];
        const remaining = remainingOf(p);
        const add = Math.min(remaining, Number(amount) || 0);
        if (add <= 0) return;
        const next = meta.participants.map((q, i) => {
            if (i !== idx) return q;
            const newPaidAmount = paidAmountOf(q) + add;
            const settled = newPaidAmount >= (Number(q.share) || 0) - 0.005;
            return { ...q, paidAmount: Number(newPaidAmount.toFixed(2)), paid: settled };
        });
        await persistMeta(next);
        await recordRepayTx(p, add);
        setPartialInputs(s => ({ ...s, [idx]: '' }));
    };

    const handleMarkFull = async (idx) => {
        const p = meta.participants[idx];
        const remaining = remainingOf(p);
        if (remaining <= 0) return;
        await handleAddPayment(idx, remaining);
    };

    const handleReset = async (idx) => {
        const p = meta.participants[idx];
        const previouslyPaid = paidAmountOf(p);
        if (previouslyPaid <= 0) return;
        const next = meta.participants.map((q, i) => i === idx ? { ...q, paidAmount: 0, paid: false } : q);
        await persistMeta(next);
        // Borrar txs de reembolso vinculadas a este participante
        const oldTag = repayTagFor(tx.id, idx);
        const repays = transactions.filter(t => Array.isArray(t.tags) && (t.tags.includes(oldTag) || t.tags.includes(`${REPAY_PREFIX}${tx.id}:any__`)));
        for (const r of repays) {
            // Solo borrar las que coinciden por nombre del pagador (heurística por la nota)
            if ((r.note || '').includes(`Pago de ${p.name}`)) {
                await deleteTransaction(r.id, !!r.is_joint);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className={`w-full max-w-lg rounded-t-[32px] md:rounded-[40px] shadow-2xl overflow-hidden border animate-in slide-in-from-bottom-6 duration-300 md:zoom-in-95 ${t.card}`}
                onClick={e => e.stopPropagation()}
            >
                <div className={`p-5 border-b flex justify-between items-start gap-4 ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-black flex items-center gap-2"><Users size={18} className={activeColor.text} /> Gasto compartido</h2>
                        <p className={`text-[11px] font-bold mt-0.5 truncate ${t.textSec}`}>{tx.note || tx.category} · {Number(tx.date).toString().slice(0,10) ? new Date(tx.date).toLocaleDateString('es-ES') : ''}</p>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-xl ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
                    {/* RESUMEN */}
                    <div className={`grid grid-cols-3 gap-2 p-3 rounded-2xl border ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50'}`}>
                        <div>
                            <p className={`text-[9px] font-black uppercase tracking-widest ${t.textSec}`}>Total</p>
                            <p className="text-lg font-black">{total.toFixed(2)}€</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-green-500">Cobrado</p>
                            <p className="text-lg font-black text-green-500">{totalPaid.toFixed(2)}€</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-orange-500">Pendiente</p>
                            <p className="text-lg font-black text-orange-500">{totalPending.toFixed(2)}€</p>
                        </div>
                    </div>

                    {/* PARTICIPANTES */}
                    <div className="space-y-2">
                        {(meta.participants || []).map((p, idx) => {
                            const paidAmt = paidAmountOf(p);
                            const share = Number(p.share) || 0;
                            const remaining = remainingOf(p);
                            const settled = remaining <= 0.005 && share > 0;
                            const pct = share > 0 ? Math.min(100, (paidAmt / share) * 100) : 0;
                            return (
                                <div key={idx} className={`p-3 rounded-2xl border ${settled ? 'border-green-500/30 bg-green-500/5' : (theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-white')}`}>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black ${settled ? 'bg-green-500' : 'bg-gray-500'}`}>
                                                {p.name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-black text-xs truncate">{p.name}{p.isMe && <span className={`ml-1.5 text-[9px] ${activeColor.text}`}>· tú</span>}</p>
                                                <p className={`text-[10px] font-bold ${t.textSec}`}>{paidAmt.toFixed(2)} / {share.toFixed(2)}€</p>
                                            </div>
                                        </div>
                                        {settled && <Check size={16} className="text-green-500 shrink-0" />}
                                    </div>

                                    <div className={`h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                                        <div
                                            className={`h-full ${settled ? 'bg-green-500' : activeColor.bg}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>

                                    {!p.isMe && !settled && (
                                        <div className="flex items-center gap-1.5 mt-2.5">
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder={`Añadir (max ${remaining.toFixed(2)})`}
                                                value={partialInputs[idx] ?? ''}
                                                onChange={e => setPartialInputs(s => ({ ...s, [idx]: e.target.value }))}
                                                className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[11px] font-bold ${t.input}`}
                                            />
                                            <button
                                                onClick={() => handleAddPayment(idx, parseFloat(partialInputs[idx] || '0'))}
                                                disabled={!partialInputs[idx] || parseFloat(partialInputs[idx]) <= 0}
                                                title="Añadir pago parcial"
                                                className={`p-1.5 rounded-lg ${activeColor.bg} text-white disabled:opacity-30`}
                                            >
                                                <Plus size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleMarkFull(idx)}
                                                title="Marcar como pagado por completo"
                                                className="p-1.5 rounded-lg bg-green-500/15 text-green-500 hover:bg-green-500 hover:text-white transition-colors"
                                            >
                                                <Check size={14} />
                                            </button>
                                        </div>
                                    )}

                                    {!p.isMe && paidAmt > 0 && (
                                        <button
                                            onClick={() => handleReset(idx)}
                                            className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold ${t.textSec} hover:text-red-500`}
                                        >
                                            <RotateCcw size={11} /> Resetear pagos
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SharedDetailModal;
