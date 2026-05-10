import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, LayoutGrid, List, TrendingUp, Target, Settings, Shield, Download, Moon, Sun, X, ArrowRight, Zap, Tag } from 'lucide-react';

const CommandPalette = ({ isOpen, onClose, setView, setPrivacyMode, privacyMode, setTheme, theme, exportToExcel, transactions, activeColor, t }) => {
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef(null);

    // Lista de comandos estáticos
    const navCommands = [
        { id: 'dashboard', label: 'Ir a Panel de Control', icon: LayoutGrid, category: 'Navegación' },
        { id: 'list', label: 'Ver Movimientos', icon: List, category: 'Navegación' },
        { id: 'goals', label: 'Gestionar Metas de Ahorro', icon: Target, category: 'Navegación' },
        { id: 'settings', label: 'Gestión de Etiquetas y App', icon: Tag, category: 'Navegación' }
    ];

    const actionCommands = [
        { id: 'privacy', label: privacyMode ? 'Desactivar Modo Privacidad' : 'Activar Modo Privacidad', icon: Shield, category: 'Acciones' },
        { id: 'theme', label: theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro', icon: theme === 'dark' ? Sun : Moon, category: 'Acciones' },
        { id: 'export', label: 'Exportar Historial a Excel', icon: Download, category: 'Acciones' }
    ];

    // Búsqueda inteligente
    const filteredResults = useMemo(() => {
        if (!query) return [...navCommands, ...actionCommands];

        const q = query.toLowerCase();
        
        // 1. Filtrar comandos
        const matchedCommands = [...navCommands, ...actionCommands].filter(c => 
            c.label.toLowerCase().includes(q)
        );

        // 2. Buscar en transacciones recientes (limitado a 5)
        const matchedTx = (transactions || [])
            .filter(tx => (tx.note || tx.category || tx.subCategory || "").toLowerCase().includes(q))
            .slice(0, 5)
            .map(tx => ({
                id: `tx-${tx.id}`,
                label: `${tx.note || tx.category} (${tx.amountVal.toFixed(2)}€)`,
                icon: Zap,
                category: 'Transacciones Recientes',
                action: () => {
                    setView('list');
                    onClose();
                }
            }));

        return [...matchedCommands, ...matchedTx];
    }, [query, privacyMode, theme, transactions]);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setActiveIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev + 1) % filteredResults.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev - 1 + filteredResults.length) % filteredResults.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selected = filteredResults[activeIndex];
            if (selected) executeCommand(selected);
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const executeCommand = (cmd) => {
        if (cmd.action) {
            cmd.action();
            return;
        }

        switch (cmd.id) {
            case 'privacy': setPrivacyMode(!privacyMode); break;
            case 'theme': setTheme(theme === 'dark' ? 'light' : 'dark'); break;
            case 'export': exportToExcel(); break;
            default: setView(cmd.id); break;
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 backdrop-blur-md bg-black/40 animate-in fade-in duration-300">
            <div className="fixed inset-0" onClick={onClose} />
            
            <div className={`relative w-full max-w-2xl overflow-hidden rounded-[32px] border shadow-2xl animate-in zoom-in-95 duration-200 ${t.card} ${t.bg}`}>
                {/* Search Input */}
                <div className="flex items-center gap-4 px-6 py-5 border-b border-white/5">
                    <Search className={`w-5 h-5 ${activeColor.text}`} />
                    <input 
                        ref={inputRef}
                        type="text"
                        placeholder="Escribe un comando o busca un gasto..."
                        className="bg-transparent border-none outline-none text-lg font-bold w-full"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/20 border border-white/5 text-[10px] font-black opacity-40">
                        <span className="text-xs uppercase">Esc</span>
                    </div>
                </div>

                {/* Results Area */}
                <div className="max-h-[400px] overflow-y-auto p-3 p-y-4">
                    {filteredResults.length === 0 ? (
                        <div className="p-10 text-center">
                            <p className="text-sm font-bold opacity-30 italic">No hemos encontrado nada para "{query}"</p>
                        </div>
                    ) : (
                        <div>
                            {filteredResults.reduce((acc, cmd, i) => {
                                // Agrupación por categoría
                                if (i === 0 || cmd.category !== filteredResults[i-1].category) {
                                    acc.push(
                                        <div key={`cat-${cmd.category}`} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest opacity-20 mt-4 mb-2">
                                            {cmd.category}
                                        </div>
                                    );
                                }
                                
                                acc.push(
                                    <button
                                        key={cmd.id}
                                        className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all group ${i === activeIndex ? `${activeColor.bg} text-white shadow-lg shadow-blue-500/20` : `${t.hover} ${t.textSec}`}`}
                                        onMouseMove={() => setActiveIndex(i)}
                                        onClick={() => executeCommand(cmd)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-xl ${i === activeIndex ? 'bg-white/20' : 'bg-white/5 opacity-40'}`}>
                                                <cmd.icon size={18} />
                                            </div>
                                            <span className="font-bold text-sm tracking-tight">{cmd.label}</span>
                                        </div>
                                        <ArrowRight size={16} className={`opacity-0 ${i === activeIndex ? 'opacity-100' : ''} transition-opacity`} />
                                    </button>
                                );
                                return acc;
                            }, [])}
                        </div>
                    )}
                </div>

                {/* Footer / Shortcuts */}
                <div className="px-6 py-4 border-t border-white/5 bg-black/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-40">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1.5"><ArrowRight size={12} className="rotate-90" /> Navegar</span>
                        <span className="flex items-center gap-1.5"><ArrowRight size={12} className="-rotate-90" /> Seleccionar</span>
                    </div>
                    <span>AlCash Smart Palette</span>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
