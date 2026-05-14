import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Users, DollarSign, RefreshCcw, Calendar, TrendingUp, Search } from 'lucide-react';

const ADMIN_EMAILS = ['alenpdelgado@gmail.com', 'laraoliveirarodriguez8@gmail.com'];

const fmtUsd = (n) => `$${(Number(n) || 0).toFixed(4)}`;
const fmtEur = (n) => `${((Number(n) || 0) * 0.92).toFixed(4)}€`;
const fmtDate = (s) => s ? new Date(s).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDateOnly = (s) => s ? new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const StatCard = ({ icon: Icon, label, value, sub, color, t }) => (
    <div className={`p-4 rounded-2xl border ${t.card}`}>
        <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</span>
            <Icon size={16} className={color} />
        </div>
        <p className={`text-2xl font-black tabular-nums ${color}`}>{value}</p>
        {sub && <p className="text-[11px] font-bold opacity-50 mt-1">{sub}</p>}
    </div>
);

const BarChart = ({ entries, theme, color = '#A855F7', valueFmt = fmtUsd, getValue = (v) => v.cost }) => {
    if (!entries.length) {
        return <p className="text-xs font-bold opacity-50 py-4 text-center">Sin datos.</p>;
    }
    const max = Math.max(...entries.map(([, v]) => getValue(v)), 0.0001);
    const W = 600, H = 220, padL = 40, padB = 30, padT = 12, padR = 8;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const n = entries.length;
    const slot = chartW / n;
    const barW = Math.min(slot * 0.7, 48);

    const axisColor = theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
    const labelColor = theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)';

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
            {/* Y grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                const y = padT + chartH * (1 - p);
                return (
                    <g key={i}>
                        <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={axisColor} strokeWidth="0.5" strokeDasharray={p === 0 ? '0' : '2 3'} />
                        <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fontWeight="700" fill={labelColor}>{valueFmt(max * p)}</text>
                    </g>
                );
            })}
            {/* Bars */}
            {entries.map(([m, v], i) => {
                const val = getValue(v);
                const h = (val / max) * chartH;
                const x = padL + slot * i + (slot - barW) / 2;
                const y = padT + chartH - h;
                return (
                    <g key={m}>
                        <rect x={x} y={y} width={barW} height={Math.max(h, 1)} rx="3" fill={color} opacity={val === 0 ? 0.2 : 0.85}>
                            <title>{`${m}: ${valueFmt(val)}`}</title>
                        </rect>
                        <text x={padL + slot * i + slot / 2} y={H - padB + 14} textAnchor="middle" fontSize="9" fontWeight="700" fill={labelColor}>{m.slice(2)}</text>
                    </g>
                );
            })}
        </svg>
    );
};

const LineChart = ({ entries, theme, color = '#0A84FF', valueFmt = (n) => String(n) }) => {
    if (!entries.length) {
        return <p className="text-xs font-bold opacity-50 py-4 text-center">Sin datos.</p>;
    }
    const max = Math.max(...entries.map(([, n]) => n), 1);
    const W = 600, H = 220, padL = 40, padB = 30, padT = 12, padR = 8;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;
    const n = entries.length;
    const stepX = n > 1 ? chartW / (n - 1) : 0;

    const axisColor = theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
    const labelColor = theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)';

    const pts = entries.map(([, v], i) => {
        const x = padL + stepX * i;
        const y = padT + chartH * (1 - v / max);
        return { x, y, v };
    });
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const area = `${path} L ${pts[pts.length - 1].x} ${padT + chartH} L ${pts[0].x} ${padT + chartH} Z`;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                const y = padT + chartH * (1 - p);
                return (
                    <g key={i}>
                        <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={axisColor} strokeWidth="0.5" strokeDasharray={p === 0 ? '0' : '2 3'} />
                        <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fontWeight="700" fill={labelColor}>{valueFmt(Math.round(max * p))}</text>
                    </g>
                );
            })}
            <path d={area} fill={color} opacity="0.15" />
            <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => (
                <g key={i}>
                    <circle cx={p.x} cy={p.y} r="3.5" fill={color}>
                        <title>{`${entries[i][0]}: ${p.v}`}</title>
                    </circle>
                    <text x={p.x} y={H - padB + 14} textAnchor="middle" fontSize="9" fontWeight="700" fill={labelColor}>{entries[i][0].slice(2)}</text>
                </g>
            ))}
        </svg>
    );
};

