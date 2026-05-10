import { createContext, useContext, useState, useEffect } from 'react';
import { ACCENT_COLORS } from '../constants/theme';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

const getDisplayName = (user) => {
    if (!user) return null;
    if (user.email) return user.email.split('@')[0];
    return `user_${user.id?.slice(0, 8) ?? ''}`;
};

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [theme, setTheme] = useState(() => localStorage.getItem('alcash_theme') || 'dark');
    const [accent, setAccent] = useState(() => localStorage.getItem('alcash_accent') || 'blue');
    const [privacyMode, setPrivacyMode] = useState(() => localStorage.getItem('alcash_privacy') === 'true');
    const [mode, _setMode] = useState(() => localStorage.getItem('alcash_mode') || 'personal');
    const [activeHouseholdId, _setActiveHouseholdId] = useState(() => localStorage.getItem('alcash_active_household') || null);
    const [authError, setAuthError] = useState('');
    const [authInfo, setAuthInfo] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [geminiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || '');

    // Modo social fuerza color dorado; el accent personal queda guardado y se restaura.
    const effectiveAccent = (mode === 'social' && activeHouseholdId) ? 'gold' : accent;
    const activeColor = ACCENT_COLORS[effectiveAccent] || ACCENT_COLORS['blue'];

    const setMode = (next) => {
        _setMode(next);
        try { localStorage.setItem('alcash_mode', next); } catch {}
    };
    const setActiveHouseholdId = (id) => {
        _setActiveHouseholdId(id);
        try {
            if (id) localStorage.setItem('alcash_active_household', id);
            else localStorage.removeItem('alcash_active_household');
        } catch {}
    };

    // 1. Monitorizar sesión de Supabase
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // 2. Cargar perfil (ya lo crea el trigger handle_new_user en la DB)
    useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (error) throw error;

            if (data?.settings?.theme) setTheme(data.settings.theme);
            if (data?.settings?.accent) setAccent(data.settings.accent);
        } catch (err) {
            console.error("Error al cargar perfil:", err);
        }
    };

    // 3. Sincronizar ajustes con la DB
    useEffect(() => {
        if (user) {
            supabase.from('profiles')
                .update({ settings: { theme, accent } })
                .eq('id', user.id)
                .then();
        }
    }, [theme, accent, user]);

    const THEMES = {
        dark: {
            bg: "bg-[#050505]",
            text: "text-white",
            textSec: "text-gray-500",
            card: "bg-[#0E0E11] border-white/5 backdrop-blur-xl shadow-2xl",
            input: "bg-white/5 border-white/[0.03] focus:bg-white/10 focus:border-blue-500/30",
            nav: "bg-[#0E0E11]/80 border-white/5 backdrop-blur-2xl",
            hover: "hover:bg-white/5",
            success: "text-emerald-400",
            danger: "text-rose-400"
        },
        light: {
            bg: "bg-[#F8FAFC]",
            text: "text-slate-900",
            textSec: "text-slate-500",
            card: "bg-white border-slate-200/60 shadow-xl",
            input: "bg-slate-50 border-slate-200 focus:bg-white focus:ring-4 focus:ring-blue-500/10",
            nav: "bg-white/90 border-slate-200/60 backdrop-blur-xl",
            hover: "hover:bg-slate-50",
            success: "text-emerald-600",
            danger: "text-rose-600"
        }
    };
    const t = THEMES[theme];

    useEffect(() => {
        localStorage.setItem('alcash_theme', theme);
        localStorage.setItem('alcash_accent', accent);
        localStorage.setItem('alcash_privacy', privacyMode);
        document.body.setAttribute('data-theme', theme);
    }, [theme, accent, privacyMode]);

    const login = async (email, password) => {
        setAuthError('');
        setAuthInfo('');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            const msg = error.message === "Invalid login credentials"
                ? "Credenciales incorrectas"
                : error.message === "Email not confirmed"
                    ? "Debes confirmar tu email antes de iniciar sesión"
                    : error.message;
            setAuthError(msg);
            return false;
        }
        return true;
    };

    const register = async (email, password) => {
        setAuthError('');
        setAuthInfo('');
        if (!password || password.length < 8) {
            setAuthError('La contraseña debe tener al menos 8 caracteres.');
            return false;
        }
        const emailRedirectTo = window.location.origin + import.meta.env.BASE_URL;
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
        if (error) {
            setAuthError(error.message);
            return false;
        }
        setIsRegistering(false);
        if (data?.user && !data.session) {
            setAuthInfo('Registro creado. Confirma tu email desde el mensaje que te hemos enviado para poder iniciar sesión.');
        } else {
            setAuthInfo('¡Registro exitoso!');
        }
        return true;
    };

    const requestPasswordReset = async (email) => {
        setAuthError('');
        setAuthInfo('');
        const redirectTo = window.location.origin + import.meta.env.BASE_URL;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) {
            setAuthError(error.message);
            return false;
        }
        setAuthInfo('Te hemos enviado un email con el enlace para restablecer tu contraseña.');
        return true;
    };

    const updatePassword = async (newPassword) => {
        setAuthError('');
        setAuthInfo('');
        if (!newPassword || newPassword.length < 8) {
            setAuthError('La contraseña debe tener al menos 8 caracteres.');
            return false;
        }
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            setAuthError(error.message);
            return false;
        }
        setAuthInfo('Contraseña actualizada correctamente.');
        return true;
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            currentUser: getDisplayName(user),
            user, session, isLoading,
            theme, setTheme, accent, setAccent,
            privacyMode, setPrivacyMode,
            mode, setMode,
            activeHouseholdId, setActiveHouseholdId,
            isSocial: mode === 'social' && !!activeHouseholdId,
            activeColor, t,
            authError, setAuthError,
            authInfo, setAuthInfo,
            isRegistering, setIsRegistering,
            login, register, logout,
            requestPasswordReset, updatePassword,
            geminiKey
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
