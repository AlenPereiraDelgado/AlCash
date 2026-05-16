import { useEffect, useLayoutEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    X, ChevronRight, ChevronLeft, Check, Sparkles, Wand2, Globe2, CalendarDays,
    Plus, List, Repeat, Users, ShieldCheck, Settings as SettingsIcon, Rocket,
    LayoutGrid, Pencil, Trash2, Bell, FileText, Image as ImageIcon, FileSpreadsheet,
    Sun, Moon, ArrowRight, Zap, ArrowDown,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const TOUR_STORAGE_KEY = 'alcash_tour_v1_done';

// Pasos: títulos cortos, body 1-2 líneas, icono semántico, color de acento por paso
const STEPS = [
    {
        id: 'welcome',
        target: null,
        title: 'Bienvenido a AlCash',
        body: 'Te enseño AlCash en 60 segundos. Pulsa Siguiente cuando quieras avanzar.',
        icon: Rocket,
        accent: '#0A84FF',
    },
    {
        id: 'magic',
        target: '[data-tour="magic-input"]',
        title: 'Escribir con IA',
        body: 'Escribe «café 3€» y la IA propone la tarjeta. Tú la revisas y validas en el globo antes de guardar.',
        icon: Wand2,
        accent: '#A855F7',
    },
    {
        id: 'import',
        target: '[data-tour="import-globe"]',
        title: 'Importar masivo',
        body: 'Sube PDF, foto o CSV. La IA lo lee y aparecen las tarjetas — las validas igual que con el texto.',
        icon: Globe2,
        accent: '#0A84FF',
    },
    {
        id: 'add',
        target: '[data-tour="nav-add"]',
        title: 'Botón +',
        body: 'Tres opciones: registrar movimiento, crear automatización o añadir un gasto compartido.',
        icon: Plus,
        accent: '#FF9F0A',
    },
    {
        id: 'date',
        target: '[data-tour="date-selector"]',
        title: 'Filtro de fechas',
        body: 'Cambia entre día, mes, año o rango personalizado. Todo el panel se recalcula.',
        icon: CalendarDays,
        accent: '#FFD60A',
    },
    {
        id: 'widgets',
        target: '[data-tour="widgets-grid"]',
        title: 'Widgets del panel',
        body: 'Tócalos — muchos abren detalles dentro. Mantén pulsado para reordenar, activar o desactivar los que quieras.',
        icon: LayoutGrid,
        accent: '#64D2FF',
    },
    {
        id: 'list',
        target: '[data-tour="nav-list"]',
        title: 'Movimientos',
        body: 'Revisa todos tus gastos. Desliza cada fila de derecha a izquierda para Editar o Borrar.',
        icon: List,
        accent: '#0A84FF',
        demo: 'swipe',
    },
    {
        id: 'fixed',
        target: '[data-tour="nav-fixed"]',
        title: 'Gastos fijos',
        body: 'Tus suscripciones y recurrentes. Verás calendario mensual y total al mes o al año.',
        icon: Repeat,
        accent: '#A855F7',
    },
    {
        id: 'social',
        target: '[data-tour="nav-social"]',
        title: 'Social',
        body: 'Invita gente y comparte gastos en grupo con saldos calculados automáticamente.',
        icon: Users,
        accent: '#D4AF37',
    },
    {
        id: 'debts',
        target: '[data-tour="nav-debts"]',
        title: 'Deudas',
        body: 'Registra lo que te deben o debes. Crea grupos locales para repartir gastos.',
        icon: ShieldCheck,
        accent: '#FF453A',
    },
    {
        id: 'settings',
        target: '[data-tour="nav-settings"]',
        title: 'Ajustes',
        body: 'Tema, color, categorías, importar/exportar y ver el tutorial otra vez.',
        icon: SettingsIcon,
        accent: '#8E8E93',
    },
    {
        id: 'end',
        target: null,
        title: 'Todo listo',
        body: 'Empieza por tu primer movimiento desde el botón + o escribiendo arriba.',
        icon: Sparkles,
        accent: '#30D158',
    },
];

const PADDING = 10;
const TIP_W = 340;
const TIP_GAP = 18;
const HOLE_RADIUS = 20;

// Mini demo animado del swipe: replica los 4 botones reales de TransactionListView
// (Compartir, Aviso, Editar, Borrar). Fila se desliza ← y reaparece en loop.
const SWIPE_REVEAL = 168; // ancho aproximado de 4 botones revelados
const SwipeDemo = ({ isDark, accent }) => {
    const rowBg = isDark ? '#0E0E11' : '#FFFFFF';
    const rowBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const fg = isDark ? '#FFFFFF' : '#0A0A0A';
    const btn = 'flex-1 flex items-center justify-center';
    return (
        <div
            className="relative mt-3 rounded-2xl overflow-hidden"
            style={{
                height: 56,
                border: `1px solid ${rowBorder}`,
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            }}
        >
            {/* Botones revelados detrás (mismo orden que la app real) */}
            <div
                className="absolute inset-y-0 right-0 flex items-stretch"
                style={{ width: SWIPE_REVEAL }}
            >
                <div className={btn} style={{ background: 'rgba(168,85,247,0.20)', color: '#C084FC' }} title="Compartir">
                    <Users size={16} />
                </div>
                <div className={btn} style={{ background: 'rgba(6,182,212,0.15)', color: '#22D3EE' }} title="Aviso">
                    <Bell size={16} />
                </div>
                <div className={btn} style={{ background: 'rgba(10,132,255,0.20)', color: '#60A5FA' }} title="Editar">
                    <Pencil size={16} />
                </div>
                <div className={btn} style={{ background: 'rgba(255,69,58,0.25)', color: '#F87171' }} title="Borrar">
                    <Trash2 size={16} />
                </div>
            </div>

            {/* Fila que se desliza */}
            <div
                className="absolute inset-0 flex items-center px-3 gap-2.5"
                style={{
                    background: rowBg,
                    animation: 'tourSwipeRow 3.4s ease-in-out infinite',
                }}
            >
                <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: accent + '22' }}
                >
                    <span style={{ fontSize: 16 }}>☕</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-black truncate" style={{ color: fg }}>Café</div>
                    <div className="text-[10px] opacity-60 truncate" style={{ color: fg }}>Hoy · Comida</div>
                </div>
                <div className="text-[13px] font-black shrink-0" style={{ color: '#FF453A' }}>-3,00 €</div>
            </div>

            {/* Indicador dedo */}
            <div
                className="pointer-events-none absolute"
                style={{
                    right: 12,
                    top: '50%',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.95)',
                    border: '2px solid rgba(0,0,0,0.15)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    animation: 'tourSwipeFinger 3.4s ease-in-out infinite',
                }}
            />
        </div>
    );
};

// ---------- Demos por paso ----------
const demoBoxCls = 'relative mt-3 rounded-2xl overflow-hidden';
const demoBoxStyle = (isDark) => ({
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
});

