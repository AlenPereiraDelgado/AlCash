import { useRef, useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MagicInput from '../common/MagicInput';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import {
    Layers, Calendar as CalendarIcon, ChevronLeft, ChevronRight,
    TrendingUp, TrendingDown, Wallet, ShieldCheck,
    Box, Globe, PieChart as PieIcon, Repeat, Sparkles, Plus, Minus, Trash2,
    Award, Link2, BarChart3, Target
} from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../constants/theme';
import { parseLocalDate, resolveCategoryColor } from '../../utils/helpers';

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
    const {
        transactions, categoryColors, recurringRules,
        savingsWidgets, addSavingsWidget, deleteSavingsWidget,
        adjustSavingsWidget, reopenSavingsWidget,
        dashboardWidgets,
    } = useFinance();
    const getCatColor = (cat) => resolveCategoryColor(cat, categoryColors, CATEGORY_COLORS);
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

    // --- Histórico para tarjeta de medias ---
    const historicalAverages = useMemo(() => {
        if (!transactions.length) return { days: 0, dailyExpense: 0, dailyIncome: 0, monthlyExpense: 0, monthlyIncome: 0 };
        const dates = transactions.map(t => parseLocalDate(t.date)).filter(d => !isNaN(d));
        if (!dates.length) return { days: 0, dailyExpense: 0, dailyIncome: 0, monthlyExpense: 0, monthlyIncome: 0 };
        const min = new Date(Math.min(...dates));
        const max = new Date(Math.max(...dates));
        const days = Math.max(1, Math.round((max - min) / 86400000) + 1);
        const totalExpense = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + (b.amountVal || 0), 0);
        const totalIncome = transactions.filter(t => t.type === 'income').reduce((a, b) => a + (b.amountVal || 0), 0);
        const monthsSet = new Set(transactions.map(t => (t.date || '').slice(0, 7)).filter(Boolean));
        const months = Math.max(1, monthsSet.size);
        return {
            days,
            dailyExpense: totalExpense / days,
            dailyIncome: totalIncome / days,
            monthlyExpense: totalExpense / months,
            monthlyIncome: totalIncome / months,
            netDaily: (totalIncome - totalExpense) / days,
        };
    }, [transactions]);

    // --- Datos para vista "stacked-by-category" del comparativo ---
    const chartCategoryData = useMemo(() => {
        const result = [];
        for (let m = 0; m < 12; m++) {
            const incCat = {};
            const expCat = {};
            transactions.forEach(tx => {
                const d = parseLocalDate(tx.date);
                if (d.getFullYear() !== selectedChartYear || d.getMonth() !== m) return;
                const k = tx.category || 'Otros';
                if (tx.type === 'income') incCat[k] = (incCat[k] || 0) + (tx.amountVal || 0);
                else if (tx.type === 'expense') expCat[k] = (expCat[k] || 0) + (tx.amountVal || 0);
            });
            const incomeTotal = Object.values(incCat).reduce((a, b) => a + b, 0);
            const expenseTotal = Object.values(expCat).reduce((a, b) => a + b, 0);
            const incomeBreak = Object.entries(incCat).map(([cat, val]) => ({ cat, val })).sort((a, b) => b.val - a.val);
            const expenseBreak = Object.entries(expCat).map(([cat, val]) => ({ cat, val })).sort((a, b) => b.val - a.val);
            result.push({ income: incomeTotal, expense: expenseTotal, incomeBreak, expenseBreak });
        }
        return result;
    }, [transactions, selectedChartYear]);

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
                <ComparativaCard
                    chartData={chartData}
                    chartCategoryData={chartCategoryData}
                    hoveredMonth={hoveredMonth}
                    setHoveredMonth={setHoveredMonth}
                    selectedChartYear={selectedChartYear}
                    setSelectedChartYear={setSelectedChartYear}
                    theme={theme}
                    t={t}
                    getCatColor={getCatColor}
                />

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

            <HistoricalAverageCard avg={historicalAverages} t={t} theme={theme} privacyMode={privacyMode} activeColor={activeColor} />

            <PiePanel
                pieMonth={pieMonth}
                setPieMonth={setPieMonth}
                pieYear={pieYear}
                setPieYear={setPieYear}
                pieMonthData={pieMonthData}
                pieYearData={pieYearData}
                transactions={transactions}
                theme={theme}
                t={t}
                activeColor={activeColor}
                getCatColor={getCatColor}
            />

            {dashboardWidgets?.fixedInfo && (
                <FixedInfoWidget recurringRules={recurringRules} t={t} theme={theme} activeColor={activeColor} privacyMode={privacyMode} />
            )}

            {dashboardWidgets?.nextExpense && (
                <NextExpenseWidget recurringRules={recurringRules} transactions={transactions} t={t} theme={theme} activeColor={activeColor} privacyMode={privacyMode} getCatColor={getCatColor} />
            )}

            {dashboardWidgets?.savings && (
                <SavingsWidget
                    items={savingsWidgets || []}
                    rules={recurringRules || []}
                    transactions={transactions}
                    onAdd={addSavingsWidget}
                    onDelete={deleteSavingsWidget}
                    onAdjust={adjustSavingsWidget}
                    onReopen={reopenSavingsWidget}
                    t={t}
                    theme={theme}
                    activeColor={activeColor}
                    privacyMode={privacyMode}
                />
            )}
        </div>
    );
};

const hexToHsl = (hex) => {
    const h = (hex || '#8E8E93').replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let H = 0, S = 0;
    const L = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        S = L > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) H = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) H = (b - r) / d + 2;
        else H = (r - g) / d + 4;
        H *= 60;
    }
    return [H, S * 100, L * 100];
};

const tintColor = (base, idx, n) => {
    if (n <= 1) return base || '#8E8E93';
    const [h, s] = hexToHsl(base);
    const t = idx / (n - 1);
    const newL = 32 + t * 46;
    const newH = (h + (t - 0.5) * 32 + 360) % 360;
    const newS = Math.max(45, s * 0.9);
    return `hsl(${newH.toFixed(1)}, ${newS.toFixed(1)}%, ${newL.toFixed(1)}%)`;
};

const buildSlices = (data, total, radius, cx, cy, colorOverride) => {
    let cumulative = 0;
    const n = data.length;
    const innerR = radius * 0.55;
    const r3 = radius * radius * radius;
    const ir3 = innerR * innerR * innerR;
    const r2 = radius * radius;
    const ir2 = innerR * innerR;
    return data.map((d, i) => {
        const start = cumulative / (total || 1);
        cumulative += d.val;
        const end = cumulative / (total || 1);
        const mid = (start + end) / 2;
        const a0 = start * Math.PI * 2 - Math.PI / 2;
        const a1 = end * Math.PI * 2 - Math.PI / 2;
        const aMid = mid * Math.PI * 2 - Math.PI / 2;
        const x0 = cx + radius * Math.cos(a0);
        const y0 = cy + radius * Math.sin(a0);
        const x1 = cx + radius * Math.cos(a1);
        const y1 = cy + radius * Math.sin(a1);
        const large = end - start > 0.5 ? 1 : 0;
        const path = data.length === 1
            ? `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy} Z`
            : `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1} Z`;
        const halfAng = (end - start) * Math.PI;
        const sincVal = halfAng < 1e-6 ? 1 : Math.sin(halfAng) / halfAng;
        const centroidR = (2 / 3) * (r3 - ir3) / (r2 - ir2) * sincVal;
        return {
            ...d,
            path,
            mx: Math.cos(aMid),
            my: Math.sin(aMid),
            centroidR,
            color: colorOverride ? colorOverride(d, i, n) : (CATEGORY_COLORS[d.cat] || '#8E8E93'),
            percent: total > 0 ? (d.val / total) * 100 : 0
        };
    });
};

