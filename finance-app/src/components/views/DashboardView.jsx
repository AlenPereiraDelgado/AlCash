import { useRef, useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import MagicInput from '../common/MagicInput';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import {
    DndContext, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
    SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Layers, Calendar as CalendarIcon, CalendarDays, ChevronLeft, ChevronRight,
    TrendingUp, TrendingDown, Wallet, ShieldCheck,
    Box, Globe, PieChart as PieIcon, Repeat, Sparkles, Plus, Minus, Trash2,
    Award, Link2, BarChart3, Target, Check, Activity, Zap, Radar
} from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../constants/theme';
import { parseLocalDate, resolveCategoryColor } from '../../utils/helpers';
import { GaugeChart, RadarChart } from '../charts/FinanceCharts';

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
        dashboardWidgets, setDashboardWidgets,
    } = useFinance();
    const [editMode, setEditMode] = useState(false);
    const getCatColor = (cat) => resolveCategoryColor(cat, categoryColors, CATEGORY_COLORS);
    const swipeStartY = useRef(null);
    const [pieMonth, setPieMonth] = useState(() => new Date());
    const [pieYear, setPieYear] = useState(() => new Date().getFullYear());
    const dateBarRef = useRef(null);
    const [floatingDate, setFloatingDate] = useState(false);

    useEffect(() => {
        if (!dateBarRef.current) return;
        const obs = new IntersectionObserver(([e]) => {
            setFloatingDate(!e.isIntersecting);
        }, { threshold: 0, rootMargin: '-12px 0px 0px 0px' });
        obs.observe(dateBarRef.current);
        return () => obs.disconnect();
    }, []);

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

    // --- Stats agregadas del periodo filtrado (Proyección + Salud Gauge) ---
    const periodStats = useMemo(() => {
        const list = filteredTransactions || [];
        const income = list.filter(tx => tx.type === 'income').reduce((a, b) => a + (b.amountVal || 0), 0);
        const expense = list.filter(tx => tx.type === 'expense').reduce((a, b) => a + (b.amountVal || 0), 0);
        const uniqueDays = new Set(list.map(tx => tx.date).filter(Boolean));
        const days = Math.max(uniqueDays.size, 1);
        const avg = expense / days;
        return { income, expense, avg, days };
    }, [filteredTransactions]);

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
            <div ref={dateBarRef} className={`p-4 md:p-6 rounded-[32px] border flex flex-col xl:flex-row justify-between items-center gap-6 ${t.card}`}>
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

            {createPortal(
                <button
                    onClick={() => setIsDateMenuOpen(true)}
                    aria-label="Cambiar fecha"
                    className={`fixed top-3 right-3 md:top-4 md:right-4 z-[140] w-11 h-11 rounded-full border shadow-2xl backdrop-blur-xl flex items-center justify-center group ${theme === 'dark' ? 'bg-black/70 border-white/10' : 'bg-white/80 border-gray-200'}`}
                    style={{
                        transform: floatingDate ? 'scale(1) translateY(0) rotate(0deg)' : 'scale(0.2) translateY(-32px) rotate(-120deg)',
                        opacity: floatingDate ? 1 : 0,
                        pointerEvents: floatingDate ? 'auto' : 'none',
                        transition: 'transform 520ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 320ms ease-out',
                    }}
                >
                    <span className="absolute inset-0 rounded-full opacity-40 group-hover:opacity-70 transition-opacity" style={{ background: `radial-gradient(circle at 50% 50%, ${activeColor.hex}33 0%, transparent 70%)` }} />
                    <CalendarDays size={18} className={`relative ${activeColor.text}`} strokeWidth={2.5} />
                    <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 shadow" style={{ background: activeColor.hex, borderColor: theme === 'dark' ? '#000' : '#fff' }} />
                </button>,
                document.body
            )}
            <div className="grid grid-cols-4 gap-2 md:gap-4">
                {[
                    { label: 'Ingresos', val: stats.income, color: 'text-green-500', icon: TrendingUp, bg: 'bg-green-500/10' },
                    { label: 'Gastos', val: stats.expense, color: 'text-red-500', icon: TrendingDown, bg: 'bg-red-500/10' },
                    { label: 'Balance', val: stats.balance + jointStats.balance, color: 'text-blue-500', icon: Wallet, bg: 'bg-blue-500/10' },
                    { label: 'Patrimonio', val: netWorth, color: 'text-purple-500', icon: ShieldCheck, bg: 'bg-purple-500/10' }
                ].map((kpi, i) => {
                    const display = privacyMode ? '••••' : `${(kpi.val || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}€`;
                    const len = display.length;
                    const sizeCls = len > 10 ? 'text-[10px] md:text-base' : len > 8 ? 'text-[11px] md:text-lg' : len > 6 ? 'text-xs md:text-xl' : 'text-sm md:text-xl';
                    return (
                        <div key={i} className={`p-2 md:p-3 rounded-2xl md:rounded-[20px] border transition-all duration-500 hover:-translate-y-1 relative overflow-hidden group animate-in slide-in-from-bottom-8 delay-${i * 100} ${t.card}`}>
                            <div className="absolute top-0 right-0 p-4 md:p-8 opacity-[0.03] rotate-12 -mr-4 -mt-4 md:-mr-10 md:-mt-10 transition-transform group-hover:scale-110 duration-700">
                                <kpi.icon size={50} className="md:size-[100px]" />
                            </div>
                            <div className="relative z-10 flex flex-col items-center text-center gap-0.5">
                                <div className={`p-1 md:p-1.5 rounded-md ${kpi.bg}`}>
                                    <kpi.icon size={11} className={`${kpi.color} md:size-[14px]`} strokeWidth={2.6} />
                                </div>
                                <p className={`text-[8px] md:text-[10px] uppercase font-black tracking-wider opacity-50 whitespace-nowrap`}>{kpi.label}</p>
                                <h3 className={`font-black tracking-tighter tabular-nums whitespace-nowrap leading-none ${kpi.color} ${sizeCls}`}>{display}</h3>
                            </div>
                        </div>
                    );
                })}
            </div>
            <ReorderableWidgets
                editMode={editMode}
                setEditMode={setEditMode}
                dashboardWidgets={dashboardWidgets}
                setDashboardWidgets={setDashboardWidgets}
                widgets={{
                    comparativa: (
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
                    ),
                    salud: (
                        <div className={`p-5 md:p-6 rounded-[32px] border ${t.card}`}>
                            <h3 className="text-sm font-black tracking-tight mb-4 uppercase">Salud Financiera</h3>
                            <div className="grid grid-cols-3 gap-3 md:gap-4">
                                <div className={`p-3 rounded-2xl border flex flex-col items-center text-center gap-1 ${theme === 'dark' ? 'bg-white/[0.03] border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="relative inline-flex items-center justify-center">
                                        <svg className="w-14 h-14 transform -rotate-90">
                                            <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="5" fill="transparent" className="text-gray-500/10" />
                                            <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="5" fill="transparent" strokeDasharray={150.8} strokeDashoffset={150.8 - (150.8 * Math.max(0, Math.min(100, savingsRate))) / 100} className={`transition-all duration-1000 ${savingsRate > 20 ? 'text-green-500' : 'text-yellow-500'}`} strokeLinecap="round" />
                                        </svg>
                                        <span className="absolute text-xs font-black tabular-nums">{(savingsRate || 0).toFixed(0)}%</span>
                                    </div>
                                    <p className={`text-[9px] font-black uppercase tracking-wider opacity-60`}>Tasa Ahorro</p>
                                </div>
                                <div className="p-3 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex flex-col items-center text-center gap-1">
                                    <p className={`text-[9px] font-black uppercase tracking-wider text-blue-500 leading-tight`}>Colchón</p>
                                    <div className={`flex items-baseline gap-1 ${privacyMode ? 'privacy-blur' : ''}`}>
                                        <span className="text-xl md:text-2xl font-black tabular-nums">{emergencyFundMonths.toFixed(1)}</span>
                                        <span className="text-[10px] font-bold opacity-60">meses</span>
                                    </div>
                                    <p className={`text-[9px] font-medium leading-tight opacity-50`}>vida cubierta</p>
                                </div>
                                <div className={`p-3 rounded-2xl border flex flex-col items-center text-center gap-1 ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                                    <p className={`text-[9px] font-black uppercase tracking-wider opacity-60 leading-tight`}>Eficiencia</p>
                                    <p className={`text-xl md:text-2xl font-black tabular-nums ${privacyMode ? 'privacy-blur' : ''}`}>{(100 - (savingsRate || 0)).toFixed(0)}%</p>
                                    <p className={`text-[9px] font-medium leading-tight opacity-50`}>ingresos gastados</p>
                                </div>
                            </div>
                        </div>
                    ),
                    historical: (
                        <HistoricalAverageCard avg={historicalAverages} t={t} theme={theme} privacyMode={privacyMode} activeColor={activeColor} />
                    ),
                    pie: (
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
                    ),
                    fixedInfo: dashboardWidgets?.fixedInfo ? (
                        <FixedInfoWidget recurringRules={recurringRules} t={t} theme={theme} activeColor={activeColor} privacyMode={privacyMode} />
                    ) : null,
                    nextExpense: dashboardWidgets?.nextExpense ? (
                        <NextExpenseWidget recurringRules={recurringRules} transactions={transactions} t={t} theme={theme} activeColor={activeColor} privacyMode={privacyMode} getCatColor={getCatColor} />
                    ) : null,
                    savings: dashboardWidgets?.savings ? (
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
                    ) : null,
                    proyeccion: dashboardWidgets?.proyeccion ? (
                        <ProyeccionWidget
                            transactions={transactions}
                            t={t}
                            theme={theme}
                            activeColor={activeColor}
                            privacyMode={privacyMode}
                        />
                    ) : null,
                    saludGauge: dashboardWidgets?.saludGauge ? (
                        <div className={`p-5 md:p-6 rounded-[32px] border ${t.card}`}>
                            <h3 className="text-sm font-black tracking-tight mb-1 uppercase flex items-center gap-2"><Activity size={16} className={activeColor.text} /> Salud Financiera</h3>
                            <p className={`text-[11px] ${t.textSec} mb-2`}>Ratio de gasto sobre ingresos.</p>
                            <GaugeChart percentage={(periodStats.expense / (periodStats.income || 1)) * 100} theme={theme} />
                        </div>
                    ) : null,
                    radarHabitos: dashboardWidgets?.radarHabitos ? (
                        <RadarHabitsWidget
                            filteredTransactions={filteredTransactions}
                            transactions={transactions}
                            theme={theme}
                            t={t}
                            activeColor={activeColor}
                        />
                    ) : null,
                    lineComparativa: dashboardWidgets?.lineComparativa ? (
                        <LineComparativaCard
                            chartData={chartData}
                            chartCategoryData={chartCategoryData}
                            selectedChartYear={selectedChartYear}
                            setSelectedChartYear={setSelectedChartYear}
                            theme={theme}
                            t={t}
                            getCatColor={getCatColor}
                            activeColor={activeColor}
                        />
                    ) : null,
                }}
                activeColor={activeColor}
            />
        </div>
    );
};

