import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { Target, Pencil, Trash2 } from 'lucide-react';
import { CircularProgress } from '../common/Progress';

const GoalsView = ({
    goalInputs,
    setGoalInputs,
    handleAddGoal
}) => {
    const { theme, t, activeColor } = useAuth();
    const { goals, updateGoal, deleteGoal } = useFinance();
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in zoom-in-95">
            <div className={`p-6 rounded-[32px] border-2 border-dashed flex flex-col items-center justify-center text-center gap-4 min-h-[300px] ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'} ${t.card}`}>
                <div className={`w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center ${activeColor.text}`}><Target size={32} /></div>
                <h3 className="font-bold text-lg">Nueva Meta</h3>
                <form onSubmit={handleAddGoal} className="w-full space-y-3">
                    <input name="goalName" placeholder="Nombre" required className={`w-full p-3 rounded-xl text-sm font-bold outline-none ${t.input}`} />
                    <input name="goalTarget" type="number" step="0.01" placeholder="Objetivo (€)" required className={`w-full p-3 rounded-xl text-sm font-bold outline-none ${t.input}`} />
                    <input name="goalDate" type="date" required className={`w-full p-3 rounded-xl text-sm font-bold outline-none ${t.input}`} />
                    <button className={`w-full py-3 ${activeColor.bg} text-white rounded-xl font-bold ${activeColor.hover}`}>Crear</button>
                </form>
            </div>
            {goals.map(goal => {
                const percent = Math.min((goal.current / goal.target) * 100, 100);
                const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));
                const remaining = goal.target - goal.current;
                const dailySave = daysLeft > 0 ? remaining / daysLeft : 0;
                const inputVal = goalInputs[goal.id] || '';

                return (
                    <div key={goal.id} className={`p-6 rounded-[32px] border flex flex-col justify-between min-h-[350px] ${t.card}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-black text-xl">{goal.name}</h3>
                                <p className={`text-xs font-bold ${t.textSec}`}>Meta: {goal.target.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => {
                                    const newName = prompt("Nuevo nombre:", goal.name);
                                    const newTarget = prompt("Nuevo objetivo:", goal.target);
                                    const newDate = prompt("Nueva fecha límite:", goal.deadline);
                                    if (newName && newTarget && newDate) {
                                        updateGoal(goal.id, { name: newName, target: parseFloat(newTarget), deadline: newDate });
                                    }
                                }} className="text-gray-400 hover:text-blue-500"><Pencil size={18} /></button>
                                <button onClick={() => deleteGoal(goal.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>
                            </div>
                        </div>

                        <div className="flex flex-col items-center mb-6">
                            <CircularProgress percentage={percent} color={goal.color} size={100}>
                                <div className="flex flex-col items-center">
                                    <span className="text-xl font-black">{Math.round(percent)}%</span>
                                    <span className="text-[10px] font-bold text-gray-400">{goal.current.toFixed(0)}€</span>
                                </div>
                            </CircularProgress>
                            <div className="mt-4 flex gap-4 text-center w-full">
                                <div className="flex-1">
                                    <p className="text-[10px] uppercase font-bold text-gray-400">Restante</p>
                                    <p className="font-black text-sm">{Math.max(remaining, 0).toFixed(0)}€</p>
                                </div>
                                <div className="flex-1 border-l border-gray-500/20">
                                    <p className="text-[10px] uppercase font-bold text-gray-400">Días Restantes</p>
                                    <p className={`font-black text-sm ${daysLeft < 30 ? 'text-red-500' : ''}`}>{Math.max(daysLeft, 0)}</p>
                                </div>
                                <div className="flex-1 border-l border-gray-500/20">
                                    <p className="text-[10px] uppercase font-bold text-gray-400">Ahorro Diario</p>
                                    <p className="font-black text-sm text-blue-500">{dailySave > 0 ? dailySave.toFixed(0) + '€' : '-'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-500/5 p-3 rounded-xl">
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="number"
                                    placeholder="Cantidad..."
                                    value={inputVal}
                                    onChange={(e) => setGoalInputs({ ...goalInputs, [goal.id]: e.target.value })}
                                    className={`flex-1 p-2 rounded-lg text-xs font-bold outline-none ${t.input}`}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    disabled={!inputVal}
                                    onClick={() => {
                                        const val = parseFloat(inputVal);
                                        if (!val) return;
                                        updateGoal(goal.id, { current: Math.max(0, Number(goal.current) + val) });
                                        setGoalInputs({ ...goalInputs, [goal.id]: '' });
                                    }}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold bg-green-500 text-white active:scale-95 transition-transform disabled:opacity-50`}
                                >
                                    + Ingresar
                                </button>
                                <button
                                    disabled={!inputVal}
                                    onClick={() => {
                                        const val = parseFloat(inputVal);
                                        if (!val) return;
                                        updateGoal(goal.id, { current: Math.max(0, Number(goal.current) - val) });
                                        setGoalInputs({ ...goalInputs, [goal.id]: '' });
                                    }}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold bg-red-500 text-white active:scale-95 transition-transform disabled:opacity-50`}
                                >
                                    - Retirar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default GoalsView;
