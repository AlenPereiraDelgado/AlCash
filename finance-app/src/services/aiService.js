/**
 * Servicio de IA para AlCash.
 *
 * Llama al edge function `gemini-proxy` desplegado en Supabase para que la
 * Gemini API key viva sólo en el servidor (no en el bundle del frontend).
 *
 * Fallback: si la edge function no está desplegada o devuelve 404, intenta
 * llamar a Gemini directamente con la key de cliente (modo legacy). Esto
 * permite seguir trabajando localmente mientras se configura el proxy.
 */

import { supabase } from '../lib/supabaseClient';

const GEMINI_FALLBACK_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const buildPrompt = (text, categories) => `
    Eres un experto en contabilidad personal para la app AlCash.
    Analiza la siguiente frase y extrae un movimiento financiero en formato JSON puro.

    FRASE: "${text}"
    HOY ES: ${new Date().toISOString().split('T')[0]}

    CATEGORÍAS DISPONIBLES:
    - Gastos: ${Object.keys(categories.expense).join(', ')}
    - Ingresos: ${Object.keys(categories.income).join(', ')}

    REGLAS:
    1. Devuelve SOLO un objeto JSON válido.
    2. Campos: amountVal (número), date (YYYY-MM-DD), type ("expense" o "income"), category (debe ser una de las proporcionadas), note (descripción breve y limpia).
    3. Si la fecha es "ayer", calcula la fecha correcta.

    EJEMPLO DE SALIDA:
    {
        "amountVal": 15.50,
        "date": "2024-04-11",
        "type": "expense",
        "category": "Alimentación",
        "note": "Cena pizza"
    }
`;

const extractJson = (data) => {
    const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) throw new Error('GEMINI_EMPTY_RESPONSE');
    return JSON.parse(resultText);
};

const callEdgeFunction = async (prompt) => {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: { prompt },
    });
    if (error) {
        const status = error?.context?.status;
        if (status === 404) throw new Error('PROXY_NOT_DEPLOYED');
        if (status === 429) throw new Error('RATE_LIMITED');
        if (status === 401 || status === 403) throw new Error('UNAUTHORIZED');
        throw error;
    }
    return extractJson(data);
};

const callDirectFallback = async (prompt, apiKey) => {
    if (!apiKey) throw new Error('API_KEY_MISSING');
    const response = await fetch(`${GEMINI_FALLBACK_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
        }),
    });
    const data = await response.json();
    return extractJson(data);
};

export const parseWithGemini = async (text, categories, apiKey) => {
    const prompt = buildPrompt(text, categories);
    try {
        return await callEdgeFunction(prompt);
    } catch (err) {
        if (err.message === 'PROXY_NOT_DEPLOYED' && apiKey) {
            console.warn('[aiService] Edge function no disponible, usando fallback directo.');
            return await callDirectFallback(prompt, apiKey);
        }
        console.error('Error en Gemini:', err);
        throw err;
    }
};
