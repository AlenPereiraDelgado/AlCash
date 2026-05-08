import React from 'react';

/**
 * Gráfico de aguja para visualización de presupuestos o porcentajes.
 */
export const GaugeChart = ({ percentage, theme }) => {
    const [animPct, setAnimPct] = React.useState(0);
    const ref = React.useRef(null);
    const target = Math.min(Math.max(percentage || 0, 0), 100);

    React.useEffect(() => {
        if (!ref.current) return;
        let raf;
        let started = false;
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting && !started) {
                    started = true;
                    const begin = performance.now();
                    const dur = 1400;
                    const tick = (now) => {
                        const k = Math.min(1, (now - begin) / dur);
                        const eased = 1 - Math.pow(1 - k, 3);
                        setAnimPct(target * eased);
                        if (k < 1) raf = requestAnimationFrame(tick);
                    };
                    raf = requestAnimationFrame(tick);
                    obs.disconnect();
                }
            });
        }, { threshold: 0.25 });
        obs.observe(ref.current);
        return () => { obs.disconnect(); if (raf) cancelAnimationFrame(raf); };
    }, [target]);

    const size = 200;
    const stroke = 14;
    const radius = (size - stroke) / 2;
    const circumference = Math.PI * radius;
    const offset = circumference - (animPct / 100) * circumference;
    const cx = size / 2;
    const cy = size / 2;

    let color = '#30D158';
    let statusLabel = 'Saludable';
    if (percentage > 70) { color = '#FF9F0A'; statusLabel = 'Atención'; }
    if (percentage > 100) { color = '#FF453A'; statusLabel = 'Crítico'; }

    const tipAngle = Math.PI * (1 - Math.min(animPct, 100) / 100);
    const tipX = cx + radius * Math.cos(tipAngle);
    const tipY = cy - radius * Math.sin(tipAngle);

    const ticks = [50, 80, 100].map(p => {
        const a = Math.PI * (1 - p / 100);
        const inner = radius - stroke / 2 - 2;
        const outer = radius + stroke / 2 + 2;
        return {
            p,
            x1: cx + inner * Math.cos(a),
            y1: cy - inner * Math.sin(a),
            x2: cx + outer * Math.cos(a),
            y2: cy - outer * Math.sin(a),
        };
    });

    return (
        <div ref={ref} className="flex flex-col items-center w-full">
            <svg viewBox={`0 0 ${size} ${size / 2 + 18}`} className="w-full max-w-[260px] overflow-visible">
                <defs>
                    <linearGradient id="gaugeMultiStop" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#30D158" />
                        <stop offset="40%" stopColor="#A6E22E" />
                        <stop offset="65%" stopColor="#FFD60A" />
                        <stop offset="85%" stopColor="#FF9F0A" />
                        <stop offset="100%" stopColor="#FF453A" />
                    </linearGradient>
                    <radialGradient id="gaugeTipGlow">
                        <stop offset="0%" stopColor={color} stopOpacity="0.9" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </radialGradient>
                </defs>
                <path
                    d={`M ${stroke / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${cy}`}
                    fill="none"
                    stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                />
                {ticks.map(tk => (
                    <line
                        key={tk.p}
                        x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2}
                        stroke={theme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'}
                        strokeWidth={1.5}
                        strokeLinecap="round"
                    />
                ))}
                <path
                    d={`M ${stroke / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${cy}`}
                    fill="none"
                    stroke="url(#gaugeMultiStop)"
                    strokeWidth={stroke}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 10px ${color}88)` }}
                />
                {animPct > 1 && (
                    <>
                        <circle cx={tipX} cy={tipY} r={14} fill="url(#gaugeTipGlow)">
                            <animate attributeName="r" values="10;16;10" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
                        </circle>
                        <circle cx={tipX} cy={tipY} r={4} fill={color} stroke={theme === 'dark' ? '#000' : '#fff'} strokeWidth={2} />
                    </>
                )}
                {ticks.map(tk => {
                    const a = Math.PI * (1 - tk.p / 100);
                    const lr = radius + stroke / 2 + 11;
                    return (
                        <text
                            key={`l-${tk.p}`}
                            x={cx + lr * Math.cos(a)}
                            y={cy - lr * Math.sin(a)}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={8}
                            fontWeight="900"
                            fill={theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                        >{tk.p}</text>
                    );
                })}
                <text
                    x={cx}
                    y={cy - 14}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={32}
                    fontWeight="900"
                    fill={color}
                    style={{ letterSpacing: '-0.04em' }}
                >{Math.round(animPct)}%</text>
            </svg>
            <div className="text-center -mt-2 flex flex-col items-center">
                <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest"
                    style={{ background: `${color}1A`, color, border: `1px solid ${color}33` }}
                >
                    <span className="w-1 h-1 rounded-full" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
                    {statusLabel}
                </span>
            </div>
        </div>
    );
};

/**
 * Gráfico de evolución diaria (line chart).
 */
export const DailyEvolutionChart = ({ data, theme, color }) => {
    if (!data || data.length === 0) return null;
    const height = 200;
    const width = 600;
    const maxVal = Math.max(...data.map(d => d.value), 100);
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (d.value / maxVal) * height;
        return `${x},${y}`;
    }).join(' ');

    const fillPoints = `${points} ${width},${height} 0,${height}`;

    return (
        <svg viewBox={`0 -20 ${width} ${height + 40}`} className="w-full h-48 overflow-visible">
            <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={fillPoints} fill="url(#lineGradient)" />
            <polyline fill="none" stroke={color} strokeWidth="4" points={points} strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.2)]" />
            {data.map((d, i) => {
                const x = (i / (data.length - 1)) * width;
                const y = height - (d.value / maxVal) * height;
                return (
                    <g key={i} className="group cursor-pointer">
                        <circle cx={x} cy={y} r="6" fill={color} className="opacity-0 group-hover:opacity-20 transition-opacity" />
                        <circle cx={x} cy={y} r="3" fill={theme === 'dark' ? '#000' : '#fff'} stroke={color} strokeWidth="2.5" />
                        
                        {/* Tooltip */}
                        <g className="opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0">
                            <rect x={x - 30} y={y - 45} width="60" height="30" rx="8" fill={theme === 'dark' ? '#1c1c1e' : '#fff'} className="shadow-2xl" />
                            <text x={x} y={y - 25} textAnchor="middle" fontSize="11" fill={theme === 'dark' ? '#fff' : '#000'} className="font-black">{d.value}€</text>
                            <text x={x} y={y - 55} textAnchor="middle" fontSize="8" fill={theme === 'dark' ? '#8e8e93' : '#a2a2a2'} className="font-bold uppercase tracking-widest">{d.label}</text>
                        </g>
                    </g>
                );
            })}
        </svg>
    );
};

/**
 * Gráfico de donut para distribución por categorías.
 */
export const CategoryDonutChart = ({ data, theme }) => {
    let acc = 0;
    const total = data.reduce((a, b) => a + b.value, 0);
    if (total === 0) return null;

    return (
        <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="relative w-52 h-52 shrink-0">
                <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                    {data.map((d, i) => {
                        const loading = (d.value / total) * 100;
                        const dashArray = `${loading} ${100 - loading}`;
                        const offset = 100 - acc;
                        acc += loading;
                        return (
                            <circle 
                                key={i} 
                                cx="50" 
                                cy="50" 
                                r="40" 
                                fill="transparent" 
                                stroke={d.color} 
                                strokeWidth="14" 
                                strokeDasharray={dashArray} 
                                strokeDashoffset={offset} 
                                className="hover:stroke-[16] transition-all duration-300 cursor-pointer"
                                strokeLinecap={loading > 2 ? "round" : "butt"}
                            />
                        );
                    })}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Gastado</span>
                    <span className="text-2xl font-black tracking-tighter">{total.toLocaleString('es-ES')}€</span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-white/5 transition-colors group cursor-default">
                        <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: d.color }} />
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold leading-none truncate group-hover:text-blue-400 transition-colors">{d.name}</span>
                            <span className="text-[10px] text-gray-500 font-bold mt-1">
                                {(d.value || 0).toFixed(0)}€ <span className="opacity-50">•</span> {((d.value / (total || 1)) * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * Gráfico de radar para análisis de equilibrio financiero.
 */
export const RadarChart = ({ data, radius = 80, center = 100, accentHex = '#3b82f6' }) => {
    const categories = Object.keys(data);
    const total = categories.length;
    if (total < 3) return <div className="text-xs text-gray-500 text-center py-10">Necesitas más datos para análisis</div>;

    const angleSlice = (Math.PI * 2) / total;
    const maxValue = Math.max(...Object.values(data), 1);

    const points = categories.map((cat, i) => {
        const value = data[cat];
        const r = (value / maxValue) * radius;
        const x = center + r * Math.cos(i * angleSlice - Math.PI / 2);
        const y = center + r * Math.sin(i * angleSlice - Math.PI / 2);
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox="0 0 200 200" className="w-full h-56 overflow-visible">
            <defs>
                <radialGradient id="radarGradient">
                    <stop offset="0%" stopColor={accentHex} stopOpacity="0.1" />
                    <stop offset="100%" stopColor={accentHex} stopOpacity="0.4" />
                </radialGradient>
            </defs>
            {[0.2, 0.4, 0.6, 0.8, 1].map(lvl => (
                <polygon 
                    key={lvl} 
                    points={categories.map((_, i) => {
                        const r = lvl * radius;
                        const x = center + r * Math.cos(i * angleSlice - Math.PI / 2);
                        const y = center + r * Math.sin(i * angleSlice - Math.PI / 2);
                        return `${x},${y}`;
                    }).join(' ')} 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="0.5" 
                    className="text-gray-500/10" 
                />
            ))}
            {categories.map((_, i) => {
                const x = center + radius * Math.cos(i * angleSlice - Math.PI / 2);
                const y = center + radius * Math.sin(i * angleSlice - Math.PI / 2);
                return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="currentColor" strokeWidth="0.5" className="text-gray-500/10" />;
            })}
            <polygon points={points} fill="url(#radarGradient)" stroke={accentHex} strokeWidth="3" strokeLinejoin="round" className="transition-all duration-1000 ease-out drop-shadow-xl" />
            {categories.map((cat, i) => {
                const x = center + (radius + 25) * Math.cos(i * angleSlice - Math.PI / 2);
                const y = center + (radius + 20) * Math.sin(i * angleSlice - Math.PI / 2);
                const val = data[cat];
                return (
                    <g key={i}>
                        <text x={x} y={y - 5} textAnchor="middle" fontSize="7" className="fill-gray-400 font-black uppercase tracking-widest">{cat}</text>
                        <text x={x} y={y + 5} textAnchor="middle" fontSize="8" className="fill-blue-500 font-bold">{(val || 0).toFixed(0)}€</text>
                    </g>
                );
            })}
        </svg>
    );
};
