import React from 'react';
import { 
    LayoutGrid, List, Repeat,
    Users, Settings, LogOut, CheckCircle2,
    Eye, EyeOff, XCircle, ShieldCheck, HeartPulse
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';

const Sidebar = ({ view, setView, onOpenHouseholdGate }) => {
    const { currentUser, theme, t, activeColor, logout, privacyMode, setPrivacyMode, isSocial, setMode, activeHouseholdId, setActiveHouseholdId } = useAuth();
    const { saveStatus, households } = useFinance();

    const navItems = [
        { id: 'dashboard', icon: LayoutGrid, label: 'Resumen' },
        { id: 'list', icon: List, label: 'Movimientos' },
        { id: 'fixed', icon: Repeat, label: 'Gastos Fijos' },
        { id: 'debts', icon: ShieldCheck, label: 'Gestión Deudas' },
        { id: 'settings', icon: Settings, label: 'Ajustes' }
    ];

    const isHouseholdReady = (h) => (h?.members || []).filter(m => m.userId).length >= 2;
    const readyHouseholds = (households || []).filter(isHouseholdReady);

    const handleSocialToggle = () => {
        if (isSocial) { setMode('personal'); return; }
        if (readyHouseholds.length === 0) { onOpenHouseholdGate?.(); return; }
        const target = readyHouseholds.find(h => h.id === activeHouseholdId) || readyHouseholds[0];
        if (target?.id !== activeHouseholdId) setActiveHouseholdId(target.id);
        setMode('social');
    };

    const activeHousehold = (households || []).find(h => h.id === activeHouseholdId) || null;

    const settingsRow = (
        <button
            onClick={() => setView('settings')}
            className={`w-full group relative flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 ${view === 'settings'
                ? `${theme === 'dark' ? 'bg-white/5 text-white' : 'bg-gray-100 text-black'}`
                : `${t.textSec} hover:bg-white/5`}`}
        >
            {view === 'settings' && (
                <div className={`absolute left-0 w-1.5 h-8 rounded-r-full ${activeColor.bg} shadow-[0_0_15px_rgba(59,130,246,0.5)]`} />
            )}
            <Settings size={22} strokeWidth={view === 'settings' ? 2.5 : 2} className={`transition-all duration-300 ${view === 'settings' ? activeColor.text + ' scale-110' : 'group-hover:scale-110'}`} />
            <span className={`hidden lg:block font-black text-sm tracking-tight transition-all ${view === 'settings' ? 'translate-x-1' : ''}`}>Ajustes</span>
        </button>
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

                {/* TOGGLE MODO SOCIAL */}
                <button
                    onClick={handleSocialToggle}
                    aria-pressed={isSocial}
                    className={`w-full group relative flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 ${isSocial
                        ? `${theme === 'dark' ? 'bg-[#D4AF37]/10 text-[#E8C547]' : 'bg-[#F8E8B8]/70 text-[#8B6914]'}`
                        : `${t.textSec} hover:bg-white/5`}`}
                >
                    <Users size={22} strokeWidth={isSocial ? 2.5 : 2} className={`transition-all duration-300 ${isSocial ? 'text-[#D4AF37] scale-110 drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]' : 'group-hover:scale-110'}`} />
                    <span className="hidden lg:flex flex-col items-start min-w-0 transition-all">
                        <span className={`font-black text-sm tracking-tight ${isSocial ? 'translate-x-1' : ''}`}>{isSocial ? 'Modo Social' : 'Social'}</span>
                        {isSocial && activeHousehold && (
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 truncate max-w-[140px]">{activeHousehold.name}</span>
                        )}
                    </span>
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
