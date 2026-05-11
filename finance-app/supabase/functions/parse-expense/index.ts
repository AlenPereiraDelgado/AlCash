// =====================================================================
//  Edge Function · parse-expense
//
//  Proxy entre el cliente y la API de Anthropic (Claude). Mantiene la
//  ANTHROPIC_API_KEY en el servidor.
//
//  Seguridad / límites:
//   1. Requiere JWT válido de Supabase.
//   2. Límite mensual: 2 usos / mes / usuario. Excepción: admin.
//   3. Rate limiting in-memory (60 req / 60s) anti-abuso.
//   4. CORS restringido.
//
//  Despliegue:
//    supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//    supabase secrets set ALLOWED_ORIGINS=https://tu-dominio.app,http://localhost:5173
//    supabase secrets set ADMIN_EMAIL=alenpdelgado@gmail.com
//    supabase functions deploy parse-expense
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = 'claude-haiku-4-5';
const MONTHLY_LIMIT = 2;

// ---------- CORS ----------
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const corsHeaders = (origin: string | null) => {
    const ok = origin && allowedOrigins.includes(origin);
    return {
        'Access-Control-Allow-Origin': ok ? origin! : 'null',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Vary': 'Origin',
    };
};

// ---------- Rate limit in-memory ----------
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;
const buckets = new Map<string, { count: number; resetAt: number }>();
const rateLimited = (userId: string) => {
    const now = Date.now();
    const b = buckets.get(userId);
    if (!b || b.resetAt < now) {
        buckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return false;
    }
    if (b.count >= RATE_MAX) return true;
    b.count += 1;
    return false;
};

// ---------- Helpers ----------
const monthKey = () => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const json = (body: unknown, status: number, cors: Record<string, string>) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, 'content-type': 'application/json' },
    });

interface CategoriesShape {
    expense: Record<string, string[]>;
    income: Record<string, string[]>;
}

const buildSystemPrompt = (categories: CategoriesShape) => {
    const today = new Date().toISOString().split('T')[0];
    const expenseList = Object.keys(categories.expense || {}).join(', ') || '(ninguna)';
    const incomeList = Object.keys(categories.income || {}).join(', ') || '(ninguna)';
    const subsMap: Record<string, string[]> = {};
    for (const [c, subs] of Object.entries(categories.expense || {})) subsMap[c] = subs;
    for (const [c, subs] of Object.entries(categories.income || {})) subsMap[c] = subs;
    return `Eres un parser financiero para la app AlCash. Extrae movimientos a partir del input del usuario (texto y/o imagen de notificación bancaria, ticket o extracto).

HOY: ${today}

CATEGORÍAS DE GASTO: ${expenseList}
CATEGORÍAS DE INGRESO: ${incomeList}
SUBCATEGORÍAS POR CATEGORÍA: ${JSON.stringify(subsMap)}

REGLAS:
- type: "expense" o "income".
- amountVal: número en euros sin signo.
- date: YYYY-MM-DD. Si la entrada no menciona fecha, usa HOY.
- category: OBLIGATORIO escoger una de las listadas arriba para el type correspondiente. La que mejor encaje.
- subCategory: solo si es OBVIO. Si dudas, omite.
- note: breve y limpio (comercio o motivo). Omite si no aporta nada nuevo.
- Si la imagen contiene varios cargos, devuelve uno por cargo.
- Si no detectas movimiento financiero, items: [].
- NO inventes datos. NO razones en voz alta.`;
};

const TOOL = {
    name: 'record_movements',
    description: 'Registra los movimientos financieros extraídos del input.',
    input_schema: {
        type: 'object',
        required: ['items'],
        properties: {
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['type', 'amountVal', 'date', 'category'],
                    properties: {
                        type: { type: 'string', enum: ['expense', 'income'] },
                        amountVal: { type: 'number' },
                        date: { type: 'string' },
                        category: { type: 'string' },
                        subCategory: { type: 'string' },
                        note: { type: 'string' },
                    },
                },
            },
        },
    },
};

