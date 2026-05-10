// Helpers para los gastos compartidos. Los participantes y su estado de pago
// viven dentro del tx.tags como un tag con prefijo `__shared:` + base64(JSON).
//
// Formato participante:
//   { id, name, share, mult?, custom?, isMe, paid:boolean, paidAmount:number }
// `paidAmount` permite pagos parciales. Si no existe se infiere de `paid`:
//   paid=true  → paidAmount = share
//   paid=false → paidAmount = 0
// Un participante se considera saldado cuando paidAmount >= share - 0.005.

export const SHARED_PREFIX = '__shared:';

// Permisivo: aceptamos tags `__shared:...` aunque les falte el sufijo `__`
// (gastos creados antes de subir el límite de longitud en sanitize).
export const isSharedTag = (tag) => typeof tag === 'string' && tag.startsWith(SHARED_PREFIX);

export const decodeSharedTag = (tag) => {
    if (!isSharedTag(tag)) return null;
    try {
        let body = tag.slice(SHARED_PREFIX.length);
        if (body.endsWith('__')) body = body.slice(0, -2);
        const json = decodeURIComponent(escape(atob(body)));
        return JSON.parse(json);
    } catch (err) {
        return null;
    }
};

export const encodeSharedTag = (meta) => {
    const json = JSON.stringify(meta);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return `${SHARED_PREFIX}${b64}__`;
};

export const extractSharedMeta = (tx) => {
    const tag = (tx?.tags || []).find(isSharedTag);
    if (!tag) return null;
    return decodeSharedTag(tag);
};

export const replaceSharedMetaInTags = (tags, newMeta) => {
    const next = (tags || []).filter(t => !isSharedTag(t));
    next.push(encodeSharedTag(newMeta));
    return next;
};

// Devuelve cuánto ya pagó el participante (compatibilidad hacia atrás)
export const paidAmountOf = (p) => {
    if (!p) return 0;
    if (typeof p.paidAmount === 'number') return Math.max(0, p.paidAmount);
    return p.paid ? Number(p.share) || 0 : 0;
};

export const isParticipantSettled = (p) => {
    const share = Number(p?.share) || 0;
    return paidAmountOf(p) >= share - 0.005 && share > 0 ? true : !!p?.paid;
};

export const remainingOf = (p) => Math.max(0, (Number(p?.share) || 0) - paidAmountOf(p));

// Recorre todas las transacciones y devuelve una entrada por participante
// con saldo pendiente (no isMe, remaining > 0).
export const collectSharedDebtors = (transactions) => {
    const out = [];
    (transactions || []).forEach(tx => {
        const meta = extractSharedMeta(tx);
        if (!meta || !Array.isArray(meta.participants)) return;
        meta.participants.forEach((p, idx) => {
            if (p.isMe) return;
            const remaining = remainingOf(p);
            if (remaining <= 0.005) return;
            out.push({
                txId: tx.id,
                txDate: tx.date,
                txNote: tx.note || meta.note || '',
                category: tx.category,
                participantIdx: idx,
                name: p.name,
                share: Number(p.share) || 0,
                paidAmount: paidAmountOf(p),
                remaining,
                paid: false,
            });
        });
    });
    return out;
};
