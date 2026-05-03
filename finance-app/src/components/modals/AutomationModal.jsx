import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { X, Zap, Trash2, ToggleLeft, ToggleRight, Plus } from 'lucide-react';

const UNITS = [
    { value: 'day',   label: 'Día'  },
    { value: 'week',  label: 'Semana' },
    { value: 'month', label: 'Mes'  },
    { value: 'year',  label: 'Año'  },
];

const unitLabel = (every, unit) => {
    const u = UNITS.find(u => u.value === unit);
    return `Cada ${every} ${u?.label ?? unit}${Number(every) > 1 ? 's' : ''}`;
};

const emptyForm = () => ({
    name: '', type: 'expense', category: '', subCategory: '',
    amount: '', every: 1, unit: 'month',
    startDate: new Date().toISOString().split('T')[0],
    indefinite: true, endDate: '',
});

const AutomationModal = ({ isOpen, onClose }) => {
    const { theme, t, activeColor } = useAuth();
    const { categories, recurringRules, addRecurringRule, deleteRecurringRule, updateRecurringRule } = useFinance();
    const [form, setForm] = useState(emptyForm());

    if (!isOpen) return null;

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = () => {
        if (!form.amount || !form.category) return;
        addRecurringRule({
            ...form,
            amount: parseFloat(form.amount),
            every: Number(form.every),
            nextRun: form.startDate,
            lastRun: null,
            active: true,
        });
        setForm(emptyForm());
    };

    const subOptions = (categories[form.type] || {})[form.category] || [];

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className={`w-full max-w-2xl rounded-t-[32px] md:rounded-[40px] shadow-2xl overflow-hidden border animate-in slide-in-from-bottom-6 duration-300 md:zoom-in-95 ${t.card}`}
                onClick={e => e.stopPropagation()}
            >
                {/* HEADER */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black flex items-center gap-2"><Zap size={20} className="text-yellow-400" /> Automatización</h2>
                        <p className={`text-[11px] font-bold mt-0.5 ${t.textSec}`}>Transacciones que se añaden solas según tu calendario.</p>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-xl ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><X size={20} /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 max-h-[78vh] overflow-y-auto">
                    {/* FORMULARIO */}
                    <div className={`p-6 space-y-3 border-b md:border-b-0 md:border-r ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${t.textSec}`}>Nueva Regla</p>

                        <input
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            placeholder="Nombre (ej: Netflix, Alquiler…)"
                            className={`w-full p-3 rounded-xl text-sm font-bold ${t.input}`}
                        />

                        {/* Tipo */}
                        <div className={`flex p-1 rounded-xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                            <button type="button" onClick={() => { set('type', 'expense'); set('category', ''); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${form.type === 'expense' ? 'bg-red-500 text-white shadow' : 'text-gray-500'}`}>Gasto</button>
                            <button type="button" onClick={() => { set('type', 'income'); set('category', ''); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${form.type === 'income' ? 'bg-green-500 text-white shadow' : 'text-gray-500'}`}>Ingreso</button>
                        </div>

                        {/* Categoría + sub */}
                        <select value={form.category} onChange={e => { set('category', e.target.value); set('subCategory', ''); }} className={`w-full p-3 rounded-xl text-sm font-bold ${t.input}`}>
                            <option value="">Categoría…</option>
                            {Object.keys(categories[form.type] || {}).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {form.category && (
                            <select value={form.subCategory} onChange={e => set('subCategory', e.target.value)} className={`w-full p-3 rounded-xl text-sm font-bold ${t.input}`}>
                                <option value="">Subcategoría…</option>
                                {subOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        )}

                        {/* Importe */}
                        <div className="relative">
                            <input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} className={`w-full p-3 pr-10 rounded-xl text-sm font-bold ${t.input}`} />
                            <span className={`absolute right-3 top-1/2 -translate-y-1/2 font-black text-sm ${t.textSec}`}>€</span>
                        </div>

                        {/* Frecuencia */}
                        <div className="flex gap-2">
                            <div className="flex items-center gap-1 flex-1">
                                <span className={`text-xs font-black whitespace-nowrap ${t.textSec}`}>Cada</span>
                                <input type="number" min="1" value={form.every} onChange={e => set('every', e.target.value)} className={`w-14 p-2 rounded-xl text-sm font-bold text-center ${t.input}`} />
                            </div>
                            <select value={form.unit} onChange={e => set('unit', e.target.value)} className={`flex-1 p-2 rounded-xl text-sm font-bold ${t.input}`}>
                                {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                            </select>
                        </div>

                        {/* Inicio */}
                        <div>
                            <p className={`text-[10px] font-black uppercase mb-1 ${t.textSec}`}>Primera ejecución</p>
                            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={`w-full p-3 rounded-xl text-sm font-bold ${t.input}`} />
                        </div>

                        {/* Continuo / Fin */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">Ininterrumpido</span>
                            <button type="button" onClick={() => set('indefinite', !form.indefinite)}>
                                {form.indefinite
                                    ? <ToggleRight size={28} className={activeColor.text} />
                                    : <ToggleLeft size={28} className={t.textSec} />}
                            </button>
                        </div>
                        {!form.indefinite && (
                            <div>
                                <p className={`text-[10px] font-black uppercase mb-1 ${t.textSec}`}>Fecha fin</p>
                                <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className={`w-full p-3 rounded-xl text-sm font-bold ${t.input}`} />
                            </div>
                        )}

                        <button
                            onClick={handleSave}
                            disabled={!form.amount || !form.category}
                            className={`w-full py-3 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 ${activeColor.bg} shadow-lg`}
                        >
                            <Plus size={16} /> Guardar Regla
                        </button>
                    </div>

                    {/* LISTA DE REGLAS */}
                    <div className="p-6 space-y-3">
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${t.textSec}`}>Reglas activas ({recurringRules.length})</p>
                        {recurringRules.length === 0 ? (
                            <div className={`py-12 text-center ${t.textSec} text-xs font-bold opacity-40`}>Sin reglas configuradas.</div>
                        ) : recurringRules.map(rule => (
                            <div key={rule.id} className={`p-4 rounded-2xl border group transition-all ${rule.active ? (theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200') : 'opacity-40 border-dashed border-white/10'}`}>
                                <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-black text-sm truncate">{rule.name || rule.category}</p>
                                        <p className={`text-[10px] font-bold ${t.textSec} truncate`}>{rule.category}{rule.subCategory ? ` · ${rule.subCategory}` : ''}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => updateRecurringRule(rule.id, { active: !rule.active })}>
                                            {rule.active ? <ToggleRight size={22} className={activeColor.text} /> : <ToggleLeft size={22} className={t.textSec} />}
                                        </button>
                                        <button onClick={() => { if (confirm(`¿Eliminar "${rule.name || rule.category}"?`)) deleteRecurringRule(rule.id); }} className="p-1 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 rounded-lg">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                                    <span className={`text-[10px] font-black uppercase ${rule.type === 'expense' ? 'text-red-400' : 'text-green-400'}`}>
                                        {rule.type === 'expense' ? '-' : '+'}{rule.amount.toFixed(2)}€
                                    </span>
                                    <span className={`text-[10px] font-bold ${t.textSec}`}>{unitLabel(rule.every, rule.unit)}</span>
                                    <span className={`text-[10px] font-bold ${t.textSec}`}>
                                        Próx: {rule.nextRun}
                                    </span>
                                    <span className={`text-[10px] font-bold ${rule.indefinite ? activeColor.text : t.textSec}`}>
                                        {rule.indefinite ? '∞' : rule.endDate || '—'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AutomationModal;