const DEFAULT_ORDER = ['comparativa', 'salud', 'historical', 'pie', 'fixedInfo', 'nextExpense', 'savings', 'proyeccion', 'saludGauge', 'radarHabitos', 'lineComparativa'];

const useInViewOnce = (threshold = 0.2) => {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        if (!ref.current) return;
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } });
        }, { threshold });
        obs.observe(ref.current);
        return () => obs.disconnect();
    }, [threshold]);
    return [ref, visible];
};

const useCountUp = (target, visible, duration = 1100) => {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!visible) return;
        let raf;
        const start = performance.now();
        const tick = (now) => {
            const k = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - k, 3);
            setVal(target * eased);
            if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => { if (raf) cancelAnimationFrame(raf); };
    }, [target, visible, duration]);
    return val;
};

const SortableWidget = ({ id, editMode, children }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.85 : 1,
        touchAction: editMode ? 'none' : 'auto',
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <div className={editMode && !isDragging ? 'animate-wiggle' : ''}>
                {children}
            </div>
        </div>
    );
};

const ReorderableWidgets = ({ editMode, setEditMode, dashboardWidgets, setDashboardWidgets, widgets, activeColor }) => {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: editMode ? { distance: 5 } : { delay: 480, tolerance: 8 },
        }),
        useSensor(TouchSensor, {
            activationConstraint: editMode ? { distance: 5 } : { delay: 480, tolerance: 8 },
        }),
    );

    const draggingRef = useRef(false);
    const dragEndTimeRef = useRef(0);

    const storedOrder = Array.isArray(dashboardWidgets?._order) ? dashboardWidgets._order : DEFAULT_ORDER;
    const merged = [...storedOrder, ...DEFAULT_ORDER.filter(k => !storedOrder.includes(k))];
    const visible = merged.filter(k => widgets[k]);

    const handleDragStart = () => {
        draggingRef.current = true;
        if (!editMode) {
            if (navigator.vibrate) navigator.vibrate(50);
            setEditMode(true);
        }
    };

    const handleDragEnd = (ev) => {
        draggingRef.current = false;
        dragEndTimeRef.current = Date.now();
        const { active, over } = ev;
        if (!over || active.id === over.id) return;
        const oldIdx = visible.indexOf(active.id);
        const newIdx = visible.indexOf(over.id);
        if (oldIdx < 0 || newIdx < 0) return;
        const newVisible = arrayMove(visible, oldIdx, newIdx);
        const fullOrder = [...newVisible, ...DEFAULT_ORDER.filter(k => !newVisible.includes(k))];
        setDashboardWidgets(prev => ({ ...prev, _order: fullOrder }));
    };

    useEffect(() => {
        if (!editMode) return;
        let downX = 0, downY = 0, downT = 0, downId = -1;
        const onDown = (e) => {
            downX = e.clientX;
            downY = e.clientY;
            downT = Date.now();
            downId = e.pointerId ?? -1;
        };
        const onUp = (e) => {
            if ((e.pointerId ?? -1) !== downId) return;
            if (draggingRef.current) return;
            if (Date.now() - dragEndTimeRef.current < 200) return;
            const dx = Math.abs((e.clientX ?? 0) - downX);
            const dy = Math.abs((e.clientY ?? 0) - downY);
            const dt = Date.now() - downT;
            if (dx > 10 || dy > 10) return;
            if (dt > 600) return;
            setEditMode(false);
        };
        const armId = setTimeout(() => {
            document.addEventListener('pointerdown', onDown, true);
            document.addEventListener('pointerup', onUp, true);
        }, 150);
        return () => {
            clearTimeout(armId);
            document.removeEventListener('pointerdown', onDown, true);
            document.removeEventListener('pointerup', onUp, true);
        };
    }, [editMode, setEditMode]);

    return (
        <>
            <DndContext
                key={editMode ? 'edit' : 'view'}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={visible} strategy={verticalListSortingStrategy}>
                    <div className="space-y-6 md:space-y-8">
                        {visible.map(key => (
                            <SortableWidget key={key} id={key} editMode={editMode}>
                                {widgets[key]}
                            </SortableWidget>
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {editMode && (
                <button
                    onClick={() => setEditMode(false)}
                    className="fixed top-4 right-4 z-[60] flex items-center justify-center w-10 h-10 rounded-full text-white shadow-2xl active:scale-95 transition-all"
                    style={{ background: activeColor.hex, boxShadow: `0 10px 30px ${activeColor.hex}66` }}
                    aria-label="Listo"
                >
                    <Check size={18} strokeWidth={3} />
                </button>
            )}
        </>
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
    const panelRef = useRef(null);

    useEffect(() => { setSubActive(null); }, [active?.side, active?.cat]);

    useEffect(() => {
        if (!active) return;
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setActive(null);
                setSubActive(null);
            }
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [active]);

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
        <div ref={panelRef} className={`p-6 rounded-[32px] border ${t.card}`}>
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
    const cardRef = useRef(null);
    const [viewRef, visible] = useInViewOnce(0.2);

    useEffect(() => {
        if (!selectedBar) return;
        const handler = (e) => {
            if (cardRef.current && !cardRef.current.contains(e.target)) setSelectedBar(null);
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [selectedBar]);

    const animateTo = (delta) => {
        if (transitioning) return;
        setSelectedBar(null);
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
        <div ref={(n) => { cardRef.current = n; viewRef.current = n; }} className={`p-8 rounded-[32px] border ${t.card} relative overflow-hidden`}>
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
                                        className={`w-1/2 rounded-t-md overflow-hidden flex flex-col-reverse min-h-[2px] cursor-pointer ${isHovered || (chosen?.i === i) ? 'brightness-125 scale-x-110' : ''} ${chosen?.i === i && chosen?.kind === 'income' ? 'ring-2 ring-green-400/60' : ''}`}
                                        style={{
                                            height: `${visible ? incH : 0}%`,
                                            background: mode === 0 ? (theme === 'dark' ? '#30D158' : '#22C55E') : 'rgba(48,209,88,.12)',
                                            transition: `height .9s cubic-bezier(.2,.8,.2,1) ${i * 40}ms, transform .3s, filter .3s, background .4s`,
                                        }}
                                    >
                                        {mode === 1 && cat.incomeBreak.map(b => {
                                            const pct = d.income ? (b.val / d.income) * 100 : 0;
                                            return <div key={b.cat} style={{ height: `${pct}%`, background: getCatColor(b.cat), transition: 'height .6s ease' }} />;
                                        })}
                                    </button>
                                    {/* EXPENSE BAR */}
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setSelectedBar(prev => prev?.i === i && prev?.kind === 'expense' ? null : { i, kind: 'expense' }); }}
                                        className={`w-1/2 rounded-t-md overflow-hidden flex flex-col-reverse min-h-[2px] cursor-pointer ${isHovered || (chosen?.i === i) ? 'brightness-125 scale-x-110' : ''} ${chosen?.i === i && chosen?.kind === 'expense' ? 'ring-2 ring-red-400/60' : ''}`}
                                        style={{
                                            height: `${visible ? expH : 0}%`,
                                            background: mode === 0 ? (theme === 'dark' ? '#FF453A' : '#EF4444') : 'rgba(255,69,58,.12)',
                                            transition: `height .9s cubic-bezier(.2,.8,.2,1) ${i * 40 + 80}ms, transform .3s, filter .3s, background .4s`,
                                        }}
                                    >
                                        {mode === 1 && cat.expenseBreak.map(b => {
                                            const pct = d.expense ? (b.val / d.expense) * 100 : 0;
                                            return <div key={b.cat} style={{ height: `${pct}%`, background: getCatColor(b.cat), transition: 'height .6s ease' }} />;
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
        </div>
    );
};

// ===================== RADAR HÁBITOS WIDGET =====================
const RADAR_GROUPS = {
    "Fijos": ["Vivienda", "Suscripciones", "Hogar"],
    "Vida": ["Alimentación", "Ocio", "Salud", "Regalos"],
    "Movilidad": ["Transporte", "Viajes"],
    "Otros": ["Otros", "Compras"],
};
const RadarHabitsWidget = ({ filteredTransactions, transactions, theme, t, activeColor }) => {
    const [showAll, setShowAll] = useState(false);
    const data = useMemo(() => {
        const src = showAll ? transactions : filteredTransactions;
        const result = {};
        Object.keys(RADAR_GROUPS).forEach(group => {
            result[group] = (src || [])
                .filter(tx => tx.type === 'expense' && RADAR_GROUPS[group].includes(tx.category))
                .reduce((a, b) => a + (b.amountVal || 0), 0);
        });
        return result;
    }, [filteredTransactions, transactions, showAll]);

    return (
        <div
            onClick={() => setShowAll(s => !s)}
            role="button"
            tabIndex={0}
            className={`p-5 md:p-6 rounded-[32px] border ${t.card} cursor-pointer transition-transform active:scale-[0.99]`}
        >
            <div className="mb-4">
                <h3 className="text-sm font-black tracking-tight uppercase flex items-center gap-2"><Radar size={16} className={activeColor.text} /> {showAll ? 'Hábitos · Histórico' : 'Hábitos del Periodo'}</h3>
                <p className={`text-[11px] mt-1 ${t.textSec}`}>{showAll ? 'Toca para volver al periodo seleccionado.' : 'Toca para ver todo el histórico.'}</p>
            </div>
            <RadarChart theme={theme} data={data} accentHex={activeColor.hex} />
        </div>
    );
};

// ===================== PROYECCIÓN WIDGET =====================
const ProyeccionWidget = ({ transactions, t, theme, activeColor, privacyMode }) => {
    const ref = useRef(null);
    const [animate, setAnimate] = useState(0);
    const stats = useMemo(() => {
        const today = new Date();
        const y = today.getFullYear();
        const m = today.getMonth();
        const monthList = (transactions || []).filter(tx => {
            const d = parseLocalDate(tx.date);
            return d.getFullYear() === y && d.getMonth() === m;
        });
        const income = monthList.filter(tx => tx.type === 'income').reduce((a, b) => a + (b.amountVal || 0), 0);
        const expense = monthList.filter(tx => tx.type === 'expense').reduce((a, b) => a + (b.amountVal || 0), 0);
        const net = income - expense;
        const total = new Date(y, m + 1, 0).getDate();
        const elapsed = today.getDate();
        const avgPerUnit = expense / Math.max(elapsed, 1);
        const projected = avgPerUnit * total;
        const pace = elapsed < total ? (expense / projected) * 100 : 100;
        const remaining = Math.max(projected - expense, 0);
        const monthLabel = today.toLocaleString('es-ES', { month: 'long' });
        return { income, expense, net, avgPerUnit, projected, pace, remaining, unit: 'día', elapsed, total, monthLabel };
    }, [transactions]);

    useEffect(() => {
        if (!ref.current) return;
        let raf;
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    const begin = performance.now();
                    const dur = 1100;
                    const tick = (now) => {
                        const k = Math.min(1, (now - begin) / dur);
                        setAnimate(1 - Math.pow(1 - k, 3));
                        if (k < 1) raf = requestAnimationFrame(tick);
                    };
                    raf = requestAnimationFrame(tick);
                    obs.disconnect();
                }
            });
        }, { threshold: 0.25 });
        obs.observe(ref.current);
        return () => { obs.disconnect(); if (raf) cancelAnimationFrame(raf); };
    }, []);

    const blur = privacyMode ? 'privacy-blur' : '';
    const accent = activeColor.hex;
    const paceClamped = Math.min(stats.pace, 200);
    const paceColor = stats.pace > 100 ? '#FF453A' : stats.pace > 80 ? '#FF9F0A' : '#30D158';
    const monthProgress = (stats.elapsed / stats.total) * 100;

    return (
        <div ref={ref} className={`p-6 md:p-7 rounded-[32px] border ${t.card} relative overflow-hidden`}>
            <div className="absolute inset-0 pointer-events-none opacity-30" style={{ background: `radial-gradient(circle at 100% 0%, ${accent}1A 0%, transparent 50%)` }} />
            <div className="relative">
                <div className="mb-5">
                    <h3 className="text-sm font-black tracking-tight uppercase flex items-center gap-2"><Zap size={16} className={activeColor.text} /> Proyección · {stats.monthLabel}</h3>
                    <p className={`text-[11px] mt-1 ${t.textSec}`}>Estimación al ritmo actual del mes.</p>
                </div>

                <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-white/[0.03] border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-baseline justify-between mb-3">
                        <div>
                            <p className={`text-[9px] uppercase font-black tracking-widest opacity-50 mb-0.5`}>Gasto medio / {stats.unit}</p>
                            <p className={`text-2xl md:text-3xl font-black tabular-nums ${blur}`} style={{ color: accent }}>{stats.avgPerUnit.toFixed(2)}€</p>
                        </div>
                        <div className="text-right">
                            <p className={`text-[9px] uppercase font-black tracking-widest opacity-50 mb-0.5`}>Proyección final</p>
                            <p className={`text-lg md:text-xl font-black tabular-nums ${blur}`}>{stats.projected.toFixed(0)}€</p>
                        </div>
                    </div>

                    <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                        <div
                            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
                            style={{
                                width: `${animate * Math.min(paceClamped, 100)}%`,
                                background: `linear-gradient(90deg, ${paceColor}AA, ${paceColor})`,
                                boxShadow: `0 0 14px ${paceColor}77`,
                            }}
                        />
                        {paceClamped > 100 && (
                            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${animate * 100}%`, background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0 6px, transparent 6px 12px)' }} />
                        )}
                    </div>

                    <div className="mt-3 flex items-center gap-2.5">
                        <div className="relative w-10 h-10 shrink-0">
                            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                <circle cx="18" cy="18" r="15" fill="none" stroke={theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} strokeWidth="3" />
                                <circle
                                    cx="18" cy="18" r="15" fill="none"
                                    stroke={accent}
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 15}`}
                                    strokeDashoffset={`${2 * Math.PI * 15 * (1 - (animate * monthProgress) / 100)}`}
                                    style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 4px ${accent}88)` }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[9px] font-black tabular-nums leading-none" style={{ color: accent }}>{Math.round(animate * monthProgress)}%</span>
                            </div>
                        </div>
                        <div className="min-w-0 leading-tight">
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-50">Día del mes</p>
                            <p className="text-sm font-black tabular-nums">{stats.elapsed}<span className="opacity-40">/{stats.total}</span></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ===================== LINE COMPARATIVA CARD =====================
const LineComparativaCard = ({ chartData, chartCategoryData, selectedChartYear, setSelectedChartYear, theme, t, getCatColor, activeColor }) => {
    const [mode, setMode] = useState(0);
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [transitioning, setTransitioning] = useState(false);
    const [transitionDir, setTransitionDir] = useState(0);
    const [hoverIdx, setHoverIdx] = useState(null);
    const startX = useRef(null);
    const startY = useRef(null);
    const lockedAxis = useRef(null);
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!ref.current) return;
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } });
        }, { threshold: 0.2 });
        obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);

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

    const W = 600, H = 220, padX = 24, padY = 16;
    const innerW = W - padX * 2;
    const innerH = H - padY * 2;
    const n = chartData.length;
    const xAt = (i) => padX + (i * innerW) / Math.max(n - 1, 1);

    // Mode 0: total income/expense lines
    const totalSeries = useMemo(() => {
        const incomes = chartData.map(d => d.income || 0);
        const expenses = chartData.map(d => d.expense || 0);
        const max = Math.max(...incomes, ...expenses, 1);
        const yAt = (v) => padY + innerH - (v / max) * innerH;
        return {
            max,
            yAt,
            income: incomes.map((v, i) => ({ x: xAt(i), y: yAt(v), v })),
            expense: expenses.map((v, i) => ({ x: xAt(i), y: yAt(v), v })),
        };
    }, [chartData]);

    // Mode 1: per-category expense lines
    const catSeries = useMemo(() => {
        const cats = new Set();
        chartCategoryData.forEach(m => (m.expenseBreak || []).forEach(b => cats.add(b.cat)));
        const series = Array.from(cats).map(cat => {
            const values = chartCategoryData.map(m => {
                const found = (m.expenseBreak || []).find(b => b.cat === cat);
                return found ? found.val : 0;
            });
            const total = values.reduce((a, b) => a + b, 0);
            return { cat, values, total };
        }).sort((a, b) => b.total - a.total).slice(0, 8);
        const max = Math.max(...series.flatMap(s => s.values), 1);
        const yAt = (v) => padY + innerH - (v / max) * innerH;
        return {
            max,
            yAt,
            lines: series.map(s => ({
                cat: s.cat,
                color: getCatColor(s.cat),
                points: s.values.map((v, i) => ({ x: xAt(i), y: yAt(v), v })),
                total: s.total,
            })),
        };
    }, [chartCategoryData]);

    const smoothPath = (pts) => {
        if (pts.length === 0) return '';
        if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(i - 1, 0)];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[Math.min(i + 2, pts.length - 1)];
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
        }
        return d;
    };

    const enterTransform = transitionDir !== 0 && transitioning
        ? `translateX(${transitionDir * 18}%) scale(.94)`
        : `translateX(${dragX * 0.6}px) scale(${1 - Math.min(0.04, Math.abs(dragX) / 1800)})`;
    const enterOpacity = (transitioning && transitionDir !== 0) ? 0 : 1;

    const incomePath = smoothPath(totalSeries.income);
    const expensePath = smoothPath(totalSeries.expense);
    const incomeArea = `${incomePath} L ${xAt(n - 1)} ${padY + innerH} L ${xAt(0)} ${padY + innerH} Z`;
    const expenseArea = `${expensePath} L ${xAt(n - 1)} ${padY + innerH} L ${xAt(0)} ${padY + innerH} Z`;

    return (
        <div ref={ref} className={`p-6 md:p-8 rounded-[32px] border ${t.card} relative overflow-hidden`}>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-sm font-black tracking-tight uppercase flex items-center gap-2"><BarChart3 size={16} className={activeColor.text} /> Tendencias {selectedChartYear}</h3>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${t.textSec}`}>{mode === 0 ? 'Ingresos vs Gastos' : 'Por categoría'}</p>
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
                    style={{
                        transform: enterTransform,
                        opacity: enterOpacity,
                        transition: isDragging ? 'none' : 'transform .38s cubic-bezier(.6,.05,.3,1.05), opacity .25s ease',
                    }}
                >
                    <svg
                        viewBox={`0 0 ${W} ${H}`}
                        className="w-full h-[220px] overflow-visible"
                        onMouseLeave={() => setHoverIdx(null)}
                    >
                        <defs>
                            <linearGradient id="lineIncomeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#30D158" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="#30D158" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient id="lineExpenseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#FF453A" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="#FF453A" stopOpacity="0" />
                            </linearGradient>
                        </defs>

                        {[0.25, 0.5, 0.75].map(p => (
                            <line key={p} x1={padX} x2={W - padX} y1={padY + innerH * p} y2={padY + innerH * p} stroke={theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'} strokeDasharray="3 4" />
                        ))}

                        {mode === 0 ? (
                            <g style={{ opacity: visible ? 1 : 0, transition: 'opacity .5s ease' }}>
                                <path d={incomeArea} fill="url(#lineIncomeGrad)" style={{ opacity: visible ? 1 : 0, transition: 'opacity .9s ease .3s' }} />
                                <path d={expenseArea} fill="url(#lineExpenseGrad)" style={{ opacity: visible ? 1 : 0, transition: 'opacity .9s ease .4s' }} />
                                <path d={incomePath} fill="none" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                    style={{
                                        strokeDasharray: 2000,
                                        strokeDashoffset: visible ? 0 : 2000,
                                        transition: 'stroke-dashoffset 1.4s cubic-bezier(.6,0,.3,1)',
                                        filter: 'drop-shadow(0 0 6px rgba(48,209,88,0.5))',
                                    }}
                                />
                                <path d={expensePath} fill="none" stroke="#FF453A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                    style={{
                                        strokeDasharray: 2000,
                                        strokeDashoffset: visible ? 0 : 2000,
                                        transition: 'stroke-dashoffset 1.4s cubic-bezier(.6,0,.3,1) .15s',
                                        filter: 'drop-shadow(0 0 6px rgba(255,69,58,0.5))',
                                    }}
                                />
                                {totalSeries.income.map((p, i) => (
                                    <circle key={`i-${i}`} cx={p.x} cy={p.y} r={hoverIdx === i ? 5 : 3} fill="#30D158" stroke={theme === 'dark' ? '#0E0E11' : '#fff'} strokeWidth="2"
                                        style={{ opacity: visible ? 1 : 0, transition: `opacity .3s ease ${0.8 + i * 0.04}s, r .2s ease` }} />
                                ))}
                                {totalSeries.expense.map((p, i) => (
                                    <circle key={`e-${i}`} cx={p.x} cy={p.y} r={hoverIdx === i ? 5 : 3} fill="#FF453A" stroke={theme === 'dark' ? '#0E0E11' : '#fff'} strokeWidth="2"
                                        style={{ opacity: visible ? 1 : 0, transition: `opacity .3s ease ${0.85 + i * 0.04}s, r .2s ease` }} />
                                ))}
                            </g>
                        ) : (
                            <g style={{ opacity: visible ? 1 : 0, transition: 'opacity .5s ease' }}>
                                {catSeries.lines.map((line, idx) => (
                                    <g key={line.cat}>
                                        <path
                                            d={smoothPath(line.points)}
                                            fill="none"
                                            stroke={line.color}
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            style={{
                                                strokeDasharray: 2000,
                                                strokeDashoffset: visible ? 0 : 2000,
                                                transition: `stroke-dashoffset 1.2s cubic-bezier(.6,0,.3,1) ${idx * 0.08}s`,
                                                filter: `drop-shadow(0 0 4px ${line.color}66)`,
                                            }}
                                        />
                                        {line.points.map((p, i) => (
                                            <circle key={i} cx={p.x} cy={p.y} r={hoverIdx === i ? 4 : 2.5} fill={line.color} stroke={theme === 'dark' ? '#0E0E11' : '#fff'} strokeWidth="1.5"
                                                style={{ opacity: visible ? 1 : 0, transition: `opacity .3s ease ${0.6 + idx * 0.08 + i * 0.02}s, r .2s ease` }} />
                                        ))}
                                    </g>
                                ))}
                            </g>
                        )}

                        {/* hover overlay */}
                        {chartData.map((_, i) => (
                            <rect key={i} x={xAt(i) - innerW / (n * 2)} y={padY} width={innerW / n} height={innerH}
                                fill="transparent"
                                onMouseEnter={() => setHoverIdx(i)}
                            />
                        ))}
                        {hoverIdx != null && (
                            <line x1={xAt(hoverIdx)} x2={xAt(hoverIdx)} y1={padY} y2={padY + innerH}
                                stroke={theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'} strokeDasharray="2 3" />
                        )}

                        {/* x labels */}
                        {chartData.map((d, i) => (
                            <text key={i} x={xAt(i)} y={H - 2} textAnchor="middle" fontSize="9" fontWeight="800"
                                fill={hoverIdx === i ? (theme === 'dark' ? '#fff' : '#000') : (theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)')}>
                                {d.label.charAt(0)}
                            </text>
                        ))}
                    </svg>
                </div>
            </div>

            {/* Legend / hover info */}
            <div className={`mt-4 p-3 rounded-2xl border ${theme === 'dark' ? 'bg-white/[0.03] border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                {mode === 0 ? (
                    <div className="flex justify-around text-xs">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ background: '#30D158', boxShadow: '0 0 8px #30D15877' }} />
                            <span className="font-bold opacity-70">Ingreso</span>
                            <span className="font-black tabular-nums text-green-500">
                                {hoverIdx != null ? `+${(chartData[hoverIdx]?.income || 0).toFixed(0)}€` : `${chartData.reduce((a, b) => a + (b.income || 0), 0).toFixed(0)}€`}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ background: '#FF453A', boxShadow: '0 0 8px #FF453A77' }} />
                            <span className="font-bold opacity-70">Gasto</span>
                            <span className="font-black tabular-nums text-red-500">
                                {hoverIdx != null ? `-${(chartData[hoverIdx]?.expense || 0).toFixed(0)}€` : `${chartData.reduce((a, b) => a + (b.expense || 0), 0).toFixed(0)}€`}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
                        {catSeries.lines.map(line => (
                            <div key={line.cat} className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: line.color, boxShadow: `0 0 6px ${line.color}77` }} />
                                <span className="text-[10px] font-bold opacity-70 truncate max-w-[80px]">{line.cat}</span>
                                <span className="text-[10px] font-black tabular-nums" style={{ color: line.color }}>
                                    {hoverIdx != null ? `${(line.points[hoverIdx]?.v || 0).toFixed(0)}€` : `${line.total.toFixed(0)}€`}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-center gap-2 mt-4">
                {[0, 1].map(idx => (
                    <button key={idx} onClick={() => idx !== mode && animateTo(idx > mode ? 1 : -1)} className={`h-1.5 rounded-full transition-all ${mode === idx ? `w-8 bg-current opacity-80` : 'w-1.5 bg-current opacity-20'}`} />
                ))}
            </div>
        </div>
    );
};

// ===================== HISTORICAL AVG CARD =====================
const HistoricalAverageCard = ({ avg, t, theme, privacyMode, activeColor }) => {
    const [viewRef, visible] = useInViewOnce(0.2);
    const dailyIncome = useCountUp(avg.dailyIncome || 0, visible);
    const dailyExpense = useCountUp(avg.dailyExpense || 0, visible);
    const dailyNet = useCountUp(avg.netDaily || 0, visible);
    const monthlyIncome = useCountUp(avg.monthlyIncome || 0, visible);
    const monthlyExpense = useCountUp(avg.monthlyExpense || 0, visible);
    const monthlyNet = useCountUp((avg.monthlyIncome || 0) - (avg.monthlyExpense || 0), visible);
    const fmt = (v) => privacyMode ? '••••' : `${(v || 0).toFixed(0)}€`;
    const items = [
        { key: 'income',  label: 'Ingreso', daily: dailyIncome,  monthly: monthlyIncome, color: '#30D158', textCls: 'text-green-500', Icon: TrendingUp },
        { key: 'expense', label: 'Gasto',   daily: dailyExpense, monthly: monthlyExpense, color: '#FF453A', textCls: 'text-red-500',   Icon: TrendingDown },
        { key: 'net',     label: 'Balance', daily: dailyNet,     monthly: monthlyNet, color: '#0A84FF', textCls: 'text-blue-500', Icon: Wallet },
    ];
    return (
        <div ref={viewRef} className={`p-4 md:p-5 rounded-[32px] border ${t.card}`}>
            <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={14} className={activeColor.text} />
                <h3 className="text-xs font-black tracking-tight uppercase">Promedios Históricos</h3>
                <span className={`ml-auto text-[9px] font-black uppercase tracking-widest opacity-40`}>{avg.days || 0} días</span>
            </div>
            <div className={`flex items-stretch rounded-2xl border ${theme === 'dark' ? 'bg-black/30 border-white/5' : 'bg-white border-gray-200'}`}>
                {items.map((it, idx) => (
                    <div key={it.key} className={`flex-1 px-2 md:px-3 py-2.5 min-w-0 flex flex-col items-center text-center ${idx > 0 ? (theme === 'dark' ? 'border-l border-white/5' : 'border-l border-gray-200') : ''}`}
                        style={{
                            opacity: visible ? 1 : 0,
                            transform: visible ? 'translateY(0)' : 'translateY(8px)',
                            transition: `opacity .5s ease ${idx * 100}ms, transform .5s cubic-bezier(.2,.8,.2,1) ${idx * 100}ms`,
                        }}
                    >
                        <div className="flex items-center gap-1 mb-1">
                            <div className="w-4 h-4 rounded-md flex items-center justify-center shrink-0" style={{ background: it.color + '22', color: it.color }}>
                                <it.Icon size={9} strokeWidth={2.6} />
                            </div>
                            <p className={`text-[10px] font-black uppercase tracking-wide whitespace-nowrap ${it.textCls}`}>{it.label}</p>
                        </div>
                        <div className="flex items-baseline justify-center gap-0.5">
                            <span className={`text-lg md:text-xl font-black tracking-tighter tabular-nums ${it.textCls}`}>{fmt(it.daily)}</span>
                            <span className={`text-[9px] font-black uppercase tracking-wide opacity-40`}>/d</span>
                        </div>
                        <p className={`text-[10px] font-bold tabular-nums opacity-50 truncate`}>≈ {fmt(it.monthly)}/mes</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ===================== FIXED INFO WIDGET =====================
const FixedInfoWidget = ({ recurringRules, t, theme, activeColor, privacyMode }) => {
    const [openCard, setOpenCard] = useState(null); // 'monthly' | 'annual' | 'total' | null
    const [viewRef, visible] = useInViewOnce(0.2);

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
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const yearStart = new Date(today.getFullYear(), 0, 1);
        const yearEnd = new Date(today.getFullYear(), 11, 31);
        const yearTotalOf = (r) => {
            const startStr = r.startDate || r.lastRun;
            if (!startStr) return 0;
            const start = parseLocalDate(startStr);
            if (isNaN(start)) return 0;
            const eff = start > yearStart ? start : yearStart;
            if (eff > yearEnd) return 0;
            const amt = Number(r.amount || 0);
            const every = Number(r.every || 1);
            let elapsed = 0;
            if (r.unit === 'month') elapsed = (yearEnd.getFullYear() - eff.getFullYear()) * 12 + (yearEnd.getMonth() - eff.getMonth());
            else if (r.unit === 'year') elapsed = yearEnd.getFullYear() - eff.getFullYear();
            else if (r.unit === 'week') elapsed = Math.floor((yearEnd - eff) / (7 * 86400000));
            else if (r.unit === 'day')  elapsed = Math.floor((yearEnd - eff) / 86400000);
            const cycles = Math.floor(elapsed / every) + 1;
            return amt * Math.max(0, cycles);
        };
        const monthlySum = monthly.reduce((a, r) => a + Number(r.amount || 0), 0);
        const annualExtraSum = annualExtras.reduce((a, r) => a + annualOf(r), 0);
        const ytdList = active.map(r => ({ ...r, yearTotal: yearTotalOf(r), annual: annualOf(r) })).sort((a, b) => b.yearTotal - a.yearTotal);
        const yearSum = ytdList.reduce((a, r) => a + r.yearTotal, 0);
        return {
            monthly,
            annualExtras,
            ytdList,
            yearSum,
            year: today.getFullYear(),
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
        { key: 'monthly', label: 'Mensual',  val: data.monthlySum,        sub: `${data.monthlyCount} reglas`,     color: 'rgba(99,102,241,.5)',  cls: theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-gray-200 bg-gray-50',           textCls: '' },
        { key: 'annual',  label: 'Extras',   val: data.annualExtraSum,    sub: `${data.annualExtraCount} reglas`, color: 'rgba(255,159,10,.5)',  cls: theme === 'dark' ? 'border-orange-500/20 bg-orange-500/5' : 'border-orange-300/30 bg-orange-50', textCls: 'text-orange-500' },
        { key: 'total',   label: `${data.year}`, val: data.yearSum,       sub: `año completo`,                    color: 'rgba(10,132,255,.5)',  cls: theme === 'dark' ? 'border-blue-500/20 bg-blue-500/5' : 'border-blue-300/30 bg-blue-50',     textCls: 'text-blue-500' },
        { key: 'avg',     label: 'Promedio', val: data.grandAnnual / 12,  sub: 'prorrateo',                       color: 'rgba(59,130,246,.4)',  cls: 'border-blue-400/30',                                                                       textCls: 'text-blue-400', aura: true },
    ];

    const renderList = () => {
        if (openCard === 'monthly') return data.ytdList.filter(r => r.unit === 'month');
        if (openCard === 'annual')  return data.ytdList.filter(r => r.unit !== 'month');
        if (openCard === 'total')   return data.ytdList;
        return [];
    };
    const list = renderList();

    return (
        <div ref={viewRef} className={`p-6 md:p-8 rounded-[32px] border ${t.card}`}>
            <div className="flex items-center gap-2 mb-6">
                <Repeat size={18} className={activeColor.text} />
                <h3 className="text-base font-black tracking-tight">Gastos Fijos</h3>
                <span className={`ml-auto text-[10px] font-black uppercase tracking-widest opacity-40`}>{data.list.length} reglas</span>
            </div>
            <div className="grid grid-cols-4 gap-2 md:gap-3">
                {cards.map((c, idx) => {
                    const open = openCard === c.key;
                    const clickable = c.key !== 'avg';
                    const display = fmt(c.val);
                    const len = display.length;
                    const valSize = len > 8 ? 'text-[11px] md:text-base' : len > 6 ? 'text-xs md:text-lg' : 'text-sm md:text-xl';
                    return (
                        <button
                            key={c.key}
                            type="button"
                            onClick={clickable ? () => setOpenCard(open ? null : c.key) : undefined}
                            className={`relative text-left p-2 md:p-3 rounded-2xl border transition-all ${c.cls} ${open ? 'ring-2 ring-current scale-[1.02]' : clickable ? 'hover:-translate-y-0.5' : ''}`}
                            style={{
                                ...(c.aura ? { animation: 'auraGlow 2.6s ease-in-out infinite' } : {}),
                                opacity: visible ? 1 : 0,
                                transform: visible ? (open ? 'scale(1.02)' : 'translateY(0)') : 'translateY(12px) scale(.95)',
                                transition: `opacity .5s ease ${idx * 90}ms, transform .55s cubic-bezier(.2,.8,.2,1) ${idx * 90}ms`,
                            }}
                        >
                            <p className={`text-[8px] md:text-[9px] font-black uppercase tracking-wider mb-0.5 truncate ${c.textCls || 'opacity-50'}`}>{c.label}</p>
                            <p className={`font-black tabular-nums whitespace-nowrap leading-tight ${valSize}`}>{display}</p>
                            <p className={`text-[8px] md:text-[10px] font-bold mt-0.5 opacity-50 truncate`}>{c.sub}</p>
                            {clickable && (
                                <span className="absolute top-1.5 right-2 text-[8px] font-black uppercase tracking-widest opacity-30">{open ? '−' : '+'}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className={`grid transition-all duration-400 ease-out ${openCard ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                <div className="overflow-hidden">
                    {openCard && (
                        <div className={`p-3 rounded-2xl border ${theme === 'dark' ? 'border-white/5 bg-black/30' : 'border-gray-200 bg-gray-50'} animate-in fade-in slide-in-from-top-2 duration-300`}>
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
                                    {openCard === 'monthly' && 'Reglas mensuales'}
                                    {openCard === 'annual' && 'Extras anuales'}
                                    {openCard === 'total' && `Total ${data.year}`}
                                </p>
                                <span className={`text-[10px] font-black tabular-nums ${t.textSec}`}>{list.length} {list.length === 1 ? 'regla' : 'reglas'}</span>
                            </div>
                            {list.length === 0 ? (
                                <p className={`text-center py-2 text-[11px] font-bold opacity-40 ${t.textSec}`}>Sin reglas.</p>
                            ) : (
                                <div className="space-y-1 max-h-[240px] overflow-y-auto">
                                    {list.map(r => {
                                        const Ic = CATEGORY_ICONS[r.category] || Box;
                                        const subline = [r.category, r.subCategory].filter(Boolean).join(' · ');
                                        const note = r.name && r.name !== r.category ? r.name : '';
                                        return (
                                            <div key={r.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-white'}`}>
                                                <Ic size={12} className="opacity-60 shrink-0" />
                                                <div className="flex-1 min-w-0 leading-tight">
                                                    <p className="font-bold text-[11px] truncate">{note || subline || r.category}</p>
                                                    <p className={`text-[9px] font-black uppercase tracking-wider opacity-40 truncate`}>
                                                        {note ? subline : `cada ${r.every || 1} ${unitLabel(r.unit)}`}{note && ` · cada ${r.every || 1} ${unitLabel(r.unit)}`}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0 leading-tight">
                                                    {openCard === 'total' ? (
                                                        <>
                                                            <p className="text-[11px] font-black tabular-nums">{fmt(r.yearTotal)}</p>
                                                            <p className="text-[9px] font-bold opacity-50 tabular-nums">{fmt(r.amount)}/{unitLabel(r.unit)}</p>
                                                        </>
                                                    ) : (
                                                        <p className="text-[11px] font-black tabular-nums">{fmt(r.amount)}</p>
                                                    )}
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
    const [viewRef, visible] = useInViewOnce(0.2);
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
        <div ref={viewRef} className={`p-5 md:p-6 rounded-[32px] border ${t.card}`}>
            <div className="flex items-center gap-2 mb-3">
                <CalendarIcon size={16} className={activeColor.text} />
                <h3 className="text-sm font-black tracking-tight">Próximos gastos</h3>
                <span className={`ml-auto text-[10px] font-black uppercase tracking-widest opacity-40`}>top 3</span>
            </div>
            {upcoming.length === 0 ? (
                <p className={`text-center py-4 text-xs font-bold opacity-30 ${t.textSec}`}>Sin gastos previstos.</p>
            ) : (
                <div className="space-y-1.5">
                    {upcoming.map((it, idx) => {
                        const days = Math.max(0, Math.ceil((it.date - today) / 86400000));
                        const color = getCatColor(it.category);
                        const Ic = CATEGORY_ICONS[it.category] || Box;
                        const dayLabel = days === 0 ? 'hoy' : days === 1 ? 'mañana' : `${days}d`;
                        const subline = [it.category, it.subCategory].filter(Boolean).join(' · ');
                        const dateStr = it.date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                        return (
                            <div
                                key={it.key}
                                className={`flex items-center gap-2.5 p-2 rounded-xl ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-gray-50'}`}
                                style={{
                                    opacity: visible ? 1 : 0,
                                    transform: visible ? 'translateX(0)' : 'translateX(-12px)',
                                    transition: `opacity 600ms cubic-bezier(0.22,1,0.36,1) ${idx * 90}ms, transform 600ms cubic-bezier(0.22,1,0.36,1) ${idx * 90}ms`,
                                }}
                            >
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: color }}>
                                    <Ic size={12} className="text-white" strokeWidth={2.5} />
                                </div>
                                <div className="flex-1 min-w-0 leading-tight">
                                    <p className="font-bold text-[11px] truncate">{it.name}</p>
                                    <p className={`text-[9px] font-black uppercase tracking-wider opacity-50 truncate`}>{subline} · {dateStr}</p>
                                </div>
                                <div className="text-right shrink-0 leading-tight">
                                    <p className="font-black text-[12px] tabular-nums">{fmt(it.amount)}</p>
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
    const [viewRef, visible] = useInViewOnce(0.15);
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
    const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }
    const [controlsOpen, setControlsOpen] = useState(false);

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
        <div
            ref={viewRef}
            onClick={() => setControlsOpen(o => !o)}
            className={`p-6 md:p-8 rounded-[32px] border cursor-pointer ${t.card}`}
        >
            <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <Target size={18} className={activeColor.text} />
                    <h3 className="text-base font-black tracking-tight">Ahorros & Objetivos</h3>
                </div>
                <div className={`flex items-center gap-2 transition-all duration-300 ${controlsOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'}`}>
                    {completed.length > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); setShowCompleted(true); }} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${t.hover} opacity-70 hover:opacity-100 flex items-center gap-1.5`}>
                            <Award size={12} /> {completed.length}
                        </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setShowForm(s => !s); }} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${activeColor.bg} text-white flex items-center gap-1.5`}>
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
                    {active.map((it, idx) => {
                        const ruleAmt = ruleProgress[it.id] || 0;
                        const total = Number(it.current || 0) + ruleAmt;
                        const pct = it.target > 0 ? Math.min(100, (total / it.target) * 100) : 0;
                        const animPct = visible ? pct : 0;
                        const linkedRuleObj = rules.find(r => r.id === it.linked_rule_id);
                        const adj = adjustState[it.id] ?? '';
                        const isOpen = expandedId === it.id;
                        const targetDateObj = it.target_date ? parseLocalDate(it.target_date) : null;
                        const daysLeft = targetDateObj ? Math.ceil((targetDateObj - new Date()) / 86400000) : null;
                        return (
                            <div
                                key={it.id}
                                onClick={(e) => { e.stopPropagation(); setExpandedId(prev => prev === it.id ? null : it.id); }}
                                style={{
                                    opacity: visible ? 1 : 0,
                                    transform: visible ? 'translateY(0)' : 'translateY(10px)',
                                    transition: `opacity .5s ease ${idx * 80}ms, transform .5s cubic-bezier(.2,.8,.2,1) ${idx * 80}ms`,
                                }}
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
                                    <div className={`h-3 w-full rounded-full overflow-hidden relative ${theme === 'dark' ? 'bg-white/[0.06]' : 'bg-gray-200'}`}>
                                        <div
                                            className="h-full rounded-full relative overflow-hidden"
                                            style={{
                                                width: `${animPct}%`,
                                                background: `linear-gradient(90deg, ${accentHex}, #30D158)`,
                                                boxShadow: animPct > 0 ? `0 0 14px ${accentHex}55, inset 0 1px 0 rgba(255,255,255,.22)` : 'none',
                                                transition: `width 1.1s cubic-bezier(.2,.8,.2,1) ${idx * 80 + 200}ms, box-shadow .5s ease`,
                                            }}
                                        >
                                            {pct > 0 && pct < 100 && (
                                                <div
                                                    className="absolute inset-y-0 w-2/5 mix-blend-overlay"
                                                    style={{
                                                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.5) 50%, transparent 100%)',
                                                        animation: 'barFlow 3.2s ease-in-out infinite',
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between mt-1.5 text-[10px] font-black uppercase tracking-widest">
                                        <span className="opacity-60 tabular-nums">{fmt(total)} / {fmt(it.target)}</span>
                                        <span className={pct >= 100 ? 'text-green-500 flex items-center gap-1' : 'opacity-60'}>
                                            {pct >= 100 && <Sparkles size={10} />}{pct.toFixed(0)}%
                                        </span>
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
                                            <button onClick={() => setConfirmDelete({ id: it.id, name: it.name })} className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 border border-red-500/30" title="Eliminar"><Trash2 size={14} /></button>
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
                                        <button onClick={() => setConfirmDelete({ id: it.id, name: it.name })} title="Borrar" className="p-2 rounded-lg text-red-500 hover:bg-red-500/10"><Trash2 size={14} /></button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {confirmDelete && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setConfirmDelete(null)}>
                    <div className={`w-full max-w-sm rounded-[28px] border shadow-2xl ${t.card} ${t.bg} p-6 animate-in zoom-in-95 duration-200`} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-11 h-11 rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center shrink-0"><Trash2 size={18} /></div>
                            <div className="min-w-0">
                                <p className="font-black text-base tracking-tight">Borrar objetivo</p>
                                <p className={`text-xs font-bold opacity-60 truncate ${t.textSec}`}>"{confirmDelete.name}"</p>
                            </div>
                        </div>
                        <p className={`text-xs font-bold mb-5 opacity-70 ${t.textSec}`}>Esta acción no se puede deshacer.</p>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmDelete(null)} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest ${t.hover}`}>Cancelar</button>
                            <button onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }} className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 transition-colors">Borrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardView;
