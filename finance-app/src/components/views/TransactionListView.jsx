import React, { useState, useRef, useEffect, createElement } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../constants/theme';
import { resolveCategoryColor } from '../../utils/helpers';
import EmptyState from '../common/EmptyState';
import {
    ChevronLeft, ChevronRight, Search, Filter,
    Layers, Calendar as CalendarIcon, Activity, Box,
    Pencil, Trash2, Tag, CheckSquare, Square, Zap, Bell, Users
} from 'lucide-react';
import { isSharedTag } from '../../utils/sharedExpense';

const TransactionListView = ({
    dateMode,
    setDateMode,
    dateRange,
    setDateRange,
    isDateMenuOpen,
    setIsDateMenuOpen,
    getDateLabel,
    handleNavigate,
    searchTerm,
    setSearchTerm,
    filterCategory,
    setFilterCategory,
    filterSubCategory,
    setFilterSubCategory,
    filterPeriodicity,
    setFilterPeriodicity,
    filterTag,
    setFilterTag,
    openNewModal,
    filteredTransactions,
    handleEdit,
    onShareTx,
    onSharedDetail,
    setConfirmModal
}) => {
    const { theme, t, activeColor } = useAuth();
    const { categories, transactions, globalTags, updateTransaction, deleteTransaction, categoryColors } = useFinance();
    const getCatColor = (cat) => resolveCategoryColor(cat, categoryColors, CATEGORY_COLORS);
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectionMode, setSelectionMode] = useState(false);
    const [swipedId, setSwipedId] = useState(null);
    const dateMenuRef = useRef(null);

    useEffect(() => {
        if (selectedIds.length === 0) setSelectionMode(false);
    }, [selectedIds]);

    useEffect(() => {
        if (!isDateMenuOpen) return;
        const handler = (e) => {
            if (dateMenuRef.current && !dateMenuRef.current.contains(e.target)) {
                setIsDateMenuOpen(false);
            }
        };
        const id = setTimeout(() => document.addEventListener('pointerdown', handler), 50);
        return () => { clearTimeout(id); document.removeEventListener('pointerdown', handler); };
    }, [isDateMenuOpen, setIsDateMenuOpen]);

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleReminder = (tx) => {
        const tags = Array.isArray(tx.tags) ? tx.tags : [];
        const has = tags.includes('__reminder__');
        const newTags = has ? tags.filter(t => t !== '__reminder__') : [...tags, '__reminder__'];
        updateTransaction(tx.id, { tags: newTags });
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredTransactions.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredTransactions.map(tx => tx.id));
        }
    };

    const handleBulkDelete = () => {
        setConfirmModal({
            open: true,
            title: 'Eliminar en Lote',
            message: `¿Estás seguro de que deseas borrar ${selectedIds.length} movimientos permanentemente?`,
            onConfirm: async () => {
                await Promise.all(selectedIds.map(id => {
                    const tx = transactions.find(t => t.id === id);
                    return deleteTransaction(id, tx?.is_joint);
                }));
                setSelectedIds([]);
            }
        });
    };

    const handleBulkCategory = async (newCat) => {
        await Promise.all(selectedIds.map(id => updateTransaction(id, { category: newCat })));
        setSelectedIds([]);
    };

    const ACTIONS_WIDTH = 192;
    const LONG_PRESS_MS = 480;

    const SwipeRow = ({ tx }) => {
        const isOpen = swipedId === tx.id;
        const [dx, setDx] = useState(isOpen ? -ACTIONS_WIDTH : 0);
        const [dragging, setDragging] = useState(false);
        const startRef = useRef({ x: 0, y: 0, base: 0, axis: null });
        const lpTimer = useRef(null);
        const movedRef = useRef(false);
        const suppressClickRef = useRef(false);

        useEffect(() => {
            if (swipedId !== tx.id && dx !== 0 && !dragging) setDx(0);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [swipedId]);

        const cancelLP = () => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } };

        const closeRow = () => { setDx(0); if (swipedId === tx.id) setSwipedId(null); };

        const onTouchStart = (e) => {
            if (selectionMode) return;
            const p = e.touches[0];
            startRef.current = { x: p.clientX, y: p.clientY, base: dx, axis: null };
            movedRef.current = false;
            setDragging(true);
            cancelLP();
            lpTimer.current = setTimeout(() => {
                if (!movedRef.current) {
                    if (navigator.vibrate) navigator.vibrate(40);
                    setSelectionMode(true);
                    toggleSelect(tx.id);
                    suppressClickRef.current = true;
                    setDragging(false);
                }
            }, LONG_PRESS_MS);
        };

        const onTouchMove = (e) => {
            if (selectionMode) return;
            const p = e.touches[0];
            const ddx = p.clientX - startRef.current.x;
            const ddy = p.clientY - startRef.current.y;
            if (!startRef.current.axis) {
                if (Math.abs(ddx) > 8 || Math.abs(ddy) > 8) {
                    startRef.current.axis = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y';
                    cancelLP();
                    if (startRef.current.axis === 'y') setDragging(false);
                }
            }
            if (startRef.current.axis === 'x') {
                movedRef.current = true;
                const next = startRef.current.base + ddx;
                setDx(Math.min(20, Math.max(-ACTIONS_WIDTH - 20, next)));
            }
        };

        const onTouchEnd = () => {
            cancelLP();
            const wasDragX = startRef.current.axis === 'x';
            setDragging(false);
            if (selectionMode) return;
            if (wasDragX) {
                if (dx < -ACTIONS_WIDTH / 3) {
                    setDx(-ACTIONS_WIDTH);
                    setSwipedId(tx.id);
                } else {
                    closeRow();
                }
                if (movedRef.current) {
                    suppressClickRef.current = true;
                    setTimeout(() => { suppressClickRef.current = false; }, 350);
                }
            }
        };

        const isShared = Array.isArray(tx.tags) && tx.tags.some(isSharedTag);

        const onClick = (e) => {
            if (suppressClickRef.current) { e.preventDefault(); e.stopPropagation(); return; }
            if (selectionMode) { toggleSelect(tx.id); return; }
            if (isOpen) { closeRow(); return; }
            if (isShared && onSharedDetail) onSharedDetail(tx);
        };

        const isSelected = selectedIds.includes(tx.id);
        const isAuto = tx.tags?.includes('__auto__');
        const auraCls = isSelected ? 'border-blue-500 bg-blue-500/5'
            : isAuto ? 'border-yellow-500/40 bg-yellow-500/[0.04] shadow-[0_0_24px_-8px_rgba(234,179,8,0.4)]'
            : t.card;

        return (
            <div className={`relative rounded-[24px] overflow-hidden border ${auraCls}`}>
                {/* Drawer (acciones detrás) */}
                <div className="absolute inset-y-0 right-0 flex items-stretch" style={{ width: ACTIONS_WIDTH }}>
                    <button
                        onClick={() => { onShareTx?.(tx); closeRow(); }}
                        className="flex-1 flex items-center justify-center bg-purple-500/20 text-purple-400"
                        title="Fraccionar entre personas"
                    >
                        <Users size={18} />
                    </button>
                    <button
                        onClick={() => { toggleReminder(tx); closeRow(); }}
                        className={`flex-1 flex items-center justify-center ${tx.tags?.includes('__reminder__') ? 'bg-cyan-500/30 text-cyan-300' : 'bg-cyan-500/15 text-cyan-400'}`}
                        title="Aviso anual"
                    >
                        <Bell size={18} />
                    </button>
                    <button
                        onClick={() => { handleEdit(tx); closeRow(); }}
                        className="flex-1 flex items-center justify-center bg-blue-500/20 text-blue-400"
                    >
                        <Pencil size={18} />
                    </button>
                    <button
                        onClick={() => { setConfirmModal({ open: true, title: 'Eliminar Movimiento', message: '¿Borrar este registro?', onConfirm: () => deleteTransaction(tx.id, tx.is_joint) }); closeRow(); }}
                        className="flex-1 flex items-center justify-center bg-red-500/25 text-red-400"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>

                {/* Foreground (fila visible) */}
                <div
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    onTouchCancel={onTouchEnd}
                    onClick={onClick}
                    className={`relative flex items-center gap-3 p-3 active:scale-[0.99] ${theme === 'dark' ? 'bg-[#0E0E11]' : 'bg-white'}`}
                    style={{
                        transform: `translateX(${dx}px)`,
                        transition: dragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                        touchAction: 'pan-y',
                    }}
                >
                    {selectionMode && (
                        <button onClick={(e) => { e.stopPropagation(); toggleSelect(tx.id); }} className="shrink-0">
                            {isSelected ? <CheckSquare size={20} className={activeColor.text} /> : <Square size={20} className="opacity-30" />}
                        </button>
                    )}
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-white/5" style={{ color: getCatColor(tx.category) }}>
                        {React.createElement(CATEGORY_ICONS[tx.category] || Box, { size: 20 })}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-sm truncate">{tx.note || tx.subCategory}</h4>
                            <span className={`font-black text-sm whitespace-nowrap ${tx.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                                {tx.type === 'income' ? '+' : '-'}{Number(tx.amountVal).toFixed(2)}€
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                            <div className={`flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider min-w-0 ${t.textSec}`}>
                                <span className="truncate">{tx.category}</span>
                                <span className="opacity-30 shrink-0">·</span>
                                <span className="opacity-50 shrink-0">{tx.date}</span>
                            </div>
                            {(isAuto || tx.tags?.includes('__reminder__')) && (
                                <div className="flex gap-1 shrink-0">
                                    {isAuto && <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-yellow-500/15 text-yellow-400 text-[9px] font-black"><Zap size={8} />Auto</span>}
                                    {tx.tags?.includes('__reminder__') && <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 text-[9px] font-black"><Bell size={8} />Aviso</span>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in relative">
            {/* BARRA DE ACCIONES EN LOTE (FLOATING) */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-10 duration-300">
                    <div className={`flex items-center gap-4 px-6 py-4 rounded-[32px] border shadow-2xl backdrop-blur-xl ${theme === 'dark' ? 'bg-blue-600/90 border-blue-400/20' : 'bg-blue-600/95 border-blue-500/20'} text-white`}>
                        <div className="flex flex-col border-r border-white/20 pr-4">
                            <span className="text-[10px] font-black uppercase opacity-60">Seleccionados</span>
                            <span className="text-xl font-black">{selectedIds.length}</span>
                        </div>
                        
                        <div className="flex gap-2">
                            <button onClick={handleBulkDelete} className="p-3 rounded-2xl bg-red-500 hover:bg-red-600 transition-all flex items-center gap-2 font-bold text-xs">
                                <Trash2 size={16} /> <span className="hidden md:inline">Borrar</span>
                            </button>
                            
                            <div className="relative group">
                                <button className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 transition-all flex items-center gap-2 font-bold text-xs border border-white/10">
                                    <Tag size={16} /> <span className="hidden md:inline">Mover a...</span>
                                </button>
                                <div className="absolute bottom-full mb-2 left-0 hidden group-hover:grid grid-cols-2 gap-1 p-2 rounded-2xl bg-black/90 border border-white/10 w-64 backdrop-blur-xl animate-in fade-in zoom-in-95 origin-bottom">
                                    {Object.keys(categories.expense || {}).map(cat => (
                                        <button 
                                            key={cat} 
                                            onClick={() => handleBulkCategory(cat)}
                                            className="p-2 text-[10px] font-bold text-left hover:bg-white/10 rounded-lg transition-colors truncate"
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button onClick={() => setSelectedIds([])} className="p-3 rounded-2xl hover:bg-white/10 transition-all font-bold text-xs uppercase opacity-60">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* FILTROS DE ETIQUETAS (HORIZONTAL SCROLL) */}
            {globalTags.length > 0 && (
                <div className="flex flex-col gap-4">
                    <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
                        {globalTags.map(tag => (
                            <button
                                key={tag.name}
                                onClick={() => setFilterTag(filterTag === tag.name ? 'Todas' : tag.name)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${filterTag === tag.name ? 'text-white border-transparent shadow-lg' : `${t.hover} border-white/5 opacity-60`}`}
                                style={{ backgroundColor: filterTag === tag.name ? tag.color : 'transparent' }}
                            >
                                {tag.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Controles */}
            <div className={`p-3 rounded-3xl border flex flex-col lg:flex-row justify-between items-center gap-4 ${t.card}`}>
                <div className={`flex items-center p-1 rounded-2xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                    <button onClick={() => handleNavigate(-1)} disabled={dateMode === 'range'} className={`p-3 rounded-xl transition-colors ${t.hover} disabled:opacity-30`}><ChevronLeft size={20} /></button>
                    <div className="relative px-2" ref={dateMenuRef}>
                        <button onClick={() => setIsDateMenuOpen(!isDateMenuOpen)} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${t.hover}`}>
                            {dateMode === 'range' ? <Layers size={18} className="text-purple-500" /> : <CalendarIcon size={18} className={activeColor.text} />}
                            <span className="font-black uppercase tracking-widest text-sm">{getDateLabel()}</span>
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
                    <button onClick={() => handleNavigate(1)} disabled={dateMode === 'range'} className={`p-3 rounded-xl transition-colors ${t.hover} disabled:opacity-30`}><ChevronRight size={20} /></button>
                </div>
                <div className="flex flex-col gap-2 w-full lg:w-auto lg:flex-row lg:gap-3">
                    <div className={`flex items-center px-3 py-2.5 rounded-xl border lg:w-56 ${t.input} ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
                        <Search size={15} className={t.textSec} />
                        <input placeholder="Buscar…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-xs ml-2 w-full font-bold" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 lg:flex lg:gap-3">
                        <div className={`flex items-center px-3 py-2.5 rounded-xl border ${t.input} ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
                            <Filter size={13} className={`${t.textSec} shrink-0`} />
                            <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setFilterSubCategory('Todas'); }} className="bg-transparent border-none outline-none text-[11px] ml-1 font-black uppercase tracking-wider appearance-none cursor-pointer w-full truncate">
                                <option value="Todas">Categoría</option>
                                {Object.keys(categories.expense || {}).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className={`flex items-center px-3 py-2.5 rounded-xl border ${t.input} ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
                            <Filter size={13} className={`${t.textSec} shrink-0`} />
                            <select value={filterSubCategory} onChange={e => setFilterSubCategory(e.target.value)} disabled={filterCategory === 'Todas'} className="bg-transparent border-none outline-none text-[11px] ml-1 font-black uppercase tracking-wider appearance-none cursor-pointer w-full truncate disabled:opacity-30">
                                <option value="Todas">Subcategoría</option>
                                {(categories.expense?.[filterCategory] || []).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className={`flex items-center px-3 py-2.5 rounded-xl border ${t.input} ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
                            <Filter size={13} className={`${t.textSec} shrink-0`} />
                            <select value={filterPeriodicity} onChange={e => setFilterPeriodicity(e.target.value)} className="bg-transparent border-none outline-none text-[11px] ml-1 font-black uppercase tracking-wider appearance-none cursor-pointer w-full truncate">
                                <option value="Todas">Periodo</option>
                                <option value="Puntual">Puntual</option>
                                <option value="Mensual">Mensual</option>
                                <option value="Anual">Anual</option>
                                <option value="Bianual">Bianual</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* RESULTADOS */}
            {filteredTransactions.length === 0 ? (
                <EmptyState 
                    title="No hay movimientos" 
                    description="No hemos encontrado registros para este periodo. ¡Empieza añadiendo tu primer gasto o ingreso!"
                    icon={Activity}
                    action={openNewModal}
                    t={t}
                />
            ) : (
                <>
                    {/* TABLA (DESKTOP) PREMIUM */}
                    <div className={`hidden md:block rounded-[40px] border overflow-hidden ${t.card} relative`}>
                        <table className="w-full text-left">
                            <thead>
                                <tr className={`text-[10px] uppercase font-black tracking-[0.2em] opacity-40 ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'} border-b`}>
                                    <th className="p-8 w-10">
                                        <button onClick={toggleSelectAll} className="p-2 rounded-xl hover:bg-white/5 transition-all">
                                            {selectedIds.length === filteredTransactions.length && filteredTransactions.length > 0 ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} />}
                                        </button>
                                    </th>
                                    <th className="p-8">Movimiento</th>
                                    <th className="p-8">Detalles</th>
                                    <th className="p-8">Etiquetas</th>
                                    <th className="p-8 text-right">Monto</th>
                                    <th className="p-8"></th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${theme === 'dark' ? 'divide-white/5' : 'divide-gray-50'}`}>
                                {filteredTransactions.map((tx, idx) => {
                                    const rowIsShared = Array.isArray(tx.tags) && tx.tags.some(isSharedTag);
                                    const onRowClick = (e) => {
                                        if (e.target.closest('button')) return;
                                        if (rowIsShared && onSharedDetail) onSharedDetail(tx);
                                    };
                                    return (
                                    <tr key={tx.id} onClick={onRowClick} className={`group transition-all duration-300 animate-in fade-in slide-in-from-left-4 delay-${Math.min(idx * 50, 500)} ${rowIsShared ? 'cursor-pointer' : ''} ${selectedIds.includes(tx.id) ? 'bg-blue-600/5' : tx.tags?.includes('__auto__') ? 'bg-yellow-500/[0.04] hover:bg-yellow-500/[0.08]' : 'hover:bg-white/[0.02]'}`}>
                                        <td className="p-8 w-10">
                                            <div className="flex flex-col gap-1">
                                                <button onClick={() => toggleSelect(tx.id)} className="p-2 rounded-xl hover:bg-white/5 transition-all">
                                                    {selectedIds.includes(tx.id) ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} className="opacity-20 group-hover:opacity-100" />}
                                                </button>
                                                <button onClick={() => toggleReminder(tx)} title="Marcar como aviso anual" className="p-2 rounded-xl hover:bg-white/5 transition-all">
                                                    <Bell size={16} className={tx.tags?.includes('__reminder__') ? 'text-cyan-400 fill-cyan-400/30' : 'opacity-20 group-hover:opacity-100'} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-white/[0.03] border border-white/[0.05]" style={{ color: getCatColor(tx.category) }}>
                                                    {createElement(CATEGORY_ICONS[tx.category] || Box, { size: 20, strokeWidth: 2.5 })}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm tracking-tight">{tx.note || tx.subCategory}</p>
                                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mt-0.5">{tx.date}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-8">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-bold opacity-60">{tx.category}</span>
                                                {tx.tags?.includes('__auto__') && <span className="flex items-center gap-1 text-[9px] w-fit px-2 py-0.5 rounded-lg bg-yellow-500/15 text-yellow-400 font-black"><Zap size={9} />Auto</span>}
                                                {tx.tags?.includes('__reminder__') && <span className="flex items-center gap-1 text-[9px] w-fit px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-400 font-black"><Bell size={9} />Aviso anual</span>}
                                                {tx.originalCurrency !== 'EUR' && <span className="text-[9px] w-fit px-2 py-0.5 rounded-lg bg-yellow-500/10 text-yellow-500 font-black">{tx.originalCurrency}</span>}
                                            </div>
                                        </td>
                                        <td className="p-8">
                                            <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                                {tx.tags?.filter(t => t !== '__auto__' && !t.startsWith('__shared:')).map(tagName => {
                                                    const tagData = globalTags.find(gt => gt.name === tagName);
                                                    return (
                                                        <span key={tagName} className="px-3 py-1 rounded-full text-[9px] font-bold text-white shadow-sm" style={{ backgroundColor: tagData?.color || '#8E8E93' }}>
                                                            {tagName}
                                                        </span>
                                                    );
                                                })}
                                                {(!tx.tags || tx.tags.filter(t => t !== '__auto__' && !t.startsWith('__shared:')).length === 0) && <span className="text-[10px] opacity-20 italic">Sin tags</span>}
                                            </div>
                                        </td>
                                        <td className={`p-8 text-right font-black text-lg tracking-tighter ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {tx.type === 'income' ? '+' : '-'}{Number(tx.amountVal).toFixed(2)}€
                                        </td>
                                        <td className="p-8">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                <button onClick={() => onShareTx?.(tx)} title="Fraccionar entre personas" className="p-2.5 rounded-xl bg-white/5 hover:bg-purple-500/10 hover:text-purple-500 transition-all"><Users size={16} /></button>
                                                <button onClick={() => handleEdit(tx)} className="p-2.5 rounded-xl bg-white/5 hover:bg-blue-500/10 hover:text-blue-500 transition-all"><Pencil size={16} /></button>
                                                <button onClick={() => setConfirmModal({ open: true, title: 'Eliminar', message: '¿Borrar este registro?', onConfirm: () => deleteTransaction(tx.id, tx.is_joint) })} className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/10 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* LISTA DE TARJETAS (MOBILE) */}
                    <div className="md:hidden space-y-3">
                        {filteredTransactions.map(tx => (
                            <SwipeRow key={tx.id} tx={tx} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default TransactionListView;
