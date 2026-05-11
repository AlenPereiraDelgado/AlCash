/**
 * Cliente del edge function `parse-expense`. La key de Anthropic vive
 * solo en el servidor (Supabase secret) — no en el bundle.
 *
 * parseExpense({ text, images, categories }) → { items, remaining, isAdmin, limit }
 *   text:     string opcional con la descripción del usuario.
 *   images:   array opcional de data URLs base64 (capturas/fotos).
 *   categories: { expense: {...subs}, income: {...subs} } del perfil.
 *
 * Lanza Error('LIMIT_REACHED' | 'UNAUTHORIZED' | 'EMAIL_NOT_ALLOWED'
 *             | 'RATE_LIMITED' | 'EMPTY_INPUT' | 'AI_PROVIDER_ERROR' | otro).
 */

import { supabase } from '../lib/supabaseClient';

const MAX_IMAGE_DIM = 1280;     // px lado mayor
const JPEG_QUALITY  = 0.7;

/** Extrae texto plano de un PDF (todas las páginas concatenadas). */
export const pdfFileToText = async (file) => {
    const pdfjs = await import('pdfjs-dist');
    const workerMod = await import('pdfjs-dist/build/pdf.worker.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const tc = await page.getTextContent();
        pages.push(tc.items.map(it => it.str).join(' '));
    }
    return pages.join('\n');
};

export const isPdfFile = (file) =>
    file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '');

export const isCsvFile = (file) =>
    file?.type === 'text/csv'
    || file?.type === 'application/vnd.ms-excel'
    || /\.csv$/i.test(file?.name || '');

/** Lee un CSV como texto. Intenta UTF-8; si detecta mojibake cae a Windows-1252
 *  (típico en extractos de bancos españoles). */
export const csvFileToText = async (file) => {
    const buf = await file.arrayBuffer();
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    // U+FFFD = byte inválido en UTF-8 → re-decodifica como Windows-1252.
    if (utf8.includes('\uFFFD')) {
        try {
            return new TextDecoder('windows-1252').decode(buf);
        } catch {
            return new TextDecoder('iso-8859-1').decode(buf);
        }
    }
    return utf8;
};

/** Comprime un File a data URL JPEG ≤ MAX_IMAGE_DIM y JPEG_QUALITY. */
export const fileToCompressedDataUrl = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('READ_ERROR'));
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => reject(new Error('DECODE_ERROR'));
            img.onload = () => {
                const ratio = Math.min(1, MAX_IMAGE_DIM / Math.max(img.width, img.height));
                const w = Math.round(img.width * ratio);
                const h = Math.round(img.height * ratio);
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

const mapError = (status, raw) => {
    const code = raw?.error || raw?.code;
    if (code) return new Error(code);
    if (status === 401) return new Error('UNAUTHORIZED');
    if (status === 403) return new Error('EMAIL_NOT_ALLOWED');
    if (status === 429) return new Error('RATE_LIMITED');
    if (status === 413) return new Error('IMAGE_TOO_LARGE');
    return new Error('AI_PROVIDER_ERROR');
};

export const parseExpense = async ({ text, images, categories }) => {
    const { data, error } = await supabase.functions.invoke('parse-expense', {
        body: { text, images, categories },
    });
    if (error) {
        const status = error?.context?.status;
        // El SDK descarta el body en errores; intenta leerlo si está disponible
        let raw = null;
        try { raw = await error?.context?.response?.json?.(); } catch { /* noop */ }
        throw mapError(status, raw);
    }
    if (!data) throw new Error('EMPTY_RESPONSE');
    return {
        items: Array.isArray(data.items) ? data.items : [],
        remaining: typeof data.remaining === 'number' ? data.remaining : null,
        isAdmin: !!data.isAdmin,
        limit: typeof data.limit === 'number' ? data.limit : null,
        debug: data.debug || null,
    };
};
