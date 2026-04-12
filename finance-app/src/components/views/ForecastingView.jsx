import React, { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { TrendingUp, Target, Calendar, ArrowUpRight, ShieldCheck, Zap, Info, TrendingDown, PieChart } from 'lucide-react';
import { getDynamicFontSize } from '../../utils/helpers';

const ForecastingView = ({ transactions, netWorth, savingsRate }) => {
    const { theme, t, activeColor } = useAuth();
    
    // Estados para simulación interactiva
    const [annualInterest, setAnnualInterest] = useState(7); // 7% por defecto
    const [extraSavings, setExtraSavings] = useState(0); // Ahorro extra mensual
    
    const monthlySavingsBase = (netWorth * (savingsRate / 100)) || 0;
    const totalMonthlySavings = monthlySavingsBase + extraSavings;

    const projections = useMemo(() => {
        const months = [12, 36, 60, 120, 240]; // 1y, 3y, 5y, 10y, 20y
        const r = annualInterest / 100;
        const n = 12; // Mensual
        
        return months.map(m => {
            const p = netWorth;
            const t = m / 12;
            const pmt = Math.max(0, totalMonthlySavings);

            const principalCompounded = p * Math.pow(1 + r/n, n * t);
            const contributionsCompounded = pmt * ( (Math.pow(1 + r/n, n * t) - 1) / (r/n) );
            
            const total = principalCompounded + contributionsCompounded;
            const totalInvested = p + (pmt * m);

            return {
                label: `${m / 12} años`,
                value: total,
                onlySavings: totalInvested,
                interestGained: total - totalInvested
            };
        });
    }, [netWorth, totalMonthlySavings, annualInterest]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header y Controles de Simulación */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2">
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-gradient">Simulador de Libertad</h2>
                    <p className={`${t.textSec} font-bold text-sm mb-10 max-w-xl`}>Visualiza el poder del interés compuesto y proyecta tu futuro financiero con precisión profesional.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Control Interés */}
                        <div className={`p-8 rounded-[40px] border transition-all hover:border-blue-500/30 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><TrendingUp size={16} /></div>
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Rentabilidad</span>
                                </div>
                                <span className="text-2xl font-black text-blue-500">{annualInterest}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="1" 
                                max="15" 
                                step="0.5"
                                value={annualInterest} 
                                onChange={(e) => setAnnualInterest(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-blue-500/10 rounded-full appearance-none cursor-pointer accent-blue-600 mb-4"
                            />
                            <div className="flex justify-between text-[9px] font-black opacity-30 uppercase tracking-widest">
                                <span>Conservador</span>
                                <span>Agresivo</span>
                            </div>
                        </div>

                        {/* Control Ahorro Extra */}
                        <div className={`p-8 rounded-[40px] border transition-all hover:border-emerald-500/30 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500"><Target size={16} /></div>
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Ahorro Extra</span>
                                </div>
                                <span className="text-2xl font-black text-emerald-500">+{extraSavings}€</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="2000" 
                                step="50"
                                value={extraSavings} 
                                onChange={(e) => setExtraSavings(parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-emerald-500/10 rounded-full appearance-none cursor-pointer accent-emerald-600 mb-4"
                            />
                            <div className="flex justify-between text-[9px] font-black opacity-30 uppercase tracking-widest">
                                <span>Base actual</span>
                                <span>Maximizar</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Resumen Actual Premium */}
                <div className={`p-10 rounded-[48px] border-none shadow-2xl ${activeColor.bg} text-white relative overflow-hidden group`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50" />
                    <div className="absolute -right-12 -bottom-12 p-16 opacity-10 transition-transform group-hover:scale-110 duration-1000">
                        <PieChart size={200} strokeWidth={1} />
                    </div>
                    
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70 mb-3">Capacidad de Inversión</p>
                        <h3 className="text-6xl font-black tracking-tighter mb-10">{totalMonthlySavings.toFixed(0)}<span className="text-2xl opacity-50 ml-1">€/mes</span></h3>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-4 rounded-2xl bg-white/10 backdrop-blur-md">
                                <span className="text-xs font-bold opacity-70">Ahorro Base</span>
                                <span className="font-black">{monthlySavingsBase.toFixed(0)}€</span>
                            </div>
                            <div className="flex justify-between items-center p-4 rounded-2xl bg-white/10 backdrop-blur-md">
                                <span className="text-xs font-bold opacity-70">Ajuste Simulado</span>
                                <span className="font-black">+{extraSavings}€</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid de Proyecciones de Patrimonio */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                {projections.map((p, i) => (
                    <div key={i} className={`p-8 rounded-[40px] border transition-all duration-500 hover:-translate-y-2 relative overflow-hidden group ${t.card}`}>
                        <div className="absolute top-0 right-0 p-4 opacity-[0.03] rotate-12 transition-transform group-hover:scale-120">
                            <Calendar size={60} />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">{p.label}</p>
                        <h3 className={`text-2xl font-black tracking-tighter text-gradient leading-none mb-6`}>
                            {p.value.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€
                        </h3>
                        <div className="space-y-3">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black opacity-30 uppercase tracking-widest mb-1">Crecimiento IA</span>
                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className={`h-full ${activeColor.bg} opacity-50`} style={{ width: `${(p.interestGained/p.value)*100}%` }} />
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-black text-emerald-400 uppercase">Interés</span>
                                <span className="text-[10px] font-black text-emerald-400">+{p.interestGained.toLocaleString()}€</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Gráfico Comparativo Avanzado */}
            <div className={`p-10 md:p-14 rounded-[56px] border relative overflow-hidden ${t.card}`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-20 relative z-10">
                    <div>
                        <h3 className="text-3xl font-black tracking-tighter flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-yellow-500/10 text-yellow-500 shadow-lg shadow-yellow-500/10">
                                <Zap className="fill-yellow-500" size={28} />
                            </div>
                            Curva de Compuesto
                        </h3>
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mt-3 ml-1`}>Proyección exponencial de activos</p>
                    </div>
                    <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 shadow-lg shadow-blue-500/20" /> 
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Capital + Interés</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-gray-500/30" /> 
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Solo Ahorro</span>
                        </div>
                    </div>
                </div>

                <div className="h-[350px] flex items-end justify-between gap-6 relative px-4">
                    {/* Guías de fondo */}
                    <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col justify-between py-2 pointer-events-none">
                        {[1, 2, 3, 4].map(i => <div key={i} className={`w-full border-t border-dashed ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`} />)}
                    </div>

                    {projections.map((p, i) => {
                        const maxVal = projections[projections.length - 1].value;
                        const hInt = (p.value / maxVal) * 100;
                        const hSav = (p.onlySavings / maxVal) * 100;

                        return (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative z-10">
                                {/* Barra Interés (Total) */}
                                <div 
                                    className="w-full max-w-[50px] rounded-t-2xl bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-1000 ease-out group-hover:brightness-125 relative shadow-2xl shadow-blue-500/10 cursor-help"
                                    style={{ height: `${hInt}%` }}
                                >
                                    <div className={`absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 ${t.card} border p-2 rounded-xl text-[10px] font-black whitespace-nowrap shadow-2xl z-50`}>
                                        <p className="text-blue-500">Total: {p.value.toLocaleString()}€</p>
                                        <p className="text-green-500">+{p.interestGained.toLocaleString()}€ interés</p>
                                    </div>
                                </div>
                                {/* Barra Solo Ahorro Overlay */}
                                <div 
                                    className="w-full max-w-[50px] rounded-t-2xl bg-gray-500/20 absolute bottom-0 transition-all duration-1000 ease-out"
                                    style={{ height: `${hSav}%` }}
                                />
                                <span className={`text-[10px] font-black uppercase mt-6 transition-colors ${theme === 'dark' ? 'text-white/40 group-hover:text-white' : 'text-gray-400 group-hover:text-black'}`}>
                                    {p.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Análisis Pro */}
            <div className={`p-10 rounded-[48px] border border-blue-500/20 bg-gradient-to-br ${theme === 'dark' ? 'from-blue-900/10 to-transparent' : 'from-blue-50 to-transparent'} flex flex-col md:flex-row items-center gap-10`}>
                <div className="w-20 h-20 rounded-[28px] bg-blue-500 flex items-center justify-center text-white shrink-0 shadow-2xl shadow-blue-500/40">
                    <ShieldCheck size={40} />
                </div>
                <div className="flex-1 space-y-4">
                    <h4 className="text-2xl font-black tracking-tight">Análisis de Independencia Financiera</h4>
                    <p className={`text-sm leading-relaxed ${t.textSec} font-medium max-w-3xl`}>
                        Ajustando tu rentabilidad al <strong>{annualInterest}%</strong> y manteniendo un ahorro total de <strong>{totalMonthlySavings.toFixed(0)}€/mes</strong>, 
                        tu patrimonio dentro de 20 años alcanzaría los <strong>{projections[4].value.toLocaleString()}€</strong>.
                        Lo más impactante: el <strong>{((projections[4].interestGained/projections[4].value)*100).toFixed(0)}%</strong> de ese dinero sería generado puramente por el interés, 
                        sin que hayas tenido que trabajar por él. Este es el verdadero poder del interés compuesto.
                    </p>
                </div>
                <button className={`px-8 py-4 rounded-2xl font-black text-sm bg-white text-blue-600 shadow-xl shadow-white/10 active:scale-95 transition-all hidden lg:block`}>
                    Refinar Estrategia
                </button>
            </div>
        </div>
    );
};

export default ForecastingView;