const Pie = ({ slices, total, size = 160, radius = 62, side, active, onSliceClick, theme, showIcons = true, label = 'Total', topLabels = 3, minLabelPercent = 8, showCenter = true }) => {
    const cx = size / 2;
    const cy = size / 2;
    const innerR = radius * 0.55;
    const labelR = (innerR + radius) / 2;
    const iconPx = size > 140 ? 9 : 0;
    const fontPx = size > 140 ? 9 : 8;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block mx-auto" style={{ overflow: 'visible' }}>
            <g>
                {slices.map(s => {
                    const isActive = side && active?.side === side && active?.cat === s.cat;
                    const dim = side && active && active.side === side && !isActive ? 0.25 : 1;
                    const tx = isActive ? s.mx * 8 : 0;
                    const ty = isActive ? s.my * 8 : 0;
                    return (
                        <path
                            key={s.cat}
                            d={s.path}
                            fill={s.color}
                            stroke={theme === 'dark' ? '#000' : '#fff'}
                            strokeWidth="2"
                            opacity={dim}
                            transform={`translate(${tx} ${ty})`}
                            style={{ transition: 'transform .35s cubic-bezier(.2,.9,.3,1.3), opacity .25s ease', cursor: onSliceClick ? 'pointer' : 'default' }}
                            onClick={onSliceClick ? () => onSliceClick(side, s.cat) : undefined}
                        >
                            <title>{s.cat}: {s.val.toFixed(2)}€ ({s.percent.toFixed(1)}%)</title>
                        </path>
                    );
                })}
            </g>
            {slices.slice(0, topLabels).filter(s => s.percent >= minLabelPercent).map(s => {
                const isActive = side && active?.side === side && active?.cat === s.cat;
                const dim = side && active && active.side === side && !isActive ? 0.25 : 1;
                const offX = isActive ? s.mx * 8 : 0;
                const offY = isActive ? s.my * 8 : 0;
                const lx = cx + labelR * s.mx;
                const ly = cy + labelR * s.my;
                const Ic = showIcons && iconPx > 0 ? (CATEGORY_ICONS[s.cat] || Box) : null;
                const stackH = Ic ? iconPx + 1 + fontPx : fontPx;
                const iconY = Ic ? -stackH / 2 : 0;
                const textY = Ic ? -stackH / 2 + iconPx + 1 + fontPx / 2 : 0;
                return (
                    <g
                        key={`lbl-${s.cat}`}
                        transform={`translate(${lx + offX} ${ly + offY})`}
                        opacity={dim}
                        pointerEvents="none"
                        style={{
                            transition: 'transform .35s cubic-bezier(.2,.9,.3,1.3), opacity .25s ease',
                            filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.75))'
                        }}
                    >
                        {Ic && (
                            <Ic
                                width={iconPx}
                                height={iconPx}
                                x={-iconPx / 2}
                                y={iconY}
                                color="#fff"
                                strokeWidth={2.6}
                            />
                        )}
                        <text
                            x={0}
                            y={textY}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#fff"
                            fontSize={fontPx}
                            fontWeight="900"
                            style={{ letterSpacing: '-0.02em' }}
                        >
                            {s.percent.toFixed(0)}%
                        </text>
                    </g>
                );
            })}
            {showCenter && (
                <>
                    <circle cx={cx} cy={cy} r={radius * 0.55} fill={theme === 'dark' ? '#000' : '#fff'} pointerEvents="none" />
                    <text x={cx} y={cy - 2} textAnchor="middle" className="font-black" fill="currentColor" fontSize={size > 140 ? 13 : 11} pointerEvents="none">{total.toFixed(0)}€</text>
                    <text x={cx} y={cy + 11} textAnchor="middle" fill="currentColor" fontSize={size > 140 ? 8 : 7} opacity="0.5" className="font-bold uppercase tracking-wider" pointerEvents="none">{label}</text>
                </>
            )}
        </svg>
    );
};

