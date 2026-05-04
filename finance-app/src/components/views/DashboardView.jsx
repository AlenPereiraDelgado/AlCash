import React, { createElement } from 'react';
import MagicInput from '../common/MagicInput';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { 
    Layers, Calendar as CalendarIcon, ChevronLeft, ChevronRight,
    TrendingUp, TrendingDown, Wallet, ShieldCheck,
    Target, Box, ArrowUpRight
} from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../constants/theme';
import { getDynamicFontSize } from '../../utils/helpers';

const DashboardView = ({
    dateMode,
    setDateMode,
    dateRange,
    setDateRange,
    isDateMenuOpen,
    setIsDateMenuOpen,
    getDateLabel,
    handleNavigate,
    stats,
    jointStats,
    netWorth,
    chartData,
    hoveredMonth,
    setHoveredMonth,
    savingsRate,
    emergencyFundMonths,
    filteredTransactions,
    setIsBudgetModalOpen,
    selectedChartYear,
    setSelectedChartYear,
    onMagicParse,
    isMagicLoading
}) => {
    const { theme, t, activeColor, privacyMode } = useAuth();
    const { budgets } = useFinance();
    return (
        <div className="space-y-8 animate-in fade-in">
            {/* Controles de Fecha en Dashboard */}
            <div className={`p-4 md:p-6 rounded-[32px] border flex flex-col xl:flex-row justify-between items-center gap-6 ${t.card}`}>
                <div className="w-full xl:max-w-xl">
                    <MagicInput onParse={onMagicParse} isLoading={isMagicLoading} />
                </div>

                <div className={`p-1 rounded-2xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'} flex items-center`}>
                    <button onClick={() => handleNavigate(-1)} disabled={dateMode === 'range'} className={`p-3 rounded-xl transition-colors ${t.hover} disabled:opacity-30`}><ChevronLeft size={20} /></button>
                    <div className="relative px-2">
                        <button onClick={() => setIsDateMenuOpen(!isDateMenuOpen)} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${t.hover}`}>
                            {dateMode === 'range' ? <Layers size={18} className="text-purple-500" /> : <CalendarIcon size={18} className={activeColor.text} />}
                            <span className="font-black uppercase tracking-widest text-sm">{getDateLabel()}</span>
                        </button>
                        {isDateMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-[150]" onClick={() => setIsDateMenuOpen(false)} />
                                <div className={`fixed left-1/2 -translate-x-1/2 top-32 md:absolute md:top-full md:left-1/2 md:-translate-x-1/2 md:top-auto p-4 rounded-2xl shadow-2xl border w-72 z-[200] animate-in zoom-in-95 ${t.card}`}>
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        {[
                                            { val: 'day', label: 'Día' },
                                            { val: 'month', label: 'Mes' },
                                            { val: 'year', label: 'Año' },
                                            { val: 'range', label: 'Rango' },
                                        ].map(m => (
                                            <button key={m.val} onClick={() => { setDateMode(m.val); if (m.val !== 'range') setIsDateMenuOpen(false); }} className={`p-2 text-xs font-bold rounded-xl uppercase ${dateMode === m.val ? `${activeColor.bg} text-white` : `${t.hover} ${t.textSec}`}`}>{m.label}</button>
                                        ))}
                                    </div>
                                    {dateMode === 'range' && (
                                        <div className="space-y-2 pt-2 border-t border-gray-500/20">
                                            <input type="date" className={`w-full p-2 rounded-xl text-xs ${t.input}`} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
                                            <input type="date" className={`w-full p-2 rounded-xl text-xs ${t.input}`} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
                                            <button onClick={() => setIsDateMenuOpen(false)} className={`w-full py-2 ${activeColor.bg} text-white rounded-xl text-xs font-bold`}>Aplicar</button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    <button onClick={() => handleNavigate(1)} disabled={dateMode === 'range'} className={`p-3 rounded-xl transition-colors ${t.hover} disabled:opacity-30`}><ChevronRight size={20} /></button>
                </div>

            </div>
            {/* ALERTAS CRÍTICAS DE PRESUPUESTO */}
            {(() => {
                const byCat = {};
                filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
                    byCat[t.category] = (byCat[t.category] || 0) + t.amountVal;
                });
                const alerts = Object.entries(budgets)
                    .filter(([cat, limit]) => limit > 0 && byCat[cat] > (limit * 0.85))
                    .map(([cat, limit]) => ({
                        cat,
                        limit,
                        val: byCat[cat] || 0,
                        percent: ((byCat[cat] || 0) / limit) * 100
                    }));
                
                if (alerts.length === 0) return null;

                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-top-4 duration-500">
                        {alerts.map(alert => (
                            <div key={alert.cat} className={`p-4 rounded-3xl border ${alert.percent >= 100 ? 'bg-red-500/10 border-red-500/20' : 'bg-orange-500/10 border-orange-500/20'} flex items-center gap-4`}>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${alert.percent >= 100 ? 'bg-red-500 text-white' : 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'}`}>
                                    {createElement(CATEGORY_ICONS[alert.cat] || Box, { size: 24 })}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-black text-sm truncate">{alert.cat}</h4>
                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${alert.percent >= 100 ? 'text-red-500' : 'text-orange-500'}`}>
                                        {alert.percent >= 100 ? '¡Límite superado!' : 'Cerca del límite'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-black">{alert.val.toFixed(0)}€</span>
                                    <p className="text-[10px] font-bold opacity-40">{alert.percent.toFixed(0)}%</p>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })()}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {[
                    { label: 'Ingresos', val: stats.income, color: 'text-green-500', icon: TrendingUp, bg: 'bg-green-500/10', trend: stats.income > stats.expense ? 'up' : 'down' },
                    { label: 'Gastos', val: stats.expense, color: 'text-red-500', icon: TrendingDown, bg: 'bg-red-500/10', trend: stats.expense > stats.income ? 'up' : 'down' },
                    { label: 'Balance', val: stats.balance + jointStats.balance, color: (stats.balance + jointStats.balance) >= 0 ? 'text-blue-500' : 'text-red-500', icon: Wallet, bg: (stats.balance + jointStats.balance) >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10' },
                    { label: 'Patrimonio', val: netWorth, color: 'text-purple-500', icon: ShieldCheck, bg: 'bg-purple-500/10' }
                ].map((kpi, i) => (
                    <div key={i} className={`p-4 md:p-8 rounded-[24px] md:rounded-[40px] border transition-all duration-500 hover:-translate-y-1 relative overflow-hidden group animate-in slide-in-from-bottom-8 delay-${i * 100} ${t.card}`}>
                        <div className="absolute top-0 right-0 p-8 md:p-12 opacity-[0.03] rotate-12 -mr-8 -mt-8 md:-mr-16 md:-mt-16 transition-transform group-hover:scale-110 duration-700">
                            <kpi.icon size={120} className="md:size-[180px]" />
                        </div>
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4 md:mb-6">
                                <div className={`p-2 md:p-4 rounded-xl md:rounded-2xl ${kpi.bg}`}>
                                    <kpi.icon size={18} className={`${kpi.color} md:size-[24px]`} strokeWidth={2.5} />
                                </div>
                            </div>
                            
                            <p className={`text-[8px] md:text-[10px] uppercase font-black tracking-widest md:tracking-[0.2em] mb-1 opacity-40 truncate`}>{kpi.label}</p>
                            <h3 className={`text-lg md:text-3xl font-black tracking-tighter text-gradient truncate`}>
                                {privacyMode ? '••••' : `${kpi.val.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}€`}
                            </h3>
                        </div>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className={`p-8 rounded-[32px] border ${t.card}`}>
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-lg font-bold">Comparativa {selectedChartYear}</h3>
                        <div className="flex gap-2">
                            <button onClick={() => setSelectedChartYear(y => y - 1)}><ChevronLeft /></button>
                            <span>{selectedChartYear}</span>
                            <button onClick={() => setSelectedChartYear(y => y + 1)}><ChevronRight /></button>
                        </div>
                    </div>
                    <div className="h-[200px] flex justify-around gap-2 items-end relative">
                        {chartData.map((d, i) => {
                            const max = Math.max(...chartData.map(x => Math.max(x.income, x.expense)), 1);
                            return (
                                <div
                                    key={i}
                                    className="flex-1 flex flex-col items-center gap-1 h-full justify-end group cursor-pointer relative"
                                    onMouseEnter={() => setHoveredMonth(i)}
                                    onMouseLeave={() => setHoveredMonth(null)}
                                >
                                    {hoveredMonth === i && (
                                        <div className={`absolute -top-16 left-1/2 -translate-x-1/2 z-50 p-2 rounded-lg border shadow-xl ${t.card} min-w-[100px] text-center pointer-events-none animate-in fade-in zoom-in-95 duration-200`}>
                                            <p className="text-[10px] font-black uppercase mb-1">{d.label}</p>
                                            <div className="flex justify-between gap-2 items-center mb-0.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                                <span className="text-[10px] font-bold text-green-500">+{(d.income || 0).toFixed(0)}€</span>
                                            </div>
                                            <div className="flex justify-between gap-2 items-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                                <span className="text-[10px] font-bold text-red-500">-{(d.expense || 0).toFixed(0)}€</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="w-full flex justify-center items-end gap-0.5 h-full relative">
                                        <div className={`w-1/2 rounded-t-sm transition-all duration-700 min-h-[2px] ${theme === 'dark' ? 'bg-[#30D158]' : 'bg-green-500'} ${hoveredMonth === i ? 'brightness-125 scale-x-110' : ''}`} style={{ height: `${(d.income / max) * 100}%` }} />
                                        <div className={`w-1/2 rounded-t-sm transition-all duration-700 min-h-[2px] ${theme === 'dark' ? 'bg-[#FF453A]' : 'bg-red-500'} ${hoveredMonth === i ? 'brightness-125 scale-x-110' : ''}`} style={{ height: `${(d.expense / max) * 100}%` }} />
                                    </div>
                                    <span className={`text-[9px] font-bold ${t.textSec} ${hoveredMonth === i ? 'text-white' : ''}`}>{d.label.charAt(0)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* SALUD FINANCIERA */}
                <div className={`p-8 rounded-[32px] border ${t.card} flex flex-col justify-between`}>
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2"> Salud Financiera</h3>
                    <div className="grid grid-cols-2 gap-6 flex-1 items-center">
                        <div className="text-center space-y-4">
                            <div className="relative inline-flex items-center justify-center">
                                <svg className="w-32 h-32 transform -rotate-90">
                                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-500/10" />
                                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364} strokeDashoffset={364 - (364 * Math.max(0, Math.min(100, savingsRate))) / 100} className={`transition-all duration-1000 ${savingsRate > 20 ? 'text-green-500' : 'text-yellow-500'}`} />
                                </svg>
                                <span className="absolute text-xl font-black">{(savingsRate || 0).toFixed(0)}%</span>
                            </div>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>Tasa de Ahorro</p>
                        </div>
                        <div className="space-y-6">
                            <div className="p-4 rounded-[24px] bg-blue-600/10 border border-blue-600/20">
                                <p className={`text-[10px] font-black uppercase tracking-widest text-blue-500`}>Colchón de Seguridad</p>
                                <div className={`flex items-end gap-2 mt-1 ${privacyMode ? 'privacy-blur' : ''}`}>
                                    <span className="text-3xl font-black">{emergencyFundMonths.toFixed(1)}</span>
                                    <span className="text-sm font-bold opacity-60 mb-1">meses</span>
                                </div>
                                <p className={`text-[10px] font-medium mt-2 leading-tight ${t.textSec}`}>Tiempo que podrías vivir con tus ahorros manteniendo tu nivel de vida.</p>
                            </div>
                            <div className={`p-4 rounded-[24px] border border-white/5 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>Eficiencia Gasto</p>
                                <p className={`text-lg font-bold mt-1 ${privacyMode ? 'privacy-blur' : ''}`}>{(100 - (savingsRate || 0)).toFixed(0)}% <span className="text-[10px] opacity-40">de ingresos consumidos</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* PRESUPUESTOS POR CATEGORÍA */}
                <div className={`p-8 rounded-[40px] border shadow-sm relative overflow-hidden ${t.card}`}>
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-xl font-black flex items-center gap-2 tracking-tight"><Target size={22} className={activeColor.text} /> Presupuestos</h3>
                            <p className={`text-[10px] font-black uppercase tracking-widest opacity-40 mt-1`}>Control de gasto mensual</p>
                        </div>
                        <button 
                            onClick={() => setIsBudgetModalOpen(true)} 
                            className={`group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-2xl border border-white/10 ${t.hover} transition-all active:scale-95`}
                        >
                            Configurar <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </button>
                    </div>

                    <div className="space-y-7">
                        {(() => {
                            const byCat = {};
                            filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
                                byCat[t.category] = (byCat[t.category] || 0) + t.amountVal;
                            });

                            const totalBudget = Object.values(budgets).reduce((a, b) => a + (b || 0), 0);
                            const totalSpentInBudgeted = Object.entries(budgets)
                                .filter(([, limit]) => limit > 0)
                                .reduce((acc, [cat,]) => acc + (byCat[cat] || 0), 0);
                            
                            const globalPercent = totalBudget > 0 ? (totalSpentInBudgeted / totalBudget) * 100 : 0;

                            return (
                                <>
                                    {/* BARRA GLOBAL */}
                                    {totalBudget > 0 && (
                                        <div className={`p-6 rounded-3xl mb-8 border border-white/5 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60 text-blue-500">Gasto Total Presupuestado</span>
                                                <span className="text-sm font-black">{totalSpentInBudgeted.toFixed(0)}€ <span className="opacity-30">/ {totalBudget.toFixed(0)}€</span></span>
                                            </div>
                                            <div className={`w-full h-3 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-200'} relative`}>
                                                <div 
                                                    className={`h-full transition-all duration-1000 ease-out flex items-center justify-end px-2 ${globalPercent > 100 ? 'bg-red-500' : globalPercent > 85 ? 'bg-orange-500' : 'bg-gradient-to-r from-blue-600 to-blue-400'}`} 
                                                    style={{ width: `${Math.min(100, globalPercent)}%` }}
                                                >
                                                    {globalPercent > 15 && <div className="w-1 h-1 rounded-full bg-white animate-pulse" />}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {Object.entries(budgets)
                                        .filter(([, limit]) => limit > 0)
                                        .sort(([catA, limitA], [catB, limitB]) => {
                                            const spentA = byCat[catA] || 0;
                                            const spentB = byCat[catB] || 0;
                                            return (spentB / limitB) - (spentA / limitA);
                                        })
                                        .slice(0, 4)
                                        .map(([cat, budget]) => {
                                            const val = byCat[cat] || 0;
                                            const percent = budget > 0 ? (val / budget) * 100 : 0;
                                            const Icon = CATEGORY_ICONS[cat] || Box;
                                            const color = CATEGORY_COLORS[cat] || '#8E8E93';
                                            
                                            return (
                                                <div key={cat} className="space-y-3 group/item">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/5 transition-transform group-hover/item:scale-110" style={{ color: color }}>
                                                                <Icon size={20} />
                                                            </div>
                                                            <div>
                                                                <span className="text-sm font-bold tracking-tight">{cat}</span>
                                                                <p className="text-[9px] font-black uppercase opacity-30 mt-0.5 tracking-tighter">
                                                                    {percent > 100 ? 'Límite excedido' : `${(budget - val).toFixed(0)}€ disponibles`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="flex items-baseline justify-end gap-1">
                                                                <span className={`text-sm font-black ${percent > 100 ? 'text-red-500' : ''}`}>{val.toFixed(0)}€</span>
                                                                <span className={`text-[10px] font-bold opacity-30`}>/ {budget}€</span>
                                                            </div>
                                                            <div className={`text-[10px] font-black ${percent > 100 ? 'text-red-500' : percent > 85 ? 'text-orange-500' : 'text-blue-500'}`}>
                                                                {percent.toFixed(0)}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className={`w-full h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                                                        <div 
                                                            className={`h-full transition-all duration-1000 ease-in-out ${percent > 100 ? 'bg-red-500' : percent > 85 ? 'bg-orange-500' : 'bg-blue-500'}`} 
                                                            style={{ width: `${Math.min(100, percent)}%` }} 
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    
                                    {Object.entries(budgets).filter(([, limit]) => limit > 0).length === 0 && (
                                        <div className="text-center py-10 opacity-30 italic text-sm">Configura tus primeros presupuestos para empezar el control.</div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DashboardView;
