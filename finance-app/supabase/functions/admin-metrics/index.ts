// =====================================================================
//  Edge Function · admin-metrics
//
//  Devuelve métricas agregadas sobre uso de AlCash. Solo para emails
//  admin (configurados en ADMIN_EMAIL, comma-separated).
//
//  Métricas:
//   - users:      total, nuevos por día (últimos 30) y por mes.
//   - usage:      transacciones totales, por usuario, últimos logins.
//   - ai:         llamadas totales, coste total $, coste por mes, top usuarios.
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',').map(s => s.trim()).filter(Boolean);

const corsHeaders = (origin: string | null) => {
    const ok = origin && allowedOrigins.includes(origin);
    return {
        'Access-Control-Allow-Origin': ok ? origin! : 'null',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Vary': 'Origin',
    };
};

const json = (body: unknown, status: number, cors: Record<string, string>) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, 'content-type': 'application/json' },
    });

Deno.serve(async (req) => {
    const origin = req.headers.get('origin');
    const cors = corsHeaders(origin);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: cors });

    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'UNAUTHORIZED' }, 401, cors);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user?.email) return json({ error: 'UNAUTHORIZED' }, 401, cors);

    const adminEmails = (Deno.env.get('ADMIN_EMAIL') ?? '')
        .toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    if (!adminEmails.includes(user.email.toLowerCase())) {
        return json({ error: 'FORBIDDEN' }, 403, cors);
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // ---------- USERS ----------
    const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const allUsers = usersList?.users ?? [];

    const usersTotal = allUsers.length;
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    const signupsByDay: Record<string, number> = {};
    const signupsByMonth: Record<string, number> = {};
    for (const u of allUsers) {
        const d = new Date(u.created_at);
        const dayKey = d.toISOString().slice(0, 10);
        const monthKey = d.toISOString().slice(0, 7);
        if (d >= since30) signupsByDay[dayKey] = (signupsByDay[dayKey] ?? 0) + 1;
        signupsByMonth[monthKey] = (signupsByMonth[monthKey] ?? 0) + 1;
    }

    // ---------- TRANSACTIONS por usuario ----------
    const { data: txs } = await admin
        .from('transactions')
        .select('user_id, created_at, date')
        .limit(50000);

    const txByUser: Record<string, number> = {};
    const txByDay: Record<string, number> = {};
    for (const t of (txs ?? [])) {
        txByUser[t.user_id] = (txByUser[t.user_id] ?? 0) + 1;
        const dayKey = (t.created_at as string).slice(0, 10);
        if (new Date(t.created_at) >= since30) txByDay[dayKey] = (txByDay[dayKey] ?? 0) + 1;
    }

    // ---------- AI calls ----------
    const { data: aiCalls } = await admin
        .from('ai_calls')
        .select('user_id, email, ts, input_tokens, output_tokens, cost_usd, item_count')
        .order('ts', { ascending: false })
        .limit(10000);

    let aiTotalCalls = 0;
    let aiTotalCostUsd = 0;
    let aiTotalInputTok = 0;
    let aiTotalOutputTok = 0;
    const aiByMonth: Record<string, { calls: number; cost: number }> = {};
    const aiByUser: Record<string, { email: string | null; calls: number; cost: number; tokensIn: number; tokensOut: number; lastTs: string | null }> = {};

    for (const c of (aiCalls ?? [])) {
        aiTotalCalls += 1;
        aiTotalCostUsd += Number(c.cost_usd) || 0;
        aiTotalInputTok += Number(c.input_tokens) || 0;
        aiTotalOutputTok += Number(c.output_tokens) || 0;
        const monthKey = (c.ts as string).slice(0, 7);
        if (!aiByMonth[monthKey]) aiByMonth[monthKey] = { calls: 0, cost: 0 };
        aiByMonth[monthKey].calls += 1;
        aiByMonth[monthKey].cost += Number(c.cost_usd) || 0;

        const uk = c.user_id || c.email || 'desconocido';
        if (!aiByUser[uk]) aiByUser[uk] = { email: c.email ?? null, calls: 0, cost: 0, tokensIn: 0, tokensOut: 0, lastTs: null };
        aiByUser[uk].calls += 1;
        aiByUser[uk].cost += Number(c.cost_usd) || 0;
        aiByUser[uk].tokensIn += Number(c.input_tokens) || 0;
        aiByUser[uk].tokensOut += Number(c.output_tokens) || 0;
        if (!aiByUser[uk].lastTs || (c.ts as string) > aiByUser[uk].lastTs!) {
            aiByUser[uk].lastTs = c.ts as string;
        }
    }

    // Última actividad por usuario = max(last_sign_in, última tx, última llamada IA)
    const lastTxByUser: Record<string, string> = {};
    for (const t of (txs ?? [])) {
        const cur = lastTxByUser[t.user_id];
        if (!cur || (t.created_at as string) > cur) lastTxByUser[t.user_id] = t.created_at as string;
    }

    const dayMs = 24 * 3600 * 1000;
    let active7d = 0, active30d = 0, inactive = 0, neverUsed = 0;

    const usersDetailed = allUsers.map(u => {
        const candidates = [u.last_sign_in_at, lastTxByUser[u.id], aiByUser[u.id]?.lastTs].filter(Boolean) as string[];
        const lastActivity = candidates.length
            ? candidates.reduce((a, b) => a > b ? a : b)
            : null;
        const daysSince = lastActivity
            ? Math.floor((now.getTime() - new Date(lastActivity).getTime()) / dayMs)
            : null;
        const txCount = txByUser[u.id] ?? 0;
        if (txCount === 0 && !u.last_sign_in_at) neverUsed += 1;
        else if (daysSince !== null && daysSince <= 7) active7d += 1;
        else if (daysSince !== null && daysSince <= 30) active30d += 1;
        else inactive += 1;
        return {
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
            last_activity_at: lastActivity,
            days_since_activity: daysSince,
            tx_count: txCount,
            ai_calls: aiByUser[u.id]?.calls ?? 0,
            ai_cost_usd: aiByUser[u.id]?.cost ?? 0,
            ai_last_ts: aiByUser[u.id]?.lastTs ?? null,
        };
    }).sort((a, b) => {
        const ax = a.last_activity_at ?? a.created_at;
        const bx = b.last_activity_at ?? b.created_at;
        return new Date(bx).getTime() - new Date(ax).getTime();
    });

    return json({
        generated_at: now.toISOString(),
        users: {
            total: usersTotal,
            active7d,
            active30d,
            inactive,
            neverUsed,
            signupsByDay,
            signupsByMonth,
            list: usersDetailed,
        },
        transactions: {
            total: (txs ?? []).length,
            byDayLast30: txByDay,
        },
        ai: {
            totalCalls: aiTotalCalls,
            totalCostUsd: aiTotalCostUsd,
            totalInputTokens: aiTotalInputTok,
            totalOutputTokens: aiTotalOutputTok,
            byMonth: aiByMonth,
            byUser: Object.entries(aiByUser).map(([uid, v]) => ({
                user_id: uid,
                email: v.email,
                calls: v.calls,
                cost_usd: v.cost,
                tokens_in: v.tokensIn,
                tokens_out: v.tokensOut,
                last_ts: v.lastTs,
            })).sort((a, b) => b.cost_usd - a.cost_usd),
            allCalls: aiCalls ?? [],
        },
    }, 200, cors);
});