const AdminView = () => {
    const { user, t, theme } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [rangePreset, setRangePreset] = useState('30d'); // today, 7d, 30d, month, all, custom
    const [fromDate, setFromDate] = useState(daysAgoStr(30));
    const [toDate, setToDate] = useState(todayStr());
    const [search, setSearch] = useState('');

    const fetchMetrics = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase.functions.invoke('admin-metrics', { method: 'GET' });
            if (error) throw error;
            setData(data);
        } catch (e) {
            setError(e?.message || 'Error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchMetrics(); /* eslint-disable-next-line */ }, []);

    const applyPreset = (p) => {
        setRangePreset(p);
        if (p === 'today') { setFromDate(todayStr()); setToDate(todayStr()); }
        else if (p === '7d') { setFromDate(daysAgoStr(7)); setToDate(todayStr()); }
        else if (p === '30d') { setFromDate(daysAgoStr(30)); setToDate(todayStr()); }
        else if (p === 'month') {
            const d = new Date();
            const first = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
            setFromDate(first); setToDate(todayStr());
        }
        else if (p === 'all') { setFromDate('2020-01-01'); setToDate(todayStr()); }
    };

    // Filtrado y recálculo client-side
    const filtered = useMemo(() => {
        if (!data) return null;
        const fromTs = new Date(fromDate + 'T00:00:00').getTime();
        const toTs = new Date(toDate + 'T23:59:59').getTime();
        const calls = (data.ai.allCalls || []).filter(c => {
            const ts = new Date(c.ts).getTime();
            return ts >= fromTs && ts <= toTs;
        });
        const byMonth = {};
        const byUser = {};
        let totalCalls = 0, totalCost = 0, totalIn = 0, totalOut = 0;
        for (const c of calls) {
            totalCalls += 1;
            const cost = Number(c.cost_usd) || 0;
            totalCost += cost;
            totalIn += Number(c.input_tokens) || 0;
            totalOut += Number(c.output_tokens) || 0;
            const mk = c.ts.slice(0, 7);
            if (!byMonth[mk]) byMonth[mk] = { calls: 0, cost: 0 };
            byMonth[mk].calls += 1;
            byMonth[mk].cost += cost;

            const uk = c.user_id || c.email || 'desconocido';
            if (!byUser[uk]) byUser[uk] = { email: c.email, calls: 0, cost: 0, in: 0, out: 0, last: null };
            byUser[uk].calls += 1;
            byUser[uk].cost += cost;
            byUser[uk].in += Number(c.input_tokens) || 0;
            byUser[uk].out += Number(c.output_tokens) || 0;
            if (!byUser[uk].last || c.ts > byUser[uk].last) byUser[uk].last = c.ts;
        }
        return { calls, byMonth, byUser, totalCalls, totalCost, totalIn, totalOut };
    }, [data, fromDate, toDate]);

    // Filtrado tabla usuarios por search
    const filteredUsers = useMemo(() => {
        if (!data?.users?.list) return [];
        const q = search.trim().toLowerCase();
        const list = data.users.list.map(u => {
            const u2 = filtered?.byUser[u.id];
            return {
                ...u,
                ai_calls_range: u2?.calls ?? 0,
                ai_cost_range: u2?.cost ?? 0,
            };
        });
        if (!q) return list;
        return list.filter(u => (u.email || '').toLowerCase().includes(q) || (u.id || '').toLowerCase().includes(q));
    }, [data, filtered, search]);

    if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-2xl font-black">Acceso denegado</h2>
                <p className="text-sm font-bold opacity-60 mt-2">Solo emails admin pueden ver esta página.</p>
            </div>
        );
    }
    if (loading && !data) return <div className="p-8 text-center text-sm font-bold opacity-60">Cargando métricas…</div>;
    if (error && !data) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500 font-bold">{error}</p>
                <button onClick={fetchMetrics} className={`mt-4 px-4 py-2 rounded-xl text-sm font-black ${t.card}`}>Reintentar</button>
            </div>
        );
    }
    if (!data || !filtered) return null;

    const { users } = data;
    const byMonthEntries = Object.entries(filtered.byMonth).sort((a, b) => a[0].localeCompare(b[0]));

    // Si no hay meses en rango, generar al menos los meses del rango con 0
    const monthsInRange = (() => {
        const r = [];
        const start = new Date(fromDate);
        const end = new Date(toDate);
        const cur = new Date(start.getFullYear(), start.getMonth(), 1);
        while (cur <= end) {
            const k = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
            r.push(k);
            cur.setMonth(cur.getMonth() + 1);
        }
        return r;
    })();
    const fullMonthEntries = monthsInRange.map(m => [m, filtered.byMonth[m] || { calls: 0, cost: 0 }]);

    const signupsByMonthEntries = Object.entries(users.signupsByMonth || {}).sort((a, b) => a[0].localeCompare(b[0]));

    const presets = [
        { id: 'today', label: 'Hoy' },
        { id: '7d', label: '7d' },
        { id: '30d', label: '30d' },
        { id: 'month', label: 'Mes' },
        { id: 'all', label: 'Todo' },
        { id: 'custom', label: 'Custom' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in">
            <header className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">Panel Admin</h1>
                    <p className="text-xs font-bold opacity-50 mt-1">Generado {fmtDate(data.generated_at)}</p>
                </div>
                <button onClick={fetchMetrics} disabled={loading} className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-2 ${t.card} disabled:opacity-50`}>
                    <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Refrescar
                </button>
            </header>

            {/* FILTRO RANGO */}
            <div className={`p-2 rounded-2xl border ${t.card} space-y-2`}>
                <div className="grid grid-cols-6 gap-1">
                    {presets.map(p => (
                        <button
                            key={p.id}
                            onClick={() => applyPreset(p.id)}
                            className={`px-1 py-1.5 rounded-lg text-[11px] font-black active:scale-95 transition-transform ${rangePreset === p.id ? `${theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}` : `${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                {rangePreset === 'custom' && (
                    <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                        <input
                            type="date"
                            value={fromDate}
                            onChange={e => setFromDate(e.target.value)}
                            className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[11px] font-bold ${t.input}`}
                        />
                        <span className="text-[11px] opacity-50">→</span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={e => setToDate(e.target.value)}
                            className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[11px] font-bold ${t.input}`}
                        />
                    </div>
                )}
                <p className="text-[10px] font-bold opacity-50 px-1">
                    {fromDate} → {toDate}
                </p>
            </div>

            {/* TOPLINE: solo Usuarios + Coste rango */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard t={t} icon={Users} label="Usuarios total" value={users.total} sub={`${users.active7d} activos 7d`} color="text-blue-500" />
                <StatCard t={t} icon={Users} label="Activos 30d" value={users.active30d + users.active7d} sub={`${users.inactive} inactivos · ${users.neverUsed} sin entrar`} color="text-emerald-500" />
                <StatCard t={t} icon={DollarSign} label="Coste IA rango" value={fmtUsd(filtered.totalCost)} sub={`${filtered.totalCalls} llamadas · ≈ ${fmtEur(filtered.totalCost)}`} color="text-orange-500" />
                <StatCard t={t} icon={TrendingUp} label="Tokens rango" value={`${(filtered.totalIn / 1000).toFixed(1)}k`} sub={`${(filtered.totalOut / 1000).toFixed(1)}k output`} color="text-purple-500" />
            </div>

            {/* GRÁFICA COSTE POR MES — barras */}
            <div className={`p-4 rounded-2xl border ${t.card}`}>
                <h2 className="text-sm font-black uppercase tracking-widest mb-3 opacity-70 flex items-center gap-2"><TrendingUp size={14} /> Coste IA por mes ({fromDate} → {toDate})</h2>
                <BarChart entries={fullMonthEntries} theme={theme} color="#A855F7" valueFmt={fmtUsd} getValue={(v) => v.cost} />
            </div>

            {/* TABLA COSTE POR MES (con datos reales) */}
            {byMonthEntries.length > 0 && (
                <div className={`p-4 rounded-2xl border ${t.card}`}>
                    <h2 className="text-sm font-black uppercase tracking-widest mb-3 opacity-70">Detalle por mes</h2>
                    <table className="w-full text-sm">
                        <thead><tr className="text-left text-[10px] font-black uppercase opacity-60"><th className="py-2">Mes</th><th>Llamadas</th><th>Coste USD</th><th>≈ EUR</th></tr></thead>
                        <tbody>
                            {byMonthEntries.map(([m, v]) => (
                                <tr key={m} className={`border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                                    <td className="py-2 font-bold">{m}</td>
                                    <td className="font-bold tabular-nums">{v.calls}</td>
                                    <td className="font-bold tabular-nums">{fmtUsd(v.cost)}</td>
                                    <td className="font-bold tabular-nums opacity-70">{fmtEur(v.cost)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ALTAS POR MES — línea */}
            <div className={`p-4 rounded-2xl border ${t.card}`}>
                <h2 className="text-sm font-black uppercase tracking-widest mb-3 opacity-70 flex items-center gap-2"><Calendar size={14} /> Altas por mes</h2>
                <LineChart entries={signupsByMonthEntries} theme={theme} color="#0A84FF" valueFmt={(n) => String(n)} />
            </div>

            {/* TABLA USUARIOS + buscador */}
            <div className={`p-4 rounded-2xl border ${t.card}`}>
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <h2 className="text-sm font-black uppercase tracking-widest opacity-70">Usuarios ({filteredUsers.length}/{users.list.length})</h2>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                        <Search size={12} className="opacity-50" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar email…"
                            className="bg-transparent outline-none text-[12px] font-bold w-40 md:w-56"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-left text-[10px] font-black uppercase opacity-60">
                                <th className="py-2 pr-2">Email</th>
                                <th className="pr-2">Alta</th>
                                <th className="pr-2">Última act.</th>
                                <th className="pr-2">Días</th>
                                <th className="pr-2">Tx</th>
                                <th className="pr-2">IA rango</th>
                                <th className="pr-2">$ rango</th>
                                <th className="pr-2">IA total</th>
                                <th className="pr-2">$ total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(u => {
                                const days = u.days_since_activity;
                                const statusCls = days === null ? 'text-red-500'
                                    : days <= 7 ? 'text-emerald-500'
                                    : days <= 30 ? 'text-blue-500'
                                    : 'text-orange-500';
                                return (
                                    <tr key={u.id} className={`border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                                        <td className="py-2 pr-2 font-bold truncate max-w-[180px]" title={u.email}>{u.email}</td>
                                        <td className="pr-2 font-bold opacity-70">{fmtDateOnly(u.created_at)}</td>
                                        <td className="pr-2 font-bold opacity-70">{fmtDateOnly(u.last_activity_at)}</td>
                                        <td className={`pr-2 font-black tabular-nums ${statusCls}`}>{days === null ? '∞' : days + 'd'}</td>
                                        <td className="pr-2 font-bold tabular-nums">{u.tx_count}</td>
                                        <td className="pr-2 font-bold tabular-nums text-purple-500">{u.ai_calls_range}</td>
                                        <td className="pr-2 font-bold tabular-nums text-orange-500">{u.ai_cost_range ? fmtUsd(u.ai_cost_range) : '—'}</td>
                                        <td className="pr-2 font-bold tabular-nums opacity-60">{u.ai_calls}</td>
                                        <td className="pr-2 font-bold tabular-nums opacity-60">{u.ai_cost_usd ? fmtUsd(u.ai_cost_usd) : '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminView;
