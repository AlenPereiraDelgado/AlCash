import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import {
    LayoutGrid, List, Users, Settings,
    Repeat, ShieldCheck, Plus
} from 'lucide-react';

const Navbar = ({ view, setView, isScrolled, onAdd, onOpenHouseholdGate }) => {
    const { activeColor, theme, t, setMode, isSocial, activeHouseholdId, setActiveHouseholdId } = useAuth();
    const { households } = useFinance();
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            if (window.visualViewport) {
                setIsKeyboardOpen(window.visualViewport.height < window.innerHeight * 0.85);
            }
        };
        window.visualViewport?.addEventListener('resize', handleResize);
        return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }, []);

    if (isKeyboardOpen) return null;

    const leftNav = [
        { id: 'dashboard', icon: LayoutGrid, label: 'Panel' },
        { id: 'list', icon: List, label: 'Movim' },
        { id: 'fixed', icon: Repeat, label: 'Fijos' },
    ];

    // Social = mode toggle, NO una vista. Pulsar alterna personal <-> social.
    // Sin hogar listo (≥2 miembros reclamados) → abre el modal para crear/aceptar.
    const handleSocialToggle = () => {
        if (isSocial) {
            setMode('personal');
            return;
        }
        const ready = (households || []).filter(h => (h.members || []).filter(m => m.userId).length >= 2);
        if (ready.length === 0) {
            onOpenHouseholdGate?.();
            return;
        }
        const target = ready.find(h => h.id === activeHouseholdId) || ready[0];
        if (target.id !== activeHouseholdId) setActiveHouseholdId(target.id);
        setMode('social');
    };

    return (
        <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'opacity-90' : 'opacity-100'}`}>
            {/* BARRA PRINCIPAL */}
            <div className={`relative flex items-end justify-around py-2 px-2 pb-6 rounded-t-[32px] border-t shadow-[0_-10px_40px_rgba(0,0,0,0.3)] backdrop-blur-3xl ${theme === 'dark' ? 'bg-black/80 border-white/5' : 'bg-white/95 border-gray-100'}`}>
                {leftNav.map(nav => (
                    <button
                        key={nav.id}
                        onClick={() => setView(nav.id)}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded-2xl transition-all ${view === nav.id ? activeColor.text : t.textSec}`}
                    >
                        <nav.icon size={19} strokeWidth={view === nav.id ? 2.5 : 2} className={`transition-transform duration-300 ${view === nav.id ? 'scale-110' : 'opacity-60'}`} />
                        <span className={`text-[9px] font-black uppercase tracking-tighter ${view === nav.id ? 'opacity-100' : 'opacity-40'}`}>{nav.label}</span>
                    </button>
                ))}

                {/* BOTÓN PRINCIPAL: AÑADIR */}
                <button
                    onClick={() => onAdd?.()}
                    className="group flex flex-col items-center gap-1 -translate-y-3 transition-all active:scale-90"
                >
                    <div className="relative">
                        <div className={`absolute inset-0 rounded-full ${activeColor.bg} blur-lg opacity-60 group-active:opacity-90 transition-opacity`} />
                        <div className={`relative w-11 h-11 rounded-full ${activeColor.bg} flex items-center justify-center shadow-xl ring-2 ring-white/20 group-hover:rotate-90 transition-transform duration-500`}>
                            <Plus size={22} strokeWidth={3.5} className="text-white drop-shadow" />
                        </div>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${activeColor.text}`}>Añadir</span>
                </button>

                {/* TOGGLE MODO SOCIAL */}
                <button
                    onClick={handleSocialToggle}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-2xl transition-all ${isSocial ? 'text-[#D4AF37]' : t.textSec}`}
                    aria-pressed={isSocial}
                >
                    <div className="relative">
                        <Users
                            size={19}
                            strokeWidth={isSocial ? 2.5 : 2}
                            className={`transition-transform duration-300 ${isSocial ? 'scale-110 drop-shadow-[0_0_8px_rgba(240,180,41,0.6)]' : 'opacity-60'}`}
                        />
                        {isSocial && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#D4AF37] ring-2 ring-black/40 animate-pulse" />
                        )}
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-tighter ${isSocial ? 'opacity-100' : 'opacity-40'}`}>Social</span>
                </button>

                {/* GESTIÓN DEUDAS */}
                <button
                    onClick={() => setView('debts')}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-2xl transition-all ${view === 'debts' ? activeColor.text : t.textSec}`}
                >
                    <ShieldCheck size={19} strokeWidth={view === 'debts' ? 2.5 : 2} className={`transition-transform duration-300 ${view === 'debts' ? 'scale-110' : 'opacity-60'}`} />
                    <span className={`text-[9px] font-black uppercase tracking-tighter ${view === 'debts' ? 'opacity-100' : 'opacity-40'}`}>Deudas</span>
                </button>

                {/* AJUSTES */}
                <button
                    onClick={() => setView('settings')}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-2xl transition-all ${view === 'settings' ? activeColor.text : t.textSec}`}
                >
                    <Settings size={19} strokeWidth={view === 'settings' ? 2.5 : 2} className={`transition-transform duration-300 ${view === 'settings' ? 'scale-110' : 'opacity-60'}`} />
                    <span className={`text-[9px] font-black uppercase tracking-tighter ${view === 'settings' ? 'opacity-100' : 'opacity-40'}`}>Ajustes</span>
                </button>
            </div>
        </div>
    );
};

export default Navbar;
