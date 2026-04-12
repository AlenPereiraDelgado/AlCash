import React, { createContext, useContext, useState, useEffect } from 'react';
import { ACCENT_COLORS } from '../constants/theme';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [theme, setTheme] = useState(() => localStorage.getItem('alcash_theme') || 'dark');
    const [accent, setAccent] = useState(() => localStorage.getItem('alcash_accent') || 'blue');
    const [privacyMode, setPrivacyMode] = useState(() => localStorage.getItem('alcash_privacy') === 'true');
    const [authError, setAuthError] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [geminiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || '');

    const activeColor = ACCENT_COLORS[accent] || ACCENT_COLORS['blue'];
    
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

    // 2. Cargar perfil cuando hay usuario
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
                .single();

            if (data) {
                if (data.settings?.theme) setTheme(data.settings.theme);
                if (data.settings?.accent) setAccent(data.settings.accent);
            } else if (error && error.code === 'PGRST116') {
                // Si no existe, creamos el perfil inicial
                await supabase.from('profiles').insert([{ 
                    id: user.id, 
                    username: user.email.split('@')[0],
                    settings: { theme, accent } 
                }]);
            }
        } catch (err) {
            console.error("Error al cargar perfil:", err);
        }
    };

    // 3. Sincronizar ajustes con la DB
    useEffect(() => {
        if (user) {
            supabase.from('profiles').update({
                settings: { theme, accent }
            }).eq('id', user.id).then();
        }
    }, [theme, accent]);

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
    }, [theme, accent, privacyMode]);

    const login = async (email, password) => {
        setAuthError('');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setAuthError(error.message === "Invalid login credentials" ? "Credenciales incorrectas" : error.message);
            return false;
        }
        return true;
    };

    const register = async (email, password) => {
        setAuthError('');
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
            setAuthError(error.message);
            return false;
        }
        setIsRegistering(false);
        setAuthError('¡Registro exitoso! Confirma tu email si es necesario o inicia sesión.');
        return true;
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            currentUser: user?.email.split('@')[0] || null,
            user, session, isLoading,
            theme, setTheme, accent, setAccent, 
            privacyMode, setPrivacyMode,
            activeColor, t, authError, setAuthError, isRegistering, 
            setIsRegistering, login, register, logout, geminiKey
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
