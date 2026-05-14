import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Activity, Zap, DollarSign, RefreshCcw, Calendar, TrendingUp } from 'lucide-react';

const ADMIN_EMAILS = ['alenpdelgado@gmail.com', 'laraoliveirarodriguez8@gmail.com'];

const fmtUsd = (n) => `$${(Number(n) || 0).toFixed(4)}`;
const fmtEur = (n) => `${((Number(n) || 0) * 0.92).toFixed(4)}€`; // estimación USD→EUR
const fmtDate = (s) => s ? new Date(s).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDateOnly = (s) => s ? new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

const StatCard = ({ icon: Icon, label, value, sub, color, t }) => (
    <div className={`p-4 rounded-2xl border ${t.card}`}>
        <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-black uppercase tracking-widest opacity-60`}>{label}</span>
            <Icon size={16} className={color} />
        </div>
        <p className={`text-2xl font-black tabular-nums ${color}`}>{value}</p>
        {sub && <p className="text-[11px] font-bold opacity-50 mt-1">{sub}</p>}
    </div>
);

const AdminView = () => {
    const { user, t, theme } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

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

    if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-2xl font-black">Acceso denegado</h2>
                <p className="text-sm font-bold opacity-60 mt-2">Solo emails admin pueden ver esta página.</p>
            </div>
        );
    }

    if (loading && !data) {
        return <div className="p-8 text-center text-sm font-bold opacity-60">Cargando métricas…</div>;
    }
    if (error && !data) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500 font-bold">{error}</p>
                <button onClick={fetchMetrics} className={`mt-4 px-4 py-2 rounded-xl text-sm font-black ${t.card}`}>Reintentar</button>
            </div>
        );
    }
    if (!data) return null;

    const { users, transactions, ai } = data;
    const aiByMonthEntries = Object.entries(ai.byMonth || {}).sort((a, b) => b[0].localeCompare(a[0]));
    const signupsByMonthEntries = Object.entries(users.signupsByMonth || {}).sort((a, b) => b[0].localeCompare(a[0]));

    return (
        <div className="space-y-6 animate-in fade-in">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">Panel Admin</h1>
                    <p className="text-xs font-bold opacity-50 mt-1">Generado {fmtDate(data.generated_at)}</p>
                </div>
                <button onClick={fetchMetrics} disabled={loading} className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-2 ${t.card} disabled:opacity-50`}>
                    <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Refrescar
                </button>
            </header>

            {/* TOPLINE */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard t={t} icon={Users} label="Usuarios" value={users.total} sub={`${users.active7d} activos 7d · ${users.active30d} 30d`} color="text-blue-500" />
                <StatCard t={t} icon={Activity} label="Transacciones" value={transactions.total} sub="total registradas" color="text-emerald-500" />
                <StatCard t={t} icon={Zap} label="Llamadas IA" value={ai.totalCalls} sub={`${(ai.totalInputTokens / 1000).toFixed(1)}k in · ${(ai.totalOutputTokens / 1000).toFixed(1)}k out`} color="text-purple-500" />
                <StatCard t={t} icon={DollarSign} label="Coste IA total" value={fmtUsd(ai.totalCostUsd)} sub={`≈ ${fmtEur(ai.totalCostUsd)}`} color="text-orange-500" />
            </div>

            {/* USER ACTIVITY BREAKDOWN */}
            <div className={`p-4 rounded-2xl border ${t.card}`}>
                <h2 className="text-sm font-black uppercase tracking-widest mb-3 opacity-70">Estado usuarios</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><p className="text-2xl font-black text-emerald-500 tabular-nums">{users.active7d}</p><p className="text-[10px] font-bold opacity-60 uppercase">Activos 7 días</p></div>
                    <div><p className="text-2xl font-black text-blue-500 tabular-nums">{users.active30d}</p><p className="text-[10px] font-bold opacity-60 uppercase">Activos 8-30 días</p></div>
                    <div><p className="text-2xl font-black text-orange-500 tabular-nums">{users.inactive}</p><p className="text-[10px] font-bold opacity-60 uppercase">Inactivos +30d</p></div>
                    <div><p className="text-2xl font-black text-red-500 tabular-nums">{users.neverUsed}</p><p className="text-[10px] font-bold opacity-60 uppercase">Nunca entraron</p></div>
                </div>
            </div>

            {/* COSTE IA POR MES */}
            <div className={`p-4 rounded-2xl border ${t.card}`}>
                <h2 className="text-sm font-black uppercase tracking-widest mb-3 opacity-70 flex items-center gap-2"><TrendingUp size={14} /> Coste IA por mes</h2>
                {aiByMonthEntries.length === 0 ? (
                    <p className="text-xs font-bold opacity-50">Sin llamadas IA aún.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead><tr className="text-left text-[10px] font-black uppercase opacity-60"><th className="py-2">Mes</th><th>Llamadas</th><th>Coste USD</th><th>Coste EUR ≈</th></tr></thead>
                        <tbody>
                            {aiByMonthEntries.map(([m, v]) => (
                                <tr key={m} className={`border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                                    <td className="py-2 font-bold">{m}</td>
                                    <td className="font-bold tabular-nums">{v.calls}</td>
                                    <td className="font-bold tabular-nums">{fmtUsd(v.cost)}</td>
                                    <td className="font-bold tabular-nums opacity-70">{fmtEur(v.cost)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ALTAS POR MES */}
            <div className={`p-4 rounded-2xl border ${t.card}`}>
                <h2 className="text-sm font-black uppercase tracking-widest mb-3 opacity-70 flex items-center gap-2"><Calendar size={14} /> Altas por mes</h2>
                <table className="w-full text-sm">
                    <thead><tr className="text-left text-[10px] font-black uppercase opacity-60"><th className="py-2">Mes</th><th>Nuevos usuarios</th></tr></thead>
                    <tbody>
                        {signupsByMonthEntries.map(([m, n]) => (
                            <tr key={m} className={`border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                                <td className="py-2 font-bold">{m}</td>
                                <td className="font-bold tabular-nums">{n}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* TABLA USUARIOS */}
            <div className={`p-4 rounded-2xl border ${t.card}`}>
                <h2 className="text-sm font-black uppercase tracking-widest mb-3 opacity-70">Usuarios ({users.list.length})</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-left text-[10px] font-black uppercase opacity-60">
                                <th className="py-2 pr-2">Email</th>
                                <th className="pr-2">Alta</th>
                                <th className="pr-2">Última act.</th>
                                <th className="pr-2">Días</th>
                                <th className="pr-2">Tx</th>
                                <th className="pr-2">IA</th>
                                <th className="pr-2">Coste $</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.list.map(u => {
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
                                        <td className="pr-2 font-bold tabular-nums">{u.ai_calls}</td>
                                        <td className="pr-2 font-bold tabular-nums">{u.ai_cost_usd ? fmtUsd(u.ai_cost_usd) : '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* TOP IA USUARIOS */}
            {ai.byUser?.length > 0 && (
                <div className={`p-4 rounded-2xl border ${t.card}`}>
                    <h2 className="text-sm font-black uppercase tracking-widest mb-3 opacity-70">Top consumo IA</h2>
                    <table className="w-full text-xs">
                        <thead><tr className="text-left text-[10px] font-black uppercase opacity-60"><th className="py-2">Email</th><th>Llamadas</th><th>Tok in</th><th>Tok out</th><th>Coste $</th><th>Última</th></tr></thead>
                        <tbody>
                            {ai.byUser.slice(0, 20).map(u => (
                                <tr key={u.user_id} className={`border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                                    <td className="py-2 font-bold truncate max-w-[180px]">{u.email || '—'}</td>
                                    <td className="font-bold tabular-nums">{u.calls}</td>
                                    <td className="font-bold tabular-nums opacity-70">{u.tokens_in}</td>
                                    <td className="font-bold tabular-nums opacity-70">{u.tokens_out}</td>
                                    <td className="font-bold tabular-nums">{fmtUsd(u.cost_usd)}</td>
                                    <td className="font-bold opacity-70">{fmtDate(u.last_ts)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminView;
