import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { Plus, ArrowRight, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

const DebtsView = () => {
    const { theme, t, activeColor } = useAuth();
    const { debts, setDebts } = useFinance();
    return (
        <div className="space-y-8 animate-in zoom-in-95">
            <div className={`p-8 rounded-[32px] border flex flex-col md:flex-row items-center justify-between gap-6 ${t.card}`}>
                <div>
                    <h3 className="text-2xl font-black mb-2">Gestión de Deudas</h3>
                    <p className={t.textSec}>Controla quién te debe y a quién debes.</p>
                </div>
                <div className="flex gap-8 text-right">
                    <div>
                        <span className="block text-xs font-bold text-green-500 uppercase tracking-widest">Por cobrar</span>
                        <span className="text-3xl font-black">{debts.filter(d => d.type === 'owed' && !d.paid).reduce((a, b) => a + b.amount, 0)}€</span>
                    </div>
                    <div>
                        <span className="block text-xs font-bold text-red-500 uppercase tracking-widest">Por pagar</span>
                        <span className="text-3xl font-black">{debts.filter(d => d.type === 'owe' && !d.paid).reduce((a, b) => a + b.amount, 0)}€</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Formulario Nueva Deuda */}
                <div className={`p-6 rounded-[32px] border h-fit ${t.card}`}>
                    <h4 className="font-bold mb-4 flex items-center gap-2"><Plus size={18} /> Registrar Deuda</h4>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const newDebt = {
                            id: crypto.randomUUID(),
                            person: e.target.person.value,
                            amount: parseFloat(e.target.amount.value),
                            type: e.target.type.value,
                            note: e.target.note.value,
                            paid: false,
                            date: new Date().toISOString()
                        };
                        setDebts([...debts, newDebt]);
                        e.target.reset();
                    }} className="space-y-3">
                        <div className="flex p-1 rounded-xl bg-black/20 border border-white/5">
                            <label className="flex-1 cursor-pointer">
                                <input type="radio" name="type" value="owed" className="peer sr-only" defaultChecked />
                                <span className="block text-center py-2 text-xs font-bold rounded-lg peer-checked:bg-green-600 peer-checked:text-white transition-all">Me deben</span>
                            </label>
                            <label className="flex-1 cursor-pointer">
                                <input type="radio" name="type" value="owe" className="peer sr-only" />
                                <span className="block text-center py-2 text-xs font-bold rounded-lg peer-checked:bg-red-600 peer-checked:text-white transition-all">Debo</span>
                            </label>
                        </div>
                        <input name="person" placeholder="Persona / Entidad" required className={`w-full p-3 rounded-xl text-sm font-bold outline-none ${t.input}`} />
                        <input name="amount" type="number" step="0.01" placeholder="Importe (€)" required className={`w-full p-3 rounded-xl text-sm font-bold outline-none ${t.input}`} />
                        <input name="note" placeholder="Concepto (opcional)" className={`w-full p-3 rounded-xl text-sm font-bold outline-none ${t.input}`} />
                        <button className={`w-full py-3 ${activeColor.bg} text-white rounded-xl font-bold ${activeColor.hover}`}>Añadir</button>
                    </form>
                </div>

                {/* Lista Deudas */}
                <div className="lg:col-span-2 space-y-4">
                    {debts.length === 0 ? <div className={`text-center py-10 ${t.textSec}`}>No hay deudas registradas.</div> :
                        debts.map(debt => (
                            <div key={debt.id} className={`p-4 rounded-2xl border flex items-center justify-between group ${debt.paid ? 'opacity-50' : ''} ${t.card}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${debt.type === 'owed' ? 'bg-green-600' : 'bg-red-600'}`}>
                                        {debt.type === 'owed' ? <ArrowRight size={18} className="-rotate-45" /> : <ArrowRight size={18} className="rotate-135" />}
                                    </div>
                                    <div>
                                        <h4 className={`font-bold ${debt.paid ? 'line-through' : ''}`}>{debt.person}</h4>
                                        <p className={`text-xs ${t.textSec}`}>{debt.note || new Date(debt.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`text-lg font-black ${debt.type === 'owed' ? 'text-green-500' : 'text-red-500'}`}>{debt.amount}€</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setDebts(debts.map(d => d.id === debt.id ? { ...d, paid: !d.paid } : d))} className={`p-2 rounded-lg ${debt.paid ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'} hover:scale-110 transition-transform`}>
                                            {debt.paid ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                                        </button>
                                        <button onClick={() => setDebts(debts.filter(d => d.id !== debt.id))} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            </div>
                        ))
                    }
                </div>
            </div>
        </div>
    );
};

export default DebtsView;