const MagicDemo = ({ isDark, accent }) => {
    const fg = isDark ? '#FFFFFF' : '#0A0A0A';
    const inputBg = isDark ? '#0E0E11' : '#FFFFFF';
    return (
        <div className={demoBoxCls} style={{ ...demoBoxStyle(isDark), height: 88 }}>
            {/* Input que se va llenando */}
            <div
                className="absolute top-2.5 left-2.5 right-2.5 h-9 rounded-xl flex items-center px-2 gap-2"
                style={{ background: inputBg, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}
            >
                <div
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: accent }}
                >
                    <Sparkles size={11} className="text-white" />
                </div>
                <div className="flex-1 text-[12px] font-bold relative overflow-hidden" style={{ color: fg }}>
                    <span style={{
                        display: 'inline-block',
                        animation: 'tourTypeText 4s steps(8, end) infinite',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        width: 0,
                    }}>café 3€</span>
                    <span
                        style={{
                            display: 'inline-block',
                            width: 1.5,
                            height: 12,
                            background: accent,
                            verticalAlign: 'middle',
                            marginLeft: 1,
                            animation: 'tourCaret 0.7s steps(1) infinite',
                        }}
                    />
                </div>
                <Zap size={12} style={{ color: accent, animation: 'tourZap 4s ease-in-out infinite' }} />
            </div>
            {/* Tarjeta resultado */}
            <div
                className="absolute bottom-2.5 left-2.5 right-2.5 h-9 rounded-xl flex items-center px-2 gap-2"
                style={{
                    background: inputBg,
                    border: `1px solid ${accent}55`,
                    boxShadow: `0 0 0 1px ${accent}33, 0 4px 14px ${accent}22`,
                    animation: 'tourResultIn 4s ease-in-out infinite',
                    opacity: 0,
                }}
            >
                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: accent + '22' }}>
                    <span style={{ fontSize: 12 }}>☕</span>
                </div>
                <div className="text-[11px] font-black truncate" style={{ color: fg }}>Café</div>
                <div className="text-[9px] opacity-60 truncate" style={{ color: fg }}>Comida</div>
                <div className="ml-auto text-[12px] font-black" style={{ color: '#FF453A' }}>-3,00 €</div>
            </div>
        </div>
    );
};

const ImportDemo = ({ isDark, accent }) => {
    const chip = (Icon, color, delay) => (
        <div
            className="absolute flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black text-white shadow-lg"
            style={{
                background: color,
                left: 12,
                top: '50%',
                animation: `tourImportChip 3.6s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s infinite`,
                opacity: 0,
            }}
        >
            <Icon size={11} />
        </div>
    );
    return (
        <div className={demoBoxCls} style={{ ...demoBoxStyle(isDark), height: 88 }}>
            {/* Wrapper centrado para globo + ondas */}
            <div
                className="absolute"
                style={{ right: 12, top: '50%', transform: 'translateY(-50%)', width: 48, height: 48 }}
            >
                <div
                    className="w-full h-full rounded-2xl flex items-center justify-center shadow-xl"
                    style={{ background: `linear-gradient(135deg, ${accent}, ${accent}AA)`, boxShadow: `0 6px 18px ${accent}66` }}
                >
                    <Globe2 size={22} className="text-white" style={{ animation: 'tourSpin 8s linear infinite' }} />
                </div>
                {/* Onda 1 */}
                <div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{ border: `2px solid ${accent}`, animation: 'tourPulse 1.8s ease-out infinite', opacity: 0 }}
                />
                {/* Onda 2 con delay */}
                <div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{ border: `2px solid ${accent}`, animation: 'tourPulse 1.8s ease-out 0.6s infinite', opacity: 0 }}
                />
            </div>
            {/* Chips entrando */}
            {chip(FileText, '#FF453A', 0)}
            {chip(ImageIcon, '#30D158', 0.4)}
            {chip(FileSpreadsheet, '#0A84FF', 0.8)}
        </div>
    );
};

const AddDemo = ({ isDark, accent }) => {
    const fg = isDark ? '#FFFFFF' : '#0A0A0A';
    const tab = (Icon, label, color, delay) => (
        <div
            className="flex flex-col items-center gap-1"
            style={{ animation: `tourTabPulse 2.4s ease-in-out ${delay}s infinite` }}
        >
            <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow"
                style={{ background: color }}
            >
                <Icon size={14} className="text-white" />
            </div>
            <span className="text-[9px] font-black opacity-80" style={{ color: fg }}>{label}</span>
        </div>
    );
    return (
        <div className={demoBoxCls} style={{ ...demoBoxStyle(isDark), height: 88 }}>
            <div className="absolute inset-0 flex items-center justify-around px-2">
                {tab(Plus, 'Movimiento', accent, 0)}
                {tab(Repeat, 'Automático', '#A855F7', 0.8)}
                {tab(Users, 'Compartido', '#D4AF37', 1.6)}
            </div>
        </div>
    );
};

