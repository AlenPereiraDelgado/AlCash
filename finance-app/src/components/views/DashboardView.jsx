import React, { createElement, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import MagicInput from '../common/MagicInput';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import {
    Layers, Calendar as CalendarIcon, ChevronLeft, ChevronRight,
    TrendingUp, TrendingDown, Wallet, ShieldCheck,
    Box, Globe, PieChart as PieIcon
} from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../constants/theme';
import { getDynamicFontSize, parseLocalDate } from '../../utils/helpers';

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
    selectedChartYear,
    setSelectedChartYear,
    onMagicParse,
    isMagicLoading,
    onImport
}) => {
    const { theme, t, activeColor, privacyMode } = useAuth();
    const { transactions } = useFinance();
    const swipeStartY = useRef(null);
    const [pieMonth, setPieMonth] = useState(() => new Date());
    const [pieYear, setPieYear] = useState(() => new Date().getFullYear());

    const pieMonthData = useMemo(() => {
        const m = pieMonth.getMonth();
        const y = pieMonth.getFullYear();
        const byCat = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
            const d = parseLocalDate(t.date);
            if (d.getMonth() === m && d.getFullYear() === y) {
                byCat[t.category] = (byCat[t.category] || 0) + (t.amountVal || 0);
            }
        });
        return Object.entries(byCat).map(([cat, val]) => ({ cat, val })).sort((a, b) => b.val - a.val);
    }, [transactions, pieMonth]);

    const pieYearData = useMemo(() => {
        const byCat = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
            const d = parseLocalDate(t.date);
            if (d.getFullYear() === pieYear) {
                byCat[t.category] = (byCat[t.category] || 0) + (t.amountVal || 0);
            }
        });
        return Object.entries(byCat).map(([cat, val]) => ({ cat, val })).sort((a, b) => b.val - a.val);
    }, [transactions, pieYear]);
    return (
        <div className="space-y-8 animate-in fade-in">
            {/* Controles de Fecha en Dashboard */}
            <div className={`p-4 md:p-6 rounded-[32px] border flex flex-col xl:flex-row justify-between items-center gap-6 ${t.card}`}>
                <div className="w-full xl:max-w-xl">
                    <MagicInput
                        onParse={onMagicParse}
                        isLoading={isMagicLoading}
                        trailing={onImport ? (
                            <button
                                type="button"
                                onClick={onImport}
                                title="Importar"
                                className={`p-2 sm:p-2.5 rounded-2xl transition-all active:scale-95 shrink-0 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/15' : 'bg-gray-100 hover:bg-gray-200'}`}
                            >
                                <Globe size={16} className="text-blue-500 sm:hidden" />
                                <Globe size={18} className="text-blue-500 hidden sm:block" />
                            </button>
                        ) : null}
                    />
                </div>

                <div className={`p-1 rounded-2xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'} flex items-center`}>
                    <button onClick={() => handleNavigate(-1)} disabled={dateMode === 'range'} className={`p-3 rounded-xl transition-colors ${t.hover} disabled:opacity-30`}><ChevronLeft size={20} /></button>
                    <div className="relative px-2">
                        <button onClick={() => setIsDateMenuOpen(!isDateMenuOpen)} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${t.hover}`}>
                            {dateMode === 'range' ? <Layers size={18} className="text-purple-500" /> : <CalendarIcon size={18} className={activeColor.text} />}
                            <span className="font-black uppercase tracking-widest text-sm">{getDateLabel()}</span>
                        </button>
                        {isDateMenuOpen && createPortal(
                            <>
                                {/* Backdrop */}
                                <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm" onClick={() => setIsDateMenuOpen(false)} />

                                {/* Mobile: bottom sheet / Desktop: floating card */}
                                <div
                                    className={`
                                        fixed z-[200]
                                        bottom-0 left-0 right-0 rounded-t-[32px]
                                        md:bottom-auto md:left-auto md:right-auto
                                        md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
                                        md:rounded-[24px] md:w-72
                                        p-6 shadow-2xl border animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-200
                                        ${t.card}
                                    `}
                                    onTouchStart={e => { swipeStartY.current = e.touches[0].clientY; }}
                                    onTouchEnd={e => { if (swipeStartY.current !== null && e.changedTouches[0].clientY - swipeStartY.current > 60) setIsDateMenuOpen(false); swipeStartY.current = null; }}
                                >
                                    {/* Handle bar (mobile) */}
                                    <div className="md:hidden w-10 h-1 rounded-full bg-white/20 mx-auto mb-6" />

                                    <p className={`text-[10px] font-black uppercase tracking-widest mb-4 ${t.textSec}`}>Período de tiempo</p>

                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        {[
                                            { val: 'day', label: 'Día' },
                                            { val: 'month', label: 'Mes' },
                                            { val: 'year', label: 'Año' },
                                            { val: 'range', label: 'Rango' },
                                        ].map(m => (
                                            <button
                                                key={m.val}
                                                onClick={() => { setDateMode(m.val); if (m.val !== 'range') setIsDateMenuOpen(false); }}
                                                className={`py-3 text-sm font-black rounded-2xl uppercase transition-all active:scale-95 ${dateMode === m.val ? `${activeColor.bg} text-white shadow-lg` : `${t.hover} ${t.textSec} border border-white/5`}`}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>

                                    {dateMode === 'range' && (
                                        <div className="space-y-3 pt-4 border-t border-white/5">
                                            <input type="date" className={`w-full p-3 rounded-xl text-sm font-bold ${t.input}`} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
                                            <input type="date" className={`w-full p-3 rounded-xl text-sm font-bold ${t.input}`} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
                                            <button onClick={() => setIsDateMenuOpen(false)} className={`w-full py-3 ${activeColor.bg} text-white rounded-2xl text-sm font-black active:scale-95 transition-all`}>Aplicar</button>
                                        </div>
                                    )}

                                    <button onClick={() => setIsDateMenuOpen(false)} className={`mt-3 w-full py-3 rounded-2xl text-sm font-black ${t.hover} ${t.textSec} active:scale-95 transition-all`}>
                                        Cancelar
                                    </button>
                                </div>
                            </>,
                            document.body
                        )}
                    </div>
                    <button onClick={() => handleNavigate(1)} disabled={dateMode === 'range'} className={`p-3 rounded-xl transition-colors ${t.hover} disabled:opacity-30`}><ChevronRight size={20} /></button>
                </div>

            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {[
                    { label: 'Ingresos', val: stats.income, color: 'text-green-500', icon: TrendingUp, bg: 'bg-green-500/10', trend: stats.income > stats.expense ? 'up' : 'down' },
                    { label: 'Gastos', val: stats.expense, color: 'text-red-500', icon: TrendingDown, bg: 'bg-red-500/10', trend: stats.expense > stats.income ? 'up' : 'down' },
                    { label: 'Balance', val: stats.balance + jointStats.balance, color: 'text-blue-500', icon: Wallet, bg: 'bg-blue-500/10' },
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
                            <h3 className={`text-lg md:text-3xl font-black tracking-tighter truncate ${kpi.color}`}>
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
                <PieCard
                    title="Gastos del mes"
                    subtitle={pieMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
                    data={pieMonthData}
                    onPrev={() => setPieMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}
                    onNext={() => setPieMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}
                    theme={theme}
                    t={t}
                    activeColor={activeColor}
                />
                <PieCard
                    title="Gastos del año"
                    subtitle={String(pieYear)}
                    data={pieYearData}
                    onPrev={() => setPieYear(y => y - 1)}
                    onNext={() => setPieYear(y => y + 1)}
                    theme={theme}
                    t={t}
                    activeColor={activeColor}
                />
            </div>
        </div>
    );
};

const PieCard = ({ title, subtitle, data, onPrev, onNext, theme, t, activeColor }) => {
    const total = data.reduce((a, b) => a + b.val, 0);
    const radius = 70;
    const cx = 90;
    const cy = 90;
    let cumulative = 0;
    const slices = data.map(d => {
        const start = cumulative / (total || 1);
        cumulative += d.val;
        const end = cumulative / (total || 1);
        const a0 = start * Math.PI * 2 - Math.PI / 2;
        const a1 = end * Math.PI * 2 - Math.PI / 2;
        const x0 = cx + radius * Math.cos(a0);
        const y0 = cy + radius * Math.sin(a0);
        const x1 = cx + radius * Math.cos(a1);
        const y1 = cy + radius * Math.sin(a1);
        const large = end - start > 0.5 ? 1 : 0;
        const path = total === 0
            ? ''
            : data.length === 1
                ? `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy} Z`
                : `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1} Z`;
        return { ...d, path, color: CATEGORY_COLORS[d.cat] || '#8E8E93', percent: total > 0 ? (d.val / total) * 100 : 0 };
    });
    return (
        <div className={`p-6 rounded-[32px] border ${t.card}`}>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-base font-black tracking-tight">{title}</h3>
                    <p className={`text-[10px] font-black uppercase tracking-widest opacity-40 mt-0.5`}>{subtitle}</p>
                </div>
                <div className={`flex items-center p-1 rounded-xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                    <button onClick={onPrev} className={`p-2 rounded-lg ${t.hover}`}><ChevronLeft size={16} /></button>
                    <button onClick={onNext} className={`p-2 rounded-lg ${t.hover}`}><ChevronRight size={16} /></button>
                </div>
            </div>
            {total === 0 ? (
                <div className={`py-10 text-center text-xs font-bold opacity-30 ${t.textSec}`}>Sin gastos en este periodo.</div>
            ) : (
                <div className="flex flex-col sm:flex-row gap-6 items-center">
                    <svg width="180" height="180" viewBox="0 0 180 180" className="shrink-0">
                        {slices.map((s, i) => (
                            <path key={i} d={s.path} fill={s.color} stroke={theme === 'dark' ? '#000' : '#fff'} strokeWidth="2">
                                <title>{s.cat}: {s.val.toFixed(2)}€ ({s.percent.toFixed(1)}%)</title>
                            </path>
                        ))}
                        <circle cx={cx} cy={cy} r={radius * 0.55} fill={theme === 'dark' ? '#000' : '#fff'} />
                        <text x={cx} y={cy - 4} textAnchor="middle" className="font-black" fill="currentColor" fontSize="14">{total.toFixed(0)}€</text>
                        <text x={cx} y={cy + 12} textAnchor="middle" fill="currentColor" fontSize="9" opacity="0.5" className="font-bold uppercase tracking-wider">Total</text>
                    </svg>
                    <div className="flex-1 w-full space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                        {slices.map(s => {
                            const Icon = CATEGORY_ICONS[s.cat] || Box;
                            return (
                                <div key={s.cat} className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                                    <Icon size={14} style={{ color: s.color }} className="shrink-0" />
                                    <span className="text-[11px] font-bold truncate flex-1">{s.cat}</span>
                                    <span className={`text-[10px] font-black ${activeColor.text}`}>{s.percent.toFixed(0)}%</span>
                                    <span className="text-[10px] font-bold opacity-50 w-14 text-right">{s.val.toFixed(0)}€</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardView;
