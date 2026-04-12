import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { X, Zap, Trash2, Play } from 'lucide-react';

const AutomationModal = ({ 
    isOpen, 
    onClose, 
    type, 
    setType, 
    category, 
    setCategory, 
    amount, 
    setAmount, 
    note, 
    setNote, 
    onLaunchAll
}) => {
    const { theme, t, activeColor } = useAuth();
    const { categories, automationItems, setAutomationItems } = useFinance();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className={`w-full max-w-2xl rounded-t-[32px] md:rounded-[40px] shadow-2xl overflow-hidden border animate-in slide-in-from-bottom-6 duration-300 md:zoom-in-95 ${t.card}`} onClick={(e) => e.stopPropagation()}>
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black flex items-center gap-3">
                            <Zap className="text-yellow-500" /> Automatización Mensual
                        </h2>
                        <p className={`text-xs font-bold mt-1 ${t.textSec}`}>Configura tus gastos fijos recurrentes.</p>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><X size={20} /></button>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto">
                    <div className="space-y-4">
                        <h3 className="font-black text-sm uppercase tracking-widest opacity-50">Añadir Plantilla</h3>
                        <div className="space-y-3">
                            <div className={`flex p-1 rounded-xl border ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                                <button onClick={() => setType('expense')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${type === 'expense' ? 'bg-red-500 text-white shadow' : 'text-gray-500 hover:bg-white/5'}`}>Gasto</button>
                                <button onClick={() => setType('income')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${type === 'income' ? 'bg-green-500 text-white shadow' : 'text-gray-500 hover:bg-white/5'}`}>Ingreso</button>
                            </div>
                            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`w-full p-3 rounded-xl text-sm font-bold outline-none ${t.input}`}>
                                <option value="">Categoría...</option>
                                {Object.keys(categories[type] || {}).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input type="number" placeholder="Importe (€)" value={amount} onChange={(e) => setAmount(e.target.value)} className={`w-full p-3 rounded-xl text-sm font-bold outline-none ${t.input}`} />
                            <input type="text" placeholder="Nota / Concepto" value={note} onChange={(e) => setNote(e.target.value)} className={`w-full p-3 rounded-xl text-sm font-bold outline-none ${t.input}`} />
                            <button 
                                disabled={!amount || !category}
                                onClick={() => {
                                    const newItem = {
                                        id: crypto.randomUUID(),
                                        amountVal: parseFloat(amount),
                                        type, category, subCategory: '', note,
                                        periodicity: 'mensual'
                                    };
                                    setAutomationItems([...automationItems, newItem]);
                                    setAmount(''); setNote('');
                                }}
                                className={`w-full py-4 rounded-xl font-black bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95 shadow-lg`}
                            >
                                Guardar en Lista
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4 flex flex-col h-full">
                        <h3 className="font-black text-sm uppercase tracking-widest opacity-50">Gastos Programados</h3>
                        <div className="flex-1 space-y-2 overflow-y-auto pr-2 min-h-[200px]">
                            {automationItems.length === 0 ? (
                                <div className={`p-8 text-center border-2 border-dashed rounded-3xl flex flex-col items-center justify-center h-full ${t.textSec} border-white/5`}>
                                    <p className="font-bold text-xs">No hay plantillas guardadas.</p>
                                </div>
                            ) : (
                                automationItems.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-3 rounded-2xl bg-white/5 border border-white/5 group hover:border-white/20 transition-all">
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm truncate">{item.note || item.category}</p>
                                            <p className={`text-[10px] font-bold ${t.textSec} uppercase`}>{item.category} • <span className={item.type === 'expense' ? 'text-red-400' : 'text-green-400'}>{item.amountVal.toFixed(2)}€</span></p>
                                        </div>
                                        <button onClick={() => setAutomationItems(automationItems.filter(i => i.id !== item.id))} className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 rounded-lg">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        {automationItems.length > 0 && (
                            <button 
                                onClick={onLaunchAll}
                                className={`w-full py-4 mt-4 rounded-2xl font-black text-sm ${activeColor.bg} text-white shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2`}
                            >
                                <Play size={18} fill="currentColor" /> LANZAR TODO AHORA
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AutomationModal;
