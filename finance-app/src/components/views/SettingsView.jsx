import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { ACCENT_COLORS, CATEGORY_COLORS } from '../../constants/theme';
import { Palette, Moon, Sun, SunMoon, Check, Settings, Trash2, LogOut, User, ChevronLeft, Sparkles, Zap, Download, Pencil, Target, LayoutGrid, Radar, BarChart3, Activity, Users, Plus, Copy, Crown, LogIn, Link2, Eye, EyeOff, X } from 'lucide-react';
import { exportMonthlyPDF, generateYearlyPDF } from '../../services/pdfService';
import AppSelect from '../common/AppSelect';
import PromptModal from '../common/PromptModal';
import { parseLocalDate, resolveCategoryColor } from '../../utils/helpers';

const SettingsView = () => {
    const {
        theme, themeMode, setThemeMode, t, accent, setAccent, activeColor,
        currentUser, logout,
        isSocial, setMode, activeHouseholdId, setActiveHouseholdId, user,
        privacyMode, setPrivacyMode
    } = useAuth();

    const {
        categories, addCustomCategory,
        deleteCustomCategory, moveCategory, addSubCategory,
        renameCategory, renameSubCategory,
        updateCategories, quickButtons, updateQuickButtons,
        transactions, jointTransactions, resetAllData,
        categoryColors, setCategoryColors,
        dashboardWidgets, setDashboardWidgets,
        households,
        createHousehold, addHouseholdMemberSlot,
        ensureHouseholdInviteToken,
        leaveHousehold, deleteHousehold, updateHousehold,
    } = useFinance();
    const [colorPickerCat, setColorPickerCat] = useState(null);

    // 3 filas × 6 colores muy distintos entre sí (rojos→amarillos→verdes→azules→morados→neutros)
    const COLOR_PALETTE = [
        '#FF3B30', '#FF6B00', '#FFB300', '#FFEB3B', '#C0CA33', '#7CB342',
        '#2ED573', '#00BFA5', '#00BCD4', '#1E88E5', '#3D5AFE', '#7C4DFF',
        '#9C27B0', '#E91E63', '#FF2D87', '#795548', '#607D8B', '#9E9E9E',
    ];

    const usedColorsByCat = {};
    Object.entries(categories || {}).forEach(([tk, sec]) => {
        Object.keys(sec || {}).forEach(c => {
            const col = (resolveCategoryColor(c, categoryColors, CATEGORY_COLORS) || '').toLowerCase();
            if (col) (usedColorsByCat[col] ||= []).push({ cat: c, type: tk });
        });
    });

    const [editingQuick, setEditingQuick] = useState(null);
    useEffect(() => {
        if (editingQuick === null) return;
        const btn = quickButtons[editingQuick];
        if (!btn || btn.category) return;
        const firstCat = Object.keys(categories[btn.type] || {})[0];
        if (!firstCat) return;
        const firstSub = (categories[btn.type] || {})[firstCat]?.[0] || '';
        const next = quickButtons.map((b, i) => i === editingQuick ? { ...b, category: firstCat, subCategory: firstSub } : b);
        updateQuickButtons(next);
    }, [editingQuick]); // eslint-disable-line react-hooks/exhaustive-deps
    const [confirmReset, setConfirmReset] = useState(false);
    const [previewWidget, setPreviewWidget] = useState(null);
    const pressTimerRef = useRef(null);
    const longPressedRef = useRef(false);
    const [reportMode, setReportMode] = useState('month');
    const [catPrompt, setCatPrompt] = useState(null);
    const [subPrompt, setSubPrompt] = useState(null);
    const [renameCatPrompt, setRenameCatPrompt] = useState(null);
    const [renameSubPrompt, setRenameSubPrompt] = useState(null);
    const now = new Date();
    const [reportMonth, setReportMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
    const [reportYear, setReportYear]   = useState(String(now.getFullYear()));
    const [reportStart, setReportStart] = useState('');
    const [reportEnd, setReportEnd]     = useState('');

    // --- HOGAR SOCIAL ---
    const [newHouseholdName, setNewHouseholdName] = useState('');
    const [creatingHousehold, setCreatingHousehold] = useState(false);
    const [expandedHouseholdId, setExpandedHouseholdId] = useState(null);
    const [slotNameByHh, setSlotNameByHh] = useState({});
    const [renameHhId, setRenameHhId] = useState(null);
    const [renameHhValue, setRenameHhValue] = useState('');
    const [copiedHh, setCopiedHh] = useState(null);
    const [hhError, setHhError] = useState(null);
    const [createHhError, setCreateHhError] = useState(null);
    const [confirmDeleteHh, setConfirmDeleteHh] = useState(null);

    const handleCreateHousehold = async () => {
        const cleanName = newHouseholdName.trim();
        if (!cleanName || creatingHousehold) return;
        setCreatingHousehold(true);
        setCreateHhError(null);
        try {
            const id = await createHousehold(cleanName, 'Yo');
            setNewHouseholdName('');
            setExpandedHouseholdId(id);
            // Hogar queda pendiente hasta que un segundo miembro acepte la invitación.
            // No activamos modo Social aquí.
        } catch (err) {
            const raw = err?.message || '';
            setCreateHhError(raw.includes('already has a household')
                ? 'Ya perteneces a un hogar. Solo puedes tener uno a la vez.'
                : (raw || 'No se pudo crear el hogar'));
        } finally {
            setCreatingHousehold(false);
        }
    };

    const handleCopyInvite = async (h) => {
        let token = h.invite_token;
        if (!token) token = await ensureHouseholdInviteToken(h.id);
        if (!token) return;
        const url = `${window.location.origin}${window.location.pathname}#joinhh/${token}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Únete al hogar "${h.name}"`,
                    text: `Únete al hogar "${h.name}" en AlCash`,
                    url,
                });
                return;
            } catch (err) {
                if (err?.name === 'AbortError') return;
            }
        }
        try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
        setCopiedHh(h.id);
        setTimeout(() => setCopiedHh(c => c === h.id ? null : c), 2000);
    };

    const handleAddSlot = async (hhId) => {
        const name = (slotNameByHh[hhId] || '').trim();
        if (!name) return;
        await addHouseholdMemberSlot(hhId, name);
        setSlotNameByHh(prev => ({ ...prev, [hhId]: '' }));
    };

    const handleRenameHousehold = async (hhId) => {
        const clean = renameHhValue.trim();
        if (!clean) { setRenameHhId(null); return; }
        await updateHousehold(hhId, { name: clean });
        setRenameHhId(null);
    };

    const handleActivateHousehold = (hhId) => {
        setActiveHouseholdId(hhId);
        setMode('social');
    };

    // Doble-tap inline (1er click pide confirmación, 2º ejecuta).
    // Evita confirm() nativo que PWA standalone suele suprimir.
    const handleLeaveOrDelete = async (h) => {
        const isOwner = h.owner_id === user?.id;
        if (confirmDeleteHh !== h.id) {
            setConfirmDeleteHh(h.id);
            setHhError(null);
            setTimeout(() => {
                setConfirmDeleteHh(prev => prev === h.id ? null : prev);
            }, 4000);
            return;
        }
        setConfirmDeleteHh(null);
        setHhError(null);
        try {
            if (isOwner) await deleteHousehold(h.id);
            else await leaveHousehold(h.id);
            setExpandedHouseholdId(null);
        } catch (err) {
            const raw = err?.message || (isOwner ? 'No se pudo borrar el hogar' : 'No se pudo salir del hogar');
            setHhError({ id: h.id, message: raw });
        }
    };

    // Long-press: 420ms hold opens preview, short tap toggles on/off.
    const startWidgetPress = (key) => {
        longPressedRef.current = false;
        if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
        pressTimerRef.current = setTimeout(() => {
            longPressedRef.current = true;
            setPreviewWidget(key);
        }, 420);
    };
    const cancelWidgetPress = () => {
        if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
    };
    const toggleWidget = (key, on) => {
        if (longPressedRef.current) { longPressedRef.current = false; return; }
        setDashboardWidgets({ ...(dashboardWidgets || {}), [key]: !on });
    };

    const WIDGETS = [
        { key: 'comparativa', label: 'Comparativa', Icon: BarChart3, defaultOn: true, desc: 'Ingresos vs gastos de los últimos 6 meses.' },
        { key: 'pie', label: 'Reparto', Icon: BarChart3, defaultOn: true, desc: 'Reparto de gastos por categoría este mes.' },
        { key: 'historical', label: 'Promedio', Icon: BarChart3, defaultOn: true, desc: 'Promedio mensual de gasto últimos 6 meses.' },
        { key: 'fixedInfo', label: 'Fijos', Icon: Zap, defaultOn: true, desc: 'Gastos automáticos activos.' },
        { key: 'salud', label: 'Salud', Icon: Activity, defaultOn: true, desc: 'Score financiero según ahorro/gasto.' },
        { key: 'savings', label: 'Ahorro', Icon: Target, desc: 'Progreso de tus metas de ahorro.' },
        { key: 'debts', label: 'Deudas', Icon: Target, desc: 'Lo que debes y te deben.' },
        { key: 'nextExpense', label: 'Próximos', Icon: Sparkles, desc: 'Próximo cargo automático.' },
        { key: 'proyeccion', label: 'Proyección', Icon: Zap, desc: 'Estimación de saldo futuro.' },
        { key: 'radarHabitos', label: 'Hábitos', Icon: Radar, desc: 'Distribución por categoría.' },
        { key: 'lineComparativa', label: 'Tendencias', Icon: BarChart3, desc: 'Tendencia mensual ingreso/gasto.' },
        { key: 'budgets', label: 'Presupuestos', Icon: Target, desc: 'Cumplimiento de tus presupuestos.' },
    ];

    const fmtEur = (n) => Number(n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    // Datos de muestra fijos · ejemplo demo, no datos reales del usuario
    const MOCK = {
        months: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
        income: [1800, 2100, 1950, 2300, 2050, 2400],
        expense: [1400, 1600, 1500, 1900, 1700, 1550],
        cats: [
            { name: 'Hogar', amount: 540, color: '#3D5AFE' },
            { name: 'Comida', amount: 320, color: '#2ED573' },
            { name: 'Transporte', amount: 180, color: '#FFB300' },
            { name: 'Ocio', amount: 140, color: '#E91E63' },
            { name: 'Suscripciones', amount: 95, color: '#7C4DFF' },
        ],
        fixed: [
            { name: 'Alquiler', date: '01/06', amount: 650, type: 'expense' },
            { name: 'Internet', date: '05/06', amount: 35, type: 'expense' },
            { name: 'Gimnasio', date: '10/06', amount: 30, type: 'expense' },
            { name: 'Nómina', date: '28/06', amount: 2100, type: 'income' },
        ],
        goals: [
            { name: 'Vacaciones', current: 850, target: 1500 },
            { name: 'Coche nuevo', current: 4200, target: 12000 },
            { name: 'Fondo emergencia', current: 2800, target: 5000 },
        ],
        budgets: [
            { label: 'Comida', spent: 320, limit: 400 },
            { label: 'Ocio', spent: 140, limit: 100 },
            { label: 'Transporte', spent: 180, limit: 250 },
        ],
        debts: { owed: 350, owe: 180 },
    };

    const Shell = ({ title, pills, children }) => (
        <div className={`p-4 md:p-5 rounded-[32px] border ${t.card}`}>
            <div className="flex items-center gap-2 mb-3 flex-nowrap">
                <h3 className="text-xs font-black tracking-tight uppercase whitespace-nowrap truncate">{title}</h3>
                {pills && <div className="ml-auto flex items-center gap-1">{pills}</div>}
            </div>
            {children}
        </div>
    );
    const Pill = ({ children, active }) => (
        <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-1 rounded border ${active ? `${activeColor.bg} text-white border-transparent` : theme === 'dark' ? 'bg-white/[0.04] border-white/5 opacity-70' : 'bg-white border-gray-200 opacity-70'}`}>
            {children}
        </span>
    );

    const renderWidgetPreview = (key) => {
        if (key === 'comparativa') {
            const max = Math.max(...MOCK.income, ...MOCK.expense);
            const totalInc = MOCK.income.reduce((s, v) => s + v, 0);
            const totalExp = MOCK.expense.reduce((s, v) => s + v, 0);
            return (
                <Shell title="Comparativa" pills={<><Pill active>2026</Pill><Pill>Mensual</Pill></>}>
                    <div className="flex items-baseline justify-between mb-3">
                        <div className="flex gap-3 text-[11px] font-black">
                            <span className="text-emerald-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />+{fmtEur(totalInc)}</span>
                            <span className="text-rose-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />-{fmtEur(totalExp)}</span>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${t.textSec}`}>6 meses</span>
                    </div>
                    <div className="flex items-end justify-between gap-2 h-40">
                        {MOCK.months.map((m, i) => (
                            <div key={m} className="flex-1 flex flex-col items-center gap-1.5">
                                <div className="w-full flex items-end justify-center gap-1 h-32">
                                    <div className="w-2/5 rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_-2px_8px_rgba(16,185,129,0.3)]" style={{ height: `${(MOCK.income[i] / max) * 100}%` }} />
                                    <div className="w-2/5 rounded-t-md bg-gradient-to-t from-rose-600 to-rose-400 shadow-[0_-2px_8px_rgba(244,63,94,0.3)]" style={{ height: `${(MOCK.expense[i] / max) * 100}%` }} />
                                </div>
                                <span className={`text-[9px] font-black uppercase ${t.textSec}`}>{m}</span>
                            </div>
                        ))}
                    </div>
                </Shell>
            );
        }
        if (key === 'lineComparativa') {
            const max = Math.max(...MOCK.income, ...MOCK.expense);
            const points = (arr) => arr.map((v, i) => `${(i / (arr.length - 1)) * 100},${100 - (v / max) * 90}`).join(' ');
            return (
                <Shell title="Tendencias" pills={<Pill active>2026</Pill>}>
                    <div className="flex items-baseline justify-between mb-3">
                        <div className="flex gap-3 text-[11px] font-black">
                            <span className="text-emerald-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Ingresos</span>
                            <span className="text-rose-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />Gastos</span>
                        </div>
                    </div>
                    <div className="relative h-40">
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                            <defs>
                                <linearGradient id="lineIncFill" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                </linearGradient>
                                <linearGradient id="lineExpFill" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <polygon fill="url(#lineIncFill)" points={`0,100 ${points(MOCK.income)} 100,100`} />
                            <polyline fill="none" stroke="#10b981" strokeWidth="1.5" points={points(MOCK.income)} vectorEffect="non-scaling-stroke" />
                            <polygon fill="url(#lineExpFill)" points={`0,100 ${points(MOCK.expense)} 100,100`} />
                            <polyline fill="none" stroke="#f43f5e" strokeWidth="1.5" points={points(MOCK.expense)} vectorEffect="non-scaling-stroke" />
                        </svg>
                    </div>
                    <div className="flex justify-between mt-1 px-0.5">
                        {MOCK.months.map(m => <span key={m} className={`text-[9px] font-black uppercase ${t.textSec}`}>{m}</span>)}
                    </div>
                </Shell>
            );
        }
        if (key === 'pie') {
            const total = MOCK.cats.reduce((s, c) => s + c.amount, 0);
            let cumulative = 0;
            const R = 38, C = 2 * Math.PI * R;
            return (
                <Shell title="Reparto" pills={<><Pill active>Mes</Pill><Pill>Año</Pill></>}>
                    <div className="flex items-center gap-4">
                        <div className="relative shrink-0" style={{ width: 112, height: 112 }}>
                            <svg width="112" height="112" viewBox="0 0 100 100" className="-rotate-90">
                                <circle cx="50" cy="50" r={R} fill="none" stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#e5e7eb'} strokeWidth="14" />
                                {MOCK.cats.map(c => {
                                    const pct = c.amount / total;
                                    const dash = pct * C;
                                    const seg = <circle key={c.name} cx="50" cy="50" r={R} fill="none" stroke={c.color} strokeWidth="14" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-cumulative} strokeLinecap="butt" />;
                                    cumulative += dash;
                                    return seg;
                                })}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-[9px] font-black uppercase opacity-50">Total</span>
                                <span className="text-sm font-black tabular-nums">{fmtEur(total)}</span>
                            </div>
                        </div>
                        <div className="flex-1 space-y-1.5 min-w-0">
                            {MOCK.cats.map(c => {
                                const pct = (c.amount / total) * 100;
                                return (
                                    <div key={c.name} className="flex items-center gap-2 text-[10px]">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}55` }} />
                                        <span className="font-bold truncate flex-1">{c.name}</span>
                                        <span className={`font-black tabular-nums ${t.textSec}`}>{pct.toFixed(0)}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Shell>
            );
        }
        if (key === 'radarHabitos') {
            const cx = 75, cy = 75, R = 55;
            const angles = MOCK.cats.map((_, i) => (i / MOCK.cats.length) * Math.PI * 2 - Math.PI / 2);
            const maxAmt = Math.max(...MOCK.cats.map(c => c.amount));
            const pts = MOCK.cats.map((c, i) => {
                const r = (c.amount / maxAmt) * R;
                return `${cx + Math.cos(angles[i]) * r},${cy + Math.sin(angles[i]) * r}`;
            }).join(' ');
            return (
                <Shell title="Hábitos">
                    <div className="flex items-center justify-center">
                        <svg width="150" height="150" viewBox="0 0 150 150">
                            {[0.33, 0.66, 1].map(s => (
                                <circle key={s} cx={cx} cy={cy} r={R * s} fill="none" stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#e5e7eb'} strokeWidth="1" />
                            ))}
                            {angles.map((a, i) => (
                                <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * R} y2={cy + Math.sin(a) * R} stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#e5e7eb'} strokeWidth="1" />
                            ))}
                            <polygon points={pts} fill={activeColor.hex || '#3D5AFE'} fillOpacity="0.25" stroke={activeColor.hex || '#3D5AFE'} strokeWidth="2" />
                            {MOCK.cats.map((c, i) => {
                                const lx = cx + Math.cos(angles[i]) * (R + 12);
                                const ly = cy + Math.sin(angles[i]) * (R + 12);
                                return <text key={c.name} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="900" fill={theme === 'dark' ? '#fff' : '#000'}>{c.name.slice(0, 6)}</text>;
                            })}
                        </svg>
                    </div>
                </Shell>
            );
        }
        if (key === 'historical') {
            const avg = MOCK.expense.reduce((s, v) => s + v, 0) / MOCK.expense.length;
            const thisMonth = MOCK.expense[MOCK.expense.length - 1];
            const diff = thisMonth - avg;
            const max = Math.max(...MOCK.expense);
            return (
                <Shell title="Promedio">
                    <div className="flex items-baseline justify-between mb-3">
                        <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>Promedio 6 meses</p>
                            <p className={`text-2xl font-black tabular-nums ${activeColor.text}`}>{fmtEur(avg)}</p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-full ${diff > 0 ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                            {diff > 0 ? '↑' : '↓'} {fmtEur(Math.abs(diff))}
                        </span>
                    </div>
                    <div className="flex items-end gap-1 h-16 mb-2">
                        {MOCK.expense.map((v, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                                <div className={`w-full rounded-t-md ${i === MOCK.expense.length - 1 ? (diff > 0 ? 'bg-rose-500' : 'bg-emerald-500') : (theme === 'dark' ? 'bg-white/15' : 'bg-gray-300')}`} style={{ height: `${(v / max) * 100}%` }} />
                                <span className={`text-[9px] font-black ${t.textSec}`}>{MOCK.months[i]}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-baseline justify-between pt-2 border-t border-white/5">
                        <span className={`text-[10px] font-black uppercase ${t.textSec}`}>Este mes</span>
                        <span className={`text-sm font-black tabular-nums ${diff > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{fmtEur(thisMonth)}</span>
                    </div>
                </Shell>
            );
        }
        if (key === 'fixedInfo') {
            const totalExp = MOCK.fixed.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
            const totalInc = MOCK.fixed.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
            return (
                <Shell title="Gastos fijos" pills={<Pill active>Mensual</Pill>}>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-50'} border border-emerald-500/20`}>
                            <p className="text-[9px] font-black uppercase text-emerald-500 tracking-widest">Ingresos</p>
                            <p className="text-base font-black text-emerald-500 tabular-nums">{fmtEur(totalInc)}</p>
                        </div>
                        <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-rose-500/10' : 'bg-rose-50'} border border-rose-500/20`}>
                            <p className="text-[9px] font-black uppercase text-rose-500 tracking-widest">Gastos</p>
                            <p className="text-base font-black text-rose-500 tabular-nums">{fmtEur(totalExp)}</p>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        {MOCK.fixed.map(r => (
                            <div key={r.name} className={`flex items-center justify-between p-2 rounded-xl ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
                                <div className="min-w-0 flex-1 flex items-center gap-2.5">
                                    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${r.type === 'income' ? 'bg-emerald-500/15' : 'bg-rose-500/15'}`}>
                                        <span className={`text-xs font-black ${r.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>{r.type === 'income' ? '+' : '−'}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black truncate">{r.name}</p>
                                        <p className={`text-[9px] font-bold ${t.textSec}`}>{r.date}</p>
                                    </div>
                                </div>
                                <span className={`text-xs font-black tabular-nums shrink-0 ${r.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>{fmtEur(r.amount)}</span>
                            </div>
                        ))}
                    </div>
                </Shell>
            );
        }
        if (key === 'nextExpense') {
            const next = MOCK.fixed.filter(r => r.type === 'expense')[0];
            return (
                <Shell title="Próximos">
                    <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-gray-50'} flex items-center gap-4`}>
                        <div className="shrink-0 w-14 h-14 rounded-2xl bg-rose-500/15 flex items-center justify-center">
                            <span className="text-2xl font-black text-rose-500">−</span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className={`text-[9px] font-black uppercase tracking-widest ${t.textSec} mb-0.5`}>Próximo cargo</p>
                            <p className="text-base font-black truncate">{next.name}</p>
                            <p className={`text-[10px] font-bold ${t.textSec}`}>{next.date} · En 4 días</p>
                        </div>
                        <span className="text-xl font-black text-rose-500 tabular-nums shrink-0">{fmtEur(next.amount)}</span>
                    </div>
                </Shell>
            );
        }
        if (key === 'salud' || key === 'saludGauge') {
            const inc = MOCK.income.reduce((s, v) => s + v, 0);
            const exp = MOCK.expense.reduce((s, v) => s + v, 0);
            const ratio = Math.max(0, Math.min(100, ((inc - exp) / inc) * 100));
            const R = 46, C = 2 * Math.PI * R;
            const dash = (ratio / 100) * C;
            return (
                <Shell title="Salud Financiera" pills={<Pill active>Completo</Pill>}>
                    <div className="flex items-center gap-4 mb-3">
                        <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
                            <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
                                <circle cx="60" cy="60" r={R} fill="none" stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#e5e7eb'} strokeWidth="10" />
                                <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" className={activeColor.text} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${C - dash}`} style={{ filter: `drop-shadow(0 0 6px ${activeColor.hex || '#3D5AFE'}80)` }} />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-4xl font-black ${activeColor.text} leading-none tabular-nums`}>{ratio.toFixed(0)}</span>
                                <span className="text-[9px] font-black uppercase opacity-50 mt-1 tracking-widest">/ 100</span>
                            </div>
                        </div>
                        <div className="flex-1 space-y-1.5 min-w-0">
                            <div className="flex items-baseline justify-between">
                                <span className={`text-[10px] font-black uppercase ${t.textSec}`}>Tasa ahorro</span>
                                <span className={`text-xs font-black ${activeColor.text} tabular-nums`}>{ratio.toFixed(0)}%</span>
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className={`text-[10px] font-black uppercase ${t.textSec}`}>Reserva</span>
                                <span className="text-xs font-black tabular-nums">3.2 meses</span>
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className={`text-[10px] font-black uppercase ${t.textSec}`}>Volatilidad</span>
                                <span className="text-xs font-black text-emerald-500">Baja</span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
                        <div className="text-center">
                            <p className={`text-[9px] font-black uppercase ${t.textSec}`}>Ingresos</p>
                            <p className="text-xs font-black text-emerald-500 tabular-nums">{fmtEur(inc)}</p>
                        </div>
                        <div className="text-center">
                            <p className={`text-[9px] font-black uppercase ${t.textSec}`}>Gastos</p>
                            <p className="text-xs font-black text-rose-500 tabular-nums">{fmtEur(exp)}</p>
                        </div>
                        <div className="text-center">
                            <p className={`text-[9px] font-black uppercase ${t.textSec}`}>Ahorro</p>
                            <p className={`text-xs font-black ${activeColor.text} tabular-nums`}>{fmtEur(inc - exp)}</p>
                        </div>
                    </div>
                </Shell>
            );
        }
        if (key === 'savings') {
            return (
                <Shell title="Metas de ahorro" pills={<Pill active>{MOCK.goals.length}</Pill>}>
                    <div className="space-y-3">
                        {MOCK.goals.map(g => {
                            const pct = Math.min(100, (g.current / g.target) * 100);
                            return (
                                <div key={g.name} className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
                                    <div className="flex justify-between text-[11px] font-bold mb-1.5">
                                        <span className="truncate flex items-center gap-1.5"><Target size={11} className={activeColor.text} /> {g.name}</span>
                                        <span className={`tabular-nums ${t.textSec}`}>{fmtEur(g.current)} / {fmtEur(g.target)}</span>
                                    </div>
                                    <div className={`h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                                        <div className={`h-full rounded-full ${activeColor.bg}`} style={{ width: `${pct}%`, boxShadow: `0 0 6px ${activeColor.hex || '#3D5AFE'}80` }} />
                                    </div>
                                    <p className={`text-[9px] font-black uppercase mt-1 ${activeColor.text}`}>{pct.toFixed(0)}% completado</p>
                                </div>
                            );
                        })}
                    </div>
                </Shell>
            );
        }
        if (key === 'debts') {
            const net = MOCK.debts.owed - MOCK.debts.owe;
            return (
                <Shell title="Deudas">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                            <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Te deben</p>
                            <p className="text-2xl font-black text-emerald-500 mt-1 tabular-nums">{fmtEur(MOCK.debts.owed)}</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                            <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Debes</p>
                            <p className="text-2xl font-black text-rose-500 mt-1 tabular-nums">{fmtEur(MOCK.debts.owe)}</p>
                        </div>
                    </div>
                    <div className={`flex items-baseline justify-between p-2.5 rounded-xl ${net >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>Saldo neto</span>
                        <span className={`text-base font-black tabular-nums ${net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{net >= 0 ? '+' : ''}{fmtEur(net)}</span>
                    </div>
                </Shell>
            );
        }
        if (key === 'proyeccion') {
            const avgInc = MOCK.income.reduce((s, v) => s + v, 0) / MOCK.income.length;
            const avgExp = MOCK.expense.reduce((s, v) => s + v, 0) / MOCK.expense.length;
            const monthly = avgInc - avgExp;
            const rows = [
                { label: '1 mes', value: monthly },
                { label: '3 meses', value: monthly * 3 },
                { label: '6 meses', value: monthly * 6 },
            ];
            const big = monthly * 12;
            return (
                <Shell title="Proyección" pills={<Pill active>Lineal</Pill>}>
                    <div className={`p-3 rounded-2xl mb-3 ${big >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${t.textSec} mb-1`}>En 12 meses</p>
                        <p className={`text-3xl font-black tabular-nums ${big >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{big >= 0 ? '+' : ''}{fmtEur(big)}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {rows.map(r => (
                            <div key={r.label} className={`p-2 rounded-xl text-center ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
                                <p className={`text-[9px] font-black uppercase ${t.textSec}`}>{r.label}</p>
                                <p className={`text-xs font-black tabular-nums ${r.value >= 0 ? activeColor.text : 'text-rose-500'}`}>{r.value >= 0 ? '+' : ''}{fmtEur(r.value)}</p>
                            </div>
                        ))}
                    </div>
                </Shell>
            );
        }
        if (key === 'budgets') {
            return (
                <Shell title="Presupuestos" pills={<Pill active>Mes</Pill>}>
                    <div className="space-y-3">
                        {MOCK.budgets.map(b => {
                            const pct = Math.min(100, (b.spent / b.limit) * 100);
                            const over = b.spent > b.limit;
                            return (
                                <div key={b.label} className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
                                    <div className="flex justify-between text-[11px] font-bold mb-1.5">
                                        <span className="truncate">{b.label}</span>
                                        <span className={`tabular-nums ${over ? 'text-rose-500 font-black' : t.textSec}`}>{fmtEur(b.spent)} / {fmtEur(b.limit)}</span>
                                    </div>
                                    <div className={`h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                                        <div className={`h-full rounded-full ${over ? 'bg-rose-500' : activeColor.bg}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <p className={`text-[9px] font-black uppercase mt-1 ${over ? 'text-rose-500' : t.textSec}`}>{over ? `Excedido +${fmtEur(b.spent - b.limit)}` : `${(100 - pct).toFixed(0)}% disponible`}</p>
                                </div>
                            );
                        })}
                    </div>
                </Shell>
            );
        }
        return <p className={`text-xs font-bold ${t.textSec}`}>Sin vista previa.</p>;
    };

    const handleDownloadReport = () => {
        const year = parseInt(reportYear);
        if (reportMode === 'year') {
            generateYearlyPDF(transactions, jointTransactions, year, activeColor);
            return;
        }
        let filtered = transactions;
        let label = '';
        if (reportMode === 'month') {
            const month = parseInt(reportMonth);
            filtered = transactions.filter(tx => {
                const d = parseLocalDate(tx.date);
                return d.getFullYear() === year && d.getMonth() + 1 === month;
            });
            label = `${reportMonth}/${reportYear}`;
        } else {
            filtered = transactions.filter(tx => tx.date >= reportStart && tx.date <= reportEnd);
            label = `${reportStart} — ${reportEnd}`;
        }
        const income  = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amountVal, 0);
        const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountVal, 0);
        const stats = { income, expense, balance: income - expense };
        exportMonthlyPDF(filtered, stats, label, activeColor, theme);
    };
    return (
        <div className="space-y-6 animate-in fade-in">
            {/* APARIENCIA */}
            <div className={`relative overflow-hidden p-5 rounded-3xl border ${t.card}`}>
                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2"><Palette size={16} className={activeColor.text} /> Apariencia</h3>

                {/* TEMA */}
                <div className="flex items-center justify-between gap-3 mb-3">
                    <span className={`text-[11px] font-black uppercase tracking-widest ${t.textSec} shrink-0`}>Tema</span>
                    <div className={`inline-flex p-1 rounded-full border ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
                        <button onClick={() => setThemeMode('dark')} className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 transition-all ${themeMode === 'dark' ? `${activeColor.bg} text-white shadow` : t.textSec}`}>
                            <Moon size={13} /> Oscuro
                        </button>
                        <button onClick={() => setThemeMode('light')} className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 transition-all ${themeMode === 'light' ? `${activeColor.bg} text-white shadow` : t.textSec}`}>
                            <Sun size={13} /> Claro
                        </button>
                        <button onClick={() => setThemeMode('auto')} className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 transition-all ${themeMode === 'auto' ? `${activeColor.bg} text-white shadow` : t.textSec}`} title="Día/Noche según hora (7-19 claro, resto oscuro)">
                            <SunMoon size={13} /> Auto
                        </button>
                    </div>
                </div>

                {/* ACENTO */}
                <div className="flex items-center justify-between gap-3 mb-3">
                    <span className={`text-[11px] font-black uppercase tracking-widest ${t.textSec} shrink-0`}>Acento</span>
                    <div className="flex items-center gap-2">
                        {Object.entries(ACCENT_COLORS).map(([key, col]) => (
                            <button
                                key={key}
                                onClick={() => setAccent(key)}
                                title={key}
                                className={`w-7 h-7 rounded-full ${col.bg} transition-transform hover:scale-110 flex items-center justify-center ${accent === key ? 'ring-2 ring-offset-2 ' + (theme === 'dark' ? 'ring-offset-black' : 'ring-offset-white') + ' ' + col.ring : ''}`}
                            >
                                {accent === key && <Check className="text-white" size={12} />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* PRIVACIDAD */}
                <div className="flex items-center justify-between gap-3">
                    <span className={`text-[11px] font-black uppercase tracking-widest ${t.textSec} shrink-0`}>Privacidad</span>
                    <button
                        type="button"
                        onClick={() => setPrivacyMode(!privacyMode)}
                        className={`inline-flex p-1 rounded-full border ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-200'}`}
                    >
                        <span className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 transition-all ${!privacyMode ? `${activeColor.bg} text-white shadow` : t.textSec}`}>
                            <Eye size={13} /> Visible
                        </span>
                        <span className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 transition-all ${privacyMode ? 'bg-yellow-500 text-white shadow' : t.textSec}`}>
                            <EyeOff size={13} /> Oculto
                        </span>
                    </button>
                </div>
            </div>

            {/* ACCESOS RÁPIDOS */}
            <div className={`p-8 rounded-[32px] border ${t.card}`}>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2"><Zap className={activeColor.text} /> Accesos Rápidos (+)</h3>
                <p className={`text-xs mb-6 ${t.textSec}`}>6 botones del modal de añadir. Toca uno para configurarlo.</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
                    {quickButtons.map((btn, i) => (
                        <button
                            key={btn.id}
                            type="button"
                            onClick={() => setEditingQuick(editingQuick === i ? null : i)}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all ${editingQuick === i ? `${activeColor.bg} border-transparent text-white` : `${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'} hover:border-blue-500/30`}`}
                        >
                            <span className="text-2xl">{btn.emoji}</span>
                            <span className="text-[9px] font-black uppercase tracking-tight">{btn.label}</span>
                        </button>
                    ))}
                </div>

                {editingQuick !== null && (() => {
                    const btn = quickButtons[editingQuick];
                    const patch = (changes) => {
                        const next = quickButtons.map((b, i) => i === editingQuick ? { ...b, ...changes } : b);
                        updateQuickButtons(next);
                    };
                    const catOptions = Object.keys(categories[btn.type] || {});
                    const subOptions = (categories[btn.type] || {})[btn.category] || [];
                    return (
                        <div className={`p-5 rounded-2xl border space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 ${theme === 'dark' ? 'bg-black/30 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className={`text-[10px] font-black uppercase mb-1 ${t.textSec}`}>Emoji</p>
                                    <input value={btn.emoji} onChange={e => patch({ emoji: e.target.value })} maxLength={2} className={`w-full p-2 rounded-xl text-center text-2xl ${t.input}`} />
                                </div>
                                <div>
                                    <p className={`text-[10px] font-black uppercase mb-1 ${t.textSec}`}>Etiqueta</p>
                                    <input value={btn.label} onChange={e => patch({ label: e.target.value })} maxLength={6} className={`w-full p-2 rounded-xl text-xs font-bold ${t.input}`} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <p className={`text-[10px] font-black uppercase mb-1 ${t.textSec}`}>Tipo</p>
                                    <AppSelect
                                        value={btn.type}
                                        onChange={e => {
                                            const newType = e.target.value;
                                            const newCat = Object.keys(categories[newType] || {})[0] || '';
                                            patch({ type: newType, category: newCat, subCategory: '' });
                                        }}
                                        className="p-2 rounded-xl text-xs font-bold"
                                    >
                                        <option value="expense">Gasto</option>
                                        <option value="income">Ingreso</option>
                                    </AppSelect>
                                </div>
                                <div>
                                    <p className={`text-[10px] font-black uppercase mb-1 ${t.textSec}`}>Categoría</p>
                                    <AppSelect
                                        value={btn.category}
                                        onChange={e => {
                                            const newCat = e.target.value;
                                            const subs = (categories[btn.type] || {})[newCat] || [];
                                            patch({ category: newCat, subCategory: subs[0] || '' });
                                        }}
                                        className="p-2 rounded-xl text-xs font-bold"
                                    >
                                        {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                    </AppSelect>
                                </div>
                                <div>
                                    <p className={`text-[10px] font-black uppercase mb-1 ${t.textSec}`}>Sub</p>
                                    <AppSelect
                                        value={btn.subCategory || ''}
                                        onChange={e => patch({ subCategory: e.target.value })}
                                        className="p-2 rounded-xl text-xs font-bold"
                                        disabled={subOptions.length === 0}
                                    >
                                        <option value="">— ninguna —</option>
                                        {subOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                    </AppSelect>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2">
                                    <p className={`text-[10px] font-black uppercase mb-1 ${t.textSec}`}>Nota (opcional)</p>
                                    <input
                                        value={btn.note || ''}
                                        onChange={e => patch({ note: e.target.value })}
                                        placeholder="Auto al pulsar"
                                        maxLength={80}
                                        className={`w-full p-2 rounded-xl text-xs font-bold ${t.input}`}
                                    />
                                </div>
                                <div>
                                    <p className={`text-[10px] font-black uppercase mb-1 ${t.textSec}`}>Cuantía</p>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={btn.amount ?? ''}
                                        onChange={e => patch({ amount: e.target.value })}
                                        placeholder="0.00"
                                        className={`w-full p-2 rounded-xl text-xs font-bold ${t.input}`}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* WIDGETS DEL PANEL */}
            <div className={`p-5 rounded-3xl border ${t.card}`}>
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><LayoutGrid size={16} className={activeColor.text} /> Widgets</h3>
                </div>
                <p className={`text-[10px] font-bold mb-3 ${t.textSec}`}>Toca para activar/desactivar · mantén pulsado para vista previa.</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {WIDGETS.map(({ key, label, Icon, defaultOn }) => {
                        const raw = dashboardWidgets?.[key];
                        const on = defaultOn ? raw !== false : !!raw;
                        return (
                            <button
                                key={key}
                                type="button"
                                onPointerDown={() => startWidgetPress(key)}
                                onPointerUp={cancelWidgetPress}
                                onPointerLeave={cancelWidgetPress}
                                onPointerCancel={cancelWidgetPress}
                                onContextMenu={(e) => e.preventDefault()}
                                onClick={() => toggleWidget(key, on)}
                                className={`relative aspect-square rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all select-none ${on ? `${activeColor.border} ${theme === 'dark' ? 'bg-white/[0.04]' : 'bg-white'} ring-2 ${activeColor.ring} shadow-lg` : `border-transparent ${theme === 'dark' ? 'bg-black/30' : 'bg-gray-100'} opacity-50`}`}
                            >
                                {on && <div className={`absolute inset-0 rounded-2xl ${activeColor.bg} opacity-10 pointer-events-none`} />}
                                <Icon size={18} className={`relative ${on ? activeColor.text : t.textSec}`} />
                                <span className={`relative text-[10px] font-black uppercase tracking-tight leading-tight text-center px-1 ${on ? activeColor.text : t.textSec}`}>{label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* GESTIÓN CATEGORÍAS */}
            <div className={`p-8 rounded-[32px] border ${t.card}`}>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings className={activeColor.text} /> Categorías</h3>
                <div className="grid md:grid-cols-2 gap-8">
                    {['expense', 'income'].map(tk => (
                        <div key={tk} className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <h4 className="uppercase font-black text-xs opacity-50">{tk === 'expense' ? 'Gastos' : 'Ingresos'}</h4>
                                <button
                                    onClick={() => setCatPrompt({ type: tk })}
                                    className={`text-xs font-bold px-2 py-1 rounded-lg ${activeColor.bg} text-white`}
                                >
                                    + Añadir
                                </button>
                            </div>
                            {Object.entries(categories[tk])
                                .sort(([a], [b]) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
                                .map(([c, s]) => {
                                const catColor = resolveCategoryColor(c, categoryColors, CATEGORY_COLORS);
                                const sortedSubs = [...s].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
                                return (
                                <div key={c} className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-gray-100 border-gray-200'} group`}>
                                    <div className="flex justify-between font-bold mb-2">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setColorPickerCat(prev => prev === c ? null : c)}
                                                title="Cambiar color"
                                                className="w-5 h-5 rounded-md border border-white/10 shadow-sm hover:scale-110 transition-transform"
                                                style={{ background: catColor }}
                                            />
                                            <span>{c}</span>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setRenameCatPrompt({ type: tk, oldName: c })} title="Renombrar" className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded text-blue-500"><Pencil size={12} /></button>
                                                <button onClick={() => moveCategory(tk, c, 'up')} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded"><ChevronLeft size={14} className="rotate-90" /></button>
                                                <button onClick={() => moveCategory(tk, c, 'down')} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded"><ChevronLeft size={14} className="-rotate-90" /></button>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setSubPrompt({ type: tk, category: c })}
                                                className="text-blue-500 text-[10px] font-bold"
                                            >
                                                + sub
                                            </button>
                                            <button onClick={() => { if (confirm(`¿Borrar ${c}?`)) deleteCustomCategory(tk, c); }} className="text-red-500"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                    {colorPickerCat === c && (
                                        <div className={`mb-3 p-3 rounded-xl border animate-in slide-in-from-top-2 ${theme === 'dark' ? 'bg-black/30 border-white/5' : 'bg-white border-gray-200'}`}>
                                            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${t.textSec}`}>Color de categoría</p>
                                            <div className="grid grid-cols-6 gap-2 mb-3">
                                                {COLOR_PALETTE.map(col => {
                                                    const used = (usedColorsByCat[col.toLowerCase()] || []).filter(u => u.cat !== c);
                                                    const usedBy = used[0]?.cat;
                                                    const isCurrent = catColor.toLowerCase() === col.toLowerCase();
                                                    return (
                                                        <button
                                                            key={col}
                                                            type="button"
                                                            title={usedBy ? `En uso · ${usedBy}` : col}
                                                            onClick={() => { setCategoryColors({ ...(categoryColors || {}), [c]: col }); setColorPickerCat(null); }}
                                                            className={`relative aspect-square rounded-lg shadow-sm transition-all hover:scale-110 ${isCurrent ? 'ring-2 ring-offset-2 ring-offset-transparent ring-white scale-105' : ''}`}
                                                            style={{ background: col }}
                                                        >
                                                            {used.length > 0 && !isCurrent && (
                                                                <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                                                                    <Check size={14} strokeWidth={3.5} />
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={catColor}
                                                    onChange={e => setCategoryColors({ ...(categoryColors || {}), [c]: e.target.value })}
                                                    className="w-9 h-9 rounded cursor-pointer bg-transparent"
                                                    title="Color personalizado"
                                                />
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>Personalizado</span>
                                                {categoryColors?.[c] && (
                                                    <button
                                                        type="button"
                                                        onClick={() => { const next = { ...(categoryColors || {}) }; delete next[c]; setCategoryColors(next); setColorPickerCat(null); }}
                                                        className="ml-auto text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400"
                                                    >
                                                        Reset
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {sortedSubs.length > 0 && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                            {sortedSubs.map(sub => (
                                                <div
                                                    key={sub}
                                                    className={`group/sub flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold ${theme === 'dark' ? 'bg-white/[0.04] border border-white/5' : 'bg-white border border-gray-200'}`}
                                                >
                                                    <span className="truncate flex-1 min-w-0">{sub}</span>
                                                    <div className="flex items-center gap-0.5 opacity-0 group-hover/sub:opacity-100 transition-opacity shrink-0">
                                                        <button
                                                            onClick={() => setRenameSubPrompt({ type: tk, category: c, oldSub: sub })}
                                                            title="Renombrar"
                                                            className="p-1 rounded text-blue-500 hover:bg-blue-500/10"
                                                        >
                                                            <Pencil size={10} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const newSection = { ...categories[tk], [c]: categories[tk][c].filter(x => x !== sub) };
                                                                updateCategories({ ...categories, [tk]: newSection });
                                                            }}
                                                            title="Borrar"
                                                            className="p-1 rounded text-red-500 hover:bg-red-500/10"
                                                        >
                                                            <Trash2 size={10} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* HOGAR SOCIAL */}
            <div className={`p-5 rounded-3xl border ${t.card}`}>
                <h3 className="text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Users size={16} className="text-[#D4AF37]" /> Hogar Social
                    {isSocial && <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37]">Activo</span>}
                </h3>

                {(!households || households.length === 0) ? (
                    <div className={`p-4 rounded-2xl border bg-gradient-to-br from-[#D4AF37]/10 to-transparent border-[#D4AF37]/25 space-y-3`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#F4D578] via-[#D4AF37] to-[#9C7C0F] flex items-center justify-center shadow shrink-0">
                                <Users size={18} className="text-white" />
                            </div>
                            <p className={`text-[11px] font-bold ${t.textSec}`}>Comparte gastos con pareja o familia. Solo un hogar a la vez.</p>
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={newHouseholdName}
                                onChange={e => setNewHouseholdName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleCreateHousehold(); }}
                                placeholder="Casa, Pareja…"
                                maxLength={80}
                                className={`flex-1 p-2.5 rounded-xl font-bold text-xs ${t.input}`}
                            />
                            <button
                                onClick={handleCreateHousehold}
                                disabled={!newHouseholdName.trim() || creatingHousehold}
                                className="px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-white bg-gradient-to-br from-[#F4D578] via-[#D4AF37] to-[#9C7C0F] shadow disabled:opacity-50 active:scale-95 transition-all flex items-center gap-1.5"
                            >
                                <Plus size={13} /> {creatingHousehold ? '…' : 'Crear'}
                            </button>
                        </div>
                        {createHhError && (
                            <p className="text-[10px] font-bold text-red-500 break-words">{createHhError}</p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {households.map(h => {
                            const isOwner = h.owner_id === user?.id;
                            const isActive = activeHouseholdId === h.id && isSocial;
                            const isExpanded = expandedHouseholdId === h.id;
                            const memberCount = (h.members || []).length;
                            const claimedCount = (h.members || []).filter(m => m.userId).length;
                            const isPending = claimedCount < 2;
                            return (
                                <div
                                    key={h.id}
                                    className={`rounded-2xl border transition-all ${isActive ? 'border-[#D4AF37]/50 bg-[#D4AF37]/5' : `${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}`}
                                >
                                    <div className="p-4 flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isActive ? 'bg-gradient-to-br from-[#E8C547] to-[#9C7C0F] text-white shadow-lg' : `${theme === 'dark' ? 'bg-white/5' : 'bg-white'} text-[#D4AF37]`}`}>
                                            <Users size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {renameHhId === h.id ? (
                                                    <input
                                                        autoFocus
                                                        value={renameHhValue}
                                                        onChange={e => setRenameHhValue(e.target.value)}
                                                        onBlur={() => handleRenameHousehold(h.id)}
                                                        onKeyDown={e => { if (e.key === 'Enter') handleRenameHousehold(h.id); if (e.key === 'Escape') setRenameHhId(null); }}
                                                        className={`flex-1 px-2 py-1 rounded-lg font-black text-sm ${t.input}`}
                                                        maxLength={80}
                                                    />
                                                ) : (
                                                    <p className="font-black text-sm leading-tight break-words">{h.name}</p>
                                                )}
                                                {isOwner && <Crown size={12} className="text-[#D4AF37] shrink-0" />}
                                                {isActive && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-[#D4AF37] text-white">Activo</span>}
                                                {isPending && !isActive && <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">Pendiente</span>}
                                            </div>
                                            <p className={`text-[10px] font-bold ${t.textSec}`}>
                                                {memberCount} {memberCount === 1 ? 'miembro' : 'miembros'} · {isOwner ? 'Eres dueño' : 'Eres miembro'}
                                                {isPending && <span className="text-[#D4AF37]"> · Esperando aceptación</span>}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {!isActive && (
                                                <button
                                                    onClick={() => isPending ? alert('Comparte el enlace de invitación. El hogar se activa cuando alguien lo acepte.') : handleActivateHousehold(h.id)}
                                                    title={isPending ? 'Pendiente · esperando aceptación' : 'Activar este hogar'}
                                                    disabled={isPending}
                                                    className={`p-2 rounded-xl text-[#D4AF37] ${isPending ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#D4AF37]/10'}`}
                                                >
                                                    <LogIn size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setExpandedHouseholdId(prev => prev === h.id ? null : h.id)}
                                                className={`p-2 rounded-xl ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
                                            >
                                                <ChevronLeft size={16} className={`transition-transform ${isExpanded ? '-rotate-90' : 'rotate-180'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className={`px-4 pb-4 space-y-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'} pt-4`}>
                                            {/* PENDING BANNER */}
                                            {isPending && (
                                                <div className="p-2.5 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 flex items-center gap-2">
                                                    <Sparkles size={13} className="text-[#D4AF37] shrink-0" />
                                                    <p className="text-[10px] font-bold text-[#D4AF37] flex-1 min-w-0">
                                                        {isOwner ? 'Pendiente · comparte el enlace' : 'Esperando a que alguien acepte'}
                                                    </p>
                                                </div>
                                            )}

                                            {/* RENAME (owner) */}
                                            {isOwner && renameHhId !== h.id && (
                                                <button
                                                    onClick={() => { setRenameHhId(h.id); setRenameHhValue(h.name); }}
                                                    className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${t.textSec} hover:text-[#D4AF37] transition-colors`}
                                                >
                                                    <Pencil size={10} /> Renombrar hogar
                                                </button>
                                            )}

                                            {/* INVITE LINK */}
                                            <button
                                                onClick={() => handleCopyInvite(h)}
                                                className={`w-full flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${copiedHh === h.id ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-[#D4AF37]/30 bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10'}`}
                                            >
                                                {copiedHh === h.id ? <Check size={13} className="text-emerald-500 shrink-0" /> : <Link2 size={13} className="text-[#D4AF37] shrink-0" />}
                                                <span className={`text-[11px] font-bold flex-1 truncate ${copiedHh === h.id ? 'text-emerald-500' : 'text-[#D4AF37]'}`}>
                                                    {copiedHh === h.id ? '¡Copiado!' : 'Copiar enlace de invitación'}
                                                </span>
                                                <Copy size={13} className={copiedHh === h.id ? 'text-emerald-500' : 'text-[#D4AF37]'} />
                                            </button>

                                            {/* MEMBERS */}
                                            <div>
                                                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${t.textSec}`}>Miembros</p>
                                                <div className="space-y-1.5">
                                                    {(h.members || []).map(m => {
                                                        const claimed = !!m.userId;
                                                        const isMe = m.userId === user?.id;
                                                        return (
                                                            <div
                                                                key={m.id}
                                                                className={`flex items-center gap-3 p-2.5 rounded-xl border ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-200 bg-white'}`}
                                                            >
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0 ${claimed ? 'bg-gradient-to-br from-[#E8C547] to-[#9C7C0F]' : 'bg-gray-400'}`}>
                                                                    {m.name?.[0]?.toUpperCase() || '?'}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-black text-xs truncate">{m.name}{isMe && <span className="ml-1 text-[#D4AF37]">· Tú</span>}</p>
                                                                    <p className={`text-[10px] font-bold ${t.textSec}`}>{claimed ? 'Reclamado' : 'Pendiente · enlace'}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {isOwner && (
                                                    <div className="flex gap-2 mt-2">
                                                        <input
                                                            value={slotNameByHh[h.id] || ''}
                                                            onChange={e => setSlotNameByHh(prev => ({ ...prev, [h.id]: e.target.value }))}
                                                            onKeyDown={e => { if (e.key === 'Enter') handleAddSlot(h.id); }}
                                                            placeholder="Nombre del nuevo miembro"
                                                            maxLength={80}
                                                            className={`flex-1 p-2.5 rounded-xl text-xs font-bold ${t.input}`}
                                                        />
                                                        <button
                                                            onClick={() => handleAddSlot(h.id)}
                                                            disabled={!(slotNameByHh[h.id] || '').trim()}
                                                            className="px-3 rounded-xl text-xs font-black text-white bg-gradient-to-br from-[#E8C547] to-[#9C7C0F] disabled:opacity-50 active:scale-95 transition-all flex items-center gap-1"
                                                        >
                                                            <Plus size={14} /> Añadir
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* DANGER ZONE */}
                                            <div className="pt-2 space-y-2">
                                                {(() => {
                                                    const cancelMode = isPending && isOwner;
                                                    const primaryLabel = cancelMode
                                                        ? 'Cancelar invitación'
                                                        : (isOwner ? 'Borrar hogar' : 'Salir del hogar');
                                                    const confirmAction = cancelMode
                                                        ? 'cancelar invitación'
                                                        : (isOwner ? 'borrar' : 'salir');
                                                    return confirmDeleteHh === h.id ? (
                                                        <button
                                                            onClick={() => handleLeaveOrDelete(h)}
                                                            className="w-full p-3 rounded-xl border-2 border-red-500 bg-red-500/15 text-red-500 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                                                        >
                                                            <Trash2 size={14} /> Toca otra vez para {confirmAction} · {h.name}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleLeaveOrDelete(h)}
                                                            className="text-[11px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 flex items-center gap-2"
                                                        >
                                                            <Trash2 size={12} /> {primaryLabel}
                                                        </button>
                                                    );
                                                })()}
                                                {hhError && hhError.id === h.id && (
                                                    <div className="p-2.5 rounded-xl border border-red-500/30 bg-red-500/10">
                                                        <p className="text-[11px] font-bold text-red-500 break-words">{hhError.message}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                    </div>
                )}
            </div>

            {/* INFORMES */}
            <div className={`p-5 rounded-3xl border ${t.card}`}>
                <h3 className="text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2"><Download size={16} className={activeColor.text} /> Informe PDF</h3>
                <div className="space-y-2.5">
                    <div className={`flex p-1 rounded-full border ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
                        {['month','year','range'].map(m => (
                            <button key={m} type="button" onClick={() => setReportMode(m)} className={`flex-1 py-1.5 rounded-full text-[11px] font-black uppercase transition-all ${reportMode === m ? `${activeColor.bg} text-white shadow` : t.textSec}`}>
                                {m === 'month' ? 'Mes' : m === 'year' ? 'Año' : 'Rango'}
                            </button>
                        ))}
                    </div>

                    {reportMode === 'month' && (
                        <div className="grid grid-cols-2 gap-2">
                            <AppSelect value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="p-2.5 rounded-xl font-bold text-xs">
                                {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                                    <option key={m} value={m}>{new Date(2000, i).toLocaleString('es-ES',{month:'long'})}</option>
                                ))}
                            </AppSelect>
                            <input type="number" value={reportYear} onChange={e => setReportYear(e.target.value)} placeholder="Año" className={`p-2.5 rounded-xl font-bold text-xs ${t.input}`} />
                        </div>
                    )}
                    {reportMode === 'year' && (
                        <input type="number" value={reportYear} onChange={e => setReportYear(e.target.value)} placeholder="Año" className={`w-full p-2.5 rounded-xl font-bold text-xs ${t.input}`} />
                    )}
                    {reportMode === 'range' && (
                        <div className="grid grid-cols-2 gap-2">
                            <input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} className={`p-2.5 rounded-xl font-bold text-xs ${t.input}`} />
                            <input type="date" value={reportEnd}   onChange={e => setReportEnd(e.target.value)}   className={`p-2.5 rounded-xl font-bold text-xs ${t.input}`} />
                        </div>
                    )}

                    <button onClick={handleDownloadReport} className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-white flex items-center justify-center gap-2 ${activeColor.bg} shadow active:scale-95 transition-all`}>
                        <Download size={14} /> Generar PDF
                    </button>
                </div>
            </div>

            {/* SEGURIDAD / CUENTA */}
            <div className={`p-5 rounded-3xl border ${t.card}`}>
                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2"><User size={16} className={activeColor.text} /> Cuenta</h3>

                <div className={`flex items-center gap-3 p-3 rounded-2xl mb-4 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeColor.bg} text-white font-black`}>
                        {currentUser?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-sm truncate">{currentUser}</p>
                        <p className={`text-[10px] font-bold ${t.textSec}`}>Sesión activa</p>
                    </div>
                </div>

                {confirmReset ? (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="p-3 rounded-2xl border border-orange-500/30 bg-orange-500/10">
                            <p className="text-xs font-black text-orange-500">¿Seguro? Esto borra TODAS tus transacciones, metas, deudas y automatizaciones. No se puede deshacer.</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { resetAllData(); setConfirmReset(false); }}
                                className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Trash2 size={14} /> Sí, borrar todo
                            </button>
                            <button
                                onClick={() => setConfirmReset(false)}
                                className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest ${theme === 'dark' ? 'bg-white/10 hover:bg-white/15' : 'bg-gray-200 hover:bg-gray-300'} active:scale-95 transition-all`}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setConfirmReset(true)}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 font-black text-xs uppercase tracking-widest hover:bg-orange-500/15 active:scale-95 transition-all"
                        >
                            <Trash2 size={14} /> Borrar datos
                        </button>
                        <button
                            onClick={logout}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 font-black text-xs uppercase tracking-widest hover:bg-red-500/15 active:scale-95 transition-all"
                        >
                            <LogOut size={14} /> Cerrar sesión
                        </button>
                    </div>
                )}
            </div>

            {previewWidget && (() => {
                const w = WIDGETS.find(x => x.key === previewWidget);
                if (!w) return null;
                const raw = dashboardWidgets?.[w.key];
                const on = w.defaultOn ? raw !== false : !!raw;
                const Icon = w.Icon;
                return (
                    <div
                        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
                        onClick={() => setPreviewWidget(null)}
                    >
                        <div
                            className={`w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border animate-in zoom-in-95 duration-150 ${t.card}`}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className={`p-5 border-b flex items-center gap-3 ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${activeColor.bg} text-white shadow`}>
                                    <Icon size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-base font-black truncate">{w.label}</p>
                                    <p className={`text-[11px] font-bold ${t.textSec}`}>{w.desc}</p>
                                </div>
                                <button onClick={() => setPreviewWidget(null)} className={`p-2 rounded-xl ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="p-5 max-h-[60vh] overflow-y-auto">
                                {renderWidgetPreview(w.key)}
                            </div>
                            <div className={`p-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                                <button
                                    onClick={() => { setDashboardWidgets({ ...(dashboardWidgets || {}), [w.key]: !on }); setPreviewWidget(null); }}
                                    className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow active:scale-95 transition-all ${on ? 'bg-rose-500' : activeColor.bg}`}
                                >
                                    {on ? 'Desactivar widget' : 'Activar widget'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <PromptModal
                isOpen={!!catPrompt}
                title={catPrompt?.type === 'income' ? 'Nueva categoría de ingreso' : 'Nueva categoría de gasto'}
                label="Nombre"
                placeholder="Ej: Hogar, Transporte…"
                onConfirm={(name) => addCustomCategory(catPrompt.type, name)}
                onClose={() => setCatPrompt(null)}
            />

            <PromptModal
                isOpen={!!subPrompt}
                title={`Nueva subcategoría · ${subPrompt?.category || ''}`}
                label="Nombre"
                placeholder="Ej: Alquiler, Luz…"
                onConfirm={(sub) => addSubCategory(subPrompt.type, subPrompt.category, sub)}
                onClose={() => setSubPrompt(null)}
            />

            <PromptModal
                isOpen={!!renameCatPrompt}
                title={`Renombrar categoría · ${renameCatPrompt?.oldName || ''}`}
                label="Nuevo nombre"
                placeholder={renameCatPrompt?.oldName || ''}
                initialValue={renameCatPrompt?.oldName || ''}
                confirmText="Renombrar"
                onConfirm={(name) => renameCategory(renameCatPrompt.type, renameCatPrompt.oldName, name)}
                onClose={() => setRenameCatPrompt(null)}
            />

            <PromptModal
                isOpen={!!renameSubPrompt}
                title={`Renombrar subcategoría · ${renameSubPrompt?.oldSub || ''}`}
                label="Nuevo nombre"
                placeholder={renameSubPrompt?.oldSub || ''}
                initialValue={renameSubPrompt?.oldSub || ''}
                confirmText="Renombrar"
                onConfirm={(sub) => renameSubCategory(renameSubPrompt.type, renameSubPrompt.category, renameSubPrompt.oldSub, sub)}
                onClose={() => setRenameSubPrompt(null)}
            />
        </div>
    );
};

export default SettingsView;
