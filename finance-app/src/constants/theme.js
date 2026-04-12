import { 
    Plus, TrendingUp, TrendingDown, PieChart, Activity, Trash2,
    Calendar as CalendarIcon, Repeat, Tag, Layers, ChevronLeft,
    ChevronRight, Search, Filter, Download, AlertCircle, CalendarDays,
    CalendarRange, Clock, X, LayoutGrid, List, Sun, Moon, Settings,
    Target, Wallet, ArrowRight, Save, Coins, Globe, Plane, User, LogOut,
    BarChart2, Droplet, Hexagon, Handshake, CheckCircle2, XCircle, Palette,
    Check, Minus, PiggyBank, Timer, Users, Zap, Pencil,
    ShoppingCart, Car, Home, Heart, ShoppingBag, Gift, Coffee, Box, ShieldCheck,
    Lightbulb, Utensils, Music, Film, HeartPulse, Briefcase, GraduationCap,
    Smartphone, Gamepad2
} from 'lucide-react';

export const ACCENT_COLORS = {
    blue: { name: 'Azul Pro', bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-600', hover: 'hover:bg-blue-700', ring: 'ring-blue-500', hex: '#2563EB' },
    violet: { name: 'Violeta', bg: 'bg-violet-600', text: 'text-violet-600', border: 'border-violet-600', hover: 'hover:bg-violet-700', ring: 'ring-violet-500', hex: '#7C3AED' },
    emerald: { name: 'Esmeralda', bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-600', hover: 'hover:bg-emerald-700', ring: 'ring-emerald-500', hex: '#059669' },
    orange: { name: 'Naranja', bg: 'bg-orange-600', text: 'text-orange-600', border: 'border-orange-600', hover: 'hover:bg-orange-700', ring: 'ring-orange-500', hex: '#EA580C' },
};

export const MODERN_THEMES = {
    dark: {
        bg: 'bg-[#000000]',
        card: 'bg-[#1C1C1E] border-white/5',
        text: 'text-white',
        textSec: 'text-gray-400',
        input: 'bg-[#2C2C2E] border-white/5 text-white placeholder:text-gray-500',
        hover: 'hover:bg-white/5',
        success: 'text-[#30D158]',
        danger: 'text-[#FF453A]',
        warning: 'text-[#FF9F0A]',
        accent: 'text-[#0A84FF]'
    },
    light: {
        bg: 'bg-[#F2F2F7]',
        card: 'bg-white border-gray-200',
        text: 'text-black',
        textSec: 'text-gray-500',
        input: 'bg-gray-100 border-gray-200 text-black placeholder:text-gray-400',
        hover: 'hover:bg-gray-50',
        success: 'text-green-600',
        danger: 'text-red-500',
        warning: 'text-orange-500',
        accent: 'text-blue-600'
    }
};

export const DEFAULT_CATEGORIES = {
    expense: {
        Alimentación: ["Supermercado", "Restaurantes", "Delivery", "Cafetería"],
        Transporte: ["Gasolina", "Transporte Público", "Uber/Taxi", "Mantenimiento Coche"],
        Hogar: ["Alquiler/Hipoteca", "Luz/Agua", "Internet", "Limpieza", "Muebles"],
        Suscripciones: ["Streaming", "Software", "Gimnasio", "Clubes"],
        Salud: ["Farmacia", "Médico", "Seguro", "Dentista"],
        Deportes: ["Equipamiento", "Cuotas", "Eventos"],
        Compras: ["Ropa", "Electrónica", "Regalos", "Cuidado Personal"],
        Educación: ["Cursos", "Libros", "Material"],
        Finanzas: ["Impuestos", "Comisiones", "Préstamos"],
        Otros: ["Varios", "Imprevistos"]
    },
    income: {
        Salario: ["Nómina Principal", "Bonus", "Horas Extra"],
        "Otros ingresos": ["Ventas", "Inversiones", "Regalos", "Freelance"]
    }
};

export const CATEGORY_COLORS = {
    Alimentación: "#FF9F0A", Transporte: "#0A84FF", Hogar: "#5E5CE6",
    Suscripciones: "#BF5AF2", Salud: "#FF375F", Deportes: "#30D158",
    Compras: "#FF453A", Educación: "#FFD60A", Finanzas: "#64D2FF", Otros: "#8E8E93",
    Salario: "#30D158", "Otros ingresos": "#64D2FF"
};

export const CATEGORY_ICONS = {
    'Alimentación': ShoppingCart,
    'Transporte': Car,
    'Suscripciones': Zap,
    'Hogar': Home,
    'Salud': Heart,
    'Compras': ShoppingBag,
    'Salario': Wallet,
    'Otros ingresos': TrendingUp,
    'Inversiones': Activity,
    'Regalos': Gift,
    'Ocio': Coffee,
    'Viajes': Globe,
    'Gym': Activity,
    'Otros': Box
};

export const COLOR_GROUPS = {
    'Compras': 1, 'Salud': 1, 'Alimentación': 2, 'Educación': 2,
    'Deportes': 3, 'Salario': 3,
    'Transporte': 4, 'Finanzas': 4, 'Hogar': 4, 'Suscripciones': 4, 'Otros ingresos': 4,
    'Otros': 5
};
