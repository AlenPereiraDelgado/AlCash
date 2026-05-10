import { useEffect, useMemo, useState } from 'react';
import { X, Users, Check, AlertCircle, User as UserIcon, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';

const JoinGroupModal = ({ token, onClose }) => {
    const { theme, t, activeColor, user } = useAuth();
    const { getGroupByToken, acceptGroupInvite, updateExpenseGroup, households } = useFinance();
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Identidades disponibles: personal + cada hogar del que sea miembro.
    // Al reclamar el slot, el slot pasará a representar a esa identidad.
    const identities = useMemo(() => {
        const list = [{ id: 'personal', kind: 'personal', label: 'Yo (personal)' }];
        (households || []).forEach(h => {
            list.push({ id: `hh:${h.id}`, kind: 'household', householdId: h.id, label: h.name });
        });
        return list;
    }, [households]);
    const [identityKey, setIdentityKey] = useState('personal');
    const selectedIdentity = identities.find(i => i.id === identityKey) || identities[0];

    useEffect(() => {
        let alive = true;
        if (!token) return;
        (async () => {
            setLoading(true);
            setError(null);
            const data = await getGroupByToken(token);
            if (!alive) return;
            if (!data) setError('La invitación no es válida o ha expirado.');
            setPreview(data);
            setLoading(false);
        })();
        return () => { alive = false; };
    }, [token, getGroupByToken]);

    const claim = async (memberId) => {
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const groupId = await acceptGroupInvite(token, memberId);
            // Si el usuario elige identidad de hogar, marcamos el slot con
            // householdId + nombre del hogar. El resto de la app puede tratar
            // ese miembro como "1 entidad" (el hogar) en cómputos.
            if (groupId && selectedIdentity?.kind === 'household') {
                const fresh = await getGroupByToken(token);
                if (fresh) {
                    const hh = (households || []).find(x => x.id === selectedIdentity.householdId);
                    const nextMembers = (fresh.members || []).map(m => {
                        if (m.id !== memberId) return m;
                        return {
                            ...m,
                            userId: user?.id ?? m.userId,
                            householdId: selectedIdentity.householdId,
                            name: hh?.name || m.name,
                        };
                    });
                    await updateExpenseGroup(groupId, { members: nextMembers });
                }
            }
            onClose(true);
        } catch (err) {
            const msg = err?.message || 'No se pudo aceptar la invitación';
            if (msg.includes('slot already claimed')) setError('Ese miembro ya ha sido reclamado por otro usuario.');
            else if (msg.includes('owner cannot accept')) setError('Eres el dueño del grupo, no puedes auto-invitarte.');
            else if (msg.includes('not found')) setError('La invitación no es válida.');
            else setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/70 backdrop-blur-sm" onClick={() => onClose(false)}>
            <div
                className={`w-full max-w-md rounded-t-[32px] md:rounded-[40px] shadow-2xl overflow-hidden border ${t.card}`}
                onClick={e => e.stopPropagation()}
            >
                <div className={`p-5 border-b flex justify-between items-start gap-4 ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-black flex items-center gap-2"><Users size={16} className={activeColor.text} /> Invitación a grupo</h2>
                        {preview?.name && <p className={`text-[11px] font-bold mt-0.5 truncate ${t.textSec}`}>{preview.name}</p>}
                    </div>
                    <button onClick={() => onClose(false)} className={`p-2 rounded-xl ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><X size={18} /></button>
                </div>

                <div className="p-5 space-y-3">
                    {loading && <p className={`text-sm font-bold ${t.textSec}`}>Cargando…</p>}

                    {error && (
                        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-2">
                            <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                            <p className="text-xs font-bold text-red-500">{error}</p>
                        </div>
                    )}

                    {!loading && preview && (
                        <>
                            {/* IDENTITY SELECTOR */}
                            {identities.length > 1 && (
                                <div className={`p-3 rounded-2xl border space-y-2 ${theme === 'dark' ? 'bg-white/[0.02] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>¿Cómo te unes?</p>
                                    <p className={`text-[11px] ${t.textSec}`}>Si te unes como hogar, el grupo cuenta con vosotros como una sola persona.</p>
                                    <div className="space-y-1.5">
                                        {identities.map(idn => {
                                            const isSel = idn.id === identityKey;
                                            const isHh = idn.kind === 'household';
                                            return (
                                                <button
                                                    key={idn.id}
                                                    onClick={() => setIdentityKey(idn.id)}
                                                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${isSel
                                                        ? (isHh ? 'border-[#D4AF37]/50 bg-[#D4AF37]/10' : `${activeColor.border} bg-white/[0.04]`)
                                                        : (theme === 'dark' ? 'border-white/5 hover:bg-white/[0.04]' : 'border-gray-200 hover:bg-white')}`}
                                                >
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 ${isHh ? 'bg-gradient-to-br from-[#E8C547] to-[#9C7C0F]' : activeColor.bg}`}>
                                                        {isHh ? <Sparkles size={14} /> : <UserIcon size={14} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-xs truncate">{idn.label}</p>
                                                        <p className={`text-[10px] font-bold ${t.textSec}`}>{isHh ? 'Como hogar · 1 entidad' : 'Como persona individual'}</p>
                                                    </div>
                                                    {isSel && <Check size={14} className={isHh ? 'text-[#D4AF37]' : activeColor.text} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <p className="text-sm font-bold">¿Quién eres en este grupo?</p>
                            <p className={`text-[11px] ${t.textSec}`}>Selecciona el miembro que te corresponde. Después podrás añadir gastos y ver la liquidación junto al resto.</p>
                            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                                {(preview.members || []).map(m => {
                                    const claimed = !!m.userId;
                                    return (
                                        <button
                                            key={m.id}
                                            onClick={() => !claimed && claim(m.id)}
                                            disabled={claimed || submitting}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${claimed
                                                ? `opacity-50 ${theme === 'dark' ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50'}`
                                                : `${theme === 'dark' ? 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]' : 'border-gray-100 bg-white hover:bg-gray-50'} active:scale-[0.99]`}`}
                                        >
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0 ${claimed ? 'bg-gray-500' : activeColor.bg}`}>
                                                {m.name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-sm truncate">{m.name}</p>
                                                <p className={`text-[10px] font-bold ${t.textSec}`}>{claimed ? 'Ya reclamado' : 'Disponible · pulsa para unirte'}</p>
                                            </div>
                                            {!claimed && <Check size={16} className={activeColor.text} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    <button
                        onClick={() => onClose(false)}
                        className={`w-full py-3 rounded-xl text-xs font-black ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JoinGroupModal;
