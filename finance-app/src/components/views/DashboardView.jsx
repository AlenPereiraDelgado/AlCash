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
    Layers, Calendar as CalendarIcon, CalendarDays, ChevronLeft, ChevronRight, ChevronDown,
    TrendingUp, TrendingDown, Wallet, ShieldCheck,
    Box, Globe, PieChart as PieIcon, Repeat, Sparkles, Plus, Minus, Trash2,
    Award, Link2, BarChart3, Check, Activity, Zap, Radar, Pencil, GripVertical, Info,
    Bell, BellOff, AlertTriangle
} from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../constants/theme';
import { parseLocalDate, resolveCategoryColor, themeGradient, shadeColor } from '../../utils/helpers';
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
        transactions, categories, categoryColors, recurringRules, addRecurringRule,
        savingsWidgets, addSavingsWidget, updateSavingsWidget, deleteSavingsWidget,
        adjustSavingsWidget, expandSavingsWidget, reopenSavingsWidget, linkSavingsRule,
        dashboardWidgets, setDashboardWidgets,
    } = useFinance();
    const [editMode, setEditMode] = useState(false);
    const getCatColor = (cat) => resolveCategoryColor(cat, categoryColors, CATEGORY_COLORS);
    const swipeStartY = useRef(null);
    const [pieMonth, setPieMonth] = useState(() => new Date());
    const [pieYear, setPieYear] = useState(() => new Date().getFullYear());
    const dateBarRef = useRef(null);
    const inlinePanelRef = useRef(null);
    const [floatingDate, setFloatingDate] = useState(false);

    useEffect(() => {
        if (!dateBarRef.current) return;
        const obs = new IntersectionObserver(([e]) => {
            setFloatingDate(!e.isIntersecting);
        }, { threshold: 0, rootMargin: '-12px 0px 0px 0px' });
        obs.observe(dateBarRef.current);
        return () => obs.disconnect();
    }, []);

    const prevFloatingDate = useRef(floatingDate);
    useEffect(() => {
        if (prevFloatingDate.current !== floatingDate && isDateMenuOpen) setIsDateMenuOpen(false);
        prevFloatingDate.current = floatingDate;
    }, [floatingDate, isDateMenuOpen, setIsDateMenuOpen]);

    useEffect(() => {
        if (!isDateMenuOpen || floatingDate) return;
        const handler = (e) => {
            const inBar = dateBarRef.current && dateBarRef.current.contains(e.target);
            const inPanel = inlinePanelRef.current && inlinePanelRef.current.contains(e.target);
            if (!inBar && !inPanel) setIsDateMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [isDateMenuOpen, floatingDate, setIsDateMenuOpen]);

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

    // --- Métricas Salud Financiera ---
    const saludMetrics = useMemo(() => {
        const list = filteredTransactions || [];
        const income = list.filter(tx => tx.type === 'income').reduce((a, b) => a + (b.amountVal || 0), 0);
        const expense = list.filter(tx => tx.type === 'expense').reduce((a, b) => a + (b.amountVal || 0), 0);
        const dates = list.map(tx => parseLocalDate(tx.date)).filter(d => !isNaN(d));
        let spanDays = 1;
        if (dates.length) {
            const min = new Date(Math.min(...dates));
            const max = new Date(Math.max(...dates));
            spanDays = Math.max(1, Math.round((max - min) / 86400000) + 1);
        }
        const dailyBurn = expense / spanDays;

        const fixedMonthly = (recurringRules || [])
            .filter(r => r.active && r.type === 'expense')
            .reduce((a, r) => {
                const amt = Number(r.amount || 0);
                const every = Math.max(1, Number(r.every || 1));
                if (r.unit === 'month') return a + amt / every;
                if (r.unit === 'year')  return a + amt / (12 * every);
                if (r.unit === 'week')  return a + (amt * 4.33) / every;
                if (r.unit === 'day')   return a + (amt * 30.44) / every;
                return a;
            }, 0);

        const monthlyIncomeEst = spanDays > 0 ? income * (30 / spanDays) : 0;
        const fixedRatio = monthlyIncomeEst > 0 ? Math.min(200, (fixedMonthly / monthlyIncomeEst) * 100) : 0;

        const hasData = list.length > 0 || income > 0 || expense > 0;
        const sR = Math.max(0, Math.min((savingsRate || 0), 30)) / 30;
        const cF = Math.max(0, Math.min((emergencyFundMonths || 0), 6)) / 6;
        const fR = monthlyIncomeEst > 0 ? Math.max(0, 1 - Math.min(fixedRatio, 100) / 100) : 0;
        const score = hasData ? Math.round((sR * 0.4 + cF * 0.4 + fR * 0.2) * 100) : 0;

        let label = 'Crítica';
        let color = '#FF453A';
        if (score >= 75)      { label = 'Excelente'; color = '#30D158'; }
        else if (score >= 55) { label = 'Sólida';    color = '#A6E22E'; }
        else if (score >= 35) { label = 'Atención';  color = '#FFD60A'; }
        else if (score >= 15) { label = 'Frágil';    color = '#FF9F0A'; }

        const cashFlow = income - expense;
        return { dailyBurn, fixedMonthly, fixedRatio, score, label, color, cashFlow, monthlyIncomeEst, income, expense };
    }, [filteredTransactions, recurringRules, savingsRate, emergencyFundMonths]);

    // Salud Financiera — variante histórica (todo el histórico de transacciones)
    const saludAll = useMemo(() => {
        const list = transactions || [];
        const income = list.filter(tx => tx.type === 'income').reduce((a, b) => a + (b.amountVal || 0), 0);
        const expense = list.filter(tx => tx.type === 'expense').reduce((a, b) => a + (b.amountVal || 0), 0);
        const monthsSet = new Set(list.map(tx => (tx.date || '').slice(0, 7)).filter(Boolean));
        const months = Math.max(1, monthsSet.size);
        const dates = list.map(tx => parseLocalDate(tx.date)).filter(d => !isNaN(d));
        let spanDays = 1;
        if (dates.length) {
            const min = new Date(Math.min(...dates));
            const max = new Date(Math.max(...dates));
            spanDays = Math.max(1, Math.round((max - min) / 86400000) + 1);
        }
        const dailyBurn = expense / spanDays;
        const monthlyIncomeEst = income / months;
        const monthlyExpense = expense / months;
        const fixedMonthly = (recurringRules || [])
            .filter(r => r.active && r.type === 'expense')
            .reduce((a, r) => {
                const amt = Number(r.amount || 0);
                const every = Math.max(1, Number(r.every || 1));
                if (r.unit === 'month') return a + amt / every;
                if (r.unit === 'year')  return a + amt / (12 * every);
                if (r.unit === 'week')  return a + (amt * 4.33) / every;
                if (r.unit === 'day')   return a + (amt * 30.44) / every;
                return a;
            }, 0);
        const fixedRatio = monthlyIncomeEst > 0 ? Math.min(200, (fixedMonthly / monthlyIncomeEst) * 100) : 0;
        const savingsRateAll = income > 0 ? ((income - expense) / income) * 100 : 0;
        const emergencyFundMonthsAll = monthlyExpense > 0 ? Math.max(0, netWorth) / monthlyExpense : 0;
        const hasData = list.length > 0 || income > 0 || expense > 0;
        const sR = Math.max(0, Math.min(savingsRateAll, 30)) / 30;
        const cF = Math.max(0, Math.min(emergencyFundMonthsAll, 6)) / 6;
        const fR = monthlyIncomeEst > 0 ? Math.max(0, 1 - Math.min(fixedRatio, 100) / 100) : 0;
        const score = hasData ? Math.round((sR * 0.4 + cF * 0.4 + fR * 0.2) * 100) : 0;
        let label = 'Crítica';
        let color = '#FF453A';
        if (score >= 75)      { label = 'Excelente'; color = '#30D158'; }
        else if (score >= 55) { label = 'Sólida';    color = '#A6E22E'; }
        else if (score >= 35) { label = 'Atención';  color = '#FFD60A'; }
        else if (score >= 15) { label = 'Frágil';    color = '#FF9F0A'; }
        const cashFlow = income - expense;
        return { metrics: { dailyBurn, fixedMonthly, fixedRatio, score, label, color, cashFlow, monthlyIncomeEst, income, expense }, savingsRate: savingsRateAll, emergencyFundMonths: emergencyFundMonthsAll };
    }, [transactions, recurringRules, netWorth]);

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
        <div className="space-y-4 animate-in fade-in">
            {/* Controles de Fecha en Dashboard */}
            <div ref={dateBarRef} className={`p-4 md:p-6 rounded-[32px] border flex flex-col xl:flex-row justify-between items-center gap-6 ${t.card}`}>
                <div className="w-full xl:max-w-xl" data-tour="magic-input">
                    <MagicInput
                        onParse={onMagicParse}
                        isLoading={isMagicLoading}
                        trailing={onImport ? (
                            <button
                                type="button"
                                data-tour="import-globe"
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

                <div data-tour="date-selector" className={`p-1 rounded-2xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'} flex items-center`}>
                    <button onClick={() => handleNavigate(-1)} disabled={dateMode === 'range'} className={`p-3 rounded-xl transition-colors ${t.hover} disabled:opacity-30`}><ChevronLeft size={20} /></button>
                    <div className="relative px-2">
                        <button onClick={() => setIsDateMenuOpen(!isDateMenuOpen)} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${t.hover}`}>
                            {dateMode === 'range' ? <Layers size={18} className="text-purple-500" /> : <CalendarIcon size={18} className={activeColor.text} />}
                            <span className="font-black uppercase tracking-widest text-sm">{getDateLabel()}</span>
                        </button>
                        {isDateMenuOpen && floatingDate && createPortal(
                            <>
                                {/* Invisible click-catcher (no dim) */}
                                <div className="fixed inset-0 z-[150]" onClick={() => setIsDateMenuOpen(false)} />

                                {/* Hanging panel anchored to FAB top-right */}
                                <div
                                    className={`fixed z-[200] top-16 right-3 md:top-[68px] md:right-4 w-[260px] origin-top-right p-3 rounded-3xl shadow-2xl border ${t.card}`}
                                    style={{
                                        animation: 'hangDropIn 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
                                        transformOrigin: 'top right',
                                    }}
                                    onClick={e => e.stopPropagation()}
                                >
                                    {/* Connector line to FAB */}
                                    <span
                                        className="absolute -top-3 right-5 w-px h-3"
                                        style={{
                                            background: `linear-gradient(180deg, ${activeColor.hex}AA, transparent)`,
                                            animation: 'fadeIn 240ms ease-out 80ms both',
                                        }}
                                    />

                                    {floatingDate && dateMode !== 'range' && (
                                        <div
                                            className={`flex items-center justify-between mb-2 p-1 rounded-2xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'}`}
                                            style={{ animation: 'hangItemDrop 460ms cubic-bezier(0.34, 1.56, 0.64, 1) both', animationDelay: '60ms' }}
                                        >
                                            <button onClick={() => handleNavigate(-1)} className={`p-2 rounded-xl transition-colors ${t.hover} active:scale-90`} aria-label="Anterior">
                                                <ChevronLeft size={16} />
                                            </button>
                                            <div className="flex items-center gap-1.5 min-w-0 px-1">
                                                <CalendarIcon size={12} className={activeColor.text} />
                                                <span className="font-black uppercase tracking-widest text-xs truncate">{getDateLabel()}</span>
                                            </div>
                                            <button onClick={() => handleNavigate(1)} className={`p-2 rounded-xl transition-colors ${t.hover} active:scale-90`} aria-label="Siguiente">
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                                        {[
                                            { val: 'day', label: 'Día' },
                                            { val: 'month', label: 'Mes' },
                                            { val: 'year', label: 'Año' },
                                            { val: 'range', label: 'Rango' },
                                        ].map((m, i) => (
                                            <button
                                                key={m.val}
                                                onClick={() => { setDateMode(m.val); }}
                                                className={`py-2.5 text-xs font-black rounded-xl uppercase transition-colors active:scale-95 ${dateMode === m.val ? `${activeColor.bg} text-white shadow-lg` : `${t.hover} ${t.textSec} border border-white/5`}`}
                                                style={{ animation: 'hangItemDrop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both', animationDelay: `${130 + i * 60}ms` }}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>

                                    {dateMode === 'range' && (
                                        <div className="space-y-2 pt-2 mt-1 border-t border-white/5" style={{ animation: 'hangItemDrop 480ms cubic-bezier(0.34, 1.56, 0.64, 1) both', animationDelay: '410ms' }}>
                                            <input type="date" className={`w-full p-2.5 rounded-xl text-xs font-bold ${t.input}`} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
                                            <input type="date" className={`w-full p-2.5 rounded-xl text-xs font-bold ${t.input}`} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
                                            <button onClick={() => setIsDateMenuOpen(false)} className={`w-full py-2.5 ${activeColor.bg} text-white rounded-xl text-xs font-black active:scale-95 transition-all`}>Aplicar</button>
                                        </div>
                                    )}
                                </div>
                            </>,
                            document.body
                        )}
                    </div>
                    <button onClick={() => handleNavigate(1)} disabled={dateMode === 'range'} className={`p-3 rounded-xl transition-colors ${t.hover} disabled:opacity-30`}><ChevronRight size={20} /></button>
                </div>

            </div>

            {/* Expansión INLINE bajo barra fecha (solo cuando NO está flotando) */}
            {isDateMenuOpen && !floatingDate && (
                <div
                    ref={inlinePanelRef}
                    className={`p-3 rounded-3xl border ${t.card}`}
                    style={{ animation: 'hangDropIn 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both', transformOrigin: 'top center', marginTop: '-12px' }}
                >
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { val: 'day', label: 'Día' },
                            { val: 'month', label: 'Mes' },
                            { val: 'year', label: 'Año' },
                            { val: 'range', label: 'Rango' },
                        ].map((m, i) => (
                            <button
                                key={m.val}
                                onClick={() => setDateMode(m.val)}
                                className={`py-2.5 text-xs font-black rounded-xl uppercase transition-colors active:scale-95 ${dateMode === m.val ? `${activeColor.bg} text-white shadow-lg` : `${t.hover} ${t.textSec} border border-white/5`}`}
                                style={{ animation: 'hangItemDrop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both', animationDelay: `${i * 60}ms` }}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                    {dateMode === 'range' && (
                        <div
                            className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-3 mt-3 border-t border-white/5"
                            style={{ animation: 'hangItemDrop 480ms cubic-bezier(0.34, 1.56, 0.64, 1) both', animationDelay: '300ms' }}
                        >
                            <input type="date" className={`p-2.5 rounded-xl text-xs font-bold ${t.input}`} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
                            <input type="date" className={`p-2.5 rounded-xl text-xs font-bold ${t.input}`} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
                            <button onClick={() => setIsDateMenuOpen(false)} className={`py-2.5 ${activeColor.bg} text-white rounded-xl text-xs font-black active:scale-95 transition-all`}>Aplicar</button>
                        </div>
                    )}
                </div>
            )}

            {createPortal(
                <button
                    onClick={() => setIsDateMenuOpen(true)}
                    aria-label="Cambiar fecha"
                    className={`fixed top-3 right-3 md:top-4 md:right-4 z-[140] w-11 h-11 rounded-full backdrop-blur-xl flex items-center justify-center group ${theme === 'dark' ? 'bg-black/70' : 'bg-white/80'}`}
                    style={{
                        transform: floatingDate ? 'scale(1) translateY(0) rotate(0deg)' : 'scale(0.2) translateY(-32px) rotate(-120deg)',
                        opacity: floatingDate ? 1 : 0,
                        pointerEvents: floatingDate ? 'auto' : 'none',
                        transition: 'transform 520ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 320ms ease-out',
                        border: `1.5px solid ${activeColor.hex}`,
                        boxShadow: `0 0 0 3px ${activeColor.hex}1F, 0 0 18px ${activeColor.hex}66, 0 8px 24px rgba(0,0,0,0.35)`,
                    }}
                >
                    <span className="absolute inset-0 rounded-full opacity-40 group-hover:opacity-70 transition-opacity" style={{ background: `radial-gradient(circle at 50% 50%, ${activeColor.hex}33 0%, transparent 70%)` }} />
                    <CalendarDays size={18} className={`relative ${activeColor.text}`} strokeWidth={2.5} />
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
                    comparativa: dashboardWidgets?.comparativa !== false ? (
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
                    ) : null,
                    salud: dashboardWidgets?.salud !== false ? (
                        <SaludWidget
                            metrics={saludMetrics}
                            metricsAll={saludAll.metrics}
                            savingsRate={savingsRate}
                            savingsRateAll={saludAll.savingsRate}
                            emergencyFundMonths={emergencyFundMonths}
                            emergencyFundMonthsAll={saludAll.emergencyFundMonths}
                            style={dashboardWidgets?.saludStyle || 'full'}
                            onChangeStyle={(s) => setDashboardWidgets(prev => ({ ...prev, saludStyle: s }))}
                            t={t}
                            theme={theme}
                            activeColor={activeColor}
                            privacyMode={privacyMode}
                        />
                    ) : null,
                    historical: dashboardWidgets?.historical !== false ? (
                        <HistoricalAverageCard avg={historicalAverages} transactions={transactions} t={t} theme={theme} privacyMode={privacyMode} activeColor={activeColor} />
                    ) : null,
                    pie: dashboardWidgets?.pie !== false ? (
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
                    ) : null,
                    fixedInfo: dashboardWidgets?.fixedInfo ? (
                        <FixedInfoWidget recurringRules={recurringRules} t={t} theme={theme} activeColor={activeColor} privacyMode={privacyMode} />
                    ) : null,
                    nextExpense: dashboardWidgets?.nextExpense ? (
                        <NextExpenseWidget recurringRules={recurringRules} transactions={transactions} t={t} theme={theme} activeColor={activeColor} privacyMode={privacyMode} getCatColor={getCatColor} />
                    ) : null,
                    savings: dashboardWidgets?.savings ? (
                        <SavingsWidget
                            items={(savingsWidgets || []).filter(w => (w.kind || 'savings') === 'savings')}
                            rules={recurringRules || []}
                            transactions={transactions}
                            onAdd={addSavingsWidget}
                            onUpdate={updateSavingsWidget}
                            onDelete={deleteSavingsWidget}
                            onAdjust={adjustSavingsWidget}
                            onReopen={reopenSavingsWidget}
                            onLink={linkSavingsRule}
                            t={t}
                            theme={theme}
                            activeColor={activeColor}
                            privacyMode={privacyMode}
                        />
                    ) : null,
                    debts: dashboardWidgets?.debts ? (
                        <DebtsWidget
                            items={(savingsWidgets || []).filter(w => w.kind === 'debt')}
                            rules={recurringRules || []}
                            transactions={transactions}
                            onAdd={addSavingsWidget}
                            onUpdate={updateSavingsWidget}
                            onDelete={deleteSavingsWidget}
                            onAdjust={adjustSavingsWidget}
                            onReopen={reopenSavingsWidget}
                            onLink={linkSavingsRule}
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
                    saludGauge: null,
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
                    budgets: dashboardWidgets?.budgets ? (
                        <BudgetsWidget
                            t={t}
                            theme={theme}
                            activeColor={activeColor}
                            privacyMode={privacyMode}
                        />
                    ) : null,
                }}
                activeColor={activeColor}
            />
        </div>
    );
};

const DEFAULT_ORDER = ['comparativa', 'salud', 'historical', 'pie', 'fixedInfo', 'nextExpense', 'savings', 'debts', 'budgets', 'proyeccion', 'radarHabitos', 'lineComparativa'];

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
    };
    // In editMode, drag listeners attach ONLY to the grip handle so the rest of the widget stays interactive.
    // Outside editMode, listeners attach to the wrapper (long-press 480ms triggers drag, taps still pass through to children).
    const wrapperListeners = editMode ? {} : listeners;
    const wrapperAttributes = editMode ? {} : attributes;
    return (
        <div ref={setNodeRef} style={{ ...style, touchAction: editMode ? 'auto' : 'auto' }} {...wrapperAttributes} {...wrapperListeners}>
            <div className={`relative ${editMode && !isDragging ? 'animate-wiggle' : ''}`}>
                {editMode && (
                    <button
                        type="button"
                        {...attributes}
                        {...listeners}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute -top-2 -left-2 z-30 w-9 h-9 rounded-full bg-black/80 text-white border border-white/15 shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing"
                        style={{ touchAction: 'none' }}
                        title="Arrastrar"
                    >
                        <GripVertical size={16} />
                    </button>
                )}
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
                    <div className="space-y-6 md:space-y-8" data-tour="widgets-grid">
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

const WHEEL_ITEM_H = 36;
const WHEEL_VISIBLE = 5;

const WheelColumn = ({ items, value, onChange, onCommit, theme }) => {
    const ref = useRef(null);
    const idx = items.findIndex(i => i.value === value);
    const lockRef = useRef(null);

    useEffect(() => {
        if (!ref.current || idx < 0) return;
        ref.current.scrollTop = idx * WHEEL_ITEM_H;
    }, []);

    const handleScroll = () => {
        if (!ref.current) return;
        if (lockRef.current) clearTimeout(lockRef.current);
        lockRef.current = setTimeout(() => {
            const i = Math.round(ref.current.scrollTop / WHEEL_ITEM_H);
            const clamped = Math.max(0, Math.min(items.length - 1, i));
            const v = items[clamped]?.value;
            ref.current.scrollTop = clamped * WHEEL_ITEM_H;
            if (v != null && v !== value) onChange(v);
        }, 90);
    };

    const pad = (WHEEL_VISIBLE - 1) / 2 * WHEEL_ITEM_H;
    return (
        <div className="relative flex-1" style={{ height: WHEEL_VISIBLE * WHEEL_ITEM_H }}>
            <div
                ref={ref}
                onScroll={handleScroll}
                className="overflow-y-auto h-full no-scrollbar"
                style={{ scrollSnapType: 'y mandatory', paddingTop: pad, paddingBottom: pad, scrollBehavior: 'smooth' }}
            >
                {items.map(it => (
                    <button
                        key={it.value}
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            const i = items.findIndex(x => x.value === it.value);
                            if (ref.current) ref.current.scrollTop = i * WHEEL_ITEM_H;
                            onChange(it.value);
                            if (onCommit) onCommit(it.value);
                        }}
                        className={`w-full flex items-center justify-center font-black text-sm tracking-tight transition-opacity ${it.value === value ? 'opacity-100' : 'opacity-40'}`}
                        style={{ height: WHEEL_ITEM_H, scrollSnapAlign: 'center' }}
                    >
                        {it.label}
                    </button>
                ))}
            </div>
            <div className="pointer-events-none absolute inset-0">
                <div className={`absolute inset-x-0 top-0 ${theme === 'dark' ? 'bg-gradient-to-b from-black/70 via-black/40' : 'bg-gradient-to-b from-white via-white/70'} to-transparent`} style={{ height: pad }} />
                <div className={`absolute inset-x-0 bottom-0 ${theme === 'dark' ? 'bg-gradient-to-t from-black/70 via-black/40' : 'bg-gradient-to-t from-white via-white/70'} to-transparent`} style={{ height: pad }} />
                <div className={`absolute inset-x-0 border-y ${theme === 'dark' ? 'border-white/10' : 'border-gray-300'}`} style={{ top: pad, height: WHEEL_ITEM_H }} />
            </div>
        </div>
    );
};

const PieHalf = ({ heading, subtitle, data, onTitleClick, side, active, onSliceClick, theme, t, colorOverride }) => {
    const total = data.reduce((a, b) => a + b.val, 0);
    const slices = buildSlices(data, total, 62, 80, 80, colorOverride);
    return (
        <div className="flex flex-col gap-3">
            <div className={`flex items-center justify-between gap-1 p-1 rounded-xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                <span className="text-[9px] font-black uppercase tracking-widest opacity-50 px-1 shrink-0">{heading}</span>
                <button onClick={onTitleClick} className={`flex items-center gap-1 text-[11px] font-black tracking-tight px-2 py-1 rounded-lg min-w-0 ${t.hover}`}>
                    <span className="truncate">{subtitle}</span>
                    <ChevronDown size={11} className="opacity-60 shrink-0" />
                </button>
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
    const [pickerSide, setPickerSide] = useState(null); // 'month' | 'year' | null
    const dragStartX = useRef(null);
    const panelRef = useRef(null);

    const monthItems = useMemo(() => {
        const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        return months.map((m, i) => ({ value: i, label: m.toUpperCase() }));
    }, []);

    const yearItems = useMemo(() => {
        const cur = new Date().getFullYear();
        const arr = [];
        for (let y = cur - 10; y <= cur + 5; y++) arr.push({ value: y, label: String(y) });
        return arr;
    }, []);

    useEffect(() => { setSubActive(null); }, [active?.side, active?.cat]);

    useEffect(() => {
        if (!active && !pickerSide) return;
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setActive(null);
                setSubActive(null);
                setPickerSide(null);
            }
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [active, pickerSide]);

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
                    {pickerSide === 'month' ? (
                        <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                            <div className={`flex items-center justify-between gap-1 p-1 rounded-xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-50 px-1 shrink-0">Mes</span>
                                <button onClick={() => setPickerSide(null)} className={`flex items-center gap-1 text-[11px] font-black tracking-tight px-2 py-1 rounded-lg ${activeColor.bg} text-white min-w-0`}>
                                    <span className="truncate">{pieMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}</span>
                                    <ChevronDown size={11} className="rotate-180 shrink-0" />
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <WheelColumn items={monthItems} value={pieMonth.getMonth()} onChange={(v) => setPieMonth(d => { const n = new Date(d); n.setMonth(v); return n; })} onCommit={() => setPickerSide(null)} theme={theme} />
                                <WheelColumn items={yearItems} value={pieMonth.getFullYear()} onChange={(v) => setPieMonth(d => { const n = new Date(d); n.setFullYear(v); return n; })} onCommit={() => setPickerSide(null)} theme={theme} />
                            </div>
                        </div>
                    ) : (
                        <PieHalf
                            heading="Mes"
                            subtitle={pieMonth.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
                            data={pieMonthData}
                            onTitleClick={(e) => { e.stopPropagation(); setPickerSide('month'); }}
                            side="month"
                            active={active}
                            onSliceClick={handleSliceClick}
                            theme={theme}
                            t={t}
                            colorOverride={colorOverride}
                        />
                    )}
                </div>
                <div className="pl-2 md:pl-4">
                    {pickerSide === 'year' ? (
                        <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                            <div className={`flex items-center justify-between gap-1 p-1 rounded-xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-50 px-1 shrink-0">Año</span>
                                <button onClick={() => setPickerSide(null)} className={`flex items-center gap-1 text-[11px] font-black tracking-tight px-2 py-1 rounded-lg ${activeColor.bg} text-white min-w-0`}>
                                    <span className="truncate">{pieYear}</span>
                                    <ChevronDown size={11} className="rotate-180 shrink-0" />
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <WheelColumn items={yearItems} value={pieYear} onChange={(v) => setPieYear(v)} onCommit={() => setPickerSide(null)} theme={theme} />
                            </div>
                        </div>
                    ) : (
                        <PieHalf
                            heading="Año"
                            subtitle={String(pieYear)}
                            data={pieYearData}
                            onTitleClick={(e) => { e.stopPropagation(); setPickerSide('year'); }}
                            side="year"
                            active={active}
                            onSliceClick={handleSliceClick}
                            theme={theme}
                            t={t}
                            colorOverride={colorOverride}
                        />
                    )}
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
                <h3 className="text-sm font-black tracking-tight uppercase">{showAll ? 'Hábitos · Histórico' : 'Hábitos del Periodo'}</h3>
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
    const monthProgress = (stats.elapsed / stats.total) * 100;

    return (
        <div ref={ref} className={`p-6 md:p-7 rounded-[32px] border ${t.card} relative overflow-hidden`}>
            <div className="absolute inset-0 pointer-events-none opacity-30" style={{ background: `radial-gradient(circle at 100% 0%, ${accent}1A 0%, transparent 50%)` }} />
            <div className="relative">
                <div className="mb-5">
                    <h3 className="text-sm font-black tracking-tight uppercase">Proyección · {stats.monthLabel}</h3>
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

                    <div className="flex items-center gap-3">
                        <div className="relative h-2.5 rounded-full overflow-hidden flex-1" style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                            <div
                                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
                                style={{
                                    width: `${animate * Math.min(paceClamped, 100)}%`,
                                    background: themeGradient(accent),
                                    boxShadow: `0 0 14px ${accent}77`,
                                }}
                            />
                            {paceClamped > 100 && (
                                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${animate * 100}%`, background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0 6px, transparent 6px 12px)' }} />
                            )}
                        </div>
                        <div className="text-right leading-tight shrink-0">
                            <p className="text-[8px] font-black uppercase tracking-widest opacity-50 whitespace-nowrap">Día {stats.elapsed}/{stats.total}</p>
                            <p className="text-base font-black tabular-nums leading-none mt-0.5" style={{ color: accent }}>{Math.round(animate * monthProgress)}%</p>
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
    const didSwipe = useRef(false);
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);
    const [selectedCats, setSelectedCats] = useState(() => {
        try {
            const raw = localStorage.getItem('linecomp_selected_cats');
            if (!raw) return null;
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : null;
        } catch { return null; }
    });
    const [showSelector, setShowSelector] = useState(false);
    const [showLegend, setShowLegend] = useState(false);

    useEffect(() => {
        if (!ref.current) return;
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } });
        }, { threshold: 0.2 });
        obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);

    // Force selector first time user reaches mode 1 (only when never chosen — selectedCats === null)
    useEffect(() => {
        if (mode === 1 && selectedCats === null) setShowSelector(true);
    }, [mode, selectedCats]);

    const persistCats = (arr) => {
        setSelectedCats(arr);
        try { localStorage.setItem('linecomp_selected_cats', JSON.stringify(arr)); } catch {}
    };

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

    const onTouchStart = (e) => { startX.current = e.touches[0].clientX; startY.current = e.touches[0].clientY; lockedAxis.current = null; didSwipe.current = false; setIsDragging(true); };
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
        if (lockedAxis.current === 'x') didSwipe.current = true;
        if (Math.abs(dx) > 60) animateTo(dx < 0 ? 1 : -1);
    };

    const W = 720, H = 280, padLeft = 44, padRight = 20, padTop = 20, padBottom = 32;
    const innerW = W - padLeft - padRight;
    const innerH = H - padTop - padBottom;
    const n = chartData.length;
    const xAt = (i) => padLeft + (i * innerW) / Math.max(n - 1, 1);

    const niceMax = (v) => {
        if (v <= 0) return 1;
        const exp = Math.floor(Math.log10(v));
        const f = v / Math.pow(10, exp);
        const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
        return nf * Math.pow(10, exp);
    };
    const fmtAxis = (v) => {
        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
        if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
        return Math.round(v).toString();
    };

    // Mode 0: total income/expense lines
    const totalSeries = useMemo(() => {
        const incomes = chartData.map(d => d.income || 0);
        const expenses = chartData.map(d => d.expense || 0);
        const rawMax = Math.max(...incomes, ...expenses, 1);
        const max = niceMax(rawMax);
        const yAt = (v) => padTop + innerH - (v / max) * innerH;
        return {
            max,
            yAt,
            income: incomes.map((v, i) => ({ x: xAt(i), y: yAt(v), v })),
            expense: expenses.map((v, i) => ({ x: xAt(i), y: yAt(v), v })),
        };
    }, [chartData]);

    // All categories ranked by total (used for selector)
    const allCatsRanked = useMemo(() => {
        const cats = new Set();
        chartCategoryData.forEach(m => (m.expenseBreak || []).forEach(b => cats.add(b.cat)));
        return Array.from(cats).map(cat => {
            const values = chartCategoryData.map(m => {
                const found = (m.expenseBreak || []).find(b => b.cat === cat);
                return found ? found.val : 0;
            });
            const total = values.reduce((a, b) => a + b, 0);
            return { cat, values, total };
        }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);
    }, [chartCategoryData]);

    // Mode 1: per-category expense lines (filtered by selectedCats)
    const catSeries = useMemo(() => {
        const filterSet = selectedCats && selectedCats.length > 0 ? new Set(selectedCats) : null;
        const series = filterSet
            ? allCatsRanked.filter(s => filterSet.has(s.cat))
            : allCatsRanked.slice(0, 8);
        const rawMax = Math.max(...series.flatMap(s => s.values), 1);
        const max = niceMax(rawMax);
        const yAt = (v) => padTop + innerH - (v / max) * innerH;
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
    }, [allCatsRanked, selectedCats]);

    // Monotone cubic (Fritsch-Carlson) — smooth, no overshoot below 0
    const smoothPath = (pts) => {
        const m = pts.length;
        if (m === 0) return '';
        if (m === 1) return `M ${pts[0].x} ${pts[0].y}`;
        const dxs = [], dys = [], slopes = [];
        for (let i = 0; i < m - 1; i++) {
            const dx = pts[i + 1].x - pts[i].x;
            const dy = pts[i + 1].y - pts[i].y;
            dxs.push(dx); dys.push(dy);
            slopes.push(dx === 0 ? 0 : dy / dx);
        }
        const tans = new Array(m);
        tans[0] = slopes[0];
        tans[m - 1] = slopes[m - 2];
        for (let i = 1; i < m - 1; i++) {
            tans[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
        }
        for (let i = 0; i < m - 1; i++) {
            if (slopes[i] === 0) {
                tans[i] = 0; tans[i + 1] = 0;
            } else {
                const a = tans[i] / slopes[i];
                const b = tans[i + 1] / slopes[i];
                const h = a * a + b * b;
                if (h > 9) {
                    const t = 3 / Math.sqrt(h);
                    tans[i] = t * a * slopes[i];
                    tans[i + 1] = t * b * slopes[i];
                }
            }
        }
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < m - 1; i++) {
            const dx = (pts[i + 1].x - pts[i].x) / 3;
            const cp1x = pts[i].x + dx;
            const cp1y = pts[i].y + tans[i] * dx;
            const cp2x = pts[i + 1].x - dx;
            const cp2y = pts[i + 1].y - tans[i + 1] * dx;
            d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`;
        }
        return d;
    };

    const yTicks = useMemo(() => {
        const max = mode === 0 ? totalSeries.max : catSeries.max;
        return [0, 0.25, 0.5, 0.75, 1].map(p => ({
            v: max * p,
            y: padTop + innerH - p * innerH,
        }));
    }, [mode, totalSeries.max, catSeries.max, innerH, padTop]);

    const xLabel = (lbl) => {
        if (!lbl) return '';
        const s = String(lbl).trim();
        const first = s.split(/\s+/)[0];
        return first.slice(0, 3).toLowerCase();
    };
    const labelStride = n <= 12 ? 1 : Math.ceil(n / 12);

    const enterTransform = transitionDir !== 0 && transitioning
        ? `translateX(${transitionDir * 18}%) scale(.94)`
        : `translateX(${dragX * 0.6}px) scale(${1 - Math.min(0.04, Math.abs(dragX) / 1800)})`;
    const enterOpacity = (transitioning && transitionDir !== 0) ? 0 : 1;

    const incomePath = smoothPath(totalSeries.income);
    const expensePath = smoothPath(totalSeries.expense);
    const incomeArea = `${incomePath} L ${xAt(n - 1)} ${padTop + innerH} L ${xAt(0)} ${padTop + innerH} Z`;
    const expenseArea = `${expensePath} L ${xAt(n - 1)} ${padTop + innerH} L ${xAt(0)} ${padTop + innerH} Z`;

    return (
        <div ref={ref} className={`p-6 md:p-8 rounded-[32px] border ${t.card} relative overflow-hidden`}>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-sm font-black tracking-tight uppercase">Tendencias {selectedChartYear}</h3>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${t.textSec}`}>{mode === 0 ? 'Ingresos vs Gastos' : 'Por categoría'}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowLegend(s => !s)}
                        className={`p-1.5 rounded-lg border transition-all ${showLegend ? `${activeColor.bg} text-white border-transparent` : `${t.hover} ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'} opacity-70`}`}
                        title={showLegend ? 'Ocultar leyenda' : 'Mostrar leyenda'}
                    >
                        <Info size={14} />
                    </button>
                    <button onClick={() => setSelectedChartYear(y => y - 1)} className={`p-1.5 rounded-lg ${t.hover}`}><ChevronLeft size={16} /></button>
                    <span className="text-sm font-black">{selectedChartYear}</span>
                    <button onClick={() => setSelectedChartYear(y => y + 1)} className={`p-1.5 rounded-lg ${t.hover}`}><ChevronRight size={16} /></button>
                </div>
            </div>

            <div
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onClick={() => {
                    if (didSwipe.current) { didSwipe.current = false; return; }
                    if (transitioning) return;
                    if (mode === 1) setShowSelector(true);
                }}
                style={{ touchAction: 'pan-y', cursor: mode === 1 ? 'pointer' : 'default' }}
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
                        preserveAspectRatio="xMidYMid meet"
                        className="w-full h-auto block"
                        style={{ aspectRatio: `${W} / ${H}` }}
                        onMouseLeave={() => setHoverIdx(null)}
                    >
                        <defs>
                            <linearGradient id="lineIncomeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#30D158" stopOpacity="0.28" />
                                <stop offset="60%" stopColor="#30D158" stopOpacity="0.06" />
                                <stop offset="100%" stopColor="#30D158" stopOpacity="0" />
                            </linearGradient>
                            <linearGradient id="lineExpenseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#FF453A" stopOpacity="0.28" />
                                <stop offset="60%" stopColor="#FF453A" stopOpacity="0.06" />
                                <stop offset="100%" stopColor="#FF453A" stopOpacity="0" />
                            </linearGradient>
                            <clipPath id="lineClipPlot">
                                <rect x={padLeft} y={padTop - 4} width={innerW} height={innerH + 8} />
                            </clipPath>
                        </defs>

                        {/* Y grid + tick labels */}
                        {yTicks.map((tk, i) => (
                            <g key={i}>
                                <line
                                    x1={padLeft} x2={W - padRight}
                                    y1={tk.y} y2={tk.y}
                                    stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}
                                    strokeDasharray={i === 0 ? '0' : '2 4'}
                                    strokeWidth={i === 0 ? 1 : 1}
                                />
                                <text
                                    x={padLeft - 8}
                                    y={tk.y + 3}
                                    textAnchor="end"
                                    fontSize="9.5"
                                    fontWeight="700"
                                    fill={theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)'}
                                >
                                    {fmtAxis(tk.v)}
                                </text>
                            </g>
                        ))}

                        <g clipPath="url(#lineClipPlot)">
                            {mode === 0 ? (
                                <g style={{ opacity: visible ? 1 : 0, transition: 'opacity .5s ease' }}>
                                    <path d={incomeArea} fill="url(#lineIncomeGrad)" style={{ opacity: visible ? 1 : 0, transition: 'opacity .9s ease .3s' }} />
                                    <path d={expenseArea} fill="url(#lineExpenseGrad)" style={{ opacity: visible ? 1 : 0, transition: 'opacity .9s ease .4s' }} />
                                    <path d={incomePath} fill="none" stroke="#30D158" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                                        style={{
                                            strokeDasharray: 2000,
                                            strokeDashoffset: visible ? 0 : 2000,
                                            transition: 'stroke-dashoffset 1.4s cubic-bezier(.6,0,.3,1)',
                                            filter: 'drop-shadow(0 1px 3px rgba(48,209,88,0.35))',
                                        }}
                                    />
                                    <path d={expensePath} fill="none" stroke="#FF453A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                                        style={{
                                            strokeDasharray: 2000,
                                            strokeDashoffset: visible ? 0 : 2000,
                                            transition: 'stroke-dashoffset 1.4s cubic-bezier(.6,0,.3,1) .15s',
                                            filter: 'drop-shadow(0 1px 3px rgba(255,69,58,0.35))',
                                        }}
                                    />
                                    {totalSeries.income.map((p, i) => (
                                        <circle key={`i-${i}`} cx={p.x} cy={p.y} r={hoverIdx === i ? 4.5 : 2.8} fill="#30D158" stroke="#000" strokeWidth="1.2" vectorEffect="non-scaling-stroke"
                                            style={{ opacity: visible ? 1 : 0, transition: `opacity .3s ease ${0.8 + i * 0.04}s, r .2s ease` }} />
                                    ))}
                                    {totalSeries.expense.map((p, i) => (
                                        <circle key={`e-${i}`} cx={p.x} cy={p.y} r={hoverIdx === i ? 4.5 : 2.8} fill="#FF453A" stroke="#000" strokeWidth="1.2" vectorEffect="non-scaling-stroke"
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
                                                strokeWidth="1.8"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                vectorEffect="non-scaling-stroke"
                                                style={{
                                                    strokeDasharray: 2000,
                                                    strokeDashoffset: visible ? 0 : 2000,
                                                    transition: `stroke-dashoffset 1.2s cubic-bezier(.6,0,.3,1) ${idx * 0.08}s`,
                                                    filter: `drop-shadow(0 1px 2px ${line.color}55)`,
                                                }}
                                            />
                                            {line.points.map((p, i) => (
                                                <circle key={i} cx={p.x} cy={p.y} r={hoverIdx === i ? 3.8 : 2.4} fill={line.color} stroke="#000" strokeWidth="1" vectorEffect="non-scaling-stroke"
                                                    style={{ opacity: visible ? 1 : 0, transition: `opacity .3s ease ${0.6 + idx * 0.08 + i * 0.02}s, r .2s ease` }} />
                                            ))}
                                        </g>
                                    ))}
                                </g>
                            )}
                        </g>

                        {/* hover overlay */}
                        {chartData.map((_, i) => (
                            <rect key={i} x={xAt(i) - innerW / (n * 2)} y={padTop} width={innerW / n} height={innerH}
                                fill="transparent"
                                onMouseEnter={() => setHoverIdx(i)}
                            />
                        ))}
                        {hoverIdx != null && (
                            <line x1={xAt(hoverIdx)} x2={xAt(hoverIdx)} y1={padTop} y2={padTop + innerH}
                                stroke={theme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                        )}

                        {/* x labels */}
                        {chartData.map((d, i) => {
                            const show = i % labelStride === 0 || i === n - 1;
                            if (!show) return null;
                            return (
                                <text key={i} x={xAt(i)} y={padTop + innerH + 18} textAnchor="middle" fontSize="9.5" fontWeight="700"
                                    fill={hoverIdx === i ? (theme === 'dark' ? '#fff' : '#000') : (theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)')}>
                                    {xLabel(d.label)}
                                </text>
                            );
                        })}
                    </svg>
                </div>
            </div>

            {/* Legend / hover info — oculta por defecto, toggle con botón Info */}
            {showLegend && (
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
            )}

            <div className="flex justify-center gap-2 mt-4">
                {[0, 1].map(idx => (
                    <button key={idx} onClick={() => idx !== mode && animateTo(idx > mode ? 1 : -1)} className={`h-1.5 rounded-full transition-all ${mode === idx ? `w-8 bg-current opacity-80` : 'w-1.5 bg-current opacity-20'}`} />
                ))}
            </div>

            {showSelector && mode === 1 && createPortal(
                <div
                    className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onPointerDownCapture={e => e.stopPropagation()}
                    onTouchStartCapture={e => e.stopPropagation()}
                    onMouseDownCapture={e => e.stopPropagation()}
                    onClick={() => setShowSelector(false)}
                >
                    <div
                        className={`w-full max-w-md max-h-[85vh] flex flex-col rounded-[28px] border shadow-2xl ${t.card} ${t.bg} animate-in zoom-in-95 duration-200`}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-5 pb-3 shrink-0">
                            <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                                <BarChart3 size={16} className={activeColor.text} /> Categorías a mostrar
                            </h3>
                            <button type="button" onClick={() => setShowSelector(false)} className={`p-2 rounded-xl ${t.hover}`}>×</button>
                        </div>
                        {allCatsRanked.length === 0 ? (
                            <p className={`text-center py-8 px-5 text-sm font-bold opacity-30 ${t.textSec}`}>Sin gastos en {selectedChartYear}.</p>
                        ) : (
                            <>
                                <div className="flex gap-2 px-5 mb-3 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => persistCats(allCatsRanked.slice(0, 8).map(s => s.cat))}
                                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${t.hover}`}
                                    >Top 8</button>
                                    <button
                                        type="button"
                                        onClick={() => persistCats([])}
                                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${t.hover}`}
                                    >Limpiar</button>
                                </div>
                                <div className="space-y-1.5 px-5 overflow-y-auto flex-1 min-h-0">
                                    {allCatsRanked.map(s => {
                                        const isOn = (selectedCats || []).includes(s.cat);
                                        const color = getCatColor(s.cat);
                                        return (
                                            <button
                                                type="button"
                                                key={s.cat}
                                                onClick={() => {
                                                    const cur = selectedCats || [];
                                                    persistCats(isOn ? cur.filter(c => c !== s.cat) : [...cur, s.cat]);
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${isOn ? (theme === 'dark' ? 'bg-white/[0.06] border-white/10' : 'bg-gray-100 border-gray-300') : (theme === 'dark' ? 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]' : 'bg-white border-gray-200 hover:bg-gray-50')}`}
                                            >
                                                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color, boxShadow: isOn ? `0 0 8px ${color}77` : 'none' }} />
                                                <span className="flex-1 text-left text-xs font-black truncate">{s.cat}</span>
                                                <span className="text-[10px] font-black tabular-nums opacity-60">{s.total.toFixed(0)}€</span>
                                                {isOn && <Check size={14} className="text-green-500 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-2 p-5 pt-3 shrink-0 border-t border-white/5">
                                    <button
                                        type="button"
                                        onClick={() => setShowSelector(false)}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest ${activeColor.bg} text-white`}
                                    >Aplicar ({(selectedCats || []).length})</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

// ===================== SALUD FINANCIERA · FULL =====================
const SaludFull = ({ metrics, savingsRate, emergencyFundMonths, theme, privacyMode }) => {
    const [viewRef, visible] = useInViewOnce(0.2);
    const animScore = useCountUp(metrics.score || 0, visible, 1200);
    const animBurn = useCountUp(metrics.dailyBurn || 0, visible, 1100);
    const animSavings = useCountUp(savingsRate || 0, visible, 1000);
    const animColchon = useCountUp(emergencyFundMonths || 0, visible, 1100);
    const animFixed = useCountUp(metrics.fixedRatio || 0, visible, 1100);
    const animCash = useCountUp(metrics.cashFlow || 0, visible, 1100);

    const r = 48;
    const C = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(animScore, 100));
    const offset = C * (1 - pct / 100);

    const fmt = (v) => privacyMode ? '••••' : `${Math.round(v).toLocaleString('es-ES')}€`;
    const cashCls = (metrics.cashFlow || 0) >= 0 ? 'text-green-500' : 'text-red-500';

    const tiles = [
        { label: 'Tasa Ahorro', value: `${animSavings.toFixed(0)}%`, sub: (savingsRate || 0) >= 20 ? 'óptimo' : (savingsRate || 0) >= 10 ? 'bajo' : 'crítico', color: (savingsRate || 0) >= 20 ? '#30D158' : (savingsRate || 0) >= 10 ? '#FFD60A' : '#FF453A', Icon: TrendingUp, progress: Math.max(0, Math.min(animSavings, 30)) / 30 },
        { label: 'Colchón', value: `${animColchon.toFixed(1)}m`, sub: (emergencyFundMonths || 0) >= 3 ? 'cubierto' : (emergencyFundMonths || 0) >= 1 ? 'parcial' : 'expuesto', color: (emergencyFundMonths || 0) >= 3 ? '#30D158' : (emergencyFundMonths || 0) >= 1 ? '#FFD60A' : '#FF453A', Icon: ShieldCheck, progress: Math.max(0, Math.min(animColchon, 6)) / 6 },
        { label: 'Burn Rate', value: privacyMode ? '••••' : `${Math.round(animBurn).toLocaleString('es-ES')}€`, sub: 'gasto / día', color: '#0A84FF', Icon: Zap, progress: 0 },
        { label: '% Fijos', value: `${animFixed.toFixed(0)}%`, sub: metrics.fixedRatio < 50 ? 'controlado' : metrics.fixedRatio < 80 ? 'alto' : 'crítico', color: metrics.fixedRatio < 50 ? '#30D158' : metrics.fixedRatio < 80 ? '#FF9F0A' : '#FF453A', Icon: Repeat, progress: Math.max(0, Math.min(animFixed, 100)) / 100 },
    ];

    return (
        <div ref={viewRef} className="flex items-stretch gap-3 md:gap-4">
            <div className={`relative flex flex-col items-center justify-center px-2 md:px-3 py-2 rounded-2xl shrink-0 ${theme === 'dark' ? 'bg-white/[0.02]' : 'bg-gray-50/50'}`}>
                <div className="relative">
                    <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
                        <defs>
                            <linearGradient id="saludScoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#FF453A" />
                                <stop offset="35%" stopColor="#FFD60A" />
                                <stop offset="70%" stopColor="#A6E22E" />
                                <stop offset="100%" stopColor="#30D158" />
                            </linearGradient>
                        </defs>
                        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="9" />
                        <circle cx="60" cy="60" r={r} fill="none" stroke="url(#saludScoreGrad)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.4s linear', filter: `drop-shadow(0 0 8px ${metrics.color}AA)` }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black tabular-nums tracking-tighter leading-none" style={{ color: metrics.color }}>{Math.round(animScore)}</span>
                        <span className="text-[7px] font-black uppercase tracking-[0.18em] opacity-50 mt-0.5">Score</span>
                    </div>
                </div>
                <div className="mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest" style={{ backgroundColor: `${metrics.color}1F`, color: metrics.color, border: `1px solid ${metrics.color}55` }}>{metrics.label}</div>
                <div className={`mt-1 text-[9px] font-bold flex items-center gap-1 ${cashCls}`}>
                    {(metrics.cashFlow || 0) >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                    <span className="tabular-nums">{(metrics.cashFlow || 0) >= 0 ? '+' : ''}{fmt(animCash)}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 md:gap-2 flex-1 min-w-0">
                {tiles.map((tile, idx) => {
                    const Icon = tile.Icon;
                    return (
                        <div key={tile.label} className={`relative px-2.5 py-2 rounded-xl border overflow-hidden flex flex-col items-center justify-center text-center ${theme === 'dark' ? 'bg-white/[0.03] border-white/5' : 'bg-white border-gray-200'}`} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)', transition: `opacity 480ms ease-out ${idx * 80}ms, transform 480ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 80}ms` }}>
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <div className="p-0.5 rounded" style={{ backgroundColor: `${tile.color}1F` }}><Icon size={9} style={{ color: tile.color }} strokeWidth={2.6} /></div>
                                <p className="text-[8px] font-black uppercase tracking-wider opacity-60 leading-none truncate">{tile.label}</p>
                            </div>
                            <p className="text-base font-black tabular-nums tracking-tight leading-none" style={{ color: tile.color }}>{tile.value}</p>
                            <p className="text-[8px] font-bold uppercase tracking-wider opacity-40 mt-0.5">{tile.sub}</p>
                            {tile.progress > 0 && (
                                <div className={`mt-1 h-0.5 w-full rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                                    <div className="h-full rounded-full" style={{ width: `${tile.progress * 100}%`, background: `linear-gradient(90deg, ${tile.color}AA 0%, ${tile.color} 100%)`, boxShadow: `0 0 5px ${tile.color}88`, transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ===================== SALUD FINANCIERA · SIMPLE (gauge) =====================
const SaludSimple = ({ metrics, theme }) => {
    const ratio = metrics.income > 0 ? Math.min(200, (metrics.expense / metrics.income) * 100) : 0;
    return (
        <div className="py-1">
            <p className={`text-[11px] mb-2 opacity-60`}>Ratio gasto sobre ingresos.</p>
            <GaugeChart percentage={ratio} theme={theme} />
        </div>
    );
};

// ===================== SALUD FINANCIERA WIDGET =====================
const SaludWidget = ({ metrics, metricsAll, savingsRate, savingsRateAll, emergencyFundMonths, emergencyFundMonthsAll, style = 'full', onChangeStyle, t, theme, activeColor, privacyMode }) => {
    const [showAll, setShowAll] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [controlsOpen, setControlsOpen] = useState(false);
    const rootRef = useRef(null);
    const m = showAll ? metricsAll : metrics;
    const sr = showAll ? savingsRateAll : savingsRate;
    const ef = showAll ? emergencyFundMonthsAll : emergencyFundMonths;

    useEffect(() => {
        if (!controlsOpen && !pickerOpen) return;
        const handler = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setControlsOpen(false);
                setPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [controlsOpen, pickerOpen]);

    return (
        <div
            ref={rootRef}
            data-tour="salud-widget"
            onClick={() => setControlsOpen(true)}
            role="button"
            tabIndex={0}
            className={`p-4 md:p-5 rounded-[32px] border cursor-pointer transition-transform active:scale-[0.99] ${t.card}`}
        >
            <div className="flex items-center gap-2 mb-3 flex-nowrap">
                <h3 className="text-xs font-black tracking-tight uppercase whitespace-nowrap truncate">Salud Financiera</h3>
                <button
                    onClick={(e) => { e.stopPropagation(); setPickerOpen(p => !p); setControlsOpen(true); }}
                    className={`ml-auto p-1.5 rounded-lg border transition-all duration-300 ${(controlsOpen || pickerOpen) ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-2 pointer-events-none'} ${pickerOpen ? `${activeColor.bg} text-white border-transparent` : theme === 'dark' ? 'bg-white/[0.04] border-white/5 hover:bg-white/[0.08]' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                    title="Cambiar estilo"
                >
                    <Layers size={11} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); setShowAll(s => !s); setControlsOpen(true); }}
                    className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-1.5 py-1 rounded border transition-all ${showAll ? `${activeColor.bg} text-white border-transparent` : theme === 'dark' ? 'bg-white/[0.04] border-white/5 hover:bg-white/[0.08] opacity-70' : 'bg-white border-gray-200 hover:bg-gray-50 opacity-70'}`}
                    title={showAll ? 'Volver al periodo' : 'Ver histórico'}
                >
                    {showAll ? 'Histórico' : 'Periodo'}
                </button>
            </div>

            {pickerOpen && (
                <div onClick={(e) => e.stopPropagation()} className={`grid grid-cols-2 gap-2 mb-3 p-2 rounded-2xl border ${theme === 'dark' ? 'bg-black/30 border-white/5' : 'bg-gray-50 border-gray-200'}`} style={{ animation: 'hangDropIn 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
                    {[
                        { id: 'simple', label: 'Simple', desc: 'Ratio gasto / ingreso' },
                        { id: 'full',   label: 'Completo', desc: 'Score + métricas' },
                    ].map(opt => {
                        const isActive = style === opt.id;
                        return (
                            <button
                                key={opt.id}
                                onClick={() => { onChangeStyle && onChangeStyle(opt.id); setPickerOpen(false); }}
                                className={`p-2 rounded-xl border text-left transition-all ${isActive ? `${activeColor.border} ${theme === 'dark' ? 'bg-white/[0.06]' : 'bg-white'} shadow-md` : `${theme === 'dark' ? 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]' : 'bg-white border-gray-200 hover:bg-gray-50'}`}`}
                            >
                                <div className={`h-16 mb-1.5 rounded-lg overflow-hidden flex items-center justify-center pointer-events-none ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-gray-100'}`}>
                                    {opt.id === 'simple' ? (
                                        <svg viewBox="0 0 100 60" className="w-3/4 h-3/4">
                                            <defs>
                                                <linearGradient id={`prevGauge_${opt.id}`} x1="0" x2="1">
                                                    <stop offset="0%" stopColor="#30D158" />
                                                    <stop offset="50%" stopColor="#FFD60A" />
                                                    <stop offset="100%" stopColor="#FF453A" />
                                                </linearGradient>
                                            </defs>
                                            <path d="M 10 50 A 40 40 0 0 1 90 50" stroke={`url(#prevGauge_${opt.id})`} strokeWidth="6" strokeLinecap="round" fill="none" />
                                            <circle cx="62" cy="20" r="3" fill="currentColor" />
                                        </svg>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <div className="w-7 h-7 rounded-full border-2" style={{ borderColor: activeColor.hex, borderTopColor: 'transparent', transform: 'rotate(45deg)' }} />
                                            <div className="grid grid-cols-2 gap-0.5">
                                                {[0,1,2,3].map(k => <div key={k} className="w-3 h-2 rounded-sm" style={{ background: theme==='dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }} />)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${isActive ? activeColor.text : ''}`}>{opt.label}{isActive && ' ·'}</p>
                                <p className="text-[9px] font-bold opacity-50 truncate">{opt.desc}</p>
                            </button>
                        );
                    })}
                </div>
            )}

            {style === 'simple' ? (
                <SaludSimple metrics={m} theme={theme} />
            ) : (
                <SaludFull metrics={m} savingsRate={sr} emergencyFundMonths={ef} theme={theme} privacyMode={privacyMode} />
            )}
        </div>
    );
};

// ===================== HISTORICAL AVG CARD =====================
const HistoricalAverageCard = ({ avg, transactions = [], t, theme, privacyMode, activeColor }) => {
    const [viewRef, visible] = useInViewOnce(0.2);
    const [mode, setMode] = useState('all'); // 'all' | 'prev'

    const prevMonthAvg = useMemo(() => {
        const now = new Date();
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const ym = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
        const list = transactions.filter(tx => (tx.date || '').startsWith(ym));
        const daysInMonth = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
        const totalIncome = list.filter(t => t.type === 'income').reduce((a, b) => a + (b.amountVal || 0), 0);
        const totalExpense = list.filter(t => t.type === 'expense').reduce((a, b) => a + (b.amountVal || 0), 0);
        const monthLabel = prev.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        return {
            days: list.length ? daysInMonth : 0,
            dailyIncome: totalIncome / daysInMonth,
            dailyExpense: totalExpense / daysInMonth,
            netDaily: (totalIncome - totalExpense) / daysInMonth,
            monthlyIncome: totalIncome,
            monthlyExpense: totalExpense,
            label: monthLabel,
        };
    }, [transactions]);

    const data = mode === 'prev' ? prevMonthAvg : avg;
    const dailyIncome = useCountUp(data.dailyIncome || 0, visible);
    const dailyExpense = useCountUp(data.dailyExpense || 0, visible);
    const dailyNet = useCountUp(data.netDaily || 0, visible);
    const monthlyIncome = useCountUp(data.monthlyIncome || 0, visible);
    const monthlyExpense = useCountUp(data.monthlyExpense || 0, visible);
    const monthlyNet = useCountUp((data.monthlyIncome || 0) - (data.monthlyExpense || 0), visible);
    const fmt = (v) => privacyMode ? '••••' : `${(v || 0).toFixed(0)}€`;
    const items = [
        { key: 'income',  label: 'Ingreso', daily: dailyIncome,  monthly: monthlyIncome, color: '#30D158', textCls: 'text-green-500', Icon: TrendingUp },
        { key: 'expense', label: 'Gasto',   daily: dailyExpense, monthly: monthlyExpense, color: '#FF453A', textCls: 'text-red-500',   Icon: TrendingDown },
        { key: 'net',     label: 'Balance', daily: dailyNet,     monthly: monthlyNet, color: '#0A84FF', textCls: 'text-blue-500', Icon: Wallet },
    ];
    return (
        <div
            ref={viewRef}
            onClick={() => setMode(m => m === 'all' ? 'prev' : 'all')}
            className={`p-4 md:p-5 rounded-[32px] border cursor-pointer transition-all ${t.card}`}
        >
            <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs font-black tracking-tight uppercase">{mode === 'prev' ? `Promedio ${data.label || ''}` : 'Promedios Históricos'}</h3>
                <span className={`ml-auto text-[9px] font-black uppercase tracking-widest opacity-40`}>{mode === 'prev' ? 'Mes anterior' : `${data.days || 0} días`}</span>
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
    const [expanded, setExpanded] = useState(false);
    const allUpcoming = useMemo(() => {
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
        return out;
    }, [recurringRules, transactions]);

    const upcoming = expanded ? allUpcoming.slice(0, 10) : allUpcoming.slice(0, 3);

    const fmt = (v) => privacyMode ? '••••' : `${(v || 0).toFixed(0)}€`;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    return (
        <div
            ref={viewRef}
            onClick={() => allUpcoming.length > 3 && setExpanded(e => !e)}
            className={`p-5 md:p-6 rounded-[32px] border ${t.card} ${allUpcoming.length > 3 ? 'cursor-pointer' : ''}`}
        >
            <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-black tracking-tight">Próximos gastos</h3>
                <span className={`ml-auto text-[10px] font-black uppercase tracking-widest opacity-40 flex items-center gap-1`}>
                    top {expanded ? Math.min(10, allUpcoming.length) : 3}
                    {allUpcoming.length > 3 && <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />}
                </span>
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

const SavingsWidget = ({ items, rules, transactions, onAdd, onUpdate, onDelete, onAdjust, onReopen, onLink, t, theme, activeColor, privacyMode }) => {
    const [viewRef, visible] = useInViewOnce(0.15);
    const rootRef = useRef(null);
    const setRefs = (el) => { rootRef.current = el; if (viewRef && typeof viewRef === 'object') viewRef.current = el; };
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
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
    const [autoPanelId, setAutoPanelId] = useState(null);

    useEffect(() => {
        const anyOpen = controlsOpen || showForm || autoPanelId || expandedId;
        if (!anyOpen) return;
        const handler = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setControlsOpen(false);
                setShowForm(false);
                setEditingId(null);
                setAutoPanelId(null);
                setExpandedId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [controlsOpen, showForm, autoPanelId, expandedId]);

    const active = items.filter(i => !i.completed_at);
    const completed = items.filter(i => i.completed_at);

    const linkedIdsOf = (it) => Array.isArray(it.linked_rule_ids)
        ? it.linked_rule_ids
        : (it.linked_rule_id ? [it.linked_rule_id] : []);

    const ruleProgress = useMemo(() => {
        const map = {};
        items.forEach(it => {
            if (linkedIdsOf(it).length === 0) return;
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

    const resetForm = () => {
        setName(''); setTarget(''); setLinkedRule(''); setTargetDate(''); setDurationN(''); setDateModeState('none');
        setEditingId(null); setShowForm(false);
    };

    const startEdit = (it) => {
        setEditingId(it.id);
        setName(it.name || '');
        setTarget(String(it.target || ''));
        const linked = Array.isArray(it.linked_rule_ids) ? it.linked_rule_ids[0] : it.linked_rule_id;
        setLinkedRule(linked || '');
        if (it.target_date) {
            setDateModeState('date');
            setTargetDate(it.target_date);
        } else {
            setDateModeState('none');
            setTargetDate('');
        }
        setDurationN(''); setDurationUnit('months');
        setShowForm(true);
    };

    const submit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const tVal = target ? parseFloat(target) : 0;
        if (editingId && onUpdate) {
            const updates = {
                name: name.trim(),
                target: tVal,
                target_date: computeTargetDate(),
                linked_rule_ids: linkedRule ? [linkedRule] : [],
            };
            if ('linked_rule_id' in updates) delete updates.linked_rule_id;
            onUpdate(editingId, updates);
        } else {
            onAdd({
                name: name.trim(),
                target: tVal,
                linkedRuleId: linkedRule || null,
                targetDate: computeTargetDate(),
            });
        }
        resetForm();
    };

    const accentHex = '#30D158';

    return (
        <div
            ref={setRefs}
            onClick={() => setControlsOpen(o => !o)}
            className={`p-6 md:p-8 rounded-[32px] border cursor-pointer ${t.card}`}
        >
            <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-black tracking-tight">Ahorros & Objetivos</h3>
                </div>
                <div className={`flex items-center gap-2 transition-all duration-300 ${controlsOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'}`}>
                    {completed.length > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); setShowCompleted(true); }} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${t.hover} opacity-70 hover:opacity-100 flex items-center gap-1.5`}>
                            <Award size={12} /> {completed.length}
                        </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); if (showForm) resetForm(); else { setEditingId(null); setShowForm(true); } }} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${activeColor.bg} text-white flex items-center gap-1.5`}>
                        <Plus size={12} /> Nuevo
                    </button>
                </div>
            </div>

            {showForm && (
                <form onSubmit={submit} className={`p-4 mb-4 rounded-2xl border space-y-3 animate-in slide-in-from-top-2 ${theme === 'dark' ? 'bg-black/30 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="grid grid-cols-2 gap-3">
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" className={`p-3 rounded-xl text-sm font-bold ${t.input}`} />
                        <input type="number" step="0.01" value={target} onChange={e => setTarget(e.target.value)} placeholder="Meta (€) opcional" className={`p-3 rounded-xl text-sm font-bold ${t.input}`} />
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
                        <button type="button" onClick={resetForm} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest ${t.hover}`}>Cancelar</button>
                        <button type="submit" className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest ${activeColor.bg} text-white`}>{editingId ? 'Guardar' : 'Crear'}</button>
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
                        const linkedIds = linkedIdsOf(it);
                        const linkedRules = linkedIds.map(id => rules.find(r => r.id === id)).filter(Boolean);
                        const adj = adjustState[it.id] ?? '';
                        const isAutoOpen = autoPanelId === it.id;
                        const expenseRules = rules.filter(r => r.active && r.type === 'expense');
                        const sortedAutoRules = [
                            ...expenseRules.filter(r => !linkedIds.includes(r.id)),
                            ...expenseRules.filter(r => linkedIds.includes(r.id)),
                        ];
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
                                {it.target <= 0 ? (
                                    /* Open savings (no target) — single compact row, fancy */
                                    <div
                                        className="relative flex items-center gap-3 flex-nowrap min-w-0 overflow-hidden rounded-xl"
                                        style={{
                                            background: theme === 'dark'
                                                ? `linear-gradient(120deg, ${accentHex}1a 0%, ${accentHex}05 45%, transparent 100%)`
                                                : `linear-gradient(120deg, ${accentHex}24 0%, ${accentHex}0d 45%, transparent 100%)`,
                                            boxShadow: `inset 0 0 0 1px ${accentHex}22`,
                                            padding: '10px 14px',
                                        }}
                                    >
                                        <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: `linear-gradient(180deg, ${accentHex} 0%, ${accentHex}55 100%)` }} />
                                        <p className="font-black text-base tracking-tight truncate min-w-0 flex-1 pl-2">{it.name}</p>
                                        <div className="text-right shrink-0 leading-tight">
                                            <p className="text-[8.5px] font-black uppercase tracking-widest opacity-60">Acumulado</p>
                                            <p
                                                className="text-lg font-black tabular-nums"
                                                style={{
                                                    background: `linear-gradient(135deg, ${shadeColor(accentHex, 0.25)} 0%, ${accentHex} 100%)`,
                                                    WebkitBackgroundClip: 'text',
                                                    WebkitTextFillColor: 'transparent',
                                                    backgroundClip: 'text',
                                                }}
                                            >{fmt(total)}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-black text-base tracking-tight truncate">{it.name}</p>
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-50 flex items-center gap-1.5 flex-nowrap whitespace-nowrap min-w-0">
                                                <span className="shrink-0">Meta {fmt(it.target)}</span>
                                                {targetDateObj && (
                                                    <span className={`shrink-0 px-1.5 py-0.5 rounded ${daysLeft != null && daysLeft < 0 ? 'bg-red-500/15 text-red-500' : daysLeft != null && daysLeft <= 30 ? 'bg-yellow-500/15 text-yellow-500' : 'bg-blue-500/15 text-blue-400'}`}>
                                                        {formatDuration(daysLeft)}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {it.target > 0 && (
                                    /* Animated progress bar */
                                    <div className="relative">
                                        <div className={`h-3 w-full rounded-full overflow-hidden relative ${theme === 'dark' ? 'bg-white/[0.06]' : 'bg-gray-200'}`}>
                                            <div
                                                className="h-full rounded-full relative overflow-hidden"
                                                style={{
                                                    width: `${animPct}%`,
                                                    background: themeGradient(accentHex),
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
                                )}

                                {ruleAmt > 0 && (
                                    <div className={`mt-3 p-2 rounded-lg text-[10px] font-bold flex items-center gap-1.5 ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                        <Link2 size={11} /> {fmt(ruleAmt)} desde automatización
                                    </div>
                                )}

                                {/* Expand on click */}
                                <div className={`grid transition-all duration-400 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                                    <div className="overflow-hidden space-y-2">
                                        <div onClick={(e) => e.stopPropagation()} className="flex gap-1.5">
                                            <input type="number" step="0.01" value={adj} onChange={e => setAdjustState(s => ({ ...s, [it.id]: e.target.value }))} placeholder="Cantidad" className={`flex-1 min-w-0 p-2 rounded-lg text-xs font-bold ${t.input}`} />
                                            <button onClick={() => { const v = parseFloat(adj); if (v > 0) { onAdjust(it.id, v); setAdjustState(s => ({ ...s, [it.id]: '' })); } }} className="p-2 rounded-lg bg-green-500 text-white shrink-0" title="Sumar"><Plus size={14} /></button>
                                            <button onClick={() => { const v = parseFloat(adj); if (v > 0) { onAdjust(it.id, -v); setAdjustState(s => ({ ...s, [it.id]: '' })); } }} className="p-2 rounded-lg bg-red-500 text-white shrink-0" title="Restar"><Minus size={14} /></button>
                                            {onLink && (
                                                <button onClick={(e) => { e.stopPropagation(); setAutoPanelId(prev => prev === it.id ? null : it.id); }} className={`flex items-center gap-1 px-2 py-2 rounded-lg border shrink-0 ${isAutoOpen ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-yellow-400/15 text-yellow-500 border-yellow-400/30 hover:bg-yellow-400/25'}`} title="Vincular automatización">
                                                    <Zap size={14} />
                                                    {linkedRules.length > 0 && <span className="text-[10px] font-black tabular-nums">{linkedRules.length}</span>}
                                                </button>
                                            )}
                                            <button onClick={() => setConfirmDelete({ id: it.id, name: it.name })} className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 border border-red-500/30 shrink-0" title="Eliminar"><Trash2 size={14} /></button>
                                        </div>
                                        {onUpdate && (
                                            <button onClick={(e) => { e.stopPropagation(); startEdit(it); }} className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-white/[0.04] border-white/5 hover:bg-white/[0.08]' : 'bg-white border-gray-200 hover:bg-gray-50'}`} title="Editar objetivo">
                                                <Pencil size={11} /> Editar
                                            </button>
                                        )}
                                        {isAutoOpen && (
                                            <div onClick={(e) => e.stopPropagation()} className={`p-3 rounded-xl border space-y-1.5 ${theme === 'dark' ? 'bg-yellow-500/[0.05] border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'}`} style={{ animation: 'hangDropIn 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
                                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1.5"><Zap size={10} /> Gastos automatizados</p>
                                                {sortedAutoRules.length === 0 ? (
                                                    <p className="text-[11px] font-bold opacity-50 py-1">No hay reglas activas de gasto.</p>
                                                ) : sortedAutoRules.map(r => {
                                                    const isLinked = linkedIds.includes(r.id);
                                                    return (
                                                        <button key={r.id} onClick={() => onLink(it.id, r.id)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${isLinked ? `${theme === 'dark' ? 'bg-white/[0.04]' : 'bg-gray-100'} opacity-50` : `${theme === 'dark' ? 'bg-white/[0.04] hover:bg-white/[0.08]' : 'bg-white hover:bg-gray-50'}`}`}>
                                                            {isLinked && <Check size={11} className="text-green-500 shrink-0" />}
                                                            <span className="flex-1 min-w-0 text-left truncate whitespace-nowrap">
                                                                <span className="font-black">{r.name || r.category}</span>
                                                                {r.subCategory && <span className="opacity-60 font-bold"> · {r.subCategory}</span>}
                                                                {r.note && r.note !== r.name && <span className="opacity-50 font-medium italic"> · {r.note}</span>}
                                                            </span>
                                                            <span className="text-[10px] opacity-60 shrink-0 tabular-nums">{r.amount}€/{r.unit}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
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

// ===================== DEBTS WIDGET =====================
const DebtsWidget = ({ items, rules = [], transactions = [], onAdd, onUpdate, onDelete, onAdjust, onLink, t, theme, activeColor, privacyMode }) => {
    const [viewRef, visible] = useInViewOnce(0.15);
    const rootRef = useRef(null);
    const setRefs = (el) => { rootRef.current = el; if (viewRef && typeof viewRef === 'object') viewRef.current = el; };
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [name, setName] = useState('');
    const [target, setTarget] = useState('');
    const [linkedRule, setLinkedRule] = useState('');
    const [dateMode, setDateModeState] = useState('none');
    const [targetDate, setTargetDate] = useState('');
    const [durationN, setDurationN] = useState('');
    const [durationUnit, setDurationUnit] = useState('months');
    const [expandedId, setExpandedId] = useState(null);
    const [adjustState, setAdjustState] = useState({});
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [controlsOpen, setControlsOpen] = useState(false);
    const [autoPanelId, setAutoPanelId] = useState(null);

    useEffect(() => {
        const anyOpen = controlsOpen || showForm || autoPanelId || expandedId;
        if (!anyOpen) return;
        const handler = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setControlsOpen(false);
                setShowForm(false);
                setEditingId(null);
                setAutoPanelId(null);
                setExpandedId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [controlsOpen, showForm, autoPanelId, expandedId]);

    const linkedIdsOf = (it) => Array.isArray(it.linked_rule_ids)
        ? it.linked_rule_ids
        : (it.linked_rule_id ? [it.linked_rule_id] : []);

    const ruleProgress = useMemo(() => {
        const map = {};
        items.forEach(it => {
            if (linkedIdsOf(it).length === 0) return;
            const totalFromRule = transactions
                .filter(tx => tx.tags?.includes('__auto__') && tx.tags?.includes(`__savings_${it.id}__`))
                .reduce((a, b) => a + (b.amountVal || 0), 0);
            map[it.id] = totalFromRule;
        });
        return map;
    }, [items, transactions]);

    const active = items.filter(i => Number(i.current || 0) < Number(i.target || 0) || Number(i.target || 0) === 0);
    const cleared = items.filter(i => Number(i.target || 0) > 0 && Number(i.current || 0) >= Number(i.target || 0));

    const fmt = (v) => privacyMode ? '••••' : `${(v || 0).toFixed(0)}€`;

    const totalRemaining = items.reduce((a, it) => a + Math.max(0, Number(it.target || 0) - Number(it.current || 0)), 0);

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

    const resetForm = () => {
        setName(''); setTarget(''); setLinkedRule(''); setTargetDate(''); setDurationN(''); setDateModeState('none');
        setEditingId(null); setShowForm(false);
    };

    const startEdit = (it) => {
        setEditingId(it.id);
        setName(it.name || '');
        setTarget(String(it.target || ''));
        const linked = Array.isArray(it.linked_rule_ids) ? it.linked_rule_ids[0] : it.linked_rule_id;
        setLinkedRule(linked || '');
        if (it.target_date) {
            setDateModeState('date');
            setTargetDate(it.target_date);
        } else {
            setDateModeState('none');
            setTargetDate('');
        }
        setDurationN(''); setDurationUnit('months');
        setShowForm(true);
    };

    const submit = (e) => {
        e.preventDefault();
        if (!name.trim() || !target) return;
        if (editingId && onUpdate) {
            onUpdate(editingId, {
                name: name.trim(),
                target: parseFloat(target),
                target_date: computeTargetDate(),
                linked_rule_ids: linkedRule ? [linkedRule] : [],
            });
        } else {
            onAdd({
                name: name.trim(),
                target: parseFloat(target),
                kind: 'debt',
                linkedRuleId: linkedRule || null,
                targetDate: computeTargetDate(),
            });
        }
        resetForm();
    };

    const accentHex = '#FF453A';

    return (
        <div
            ref={setRefs}
            onClick={() => setControlsOpen(o => !o)}
            className={`p-6 md:p-8 rounded-[32px] border cursor-pointer ${t.card}`}
        >
            <div className="flex items-center justify-between gap-2 mb-4 flex-nowrap">
                <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-base font-black tracking-tight whitespace-nowrap truncate">Saldar Deudas</h3>
                </div>
                <div className={`flex items-center gap-2 transition-all duration-300 ${controlsOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'}`}>
                    {cleared.length > 0 && (
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${t.hover} opacity-70 flex items-center gap-1.5`}>
                            <Award size={12} /> {cleared.length}
                        </span>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); if (showForm) resetForm(); else { setEditingId(null); setShowForm(true); } }} className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl bg-red-500 text-white flex items-center gap-1.5">
                        <Plus size={12} /> Nueva deuda
                    </button>
                </div>
            </div>

            {showForm && (
                <form onClick={e => e.stopPropagation()} onSubmit={submit} className={`p-4 mb-4 rounded-2xl border space-y-3 animate-in slide-in-from-top-2 ${theme === 'dark' ? 'bg-red-500/[0.04] border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                    <div className="grid grid-cols-2 gap-3">
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre (ej: Préstamo coche)" className={`p-3 rounded-xl text-sm font-bold ${t.input}`} />
                        <input type="number" step="0.01" value={target} onChange={e => setTarget(e.target.value)} placeholder="Total deuda (€)" className={`p-3 rounded-xl text-sm font-bold ${t.input}`} />
                    </div>

                    <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 opacity-60`}>Plazo (opcional)</p>
                        <div className={`flex p-1 rounded-xl border mb-2 ${theme === 'dark' ? 'bg-black/30 border-white/5' : 'bg-white border-gray-200'}`}>
                            {[
                                { v: 'none',     l: 'Sin plazo' },
                                { v: 'date',     l: 'Fecha' },
                                { v: 'duration', l: 'Duración' },
                            ].map(o => (
                                <button key={o.v} type="button" onClick={() => setDateModeState(o.v)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${dateMode === o.v ? 'bg-red-500 text-white' : 'opacity-60'}`}>{o.l}</button>
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
                        <button type="button" onClick={resetForm} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest ${t.hover}`}>Cancelar</button>
                        <button type="submit" className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-red-500 text-white">{editingId ? 'Guardar' : 'Crear'}</button>
                    </div>
                </form>
            )}

            {active.length === 0 && cleared.length === 0 ? (
                <p className={`text-center py-8 text-sm font-bold opacity-30 ${t.textSec}`}>Sin deudas registradas.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...active, ...cleared].map((it, idx) => {
                        const ruleAmt = ruleProgress[it.id] || 0;
                        const paid = Number(it.current || 0) + ruleAmt;
                        const total = Number(it.target || 0);
                        const remaining = Math.max(0, total - paid);
                        const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
                        const animPct = visible ? pct : 0;
                        const isOpen = expandedId === it.id;
                        const adj = adjustState[it.id] ?? '';
                        const isCleared = total > 0 && paid >= total;
                        const linkedIds = linkedIdsOf(it);
                        const linkedRules = linkedIds.map(id => rules.find(r => r.id === id)).filter(Boolean);
                        const isAutoOpen = autoPanelId === it.id;
                        const expenseRules = rules.filter(r => r.active && r.type === 'expense');
                        const sortedAutoRules = [
                            ...expenseRules.filter(r => !linkedIds.includes(r.id)),
                            ...expenseRules.filter(r => linkedIds.includes(r.id)),
                        ];
                        return (
                            <div
                                key={it.id}
                                onClick={(e) => { e.stopPropagation(); setExpandedId(prev => prev === it.id ? null : it.id); }}
                                style={{
                                    opacity: visible ? 1 : 0,
                                    transform: visible ? 'translateY(0)' : 'translateY(10px)',
                                    transition: `opacity .5s ease ${idx * 80}ms, transform .5s cubic-bezier(.2,.8,.2,1) ${idx * 80}ms`,
                                }}
                                className={`p-5 rounded-2xl border cursor-pointer transition-all duration-300 ${isOpen ? 'border-red-500/40 shadow-lg scale-[1.01]' : theme === 'dark' ? 'border-white/5 bg-white/[0.03] hover:border-white/10' : 'border-gray-200 bg-gray-50 hover:border-gray-300'} ${isCleared ? 'opacity-60' : ''}`}
                            >
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-black text-base tracking-tight truncate flex items-center gap-2">
                                            {it.name}
                                            {isCleared && <Award size={12} className="text-green-500 shrink-0" />}
                                        </p>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-50 flex items-center gap-1.5 flex-nowrap whitespace-nowrap min-w-0">
                                            <span className="shrink-0">Deuda {fmt(total)} · Pte <span className="text-red-500">{fmt(remaining)}</span></span>
                                        </p>
                                    </div>
                                </div>

                                <div className="relative">
                                    <div className={`h-3 w-full rounded-full overflow-hidden relative ${theme === 'dark' ? 'bg-white/[0.06]' : 'bg-gray-200'}`}>
                                        <div
                                            className="h-full rounded-full relative overflow-hidden"
                                            style={{
                                                width: `${animPct}%`,
                                                background: themeGradient(accentHex),
                                                boxShadow: animPct > 0 ? `0 0 14px ${accentHex}55, inset 0 1px 0 rgba(255,255,255,.22)` : 'none',
                                                transition: `width 1.1s cubic-bezier(.2,.8,.2,1) ${idx * 80 + 200}ms`,
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
                                        <span className="opacity-60 tabular-nums">{fmt(paid)} / {fmt(total)}</span>
                                        <span className={isCleared ? 'text-green-500 flex items-center gap-1' : 'opacity-60'}>
                                            {isCleared && <Sparkles size={10} />}{pct.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>

                                <div className={`grid transition-all duration-400 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                                    <div className="overflow-hidden space-y-2">
                                        <div onClick={(e) => e.stopPropagation()} className="flex gap-1.5">
                                            <input type="number" step="0.01" value={adj} onChange={e => setAdjustState(s => ({ ...s, [it.id]: e.target.value }))} placeholder="Pago" className={`flex-1 min-w-0 p-2 rounded-lg text-xs font-bold ${t.input}`} />
                                            <button onClick={() => { const v = parseFloat(adj); if (v > 0) { onAdjust(it.id, v); setAdjustState(s => ({ ...s, [it.id]: '' })); } }} className="p-2 rounded-lg bg-green-500 text-white shrink-0" title="Pagar (sumar)"><Plus size={14} /></button>
                                            <button onClick={() => { const v = parseFloat(adj); if (v > 0) { onAdjust(it.id, -v); setAdjustState(s => ({ ...s, [it.id]: '' })); } }} className="p-2 rounded-lg bg-yellow-500 text-white shrink-0" title="Revertir pago"><Minus size={14} /></button>
                                            {onLink && (
                                                <button onClick={(e) => { e.stopPropagation(); setAutoPanelId(prev => prev === it.id ? null : it.id); }} className={`flex items-center gap-1 px-2 py-2 rounded-lg border shrink-0 ${isAutoOpen ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-yellow-400/15 text-yellow-500 border-yellow-400/30 hover:bg-yellow-400/25'}`} title="Vincular automatización">
                                                    <Zap size={14} />
                                                    {linkedRules.length > 0 && <span className="text-[10px] font-black tabular-nums">{linkedRules.length}</span>}
                                                </button>
                                            )}
                                            <button onClick={() => setConfirmDelete({ id: it.id, name: it.name })} className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 border border-red-500/30 shrink-0" title="Eliminar"><Trash2 size={14} /></button>
                                        </div>
                                        {onUpdate && (
                                            <button onClick={(e) => { e.stopPropagation(); startEdit(it); }} className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-white/[0.04] border-white/5 hover:bg-white/[0.08]' : 'bg-white border-gray-200 hover:bg-gray-50'}`} title="Editar deuda">
                                                <Pencil size={11} /> Editar
                                            </button>
                                        )}
                                        {isAutoOpen && onLink && (
                                            <div onClick={(e) => e.stopPropagation()} className={`p-3 rounded-xl border space-y-1.5 ${theme === 'dark' ? 'bg-yellow-500/[0.05] border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'}`} style={{ animation: 'hangDropIn 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
                                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1.5"><Zap size={10} /> Gastos automatizados</p>
                                                {sortedAutoRules.length === 0 ? (
                                                    <p className="text-[11px] font-bold opacity-50 py-1">No hay reglas activas de gasto.</p>
                                                ) : sortedAutoRules.map(r => {
                                                    const isLinked = linkedIds.includes(r.id);
                                                    return (
                                                        <button key={r.id} onClick={() => onLink(it.id, r.id)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${isLinked ? `${theme === 'dark' ? 'bg-white/[0.04]' : 'bg-gray-100'} opacity-50` : `${theme === 'dark' ? 'bg-white/[0.04] hover:bg-white/[0.08]' : 'bg-white hover:bg-gray-50'}`}`}>
                                                            {isLinked && <Check size={11} className="text-green-500 shrink-0" />}
                                                            <span className="flex-1 min-w-0 text-left truncate whitespace-nowrap">
                                                                <span className="font-black">{r.name || r.category}</span>
                                                                {r.subCategory && <span className="opacity-60 font-bold"> · {r.subCategory}</span>}
                                                                {r.note && r.note !== r.name && <span className="opacity-50 font-medium italic"> · {r.note}</span>}
                                                            </span>
                                                            <span className="text-[10px] opacity-60 shrink-0 tabular-nums">{r.amount}€/{r.unit}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {confirmDelete && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setConfirmDelete(null)}>
                    <div className={`w-full max-w-sm rounded-[28px] border shadow-2xl ${t.card} ${t.bg} p-6 animate-in zoom-in-95 duration-200`} onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-11 h-11 rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center shrink-0"><Trash2 size={18} /></div>
                            <div className="min-w-0">
                                <p className="font-black text-base tracking-tight">Borrar deuda</p>
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

// ===================== BUDGETS WIDGET =====================
const BUDGET_PERIODS = [
    { value: 'day',   sing: 'Día',    plur: 'Días' },
    { value: 'week',  sing: 'Semana', plur: 'Semanas' },
    { value: 'month', sing: 'Mes',    plur: 'Meses' },
    { value: 'year',  sing: 'Año',    plur: 'Años' },
];

const periodWindowStartISO = (period, count) => {
    const c = Math.max(1, Number(count) || 1);
    const d = new Date();
    let s;
    if (period === 'day')   s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (c - 1));
    else if (period === 'week') s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (c * 7 - 1));
    else if (period === 'year') s = new Date(d.getFullYear() - (c - 1), 0, 1);
    else s = new Date(d.getFullYear(), d.getMonth() - (c - 1), 1);
    return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
};

const newBudgetId = () => `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const BudgetsWidget = ({ t, theme, activeColor, privacyMode }) => {
    const { categories, budgets, setBudgets, transactions } = useFinance();
    const [expanded, setExpanded] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [pickCat, setPickCat] = useState('');
    const [pickSub, setPickSub] = useState('');
    const [newLimit, setNewLimit] = useState('');
    const [newNote, setNewNote] = useState('');
    const [newPeriod, setNewPeriod] = useState('month');
    const [newCount, setNewCount] = useState(1);
    const [notifyOn, setNotifyOn] = useState(() => localStorage.getItem('budgets_notify') === '1');
    const lastNotifiedRef = useRef({});

    const expenseCats = useMemo(() => Object.keys(categories.expense || {}), [categories]);
    const subsForPick = useMemo(() => (pickCat ? (categories.expense?.[pickCat] || []) : []), [pickCat, categories]);

    const entries = useMemo(() => Object.entries(budgets || {}), [budgets]);

    const spendingByEntry = useMemo(() => {
        const map = {};
        entries.forEach(([id, b]) => {
            if (!b || !b.cat) { map[id] = 0; return; }
            const startISO = periodWindowStartISO(b.period, b.count);
            let total = 0;
            (transactions || []).forEach(tx => {
                if (tx.type !== 'expense') return;
                if (!tx.date || tx.date < startISO) return;
                if (tx.category !== b.cat) return;
                if (b.sub && tx.subCategory !== b.sub) return;
                total += Number(tx.amountVal) || 0;
            });
            map[id] = total;
        });
        return map;
    }, [entries, transactions]);

    useEffect(() => {
        if (!notifyOn || typeof Notification === 'undefined') return;
        if (Notification.permission !== 'granted') return;
        entries.forEach(([id, b]) => {
            if (!b || !b.limit || b.limit <= 0) return;
            const spent = spendingByEntry[id] || 0;
            const pct = (spent / b.limit) * 100;
            const stamp = `${id}-${b.period}-${b.count}-${new Date().toISOString().slice(0, 10)}`;
            const prev = lastNotifiedRef.current[stamp];
            const label = b.sub ? `${b.cat} · ${b.sub}` : b.cat;
            if (pct >= 100 && prev !== 'over') {
                lastNotifiedRef.current[stamp] = 'over';
                new Notification('Presupuesto superado', { body: `${label}: ${spent.toFixed(0)}€ / ${b.limit}€`, icon: '/icon-192.png' });
            } else if (pct >= 85 && pct < 100 && !prev) {
                lastNotifiedRef.current[stamp] = 'warn';
                new Notification('Cerca del límite', { body: `${label}: ${pct.toFixed(0)}%`, icon: '/icon-192.png' });
            }
        });
    }, [entries, spendingByEntry, notifyOn]);

    const toggleNotify = async () => {
        if (notifyOn) {
            setNotifyOn(false);
            localStorage.setItem('budgets_notify', '0');
            return;
        }
        if (typeof Notification === 'undefined') return;
        let perm = Notification.permission;
        if (perm === 'default') perm = await Notification.requestPermission();
        if (perm === 'granted') {
            setNotifyOn(true);
            localStorage.setItem('budgets_notify', '1');
        }
    };

    const addEntry = () => {
        if (!pickCat || !newLimit) return;
        const id = newBudgetId();
        setBudgets({
            ...budgets,
            [id]: {
                cat: pickCat,
                sub: pickSub,
                limit: parseFloat(newLimit) || 0,
                period: newPeriod,
                count: Math.max(1, parseInt(newCount, 10) || 1),
                note: newNote.trim(),
            },
        });
        setPickCat(''); setPickSub(''); setNewLimit(''); setNewNote('');
        setNewPeriod('month'); setNewCount(1);
        setAddOpen(false);
    };
    const removeEntry = (id) => {
        const next = { ...budgets };
        delete next[id];
        setBudgets(next);
    };

    const periodLabel = (period, count) => {
        const def = BUDGET_PERIODS.find(p => p.value === period) || BUDGET_PERIODS[2];
        return count === 1 ? def.sing : `${count} ${def.plur.toLowerCase()}`;
    };

    const blur = privacyMode ? 'privacy-blur' : '';
    const accent = activeColor.hex;
    const dark = theme === 'dark';
    const showAddButton = entries.length === 0 || expanded;

    return (
        <div className={`p-6 md:p-7 rounded-[32px] border ${t.card} relative overflow-hidden`}>
            <div className="absolute inset-0 pointer-events-none opacity-30" style={{ background: `radial-gradient(circle at 100% 100%, ${accent}1A 0%, transparent 50%)` }} />
            <div className="relative space-y-4">
                {/* HEADER */}
                <div
                    className={`flex items-start justify-between gap-3 ${entries.length > 0 ? 'cursor-pointer' : ''}`}
                    onClick={() => { if (entries.length > 0) setExpanded(v => !v); }}
                >
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black tracking-tight uppercase">Presupuestos</h3>
                        <p className={`text-[11px] ${t.textSec}`}>
                            {entries.length === 0
                                ? 'Crea tu primer presupuesto.'
                                : `${entries.length} activo${entries.length === 1 ? '' : 's'} · pulsa para ${expanded ? 'cerrar' : 'expandir'}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={toggleNotify}
                            title={notifyOn ? 'Notificaciones activas' : 'Activar notificaciones'}
                            className={`p-2 rounded-xl border transition-all ${notifyOn ? `${activeColor.bg} text-white border-transparent` : (dark ? 'border-white/10 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-50')}`}
                        >
                            {notifyOn ? <Bell size={14} /> : <BellOff size={14} />}
                        </button>
                        {entries.length > 0 && (
                            <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''} opacity-60`} />
                        )}
                    </div>
                </div>

                {/* LISTA */}
                {entries.length > 0 && (
                    <div className="space-y-2 max-h-[420px] overflow-y-auto">
                        {entries.map(([id, b]) => {
                            const spent = spendingByEntry[id] || 0;
                            const limit = Number(b.limit) || 0;
                            const pct = limit > 0 ? (spent / limit) * 100 : 0;
                            const remaining = limit - spent;
                            const over = pct > 100;
                            const warn = pct > 85 && !over;
                            const barColor = over ? '#ef4444' : warn ? '#f97316' : accent;
                            const label = b.sub ? `${b.cat} · ${b.sub}` : b.cat;
                            return (
                                <div key={id} className={`group p-3.5 rounded-2xl border transition-all ${dark ? 'bg-white/[0.03] border-white/5 hover:bg-white/[0.05]' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {over && <AlertTriangle size={13} className="text-red-500 shrink-0" />}
                                                <span className="font-black text-xs truncate">{label}</span>
                                                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 ${dark ? 'bg-white/5 text-white/70' : 'bg-gray-100 text-gray-600'}`}>
                                                    {periodLabel(b.period, b.count)}
                                                </span>
                                            </div>
                                            {b.note && <p className={`text-[10px] mt-0.5 truncate ${t.textSec}`}>{b.note}</p>}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className={`font-black text-[11px] tabular-nums ${blur} opacity-80`}>{limit.toFixed(0)}€</span>
                                            <button onClick={(e) => { e.stopPropagation(); removeEntry(id); }} className="p-1 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 rounded-md">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className={`w-full h-1.5 rounded-full overflow-hidden mb-1.5 ${dark ? 'bg-white/5' : 'bg-gray-200'}`}>
                                        <div className="h-full transition-all duration-700" style={{ width: `${Math.min(100, pct)}%`, background: barColor }} />
                                    </div>
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                        <span className={`${blur} opacity-60`}>{spent.toFixed(0)}€ gastado</span>
                                        <span className={over ? 'text-red-500' : warn ? 'text-orange-500' : 'opacity-60'}>
                                            {pct.toFixed(0)}% · {remaining >= 0 ? `${remaining.toFixed(0)}€ libres` : `-${Math.abs(remaining).toFixed(0)}€`}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ADD BUTTON */}
                {showAddButton && !addOpen && (
                    <button
                        onClick={() => setAddOpen(true)}
                        className={`w-full ${entries.length === 0 ? 'py-6' : 'py-2.5'} rounded-2xl border-2 border-dashed text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${dark ? 'border-white/10 hover:border-white/20 hover:bg-white/5 text-white/60 hover:text-white' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-500 hover:text-gray-800'}`}
                    >
                        <Plus size={14} /> Añadir presupuesto
                    </button>
                )}

                {/* ADD FORM */}
                {addOpen && (
                    <div className={`p-3 rounded-2xl border ${dark ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'} space-y-2`}>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                                <select value={pickCat} onChange={e => { setPickCat(e.target.value); setPickSub(''); }} className={`appearance-none w-full p-2.5 pr-7 rounded-xl text-xs font-bold cursor-pointer ${t.input}`}>
                                    <option value="">Categoría…</option>
                                    {expenseCats.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                            </div>
                            <div className="relative">
                                <select value={pickSub} onChange={e => setPickSub(e.target.value)} disabled={!pickCat} className={`appearance-none w-full p-2.5 pr-7 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 ${t.input}`}>
                                    <option value="">{pickCat ? 'Toda la categoría' : 'Subcategoría…'}</option>
                                    {subsForPick.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                            </div>
                        </div>

                        {/* PERIODICIDAD: estilo wheel iPhone */}
                        <div className={`flex items-stretch gap-2 p-2 rounded-xl border ${dark ? 'bg-black/30 border-white/5' : 'bg-white border-gray-200'}`}>
                            <span className={`text-[10px] font-black uppercase tracking-widest self-center px-1 ${t.textSec}`}>Cada</span>
                            <div className="relative flex-1">
                                <select value={newCount} onChange={e => setNewCount(parseInt(e.target.value, 10))} className={`appearance-none w-full p-2 pr-6 rounded-lg text-center text-base font-black tabular-nums cursor-pointer ${t.input}`}>
                                    {Array.from({ length: 24 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                            </div>
                            <div className="relative flex-[1.3]">
                                <select value={newPeriod} onChange={e => setNewPeriod(e.target.value)} className={`appearance-none w-full p-2 pr-6 rounded-lg text-center text-base font-black cursor-pointer ${t.input}`}>
                                    {BUDGET_PERIODS.map(p => (
                                        <option key={p.value} value={p.value}>
                                            {newCount === 1 ? p.sing : p.plur.toLowerCase()}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input type="number" step="0.01" placeholder="Límite" value={newLimit} onChange={e => setNewLimit(e.target.value)} className={`w-full p-2.5 pr-6 rounded-xl text-xs font-bold ${t.input}`} />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-30">€</span>
                            </div>
                            <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Nota (opcional)" className={`flex-1 p-2.5 rounded-xl text-xs font-bold ${t.input}`} />
                        </div>

                        <div className="flex gap-2">
                            <button onClick={addEntry} disabled={!pickCat || !newLimit} className={`flex-1 py-2.5 rounded-xl ${activeColor.bg} text-white disabled:opacity-40 transition-all active:scale-95 flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wider`}>
                                <Plus size={14} /> Añadir
                            </button>
                            <button onClick={() => { setAddOpen(false); setPickCat(''); setPickSub(''); setNewLimit(''); setNewNote(''); setNewPeriod('month'); setNewCount(1); }} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider ${dark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


export default DashboardView;
