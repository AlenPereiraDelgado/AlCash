import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { X, Globe, Plus, TrendingUp, TrendingDown, Repeat, Trash2, Check, CheckCircle2 } from 'lucide-react';

const ImportModal = ({ 
    isOpen, 
    onClose, 
    importText, 
    setImportText, 
    pendingImports, 
    setPendingImports, 
    onHandleFileUpload,
    onRunSmartAnalysis,
    onConfirmAll,
    onConfirmImportItem
}) => {
    const { theme, t, activeColor } = useAuth();
    const { categories } = useFinance();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => { if(pendingImports.length === 0) onClose(); }}>
            <div className={`w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden border animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] ${t.card}`} onClick={(e) => e.stopPropagation()}>
                <div className="p-8 border-b border-white/5 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-black flex items-center gap-3">
                            <Globe className="text-blue-500" /> Importación Inteligente
                        </h2>
                        <p className={`text-xs font-bold mt-1 ${t.textSec}`}>Sube un archivo o pega el extracto de tu banco.</p>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><X size={20} /></button>
                </div>
                
                <div className="p-8 overflow-y-auto space-y-8">
                    {/* ZONA DE CARGA */}
                    {pendingImports.length === 0 ? (
                        <div className="space-y-6">
                            <div className={`relative group border-2 border-dashed rounded-[32px] p-12 text-center transition-all ${theme === 'dark' ? 'border-white/10 hover:border-blue-500/50 bg-white/5' : 'border-gray-200 hover:border-blue-500/50 bg-gray-50'}`}>
                                <input type="file" onChange={onHandleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept=".csv,.txt" />
                                <div className="flex flex-col items-center gap-4">
                                    <div className="p-4 rounded-full bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform"><Plus size={32} /></div>
                                    <div>
                                        <p className="font-black text-lg">Suelta tu archivo aquí</p>
                                        <p className={`text-sm font-bold ${t.textSec}`}>Formatos aceptados: CSV, TXT (Extractos bancarios)</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <p className="text-xs font-black uppercase tracking-widest opacity-50 ml-2 text-center">O pega el texto directamente</p>
                                <textarea 
                                    value={importText}
                                    onChange={(e) => setImportText(e.target.value)}
                                    placeholder="Ejemplo: 12/04 COMPRA MERCADONA -45,20€..."
                                    className={`w-full h-40 p-6 rounded-[32px] text-sm font-bold outline-none resize-none shadow-inner ${t.input}`}
                                />
                                <button 
                                    onClick={() => onRunSmartAnalysis(importText)}
                                    disabled={!importText.trim()}
                                    className={`w-full py-4 rounded-2xl font-black ${activeColor.bg} text-white shadow-xl hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50`}
                                >
                                    Analizar Texto
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <h3 className="text-sm font-black uppercase tracking-widest opacity-50 px-2 flex justify-between">
                                Movimientos Detectados ({pendingImports.length})
                                <button onClick={() => setPendingImports([])} className="text-red-500 hover:underline">Limpiar todo</button>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pendingImports.map((item, idx) => (
                                    <div key={item.id} className={`p-5 rounded-[28px] border-2 transition-all flex flex-col gap-4 ${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-white border-gray-100'}`}>
                                        <div className="flex gap-3">
                                            <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${item.type === 'expense' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                                {item.type === 'expense' ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <input 
                                                    value={item.note} 
                                                    onChange={(e) => {
                                                        const newImports = [...pendingImports];
                                                        newImports[idx].note = e.target.value;
                                                        setPendingImports(newImports);
                                                    }}
                                                    className="w-full bg-transparent font-black text-sm outline-none border-b border-transparent focus:border-blue-500 transition-all truncate"
                                                />
                                                <div className="flex gap-2 mt-1">
                                                    <input 
                                                        type="date"
                                                        value={item.date} 
                                                        onChange={(e) => {
                                                            const newImports = [...pendingImports];
                                                            newImports[idx].date = e.target.value;
                                                            setPendingImports(newImports);
                                                        }}
                                                        className={`text-[10px] font-bold bg-transparent outline-none uppercase ${t.textSec}`}
                                                    />
                                                    <span className={`text-[10px] font-bold opacity-30`}>•</span>
                                                    <select 
                                                        value={item.category}
                                                        onChange={(e) => {
                                                            const newImports = [...pendingImports];
                                                            newImports[idx].category = e.target.value;
                                                            setPendingImports(newImports);
                                                        }}
                                                        className={`text-[10px] font-bold bg-transparent outline-none uppercase ${t.textSec} cursor-pointer`}
                                                    >
                                                        {Object.keys(categories[item.type] || {}).map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-4 mt-auto">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-black text-lg ${item.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
                                                    {item.type === 'expense' ? '-' : '+'}{item.amountVal.toFixed(2)}€
                                                </span>
                                                <button 
                                                    onClick={() => {
                                                        const newImports = [...pendingImports];
                                                        const oldType = item.type;
                                                        newImports[idx].type = oldType === 'expense' ? 'income' : 'expense';
                                                        newImports[idx].category = Object.keys(categories[newImports[idx].type] || {})[0] || 'Otros';
                                                        setPendingImports(newImports);
                                                    }}
                                                    className={`p-1.5 rounded-lg border border-white/5 transition-all ${t.hover}`}
                                                ><Repeat size={14} /></button>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => setPendingImports(pendingImports.filter(i => i.id !== item.id))}
                                                    className="p-3 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                                                ><Trash2 size={18} /></button>
                                                <button 
                                                    onClick={() => onConfirmImportItem(item)}
                                                    className={`p-3 rounded-2xl ${activeColor.bg} text-white shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all`}
                                                ><Check size={18} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button 
                                onClick={onConfirmAll}
                                className={`w-full py-5 rounded-[32px] font-black text-lg ${activeColor.bg} text-white shadow-2xl hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3`}
                            >
                                <CheckCircle2 size={24} /> ACEPTAR TODOS LOS MOVIMIENTOS
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
