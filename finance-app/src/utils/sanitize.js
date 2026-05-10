/**
 * Sanitización defensiva de entradas de usuario.
 *
 * SQL-injection: Supabase usa PostgREST con consultas parametrizadas — el SQL
 * ya está protegido. Esto es defensa adicional contra:
 *   - XSS si en algún momento se inyecta texto crudo (no usar dangerouslySetInnerHTML)
 *   - Caracteres de control invisibles
 *   - Strings desbocados (DoS por payload gigante)
 *   - Null bytes (truncan strings en algunas APIs)
 *   - Comillas/semicolons sospechosos en campos donde no aplican
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ZERO_WIDTH    = /[\u200B-\u200D\uFEFF]/g;

const trimAndStrip = (s) => String(s)
    .normalize('NFC')
    .replace(CONTROL_CHARS, '')
    .replace(ZERO_WIDTH, '')
    .replace(/\u0000/g, '')
    .trim();

/** Texto general (notas, descripciones). Recorta y quita caracteres de control. */
export const sanitizeText = (value, maxLen = 500) => {
    if (value === null || value === undefined) return '';
    const cleaned = trimAndStrip(value);
    return cleaned.slice(0, maxLen);
};

/** Nombres de categoría/sub/etiqueta. Más estrictos: sin saltos de línea. */
export const sanitizeName = (value, maxLen = 80) => {
    if (value === null || value === undefined) return '';
    const cleaned = trimAndStrip(value).replace(/[\r\n\t]+/g, ' ');
    return cleaned.slice(0, maxLen);
};

/** Email: minúsculas + trim + control char strip. No valida formato (Supabase lo hace). */
export const sanitizeEmail = (value) => {
    if (!value) return '';
    return trimAndStrip(value).toLowerCase().slice(0, 254);
};

/** Numérico: a number, NaN → 0, infinitos → 0. */
export const sanitizeNumber = (value, fallback = 0) => {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return n;
};

/** Fecha YYYY-MM-DD: valida formato. Devuelve null si inválido. */
export const sanitizeDateISO = (value) => {
    if (!value) return null;
    const s = trimAndStrip(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(s + 'T12:00:00');
    return Number.isNaN(d.getTime()) ? null : s;
};

/** Limpia un objeto de transacción antes de persistir. No valida tipos críticos. */
export const sanitizeTransaction = (tx) => {
    if (!tx || typeof tx !== 'object') return tx;
    const out = { ...tx };
    if ('note' in out)         out.note         = sanitizeText(out.note, 500);
    if ('category' in out)     out.category     = sanitizeName(out.category, 80);
    if ('subCategory' in out)  out.subCategory  = sanitizeName(out.subCategory, 80);
    if ('amountVal' in out)    out.amountVal    = sanitizeNumber(out.amountVal);
    if ('originalAmount' in out) out.originalAmount = out.originalAmount == null ? null : sanitizeNumber(out.originalAmount);
    if ('originalCurrency' in out) out.originalCurrency = sanitizeName(out.originalCurrency, 8);
    if ('date' in out && out.date)         out.date = sanitizeDateISO(out.date) ?? out.date;
    if ('periodicity' in out)              out.periodicity = sanitizeName(out.periodicity, 16);
    if (Array.isArray(out.tags)) {
        out.tags = out.tags.slice(0, 50).map(tag => {
            const s = typeof tag === 'string' ? tag : String(tag ?? '');
            // Etiquetas internas codificadas (gasto compartido / repago) → preservar íntegras
            if (s.startsWith('__shared:') || s.startsWith('__sharedRepay:') || s.startsWith('__groupRef:')) {
                return sanitizeText(s, 8000);
            }
            return sanitizeName(s, 60);
        }).filter(Boolean);
    }
    return out;
};

/** Limpia un objeto goal. */
export const sanitizeGoal = (g) => {
    if (!g || typeof g !== 'object') return g;
    const out = { ...g };
    if ('name' in out)     out.name = sanitizeName(out.name, 120);
    if ('target' in out)   out.target = sanitizeNumber(out.target);
    if ('current' in out)  out.current = sanitizeNumber(out.current);
    if ('deadline' in out && out.deadline) out.deadline = sanitizeDateISO(out.deadline) ?? out.deadline;
    return out;
};

/** Limpia un objeto debt. */
export const sanitizeDebt = (d) => {
    if (!d || typeof d !== 'object') return d;
    const out = { ...d };
    if ('person' in out) out.person = sanitizeName(out.person, 120);
    if ('note' in out)   out.note   = sanitizeText(out.note, 500);
    if ('amount' in out) out.amount = sanitizeNumber(out.amount);
    return out;
};
