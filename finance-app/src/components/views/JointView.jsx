import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { CATEGORY_COLORS } from '../../constants/theme';
import { 
    TrendingUp, TrendingDown, Wallet, List, ChevronLeft, 
    ChevronRight, Calendar as CalendarIcon, Layers, Pencil, 
    Trash2, PieChart 
} from 'lucide-react';

const JointView = ({
    jointStats,
    filteredJointTransactions,
    handleNavigate,
    dateMode,
    setDateMode,
    getDateLabel,
    isDateMenuOpen,
    setIsDateMenuOpen,
    setDateRange,
    dateRange,
    handleEdit,
    expandedAnalysisCategory,
    setExpandedAnalysisCategory,
    getDynamicFontSize
}) => {
    const { theme, t, activeColor } = useAuth();
    const { setJointTransactions } = useFinance();
    return (
        <div className="space-y-8 animate-in fade-in">
            {/* Resumen Conjunto */}
            <div className="grid grid-cols-3 gap-3 md:gap-6">
                {[
                    { label: 'Ingresos', val: jointStats.income, color: t.success, icon: TrendingUp },
                    { label: 'Gastos', val: jointStats.expense, color: t.danger, icon: TrendingDown },
                    { label: 'Balance', val: jointStats.balance, color: activeColor.text, icon: Wallet }
                ].map((kpi, i) => (
                    <div key={i} className={`p-3 md:p-6 rounded-[20px] md:rounded-[24px] border ${t.card} relative overflow-hidden group h-24 md:h-36 flex flex-col justify-between`}>
                        <div className={`absolute top-2 right-2 md:top-4 md:right-4 p-1 rounded-full opacity-20 ${theme === 'dark' ? 'bg-white' : 'bg-black'}`}><kpi.icon size={12} className={kpi.color} /></div>
                        <p className={`text-[8px] md:text-xs font-bold uppercase tracking-wider ${t.textSec} truncate`}>{kpi.label}</p>
                        <h3 className={`font-black tracking-tight ${kpi.color} text-xs md:text-xl lg:text-3xl truncate`}>{kpi.val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</h3>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Lista Movimientos Conjuntos */}
                <div className={`p-6 rounded-[32px] border ${t.card}`}>
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <h3 className="text-lg font-bold flex items-center gap-2"><List size={18} /> Movimientos</h3>

                        {/* CONTROLES DE FECHA */}
                        <div className={`flex items-center p-1 rounded-2xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                            <button onClick={() => handleNavigate(-1)} disabled={dateMode === 'range'} className={`p-2 rounded-xl transition-colors ${t.hover} disabled:opacity-30`}><ChevronLeft size={16} /></button>
                            <div className="relative px-2">
                                <button onClick={() => setIsDateMenuOpen(!isDateMenuOpen)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors ${t.hover}`}>
                                    {dateMode === 'range' ? <Layers size={14} className="text-purple-500" /> : <CalendarIcon size={14} className={activeColor.text} />}
                                    <span className="font-black uppercase tracking-widest text-xs">{getDateLabel()}</span>
                                </button>
                                {isDateMenuOpen && (
                                    <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-4 p-4 rounded-2xl shadow-2xl border w-64 z-50 animate-in zoom-in-95 ${t.card} ${t.bg}`}>
                                        <div className="grid grid-cols-2 gap-2 mb-4">
                                            {['day', 'month', 'year', 'range'].map(m => (
                                                <button key={m} onClick={() => { setDateMode(m); if (m !== 'range') setIsDateMenuOpen(false); }} className={`p-2 text-xs font-bold rounded uppercase ${dateMode === m ? `${activeColor.bg} text-white` : `${t.hover} ${t.textSec}`}`}>{m}</button>
                                            ))}
                                        </div>
                                        {dateMode === 'range' && (
                                            <div className="space-y-2 pt-2 border-t border-gray-500/20">
                                                <input type="date" className={`w-full p-2 rounded text-xs ${t.input}`} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
                                                <input type="date" className={`w-full p-2 rounded text-xs ${t.input}`} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
                                                <button onClick={() => setIsDateMenuOpen(false)} className={`w-full py-2 ${activeColor.bg} text-white rounded text-xs font-bold`}>Aplicar</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => handleNavigate(1)} disabled={dateMode === 'range'} className={`p-2 rounded-xl transition-colors ${t.hover} disabled:opacity-30`}><ChevronRight size={16} /></button>
                        </div>
                    </div>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                        {filteredJointTransactions.length === 0 ? <p className={`text-center py-8 ${t.textSec}`}>No hay movimientos para esta fecha.</p> :
                            filteredJointTransactions.map(tx => (
                                <div key={tx.id} className="flex justify-between items-center border-b border-white/5 pb-2 group">
                                    <div>
                                        <p className="font-bold text-sm">{tx.note || tx.category}</p>
                                        <p className={`text-xs ${t.textSec}`}>{tx.date}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right mr-4">
                                            <p className={`font-black text-sm ${tx.type === 'income' ? t.success : t.danger}`}>
                                                {tx.type === 'income' ? '+' : '-'}{Number(tx.amountVal).toFixed(2)}€
                                            </p>
                                            <p className={`text-[10px] ${t.textSec}`}>{tx.category}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEdit(tx)} className={`p-2 rounded-lg ${t.hover} ${t.textSec} hover:text-blue-500 transition-all`}><Pencil size={14} /></button>
                                            <button onClick={() => setJointTransactions(prev => prev.filter(x => x.id !== tx.id))} className={`p-2 rounded-lg ${t.hover} ${t.textSec} hover:text-red-500 transition-all`}><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Distribución por Categorías */}
                    <div className={`p-8 rounded-[32px] border ${t.card}`}>
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><PieChart size={18} /> Distribución Categorías</h3>
                        <div className="space-y-4">
                            {(() => {
                                const total = filteredJointTransactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amountVal, 0);
                                if (total === 0) return <p className={`text-center py-4 ${t.textSec}`}>Sin gastos.</p>;

                                const byCat = {};
                                filteredJointTransactions.filter(t => t.type === 'expense').forEach(t => {
                                    byCat[t.category] = (byCat[t.category] || 0) + t.amountVal;
                                });

                                return Object.entries(byCat)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([cat, val]) => {
                                        const color = CATEGORY_COLORS[cat] || '#8E8E93';
                                        const isExpanded = expandedAnalysisCategory === cat;
                                        const catTransactions = filteredJointTransactions.filter(t => t.type === 'expense' && t.category === cat);

                                        return (
                                            <div key={cat} className="flex flex-col gap-2">
                                                <div
                                                    className={`flex items-center gap-3 cursor-pointer p-2 rounded-xl transition-all ${t.hover}`}
                                                    onClick={() => setExpandedAnalysisCategory(isExpanded ? null : cat)}
                                                >
                                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }}></div>
                                                    <span className="font-bold text-xs w-24 truncate">{cat}</span>
                                                    <div className="flex-1">
                                                        <div className="w-full h-1.2 bg-gray-500/10 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(val / total) * 100}%`, backgroundColor: color }} />
                                                        </div>
                                                    </div>
                                                    <div className="text-right w-20 shrink-0 flex items-center justify-end gap-2">
                                                        <div>
                                                            <div className="font-black text-xs">{(val || 0).toFixed(2)}€</div>
                                                            <div className={`text-[10px] ${t.textSec}`}>{((val / (total || 1)) * 100).toFixed(0)}%</div>
                                                        </div>
                                                        <ChevronRight size={12} className={`transition-transform ${isExpanded ? 'rotate-90' : ''} ${t.textSec}`} />
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className={`ml-4 p-3 rounded-xl border space-y-2 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                                        {catTransactions.map(tx => (
                                                            <div key={tx.id} className="flex justify-between items-center">
                                                                <div className="flex flex-col min-w-0 flex-1">
                                                                    <span className="text-[10px] font-bold truncate">{tx.note || tx.subCategory || tx.category}</span>
                                                                    <span className={`text-[8px] uppercase font-black ${t.textSec}`}>{tx.date}</span>
                                                                </div>
                                                                <span className="font-black text-xs shrink-0">{(tx.amountVal || 0).toFixed(2)}€</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JointView;
