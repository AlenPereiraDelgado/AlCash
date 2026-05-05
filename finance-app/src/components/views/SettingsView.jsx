import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { ACCENT_COLORS } from '../../constants/theme';
import { Palette, Moon, Sun, Check, Settings, Trash2, LogOut, User, ChevronLeft, Sparkles, Zap, Download, Pencil } from 'lucide-react';
import { exportMonthlyPDF, generateYearlyPDF } from '../../services/pdfService';
import AppSelect from '../common/AppSelect';
import PromptModal from '../common/PromptModal';
import { parseLocalDate } from '../../utils/helpers';

const SettingsView = () => {
    const {
        theme, setTheme, t, accent, setAccent, activeColor,
        currentUser, logout
    } = useAuth();

    const {
        categories, addCustomCategory,
        deleteCustomCategory, moveCategory, addSubCategory,
        renameCategory, renameSubCategory,
        updateCategories, quickButtons, updateQuickButtons,
        transactions, jointTransactions, resetAllData
    } = useFinance();

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
                            {Object.entries(categories[tk]).map(([c, s]) => (
                                <div key={c} className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-gray-100 border-gray-200'} group`}>
                                    <div className="flex justify-between font-bold mb-2">
                                        <div className="flex items-center gap-2">
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
                            ))}
                        </div>
                    ))}
                </div>
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
