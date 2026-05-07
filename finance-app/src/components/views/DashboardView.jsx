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
            />
        </div>
    );
};

const tintColor = (base, idx, n) => {
    const hex = (base || '#8E8E93').replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const alpha = Math.max(0.32, 1 - idx * (0.65 / Math.max(n - 1, 1)));
    return `rgba(${r},${g},${b},${alpha})`;
};

const buildSlices = (data, total, radius, cx, cy, colorOverride) => {
    let cumulative = 0;
    const n = data.length;
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
        return {
            ...d,
            path,
            mx: Math.cos(aMid),
            my: Math.sin(aMid),
            color: colorOverride ? colorOverride(d, i, n) : (CATEGORY_COLORS[d.cat] || '#8E8E93'),
            percent: total > 0 ? (d.val / total) * 100 : 0
        };
    });
};

const Pie = ({ slices, total, size = 160, radius = 62, side, active, onSliceClick, theme, showIcons = true, label = 'Total', topLabels = 3, minLabelPercent = 6 }) => {
    const cx = size / 2;
    const cy = size / 2;
    const labelR = (radius + radius * 0.55) / 2;
    const iconPx = size > 140 ? 13 : 10;
    const fontPx = size > 140 ? 10 : 8;
    const boxW = size > 140 ? 32 : 26;
    const boxH = size > 140 ? 30 : 24;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block mx-auto">
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
                const lx = cx + labelR * s.mx + offX;
                const ly = cy + labelR * s.my + offY;
                const Ic = showIcons ? (CATEGORY_ICONS[s.cat] || Box) : null;
                return (
                    <foreignObject
                        key={`lbl-${s.cat}`}
                        x={lx - boxW / 2}
                        y={ly - boxH / 2}
                        width={boxW}
                        height={boxH}
                        opacity={dim}
                        pointerEvents="none"
                        style={{ transition: 'opacity .25s ease, x .35s, y .35s', overflow: 'visible' }}
                    >
                        <div
                            xmlns="http://www.w3.org/1999/xhtml"
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: 1,
                                color: '#fff',
                                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.55))'
                            }}
                        >
                            {Ic && <Ic size={iconPx} strokeWidth={2.6} />}
                            <span style={{ fontSize: fontPx, fontWeight: 900, marginTop: Ic ? 1 : 0 }}>
                                {s.percent.toFixed(0)}%
                            </span>
                        </div>
                    </foreignObject>
                );
            })}
            <circle cx={cx} cy={cy} r={radius * 0.55} fill={theme === 'dark' ? '#000' : '#fff'} pointerEvents="none" />
            <text x={cx} y={cy - 2} textAnchor="middle" className="font-black" fill="currentColor" fontSize={size > 140 ? 13 : 11} pointerEvents="none">{total.toFixed(0)}€</text>
            <text x={cx} y={cy + 11} textAnchor="middle" fill="currentColor" fontSize={size > 140 ? 8 : 7} opacity="0.5" className="font-bold uppercase tracking-wider" pointerEvents="none">{label}</text>
        </svg>
    );
};

const PieHalf = ({ heading, subtitle, data, onPrev, onNext, side, active, onSliceClick, theme, t }) => {
    const total = data.reduce((a, b) => a + b.val, 0);
    const slices = buildSlices(data, total, 62, 80, 80);
    return (
        <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center gap-2">
                <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">{heading}</p>
                    <p className="text-sm font-black tracking-tight truncate">{subtitle}</p>
                </div>
                <div className={`flex items-center p-1 rounded-xl border shrink-0 ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                    <button onClick={onPrev} className={`p-1.5 rounded-lg ${t.hover}`}><ChevronLeft size={14} /></button>
                    <button onClick={onNext} className={`p-1.5 rounded-lg ${t.hover}`}><ChevronRight size={14} /></button>
                </div>
            </div>
            {total === 0 ? (
                <div className={`h-[160px] flex items-center justify-center text-xs font-bold opacity-30 ${t.textSec}`}>Sin gastos.</div>
            ) : (
                <Pie slices={slices} total={total} size={160} radius={62} side={side} active={active} onSliceClick={onSliceClick} theme={theme} showIcons />
            )}
        </div>
    );
};

const PiePanel = ({ pieMonth, setPieMonth, pieYear, setPieYear, pieMonthData, pieYearData, transactions, theme, t, activeColor }) => {
    const [active, setActive] = useState(null);
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartX = useRef(null);

    const sourceData = active ? (active.side === 'month' ? pieMonthData : pieYearData) : [];
    const sourceCats = sourceData.map(d => d.cat);
    const activeIndex = active ? sourceCats.indexOf(active.cat) : -1;

    const goRel = (delta) => {
        if (!active || sourceCats.length < 2) return;
        const newIdx = (activeIndex + delta + sourceCats.length) % sourceCats.length;
        setActive({ side: active.side, cat: sourceCats[newIdx] });
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

    const color = active ? (CATEGORY_COLORS[active.cat] || '#8E8E93') : '#8E8E93';
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
                                    transform: `translateX(${dragX}px)`,
                                    transition: isDragging ? 'none' : 'transform .3s ease',
                                    touchAction: 'pan-y'
                                }}
                            >
                                <div
                                    key={`${active.side}-${active.cat}`}
                                    className="rounded-2xl border p-5 animate-in fade-in slide-in-from-right-2 duration-200"
                                    style={{ borderColor: `${color}40`, background: `${color}10` }}
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
                                                label="Subcat"
                                                topLabels={3}
                                                minLabelPercent={6}
                                            />
                                            <div className="grid grid-cols-2 gap-1.5 mt-3">
                                                {subData.slice(0, 6).map((s, i) => (
                                                    <div key={s.cat} className="flex items-center gap-2 text-[10px]">
                                                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: tintColor(color, i, subData.length) }} />
                                                        <span className="font-bold truncate flex-1">{s.cat}</span>
                                                        <span className="font-black opacity-70">{((s.val / subTotal) * 100).toFixed(0)}%</span>
                                                    </div>
                                                ))}
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

export default DashboardView;