const DateDemo = ({ isDark, accent }) => {
    const fg = isDark ? '#FFFFFF' : '#0A0A0A';
    const chipBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const labels = ['Día', 'Mes', 'Año', 'Rango'];
    return (
        <div className={demoBoxCls} style={{ ...demoBoxStyle(isDark), height: 122, padding: 8 }}>
            {/* Selector estilo real: < Mes > con etiqueta cambiando */}
            <div className="flex items-center justify-between mb-2">
                <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: chipBg }}
                >
                    <ChevronLeft size={12} style={{ color: fg, animation: 'tourDateNav 4s ease-in-out infinite' }} />
                </div>
                <div className="flex items-center gap-1.5">
                    <CalendarDays size={12} style={{ color: accent }} />
                    <span
                        className="text-[11px] font-black uppercase tracking-widest"
                        style={{ color: fg, animation: 'tourDateLabel 8s ease-in-out infinite' }}
                    >
                        Mayo 2026
                    </span>
                </div>
                <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: chipBg }}
                >
                    <ChevronRight size={12} style={{ color: fg, animation: 'tourDateNav 4s ease-in-out 2s infinite' }} />
                </div>
            </div>
            {/* Presets pills cíclicos */}
            <div className="flex gap-1 mb-2">
                {labels.map((l, i) => (
                    <div
                        key={l}
                        className="flex-1 h-6 rounded-md flex items-center justify-center text-[9px] font-black"
                        style={{
                            background: chipBg,
                            color: fg,
                            animation: `tourDatePill 8s ease-in-out ${i * 2}s infinite`,
                        }}
                    >
                        {l}
                    </div>
                ))}
            </div>
            {/* Mini bar chart que cambia escala */}
            <div className="flex items-end gap-1" style={{ height: 28 }}>
                {[40, 70, 55, 90, 30, 65, 80].map((h, i) => (
                    <div
                        key={i}
                        className="flex-1 rounded-sm"
                        style={{
                            background: `linear-gradient(180deg, ${accent}, ${accent}66)`,
                            height: `${h}%`,
                            transformOrigin: 'bottom',
                            animation: `tourDateBar 4s ease-in-out ${i * 0.08}s infinite`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

const WidgetsDemo = ({ isDark, accent }) => {
    const card = (delay, hi) => (
        <div
            className="rounded-lg"
            style={{
                background: hi ? accent + '44' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                border: hi ? `1.5px solid ${accent}` : `1px solid transparent`,
                animation: `tourWidgetLift 3.2s ease-in-out ${delay}s infinite`,
            }}
        />
    );
    return (
        <div className={demoBoxCls} style={{ ...demoBoxStyle(isDark), height: 88, padding: 8 }}>
            <div className="grid grid-cols-2 gap-1.5 w-full h-full">
                {card(0, true)}
                {card(0.4, false)}
                {card(0.8, false)}
                {card(1.2, false)}
            </div>
        </div>
    );
};

const FixedDemo = ({ isDark, accent }) => {
    const fg = isDark ? '#FFFFFF' : '#0A0A0A';
    const cellBase = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const cardBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
    const recurring = new Set([5, 12, 20, 28]);
    return (
        <div className={demoBoxCls} style={{ ...demoBoxStyle(isDark), height: 132, padding: 8 }}>
            {/* Calendario izquierda */}
            <div className="absolute left-2 top-2 bottom-2" style={{ width: 96 }}>
                <div className="flex items-center gap-1 mb-1">
                    <CalendarDays size={10} style={{ color: accent }} />
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-70" style={{ color: fg }}>Mayo</span>
                </div>
                <div className="grid grid-cols-7 gap-[2px]" style={{ gridAutoRows: '10px' }}>
                    {Array.from({ length: 28 }).map((_, i) => {
                        const day = i + 1;
                        const isRec = recurring.has(day);
                        return (
                            <div
                                key={day}
                                className="rounded-[2px]"
                                style={{
                                    background: isRec ? accent : cellBase,
                                    animation: isRec ? `tourFixedDot 2.4s ease-in-out ${(day % 4) * 0.3}s infinite` : 'none',
                                    boxShadow: isRec ? `0 0 0 1px ${accent}55` : 'none',
                                }}
                            />
                        );
                    })}
                </div>
            </div>
            {/* Suscripciones derecha */}
            <div className="absolute right-2 top-2 bottom-2 flex flex-col gap-1" style={{ left: 112 }}>
                {[
                    { label: 'Netflix', amt: '15,99', emoji: '🎬', d: 0 },
                    { label: 'Spotify', amt: '9,99', emoji: '🎵', d: 0.25 },
                    { label: 'Gym', amt: '21,92', emoji: '🏋️', d: 0.5 },
                ].map(it => (
                    <div
                        key={it.label}
                        className="flex items-center gap-1.5 px-1.5 py-1 rounded-md"
                        style={{
                            background: cardBg,
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                            animation: `tourFixedSubIn 3.6s ease-in-out ${it.d}s infinite`,
                            opacity: 0,
                        }}
                    >
                        <span style={{ fontSize: 10 }}>{it.emoji}</span>
                        <span className="text-[9px] font-black truncate flex-1" style={{ color: fg }}>{it.label}</span>
                        <span className="text-[9px] font-black" style={{ color: accent }}>{it.amt}€</span>
                    </div>
                ))}
                {/* Total grande abajo */}
                <div
                    className="mt-auto flex items-baseline gap-1 px-1.5"
                    style={{ animation: 'tourFixedTotal 3.6s ease-in-out infinite' }}
                >
                    <span className="text-[14px] font-black leading-none" style={{ color: accent }}>47,90€</span>
                    <span className="text-[8px] opacity-60 font-black" style={{ color: fg }}>/mes</span>
                    <span className="ml-auto text-[8px] opacity-60 font-black" style={{ color: fg }}>574,80€/año</span>
                </div>
            </div>
        </div>
    );
};

const SocialDemo = ({ isDark, accent }) => {
    const fg = isDark ? '#FFFFFF' : '#0A0A0A';
    const members = [
        { l: 'A', c: '#0A84FF', x: 18 },
        { l: 'L', c: '#FF453A', x: 50 },
        { l: 'B', c: '#30D158', x: 82 },
    ];
    return (
        <div className={demoBoxCls} style={{ ...demoBoxStyle(isDark), height: 128, padding: 8 }}>
            {/* Header grupo */}
            <div className="flex items-center gap-1.5 mb-1">
                <Users size={11} style={{ color: accent }} />
                <span className="text-[9px] font-black uppercase tracking-widest opacity-80" style={{ color: fg }}>Casa · 3 miembros</span>
            </div>
            {/* Fila avatares */}
            <div className="relative" style={{ height: 32 }}>
                {members.map((m, i) => (
                    <div
                        key={m.l}
                        className="absolute top-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-black shadow-lg"
                        style={{
                            background: m.c,
                            left: `${m.x}%`,
                            transform: 'translateX(-50%)',
                            boxShadow: `0 4px 12px ${m.c}66`,
                            animation: `tourSocialAvatar 3.6s ease-in-out ${i * 0.3}s infinite`,
                        }}
                    >
                        {m.l}
                    </div>
                ))}
            </div>
            {/* Gasto */}
            <div
                className="absolute left-1/2 -translate-x-1/2 rounded-xl px-3 py-1.5 text-center shadow-xl"
                style={{
                    bottom: 30,
                    background: `linear-gradient(135deg, ${accent}, ${accent}CC)`,
                    boxShadow: `0 6px 18px ${accent}55`,
                    animation: 'tourSocialPop 3.6s ease-in-out infinite',
                }}
            >
                <div className="text-[8px] font-black text-white opacity-80 uppercase tracking-wider leading-tight">Cena</div>
                <div className="text-[13px] font-black text-white leading-tight">30,00 €</div>
            </div>
            {/* Reparto: chips €10 saltando a cada avatar */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-around px-3">
                {members.map((m, i) => (
                    <div
                        key={`r-${m.l}`}
                        className="text-[9px] font-black px-1.5 py-0.5 rounded"
                        style={{
                            color: m.c,
                            background: m.c + '20',
                            border: `1px solid ${m.c}55`,
                            animation: `tourSocialSplit 3.6s ease-in-out ${0.6 + i * 0.2}s infinite`,
                            opacity: 0,
                        }}
                    >
                        10,00€
                    </div>
                ))}
            </div>
        </div>
    );
};

const DebtsDemo = ({ isDark }) => {
    const fg = isDark ? '#FFFFFF' : '#0A0A0A';
    const row = ({ avatar, color, name, sub, amount, delay }) => (
        <div
            key={name}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl"
            style={{
                background: color + '12',
                border: `1px solid ${color}33`,
                animation: `tourDebtRowIn 3.4s ease-in-out ${delay}s infinite`,
                opacity: 0,
            }}
        >
            <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0"
                style={{ background: color, boxShadow: `0 3px 8px ${color}55` }}
            >
                {avatar}
            </div>
            <div className="flex-1 min-w-0 leading-tight">
                <div className="text-[10px] font-black truncate" style={{ color: fg }}>{name}</div>
                <div className="text-[8px] opacity-60 truncate" style={{ color: fg }}>{sub}</div>
            </div>
            <span className="text-[12px] font-black shrink-0" style={{ color }}>{amount}</span>
        </div>
    );
    return (
        <div className={demoBoxCls} style={{ ...demoBoxStyle(isDark), height: 146, padding: 8 }}>
            {/* Balance neto arriba */}
            <div
                className="flex items-center justify-between px-2.5 py-1 rounded-xl mb-1.5"
                style={{
                    background: 'linear-gradient(135deg, rgba(48,209,88,0.18), rgba(48,209,88,0.04))',
                    border: '1px solid rgba(48,209,88,0.35)',
                }}
            >
                <span className="text-[8px] font-black uppercase tracking-widest opacity-70" style={{ color: fg }}>Balance neto</span>
                <span
                    className="text-[13px] font-black"
                    style={{ color: '#30D158', animation: 'tourDebtBalance 3s ease-in-out infinite' }}
                >
                    +75,00 €
                </span>
            </div>
            <div className="flex flex-col gap-1.5">
                {row({ avatar: 'J', color: '#30D158', name: 'Juan te debe', sub: 'Cena · vence 20 may', amount: '+120 €', delay: 0 })}
                {row({ avatar: 'M', color: '#FF453A', name: 'Le debes a María', sub: 'Taxi · pendiente', amount: '-45 €', delay: 0.4 })}
            </div>
        </div>
    );
};

const SettingsDemo = ({ isDark }) => {
    const fg = isDark ? '#FFFFFF' : '#0A0A0A';
    const rowBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
    const swatch = (color, delay) => (
        <div
            className="rounded-full"
            style={{
                width: 18, height: 18,
                background: color,
                color, // currentColor para el ring
                boxShadow: `0 0 0 1.5px currentColor inset, 0 0 0 0 transparent`,
                animation: `tourSwatchRing 5s ease-in-out ${delay}s infinite`,
            }}
        />
    );
    return (
        <div className={demoBoxCls} style={{ ...demoBoxStyle(isDark), height: 128, padding: 8 }}>
            {/* Theme + swatches en una fila */}
            <div className="flex items-center gap-2 mb-1.5">
                <div
                    className="rounded-full relative shrink-0"
                    style={{ width: 44, height: 22, background: isDark ? '#1F1F26' : '#E5E7EB' }}
                >
                    <div
                        className="absolute w-[18px] h-[18px] rounded-full flex items-center justify-center text-white shadow top-[2px]"
                        style={{
                            background: '#0A84FF',
                            animation: 'tourThemeToggle 3s ease-in-out infinite',
                        }}
                    >
                        <Sun size={10} style={{ animation: 'tourThemeIcon 3s ease-in-out infinite' }} />
                        <Moon size={10} style={{ position: 'absolute', animation: 'tourThemeIconRev 3s ease-in-out infinite', opacity: 0 }} />
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {swatch('#0A84FF', 0)}
                    {swatch('#FF453A', 0.8)}
                    {swatch('#30D158', 1.6)}
                    {swatch('#A855F7', 2.4)}
                    {swatch('#FFD60A', 3.2)}
                </div>
            </div>
            {/* Selector widgets: 4 filas activándose con click */}
            <div className="flex items-center gap-1.5 mb-1">
                <LayoutGrid size={10} style={{ color: fg, opacity: 0.7 }} />
                <span className="text-[8px] font-black uppercase tracking-widest opacity-70" style={{ color: fg }}>Widgets del panel</span>
            </div>
            {[
                { label: 'Salud Financiera', d: 0 },
                { label: 'Próximo gasto', d: 0.9 },
                { label: 'Radar hábitos', d: 1.8 },
            ].map(r => (
                <div
                    key={r.label}
                    className="relative flex items-center justify-between px-2 py-1 rounded-md mb-1 overflow-hidden"
                    style={{ background: rowBg }}
                >
                    <span className="text-[9px] font-black" style={{ color: fg }}>{r.label}</span>
                    {/* Cursor click */}
                    <div
                        className="absolute pointer-events-none"
                        style={{
                            right: 0,
                            top: '50%',
                            width: 14, height: 14,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.95)',
                            border: '2px solid rgba(0,0,0,0.2)',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                            animation: `tourSettingsClick 2.7s ease-in-out ${r.d}s infinite`,
                            opacity: 0,
                        }}
                    />
                    {/* Toggle */}
                    <div
                        className="rounded-full relative"
                        style={{
                            width: 22, height: 12,
                            background: isDark ? '#3A3A45' : '#D1D5DB',
                            animation: `tourSettingsWidgetBg 2.7s ease-in-out ${r.d}s infinite`,
                        }}
                    >
                        <div
                            className="absolute top-[2px] w-2 h-2 rounded-full bg-white shadow"
                            style={{
                                left: 2,
                                animation: `tourSettingsWidgetKnob 2.7s ease-in-out ${r.d}s infinite`,
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

const WelcomeDemo = ({ isDark, accent }) => {
    return (
        <div className={demoBoxCls} style={{ ...demoBoxStyle(isDark), height: 70 }}>
            <div className="absolute inset-0 flex items-center justify-center gap-2">
                {[Wand2, Globe2, LayoutGrid, List, Repeat, Users].map((Icon, i) => (
                    <div
                        key={i}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{
                            background: accent + '22',
                            color: accent,
                            animation: `tourWelcomeIcon 2.4s ease-in-out ${i * 0.15}s infinite`,
                        }}
                    >
                        <Icon size={14} />
                    </div>
                ))}
            </div>
        </div>
    );
};

const EndDemo = ({ isDark, accent }) => {
    return (
        <div className={demoBoxCls} style={{ ...demoBoxStyle(isDark), height: 70 }}>
            <div className="absolute inset-0 flex items-center justify-center gap-2">
                <ArrowDown size={14} style={{ color: accent, animation: 'tourEndBounce 1.2s ease-in-out infinite' }} />
                <div
                    className="h-8 px-3 rounded-xl flex items-center gap-1 text-white text-[11px] font-black shadow"
                    style={{ background: `linear-gradient(135deg, ${accent}, ${accent}AA)`, boxShadow: `0 4px 14px ${accent}55` }}
                >
                    <Plus size={12} /> Empezar
                </div>
                <ArrowDown size={14} style={{ color: accent, animation: 'tourEndBounce 1.2s ease-in-out 0.3s infinite' }} />
            </div>
        </div>
    );
};

const StepDemo = ({ id, isDark, accent }) => {
    switch (id) {
        case 'welcome': return <WelcomeDemo isDark={isDark} accent={accent} />;
        case 'magic': return <MagicDemo isDark={isDark} accent={accent} />;
        case 'import': return <ImportDemo isDark={isDark} accent={accent} />;
        case 'add': return <AddDemo isDark={isDark} accent={accent} />;
        case 'date': return <DateDemo isDark={isDark} accent={accent} />;
        case 'widgets': return <WidgetsDemo isDark={isDark} accent={accent} />;
        case 'list': return <SwipeDemo isDark={isDark} accent={accent} />;
        case 'fixed': return <FixedDemo isDark={isDark} accent={accent} />;
        case 'social': return <SocialDemo isDark={isDark} accent={accent} />;
        case 'debts': return <DebtsDemo isDark={isDark} accent={accent} />;
        case 'settings': return <SettingsDemo isDark={isDark} accent={accent} />;
        case 'end': return <EndDemo isDark={isDark} accent={accent} />;
        default: return null;
    }
};

const OnboardingTour = ({ open, onClose, onFinish }) => {
    const { theme } = useAuth();
    const [stepIdx, setStepIdx] = useState(0);
    const [rect, setRect] = useState(null);
    const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 360);
    const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
    const [animKey, setAnimKey] = useState(0); // re-disparar animaciones por paso
    const dirRef = useRef(1); // 1 = forward, -1 = back (para slide direction)

    const step = STEPS[stepIdx];
    const total = STEPS.length;
    const isFirst = stepIdx === 0;
    const isLast = stepIdx === total - 1;
    const StepIcon = step.icon || Sparkles;

    // --- Medir target ---
    // Scroll instantáneo (no smooth) para que el rect coincida con la posición final
    // del elemento. Si no, el overlay queda desfasado mientras la página scrollea.
    const measure = useCallback(() => {
        setVw(window.innerWidth);
        setVh(window.innerHeight);
        if (!step?.target) { setRect(null); return true; }
        const el = document.querySelector(step.target);
        if (!el) { setRect(null); return false; }
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') {
            setRect(null);
            return false;
        }
        let r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) { setRect(null); return false; }

        // Reservas: header app arriba + altura tooltip estimada (con demo) debajo
        const HEADER_GUARD = 100;
        const TIP_RESERVE = 440;
        const tooBigForBelow = (window.innerHeight - HEADER_GUARD - r.height - TIP_RESERVE) < 0;
        const wantedTop = tooBigForBelow ? HEADER_GUARD + 16 : HEADER_GUARD + 24;
        const offTop = r.top < wantedTop;
        const offBot = r.bottom > window.innerHeight - (tooBigForBelow ? 24 : TIP_RESERVE);

        if (offTop || offBot) {
            // Posiciona el target arriba dejando espacio bajo para el tooltip
            const targetAbs = r.top + window.scrollY;
            const desiredY = tooBigForBelow
                ? targetAbs - (window.innerHeight - r.height) / 2 // centrar
                : targetAbs - (HEADER_GUARD + 32); // pegar arriba con guardia
            const top = Math.max(0, desiredY);
            // Doble fallback: scrollTo instant + scrollIntoView por si el contenedor
            // tiene su propio scroll y window no se mueve.
            try { window.scrollTo({ top, left: 0, behavior: 'instant' }); }
            catch { window.scrollTo(0, top); }
            const stillOff = (() => {
                const rr = el.getBoundingClientRect();
                return rr.top < HEADER_GUARD || rr.bottom > window.innerHeight - 40;
            })();
            if (stillOff) {
                try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch { /* empty */ }
            }
            r = el.getBoundingClientRect();
        }

        setRect({
            x: r.left - PADDING,
            y: r.top - PADDING,
            w: r.width + PADDING * 2,
            h: r.height + PADDING * 2,
            cx: r.left + r.width / 2,
            cy: r.top + r.height / 2,
        });
        return true;
    }, [step]);

    // Sólo lee rect tras scroll/resize (sin re-scrollear, para no pelearse con el usuario)
    const updateRectOnly = useCallback(() => {
        setVw(window.innerWidth);
        setVh(window.innerHeight);
        if (!step?.target) { setRect(null); return; }
        const el = document.querySelector(step.target);
        if (!el) { setRect(null); return; }
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') {
            setRect(null);
            return;
        }
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) { setRect(null); return; }
        setRect({
            x: r.left - PADDING,
            y: r.top - PADDING,
            w: r.width + PADDING * 2,
            h: r.height + PADDING * 2,
            cx: r.left + r.width / 2,
            cy: r.top + r.height / 2,
        });
    }, [step]);

    useEffect(() => {
        if (!open) return;
        window.addEventListener('resize', updateRectOnly);
        window.addEventListener('scroll', updateRectOnly, true);
        return () => {
            window.removeEventListener('resize', updateRectOnly);
            window.removeEventListener('scroll', updateRectOnly, true);
        };
    }, [open, updateRectOnly]);

    useLayoutEffect(() => {
        if (!open) return;
        let cancelled = false;
        let attempts = 0;
        const tryMeasure = () => {
            if (cancelled) return;
            const ok = measure();
            if (ok) {
                // Doble rAF: re-lee rect (sin re-scrollear) tras layout settle
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => { if (!cancelled) updateRectOnly(); });
                });
                return;
            }
            if (attempts < 10) {
                attempts += 1;
                setTimeout(tryMeasure, 180);
            }
        };
        setAnimKey(k => k + 1);
        const id = setTimeout(tryMeasure, 0);
        return () => { cancelled = true; clearTimeout(id); };
    }, [open, stepIdx, measure, updateRectOnly]);

    // No bloqueamos overflow del body: el tour necesita scrollear la página
    // para situar cada target. El listener de scroll re-mide y mueve spotlight.

    const finish = useCallback(() => {
        try { localStorage.setItem(TOUR_STORAGE_KEY, '1'); } catch { /* empty */ }
        onFinish?.();
        onClose?.();
    }, [onFinish, onClose]);

    const next = useCallback(() => {
        dirRef.current = 1;
        if (stepIdx >= total - 1) { finish(); return; }
        setStepIdx(i => i + 1);
    }, [stepIdx, total, finish]);

    const prev = useCallback(() => {
        dirRef.current = -1;
        setStepIdx(i => Math.max(0, i - 1));
    }, []);

    // Keyboard nav
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); finish(); }
            else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, finish, next, prev]);

    const jumpTo = useCallback((idx) => {
        dirRef.current = idx > stepIdx ? 1 : -1;
        setStepIdx(idx);
    }, [stepIdx]);

    // --- Posición tooltip: prueba 4 lados, escoge mejor ---
    const tipPos = useMemo(() => {
        const tipW = Math.min(TIP_W, vw - 24);
        const tipH = 400; // altura estimada con demo
        if (!rect) {
            return {
                left: Math.max(12, (vw - tipW) / 2),
                top: Math.max(12, (vh - tipH) / 2),
                side: 'center',
            };
        }
        // Espacios disponibles en cada lado
        const spaceAbove = rect.y - 12;
        const spaceBelow = vh - (rect.y + rect.h) - 12;
        const spaceLeft = rect.x - 12;
        const spaceRight = vw - (rect.x + rect.w) - 12;

        let side, left, top;
        if (spaceBelow >= tipH + TIP_GAP) {
            side = 'bottom';
            top = rect.y + rect.h + TIP_GAP;
            left = Math.min(Math.max(12, rect.cx - tipW / 2), vw - tipW - 12);
        } else if (spaceAbove >= tipH + TIP_GAP) {
            side = 'top';
            top = rect.y - tipH - TIP_GAP;
            left = Math.min(Math.max(12, rect.cx - tipW / 2), vw - tipW - 12);
        } else if (spaceRight >= tipW + TIP_GAP) {
            side = 'right';
            top = Math.min(Math.max(12, rect.cy - tipH / 2), vh - tipH - 12);
            left = rect.x + rect.w + TIP_GAP;
        } else if (spaceLeft >= tipW + TIP_GAP) {
            side = 'left';
            top = Math.min(Math.max(12, rect.cy - tipH / 2), vh - tipH - 12);
            left = rect.x - tipW - TIP_GAP;
        } else {
            // Sin espacio en ningún lado → centrar
            side = 'center';
            left = Math.max(12, (vw - tipW) / 2);
            top = Math.max(12, (vh - tipH) / 2);
        }
        return { left, top, side, tipW, tipH };
    }, [rect, vw, vh]);

    if (!open) return null;

    const isDark = theme === 'dark';

    // Colores tooltip
    const cardBase = isDark
        ? 'bg-[#0E0E12]/95 border-white/10 text-white'
        : 'bg-white/95 border-gray-200 text-gray-900';

    // Overlay (más suave que antes, menos oscuro)
    const overlayColor = isDark ? 'rgba(8,8,12,0.48)' : 'rgba(20,22,32,0.28)';

    // SVG connector entre tooltip y target
    let connector = null;
    if (rect && tipPos.side !== 'center') {
        const sx = rect.cx;
        const sy = rect.cy;
        // Anchor en tooltip (mid-side hacia el target)
        let ex, ey;
        if (tipPos.side === 'bottom') { ex = tipPos.left + (tipPos.tipW || TIP_W) / 2; ey = tipPos.top; }
        else if (tipPos.side === 'top') { ex = tipPos.left + (tipPos.tipW || TIP_W) / 2; ey = tipPos.top + (tipPos.tipH || 230); }
        else if (tipPos.side === 'right') { ex = tipPos.left; ey = tipPos.top + (tipPos.tipH || 230) / 2; }
        else { ex = tipPos.left + (tipPos.tipW || TIP_W); ey = tipPos.top + (tipPos.tipH || 230) / 2; }
        const dx = (ex - sx) * 0.5;
        const dy = (ey - sy) * 0.5;
        connector = (
            <svg
                className="pointer-events-none fixed inset-0 z-[9998]"
                width={vw}
                height={vh}
                style={{ overflow: 'visible' }}
            >
                <defs>
                    <linearGradient id={`tour-grad-${stepIdx}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={step.accent} stopOpacity="0.0" />
                        <stop offset="40%" stopColor={step.accent} stopOpacity="0.65" />
                        <stop offset="100%" stopColor={step.accent} stopOpacity="1" />
                    </linearGradient>
                    <filter id={`tour-glow-${stepIdx}`} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="b" />
                        <feMerge>
                            <feMergeNode in="b" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                <path
                    id={`tour-path-${stepIdx}`}
                    d={`M ${sx} ${sy} C ${sx + dx} ${sy}, ${ex - dx} ${ey}, ${ex} ${ey}`}
                    stroke={`url(#tour-grad-${stepIdx})`}
                    strokeWidth="2.5"
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                    fill="none"
                    filter={`url(#tour-glow-${stepIdx})`}
                    style={{ animation: 'dashMove 1.4s linear infinite' }}
                />
                {/* Dot que viaja del target hacia el tooltip */}
                <circle r="5" fill={step.accent} filter={`url(#tour-glow-${stepIdx})`}>
                    <animateMotion dur="1.6s" repeatCount="indefinite">
                        <mpath href={`#tour-path-${stepIdx}`} />
                    </animateMotion>
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="1.6s" repeatCount="indefinite" />
                </circle>
            </svg>
        );
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[9999]"
            style={{
                animation: 'tourFadeIn 280ms ease-out',
            }}
        >
            {/* OVERLAY con agujero (box-shadow trick) */}
            {rect ? (
                <div
                    aria-hidden="true"
                    style={{
                        position: 'fixed',
                        left: rect.x,
                        top: rect.y,
                        width: rect.w,
                        height: rect.h,
                        borderRadius: HOLE_RADIUS,
                        boxShadow: `0 0 0 9999px ${overlayColor}`,
                        transition: 'all 480ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                        pointerEvents: 'none',
                    }}
                />
            ) : (
                <div
                    aria-hidden="true"
                    className="fixed inset-0 pointer-events-none"
                    style={{ background: overlayColor }}
                />
            )}

            {/* Anillo glow alrededor del agujero */}
            {rect && (
                <>
                    <div
                        className="pointer-events-none"
                        style={{
                            position: 'fixed',
                            left: rect.x,
                            top: rect.y,
                            width: rect.w,
                            height: rect.h,
                            borderRadius: HOLE_RADIUS,
                            boxShadow: `0 0 0 2px ${step.accent}, 0 0 0 6px ${step.accent}33, 0 0 60px 12px ${step.accent}55`,
                            transition: 'all 480ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                    />
                    {/* Marker grande apuntando al target (sólo si hay hueco; lado opuesto al tooltip) */}
                    {(() => {
                        const tipSide = tipPos.side;
                        // Si tooltip está abajo → marker arriba; si tooltip arriba → marker abajo; lados → arriba si hay hueco
                        const wantAbove = tipSide === 'bottom' || (tipSide !== 'top' && rect.y > 70);
                        const above = wantAbove && rect.y > 60;
                        if (!above && (rect.y + rect.h + 64 > vh)) return null;
                        const cx = Math.min(Math.max(24, rect.cx), vw - 24);
                        const top = above ? rect.y - 56 : rect.y + rect.h + 14;
                        const rot = above ? 0 : 180;
                        return (
                            <div
                                key={`marker-${animKey}`}
                                className="pointer-events-none"
                                style={{
                                    position: 'fixed',
                                    left: cx - 22,
                                    top,
                                    width: 44,
                                    height: 44,
                                    animation: 'tourMarkerBob 1.2s ease-in-out infinite',
                                    zIndex: 9998,
                                }}
                            >
                                <svg viewBox="0 0 44 44" width="44" height="44" style={{ transform: `rotate(${rot}deg)` }}>
                                    <defs>
                                        <filter id={`mark-glow-${stepIdx}`} x="-50%" y="-50%" width="200%" height="200%">
                                            <feGaussianBlur stdDeviation="2.5" />
                                        </filter>
                                    </defs>
                                    <path d="M22 36 L8 18 L36 18 Z" fill={step.accent} filter={`url(#mark-glow-${stepIdx})`} opacity="0.55" />
                                    <path d="M22 32 L12 20 L32 20 Z" fill={step.accent} />
                                </svg>
                            </div>
                        );
                    })()}

                    {/* Anillos ripple (3 ondas concéntricas escalonadas) */}
                    {[0, 0.6, 1.2].map((delay, i) => (
                        <div
                            key={`pulse-${animKey}-${i}`}
                            className="pointer-events-none"
                            style={{
                                position: 'fixed',
                                left: rect.x,
                                top: rect.y,
                                width: rect.w,
                                height: rect.h,
                                borderRadius: HOLE_RADIUS,
                                border: `2px solid ${step.accent}`,
                                animation: `tourPulse 1.8s ease-out ${delay}s infinite`,
                                opacity: 0,
                            }}
                        />
                    ))}
                </>
            )}

            {/* Connector */}
            {connector}

            {/* Ornamento centro para pasos sin target (welcome/end) */}
            {!rect && (
                <div
                    key={`orn-${animKey}`}
                    aria-hidden="true"
                    className="pointer-events-none fixed inset-0 flex items-center justify-center"
                    style={{ zIndex: 9997 }}
                >
                    <div
                        className="relative"
                        style={{
                            animation: 'tourOrnIn 700ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                    >
                        <div
                            className="absolute inset-0 rounded-full blur-3xl"
                            style={{
                                background: `radial-gradient(circle, ${step.accent}55, transparent 70%)`,
                                width: 360, height: 360,
                                left: -180, top: -180,
                            }}
                        />
                        <StepIcon
                            size={160}
                            style={{
                                color: step.accent,
                                opacity: 0.18,
                                filter: 'drop-shadow(0 0 30px ' + step.accent + '88)',
                                animation: 'tourFloat 4s ease-in-out infinite',
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Botón cerrar */}
            <button
                onClick={finish}
                className="fixed top-4 right-4 z-[10001] w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition border border-white/10"
                aria-label="Cerrar tour"
                style={{ animation: 'tourFadeIn 320ms ease-out 120ms both' }}
            >
                <X size={18} />
            </button>

            {/* Hint teclado */}
            <div
                className="fixed top-4 left-4 z-[10001] hidden md:flex items-center gap-2 px-3 py-2 rounded-full bg-black/40 backdrop-blur-md text-white/80 text-[11px] font-bold border border-white/10"
                style={{ animation: 'tourFadeIn 320ms ease-out 200ms both' }}
            >
                <kbd className="px-1.5 py-0.5 rounded bg-white/10">←</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10">→</kbd>
                <span>navegar</span>
                <span className="opacity-40">·</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10">Esc</kbd>
                <span>salir</span>
            </div>

            {/* TOOLTIP CARD */}
            <div
                key={`card-${animKey}`}
                className={`fixed z-[10000] rounded-3xl border shadow-2xl backdrop-blur-2xl overflow-hidden ${cardBase}`}
                style={{
                    left: tipPos.left,
                    top: tipPos.top,
                    width: Math.min(TIP_W, vw - 24),
                    animation: dirRef.current >= 0 ? 'tourCardInRight 460ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'tourCardInLeft 460ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
            >
                {/* Glow superior con color del paso */}
                <div
                    className="absolute -top-20 -left-10 -right-10 h-32 pointer-events-none opacity-40"
                    style={{
                        background: `radial-gradient(ellipse at 50% 100%, ${step.accent}, transparent 70%)`,
                    }}
                />

                {/* Flecha direccional apuntando al target */}
                {rect && tipPos.side !== 'center' && (() => {
                    const baseTri = {
                        position: 'absolute',
                        width: 0, height: 0,
                        pointerEvents: 'none',
                        filter: `drop-shadow(0 2px 6px ${step.accent}88)`,
                    };
                    if (tipPos.side === 'bottom') {
                        // card debajo → flecha arriba
                        const cx = Math.min(Math.max(20, rect.cx - tipPos.left), (tipPos.tipW || TIP_W) - 20);
                        return (
                            <div style={{
                                ...baseTri,
                                top: -10, left: cx - 10,
                                borderLeft: '10px solid transparent',
                                borderRight: '10px solid transparent',
                                borderBottom: `10px solid ${step.accent}`,
                                animation: 'tourArrowBounceY 1.1s ease-in-out infinite',
                            }} />
                        );
                    }
                    if (tipPos.side === 'top') {
                        const cx = Math.min(Math.max(20, rect.cx - tipPos.left), (tipPos.tipW || TIP_W) - 20);
                        return (
                            <div style={{
                                ...baseTri,
                                bottom: -10, left: cx - 10,
                                borderLeft: '10px solid transparent',
                                borderRight: '10px solid transparent',
                                borderTop: `10px solid ${step.accent}`,
                                animation: 'tourArrowBounceYRev 1.1s ease-in-out infinite',
                            }} />
                        );
                    }
                    if (tipPos.side === 'right') {
                        const cy = Math.min(Math.max(20, rect.cy - tipPos.top), (tipPos.tipH || 230) - 20);
                        return (
                            <div style={{
                                ...baseTri,
                                left: -10, top: cy - 10,
                                borderTop: '10px solid transparent',
                                borderBottom: '10px solid transparent',
                                borderRight: `10px solid ${step.accent}`,
                                animation: 'tourArrowBounceX 1.1s ease-in-out infinite',
                            }} />
                        );
                    }
                    // left
                    const cy = Math.min(Math.max(20, rect.cy - tipPos.top), (tipPos.tipH || 230) - 20);
                    return (
                        <div style={{
                            ...baseTri,
                            right: -10, top: cy - 10,
                            borderTop: '10px solid transparent',
                            borderBottom: '10px solid transparent',
                            borderLeft: `10px solid ${step.accent}`,
                            animation: 'tourArrowBounceXRev 1.1s ease-in-out infinite',
                        }} />
                    );
                })()}

                <div className="relative p-5">
                    {/* Header: icono + paso */}
                    <div className="flex items-center gap-3 mb-3">
                        <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                            style={{
                                background: `linear-gradient(135deg, ${step.accent}, ${step.accent}AA)`,
                                boxShadow: `0 8px 24px ${step.accent}55`,
                                animation: 'tourIconPop 520ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                            }}
                        >
                            <StepIcon size={20} className="text-white drop-shadow" />
                        </div>
                        <div className="leading-tight min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-widest opacity-50">
                                Paso {stepIdx + 1} / {total}
                            </div>
                            <div
                                className="text-[18px] font-black tracking-tight leading-tight"
                                style={{ animation: 'tourSlideUp 480ms cubic-bezier(0.34, 1.56, 0.64, 1) 80ms both' }}
                            >
                                {step.title}
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <p
                        className="text-[14px] font-semibold leading-snug opacity-90"
                        style={{ animation: 'tourSlideUp 520ms cubic-bezier(0.34, 1.56, 0.64, 1) 160ms both' }}
                    >
                        {step.body}
                    </p>

                    <StepDemo id={step.id} isDark={isDark} accent={step.accent} />

                    {/* Dots progress (clicables) */}
                    <div
                        className="flex items-center justify-center gap-1.5 mt-4"
                        style={{ animation: 'tourSlideUp 540ms cubic-bezier(0.34, 1.56, 0.64, 1) 240ms both' }}
                    >
                        {STEPS.map((s, i) => {
                            const active = i === stepIdx;
                            const done = i < stepIdx;
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => jumpTo(i)}
                                    aria-label={`Ir al paso ${i + 1}`}
                                    className="group flex items-center justify-center"
                                    style={{ width: 18, height: 14 }}
                                >
                                    <span
                                        className="block rounded-full transition-all"
                                        style={{
                                            width: active ? 20 : done ? 8 : 6,
                                            height: 6,
                                            background: active ? step.accent : (done ? step.accent + '99' : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)')),
                                        }}
                                    />
                                </button>
                            );
                        })}
                    </div>

                    {/* Controls */}
                    <div
                        className="flex items-center justify-between gap-2 mt-4"
                        style={{ animation: 'tourSlideUp 580ms cubic-bezier(0.34, 1.56, 0.64, 1) 320ms both' }}
                    >
                        <button
                            onClick={finish}
                            className="text-xs font-black opacity-50 hover:opacity-100 transition active:scale-95"
                        >
                            Saltar
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={prev}
                                disabled={isFirst}
                                className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-90 transition disabled:opacity-30 disabled:pointer-events-none ${isDark ? 'border-white/10 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-100'}`}
                                aria-label="Anterior"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={next}
                                className="h-10 px-5 rounded-2xl text-white text-sm font-black flex items-center gap-2 active:scale-95 transition shadow-xl"
                                style={{
                                    background: `linear-gradient(135deg, ${step.accent}, ${step.accent}DD)`,
                                    boxShadow: `0 8px 20px ${step.accent}66`,
                                }}
                            >
                                {isLast ? (<><Check size={15} /> Empezar</>) : (<>Siguiente <ChevronRight size={15} /></>)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* CSS animations */}
            <style>{`
                @keyframes tourFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes tourPulse {
                    0%   { transform: scale(1);    opacity: 0.85; }
                    70%  { transform: scale(1.06); opacity: 0; }
                    100% { transform: scale(1.06); opacity: 0; }
                }
                @keyframes tourCardInRight {
                    0%   { opacity: 0; transform: translate(24px, 8px) scale(0.95); filter: blur(6px); }
                    60%  { opacity: 1; filter: blur(0); }
                    100% { opacity: 1; transform: translate(0,0) scale(1); }
                }
                @keyframes tourCardInLeft {
                    0%   { opacity: 0; transform: translate(-24px, 8px) scale(0.95); filter: blur(6px); }
                    60%  { opacity: 1; filter: blur(0); }
                    100% { opacity: 1; transform: translate(0,0) scale(1); }
                }
                @keyframes tourSlideUp {
                    0%   { opacity: 0; transform: translateY(10px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes tourIconPop {
                    0%   { opacity: 0; transform: scale(0.5) rotate(-20deg); }
                    60%  { opacity: 1; transform: scale(1.1) rotate(4deg); }
                    100% { opacity: 1; transform: scale(1) rotate(0deg); }
                }
                @keyframes tourEmojiBounce {
                    0%   { opacity: 0; transform: scale(0.4) translateY(-12px); }
                    50%  { opacity: 1; transform: scale(1.2) translateY(0); }
                    70%  { transform: scale(0.95); }
                    100% { transform: scale(1); }
                }
                @keyframes dashMove {
                    from { stroke-dashoffset: 0; }
                    to   { stroke-dashoffset: -24; }
                }
                @keyframes tourOrnIn {
                    0%   { opacity: 0; transform: scale(0.6); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes tourFloat {
                    0%, 100% { transform: translateY(0); }
                    50%      { transform: translateY(-12px); }
                }
                @keyframes tourTypeText {
                    0%, 5%   { width: 0; }
                    35%, 60% { width: 56px; }
                    95%, 100%{ width: 0; }
                }
                @keyframes tourCaret {
                    0%, 50%   { opacity: 1; }
                    51%, 100% { opacity: 0; }
                }
                @keyframes tourZap {
                    0%, 55%  { opacity: 0.35; transform: scale(1); }
                    60%, 70% { opacity: 1;    transform: scale(1.3); }
                    80%, 100%{ opacity: 0.35; transform: scale(1); }
                }
                @keyframes tourResultIn {
                    0%, 60%   { opacity: 0; transform: translateY(8px) scale(0.96); }
                    72%, 92%  { opacity: 1; transform: translateY(0)   scale(1); }
                    100%      { opacity: 0; transform: translateY(0)   scale(1); }
                }
                @keyframes tourImportChip {
                    0%, 5%    { opacity: 0; transform: translate(-30px, -50%) scale(0.9); }
                    12%, 22%  { opacity: 1; transform: translate(0, -50%) scale(1); }
                    44%       { opacity: 1; transform: translate(190px, -50%) scale(0.85); }
                    50%, 100% { opacity: 0; transform: translate(220px, -50%) scale(0.6); }
                }
                @keyframes tourSpin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
                @keyframes tourTabPulse {
                    0%, 100% { transform: translateY(0) scale(1); filter: brightness(1); }
                    25%      { transform: translateY(-3px) scale(1.08); filter: brightness(1.2); }
                    50%      { transform: translateY(0) scale(1); filter: brightness(1); }
                }
                @keyframes tourDatePill {
                    0%, 4%, 28%, 100% { background: rgba(255,255,255,0.06); transform: scale(1); color: inherit; }
                    8%, 22%           { background: rgba(255,214,10,0.35); transform: scale(1.05); }
                }
                @keyframes tourDateNumFade {
                    0%, 100% { opacity: 0.7; }
                    50%      { opacity: 1; transform: scale(1.05); }
                }
                @keyframes tourDateNav {
                    0%, 100% { transform: translateX(0); opacity: 0.7; }
                    50%      { transform: translateX(-3px); opacity: 1; }
                }
                @keyframes tourDateLabel {
                    0%, 22%   { opacity: 1; transform: translateY(0); }
                    25%, 28%  { opacity: 0; transform: translateY(-4px); }
                    32%, 47%  { opacity: 1; transform: translateY(0); }
                    50%, 53%  { opacity: 0; transform: translateY(-4px); }
                    57%, 72%  { opacity: 1; transform: translateY(0); }
                    75%, 78%  { opacity: 0; transform: translateY(-4px); }
                    82%, 100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes tourDateBar {
                    0%, 100% { transform: scaleY(1); opacity: 0.85; }
                    50%      { transform: scaleY(0.45); opacity: 0.6; }
                }
                @keyframes tourSettingsClick {
                    0%, 10%   { opacity: 0; transform: translate(20px, -50%) scale(0); }
                    20%       { opacity: 1; transform: translate(-20px, -50%) scale(1); }
                    32%       { opacity: 1; transform: translate(-20px, -50%) scale(0.7); }
                    44%, 100% { opacity: 0; transform: translate(-20px, -50%) scale(0); }
                }
                @keyframes tourSettingsWidgetBg {
                    0%, 30%   { background: #3A3A45; }
                    40%, 95%  { background: #30D158; }
                    100%      { background: #3A3A45; }
                }
                @keyframes tourSettingsWidgetKnob {
                    0%, 30%   { left: 2px; }
                    40%, 95%  { left: 12px; }
                    100%      { left: 2px; }
                }
                @keyframes tourWidgetLift {
                    0%, 100% { transform: translateY(0) scale(1); }
                    40%      { transform: translateY(-6px) scale(1.04); }
                    60%      { transform: translateY(-6px) scale(1.04); }
                }
                @keyframes tourFixedDot {
                    0%, 100% { transform: scale(1);   filter: brightness(1); }
                    50%      { transform: scale(1.4); filter: brightness(1.4); }
                }
                @keyframes tourFixedTotal {
                    0%, 100% { opacity: 0.85; }
                    50%      { opacity: 1; transform: scale(1.02); }
                }
                @keyframes tourFixedSubIn {
                    0%, 8%    { opacity: 0; transform: translateX(12px); }
                    18%, 78%  { opacity: 1; transform: translateX(0); }
                    90%, 100% { opacity: 0; transform: translateX(-6px); }
                }
                @keyframes tourSocialPop {
                    0%, 30%   { transform: translateX(-50%) scale(0.85); opacity: 0; }
                    45%, 70%  { transform: translateX(-50%) scale(1.05); opacity: 1; }
                    85%, 100% { transform: translateX(-50%) scale(0.95); opacity: 0; }
                }
                @keyframes tourSocialAvatar {
                    0%, 100% { transform: translateX(-50%) translateY(0); }
                    50%      { transform: translateX(-50%) translateY(-3px); }
                }
                @keyframes tourSocialSplit {
                    0%, 35%   { opacity: 0; transform: translateY(-10px) scale(0.7); }
                    55%, 85%  { opacity: 1; transform: translateY(0) scale(1); }
                    95%, 100% { opacity: 0; transform: translateY(2px) scale(0.95); }
                }
                @keyframes tourArrowFade {
                    0%, 100% { opacity: 0.35; transform: translate(0, -50%); }
                    50%      { opacity: 1;   transform: translate(4px, -50%); }
                }
                @keyframes tourDebtRowIn {
                    0%, 5%    { opacity: 0; transform: translateX(-12px); }
                    20%, 80%  { opacity: 1; transform: translateX(0); }
                    95%, 100% { opacity: 0; transform: translateX(8px); }
                }
                @keyframes tourDebtBalance {
                    0%, 100% { transform: scale(1); }
                    50%      { transform: scale(1.08); text-shadow: 0 0 12px rgba(48,209,88,0.6); }
                }
                @keyframes tourSettingsToggle {
                    0%, 40%   { background: #30D158; }
                    50%, 90%  { background: #3A3A45; }
                    100%      { background: #30D158; }
                }
                @keyframes tourSettingsKnob {
                    0%, 40%   { left: 12px; }
                    50%, 90%  { left: 2px; }
                    100%      { left: 12px; }
                }
                @keyframes tourThemeToggle {
                    0%, 45%   { left: 1px; background: #FFD60A; }
                    55%, 100% { left: 26px; background: #0A84FF; }
                }
                @keyframes tourThemeIcon {
                    0%, 45%   { opacity: 1; }
                    55%, 100% { opacity: 0; }
                }
                @keyframes tourThemeIconRev {
                    0%, 45%   { opacity: 0; }
                    55%, 100% { opacity: 1; }
                }
                @keyframes tourSwatchRing {
                    0%, 100% { box-shadow: 0 0 0 1.5px currentColor, 0 0 0 4px transparent; transform: scale(1); }
                    50%      { box-shadow: 0 0 0 1.5px currentColor, 0 0 0 4px rgba(255,255,255,0.4); transform: scale(1.15); }
                }
                @keyframes tourWelcomeIcon {
                    0%, 100% { transform: translateY(0); }
                    50%      { transform: translateY(-4px); }
                }
                @keyframes tourEndBounce {
                    0%, 100% { transform: translateY(0); opacity: 0.6; }
                    50%      { transform: translateY(4px); opacity: 1; }
                }
                @keyframes tourSwipeRow {
                    0%, 12%   { transform: translateX(0); }
                    40%, 72%  { transform: translateX(-168px); }
                    94%, 100% { transform: translateX(0); }
                }
                @keyframes tourMarkerBob {
                    0%, 100% { transform: translateY(0); }
                    50%      { transform: translateY(-8px); }
                }
                @keyframes tourArrowBounceY {
                    0%, 100% { transform: translateY(0); }
                    50%      { transform: translateY(-5px); }
                }
                @keyframes tourArrowBounceYRev {
                    0%, 100% { transform: translateY(0); }
                    50%      { transform: translateY(5px); }
                }
                @keyframes tourArrowBounceX {
                    0%, 100% { transform: translateX(0); }
                    50%      { transform: translateX(-5px); }
                }
                @keyframes tourArrowBounceXRev {
                    0%, 100% { transform: translateX(0); }
                    50%      { transform: translateX(5px); }
                }
                @keyframes tourSwipeFinger {
                    0%, 8%    { transform: translate(0, -50%) scale(0); opacity: 0; }
                    14%       { transform: translate(0, -50%) scale(1); opacity: 1; }
                    38%       { transform: translate(-168px, -50%) scale(1); opacity: 1; }
                    54%       { transform: translate(-168px, -50%) scale(0.85); opacity: 0.6; }
                    62%, 100% { transform: translate(-168px, -50%) scale(0); opacity: 0; }
                }
            `}</style>
        </div>,
        document.body
    );
};

export default OnboardingTour;
