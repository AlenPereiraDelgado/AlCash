import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { X } from 'lucide-react';

const TransactionModal = ({
    isOpen,
    onClose,
    editingId,
    view,
    type,
    setType,
    amount,
    setAmount,
    currency,
    setCurrency,
    exchangeRate,
    setExchangeRate,
    category,
    setCategory,
    subCategory,
    setSubCategory,
    date,
    setDate,
    note,
    setNote,
    onHandleAdd
}) => {
    const { theme, t, activeColor } = useAuth();
    const { quickButtons, categories } = useFinance();
    const [selectedQuick, setSelectedQuick] = useState(null);

    if (!isOpen) return null;

    const handleQuickSelect = (btn, index) => {
        setSelectedQuick(index);
        setType(btn.type);
        setCategory(btn.category);
        setSubCategory(btn.subCategory);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
            <div className={`w-full max-w-lg rounded-t-[32px] md:rounded-[40px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-6 duration-300 md:zoom-in-95 ${t.card} ${t.bg}`}>
                <div className={`p-6 border-b flex justify-between items-center ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                    <h3 className="text-xl font-bold">
                        {editingId ? 'Editar Movimiento' : (view === 'joint' ? 'Nuevo Gasto Conjunto' : 'Nuevo Movimiento')}
                    </h3>
                    <button onClick={onClose} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><X size={20} /></button>
                </div>
                <form onSubmit={onHandleAdd} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

                    {/* TIPO */}
                    <div className={`flex p-1 rounded-xl ${theme === 'dark' ? 'bg-black border border-white/10' : 'bg-gray-100'}`}>
                        <button type="button" onClick={() => setType('expense')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${type === 'expense' ? 'bg-red-500 text-white shadow' : 'text-gray-500'}`}>Gasto</button>
                        <button type="button" onClick={() => setType('income')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${type === 'income' ? 'bg-green-500 text-white shadow' : 'text-gray-500'}`}>Ingreso</button>
                    </div>

                    {/* ACCESOS RÁPIDOS — solo si hay alguno configurado */}
                    {quickButtons.some(b => b.category) && (
                        <>
                            <div className="grid grid-cols-6 gap-2">
                                {quickButtons.map((btn, i) => btn.category ? (
                                    <button
                                        key={btn.id}
                                        type="button"
                                        onClick={() => handleQuickSelect(btn, i)}
                                        className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-2xl transition-all border ${
                                            selectedQuick === i
                                                ? `${activeColor.bg} border-transparent text-white shadow-lg scale-105`
                                                : `${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'} hover:scale-105`
                                        }`}
                                    >
                                        <span className="text-lg leading-none">{btn.emoji || '·'}</span>
                                        <span className="text-[9px] font-black uppercase tracking-tight leading-none truncate w-full text-center">{btn.label || btn.category}</span>
                                    </button>
                                ) : null)}
                            </div>
                            {selectedQuick !== null && quickButtons[selectedQuick]?.category && (
                                <p className={`text-[10px] font-bold text-center -mt-2 ${t.textSec}`}>
                                    {quickButtons[selectedQuick].category} · {quickButtons[selectedQuick].subCategory}
                                </p>
                            )}
                        </>
                    )}

                    {/* IMPORTE */}
                    <div className="flex gap-2">
                        <input type="number" step="0.01" required placeholder="0.00" autoFocus value={amount} onChange={e => setAmount(e.target.value)} className="bg-transparent w-full text-3xl font-black outline-none py-4 border-b border-gray-500/30" />
                        <select value={currency} onChange={e => setCurrency(e.target.value)} className={`bg-transparent font-bold outline-none ${t.textSec}`}>
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                            <option value="GBP">GBP</option>
                        </select>
                    </div>
                    {currency !== 'EUR' && (
                        <div className="bg-yellow-500/10 p-3 rounded-xl border border-yellow-500/30 flex items-center justify-between text-yellow-500 text-xs font-bold">
                            <span>Cambio a EUR:</span>
                            <input type="number" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} className="w-16 bg-transparent text-right outline-none border-b border-yellow-500" />
                        </div>
                    )}

                    {/* CATEGORÍA / SUBCATEGORÍA */}
                    <div className="grid grid-cols-2 gap-4">
                        <select value={category} onChange={e => { setCategory(e.target.value); setSelectedQuick(null); }} className={`p-3 rounded-xl font-bold text-sm ${t.input}`}>
                            {Object.keys(categories[type] || {}).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={subCategory} onChange={e => { setSubCategory(e.target.value); setSelectedQuick(null); }} className={`p-3 rounded-xl font-bold text-sm ${t.input}`}>
                            {(categories[type]?.[category] || []).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* FECHA + NOTA */}
                    <div className="grid grid-cols-2 gap-4">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`p-3 rounded-xl font-bold text-sm ${t.input}`} />
                        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Nota" className={`p-3 rounded-xl font-bold text-sm ${t.input}`} />
                    </div>

                    <button type="submit" className={`w-full py-4 ${activeColor.bg} text-white rounded-xl font-black text-lg ${activeColor.hover} shadow-lg active:scale-95 transition-all`}>Guardar</button>
                </form>
            </div>
        </div>
    );
};

export default TransactionModal;
