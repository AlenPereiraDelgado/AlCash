import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { getDynamicFontSize, parseLocalDate } from '../../utils/helpers';
import {
    Calendar as CalendarIcon, LayoutGrid, List, Check,
    Repeat, Trash2, Bell
} from 'lucide-react';

const FixedExpensesView = ({
    prorrateoMensual,
    pagadoFijoEsteMes,
    fixedViewMode,
    setFixedViewMode,
    fixedExpenses,
    monthlyFixedBreakdown
}) => {
    const { theme, t, activeColor } = useAuth();
    const { deleteRecurringRule, transactions, jointTransactions } = useFinance();
    const reminderTxs = [...transactions, ...jointTransactions].filter(tx => Array.isArray(tx.tags) && tx.tags.includes('__reminder__'));
    return (
        <div className="space-y-8 animate-in slide-in-from-right">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className={`p-10 rounded-[40px] border flex flex-col justify-between shadow-2xl relative overflow-hidden ${t.card}`}>
                    <div className="relative z-10">
                        <h3 className="text-3xl font-black tracking-tighter mb-2">Prorrateo Mensual</h3>
                        <p className={`font-medium max-w-sm ${t.textSec}`}>Carga estimada para cubrir gastos fijos anuales, bianuales y mensuales.</p>
                    </div>
                    <div className="text-right relative z-10 mt-8">
                        <span className={`font-black ${activeColor.text} ${getDynamicFontSize(prorrateoMensual.total)}`}>{prorrateoMensual.total.toFixed(2)}€</span>
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mt-2 ${t.textSec}`} title="Suma mensualizada de tus gastos recurrentes: mensuales íntegros + 1/12 de los anuales + 1/6 de los bianuales + 4.33× los semanales. Es lo que deberías reservar cada mes.">Recurrencia Estimada</p>
                        <p className={`text-[10px] font-medium mt-1 ${t.textSec} max-w-xs ml-auto`}>Lo que deberías reservar al mes para cubrir todos tus gastos recurrentes (mensuales + parte proporcional de anuales/bianuales/semanales).</p>

                        <div className="mt-8 space-y-4">
                            <div className="flex justify-between items-end">
                                <div className="text-left">
                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${t.textSec}`}>Pagado este mes</p>
                                    <p className="text-xl font-black">{pagadoFijoEsteMes.toFixed(2)}€</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${t.textSec}`}>Restante</p>
                                    <p className={`text-xl font-black ${pagadoFijoEsteMes >= prorrateoMensual.total ? t.success : ''}`}>
                                        {Math.max(0, prorrateoMensual.total - pagadoFijoEsteMes).toFixed(2)}€
                                    </p>
                                </div>
                            </div>
                            <div className={`w-full h-3 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                                <div 
                                    className={`h-full transition-all duration-1000 ${activeColor.bg}`}
                                    style={{ width: `${Math.min(100, (pagadoFijoEsteMes / (prorrateoMensual.total || 1)) * 100)}%` }}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-500/10">
                            <div className="text-right">
                                <span className="block text-[10px] font-bold opacity-60 uppercase">Prorrateo Anual</span>
                                <span className="font-bold text-xs">{((prorrateoMensual.annual || 0) + (prorrateoMensual.weekly || 0)).toFixed(2)}€/mes</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className={`p-8 rounded-[40px] border ${t.card}`}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3"><CalendarIcon className={t.textSec} size={20} /><h3 className="text-lg font-bold">{fixedViewMode === 'month' ? 'Días de Pago (Mes Actual)' : 'Planificación Anual'}</h3></div>
                        <div className={`flex p-1 rounded-xl border ${theme === 'dark' ? 'bg-black border-white/10' : 'bg-gray-100 border-gray-200'}`}>
                            <button onClick={() => setFixedViewMode('month')} className={`p-2 rounded-lg transition-all ${fixedViewMode === 'month' ? (theme === 'dark' ? 'bg-[#2C2C2E] text-white' : 'bg-white text-black shadow') : t.textSec}`}><LayoutGrid size={16} /></button>
                            <button onClick={() => setFixedViewMode('year')} className={`p-2 rounded-lg transition-all ${fixedViewMode === 'year' ? (theme === 'dark' ? 'bg-[#2C2C2E] text-white' : 'bg-white text-black shadow') : t.textSec}`}><List size={16} /></button>
                        </div>
                    </div>
                    {fixedViewMode === 'month' ? (
                        <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                                const currentMonth = new Date().getMonth();
                                const expensesOnDay = fixedExpenses.filter(e => {
                                    if (!e.date || parseInt(e.date.split('-')[2]) !== day) return false;
                                    const eDate = parseLocalDate(e.date);
                                    const eMonth = eDate.getMonth();

                                    if (e.periodicity === 'mensual') return true;
                                    if (e.periodicity === 'anual') return eMonth === currentMonth;
                                    if (e.periodicity === 'bianual') return eMonth === currentMonth || (eMonth + 6) % 12 === currentMonth;
                                    return false;
                                });

                                const remindersOnDay = reminderTxs.filter(tx => {
                                    if (!tx.date) return false;
                                    const d = parseLocalDate(tx.date);
                                    return d.getMonth() === currentMonth && d.getDate() === day;
                                });

                                const hasExpense = expensesOnDay.length > 0;
                                const hasReminder = remindersOnDay.length > 0;

                                // Determine dominant color based on expense types
                                let colorClasses = `border-transparent ${t.textSec} ${theme === 'dark' ? 'bg-black/20' : 'bg-gray-100'}`;
                                if (hasExpense) {
                                    const hasMensual = expensesOnDay.some(e => e.periodicity === 'mensual');
                                    const hasAnual = expensesOnDay.some(e => e.periodicity === 'anual');
                                    const hasBianual = expensesOnDay.some(e => e.periodicity === 'bianual');

                                    if (hasMensual && hasAnual && hasBianual) {
                                        colorClasses = 'bg-gradient-to-br from-red-500/20 via-yellow-500/20 to-purple-500/20 border-red-500 text-red-500';
                                    } else if (hasMensual) {
                                        colorClasses = 'bg-red-500/10 border-red-500 text-red-500';
                                    } else if (hasAnual) {
                                        colorClasses = 'bg-yellow-500/10 border-yellow-500 text-yellow-500';
                                    } else if (hasBianual) {
                                        colorClasses = 'bg-purple-500/10 border-purple-500 text-purple-500';
                                    }
                                } else if (hasReminder) {
                                    colorClasses = 'bg-cyan-500/10 border-cyan-500 text-cyan-400';
                                }

                                const now = new Date();
                                const isPaid = expensesOnDay.some(e => {
                                    const d = parseLocalDate(e.date);
                                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                                });

                                return (
                                    <div key={day} className={`aspect-square rounded-xl flex items-center justify-center text-xs font-bold border relative group cursor-help transition-all ${isPaid ? 'ring-2 ring-offset-2 ring-offset-black scale-105' : ''} ${colorClasses}`}>
                                        {day}
                                        {isPaid && (
                                            <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5 shadow-lg border border-white/20">
                                                <Check size={8} strokeWidth={4} />
                                            </div>
                                        )}
                                        {hasReminder && !hasExpense && (
                                            <div className="absolute -top-1 -right-1 bg-cyan-500 text-white rounded-full p-0.5 shadow-lg border border-white/20">
                                                <Bell size={8} strokeWidth={3} />
                                            </div>
                                        )}
                                        {(hasExpense || hasReminder) && (
                                            <div className="absolute bottom-full mb-2 hidden group-hover:block z-50 w-max max-w-[220px] p-2.5 rounded-xl bg-black/95 backdrop-blur-md border border-white/10 shadow-xl pointer-events-none animate-in fade-in zoom-in-95">
                                                <div className="space-y-1.5">
                                                    {expensesOnDay.map((e, idx) => (
                                                        <div key={`e-${idx}`} className="text-[10px] text-white border-b border-white/10 pb-1 last:border-0 last:pb-0">
                                                            <span className="font-bold block truncate">{e.note || e.subCategory || e.category}</span>
                                                            <span className="text-gray-400 block truncate">{e.category}{e.subCategory ? ` · ${e.subCategory}` : ''}</span>
                                                            <span className="text-gray-300 font-mono">{Number(e.amountVal).toFixed(2)}€</span>
                                                        </div>
                                                    ))}
                                                    {remindersOnDay.map((r, idx) => (
                                                        <div key={`r-${idx}`} className="text-[10px] border-b border-white/10 pb-1 last:border-0 last:pb-0">
                                                            <span className="flex items-center gap-1 font-bold text-cyan-400"><Bell size={9} />Aviso anual</span>
                                                            <span className="font-bold text-white block truncate">{r.note || r.subCategory || r.category}</span>
                                                            <span className="text-gray-400 block truncate">{r.category}{r.subCategory ? ` · ${r.subCategory}` : ''}</span>
                                                            <span className="text-gray-300 font-mono">~{Number(r.amountVal).toFixed(2)}€</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {monthlyFixedBreakdown.map((m, i) => {
                                const hasSpecial = m.specials.length > 0;
                                const monthName = new Date(2024, i, 1).toLocaleString('es-ES', { month: 'short' }).toUpperCase();
                                return (
                                    <div key={i} className={`p-4 rounded-2xl border flex flex-col justify-between h-28 ${hasSpecial ? 'bg-red-500/10 border-red-500/50' : `${t.card} border-transparent`}`}>
                                        <div className="flex justify-between items-start"><span className={`text-[10px] font-black tracking-widest ${t.textSec}`}>{monthName}</span>{hasSpecial && <div className="w-2 h-2 rounded-full bg-red-500" />}</div>
                                        <div><span className="text-sm font-black">{m.total.toFixed(0)}€</span>{hasSpecial && <div className="text-[9px] text-red-500 mt-1 truncate font-medium">{m.specials[0].category}</div>}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['mensual', 'semanal', 'anual'].map(period => {
                    const uniqueExpenses = Object.values(fixedExpenses.filter(e => e.periodicity === period).reduce((acc, curr) => {
                        const key = `${curr.category}-${curr.subCategory}-${curr.amountVal}`;
                        if (!acc[key]) acc[key] = { ...curr };
                        return acc;
                    }, {}));

                    return (
                        <div key={period} className={`p-6 rounded-[32px] border flex flex-col h-full ${t.card}`}>
                            <div className="flex justify-between items-center mb-6"><h4 className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>{period}</h4><Repeat size={14} className={t.textSec} /></div>
                            <div className="space-y-4 overflow-y-auto max-h-[300px] pr-2">
                                {uniqueExpenses.map(e => (
                                    <div key={e.id} className={`flex justify-between items-center group gap-3 border-b pb-2 last:border-0 ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                                        <div className="flex flex-col min-w-0 flex-1"><span className="text-sm font-bold truncate" title={e.note || e.subCategory || e.category}>{e.note || e.subCategory || e.category}</span><span className={`text-[9px] uppercase font-bold truncate ${t.textSec}`}>{e.category}</span></div>
                                        <div className="flex items-center gap-2 shrink-0"><span className="text-sm font-mono font-bold whitespace-nowrap">{Number(e.amountVal).toFixed(0)}€</span>
                                            <button onClick={() => { if (confirm('¿Borrar este gasto fijo?')) deleteRecurringRule(e.id); }} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FixedExpensesView;
