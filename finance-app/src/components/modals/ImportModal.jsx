import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { X, Sparkles, ImagePlus, TrendingUp, TrendingDown, Repeat, Trash2, Check, CheckCircle2, Loader2 } from 'lucide-react';

const ImportModal = ({
    isOpen,
    onClose,
    pendingImports,
    setPendingImports,
    onHandleFileUpload,
    onConfirmAll,
    onConfirmImportItem,
    isLoading,
    aiQuota,
}) => {
    const { theme, t, activeColor, user } = useAuth();
    const { categories, addCustomCategory, addSubCategory } = useFinance();
    const [editingAmountId, setEditingAmountId] = useState(null);
    if (!isOpen) return null;

    const total = pendingImports.length;
    const ADMINS = ['alenpdelgado@gmail.com', 'laraoliveirarodriguez8@gmail.com'];
    const isAdminLocal = ADMINS.includes((user?.email || '').toLowerCase());
    const showCounter = !isAdminLocal && !aiQuota?.isAdmin;
    const counterText = typeof aiQuota?.remaining === 'number'
        ? `${aiQuota.remaining} / ${aiQuota.limit ?? 2} usos IA restantes`
        : '2 usos IA / mes';

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => { if (pendingImports.length === 0 && !isLoading) onClose(); }}
        >
            <div
                className={`w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden border animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] ${t.card}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`p-6 border-b flex justify-between items-center shrink-0 ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-black flex items-center gap-2">
                            <Sparkles className={activeColor.text} size={22} /> Importación Inteligente
                        </h2>
                        <p className={`text-[11px] font-bold mt-0.5 ${t.textSec}`}>
                            {total > 0
                                ? `${total} ${total === 1 ? 'movimiento detectado' : 'movimientos detectados'} · revisa y confirma.`
                                : 'Sube capturas de notificaciones bancarias o tickets. La IA extrae los gastos.'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {showCounter && (
                            <span className={`hidden sm:inline px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${activeColor.bg} text-white`}>
                                {counterText}
                            </span>
                        )}
                        <button onClick={onClose} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><X size={18} /></button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    {/* CONTADOR MÓVIL */}
                    {showCounter && (
                        <div className={`sm:hidden text-center text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-full ${activeColor.bg} text-white`}>
                            {counterText}
                        </div>
                    )}

                    {/* ZONA DE CARGA */}
                    <label className={`relative block border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer ${isLoading ? 'opacity-60 pointer-events-none' : ''} ${theme === 'dark' ? 'border-white/10 hover:border-blue-500/50 bg-white/5' : 'border-gray-200 hover:border-blue-500/50 bg-gray-50'}`}>
                        <input
                            type="file"
                            multiple
                            accept="image/*,application/pdf,.pdf,text/csv,.csv"
                            onChange={onHandleFileUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={isLoading}
                        />
                        <div className="flex flex-col items-center gap-3">
                            <div className={`p-4 rounded-2xl ${activeColor.bg} text-white shadow-lg`}>
                                {isLoading ? <Loader2 size={26} className="animate-spin" /> : <ImagePlus size={26} />}
                            </div>
                            <div>
                                <p className="font-black text-base">{isLoading ? 'Analizando con IA…' : 'Subir capturas, fotos, PDF o CSV'}</p>
                                <p className={`text-[11px] font-bold mt-0.5 ${t.textSec}`}>
                                    {isLoading ? 'Extrayendo importes y comercios…' : 'Capturas / tickets / extractos en PDF o CSV · varios a la vez'}
                                </p>
                            </div>
                        </div>
                    </label>

                    {/* PENDIENTES */}
                    {total > 0 && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <h3 className="text-xs font-black uppercase tracking-widest opacity-60">
                                    Por revisar ({total})
                                </h3>
                                <button onClick={() => setPendingImports([])} className="text-red-500 text-[11px] font-black uppercase tracking-widest hover:underline">
                                    Limpiar
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {pendingImports.map((item, idx) => (
                                    <div key={item.id} className={`p-4 rounded-3xl border-2 flex flex-col gap-3 ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-white border-gray-100'}`}>
                                        <div className="flex justify-between items-start">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${activeColor.bg}/15 ${activeColor.text}`}>
                                                {idx + 1} / {total}
                                            </span>
                                            <div className={`shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center ${item.type === 'expense' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                                {item.type === 'expense' ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                                            </div>
                                        </div>
                                        <div>
                                            <input
                                                value={item.note}
                                                placeholder="Nota"
                                                onChange={(e) => {
                                                    const next = [...pendingImports];
                                                    next[idx] = { ...next[idx], note: e.target.value };
                                                    setPendingImports(next);
                                                }}
                                                className="w-full bg-transparent font-black text-sm outline-none border-b border-transparent focus:border-blue-500 transition-all"
                                            />
                                            <div className="flex flex-wrap gap-2 mt-1.5">
                                                <input
                                                    type="date"
                                                    value={item.date}
                                                    onChange={(e) => {
                                                        const next = [...pendingImports];
                                                        next[idx] = { ...next[idx], date: e.target.value };
                                                        setPendingImports(next);
                                                    }}
                                                    className={`text-[10px] font-bold bg-transparent outline-none uppercase ${t.textSec}`}
                                                />
                                                <select
                                                    value={item.category}
                                                    onChange={async (e) => {
                                                        const v = e.target.value;
                                                        if (v === '__new__') {
                                                            const name = window.prompt('Nombre de la nueva categoría:')?.trim();
                                                            if (!name) return;
                                                            await addCustomCategory(item.type, name);
                                                            const next = [...pendingImports];
                                                            next[idx] = { ...next[idx], category: name, subCategory: '' };
                                                            setPendingImports(next);
                                                            return;
                                                        }
                                                        const next = [...pendingImports];
                                                        next[idx] = { ...next[idx], category: v, subCategory: '' };
                                                        setPendingImports(next);
                                                    }}
                                                    className={`text-[10px] font-bold bg-transparent outline-none uppercase ${t.textSec} cursor-pointer`}
                                                >
                                                    {Object.keys(categories[item.type] || {}).map(c => <option key={c} value={c}>{c}</option>)}
                                                    <option value="__new__">+ Nueva categoría…</option>
                                                </select>
                                                <select
                                                    value={item.subCategory || ''}
                                                    onChange={async (e) => {
                                                        const v = e.target.value;
                                                        if (v === '__new__') {
                                                            const name = window.prompt('Nombre de la nueva subcategoría:')?.trim();
                                                            if (!name) return;
                                                            await addSubCategory(item.type, item.category, name);
                                                            const next = [...pendingImports];
                                                            next[idx] = { ...next[idx], subCategory: name };
                                                            setPendingImports(next);
                                                            return;
                                                        }
                                                        const next = [...pendingImports];
                                                        next[idx] = { ...next[idx], subCategory: v };
                                                        setPendingImports(next);
                                                    }}
                                                    className={`text-[10px] font-bold bg-transparent outline-none uppercase ${t.textSec} cursor-pointer`}
                                                >
                                                    <option value="">— sub —</option>
                                                    {(categories[item.type]?.[item.category] || []).map(s => <option key={s} value={s}>{s}</option>)}
                                                    <option value="__new__">+ Nueva subcategoría…</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                {editingAmountId === item.id ? (
                                                    <div className={`flex items-center gap-0.5 font-black text-lg ${item.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
                                                        <span>{item.type === 'expense' ? '-' : '+'}</span>
                                                        <input
                                                            type="number"
                                                            inputMode="decimal"
                                                            step="0.01"
                                                            autoFocus
                                                            value={item.amountVal}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                const next = [...pendingImports];
                                                                next[idx] = { ...next[idx], amountVal: v === '' ? 0 : Number(v) };
                                                                setPendingImports(next);
                                                            }}
                                                            onBlur={() => setEditingAmountId(null)}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') setEditingAmountId(null); }}
                                                            className="w-24 bg-transparent outline-none border-b border-current font-black text-lg"
                                                        />
                                                        <span>€</span>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setEditingAmountId(item.id)}
                                                        className={`font-black text-lg cursor-text hover:underline decoration-dotted ${item.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}
                                                        title="Tocar para editar importe"
                                                    >
                                                        {item.type === 'expense' ? '-' : '+'}{Number(item.amountVal).toFixed(2)}€
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        const next = [...pendingImports];
                                                        const flipped = next[idx].type === 'expense' ? 'income' : 'expense';
                                                        next[idx] = {
                                                            ...next[idx],
                                                            type: flipped,
                                                            category: Object.keys(categories[flipped] || {})[0] || 'Otros',
                                                            subCategory: '',
                                                        };
                                                        setPendingImports(next);
                                                    }}
                                                    className={`p-1.5 rounded-lg border border-white/5 transition-all ${t.hover}`}
                                                    title="Cambiar tipo"
                                                ><Repeat size={14} /></button>
                                            </div>
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => setPendingImports(pendingImports.filter(i => i.id !== item.id))}
                                                    className="p-2.5 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                                                ><Trash2 size={16} /></button>
                                                <button
                                                    onClick={() => onConfirmImportItem(item)}
                                                    className={`p-2.5 rounded-2xl ${activeColor.bg} text-white shadow-lg hover:scale-105 active:scale-95 transition-all`}
                                                ><Check size={16} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {total > 0 && (
                    <div className={`p-4 border-t shrink-0 ${theme === 'dark' ? 'border-white/5 bg-[#0E0E11]/80' : 'border-gray-100 bg-white/80'} backdrop-blur`}>
                        <button
                            onClick={onConfirmAll}
                            className={`w-full py-4 rounded-3xl font-black text-base ${activeColor.bg} text-white shadow-2xl hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2`}
                        >
                            <CheckCircle2 size={20} /> Validar todo · {total}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImportModal;
