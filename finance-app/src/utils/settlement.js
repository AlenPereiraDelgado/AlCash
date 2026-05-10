// Liquidación óptima de un grupo: dado el balance neto por miembro
// (positivo → cobra, negativo → debe), devuelve la lista mínima de
// transferencias para saldar todas las cuentas usando un greedy
// match-top-creditor-with-top-debtor. Aproxima el óptimo y es
// determinista para los tamaños esperados (≤20 miembros).

const EPS = 0.01;

// entries: [{ id, payerId, amount, splitWith?: string[] }]
// members: [{ id, name }]
export const computeBalances = (members, entries) => {
    const balance = {};
    members.forEach(m => { balance[m.id] = 0; });

    entries.forEach(e => {
        const amount = Number(e.amount) || 0;
        if (amount <= 0 || !e.payerId) return;
        if (balance[e.payerId] === undefined) balance[e.payerId] = 0;
        balance[e.payerId] += amount;
        const splits = Array.isArray(e.splits) && e.splits.length > 0 ? e.splits : null;
        if (splits) {
            splits.forEach(s => {
                if (balance[s.memberId] === undefined) return;
                balance[s.memberId] -= Number(s.share) || 0;
            });
            return;
        }
        const splitIds = Array.isArray(e.splitWith) && e.splitWith.length > 0
            ? e.splitWith.filter(id => balance[id] !== undefined)
            : members.map(m => m.id);
        if (splitIds.length === 0) return;
        const share = amount / splitIds.length;
        splitIds.forEach(id => { balance[id] -= share; });
    });

    // Redondea a céntimos para evitar drift FP
    Object.keys(balance).forEach(id => {
        balance[id] = Number(balance[id].toFixed(2));
    });
    return balance;
};

export const settleBalances = (balance) => {
    const creditors = [];
    const debtors = [];
    Object.entries(balance).forEach(([id, val]) => {
        if (val > EPS) creditors.push({ id, amt: val });
        else if (val < -EPS) debtors.push({ id, amt: -val });
    });
    creditors.sort((a, b) => b.amt - a.amt);
    debtors.sort((a, b) => b.amt - a.amt);

    const transfers = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
        const pay = Math.min(debtors[i].amt, creditors[j].amt);
        transfers.push({
            from: debtors[i].id,
            to: creditors[j].id,
            amount: Number(pay.toFixed(2)),
        });
        debtors[i].amt -= pay;
        creditors[j].amt -= pay;
        if (debtors[i].amt < EPS) i++;
        if (creditors[j].amt < EPS) j++;
    }
    return transfers;
};

export const settleGroup = (members, entries) => {
    const balance = computeBalances(members, entries);
    const transfers = settleBalances(balance);
    return { balance, transfers };
};
