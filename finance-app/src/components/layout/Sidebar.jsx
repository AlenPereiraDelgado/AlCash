import React from 'react';
import { 
    LayoutGrid, List, Repeat, BarChart2, TrendingUp, 
    Target, Users, Settings, LogOut, CheckCircle2, 
    Save, Eye, EyeOff, XCircle, ShieldCheck, HeartPulse
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';

const Sidebar = ({ view, setView, travelMode, setTravelMode, onBudget }) => {
    const { currentUser, theme, t, activeColor, logout, privacyMode, setPrivacyMode } = useAuth();
    const { saveStatus } = useFinance();

    const navItems = [
        { id: 'dashboard', icon: LayoutGrid, label: 'Resumen' },
        { id: 'list', icon: List, label: 'Movimientos' },
        { id: 'fixed', icon: Repeat, label: 'Gastos Fijos' },
        { id: 'analysis', icon: BarChart2, label: 'Análisis' },
        { id: 'forecasting', icon: TrendingUp, label: 'Proyecciones' },
        { id: 'debts', icon: ShieldCheck, label: 'Gestión Deudas' },
        { id: 'joint', icon: Users, label: 'Cuenta Conjunta' },
        { id: 'settings', icon: Settings, label: 'Ajustes' }
    ];

    const settingsRow = (
        <div className="flex gap-2 items-stretch">
            <button
                onClick={() => setView('settings')}
                className={`flex-1 group relative flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 ${view === 'settings'
                    ? `${theme === 'dark' ? 'bg-white/5 text-white' : 'bg-gray-100 text-black'}`
                    : `${t.textSec} hover:bg-white/5`}`}
            >
                {view === 'settings' && (
                    <div className={`absolute left-0 w-1.5 h-8 rounded-r-full ${activeColor.bg} shadow-[0_0_15px_rgba(59,130,246,0.5)]`} />
                )}
                <Settings size={22} strokeWidth={view === 'settings' ? 2.5 : 2} className={`transition-all duration-300 ${view === 'settings' ? activeColor.text + ' scale-110' : 'group-hover:scale-110'}`} />
                <span className={`hidden lg:block font-black text-sm tracking-tight transition-all ${view === 'settings' ? 'translate-x-1' : ''}`}>Ajustes</span>
            </button>
            <button
                onClick={onBudget}
                title="Presupuestos"
                className={`shrink-0 w-14 lg:w-14 flex items-center justify-center rounded-2xl border transition-all ${theme === 'dark' ? 'border-white/5 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'} ${t.textSec}`}
            >
                <Target size={20} strokeWidth={2.4} className={`${activeColor.text}`} />
            </button>
        </div>
    );

    return (
        <aside className={`w-20 md:w-20 lg:w-72 flex flex-col border-r fixed left-0 top-0 bottom-0 z-40 transition-all ${t.card} ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
            <div className="p-8 mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl ${activeColor.bg} flex items-center justify-center shadow-xl rotate-3`}>
                        <HeartPulse className="text-white" size={24} />
                    </div>
                    <h1 className={`hidden lg:block text-2xl font-black tracking-tighter text-gradient`}>AlCash</h1>
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-1">
                <button
                    onClick={() => setPrivacyMode(!privacyMode)}
                    className={`w-full p-3 mb-3 rounded-xl flex items-center gap-3 transition-all ${privacyMode ? 'bg-yellow-500/10 text-yellow-500' : `${t.textSec} hover:bg-white/5`}`}
                >
                    {privacyMode ? <EyeOff size={20} /> : <Eye size={20} />}
                    <span className="hidden lg:block text-xs font-black uppercase tracking-widest">{privacyMode ? 'Privado: ON' : 'Oculto: OFF'}</span>
                </button>

                {navItems.filter(item => item.id !== 'settings').map(item => {
                    const Icon = item.icon;
                    const isActive = view === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id)}
                            className={`w-full group relative flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 ${
                                isActive
                                ? `${theme === 'dark' ? 'bg-white/5 text-white' : 'bg-gray-100 text-black'}`
                                : `${t.textSec} hover:bg-white/5`
                            }`}
                        >
                            {isActive && (
                                <div className={`absolute left-0 w-1.5 h-8 rounded-r-full ${activeColor.bg} shadow-[0_0_15px_rgba(59,130,246,0.5)]`} />
                            )}
                            <Icon
                                size={22}
                                strokeWidth={isActive ? 2.5 : 2}
                                className={`transition-all duration-300 ${isActive ? activeColor.text + ' scale-110' : 'group-hover:scale-110'}`}
                            />
                            <span className={`hidden lg:block font-black text-sm tracking-tight transition-all ${isActive ? 'translate-x-1' : ''}`}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}

                {settingsRow}

                <div className="pt-6 mx-4 border-t border-white/5">
                    <div className={`w-full p-3 rounded-xl flex items-center gap-3 opacity-60`}>
                        {saveStatus === 'saving' ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" /> :
                            saveStatus === 'success' ? <CheckCircle2 size={18} className="text-emerald-500" /> :
                                saveStatus === 'error' ? <XCircle size={18} className="text-rose-500" /> :
                                    <ShieldCheck size={18} className={activeColor.text} />}
                        <span className="hidden lg:block text-[10px] font-black uppercase tracking-widest">
                            {saveStatus === 'saving' ? 'Sincronizando...' :
                             saveStatus === 'success' ? 'Sincronizado' :
                             saveStatus === 'error' ? 'Error Sync' : 'Protegido'}
                        </span>
                    </div>
                </div>
            </nav>

            <div className="p-6 mt-auto">
                <div className={`p-4 rounded-3xl border ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black">
                            {currentUser?.charAt(0).toUpperCase()}
                        </div>
                        <div className="hidden lg:block min-w-0">
                            <p className="text-xs font-black truncate">{currentUser}</p>
                            <p className="text-[10px] opacity-40 font-bold">Premium Plan</p>
                        </div>
                    </div>
                    <button onClick={logout} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all text-xs font-black uppercase tracking-widest">
                        <LogOut size={16} />
                        <span className="hidden lg:block">Cerrar Sesión</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