const PieHalf = ({ heading, subtitle, data, onPrev, onNext, side, active, onSliceClick, theme, t, colorOverride }) => {
    const total = data.reduce((a, b) => a + b.val, 0);
    const slices = buildSlices(data, total, 62, 80, 80, colorOverride);
    return (
        <div className="flex flex-col gap-3">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-40 text-center">{heading}</p>
            <div className={`flex items-center justify-between gap-2 p-1 rounded-xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                <button onClick={onPrev} className={`p-1.5 rounded-lg ${t.hover}`}><ChevronLeft size={14} /></button>
                <p className="text-sm font-black tracking-tight truncate text-center flex-1">{subtitle}</p>
                <button onClick={onNext} className={`p-1.5 rounded-lg ${t.hover}`}><ChevronRight size={14} /></button>
            </div>
            {total === 0 ? (
                <div className={`h-[160px] flex items-center justify-center text-xs font-bold opacity-30 ${t.textSec}`}>Sin gastos.</div>
            ) : (
                <Pie slices={slices} total={total} size={160} radius={62} side={side} active={active} onSliceClick={onSliceClick} theme={theme} showIcons />
            )}
        </div>
    );
};

const PiePanel = ({ pieMonth, setPieMonth, pieYear, setPieYear, pieMonthData, pieYearData, transactions, theme, t, activeColor, getCatColor }) => {
    const colorOverride = (d) => getCatColor ? getCatColor(d.cat) : (CATEGORY_COLORS[d.cat] || '#8E8E93');
    const [active, setActive] = useState(null);
    const [subActive, setSubActive] = useState(null);
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [exitDir, setExitDir] = useState(0); // -1 left exit, 1 right exit, 0 idle
    const [enterDir, setEnterDir] = useState(0); // direction the new card enters from
    const dragStartX = useRef(null);

    useEffect(() => { setSubActive(null); }, [active?.side, active?.cat]);

    const sourceData = active ? (active.side === 'month' ? pieMonthData : pieYearData) : [];
    const sourceCats = sourceData.map(d => d.cat);
    const activeIndex = active ? sourceCats.indexOf(active.cat) : -1;

    const goRel = (delta) => {
        if (!active || sourceCats.length < 2) return;
        const newIdx = (activeIndex + delta + sourceCats.length) % sourceCats.length;
        // exit current to opposite of swipe direction, enter from same side as swipe
        setExitDir(delta);
        setTimeout(() => {
            setEnterDir(delta);
            setActive({ side: active.side, cat: sourceCats[newIdx] });
            setExitDir(0);
            setTimeout(() => setEnterDir(0), 320);
        }, 180);
    };

    const handleSliceClick = (side, cat) => {
        setActive(prev => prev?.side === side && prev?.cat === cat ? null : { side, cat });
    };

    const onTouchStart = (e) => {
        dragStartX.current = e.touches[0].clientX;
        setIsDragging(true);
    };
    const onTouchMove = (e) => {
        if (dragStartX.current == null) return;
        setDragX(e.touches[0].clientX - dragStartX.current);
    };
    const onTouchEnd = () => {
        const dx = dragX;
        dragStartX.current = null;
        setIsDragging(false);
        setDragX(0);
        if (Math.abs(dx) > 60) goRel(dx < 0 ? 1 : -1);
    };

    const detail = useMemo(() => {
        if (!active) return null;
        const list = transactions.filter(tx => {
            if (tx.type !== 'expense' || tx.category !== active.cat) return false;
            const d = parseLocalDate(tx.date);
            if (active.side === 'month') return d.getMonth() === pieMonth.getMonth() && d.getFullYear() === pieMonth.getFullYear();
            return d.getFullYear() === pieYear;
        });
        const total = list.reduce((a, b) => a + (b.amountVal || 0), 0);
        const srcTotal = sourceData.reduce((a, b) => a + b.val, 0);
        const percent = srcTotal > 0 ? (total / srcTotal) * 100 : 0;
        const avg = list.length > 0 ? total / list.length : 0;
        const top = [...list].sort((a, b) => (b.amountVal || 0) - (a.amountVal || 0));
        return { list, total, percent, avg, top, count: list.length };
    }, [active, transactions, pieMonth, pieYear, sourceData]);

    const color = active ? colorOverride({ cat: active.cat }) : '#8E8E93';
    const Icon = active ? (CATEGORY_ICONS[active.cat] || Box) : Box;

    const subData = useMemo(() => {
        if (!detail) return [];
        const map = {};
        detail.list.forEach(tx => {
            const k = (tx.subCategory && tx.subCategory.trim()) || (tx.note && tx.note.trim()) || '(otros)';
            map[k] = (map[k] || 0) + (tx.amountVal || 0);
        });
        return Object.entries(map).map(([cat, val]) => ({ cat, val })).sort((a, b) => b.val - a.val);
    }, [detail]);

    const subSlices = useMemo(() => {
        const tot = subData.reduce((a, b) => a + b.val, 0);
        return buildSlices(subData, tot, 56, 70, 70, (_d, i, n) => tintColor(color, i, n));
    }, [subData, color]);
    const subTotal = subData.reduce((a, b) => a + b.val, 0);

    const subActiveData = subActive ? subData.find(d => d.cat === subActive) : null;
    const subActiveIdx = subActive ? subData.findIndex(d => d.cat === subActive) : -1;
    const subActiveCount = subActive && detail ? detail.list.filter(tx => {
        const k = (tx.subCategory && tx.subCategory.trim()) || (tx.note && tx.note.trim()) || '(otros)';
        return k === subActive;
    }).length : 0;
    const subActivePercent = subActiveData && subTotal > 0 ? (subActiveData.val / subTotal) * 100 : 0;
    const subActiveColor = subActiveIdx >= 0 ? tintColor(color, subActiveIdx, subData.length) : color;
    const handleSubClick = (_side, cat) => {
        setSubActive(prev => prev === cat ? null : cat);
    };

    const topTx = detail?.top?.[0];
    const topMeta = topTx ? [topTx.subCategory, topTx.note].filter(Boolean).join(' · ') : '';

    return (
        <div className={`p-6 rounded-[32px] border ${t.card}`}>
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <PieIcon size={18} className={activeColor.text} />
                    <h3 className="text-base font-black tracking-tight">Reparto de Gastos</h3>
                </div>
                {active && (
                    <button onClick={() => setActive(null)} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${t.hover} opacity-60 hover:opacity-100 transition-opacity`}>
                        Cerrar
                    </button>
                )}
            </div>

            <div className={`grid grid-cols-2 gap-4 md:gap-8 ${theme === 'dark' ? 'divide-white/5' : 'divide-gray-100'} divide-x`}>
                <div className="pr-2 md:pr-4">
                    <PieHalf
                        heading="Mes"
                        subtitle={pieMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
                        data={pieMonthData}
                        onPrev={() => setPieMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}
                        onNext={() => setPieMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}
                        side="month"
                        active={active}
                        onSliceClick={handleSliceClick}
                        theme={theme}
                        t={t}
                        colorOverride={colorOverride}
                    />
                </div>
                <div className="pl-2 md:pl-4">
                    <PieHalf
                        heading="Año"
                        subtitle={String(pieYear)}
                        data={pieYearData}
                        onPrev={() => setPieYear(y => y - 1)}
                        onNext={() => setPieYear(y => y + 1)}
                        side="year"
                        active={active}
                        onSliceClick={handleSliceClick}
                        theme={theme}
                        t={t}
                        colorOverride={colorOverride}
                    />
                </div>
            </div>

            <div className={`grid transition-all duration-500 ease-out ${active ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                <div className="overflow-hidden">
                    {active && detail && (
                        <div className="relative">
                            <button
                                onClick={() => goRel(-1)}
                                className={`hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-9 h-9 items-center justify-center rounded-full border shadow-lg ${t.card} ${t.hover} opacity-70 hover:opacity-100 transition-opacity`}
                                aria-label="Anterior"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={() => goRel(1)}
                                className={`hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-9 h-9 items-center justify-center rounded-full border shadow-lg ${t.card} ${t.hover} opacity-70 hover:opacity-100 transition-opacity`}
                                aria-label="Siguiente"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <div
                                onTouchStart={onTouchStart}
                                onTouchMove={onTouchMove}
                                onTouchEnd={onTouchEnd}
                                style={{
                                    transform: exitDir !== 0
                                        ? `translateX(${exitDir * 110}%) rotate(${exitDir * 6}deg) scale(.92)`
                                        : `translateX(${dragX}px) rotate(${dragX * 0.04}deg) scale(${1 - Math.min(0.06, Math.abs(dragX) / 1500)})`,
                                    opacity: exitDir !== 0 ? 0 : 1 - Math.min(0.4, Math.abs(dragX) / 800),
                                    transition: isDragging ? 'none' : 'transform .35s cubic-bezier(.6,.05,.3,1), opacity .35s ease',
                                    touchAction: 'pan-y'
                                }}
                            >
                                <div
                                    key={`${active.side}-${active.cat}`}
                                    className="rounded-2xl border p-5"
                                    style={{
                                        borderColor: `${color}40`,
                                        background: `${color}10`,
                                        animation: enterDir !== 0
                                            ? `pieSlideIn .42s cubic-bezier(.2,.9,.3,1.1) both`
                                            : 'fadeIn .25s ease both',
                                        '--enter-x': `${enterDir * -100}%`,
                                        '--enter-rot': `${enterDir * -6}deg`,
                                    }}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: color, color: '#fff' }}>
                                            <Icon size={22} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-base tracking-tight truncate">{active.cat}</p>
                                            <p className={`text-[10px] font-black uppercase tracking-widest opacity-60`}>
                                                {active.side === 'month' ? pieMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' }) : pieYear}
                                                {sourceCats.length > 1 && <span className="ml-2 opacity-50">{activeIndex + 1}/{sourceCats.length}</span>}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-black" style={{ color }}>{detail.total.toFixed(0)}€</p>
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{detail.percent.toFixed(1)}% del total</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-black/30' : 'bg-white/60'}`}>
                                            <p className="text-[9px] font-black uppercase tracking-widest opacity-50">Movimientos</p>
                                            <p className="text-lg font-black">{detail.count}</p>
                                        </div>
                                        <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-black/30' : 'bg-white/60'}`}>
                                            <p className="text-[9px] font-black uppercase tracking-widest opacity-50">Media</p>
                                            <p className="text-lg font-black">{detail.avg.toFixed(0)}€</p>
                                        </div>
                                        <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-black/30' : 'bg-white/60'}`}>
                                            <p className="text-[9px] font-black uppercase tracking-widest opacity-50">Mayor</p>
                                            <p className="text-lg font-black">{(topTx?.amountVal || 0).toFixed(0)}€</p>
                                            {topMeta && <p className="text-[9px] font-bold opacity-60 truncate mt-0.5">{topMeta}</p>}
                                        </div>
                                    </div>
                                    {subTotal > 0 && (
                                        <div className={`rounded-xl p-3 ${theme === 'dark' ? 'bg-black/20' : 'bg-white/50'}`}>
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2 text-center">Por subcategoría</p>
                                            <Pie
                                                slices={subSlices}
                                                total={subTotal}
                                                size={140}
                                                radius={56}
                                                theme={theme}
                                                showIcons={false}
                                                showCenter={false}
                                                topLabels={3}
                                                minLabelPercent={6}
                                                side="sub"
                                                active={subActive ? { side: 'sub', cat: subActive } : null}
                                                onSliceClick={handleSubClick}
                                            />
                                            <div className={`grid transition-all duration-300 ease-out ${subActive ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                                                <div className="overflow-hidden">
                                                    {subActiveData && (
                                                        <div
                                                            key={subActive}
                                                            className="flex items-center justify-between gap-3 p-3 rounded-xl border animate-in fade-in zoom-in-95 duration-200"
                                                            style={{ borderColor: `${subActiveColor}55`, background: `${subActiveColor}1f` }}
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="w-3 h-3 rounded-md shrink-0" style={{ background: subActiveColor }} />
                                                                <p className="font-black text-sm truncate">{subActive}</p>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-[11px] shrink-0">
                                                                <span className="font-black" style={{ color: subActiveColor }}>{subActiveData.val.toFixed(0)}€</span>
                                                                <span className="opacity-60 font-bold">{subActiveCount} mov</span>
                                                                <span className="opacity-60 font-bold">{subActivePercent.toFixed(0)}%</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1.5 mt-3">
                                                {subData.slice(0, 6).map((s, i) => {
                                                    const isOn = subActive === s.cat;
                                                    return (
                                                        <button
                                                            key={s.cat}
                                                            type="button"
                                                            onClick={() => handleSubClick('sub', s.cat)}
                                                            className={`flex items-center gap-2 text-[10px] py-1 px-1.5 rounded-md transition-all ${isOn ? 'opacity-100 scale-[1.02]' : 'opacity-80 hover:opacity-100'}`}
                                                        >
                                                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: tintColor(color, i, subData.length) }} />
                                                            <span className="font-bold truncate flex-1 text-left">{s.cat}</span>
                                                            <span className="font-black opacity-70">{((s.val / subTotal) * 100).toFixed(0)}%</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {sourceCats.length > 1 && (
                                <div className="flex justify-center gap-1 mt-3 md:hidden">
                                    {sourceCats.map((c, i) => (
                                        <span key={c} className="w-1.5 h-1.5 rounded-full transition-all" style={{ background: i === activeIndex ? color : 'currentColor', opacity: i === activeIndex ? 1 : 0.2 }} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ===================== COMPARATIVA CARD CON SWIPE =====================
const ComparativaCard = ({ chartData, chartCategoryData, hoveredMonth, setHoveredMonth, selectedChartYear, setSelectedChartYear, theme, t, getCatColor }) => {
    const [mode, setMode] = useState(0); // 0 = simple, 1 = por categoría
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [transitioning, setTransitioning] = useState(false);
    const [transitionDir, setTransitionDir] = useState(0);
    const startX = useRef(null);
    const startY = useRef(null);
    const lockedAxis = useRef(null);
    const [selectedBar, setSelectedBar] = useState(null); // { i, kind: 'income' | 'expense' | 'both' }

    const animateTo = (delta) => {
        if (transitioning) return;
        setTransitionDir(delta);
        setTransitioning(true);
        setTimeout(() => {
            setMode(m => (m + delta + 2) % 2);
            setTransitionDir(-delta);
            setTimeout(() => { setTransitionDir(0); setTransitioning(false); }, 360);
        }, 200);
    };

    const onTouchStart = (e) => { startX.current = e.touches[0].clientX; startY.current = e.touches[0].clientY; lockedAxis.current = null; setIsDragging(true); };
    const onTouchMove = (e) => {
        if (startX.current == null) return;
        const dx = e.touches[0].clientX - startX.current;
        const dy = e.touches[0].clientY - startY.current;
        if (!lockedAxis.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            lockedAxis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        }
        if (lockedAxis.current === 'x') setDragX(dx);
    };
    const onTouchEnd = () => {
        const dx = dragX;
        startX.current = null;
        setIsDragging(false);
        setDragX(0);
        if (Math.abs(dx) > 60) animateTo(dx < 0 ? 1 : -1);
    };

    const max = Math.max(...chartData.map(x => Math.max(x.income, x.expense)), 1);

    const chosen = selectedBar;
    const detail = chosen ? chartData[chosen.i] : null;
    const detailCat = chosen ? (chartCategoryData[chosen.i] || { incomeBreak: [], expenseBreak: [] }) : null;

    const enterTransform = transitionDir !== 0 && transitioning
        ? `translateX(${transitionDir * 18}%) scale(.94)`
        : `translateX(${dragX * 0.6}px) scale(${1 - Math.min(0.04, Math.abs(dragX) / 1800)})`;
    const enterOpacity = (transitioning && transitionDir !== 0) ? 0 : 1;

    return (
        <div className={`p-8 rounded-[32px] border ${t.card} relative overflow-hidden`}>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-lg font-bold">Comparativa {selectedChartYear}</h3>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${t.textSec}`}>{mode === 0 ? 'Ingresos / Gastos' : 'Por categoría'}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedChartYear(y => y - 1)} className={`p-1.5 rounded-lg ${t.hover}`}><ChevronLeft size={16} /></button>
                    <span className="text-sm font-black">{selectedChartYear}</span>
                    <button onClick={() => setSelectedChartYear(y => y + 1)} className={`p-1.5 rounded-lg ${t.hover}`}><ChevronRight size={16} /></button>
                </div>
            </div>

            <div
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ touchAction: 'pan-y' }}
            >
                <div
                    key={mode}
                    className="h-[200px] flex justify-around gap-2 items-end relative"
                    style={{
                        transform: enterTransform,
                        opacity: enterOpacity,
                        transition: isDragging ? 'none' : 'transform .38s cubic-bezier(.6,.05,.3,1.05), opacity .25s ease',
                    }}
                >
                    {chartData.map((d, i) => {
                        const cat = chartCategoryData[i] || { incomeBreak: [], expenseBreak: [] };
                        const incH = (d.income / max) * 100;
                        const expH = (d.expense / max) * 100;
                        const isHovered = hoveredMonth === i;
                        return (
                            <div
                                key={i}
                                className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative"
                                onMouseEnter={() => setHoveredMonth(i)}
                                onMouseLeave={() => setHoveredMonth(null)}
                            >
                                {isHovered && !chosen && (
                                    <div className={`hidden md:block absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-50 p-3 rounded-xl border shadow-2xl ${t.card} min-w-[160px] pointer-events-none animate-in fade-in zoom-in-95 duration-200`}>
                                        <p className="text-[10px] font-black uppercase mb-2 text-center">{d.label}</p>
                                        <div className="flex justify-between gap-3 items-center mb-1">
                                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="text-[10px] font-black uppercase opacity-60">Ingresos</span></div>
                                            <span className="text-[10px] font-bold text-green-500">+{(d.income || 0).toFixed(0)}€</span>
                                        </div>
                                        <div className="flex justify-between gap-3 items-center">
                                            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-[10px] font-black uppercase opacity-60">Gastos</span></div>
                                            <span className="text-[10px] font-bold text-red-500">-{(d.expense || 0).toFixed(0)}€</span>
                                        </div>
                                    </div>
                                )}
                                <div className="w-full flex justify-center items-end gap-0.5 h-full relative">
                                    {/* INCOME BAR */}
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setSelectedBar(prev => prev?.i === i && prev?.kind === 'income' ? null : { i, kind: 'income' }); }}
                                        className={`w-1/2 rounded-t-md overflow-hidden flex flex-col-reverse min-h-[2px] transition-all duration-500 cursor-pointer ${isHovered || (chosen?.i === i) ? 'brightness-125 scale-x-110' : ''} ${chosen?.i === i && chosen?.kind === 'income' ? 'ring-2 ring-green-400/60' : ''}`}
                                        style={{ height: `${incH}%`, background: mode === 0 ? (theme === 'dark' ? '#30D158' : '#22C55E') : 'rgba(48,209,88,.12)' }}
                                    >
                                        {mode === 1 && cat.incomeBreak.map(b => {
                                            const pct = d.income ? (b.val / d.income) * 100 : 0;
                                            return <div key={b.cat} style={{ height: `${pct}%`, background: getCatColor(b.cat) }} />;
                                        })}
                                    </button>
                                    {/* EXPENSE BAR */}
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setSelectedBar(prev => prev?.i === i && prev?.kind === 'expense' ? null : { i, kind: 'expense' }); }}
                                        className={`w-1/2 rounded-t-md overflow-hidden flex flex-col-reverse min-h-[2px] transition-all duration-500 cursor-pointer ${isHovered || (chosen?.i === i) ? 'brightness-125 scale-x-110' : ''} ${chosen?.i === i && chosen?.kind === 'expense' ? 'ring-2 ring-red-400/60' : ''}`}
                                        style={{ height: `${expH}%`, background: mode === 0 ? (theme === 'dark' ? '#FF453A' : '#EF4444') : 'rgba(255,69,58,.12)' }}
                                    >
                                        {mode === 1 && cat.expenseBreak.map(b => {
                                            const pct = d.expense ? (b.val / d.expense) * 100 : 0;
                                            return <div key={b.cat} style={{ height: `${pct}%`, background: getCatColor(b.cat) }} />;
                                        })}
                                    </button>
                                </div>
                                <span className={`text-[9px] font-bold ${t.textSec} ${isHovered ? 'text-white' : ''}`}>{d.label.charAt(0)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Detail panel for clicked bar */}
            <div className={`grid transition-all duration-400 ease-out ${detail ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                <div className="overflow-hidden">
                    {detail && (
                        <div
                            key={`${chosen.i}-${chosen.kind}`}
                            className={`p-4 rounded-2xl border ${theme === 'dark' ? 'border-white/5 bg-white/[0.03]' : 'border-gray-200 bg-gray-50'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                        >
                            <div className="flex justify-between items-center mb-3">
                                <p className="text-[11px] font-black uppercase tracking-widest">{detail.label} · {chosen.kind === 'income' ? 'Ingresos' : 'Gastos'}</p>
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-black ${chosen.kind === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                                        {chosen.kind === 'income' ? '+' : '-'}{(detail[chosen.kind] || 0).toFixed(0)}€
                                    </span>
                                    <button onClick={() => setSelectedBar(null)} className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${t.hover} opacity-60 hover:opacity-100`}>×</button>
                                </div>
                            </div>
                            {(chosen.kind === 'income' ? detailCat.incomeBreak : detailCat.expenseBreak).length === 0 ? (
                                <p className={`text-center py-3 text-xs font-bold opacity-40 ${t.textSec}`}>Sin datos.</p>
                            ) : (
                                <div className="space-y-2">
                                    {(chosen.kind === 'income' ? detailCat.incomeBreak : detailCat.expenseBreak).map(b => {
                                        const total = chosen.kind === 'income' ? detail.income : detail.expense;
                                        const pct = total ? (b.val / total) * 100 : 0;
                                        const c = getCatColor(b.cat);
                                        return (
                                            <div key={b.cat} className="flex items-center gap-3">
                                                <span className="w-3 h-3 rounded shrink-0" style={{ background: c }} />
                                                <span className="font-bold text-sm flex-1 truncate">{b.cat}</span>
                                                <div className="flex-1 max-w-[40%] h-1.5 rounded-full overflow-hidden bg-white/5">
                                                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c }} />
                                                </div>
                                                <span className="text-xs font-black tabular-nums w-14 text-right">{b.val.toFixed(0)}€</span>
                                                <span className="text-[10px] font-black tabular-nums opacity-60 w-10 text-right">{pct.toFixed(0)}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Pager dots */}
            <div className="flex justify-center gap-2 mt-4">
                {[0, 1].map(idx => (
                    <button key={idx} onClick={() => idx !== mode && animateTo(idx > mode ? 1 : -1)} className={`h-1.5 rounded-full transition-all ${mode === idx ? `w-8 bg-current opacity-80` : 'w-1.5 bg-current opacity-20'}`} />
                ))}
            </div>
            <p className={`text-center text-[9px] font-black uppercase tracking-widest mt-2 opacity-30`}>Desliza · Toca una barra para detalle</p>
        </div>
    );
};

// ===================== HISTORICAL AVG CARD =====================
const HistoricalAverageCard = ({ avg, t, theme, privacyMode, activeColor }) => {
    const fmt = (v) => privacyMode ? '••••' : `${(v || 0).toFixed(0)}€`;
    const fmtFine = (v) => privacyMode ? '••••' : `${(v || 0).toFixed(2)}€`;
    const net = avg.netDaily || 0;
    const netPositive = net >= 0;
    const items = [
        { key: 'income',  label: 'Ingreso medio', daily: avg.dailyIncome,  monthly: avg.monthlyIncome, color: '#30D158', textCls: 'text-green-500', Icon: TrendingUp },
        { key: 'expense', label: 'Gasto medio',    daily: avg.dailyExpense, monthly: avg.monthlyExpense, color: '#FF453A', textCls: 'text-red-500',   Icon: TrendingDown },
        { key: 'net',     label: 'Balance neto',   daily: net,              monthly: (avg.monthlyIncome || 0) - (avg.monthlyExpense || 0), color: netPositive ? '#30D158' : '#FF453A', textCls: netPositive ? 'text-green-500' : 'text-red-500', Icon: Wallet },
    ];
    return (
        <div className={`p-6 md:p-8 rounded-[32px] border ${t.card}`}>
            <div className="flex items-center gap-2 mb-6">
                <BarChart3 size={18} className={activeColor.text} />
                <h3 className="text-base font-black tracking-tight">Promedios Históricos</h3>
                <span className={`ml-auto text-[10px] font-black uppercase tracking-widest opacity-40`}>{avg.days || 0} días registrados</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {items.map(it => (
                    <div
                        key={it.key}
                        className={`relative p-5 md:p-6 rounded-2xl border overflow-hidden ${theme === 'dark' ? 'bg-black/30 border-white/5' : 'bg-white border-gray-200'}`}
                    >
                        <div className="absolute -top-6 -right-6 opacity-[0.05]">
                            <it.Icon size={120} />
                        </div>
                        <div className="relative">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: it.color + '22', color: it.color }}>
                                    <it.Icon size={14} strokeWidth={2.6} />
                                </div>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${it.textCls}`}>{it.label}</p>
                            </div>
                            <div className="flex items-baseline gap-1 mb-1">
                                <span className={`text-3xl md:text-4xl font-black tracking-tighter tabular-nums ${it.textCls}`}>
                                    {fmt(it.daily)}
                                </span>
                                <span className={`text-[10px] font-black uppercase tracking-widest opacity-40`}>/ día</span>
                            </div>
                            <div className={`text-[11px] font-bold flex items-center gap-1.5 ${t.textSec}`}>
                                <span className="opacity-60">≈</span>
                                <span className="tabular-nums">{fmt(it.monthly)}</span>
                                <span className="opacity-60">/ mes</span>
                                <span className="opacity-30">·</span>
                                <span className="tabular-nums opacity-60">{fmtFine(it.daily)}/d</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ===================== FIXED INFO WIDGET =====================
const FixedInfoWidget = ({ recurringRules, t, theme, activeColor, privacyMode }) => {
    const [openCard, setOpenCard] = useState(null); // 'monthly' | 'annual' | 'total' | null

    const data = useMemo(() => {
        const active = (recurringRules || []).filter(r => r.active && r.type === 'expense');
        const monthly = active.filter(r => r.unit === 'month');
        const annualExtras = active.filter(r => r.unit !== 'month');
        const annualOf = (r) => {
            const amt = Number(r.amount || 0);
            const every = Number(r.every || 1);
            if (r.unit === 'month') return (amt * 12) / every;
            if (r.unit === 'year')  return amt / every;
            if (r.unit === 'week')  return (amt * 52) / every;
            if (r.unit === 'day')   return (amt * 365) / every;
            return 0;
        };
        const monthlySum = monthly.reduce((a, r) => a + Number(r.amount || 0), 0);
        const annualExtraSum = annualExtras.reduce((a, r) => a + annualOf(r), 0);
        return {
            monthly,
            annualExtras,
            allAnnualized: active.map(r => ({ ...r, annual: annualOf(r) })).sort((a, b) => b.annual - a.annual),
            monthlyCount: monthly.length,
            monthlySum,
            annualExtraCount: annualExtras.length,
            annualExtraSum,
            grandAnnual: monthlySum * 12 + annualExtraSum,
            list: active,
        };
    }, [recurringRules]);

    const fmt = (v) => privacyMode ? '••••' : `${(v || 0).toFixed(0)}€`;
    const unitLabel = (u) => u === 'month' ? 'mes' : u === 'year' ? 'año' : u === 'week' ? 'sem' : 'día';

    const cards = [
        { key: 'monthly', label: 'Mensual',     val: data.monthlySum,        sub: `${data.monthlyCount} reglas`,   color: 'rgba(99,102,241,.5)',  cls: theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-gray-200 bg-gray-50',           textCls: '' },
        { key: 'annual',  label: 'Extras anuales', val: data.annualExtraSum,  sub: `${data.annualExtraCount} reglas`, color: 'rgba(255,159,10,.5)', cls: theme === 'dark' ? 'border-orange-500/20 bg-orange-500/5' : 'border-orange-300/30 bg-orange-50', textCls: 'text-orange-500' },
        { key: 'total',   label: 'Total/Año',   val: data.grandAnnual,       sub: 'fijos + extras',                  color: 'rgba(10,132,255,.5)',  cls: theme === 'dark' ? 'border-blue-500/20 bg-blue-500/5' : 'border-blue-300/30 bg-blue-50',     textCls: 'text-blue-500' },
        { key: 'avg',     label: 'Promedio/Mes', val: data.grandAnnual / 12, sub: 'prorrateo',                       color: 'rgba(59,130,246,.4)', cls: 'border-blue-400/30',                                                                       textCls: 'text-blue-400', aura: true },
    ];

    const renderList = () => {
        if (openCard === 'monthly') return data.monthly;
        if (openCard === 'annual')  return data.annualExtras;
        if (openCard === 'total')   return data.allAnnualized;
        return [];
    };
    const list = renderList();

    return (
        <div className={`p-6 md:p-8 rounded-[32px] border ${t.card}`}>
            <div className="flex items-center gap-2 mb-6">
                <Repeat size={18} className={activeColor.text} />
                <h3 className="text-base font-black tracking-tight">Gastos Fijos</h3>
                <span className={`ml-auto text-[10px] font-black uppercase tracking-widest opacity-40`}>{data.list.length} reglas</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {cards.map(c => {
                    const open = openCard === c.key;
                    const clickable = c.key !== 'avg';
                    return (
                        <button
                            key={c.key}
                            type="button"
                            onClick={clickable ? () => setOpenCard(open ? null : c.key) : undefined}
                            className={`relative text-left p-4 rounded-2xl border transition-all ${c.cls} ${open ? 'ring-2 ring-current scale-[1.02]' : clickable ? 'hover:-translate-y-0.5' : ''}`}
                            style={c.aura ? { animation: 'auraGlow 2.6s ease-in-out infinite' } : undefined}
                        >
                            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${c.textCls || 'opacity-50'}`}>{c.label}</p>
                            <p className="text-xl font-black tabular-nums">{fmt(c.val)}</p>
                            <p className={`text-[10px] font-bold mt-1 opacity-50`}>{c.sub}</p>
                            {clickable && (
                                <span className="absolute top-3 right-3 text-[8px] font-black uppercase tracking-widest opacity-30">{open ? '−' : '+'}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className={`grid transition-all duration-400 ease-out ${openCard ? 'grid-rows-[1fr] opacity-100 mt-5' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                <div className="overflow-hidden">
                    {openCard && (
                        <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'border-white/5 bg-black/30' : 'border-gray-200 bg-gray-50'} animate-in fade-in slide-in-from-top-2 duration-300`}>
                            <div className="flex justify-between items-center mb-3">
                                <p className="text-[11px] font-black uppercase tracking-widest opacity-70">
                                    {openCard === 'monthly' && 'Reglas mensuales'}
                                    {openCard === 'annual' && 'Extras anuales'}
                                    {openCard === 'total' && 'Todas anualizadas'}
                                </p>
                                <span className={`text-xs font-black tabular-nums ${t.textSec}`}>{list.length} {list.length === 1 ? 'regla' : 'reglas'}</span>
                            </div>
                            {list.length === 0 ? (
                                <p className={`text-center py-3 text-xs font-bold opacity-40 ${t.textSec}`}>Sin reglas en esta categoría.</p>
                            ) : (
                                <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                                    {list.map(r => {
                                        const Ic = CATEGORY_ICONS[r.category] || Box;
                                        const annual = r.annual ?? (
                                            r.unit === 'month' ? Number(r.amount || 0) * 12 / Number(r.every || 1)
                                            : r.unit === 'year' ? Number(r.amount || 0) / Number(r.every || 1)
                                            : r.unit === 'week' ? Number(r.amount || 0) * 52 / Number(r.every || 1)
                                            : r.unit === 'day' ? Number(r.amount || 0) * 365 / Number(r.every || 1) : 0
                                        );
                                        return (
                                            <div key={r.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-white'}`}>
                                                <Ic size={14} className="opacity-60 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-xs truncate">{r.name || r.category}</p>
                                                    <p className={`text-[10px] font-black uppercase tracking-widest opacity-40`}>cada {r.every || 1} {unitLabel(r.unit)}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-xs font-black tabular-nums">{fmt(r.amount)}</p>
                                                    {openCard === 'total' && <p className="text-[10px] font-bold opacity-50 tabular-nums">{fmt(annual)}/año</p>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ===================== NEXT EXPENSE WIDGET =====================
const NextExpenseWidget = ({ recurringRules, transactions, t, theme, activeColor, privacyMode, getCatColor }) => {
    const upcoming = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const out = [];
        // 1. Reglas activas — usa nextRun
        (recurringRules || []).filter(r => r.active && r.type === 'expense' && r.nextRun).forEach(r => {
            const d = parseLocalDate(r.nextRun);
            if (!isNaN(d)) out.push({
                key: 'rule_' + r.id,
                name: r.name || r.category,
                category: r.category,
                subCategory: r.subCategory,
                amount: Number(r.amount || 0),
                date: d,
                source: 'auto',
                unit: r.unit,
            });
        });
        // 2. Tx anuales registrados sin regla activa — proyectar al año siguiente
        const annualTx = transactions.filter(tx => tx.type === 'expense' && tx.periodicity === 'anual');
        annualTx.forEach(tx => {
            const orig = parseLocalDate(tx.date);
            if (isNaN(orig)) return;
            const proj = new Date(orig);
            proj.setFullYear(today.getFullYear());
            if (proj < today) proj.setFullYear(today.getFullYear() + 1);
            out.push({
                key: 'tx_' + tx.id,
                name: tx.note || tx.subCategory || tx.category,
                category: tx.category,
                subCategory: tx.subCategory,
                amount: tx.amountVal || 0,
                date: proj,
                source: 'annual',
                unit: 'year',
            });
        });
        out.sort((a, b) => a.date - b.date);
        return out.slice(0, 3);
    }, [recurringRules, transactions]);

    const fmt = (v) => privacyMode ? '••••' : `${(v || 0).toFixed(0)}€`;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    return (
        <div className={`p-5 md:p-6 rounded-[32px] border ${t.card}`}>
            <div className="flex items-center gap-2 mb-3">
                <CalendarIcon size={16} className={activeColor.text} />
                <h3 className="text-sm font-black tracking-tight">Próximos gastos</h3>
                <span className={`ml-auto text-[10px] font-black uppercase tracking-widest opacity-40`}>top 3</span>
            </div>
            {upcoming.length === 0 ? (
                <p className={`text-center py-4 text-xs font-bold opacity-30 ${t.textSec}`}>Sin gastos previstos.</p>
            ) : (
                <div className="space-y-1.5">
                    {upcoming.map(it => {
                        const days = Math.max(0, Math.ceil((it.date - today) / 86400000));
                        const color = getCatColor(it.category);
                        const Ic = CATEGORY_ICONS[it.category] || Box;
                        const dayLabel = days === 0 ? 'hoy' : days === 1 ? 'mañana' : `${days}d`;
                        return (
                            <div key={it.key} className={`flex items-center gap-3 p-2.5 rounded-xl ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: color }}>
                                    <Ic size={14} className="text-white" strokeWidth={2.5} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-xs truncate">{it.name}</p>
                                    <p className={`text-[9px] font-black uppercase tracking-widest opacity-50 truncate`}>
                                        {it.source === 'auto' ? 'Automático' : 'Anual'} · {it.date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-black text-sm tabular-nums">{fmt(it.amount)}</p>
                                    <p className="text-[9px] font-black uppercase tracking-widest" style={{ color }}>{dayLabel}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ===================== SAVINGS WIDGET =====================
const formatDuration = (days) => {
    if (days == null || isNaN(days)) return '';
    if (days < 0) return 'vencido';
    if (days === 0) return 'hoy';
    if (days === 1) return 'mañana';
    const years = Math.floor(days / 365);
    const remAfterYears = days - years * 365;
    const months = Math.floor(remAfterYears / 30.44);
    if (years > 0 && months > 0) return `${years}a ${months}m`;
    if (years > 0) return `${years}a`;
    if (days >= 60) return `${months}m`;
    if (days >= 30) return `${months || 1}m`;
    return `${days}d`;
};

const SavingsWidget = ({ items, rules, transactions, onAdd, onDelete, onAdjust, onReopen, t, theme, activeColor, privacyMode }) => {
    const [showForm, setShowForm] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);
    const [name, setName] = useState('');
    const [target, setTarget] = useState('');
    const [linkedRule, setLinkedRule] = useState('');
    const [dateMode, setDateModeState] = useState('none'); // 'none' | 'date' | 'duration'
    const [targetDate, setTargetDate] = useState('');
    const [durationN, setDurationN] = useState('');
    const [durationUnit, setDurationUnit] = useState('months'); // days|months|years
    const [expandedId, setExpandedId] = useState(null);
    const [adjustState, setAdjustState] = useState({});

    const active = items.filter(i => !i.completed_at);
    const completed = items.filter(i => i.completed_at);

    const ruleProgress = useMemo(() => {
        const map = {};
        items.forEach(it => {
            if (!it.linked_rule_id) return;
            const totalFromRule = transactions
                .filter(tx => tx.tags?.includes('__auto__') && tx.tags?.includes(`__savings_${it.id}__`))
                .reduce((a, b) => a + (b.amountVal || 0), 0);
            map[it.id] = totalFromRule;
        });
        return map;
    }, [items, transactions]);

    const fmt = (v) => privacyMode ? '••••' : `${(v || 0).toFixed(0)}€`;

    const computeTargetDate = () => {
        if (dateMode === 'date' && targetDate) return targetDate;
        if (dateMode === 'duration' && durationN) {
            const n = parseInt(durationN, 10);
            if (!n || n <= 0) return null;
            const d = new Date();
            if (durationUnit === 'days')   d.setDate(d.getDate() + n);
            if (durationUnit === 'months') d.setMonth(d.getMonth() + n);
            if (durationUnit === 'years')  d.setFullYear(d.getFullYear() + n);
            return d.toISOString().split('T')[0];
        }
        return null;
    };

    const submit = (e) => {
        e.preventDefault();
        if (!name.trim() || !target) return;
        onAdd({
            name: name.trim(),
            target: parseFloat(target),
            linkedRuleId: linkedRule || null,
            targetDate: computeTargetDate(),
        });
        setName(''); setTarget(''); setLinkedRule(''); setTargetDate(''); setDurationN(''); setDateModeState('none'); setShowForm(false);
    };

    const accentHex = activeColor.text.includes('blue') ? '#0A84FF'
        : activeColor.text.includes('violet') ? '#7C3AED'
        : activeColor.text.includes('emerald') ? '#059669'
        : activeColor.text.includes('orange') ? '#EA580C'
        : activeColor.text.includes('rose') ? '#E11D48'
        : '#0A84FF';

    return (
        <div className={`p-6 md:p-8 rounded-[32px] border ${t.card}`}>
            <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <Target size={18} className={activeColor.text} />
                    <h3 className="text-base font-black tracking-tight">Ahorros & Objetivos</h3>
                </div>
                <div className="flex items-center gap-2">
                    {completed.length > 0 && (
                        <button onClick={() => setShowCompleted(true)} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${t.hover} opacity-70 hover:opacity-100 flex items-center gap-1.5`}>
                            <Award size={12} /> {completed.length}
                        </button>
                    )}
                    <button onClick={() => setShowForm(s => !s)} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${activeColor.bg} text-white flex items-center gap-1.5`}>
                        <Plus size={12} /> Nuevo
                    </button>
                </div>
            </div>

            {showForm && (
                <form onSubmit={submit} className={`p-4 mb-4 rounded-2xl border space-y-3 animate-in slide-in-from-top-2 ${theme === 'dark' ? 'bg-black/30 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="grid grid-cols-2 gap-3">
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" className={`p-3 rounded-xl text-sm font-bold ${t.input}`} />
                        <input type="number" step="0.01" value={target} onChange={e => setTarget(e.target.value)} placeholder="Importe (€)" className={`p-3 rounded-xl text-sm font-bold ${t.input}`} />
                    </div>

                    <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 opacity-60`}>Plazo (opcional)</p>
                        <div className={`flex p-1 rounded-xl border mb-2 ${theme === 'dark' ? 'bg-black/30 border-white/5' : 'bg-white border-gray-200'}`}>
                            {[
                                { v: 'none',     l: 'Sin plazo' },
                                { v: 'date',     l: 'Fecha' },
                                { v: 'duration', l: 'Duración' },
                            ].map(o => (
                                <button key={o.v} type="button" onClick={() => setDateModeState(o.v)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${dateMode === o.v ? `${activeColor.bg} text-white` : 'opacity-60'}`}>{o.l}</button>
                            ))}
                        </div>
                        {dateMode === 'date' && (
                            <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className={`w-full p-3 rounded-xl text-sm font-bold ${t.input}`} />
                        )}
                        {dateMode === 'duration' && (
                            <div className="grid grid-cols-2 gap-2">
                                <input type="number" min="1" value={durationN} onChange={e => setDurationN(e.target.value)} placeholder="Cantidad" className={`p-3 rounded-xl text-sm font-bold ${t.input}`} />
                                <select value={durationUnit} onChange={e => setDurationUnit(e.target.value)} className={`p-3 rounded-xl text-sm font-bold ${t.input}`}>
                                    <option value="days">Días</option>
                                    <option value="months">Meses</option>
                                    <option value="years">Años</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {rules.filter(r => r.active && r.type === 'expense').length > 0 && (
                        <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 opacity-60 flex items-center gap-1`}><Link2 size={10} /> Vincular automatización (opcional)</p>
                            <select value={linkedRule} onChange={e => setLinkedRule(e.target.value)} className={`w-full p-3 rounded-xl text-sm font-bold ${t.input}`}>
                                <option value="">Sin vincular</option>
                                {rules.filter(r => r.active && r.type === 'expense').map(r => (
                                    <option key={r.id} value={r.id}>{r.name || r.category} · {r.amount}€/{r.unit}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setShowForm(false)} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest ${t.hover}`}>Cancelar</button>
                        <button type="submit" className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest ${activeColor.bg} text-white`}>Crear</button>
                    </div>
                </form>
            )}

            {active.length === 0 ? (
                <p className={`text-center py-8 text-sm font-bold opacity-30 ${t.textSec}`}>Sin objetivos activos.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {active.map(it => {
                        const ruleAmt = ruleProgress[it.id] || 0;
                        const total = Number(it.current || 0) + ruleAmt;
                        const pct = it.target > 0 ? Math.min(100, (total / it.target) * 100) : 0;
                        const linkedRuleObj = rules.find(r => r.id === it.linked_rule_id);
                        const adj = adjustState[it.id] ?? '';
                        const isOpen = expandedId === it.id;
                        const targetDateObj = it.target_date ? parseLocalDate(it.target_date) : null;
                        const daysLeft = targetDateObj ? Math.ceil((targetDateObj - new Date()) / 86400000) : null;
                        return (
                            <div
                                key={it.id}
                                onClick={() => setExpandedId(prev => prev === it.id ? null : it.id)}
                                className={`p-5 rounded-2xl border cursor-pointer transition-all duration-300 ${isOpen ? `${activeColor.border} shadow-lg scale-[1.01]` : theme === 'dark' ? 'border-white/5 bg-white/[0.03] hover:border-white/10' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
                            >
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-black text-base tracking-tight truncate">{it.name}</p>
                                        <p className={`text-[10px] font-black uppercase tracking-widest opacity-50 truncate flex items-center gap-1.5 flex-wrap`}>
                                            <span>Meta {fmt(it.target)}</span>
                                            {targetDateObj && (
                                                <span className={`px-1.5 py-0.5 rounded ${daysLeft != null && daysLeft < 0 ? 'bg-red-500/15 text-red-500' : daysLeft != null && daysLeft <= 30 ? 'bg-yellow-500/15 text-yellow-500' : 'bg-blue-500/15 text-blue-400'}`}>
                                                    {formatDuration(daysLeft)}
                                                </span>
                                            )}
                                            {linkedRuleObj && (<><span>·</span><Link2 size={9} className="inline -mt-0.5" /><span className="truncate">{linkedRuleObj.name || linkedRuleObj.category}</span></>)}
                                        </p>
                                    </div>
                                </div>

                                {/* Animated progress bar */}
                                <div className="relative">
                                    <div className={`h-4 w-full rounded-full overflow-hidden relative ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-200'}`}>
                                        <div
                                            className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
                                            style={{
                                                width: `${pct}%`,
                                                background: `linear-gradient(90deg, ${accentHex}, #30D158)`,
                                                boxShadow: pct > 0 ? `0 0 18px ${accentHex}55` : 'none',
                                            }}
                                        >
                                            {/* Flowing diagonal stripes */}
                                            <div
                                                className="absolute inset-0 opacity-50"
                                                style={{
                                                    backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,.18) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.18) 50%, rgba(255,255,255,.18) 75%, transparent 75%, transparent)',
                                                    backgroundSize: '14px 14px',
                                                    animation: 'barFlow 1.4s linear infinite',
                                                }}
                                            />
                                            {/* Shine sweep */}
                                            <div
                                                className="absolute inset-y-0 w-1/3"
                                                style={{
                                                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent)',
                                                    animation: 'barFlow 2.4s ease-in-out infinite',
                                                }}
                                            />
                                        </div>
                                        {pct >= 100 && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-white drop-shadow"><Sparkles size={10} className="inline -mt-0.5" /> Completado</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between mt-1.5 text-[10px] font-black uppercase tracking-widest">
                                        <span className="opacity-60 tabular-nums">{fmt(total)} / {fmt(it.target)}</span>
                                        <span className={pct >= 100 ? 'text-green-500' : 'opacity-60'}>{pct.toFixed(0)}%</span>
                                    </div>
                                </div>

                                {ruleAmt > 0 && (
                                    <div className={`mt-3 p-2 rounded-lg text-[10px] font-bold flex items-center gap-1.5 ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                        <Link2 size={11} /> {fmt(ruleAmt)} desde automatización
                                    </div>
                                )}

                                {/* Expand on click */}
                                <div className={`grid transition-all duration-400 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                                    <div className="overflow-hidden">
                                        <div onClick={(e) => e.stopPropagation()} className="flex gap-2">
                                            <input type="number" step="0.01" value={adj} onChange={e => setAdjustState(s => ({ ...s, [it.id]: e.target.value }))} placeholder="Cantidad" className={`flex-1 p-2 rounded-lg text-xs font-bold ${t.input}`} />
                                            <button onClick={() => { const v = parseFloat(adj); if (v > 0) { onAdjust(it.id, v); setAdjustState(s => ({ ...s, [it.id]: '' })); } }} className="p-2 rounded-lg bg-green-500 text-white" title="Sumar"><Plus size={14} /></button>
                                            <button onClick={() => { const v = parseFloat(adj); if (v > 0) { onAdjust(it.id, -v); setAdjustState(s => ({ ...s, [it.id]: '' })); } }} className="p-2 rounded-lg bg-red-500 text-white" title="Restar"><Minus size={14} /></button>
                                            <button onClick={() => { if (confirm(`¿Borrar objetivo "${it.name}"?`)) onDelete(it.id); }} className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 border border-red-500/30" title="Eliminar"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showCompleted && (
                <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowCompleted(false)}>
                    <div className={`w-full max-w-lg rounded-t-[32px] md:rounded-[32px] border shadow-2xl ${t.card} ${t.bg}`} onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-base font-black tracking-tight flex items-center gap-2"><Award size={16} className={activeColor.text} /> Objetivos cumplidos</h3>
                            <button onClick={() => setShowCompleted(false)} className={`p-2 rounded-xl ${t.hover}`}>×</button>
                        </div>
                        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                            {completed.length === 0 && <p className={`text-center py-8 text-sm font-bold opacity-30 ${t.textSec}`}>Aún no hay completados.</p>}
                            {completed.map(it => {
                                const created = new Date(it.created_at);
                                const closed = new Date(it.completed_at);
                                const days = Math.max(1, Math.round((closed - created) / 86400000));
                                return (
                                    <div key={it.id} className={`p-4 rounded-2xl border flex items-center gap-3 ${theme === 'dark' ? 'border-white/5 bg-white/[0.03]' : 'border-gray-200 bg-gray-50'}`}>
                                        <div className="w-10 h-10 rounded-xl bg-green-500/15 text-green-500 flex items-center justify-center"><Award size={18} /></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-sm truncate">{it.name}</p>
                                            <p className={`text-[10px] font-black uppercase tracking-widest opacity-50`}>{fmt(it.target)} · {days} {days === 1 ? 'día' : 'días'}</p>
                                        </div>
                                        <button onClick={() => onReopen(it.id)} title="Reabrir" className={`p-2 rounded-lg text-blue-500 ${t.hover}`}><Plus size={14} /></button>
                                        <button onClick={() => onDelete(it.id)} title="Borrar" className="p-2 rounded-lg text-red-500 hover:bg-red-500/10"><Trash2 size={14} /></button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardView;