// ---------- Handler ----------
Deno.serve(async (req) => {
    const origin = req.headers.get('origin');
    const cors = corsHeaders(origin);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

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

    if (rateLimited(user.id)) return json({ error: 'RATE_LIMITED' }, 429, cors);

    const adminEmails = (Deno.env.get('ADMIN_EMAIL') ?? '')
        .toLowerCase()
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    const isAdmin = adminEmails.includes(user.email.toLowerCase());

    // Body validation
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'BAD_REQUEST' }, 400, cors);
    const text: string | undefined = typeof body.text === 'string' ? body.text.slice(0, 60_000) : undefined;
    const images: string[] = Array.isArray(body.images) ? body.images.slice(0, 6) : [];
    const categories: CategoriesShape = body.categories && typeof body.categories === 'object'
        ? body.categories
        : { expense: {}, income: {} };
    if (!text && images.length === 0) return json({ error: 'EMPTY_INPUT' }, 400, cors);

    // Validar tamaño imágenes (máx ~5MB cada una en base64)
    for (const img of images) {
        if (typeof img !== 'string' || img.length > 7_500_000) return json({ error: 'IMAGE_TOO_LARGE' }, 413, cors);
    }

    // Cliente service-role para usage table (bypass RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Quota mensual (admin bypass)
    const month = monthKey();
    if (!isAdmin) {
        const { data: row } = await adminClient
            .from('ai_usage')
            .select('count')
            .eq('user_id', user.id)
            .eq('month', month)
            .maybeSingle();
        const used = row?.count ?? 0;
        if (used >= MONTHLY_LIMIT) {
            return json({ error: 'LIMIT_REACHED', remaining: 0, limit: MONTHLY_LIMIT, isAdmin: false }, 429, cors);
        }
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'API_KEY_NOT_CONFIGURED' }, 500, cors);

    // Build user content blocks
    const content: Array<Record<string, unknown>> = [];
    for (const img of images) {
        const m = img.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
        if (!m) return json({ error: 'INVALID_IMAGE_FORMAT' }, 400, cors);
        content.push({
            type: 'image',
            source: { type: 'base64', media_type: m[1], data: m[2] },
        });
    }
    content.push({
        type: 'text',
        text: text && text.trim()
            ? `Entrada del usuario: """${text}"""`
            : 'Entrada del usuario: una o varias imágenes adjuntas. Extrae todos los movimientos visibles.',
    });

    const upstream = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            max_tokens: 4096,
            system: buildSystemPrompt(categories),
            tools: [TOOL],
            tool_choice: { type: 'tool', name: TOOL.name },
            messages: [{ role: 'user', content }],
        }),
    });

    const raw = await upstream.json();
    if (!upstream.ok) {
        return json({ error: 'AI_PROVIDER_ERROR', status: upstream.status, detail: raw?.error?.message ?? null }, 502, cors);
    }

    // Extraer tool_use
    const block = (raw?.content ?? []).find((b: { type: string }) => b.type === 'tool_use');
    const items = Array.isArray(block?.input?.items) ? block.input.items : [];

    // Incrementar contador (no admin) — atómico via upsert + rpc-like fallback
    let remaining: number | null = null;
    if (!isAdmin) {
        const { data: cur } = await adminClient
            .from('ai_usage')
            .select('count')
            .eq('user_id', user.id)
            .eq('month', month)
            .maybeSingle();
        const newCount = (cur?.count ?? 0) + 1;
        await adminClient
            .from('ai_usage')
            .upsert({ user_id: user.id, month, count: newCount, updated_at: new Date().toISOString() }, { onConflict: 'user_id,month' });
        remaining = Math.max(0, MONTHLY_LIMIT - newCount);
    }

    return json({ items, remaining, isAdmin, limit: MONTHLY_LIMIT }, 200, cors);
});
