/**
 * Parse YYYY-MM-DD date string forzando mediodía local.
 * Evita el bug de zona horaria: new Date('2026-01-01') crea UTC midnight,
 * que en España (UTC+1/+2) se convierte en 31-dic 23:00 → mes/día equivocados.
 */
export const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date(NaN);
    if (dateStr instanceof Date) return dateStr;
    const s = String(dateStr);
    if (s.length === 10 && s[4] === '-' && s[7] === '-') {
        return new Date(s + 'T12:00:00');
    }
    return new Date(s);
};

/**
 * Calcula el Hue (matiz) a partir de un color Hexadecimal.
 */
export const getHue = (hex) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt("0x" + hex[1] + hex[1]);
        g = parseInt("0x" + hex[2] + hex[2]);
        b = parseInt("0x" + hex[3] + hex[3]);
    } else if (hex.length === 7) {
        r = parseInt("0x" + hex[1] + hex[2]);
        g = parseInt("0x" + hex[3] + hex[4]);
        b = parseInt("0x" + hex[5] + hex[6]);
    }
    r /= 255; g /= 255; b /= 255;
    let cmin = Math.min(r, g, b), cmax = Math.max(r, g, b), delta = cmax - cmin, h = 0;
    if (delta === 0) h = 0;
    else if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    return h;
};

/**
 * Agrupa colores por cubos de matiz para visualizaciones.
 */
export const getBucketIndex = (hex) => {
    const h = getHue(hex);
    if (h >= 345 || h <= 15) return 0;
    if (h > 15 && h <= 45) return 1;
    if (h > 45 && h <= 75) return 2;
    if (h > 75 && h <= 150) return 3;
    if (h > 150 && h <= 195) return 4;
    if (h > 195 && h <= 255) return 5;
    if (h > 255 && h <= 285) return 6;
    if (h > 285 && h < 345) return 7;
    return 8;
};

/**
 * Adapta el tamaño del texto según la longitud del número.
 */
export const getDynamicFontSize = (value) => {
    const str = Math.abs(Math.round(value || 0)).toString();
    if (str.length > 9) return 'text-xl';
    if (str.length > 7) return 'text-2xl';
    if (str.length > 5) return 'text-3xl';
    return 'text-4xl';
};
