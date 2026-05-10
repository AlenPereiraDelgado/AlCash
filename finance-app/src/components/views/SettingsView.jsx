import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { ACCENT_COLORS, CATEGORY_COLORS } from '../../constants/theme';
import { Palette, Moon, Sun, Check, Settings, Trash2, LogOut, User, ChevronLeft, Sparkles, Zap, Download, Pencil, Target, LayoutGrid, Radar, BarChart3, Activity, Users, Plus, Copy, Crown, LogIn, Link2, Eye, EyeOff } from 'lucide-react';
import { exportMonthlyPDF, generateYearlyPDF } from '../../services/pdfService';
import AppSelect from '../common/AppSelect';
import PromptModal from '../common/PromptModal';
import { parseLocalDate, resolveCategoryColor } from '../../utils/helpers';

const SettingsView = () => {
    const {
        theme, setTheme, t, accent, setAccent, activeColor,
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
        <div className="space-y-8 animate-in fade-in">
            {/* INTELIGENCIA ARTIFICIAL SIEMPRE ACTIVA */}
            <div className={`p-8 rounded-[32px] border ${t.card} relative overflow-hidden group border-blue-500/30 bg-blue-500/5`}>
                <div className="absolute top-0 right-0 p-12 opacity-[0.05] rotate-12 -mr-10 -mt-10 transition-transform group-hover:scale-110 duration-700 text-blue-500">
                    <Sparkles size={160} />
                </div>
                
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 relative">
                    <Sparkles className="text-blue-500" /> Inteligencia Artificial (IA)
                </h3>

                <div className="space-y-6 relative">
                    <div className="max-w-2xl">
                        <p className={`text-sm font-medium mb-4 ${t.textSec}`}>
                            Tu suscripción a <span className="font-bold text-blue-500">AlCash Premium</span> tiene la IA activada permanentemente. Entiende contextos complejos y categoriza tus gastos de forma mágica.
                        </p>
                        
                        <div className="flex items-center gap-3 px-5 py-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                            <span className="text-xs font-black uppercase tracking-widest text-blue-500">Servicio de IA Activo y Sincronizado</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* PERSONALIZACIÓN */}
            <div className={`p-8 rounded-[32px] border ${t.card}`}>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Palette className={activeColor.text} /> Apariencia</h3>

                <div className="grid md:grid-cols-2 gap-8">
                    <div>
                        <h4 className={`uppercase font-black text-xs mb-4 ${t.textSec}`}>Tema</h4>
                        <div className="flex gap-4">
                            <button onClick={() => setTheme('dark')} className={`flex-1 p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${theme === 'dark' ? `${activeColor.border} bg-white/5` : 'border-gray-500/20'}`}>
                                <Moon size={24} /> <span className="font-bold">Oscuro</span>
                            </button>
                            <button onClick={() => setTheme('light')} className={`flex-1 p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${theme === 'light' ? `${activeColor.border} bg-blue-50` : 'border-gray-500/20'}`}>
                                <Sun size={24} /> <span className="font-bold">Claro</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <h4 className={`uppercase font-black text-xs mb-4 ${t.textSec}`}>Color de Acento</h4>
                        <div className="flex gap-3">
                            {Object.entries(ACCENT_COLORS).map(([key, col]) => (
                                <button
                                    key={key}
                                    onClick={() => setAccent(key)}
                                    className={`w-12 h-12 rounded-full ${col.bg} transition-transform hover:scale-110 flex items-center justify-center ${accent === key ? 'ring-4 ring-offset-4 ring-offset-black ' + col.ring : ''}`}
                                >
                                    {accent === key && <Check className="text-white" size={20} />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* PRIVACIDAD */}
            <div className={`p-8 rounded-[32px] border ${t.card}`}>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                    {privacyMode ? <EyeOff className={activeColor.text} /> : <Eye className={activeColor.text} />} Privacidad
                </h3>
                <p className={`text-xs mb-6 ${t.textSec}`}>Oculta los importes en pantalla. Útil cuando enseñas la app a otros.</p>
                <button
                    type="button"
                    onClick={() => setPrivacyMode(!privacyMode)}
                    className={`w-full sm:w-auto flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border transition-all ${privacyMode ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' : `${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'}`}`}
                >
                    <div className="flex items-center gap-3">
                        {privacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
                        <span className="font-black text-sm">Ocultar importes</span>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${privacyMode ? 'bg-yellow-500 text-white' : 'bg-white/10 ' + t.textSec}`}>{privacyMode ? 'ON' : 'OFF'}</span>
                </button>
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
                    const update = (field, val) => {
                        const next = quickButtons.map((b, i) => i === editingQuick ? { ...b, [field]: val } : b);
                        updateQuickButtons(next);
                    };
                    const catOptions = Object.keys(categories[btn.type] || {});
                    const subOptions = (categories[btn.type] || {})[btn.category] || [];
                    return (
                        <div className={`p-5 rounded-2xl border space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 ${theme === 'dark' ? 'bg-black/30 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className={`text-[10px] font-black uppercase mb-1 ${t.textSec}`}>Emoji</p>
                                    <input value={btn.emoji} onChange={e => update('emoji', e.target.value)} maxLength={2} className={`w-full p-2 rounded-xl text-center text-2xl ${t.input}`} />
                                </div>
                                <div>
                                    <p className={`text-[10px] font-black uppercase mb-1 ${t.textSec}`}>Etiqueta</p>
                                    <input value={btn.label} onChange={e => update('label', e.target.value)} maxLength={6} className={`w-full p-2 rounded-xl text-xs font-bold ${t.input}`} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <p className={`text-[10px] font-black uppercase mb-1 ${t.textSec}`}>Tipo</p>
                                    <AppSelect value={btn.type} onChange={e => { update('type', e.target.value); update('category', Object.keys(categories[e.target.value] || {})[0] || ''); update('subCategory', ''); }} className="p-2 rounded-xl text-xs font-bold">
                                        <option value="expense">Gasto</option>
                                        <option value="income">Ingreso</option>
                                    </AppSelect>
                                </div>
                                <div>
                                    <p className={`text-[10px] font-black uppercase mb-1 ${t.textSec}`}>Categoría</p>
                                    <AppSelect value={btn.category} onChange={e => { update('category', e.target.value); update('subCategory', (categories[btn.type] || {})[e.target.value]?.[0] || ''); }} className="p-2 rounded-xl text-xs font-bold">
                                        {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                    </AppSelect>
                                </div>
                                <div>
                                    <p className={`text-[10px] font-black uppercase mb-1 ${t.textSec}`}>Sub</p>
                                    <AppSelect value={btn.subCategory} onChange={e => update('subCategory', e.target.value)} className="p-2 rounded-xl text-xs font-bold">
                                        {subOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                    </AppSelect>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* WIDGETS DEL PANEL */}
            <div className={`p-8 rounded-[32px] border ${t.card}`}>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2"><LayoutGrid className={activeColor.text} /> Widgets del Panel</h3>
                <p className={`text-xs mb-6 ${t.textSec}`}>Activa o desactiva las tarjetas que aparecen en el panel.</p>
                <div className="grid sm:grid-cols-3 gap-3">
                    {[
                        { key: 'comparativa', label: 'Comparativa de barras', desc: 'Ingresos vs gastos por mes.', Icon: BarChart3, defaultOn: true },
                        { key: 'pie',         label: 'Reparto de gastos',     desc: 'Distribución por categoría (mes/año).', Icon: BarChart3, defaultOn: true },
                        { key: 'historical',  label: 'Promedio histórico',    desc: 'Media histórica de ingresos/gastos.', Icon: BarChart3, defaultOn: true },
                        { key: 'fixedInfo',   label: 'Gastos fijos',          desc: 'Mensual + extras anuales prorrateados.', Icon: Zap, defaultOn: true },
                        { key: 'salud',       label: 'Salud financiera',      desc: 'Indicador compuesto de salud financiera.', Icon: Activity, defaultOn: true },
                        { key: 'savings',     label: 'Objetivos de ahorro',   desc: 'Barras de progreso para metas de ahorro.', Icon: Target },
                        { key: 'debts',       label: 'Saldar Deudas',         desc: 'Mismo modelo que ahorros, pero para liquidar deudas.', Icon: Target },
                        { key: 'nextExpense', label: 'Próximos gastos',       desc: 'Predicción de los siguientes gastos recurrentes.', Icon: Sparkles },
                        { key: 'proyeccion',  label: 'Proyección',            desc: 'Diario medio y total de gasto del periodo.', Icon: Zap },
                        { key: 'radarHabitos',label: 'Radar de Hábitos',      desc: 'Intensidad de gasto por grupos de categoría.', Icon: Radar },
                        { key: 'lineComparativa', label: 'Tendencias',        desc: 'Líneas de ingresos/gastos y por categoría.', Icon: BarChart3 },
                        { key: 'budgets',     label: 'Presupuestos',          desc: 'Límites mensuales por categoría con seguimiento.', Icon: Target },
                    ].map(({ key, label, desc, Icon, defaultOn }) => {
                        const raw = dashboardWidgets?.[key];
                        const on = defaultOn ? raw !== false : !!raw;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setDashboardWidgets({ ...(dashboardWidgets || {}), [key]: !on })}
                                className={`p-4 rounded-2xl border text-left transition-all ${on ? `${activeColor.border} bg-white/5` : 'border-white/5 ' + (theme === 'dark' ? 'bg-black/20' : 'bg-gray-100')}`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <Icon size={18} className={on ? activeColor.text : t.textSec} />
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${on ? activeColor.bg + ' text-white' : 'bg-white/10 ' + t.textSec}`}>{on ? 'ON' : 'OFF'}</span>
                                </div>
                                <p className="font-bold text-sm">{label}</p>
                                <p className={`text-[11px] mt-1 ${t.textSec}`}>{desc}</p>
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
                            {Object.entries(categories[tk]).map(([c, s]) => {
                                const catColor = resolveCategoryColor(c, categoryColors, CATEGORY_COLORS);
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
                                    <div className="flex flex-wrap gap-2">
                                        {s.map(sub => (
                                            <span key={sub} className="text-[10px] px-2 py-1 rounded bg-white/10 flex items-center gap-1 group/sub">
                                                {sub}
                                                <button
                                                    onClick={() => setRenameSubPrompt({ type: tk, category: c, oldSub: sub })}
                                                    title="Renombrar"
                                                    className="opacity-0 group-hover/sub:opacity-100 text-blue-400 hover:text-blue-600"
                                                >
                                                    <Pencil size={10} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const newSection = { ...categories[tk], [c]: categories[tk][c].filter(x => x !== sub) };
                                                        updateCategories({ ...categories, [tk]: newSection });
                                                    }}
                                                    className="opacity-0 group-hover/sub:opacity-100 text-red-400 hover:text-red-600"
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* HOGAR SOCIAL */}
            <div className={`p-8 rounded-[32px] border ${t.card} relative overflow-hidden`}>
                <div className="absolute top-0 right-0 p-12 opacity-[0.04] rotate-12 -mr-10 -mt-10 text-[#D4AF37]">
                    <Users size={160} />
                </div>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2 relative">
                    <Users className="text-[#D4AF37]" /> Hogar Social
                    {isSocial && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] ml-2">Activo</span>}
                </h3>
                <p className={`text-xs mb-6 relative ${t.textSec}`}>Comparte categorías, presupuestos y movimientos con tu pareja, familia o gente de confianza. Activa el modo dorado desde el sidebar.</p>

                {(!households || households.length === 0) ? (
                    <div className={`p-8 rounded-3xl border bg-gradient-to-br from-[#D4AF37]/15 via-[#D4AF37]/5 to-transparent border-[#D4AF37]/30 relative overflow-hidden`}>
                        <div className="absolute -top-8 -right-8 opacity-10 text-[#D4AF37] rotate-12">
                            <Sparkles size={140} />
                        </div>
                        <div className="relative space-y-5">
                            <div className="flex flex-col items-center text-center gap-3">
                                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#F4D578] via-[#D4AF37] to-[#9C7C0F] flex items-center justify-center shadow-lg shadow-[#D4AF37]/30 rotate-3">
                                    <Users size={28} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-lg font-black">Crea tu primer hogar</p>
                                    <p className={`text-xs font-bold mt-1 max-w-xs mx-auto ${t.textSec}`}>
                                        Pónle nombre, añade miembros e invítalos con un enlace. Solo puedes pertenecer a un hogar a la vez.
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    value={newHouseholdName}
                                    onChange={e => setNewHouseholdName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleCreateHousehold(); }}
                                    placeholder="Casa, Pareja, Familia…"
                                    maxLength={80}
                                    className={`flex-1 p-3.5 rounded-2xl font-bold text-sm ${t.input}`}
                                />
                                <button
                                    onClick={handleCreateHousehold}
                                    disabled={!newHouseholdName.trim() || creatingHousehold}
                                    className="px-5 py-3.5 rounded-2xl font-black text-sm text-white bg-gradient-to-br from-[#F4D578] via-[#D4AF37] to-[#9C7C0F] shadow-lg shadow-[#D4AF37]/20 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus size={16} /> {creatingHousehold ? 'Creando…' : 'Crear hogar'}
                                </button>
                            </div>
                            {createHhError && (
                                <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10">
                                    <p className="text-[11px] font-bold text-red-500 break-words">{createHhError}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3 relative">
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
                                                    <p className="font-black text-sm truncate">{h.name}</p>
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
                                                <div className="p-3 rounded-2xl border border-[#D4AF37]/40 bg-gradient-to-br from-[#D4AF37]/15 to-transparent flex items-start gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center shrink-0">
                                                        <Sparkles size={14} className="text-[#D4AF37]" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-black text-[#D4AF37]">Pendiente de aceptación</p>
                                                        <p className={`text-[10px] font-bold mt-0.5 ${t.textSec}`}>
                                                            {isOwner
                                                                ? 'Comparte el enlace de invitación. Cuando alguien lo acepte podrás activar el modo Social. Si cambias de idea puedes cancelar abajo.'
                                                                : 'Esperando a que un segundo miembro acepte el enlace.'}
                                                        </p>
                                                    </div>
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
                                            <div>
                                                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${t.textSec}`}>Enlace de invitación</p>
                                                <button
                                                    onClick={() => handleCopyInvite(h)}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${copiedHh === h.id ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-[#D4AF37]/30 bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10'}`}
                                                >
                                                    {copiedHh === h.id ? <Check size={14} className="text-emerald-500 shrink-0" /> : <Link2 size={14} className="text-[#D4AF37] shrink-0" />}
                                                    <span className={`text-[11px] font-bold flex-1 truncate ${copiedHh === h.id ? 'text-emerald-500' : 'text-[#D4AF37]'}`}>
                                                        {copiedHh === h.id ? '¡Enlace copiado!' : 'Copiar enlace de invitación'}
                                                    </span>
                                                    <Copy size={14} className={copiedHh === h.id ? 'text-emerald-500' : 'text-[#D4AF37]'} />
                                                </button>
                                                <p className={`text-[10px] mt-1.5 ${t.textSec}`}>Compártelo con quien quieras añadir. Al abrirlo elegirá su miembro.</p>
                                            </div>

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

                        <p className={`text-[10px] font-bold text-center pt-1 ${t.textSec}`}>Solo puedes pertenecer a un hogar a la vez. Para cambiar, sal o bórralo primero.</p>
                    </div>
                )}
            </div>

            {/* INFORMES */}
            <div className={`p-8 rounded-[32px] border ${t.card}`}>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Download className={activeColor.text} /> Descargar Informe</h3>
                <div className="space-y-4 max-w-sm">
                    {/* Modo */}
                    <div className={`flex p-1 rounded-xl border ${theme === 'dark' ? 'bg-black border-white/10' : 'bg-gray-100 border-gray-200'}`}>
                        {['month','year','range'].map(m => (
                            <button key={m} type="button" onClick={() => setReportMode(m)} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${reportMode === m ? `${activeColor.bg} text-white shadow` : 'text-gray-500'}`}>
                                {m === 'month' ? 'Mes' : m === 'year' ? 'Año' : 'Rango'}
                            </button>
                        ))}
                    </div>

                    {reportMode === 'month' && (
                        <div className="grid grid-cols-2 gap-3">
                            <AppSelect value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="p-3 rounded-xl font-bold text-sm">
                                {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                                    <option key={m} value={m}>{new Date(2000, i).toLocaleString('es-ES',{month:'long'})}</option>
                                ))}
                            </AppSelect>
                            <input type="number" value={reportYear} onChange={e => setReportYear(e.target.value)} placeholder="Año" className={`p-3 rounded-xl font-bold text-sm ${t.input}`} />
                        </div>
                    )}
                    {reportMode === 'year' && (
                        <input type="number" value={reportYear} onChange={e => setReportYear(e.target.value)} placeholder="Año" className={`w-full p-3 rounded-xl font-bold text-sm ${t.input}`} />
                    )}
                    {reportMode === 'range' && (
                        <div className="grid grid-cols-2 gap-3">
                            <input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} className={`p-3 rounded-xl font-bold text-sm ${t.input}`} />
                            <input type="date" value={reportEnd}   onChange={e => setReportEnd(e.target.value)}   className={`p-3 rounded-xl font-bold text-sm ${t.input}`} />
                        </div>
                    )}

                    <button onClick={handleDownloadReport} className={`w-full py-3 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 ${activeColor.bg} shadow-lg active:scale-95 transition-all`}>
                        <Download size={16} /> Generar PDF
                    </button>
                </div>
            </div>

            {/* SEGURIDAD / CUENTA */}
            <div className={`p-8 rounded-[32px] border ${t.card}`}>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><User className={activeColor.text} /> Cuenta</h3>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${activeColor.bg} text-white font-black text-xl`}>
                            {currentUser?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-black">{currentUser}</p>
                            <p className={`text-xs ${t.textSec}`}>Sesión activa localmente</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => { if (confirm('⚠️ ¿Borrar TODOS los datos? Esto elimina todas tus transacciones, metas, deudas y automatizaciones. No se puede deshacer.')) resetAllData(); }}
                            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-orange-500/10 text-orange-500 font-bold hover:bg-orange-500 hover:text-white transition-all text-sm"
                        >
                            <Trash2 size={16} /> Borrar Datos
                        </button>
                        <button onClick={logout} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-red-500/10 text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all">
                            <LogOut size={18} /> Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>

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
