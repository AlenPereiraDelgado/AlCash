import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { X, Zap, Trash2, Plus, Pencil, Check } from 'lucide-react';
import AppSelect from '../common/AppSelect';
import AddTabBar from '../common/AddTabBar';

const UNITS = [
    { value: 'day',   label: 'Día'   },
    { value: 'week',  label: 'Semana' },
    { value: 'month', label: 'Mes'   },
    { value: 'year',  label: 'Año'   },
];

const unitLabel = (every, unit) => {
    const u = UNITS.find(u => u.value === unit);
    const base = u?.label ?? unit;
    return `Cada ${every} ${base}${Number(every) > 1 ? 's' : ''}`;
};

const emptyForm = () => ({
    name: '', type: 'expense', category: '', subCategory: '',
    amount: '', every: 1, unit: 'month',
    startDate: new Date().toISOString().split('T')[0],
});

const AutomationModal = ({ isOpen, onClose, onSwitchTab, prefill, onPrefillConsumed }) => {
    const { theme, t, activeColor } = useAuth();
    const { categories, recurringRules, addRecurringRule, deleteRecurringRule, updateRecurringRule, reactivateRule, calcNextRun } = useFinance();
    const [form, setForm] = useState(emptyForm());
    const [editingStartDate, setEditingStartDate] = useState(null);
    const [reactivating, setReactivating] = useState(null);
    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        if (!isOpen || !prefill) return;
        setForm({
            name: prefill.note || prefill.category || '',
            type: prefill.type || 'expense',
            category: prefill.category || '',
            subCategory: prefill.subCategory || '',
            amount: prefill.amount ? String(prefill.amount) : '',
            every: 1,
            unit: 'month',
            startDate: prefill.date || today,
        });
        if (onPrefillConsumed) onPrefillConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, prefill]);

    const calcNextFromStart = (startDate, every, unit) => {
        if (startDate > today) return startDate;
        let cur = startDate;
        while (cur <= today) cur = calcNextRun(cur, every, unit);
        return cur;
    };

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
                        <p className={`text-[11px] font-bold mt-0.5 ${t.textSec}`}>Gastos e ingresos que se añaden solos.</p>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-xl ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><X size={20} /></button>
                </div>

                {onSwitchTab && (
                    <div className="px-6 pt-4">
                        <AddTabBar active="auto" onChange={onSwitchTab} />
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 max-h-[78vh] overflow-y-auto">
                    {/* FORMULARIO */}
                    <div className={`p-6 space-y-3 border-b md:border-b-0 md:border-r ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>Nueva Regla</p>

                        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre (ej: Netflix, Alquiler…)" className={`w-full p-3 rounded-xl text-sm font-bold ${t.input}`} />

                        <div className={`flex p-1 rounded-xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                            <button type="button" onClick={() => { set('type', 'expense'); set('category', ''); set('subCategory', ''); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${form.type === 'expense' ? 'bg-red-500 text-white shadow' : 'text-gray-500'}`}>Gasto</button>
                            <button type="button" onClick={() => { set('type', 'income'); set('category', ''); set('subCategory', ''); }} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${form.type === 'income' ? 'bg-green-500 text-white shadow' : 'text-gray-500'}`}>Ingreso</button>
                        </div>

                        <AppSelect value={form.category} onChange={e => { set('category', e.target.value); set('subCategory', ''); }} className="p-3 rounded-xl text-sm font-bold">
                            <option value="">Selecciona…</option>
                            {Object.keys(categories[form.type] || {}).map(c => <option key={c} value={c}>{c}</option>)}
                        </AppSelect>

                        {form.category && (
                            <AppSelect value={form.subCategory} onChange={e => set('subCategory', e.target.value)} className="p-3 rounded-xl text-sm font-bold">
                                <option value="">Selecciona…</option>
                                {subOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </AppSelect>
                        )}

                        <div className="relative">
                            <input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} className={`w-full p-3 pr-8 rounded-xl text-sm font-bold ${t.input}`} />
                            <span className={`absolute right-3 top-1/2 -translate-y-1/2 font-black text-sm ${t.textSec}`}>€</span>
                        </div>

                        <div className="flex gap-2">
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`text-xs font-black ${t.textSec}`}>Cada</span>
                                <input type="number" min="1" value={form.every} onChange={e => set('every', e.target.value)} className={`w-14 p-2 rounded-xl text-sm font-bold text-center ${t.input}`} />
                            </div>
                            <AppSelect value={form.unit} onChange={e => set('unit', e.target.value)} className="p-2 rounded-xl text-sm font-bold" wrapperClass="flex-1">
                                {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                            </AppSelect>
                        </div>

                        <div>
                            <p className={`text-[10px] font-black uppercase mb-1 ${t.textSec}`}>Primera ejecución</p>
                            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={`w-full p-3 rounded-xl text-sm font-bold ${t.input}`} />
                        </div>

                        <button onClick={handleSave} disabled={!form.amount || !form.category} className={`w-full py-3 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 ${activeColor.bg} shadow-lg`}>
                            <Plus size={16} /> Guardar Regla
                        </button>
                    </div>

                    {/* LISTA */}
                    <div className="p-6 space-y-3">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>Reglas ({recurringRules.length})</p>
                        <p className={`text-[10px] ${t.textSec} -mt-2`}>Toca <Pencil size={10} className="inline" /> en Inicio para cambiar la fecha de comienzo.</p>

                        {recurringRules.length === 0 ? (
                            <div className={`py-10 text-center text-xs font-bold opacity-30 ${t.textSec}`}>Sin reglas.</div>
                        ) : recurringRules.map(rule => (
                            <div key={rule.id} className={`rounded-2xl border group transition-all ${rule.active ? (theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200') : (theme === 'dark' ? 'border-white/10 border-dashed' : 'border-gray-200 border-dashed')}`}>
                                {/* Fila superior: info + toggle (toggle NUNCA opaco) */}
                                <div className="flex justify-between items-center gap-2 p-4">
                                    <div className={`min-w-0 flex-1 transition-opacity ${rule.active ? 'opacity-100' : 'opacity-40'}`}>
                                        <p className="font-black text-sm truncate">{rule.name || rule.category}</p>
                                        <p className={`text-[10px] font-bold ${t.textSec} truncate`}>{rule.category}{rule.subCategory ? ` · ${rule.subCategory}` : ''}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* Toggle grande — sin heredar opacity del padre */}
                                        <button
                                            onClick={() => {
                                                if (rule.active) {
                                                    updateRecurringRule(rule.id, { active: false });
                                                } else {
                                                    setReactivating({ id: rule.id, date: today });
                                                }
                                            }}
                                            className={`relative w-14 h-8 rounded-full transition-all duration-300 flex-shrink-0 shadow-inner ${rule.active ? activeColor.bg : (theme === 'dark' ? 'bg-white/15' : 'bg-gray-300')}`}
                                        >
                                            <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${rule.active ? 'left-7' : 'left-1'}`} />
                                        </button>
                                        <button onClick={() => { if (confirm(`¿Eliminar "${rule.name || rule.category}"?`)) deleteRecurringRule(rule.id); }} className="p-1.5 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 rounded-lg">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                                {/* Resto del contenido, opaco si inactivo */}
                                <div className={`px-4 pb-4 transition-opacity ${rule.active ? 'opacity-100' : 'opacity-40'}`}>
                                <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-2 flex-wrap">
                                    <span className={`text-[10px] font-black ${rule.type === 'expense' ? 'text-red-400' : 'text-green-400'}`}>
                                        {rule.type === 'expense' ? '-' : '+'}{rule.amount.toFixed(2)}€
                                    </span>
                                    <span className={`text-[10px] font-bold ${t.textSec}`}>{unitLabel(rule.every, rule.unit)}</span>

                                    {/* Inicio editable */}
                                    <div className="flex items-center gap-1">
                                        {editingStartDate === rule.id ? (
                                            <>
                                                <input
                                                    type="date"
                                                    defaultValue={rule.startDate}
                                                    onBlur={e => {
                                                        const newStart = e.target.value;
                                                        if (newStart) updateRecurringRule(rule.id, { startDate: newStart, nextRun: calcNextFromStart(newStart, rule.every, rule.unit) });
                                                        setEditingStartDate(null);
                                                    }}
                                                    autoFocus
                                                    className={`p-1 rounded-lg text-[10px] font-bold w-28 ${t.input}`}
                                                />
                                                <button onClick={() => setEditingStartDate(null)} className={`p-1 rounded-lg ${t.hover}`}><Check size={12} /></button>
                                            </>
                                        ) : (
                                            <button onClick={() => setEditingStartDate(rule.id)} className={`flex items-center gap-1 text-[10px] font-bold ${t.textSec} transition-colors`}>
                                                <span>Inicio: {rule.startDate ?? '—'}</span>
                                                <Pencil size={9} />
                                            </button>
                                        )}
                                    </div>
                                    {/* Próximo: solo informativo */}
                                    <span className={`text-[10px] font-bold ${t.textSec}`}>Próx: {rule.nextRun}</span>
                                </div>

                                {/* REACTIVACIÓN: elegir fecha de inicio */}
                                {reactivating?.id === rule.id && (
                                    <div className={`mt-3 rounded-2xl p-4 flex flex-col gap-3 border-2 animate-in fade-in slide-in-from-top-2 duration-200 ${theme === 'dark' ? 'bg-white/5 border-white/15' : 'bg-blue-50 border-blue-200'}`}>
                                        <p className={`text-xs font-black uppercase tracking-wide ${activeColor.text}`}>¿Desde cuándo reactivar?</p>
                                        <input
                                            type="date"
                                            value={reactivating.date}
                                            onChange={e => setReactivating({ ...reactivating, date: e.target.value })}
                                            className={`w-full p-3 rounded-xl text-sm font-bold ${t.input} border ${theme === 'dark' ? 'border-white/20' : 'border-blue-200'}`}
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    reactivateRule(rule.id, reactivating.date);
                                                    setReactivating(null);
                                                }}
                                                className={`flex-1 py-3 rounded-xl text-sm font-black text-white shadow-lg active:scale-95 transition-all ${activeColor.bg}`}
                                            >
                                                Reactivar
                                            </button>
                                            <button
                                                onClick={() => setReactivating(null)}
                                                className={`px-5 py-3 rounded-xl text-sm font-black active:scale-95 transition-all ${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'}`}
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}
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
