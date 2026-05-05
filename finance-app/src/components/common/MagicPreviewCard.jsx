import React from 'react';
import { Check, X, Pencil, Calendar, Tag, Wallet, Box } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../constants/theme';
import { parseLocalDate } from '../../utils/helpers';

const MagicPreviewCard = ({ transaction, onAccept, onCancel, onEdit }) => {
    const { theme, t, activeColor } = useAuth();
    if (!transaction) return null;

    const Icon = CATEGORY_ICONS[transaction.category] || Box;
    const color = CATEGORY_COLORS[transaction.category] || '#8E8E93';

    return (
        <div className="fixed inset-x-4 bottom-24 md:bottom-10 md:left-auto md:right-10 md:w-96 z-[100] animate-in slide-in-from-bottom-10 duration-500 ease-out">
            <div className={`p-6 rounded-[32px] border shadow-2xl backdrop-blur-xl ${theme === 'dark' ? 'bg-black/80 border-white/10' : 'bg-white/90 border-gray-200'} border-t-4`} style={{ borderTopColor: color }}>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md mb-2 inline-block ${transaction.type === 'income' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            {transaction.type === 'income' ? 'Ingreso Detectado' : 'Gasto Detectado'}
                        </span>
                        <h4 className="text-xl font-black tracking-tight">{transaction.note}</h4>
                    </div>
                    <div className="p-3 rounded-2xl bg-white/5" style={{ color: color }}>
                        <Icon size={24} />
                    </div>
                </div>

                <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center"><Wallet size={18} /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase opacity-40">Importe</p>
                            <p className="text-lg font-black">{transaction.amountVal.toFixed(2)}€</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center"><Calendar size={18} /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase opacity-40">Fecha</p>
                            <p className="text-sm font-bold">{parseLocalDate(transaction.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center"><Tag size={18} /></div>
                        <div>
                            <p className="text-[10px] font-black uppercase opacity-40">Categoría</p>
                            <p className="text-sm font-bold">{transaction.category}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <button onClick={onCancel} className={`py-4 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'} transition-all`}>
                        <X size={20} className="text-red-500" />
                    </button>
                    <button onClick={onEdit} className={`py-4 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'} transition-all`}>
                        <Pencil size={20} className="text-blue-500" />
                    </button>
                    <button onClick={onAccept} className={`py-4 rounded-2xl flex items-center justify-center ${activeColor.bg} text-white shadow-xl shadow-blue-500/20 active:scale-95 transition-all`}>
                        <Check size={24} strokeWidth={3} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MagicPreviewCard;
