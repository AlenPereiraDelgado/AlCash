// =====================================================================
//  Edge Function · gemini-proxy
//
//  Proxy entre el cliente y Google Gemini API. Mantiene la API key en
//  el servidor (variable de entorno GEMINI_API_KEY) — nunca llega al
//  bundle del frontend.
//
//  Seguridad:
//   1. Requiere JWT válido de Supabase (verify_jwt = true por defecto).
//   2. Verifica que el email del usuario esté en `allowed_emails`.
//   3. Rate limiting in-memory por user_id (60 req / 60s).
//   4. CORS restringido a los orígenes definidos en ALLOWED_ORIGINS.
//
//  Despliegue:
//    supabase secrets set GEMINI_API_KEY=AIzaSy...
//    supabase secrets set ALLOWED_ORIGINS=https://tu-dominio.app,http://localhost:5173
//    supabase functions deploy gemini-proxy
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

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
const RATE_MAX       = 60;
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

// ---------- Handler ----------
Deno.serve(async (req) => {
    const origin = req.headers.get('origin');
    const cors = corsHeaders(origin);

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors });
    }
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: cors });
    }

    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
            status: 401, headers: { ...cors, 'content-type': 'application/json' },
        });
    }

    // Crear cliente Supabase con el JWT del usuario para validarlo
    const supabaseUrl     = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user?.email) {
        return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
            status: 401, headers: { ...cors, 'content-type': 'application/json' },
        });
    }

    // Verificación whitelist (defensa adicional, además del trigger SQL)
    const { data: allowed } = await supabase
        .from('allowed_emails')
        .select('email')
        .ilike('email', user.email)
        .maybeSingle();
    if (!allowed) {
        return new Response(JSON.stringify({ error: 'EMAIL_NOT_ALLOWED' }), {
            status: 403, headers: { ...cors, 'content-type': 'application/json' },
        });
    }

    // Rate limit por usuario
    if (rateLimited(user.id)) {
        return new Response(JSON.stringify({ error: 'RATE_LIMITED' }), {
            status: 429, headers: { ...cors, 'content-type': 'application/json' },
        });
    }

    // Body sanity: prompt obligatorio, sin payloads gigantes
    const body = await req.json().catch(() => null);
    if (!body || typeof body.prompt !== 'string' || body.prompt.length === 0 || body.prompt.length > 4000) {
        return new Response(JSON.stringify({ error: 'BAD_REQUEST' }), {
            status: 400, headers: { ...cors, 'content-type': 'application/json' },
        });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API_KEY_NOT_CONFIGURED' }), {
            status: 500, headers: { ...cors, 'content-type': 'application/json' },
        });
    }

    const upstream = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: body.prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
        }),
    });

    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
        status: upstream.status,
        headers: { ...cors, 'content-type': 'application/json' },
    });
});
