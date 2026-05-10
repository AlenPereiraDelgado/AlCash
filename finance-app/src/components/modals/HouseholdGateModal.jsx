import { useState } from 'react';
import { X, Users, Sparkles, Plus, Trash2, AlertCircle, Copy, Check, Link2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';

// Modal "puerta" del modo Social: si el usuario no tiene ningún hogar,
// le obliga a crear uno antes de poder activarlo. Diseño minimal con
// nombre del hogar + nombres de los miembros iniciales (mínimo el dueño).
//
// Flujo: el hogar queda PENDIENTE hasta que un segundo miembro acepta
// la invitación. El owner no entra al modo Social automáticamente: solo
// se le entrega el enlace para compartir. Cuando alguien lo acepta, el
// hogar pasa a activable desde Ajustes / Sidebar.
const HouseholdGateModal = ({ open, onClose, onCreated }) => {
    const { theme, t, activeColor } = useAuth();
    const { createHousehold, addHouseholdMemberSlot, ensureHouseholdInviteToken } = useFinance();
    const [name, setName] = useState('');
    const [ownerName, setOwnerName] = useState('Yo');
    const [members, setMembers] = useState(['Pareja']);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [inviteUrl, setInviteUrl] = useState(null);
    const [copied, setCopied] = useState(false);
    const [createdId, setCreatedId] = useState(null);

    if (!open) return null;

    const setMember = (i, v) => {
        const next = [...members];
        next[i] = v;
        setMembers(next);
    };
    const addMember = () => setMembers(prev => [...prev, '']);
    const removeMember = (i) => setMembers(prev => prev.filter((_, idx) => idx !== i));

    const reset = () => {
        setName(''); setOwnerName('Yo'); setMembers(['Pareja']);
        setError(null); setInviteUrl(null); setCopied(false); setCreatedId(null);
    };

    const handleClose = () => {
        reset();
        onClose?.();
    };

    const handleCreate = async () => {
        if (submitting) return;
        const cleanName = name.trim();
        if (!cleanName) { setError('Pon un nombre al hogar'); return; }
        const cleanMembers = members.map(m => m.trim()).filter(Boolean);
        if (cleanMembers.length === 0) { setError('Añade al menos un miembro a invitar'); return; }
        setSubmitting(true);
        setError(null);
        try {
            const id = await createHousehold(cleanName, ownerName.trim() || 'Yo');
            for (const m of cleanMembers) {
                await addHouseholdMemberSlot(id, m);
            }
            const token = await ensureHouseholdInviteToken(id);
            if (!token) throw new Error('No se pudo generar el enlace de invitación');
            const url = `${window.location.origin}${window.location.pathname}#joinhh/${token}`;
            setCreatedId(id);
            setInviteUrl(url);
            onCreated?.(id);
        } catch (err) {
            const raw = err?.message || '';
            const friendly = raw.includes('already has a household')
                ? 'Ya perteneces a un hogar. Solo puedes tener uno a la vez.'
                : (raw || 'No se pudo crear el hogar');
            setError(friendly);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCopy = async () => {
        if (!inviteUrl) return;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Únete a mi hogar',
                    text: 'Únete a mi hogar en AlCash',
                    url: inviteUrl,
                });
                return;
            } catch (err) {
                if (err?.name === 'AbortError') return;
            }
        }
        try { await navigator.clipboard.writeText(inviteUrl); } catch { /* ignore */ }
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/70 backdrop-blur-sm" onClick={handleClose}>
            <div
                className={`w-full max-w-md rounded-t-[32px] md:rounded-[40px] shadow-2xl overflow-hidden border ${t.card}`}
                onClick={e => e.stopPropagation()}
            >
                <div className={`p-5 border-b flex justify-between items-start gap-4 ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-black">Modo Social</h2>
                        <p className={`text-[11px] font-bold mt-0.5 ${t.textSec}`}>
                            {inviteUrl
                                ? 'Comparte el enlace. El hogar se activa cuando alguien lo acepta.'
                                : 'Crea una red para gestionar finanzas en pareja, familia o con gente de confianza.'}
                        </p>
                    </div>
                    <button onClick={handleClose} className={`p-2 rounded-xl ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    {!inviteUrl ? (
                        <>
                            <div className={`p-3 rounded-2xl border bg-[#D4AF37]/5 border-[#D4AF37]/20`}>
                                <p className="text-[11px] font-bold text-[#D4AF37]/90">
                                    Al crear, recibirás un enlace para invitar. El modo Social no se activa hasta que alguien lo acepte. Datos aislados, editables por todos los miembros.
                                </p>
                            </div>

                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${t.textSec}`}>Nombre del hogar</p>
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Casa, Pareja, Familia…"
                                    className={`w-full p-3 rounded-xl font-bold text-sm ${t.input}`}
                                    maxLength={80}
                                />
                            </div>

                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${t.textSec}`}>Tu nombre dentro del hogar</p>
                                <input
                                    value={ownerName}
                                    onChange={e => setOwnerName(e.target.value)}
                                    placeholder="Yo, Alen, Mamá…"
                                    className={`w-full p-3 rounded-xl font-bold text-sm ${t.input}`}
                                    maxLength={80}
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${t.textSec}`}>A quién invitas</p>
                                    <button onClick={addMember} className={`flex items-center gap-1 text-[10px] font-black uppercase ${activeColor.text}`}>
                                        <Plus size={12} /> Añadir
                                    </button>
                                </div>
                                <div className="space-y-1.5">
                                    {members.map((m, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <input
                                                value={m}
                                                onChange={e => setMember(i, e.target.value)}
                                                placeholder={`Miembro ${i + 1}`}
                                                className={`flex-1 p-2.5 rounded-lg font-bold text-xs ${t.input}`}
                                                maxLength={80}
                                            />
                                            <button onClick={() => removeMember(i)} className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    {members.length === 0 && (
                                        <p className={`text-[11px] font-bold ${t.textSec}`}>Añade al menos un miembro para enviarle el enlace.</p>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-2">
                                    <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                                    <p className="text-xs font-bold text-red-500">{error}</p>
                                </div>
                            )}

                            <button
                                onClick={handleCreate}
                                disabled={submitting}
                                className={`w-full py-4 rounded-2xl font-black text-base text-white shadow-lg active:scale-95 transition-all bg-gradient-to-br from-[#F4D578] via-[#D4AF37] to-[#9C7C0F] disabled:opacity-50 flex items-center justify-center gap-2`}
                            >
                                <Users size={18} /> {submitting ? 'Generando enlace…' : 'Generar invitación'}
                            </button>
                        </>
                    ) : (
                        // Pantalla de éxito · enlace para compartir
                        <>
                            <div className={`p-4 rounded-2xl border bg-[#D4AF37]/10 border-[#D4AF37]/30 space-y-2`}>
                                <div className="flex items-center gap-2">
                                    <Sparkles size={16} className="text-[#D4AF37]" />
                                    <p className="text-sm font-black text-[#D4AF37]">Invitación creada</p>
                                </div>
                                <p className="text-[11px] font-bold text-[#D4AF37]/90">
                                    Hogar <span className="font-black">{name.trim()}</span> · pendiente de aceptación. Cuando alguien acepte el enlace, podrás activarlo desde el sidebar o Ajustes.
                                </p>
                            </div>

                            <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${t.textSec}`}>Enlace de invitación</p>
                                <button
                                    onClick={handleCopy}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${copied ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-[#D4AF37]/30 bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10'}`}
                                >
                                    {copied ? <Check size={14} className="text-emerald-500 shrink-0" /> : <Link2 size={14} className="text-[#D4AF37] shrink-0" />}
                                    <span className={`text-[11px] font-bold flex-1 truncate ${copied ? 'text-emerald-500' : 'text-[#D4AF37]'}`}>
                                        {copied ? '¡Enlace copiado!' : inviteUrl}
                                    </span>
                                    <Copy size={14} className={copied ? 'text-emerald-500' : 'text-[#D4AF37]'} />
                                </button>
                                <p className={`text-[10px] mt-2 ${t.textSec}`}>Compártelo por WhatsApp, mail o lo que quieras. La persona que lo abra elegirá su miembro.</p>
                            </div>

                            <button
                                onClick={handleClose}
                                className="w-full py-3 rounded-xl font-black text-sm text-white bg-gradient-to-br from-[#F4D578] via-[#D4AF37] to-[#9C7C0F] shadow-lg active:scale-95 transition-all"
                            >
                                Listo
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HouseholdGateModal;
