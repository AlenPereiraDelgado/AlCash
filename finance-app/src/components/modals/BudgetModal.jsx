import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { CATEGORY_COLORS } from '../../constants/theme';
import { X } from 'lucide-react';

const BudgetModal = ({ 
    isOpen, 
    onClose 
}) => {
    const { theme, t, activeColor } = useAuth();
    const { categories, budgets, setBudgets, transactions } = useFinance();

    const spendingByCategory = React.useMemo(() => {
        const now = new Date();
        const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
        const byCat = {};
        (transactions || []).forEach(tx => {
            if (tx.type === 'expense' && tx.date.startsWith(currentMonth)) {
                byCat[tx.category] = (byCat[tx.category] || 0) + tx.amountVal;
            }
        });
        return byCat;
    }, [transactions]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className={`w-full max-w-lg rounded-t-[32px] md:rounded-[40px] shadow-2xl overflow-hidden border animate-in slide-in-from-bottom-6 duration-300 md:zoom-in-95 ${t.card} ${t.bg}`} onClick={(e) => e.stopPropagation()}>
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black">Planificar Presupuestos</h2>
                        <p className={`text-xs font-bold mt-1 ${t.textSec}`}>Pon límites mensuales a tus gastos.</p>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><X size={20} /></button>
                </div>
                <div className="p-8 overflow-y-auto space-y-4 max-h-[60vh] no-scrollbar">
                    {Object.keys(categories.expense || {}).map(cat => {
                        const spent = spendingByCategory[cat] || 0;
                        const limit = budgets[cat] || 0;
                        const percent = limit > 0 ? (spent / limit) * 100 : 0;

                        return (
                            <div key={cat} className={`group p-4 rounded-3xl border transition-all ${theme === 'dark' ? 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]' : 'bg-gray-50 border-gray-100'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] || '#8E8E93' }} />
                                        <span className="font-bold text-sm">{cat}</span>
                                    </div>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            placeholder="Sin límite" 
                                            value={budgets[cat] || ''} 
                                            onChange={(e) => setBudgets({ ...budgets, [cat]: e.target.value ? parseFloat(e.target.value) : 0 })}
                                            className={`w-28 p-2 pr-6 rounded-xl text-right font-black text-sm outline-none border focus:ring-2 focus:ring-blue-500/50 transition-all ${t.input} ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-30 pointer-events-none">€</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-40">
                                        <span>Gasto actual: {spent.toFixed(0)}€</span>
                                        {limit > 0 && <span>{percent.toFixed(0)}% Utilizado</span>}
                                    </div>
                                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-200'}`}>
                                        <div 
                                            className={`h-full transition-all duration-700 ${percent > 100 ? 'bg-red-500' : percent > 85 ? 'bg-orange-500' : 'bg-blue-500'}`}
                                            style={{ width: `${Math.min(100, percent)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="p-8 border-t border-white/5">
                    <button onClick={onClose} className={`w-full py-4 rounded-2xl font-black ${activeColor.bg} text-white shadow-xl active:scale-95 transition-all`}>Guardar Configuración</button>
                </div>
            </div>
        </div>
    );
};

export default BudgetModal;
