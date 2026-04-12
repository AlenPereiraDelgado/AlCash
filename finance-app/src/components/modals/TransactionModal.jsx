import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { X, Tag, Plus } from 'lucide-react';

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
    tags, 
    setTags, 
    globalTags, 
    setGlobalTags, 
    periodicity, 
    setPeriodicity, 
    onHandleAdd 
}) => {
    const { theme, t, activeColor } = useAuth();
    const { categories } = useFinance();
    const [newTagInput, setNewTagInput] = useState('');
    const [isAddingTag, setIsAddingTag] = useState(false);

    if (!isOpen) return null;

    const toggleTag = (tagName) => {
        setTags(prev => prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]);
    };

    const handleCreateTag = (e) => {
        if (e.key === 'Enter' && newTagInput.trim()) {
            e.preventDefault();
            const tagName = newTagInput.trim();
            if (!globalTags.find(t => t.name === tagName)) {
                const newTag = { name: tagName, color: '#' + Math.floor(Math.random()*16777215).toString(16) };
                setGlobalTags(prev => [...prev, newTag]);
            }
            if (!tags.includes(tagName)) toggleTag(tagName);
            setNewTagInput('');
            setIsAddingTag(false);
        }
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
                    <div className={`flex p-1 rounded-xl mb-4 ${theme === 'dark' ? 'bg-black border border-white/10' : 'bg-gray-100'}`}>
                        <button type="button" onClick={() => setType('expense')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${type === 'expense' ? 'bg-red-500 text-white shadow' : 'text-gray-500'}`}>Gasto</button>
                        <button type="button" onClick={() => setType('income')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${type === 'income' ? 'bg-green-500 text-white shadow' : 'text-gray-500'}`}>Ingreso</button>
                    </div>

                    <div className="flex gap-2">
                        <input type="number" step="0.01" required placeholder="0.00" autoFocus value={amount} onChange={e => setAmount(e.target.value)} className="bg-transparent w-full text-3xl font-black outline-none py-4 border-b border-gray-500/30" />
                        <select value={currency} onChange={e => setCurrency(e.target.value)} className={`bg-transparent font-bold outline-none ${t.textSec}`}><option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option></select>
                    </div>
                    {currency !== 'EUR' && (
                        <div className="bg-yellow-500/10 p-3 rounded-xl border border-yellow-500/30 flex items-center justify-between text-yellow-500 text-xs font-bold">
                            <span>Cambio a EUR:</span>
                            <input type="number" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} className="w-16 bg-transparent text-right outline-none border-b border-yellow-500" />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <select value={category} onChange={e => setCategory(e.target.value)} className={`p-3 rounded-xl font-bold text-sm ${t.input}`}>
                            {Object.keys(categories[type] || {}).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={subCategory} onChange={e => setSubCategory(e.target.value)} className={`p-3 rounded-xl font-bold text-sm ${t.input}`}>
                            {(categories[type][category] || []).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <select value={periodicity} onChange={e => setPeriodicity(e.target.value)} className={`p-3 rounded-xl font-bold text-sm ${t.input}`}><option value="puntual">Puntual</option><option value="mensual">Mensual</option><option value="anual">Anual</option><option value="bianual">Bianual</option></select>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`p-3 rounded-xl font-bold text-sm ${t.input}`} />
                    </div>

                    <input value={note} onChange={e => setNote(e.target.value)} placeholder="Nota / Detalle adicional" className={`p-3 rounded-xl font-bold text-sm ${t.input}`} />

                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40 flex items-center gap-2"><Tag size={12} /> Etiquetas</span>
                            <button type="button" onClick={() => setIsAddingTag(!isAddingTag)} className={`text-[10px] font-black uppercase tracking-widest ${activeColor.text}`}>
                                {isAddingTag ? 'Cancelar' : '+ Nueva'}
                            </button>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                            {globalTags.map(gt => (
                                <button 
                                    key={gt.name} 
                                    type="button" 
                                    onClick={() => toggleTag(gt.name)}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight transition-all border ${tags.includes(gt.name) ? 'border-transparent text-white shadow-lg' : 'bg-transparent border-white/10 opacity-40 hover:opacity-100'}`}
                                    style={{ backgroundColor: tags.includes(gt.name) ? gt.color : 'transparent' }}
                                >
                                    {gt.name}
                                </button>
                            ))}
                            {globalTags.length === 0 && !isAddingTag && (
                                <span className="text-[10px] font-bold opacity-20 italic">No hay etiquetas creadas</span>
                            )}
                        </div>

                        {isAddingTag && (
                            <input 
                                autoFocus
                                value={newTagInput}
                                onChange={e => setNewTagInput(e.target.value)}
                                onKeyDown={handleCreateTag}
                                placeholder="Nombre de etiqueta (Enter para guardar)"
                                className={`w-full p-3 rounded-xl font-bold text-xs ${t.input}`}
                            />
                        )}
                    </div>

                    <button type="submit" className={`w-full py-4 ${activeColor.bg} text-white rounded-xl font-black text-lg ${activeColor.hover} shadow-lg active:scale-95 transition-all`}>Guardar</button>
                </form>
            </div>
        </div>
    );
};

export default TransactionModal;
