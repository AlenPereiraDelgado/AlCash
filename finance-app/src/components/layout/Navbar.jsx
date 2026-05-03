import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    LayoutGrid, List, Users, Target, Settings, TrendingUp,
    Eye, EyeOff, BarChart2, Repeat, ShieldCheck, MoreHorizontal, X, Plus
} from 'lucide-react';

const Navbar = ({ view, setView, isScrolled, onAdd }) => {
    const { activeColor, theme, t, privacyMode, setPrivacyMode } = useAuth();
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    ];

    const rightNav = [
        { id: 'joint', icon: Users, label: 'Social' },
    ];

    const secondaryNav = [
        { id: 'analysis', icon: BarChart2, label: 'Análisis' },
        { id: 'fixed', icon: Repeat, label: 'Gastos Fijos' },
        { id: 'forecasting', icon: TrendingUp, label: 'Proyecciones' },
        { id: 'debts', icon: ShieldCheck, label: 'Gestión Deudas' },
        { id: 'settings', icon: Settings, label: 'Ajustes' },
    ];

    return (
        <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'opacity-90' : 'opacity-100'}`}>
            {/* MENU ADICIONAL (DRAWER-LIKE) */}
            {isMenuOpen && (
                <>
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setIsMenuOpen(false)}></div>
                    <div className={`fixed bottom-24 left-4 right-4 z-50 p-6 rounded-[32px] border shadow-2xl animate-in slide-in-from-bottom-5 ${t.card} ${theme === 'dark' ? 'bg-black/90' : 'bg-white'}`}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black">Más Opciones</h3>
                            <button onClick={() => setIsMenuOpen(false)} className={`p-2 rounded-xl ${t.hover}`}><X size={20} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {secondaryNav.map(nav => (
                                <button
                                    key={nav.id}
                                    onClick={() => { setView(nav.id); setIsMenuOpen(false); }}
                                    className={`flex items-center gap-4 p-4 rounded-2xl transition-all border ${view === nav.id ? activeColor.bg + ' text-white border-transparent' : 'border-white/5 ' + t.hover}`}
                                >
                                    <nav.icon size={20} />
                                    <span className="font-bold text-sm">{nav.label}</span>
                                </button>
                            ))}
                            <button
                                onClick={() => { setPrivacyMode(!privacyMode); setIsMenuOpen(false); }}
                                className={`flex items-center gap-4 p-4 rounded-2xl transition-all border ${privacyMode ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'border-white/5 ' + t.hover}`}
                            >
                                {privacyMode ? <EyeOff size={20} /> : <Eye size={20} />}
                                <span className="font-bold text-sm">Privacidad</span>
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* BARRA PRINCIPAL */}
            <div className={`relative flex items-end justify-around py-2 px-4 pb-6 rounded-t-[32px] border-t shadow-[0_-10px_40px_rgba(0,0,0,0.3)] backdrop-blur-3xl ${theme === 'dark' ? 'bg-black/80 border-white/5' : 'bg-white/95 border-gray-100'}`}>
                {leftNav.map(nav => (
                    <button
                        key={nav.id}
                        onClick={() => { setView(nav.id); setIsMenuOpen(false); }}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all ${view === nav.id ? activeColor.text : t.textSec}`}
                    >
                        <nav.icon size={22} strokeWidth={view === nav.id ? 2.5 : 2} className={`transition-transform duration-300 ${view === nav.id ? 'scale-110 shadow-glow' : 'opacity-60'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-tighter ${view === nav.id ? 'opacity-100' : 'opacity-40'}`}>{nav.label}</span>
                    </button>
                ))}

                {/* BOTÓN PRINCIPAL: AÑADIR */}
                <button
                    onClick={() => { onAdd?.(); setIsMenuOpen(false); }}
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

                {rightNav.map(nav => (
                    <button
                        key={nav.id}
                        onClick={() => { setView(nav.id); setIsMenuOpen(false); }}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all ${view === nav.id ? activeColor.text : t.textSec}`}
                    >
                        <nav.icon size={22} strokeWidth={view === nav.id ? 2.5 : 2} className={`transition-transform duration-300 ${view === nav.id ? 'scale-110 shadow-glow' : 'opacity-60'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-tighter ${view === nav.id ? 'opacity-100' : 'opacity-40'}`}>{nav.label}</span>
                    </button>
                ))}

                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all ${isMenuOpen ? activeColor.text : t.textSec}`}
                >
                    <MoreHorizontal size={22} className={`transition-transform duration-300 ${isMenuOpen ? 'rotate-90 scale-110' : 'opacity-60'}`} />
                    <span className={`text-[10px] font-black uppercase tracking-tighter ${isMenuOpen ? 'opacity-100' : 'opacity-40'}`}>Más</span>
                </button>
            </div>
        </div>
    );
};

export default Navbar;
