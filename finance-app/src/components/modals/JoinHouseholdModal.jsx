import { useEffect, useState } from 'react';
import { X, Users, Check, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';

// Modal de aceptación de invitación al hogar (modo Social).
// Tras aceptar: setActiveHouseholdId + setMode('social') -> el usuario entra
// directamente al hogar con el tinte dorado.
const JoinHouseholdModal = ({ token, onClose }) => {
    const { theme, t, setMode, setActiveHouseholdId } = useAuth();
    const { getHouseholdByToken, acceptHouseholdInvite } = useFinance();
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let alive = true;
        if (!token) return;
        (async () => {
            setLoading(true);
            setError(null);
            const data = await getHouseholdByToken(token);
            if (!alive) return;
            if (!data) setError('La invitación al hogar no es válida o ha expirado.');
            setPreview(data);
            setLoading(false);
        })();
        return () => { alive = false; };
    }, [token, getHouseholdByToken]);

    const claim = async (memberId) => {
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const householdId = await acceptHouseholdInvite(token, memberId);
            if (householdId) {
                setActiveHouseholdId(householdId);
                setMode('social');
            }
            onClose(true);
        } catch (err) {
            const msg = err?.message || 'No se pudo aceptar la invitación';
            if (msg.includes('slot already claimed')) setError('Ese miembro ya ha sido reclamado por otro usuario.');
            else if (msg.includes('owner cannot accept')) setError('Eres el dueño del hogar, no puedes auto-invitarte.');
            else if (msg.includes('not found')) setError('La invitación al hogar no es válida.');
            else if (msg.includes('already has a household')) setError('Ya perteneces a un hogar. Sal o bórralo antes de unirte a otro.');
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
                        <h2 className="text-base font-black flex items-center gap-2">
                            <Sparkles size={16} className="text-[#D4AF37]" /> Invitación al hogar
                        </h2>
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
                            <div className={`p-3 rounded-2xl border bg-[#D4AF37]/5 border-[#D4AF37]/20`}>
                                <p className="text-[11px] font-bold text-[#D4AF37]/90">
                                    Al unirte al hogar verás y editarás sus finanzas conjuntas. Tu modo personal sigue intacto.
                                </p>
                            </div>
                            <p className="text-sm font-bold">¿Quién eres en este hogar?</p>
                            <p className={`text-[11px] ${t.textSec}`}>Selecciona el miembro que te corresponde para reclamar tu sitio.</p>
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
                                                : `${theme === 'dark' ? 'border-[#D4AF37]/20 bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10' : 'border-[#E8C547]/40 bg-[#F8E8B8]/40 hover:bg-[#F8E8B8]/70'} active:scale-[0.99]`}`}
                                        >
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0 ${claimed ? 'bg-gray-500' : 'bg-gradient-to-br from-[#E8C547] to-[#9C7C0F]'}`}>
                                                {m.name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-sm truncate">{m.name}</p>
                                                <p className={`text-[10px] font-bold ${t.textSec}`}>{claimed ? 'Ya reclamado' : 'Disponible · pulsa para unirte'}</p>
                                            </div>
                                            {!claimed && <Check size={16} className="text-[#D4AF37]" />}
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

export default JoinHouseholdModal;
