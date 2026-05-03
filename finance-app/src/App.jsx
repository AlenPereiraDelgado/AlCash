import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import {
    Plus, TrendingUp, TrendingDown, PieChart, Activity, Trash2,
    Calendar as CalendarIcon, Repeat, Tag, Layers, ChevronLeft,
    ChevronRight, Search, Filter, Download, AlertCircle, CalendarDays,
    CalendarRange, Clock, X, LayoutGrid, List, Sun, Moon, Settings,
    Target, Wallet, ArrowRight, Save, Coins, Globe, Plane, User, LogOut,
    BarChart2, Droplet, Hexagon, Handshake, CheckCircle2, XCircle, Palette,
    Check, Minus, PiggyBank, Timer, Users, Zap, Pencil,
    ShoppingCart, Car, Home, Heart, ShoppingBag, Gift, Coffee, Box, ShieldCheck, Sparkles, Key,
} from 'lucide-react';

import { useAuth } from './contexts/AuthContext';
import { useFinance } from './contexts/FinanceContext';
import { supabase } from './lib/supabaseClient';
import { 
    CATEGORY_COLORS, 
    CATEGORY_ICONS, 
    ACCENT_COLORS
} from './constants/theme';

import { getHue, getBucketIndex, getDynamicFontSize } from './utils/helpers';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import ErrorBoundary from './components/common/ErrorBoundary';

// --- VISTAS CARGADAS BAJO DEMANDA (LAZY LOADING) ---
const DashboardView = React.lazy(() => import('./components/views/DashboardView'));
const TransactionListView = React.lazy(() => import('./components/views/TransactionListView'));
const FixedExpensesView = React.lazy(() => import('./components/views/FixedExpensesView'));
const AnalysisView = React.lazy(() => import('./components/views/AnalysisView'));
const ForecastingView = React.lazy(() => import('./components/views/ForecastingView'));
const GoalsView = React.lazy(() => import('./components/views/GoalsView'));
const DebtsView = React.lazy(() => import('./components/views/DebtsView'));
const SettingsView = React.lazy(() => import('./components/views/SettingsView'));
const JointView = React.lazy(() => import('./components/views/JointView'));

import TransactionModal from './components/modals/TransactionModal';
import AutomationModal from './components/modals/AutomationModal';
import ImportModal from './components/modals/ImportModal';
import BudgetModal from './components/modals/BudgetModal';
import { parseWithGemini } from './services/aiService';
import { ToastContainer } from './components/common/Toast';
import { ProgressBar, CircularProgress } from './components/common/Progress';
import CommandPalette from './components/common/CommandPalette';
import MagicPreviewCard from './components/common/MagicPreviewCard';

// --- COMPONENTES AUXILIARES ---

const Skeleton = ({ className }) => (
    <div className={`animate-pulse bg-gray-500/10 rounded-2xl ${className}`} />
);

const EmptyState = ({ title, description, icon: Icon, action, t }) => (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-in fade-in zoom-in-95 duration-700">
        <div className="w-24 h-24 rounded-[32px] bg-blue-500/10 text-blue-500 flex items-center justify-center mb-6 shadow-inner">
            <Icon size={40} strokeWidth={1.5} />
        </div>
        <h3 className="text-xl font-black mb-2">{title}</h3>
        <p className={`text-sm font-bold max-w-xs mx-auto mb-8 opacity-40`}>{description}</p>
        {action && (
            <button onClick={action} className="px-8 py-4 bg-blue-500 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                EMPEZAR AHORA
            </button>
        )}
    </div>
);


export default function App() {
    // --- ACCESO A CONTEXTOS ---
    const { 
        currentUser, theme, setTheme, accent, setAccent, 
        privacyMode, setPrivacyMode,
        activeColor, t, authError, setAuthError, authInfo, setAuthInfo,
        isRegistering, setIsRegistering,
        login, register, logout, requestPasswordReset, updatePassword,
        isLoading: isAuthLoading, geminiKey
    } = useAuth();

    const [forgotMode, setForgotMode] = useState(false);
    const [recoveryMode, setRecoveryMode] = useState(false);
    const [newPasswordInput, setNewPasswordInput] = useState('');

    useEffect(() => {
        const hash = window.location.hash || '';
        const search = window.location.search || '';
        if (hash.includes('type=recovery') || search.includes('type=recovery')) {
            setRecoveryMode(true);
        }
    }, []);

    const {
        transactions,
        jointTransactions, setJointTransactions,
        goals, setGoals,
        debts,
        categories,
        budgets, setBudgets,
        isDataLoaded, saveStatus,
        addTransaction, updateTransaction, deleteTransaction,
        addGoal, updateGoal,
        addDebt, updateDebt,
        updateCategories, updateGlobalTags,
        travelMode, setTravelMode,
        travelConfig, setTravelConfig,
        recurringRules,
    } = useFinance();

    // --- ESTADOS LOCALES (UI & FORMS) ---
    const [authInput, setAuthInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [isScrolled, setIsScrolled] = useState(false);
    const [isLocalLoading, setIsLocalLoading] = useState(false);
    
    // --- CAPA DE SEGURIDAD GLOBAL ---
    const [isGateUnlocked, setIsGateUnlocked] = useState(() => sessionStorage.getItem('alcash_gate') === 'unlocked');
    const [gatePassword, setGatePassword] = useState('');
    const [gateError, setGateError] = useState(false);

    const handleUnlockGate = (e) => {
        e.preventDefault();
        // ESTA ES TU CONTRASEÑA MAESTRA
        if (gatePassword === 'ALCASH-SECURE-VAULT-2024-XP-9@!') {
            setIsGateUnlocked(true);
            sessionStorage.setItem('alcash_gate', 'unlocked');
        } else {
            setGateError(true);
            setTimeout(() => setGateError(false), 500);
        }
    };

    const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });
    const [toasts, setToasts] = useState([]);
    
    const showToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    };
    const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

    const handleAuth = async (e) => {
        e.preventDefault();
        setIsLocalLoading(true);

        if (recoveryMode) {
            const ok = await updatePassword(newPasswordInput);
            if (ok) {
                setRecoveryMode(false);
                setNewPasswordInput('');
                window.history.replaceState(null, '', window.location.pathname);
            }
        } else if (forgotMode) {
            const ok = await requestPasswordReset(authInput);
            if (ok) setForgotMode(false);
        } else {
            const success = isRegistering
                ? await register(authInput, passwordInput)
                : await login(authInput, passwordInput);

            if (success && !isRegistering) {
                setAuthInput('');
                setPasswordInput('');
            }
        }
        setIsLocalLoading(false);
    };

    const handleLogout = () => {
        logout();
        setAuthInput('');
        setPasswordInput('');
    };

    // ESCUCHADOR DE SCROLL PARA EFECTOS UI
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // ATAJOS DE TECLADO
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            const key = e.key.toLowerCase();
            
            // Cmd + K or Ctrl + K for Command Palette
            if ((e.metaKey || e.ctrlKey) && key === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen(prev => !prev);
            }

            if (key === 'n') { e.preventDefault(); setIsModalOpen(true); }
            if (key === 'd') setView('dashboard');
            if (key === 'l' || key === 'm') setView('list');
            if (key === 'a') setView('analysis');
            if (key === 'p') setView('forecasting');
            if (key === 's') setView('settings');
            if (key === 'escape') {
                setIsModalOpen(false);
                setIsCommandPaletteOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);





    const [view, setView] = useState('dashboard');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [isAutomationModalOpen, setIsAutomationModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [pendingImports, setPendingImports] = useState([]);
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
    const [pendingMagicTx, setPendingMagicTx] = useState(null);
    const [isMagicLoading, setIsMagicLoading] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());

    // --- ESTADOS NAVEGACIÓN ---
    const [dateMode, setDateMode] = useState('month');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('Todas');
    const [filterPeriodicity, setFilterPeriodicity] = useState('Todas');
    const [filterTag, setFilterTag] = useState('Todas');
    const [selectedChartYear, setSelectedChartYear] = useState(new Date().getFullYear());
    const [selectedJointChartYear, setSelectedJointChartYear] = useState(new Date().getFullYear());
    const [fixedViewMode, setFixedViewMode] = useState('month');


    // --- FORM STATE ---
    const [amount, setAmount] = useState('');
    const [hoveredMonth, setHoveredMonth] = useState(null);
    const [currency, setCurrency] = useState('EUR');
    const [exchangeRate, setExchangeRate] = useState(1);
    const [type, setType] = useState('expense');
    const [category, setCategory] = useState('');
    const [subCategory, setSubCategory] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState('');
    const [tags, setTags] = useState([]);
    const [editingId, setEditingId] = useState(null); // Nuevo estado para controlar la edición

    // --- STATE PARA INPUTS DE METAS ---
    const [goalInputs, setGoalInputs] = useState({});

    // --- LOGIC ---

    useEffect(() => {
        document.body.style.overflow = isModalOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isModalOpen]);

    useEffect(() => {
        if (isModalOpen) {
            if (!editingId) { // Solo resetear si es nuevo movimiento
                if (travelMode) {
                    setCurrency(travelConfig.currency);
                    setExchangeRate(travelConfig.rate);
                } else {
                    setCurrency('EUR');
                    setExchangeRate(1);
                }
            }
        }
    }, [isModalOpen, travelMode]);

    // EFECTO DE DIVISAS EN TIEMPO REAL
    useEffect(() => {
        if (currency !== 'EUR' && isModalOpen) {
            fetch(`https://api.frankfurter.app/latest?from=${currency}&to=EUR`)
                .then(res => res.json())
                .then(data => {
                    if (data.rates && data.rates.EUR) {
                        setExchangeRate(data.rates.EUR);
                        showToast(`Tipo de cambio actualizado: 1 ${currency} = ${data.rates.EUR.toFixed(4)}€`, 'info');
                    }
                })
                .catch(() => showToast("No se pudo obtener el cambio real, usa el manual", 'warning'));
        } else if (currency === 'EUR') {
            setExchangeRate(1);
        }
    }, [currency, isModalOpen]);

    useEffect(() => {
        const cats = categories[type];
        const catKeys = Object.keys(cats);
        if (catKeys.length > 0 && !cats[category]) {
            setCategory(catKeys[0]);
        }
        // Lógica mejorada para mantener subcategoría al editar si es válida
        if (category && cats[category] && cats[category].length > 0) {
            if (!cats[category].includes(subCategory)) {
                setSubCategory(cats[category][0]);
            }
        } else {
            setSubCategory('');
        }
    }, [type, category, categories]);


    const handleNavigate = (offset) => {
        const newDate = new Date(currentDate);
        if (dateMode === 'day') newDate.setDate(newDate.getDate() + offset);
        else if (dateMode === 'month') newDate.setMonth(newDate.getMonth() + offset);
        else if (dateMode === 'year') newDate.setFullYear(newDate.getFullYear() + offset);
        setCurrentDate(newDate);
    };

    const getDateLabel = () => {
        if (dateMode === 'day') return currentDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' });
        if (dateMode === 'month') return currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        if (dateMode === 'year') return currentDate.getFullYear().toString();
        if (dateMode === 'range') return dateRange.start ? `${new Date(dateRange.start).toLocaleDateString()} - ...` : 'Rango';
        return '';
    };

    const filterData = (dataList) => {
        return dataList.filter(tx => {
            const tDate = new Date(tx.date + 'T12:00:00'); // Forza mediodía para evitar problemas de zona horaria
            let matchesDate = false;

            if (dateMode === 'day') {
                const cDate = new Date(currentDate);
                matchesDate = tDate.getFullYear() === cDate.getFullYear() &&
                    tDate.getMonth() === cDate.getMonth() &&
                    tDate.getDate() === cDate.getDate();
            }
            else if (dateMode === 'month') matchesDate = tDate.getMonth() === currentDate.getMonth() && tDate.getFullYear() === currentDate.getFullYear();
            else if (dateMode === 'year') matchesDate = tDate.getFullYear() === currentDate.getFullYear();
            else if (dateMode === 'range' && dateRange.start) {
                const start = new Date(dateRange.start + 'T00:00:00');
                const end = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : new Date();
                matchesDate = tDate >= start && tDate <= end;
            } else matchesDate = true;

            const term = (searchTerm || '').toLowerCase().trim();
            const searchParts = term.split(/\s+/);
            const searchableText = `${tx.note || ''} ${tx.category || ''} ${tx.subCategory || ''}`.toLowerCase();
            const matchesSearch = !term || searchParts.every(part => searchableText.includes(part));

            if (view === 'joint') return matchesDate && matchesSearch;

            if (view === 'list') {
                const matchesCategory = filterCategory === 'Todas' || tx.category === filterCategory;
                const matchesPeriodicity = filterPeriodicity === 'Todas' ||
                    (filterPeriodicity === 'Puntual' && !tx.periodicity) ||
                    tx.periodicity === filterPeriodicity.toLowerCase();
                const matchesTag = filterTag === 'Todas' || (tx.tags && tx.tags.includes(filterTag));

                return matchesDate && matchesSearch && matchesCategory && matchesPeriodicity && matchesTag;
            }
            return matchesDate && matchesSearch;
        });
    };

    const personalTransactions = useMemo(() => {
        const jointIds = new Set(jointTransactions.map(t => t.id));
        return transactions.filter(t => !jointIds.has(t.id));
    }, [transactions, jointTransactions]);

    const filteredTransactions = useMemo(() => filterData(personalTransactions), [personalTransactions, currentDate, dateMode, dateRange, view, searchTerm, filterCategory, filterPeriodicity, filterTag]);
    const filteredJointTransactions = useMemo(() => filterData(jointTransactions), [jointTransactions, currentDate, dateMode, dateRange, view]);

    const calculateStats = (dataList) => {
        const income = dataList.filter(t => t.type === 'income').reduce((a, b) => a + (b.amountVal || 0), 0);
        const expense = dataList.filter(t => t.type === 'expense').reduce((a, b) => a + (b.amountVal || 0), 0);
        return { income, expense, balance: income - expense };
    };

    const stats = useMemo(() => calculateStats(filteredTransactions), [filteredTransactions]);
    const jointStats = useMemo(() => calculateStats(filteredJointTransactions), [filteredJointTransactions]);

    const chartData = useMemo(() => {
        const result = [];
        for (let m = 0; m < 12; m++) {
            const d = new Date(selectedChartYear, m, 1);
            const mTrans = personalTransactions.filter(t => {
                const td = new Date(t.date);
                return td.getMonth() === m && td.getFullYear() === selectedChartYear;
            });
            result.push({
                label: d.toLocaleString('es-ES', { month: 'short' }).toUpperCase(),
                income: mTrans.filter(t => t.type === 'income').reduce((a, b) => a + (b.amountVal || 0), 0),
                expense: mTrans.filter(t => t.type === 'expense').reduce((a, b) => a + (b.amountVal || 0), 0)
            });
        }
        return result;
    }, [transactions, selectedChartYear]);

    const jointChartData = useMemo(() => {
        const result = [];
        for (let m = 0; m < 12; m++) {
            const d = new Date(selectedJointChartYear, m, 1);
            const mTrans = jointTransactions.filter(t => {
                const td = new Date(t.date);
                return td.getMonth() === m && td.getFullYear() === selectedJointChartYear;
            });
            result.push({
                label: d.toLocaleString('es-ES', { month: 'short' }).toUpperCase(),
                income: mTrans.filter(t => t.type === 'income').reduce((a, b) => a + (b.amountVal || 0), 0),
                expense: mTrans.filter(t => t.type === 'expense').reduce((a, b) => a + (b.amountVal || 0), 0)
            });
        }
        return result;
    }, [jointTransactions, selectedJointChartYear]);

    // GASTOS FIJOS
    const fixedExpenses = useMemo(() => {
        return recurringRules
            .filter(r => r.active && r.type === 'expense' && (r.unit === 'month' || r.unit === 'year' || r.unit === 'week'))
            .map(r => ({
                id: r.id,
                type: r.type,
                category: r.category,
                subCategory: r.subCategory || '',
                note: r.name || '',
                amountVal: r.amount,
                date: r.nextRun,
                periodicity: r.unit === 'month' ? 'mensual' : r.unit === 'year' ? 'anual' : 'semanal',
                every: r.every,
            }));
    }, [recurringRules]);

    const pagadoFijoEsteMes = useMemo(() => {
        const now = new Date();
        const curMonth = now.getMonth();
        const curYear = now.getFullYear();
        // Sumar transacciones de este mes que sean "fijas" (periodicity != puntual)
        return personalTransactions
            .filter(t => t.type === 'expense' && t.periodicity && t.periodicity !== 'puntual')
            .filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === curMonth && d.getFullYear() === curYear;
            })
            .reduce((acc, curr) => acc + curr.amountVal, 0);
    }, [personalTransactions]);

    const prorrateoMensual = useMemo(() => {
        return fixedExpenses
            .filter(t => t.type === 'expense')
            .reduce((acc, curr) => {
                const amt = Number(curr.amountVal) || 0;
                if (curr.periodicity === 'mensual') {
                    acc.total += amt;
                    acc.monthly += amt;
                } else if (curr.periodicity === 'semanal') {
                    acc.total += (amt * 52 / 12);
                    acc.weekly += (amt * 52 / 12);
                } else if (curr.periodicity === 'anual') {
                    acc.total += (amt / 12);
                    acc.annual += (amt / 12);
                }
                return acc;
            }, { total: 0, monthly: 0, weekly: 0, annual: 0 });
    }, [fixedExpenses]);

    const monthlyFixedBreakdown = useMemo(() => {
        const breakdown = Array(12).fill(0).map(() => ({ total: 0, specials: [], details: [] }));
        fixedExpenses.filter(t => t.type === 'expense').forEach(expense => {
            const expenseDate = new Date(expense.date);
            const expenseMonth = expenseDate.getMonth();
            const amt = Number(expense.amountVal) || 0;
            const detail = { name: expense.note || expense.subCategory || expense.category, amount: amt };

            if (expense.periodicity === 'mensual') {
                for (let i = 0; i < 12; i++) {
                    breakdown[i].total += amt;
                    breakdown[i].details.push(detail);
                }
            } else if (expense.periodicity === 'anual') {
                breakdown[expenseMonth].total += amt;
                breakdown[expenseMonth].specials.push(expense);
                breakdown[expenseMonth].details.push(detail);
            } else if (expense.periodicity === 'bianual') {
                breakdown[expenseMonth].total += amt;
                breakdown[expenseMonth].specials.push(expense);
                breakdown[expenseMonth].details.push(detail);
                const secondMonth = (expenseMonth + 6) % 12;
                breakdown[secondMonth].total += amt;
                breakdown[secondMonth].specials.push({ ...expense, isSecondPayment: true });
                breakdown[secondMonth].details.push(detail);
            }
        });
        return breakdown;
    }, [fixedExpenses]);

    const [analysisDate, setAnalysisDate] = useState(new Date());
    const [analysisType, setAnalysisType] = useState('month'); // 'month' | 'year'
    const [expandedAnalysisCategory, setExpandedAnalysisCategory] = useState(null);

    // Reset expanded category on navigation change
    useEffect(() => {
        setExpandedAnalysisCategory(null);
    }, [view, analysisDate, analysisType]);

    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            if (window.visualViewport) {
                setIsKeyboardOpen(window.visualViewport.height < window.innerHeight * 0.85);
            }
        };
        window.visualViewport?.addEventListener('resize', handleResize);
        return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }, []);

    // HELPER PARA LIMPIAR FORMULARIO
    const resetForm = () => {
        setAmount('');
        setNote('');
        setTags([]);
        setEditingId(null);
        setCurrency('EUR');
        setExchangeRate(1);
        setDate(new Date().toISOString().split('T')[0]);
        // No reseteamos type para que sea más fluido si metes varios gastos
    };

    const openNewModal = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const handleEdit = (tx) => {
        setEditingId(tx.id);
        setAmount(tx.originalAmount);
        setCurrency(tx.originalCurrency || 'EUR');

        // Calcular exchange rate aproximado si no es EUR
        if (tx.originalCurrency && tx.originalCurrency !== 'EUR') {
            setExchangeRate(tx.amountVal ? (tx.originalAmount / tx.amountVal) : 1);
        } else {
            setExchangeRate(1);
        }

        setType(tx.type);
        // IMPORTANTE: Primero la categoría para que el useEffect de subcategorías sepa qué cargar
        setCategory(tx.category);
        // Esperamos que el useEffect se encargue de validar o usamos setTimeout/logic directa, 
        // pero al setear ambos aquí, React debería reconciliar.
        setSubCategory(tx.subCategory);

        setDate(tx.date);
        setNote(tx.note);
        setTags(tx.tags || []);
        setIsModalOpen(true);
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!amount) return;
        const valInEur = parseFloat(amount) / parseFloat(exchangeRate);

        const payload = {
            amountVal: currency === 'EUR' ? parseFloat(amount) : valInEur,
            originalAmount: parseFloat(amount),
            originalCurrency: currency,
            type, category, subCategory, date, note, tags,
            periodicity: 'puntual',
            is_joint: view === 'joint'
        };

        if (editingId) {
            await updateTransaction(editingId, payload);
        } else {
            await addTransaction(payload);
        }

        setIsModalOpen(false);
        resetForm();
    };

    const handleAddGoal = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newGoal = {
            name: formData.get('goalName'),
            target: parseFloat(formData.get('goalTarget')),
            deadline: formData.get('goalDate'),
            current: 0
        };
        await addGoal(newGoal);
        e.target.reset();
    };

    // NUEVA FUNCIÓN: GESTIÓN DE DEUDAS
    const handleAddDebt = async (e) => {
        e.preventDefault();
        const newDebt = {
            person: e.target.person.value,
            amount: parseFloat(e.target.amount.value),
            type: e.target.type.value,
            note: e.target.note.value,
            paid: false,
        };
        await addDebt(newDebt);
        e.target.reset();
    };

    const toggleDebtPaid = async (id) => {
        const debt = debts.find(d => d.id === id);
        if (debt) await updateDebt(id, { paid: !debt.paid });
    };

    const exportToExcel = () => {
        const rows = filteredTransactions.map(tx => ({
            "Fecha": tx.date,
            "Tipo": tx.type === 'income' ? 'Ingreso' : 'Gasto',
            "Categoría": tx.category,
            "Subcategoría": tx.subCategory || '-',
            "Importe (EUR)": tx.amountVal,
            "Moneda Original": tx.originalCurrency || 'EUR',
            "Nota": tx.note || '-',
            "Periodicidad": tx.periodicity || 'puntual'
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
        XLSX.writeFile(wb, `AlCash_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast("Archivo Excel generado con éxito");
    };

    // --- LÓGICA DE PROYECCIÓN Y ANÁLISIS ---
    const topExpenses = useMemo(() => {
        return [...filteredTransactions]
            .filter(t => t.type === 'expense')
            .sort((a, b) => b.amountVal - a.amountVal)
            .slice(0, 3);
    }, [filteredTransactions]);

    // --- LÓGICA PROFESIONAL DE SALUD FINANCIERA ---
    const savingsRate = useMemo(() => {
        if (stats.income <= 0) return 0;
        return ((stats.income - stats.expense) / stats.income) * 100;
    }, [stats]);

    const totalAccumulatedBalance = useMemo(() => {
        return transactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amountVal : -t.amountVal), 0);
    }, [transactions]);

    const emergencyFundMonths = useMemo(() => {
        // Obtenemos la media de gastos de los últimos 6 meses (o los que haya)
        const allExpenses = transactions.filter(t => t.type === 'expense');
        const monthsCount = new Set(allExpenses.map(t => t.date.substring(0, 7))).size || 1;
        const avgMonthlyExpense = allExpenses.reduce((acc, t) => acc + t.amountVal, 0) / monthsCount;
        if (avgMonthlyExpense <= 0) return 0;
        return totalAccumulatedBalance / avgMonthlyExpense;
    }, [transactions, totalAccumulatedBalance]);

    const netWorth = useMemo(() => {
        const totalDebt = debts.filter(d => !d.paid).reduce((acc, d) => acc + Number(d.amount), 0);
        return totalAccumulatedBalance - totalDebt;
    }, [totalAccumulatedBalance, debts]);

    // --- LÓGICA DE IMPORTACIÓN INTELIGENTE ---
    const guessCategory = (note) => {
        const text = note.toUpperCase();
        if (text.includes('MERCADONA') || text.includes('CARREFOUR') || text.includes('LIDL') || text.includes('ALDI') || text.includes('DIA ') || text.includes('REST') || text.includes('GLOVO')) return 'Alimentación';
        if (text.includes('GASO') || text.includes('REPSOL') || text.includes('CEPSA') || text.includes('UBER') || text.includes('CABIFY') || text.includes('TICKET') || text.includes('BUS')) return 'Transporte';
        if (text.includes('NETFLIX') || text.includes('SPOTIFY') || text.includes('AMAZON PRIME') || text.includes('GYM') || text.includes('GIMNASIO')) return 'Suscripciones';
        if (text.includes('ALQUILER') || text.includes('LUZ') || text.includes('AGUA') || text.includes('IBERDROLA') || text.includes('ENDESA') || text.includes('VODAFONE') || text.includes('MOVISTAR')) return 'Hogar';
        if (text.includes('FARMACIA') || text.includes('MEDICO') || text.includes('SEGURO')) return 'Salud';
        if (text.includes('NOMINA') || text.includes('SALARIO') || text.includes('TRANSFERENCIA')) return 'Salario';
        if (text.includes('AMAZON') || text.includes('ZARA') || text.includes('STRADIVARIUS') || text.includes('COMPRA')) return 'Compras';
        if (text.includes('CINE') || text.includes('PELICULA') || text.includes('CONCIERTO') || text.includes('BAR') || text.includes('COPA') || text.includes('PIZZA') || text.includes('BURGER') || text.includes('CENA')) return 'Ocio';
        if (text.includes('HOTEL') || text.includes('VUELO') || text.includes('AVION') || text.includes('VIAJE')) return 'Viajes';
        return 'Otros';
    };

    const runSmartAnalysis = (text) => {
        if (!text || text.trim().length < 5) {
            showToast("El texto parece estar vacío o ser demasiado corto", 'error');
            return;
        }

        const lines = text.split('\n');
        const detected = [];
        const monthNames = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
        
        lines.forEach(line => {
            const cleanLine = line.trim();
            if (cleanLine.length < 5) return;
            
            // 1. Detect Amount (Handle cases like -1.234,56 or 1234.56 or even 45,20-)
            let amountVal = null;
            let type = 'expense';
            
            const amountMatch = cleanLine.match(/(-?\d+([.,]\d{3})*[.,]\d{2})|(\d+[.,]\d{2}-?)/g);
            if (amountMatch) {
                // Get the last match usually represents the transaction amount in bank rows
                let rawAmount = amountMatch[amountMatch.length - 1];
                
                // Check if sign is at the end (some PDFs do this: 45,20-)
                if (rawAmount.endsWith('-')) {
                    rawAmount = '-' + rawAmount.slice(0, -1);
                }
                
                amountVal = parseFloat(rawAmount.replace(/\./g, '').replace(',', '.'));
                if (amountVal > 0 && !cleanLine.includes(' -') && !rawAmount.startsWith('-')) {
                    type = 'income';
                }
                amountVal = Math.abs(amountVal);
            }

            if (!amountVal || isNaN(amountVal)) return;

            // 2. Detect Date
            let dateStr = new Date().toISOString().split('T')[0];
            
            // Standard numeric formats: DD/MM/YYYY, DD.MM.YY
            const numericDateMatch = cleanLine.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
            if (numericDateMatch) {
                const [full, d, m, y] = numericDateMatch;
                const year = y.length === 2 ? `20${y}` : y;
                dateStr = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            } else {
                // Alpha formats: 12 ENE, 15 MAY 2024
                const alphaDateMatch = cleanLine.match(/(\d{1,2})\s+([A-Z]{3})/i);
                if (alphaDateMatch) {
                    const [full, d, mName] = alphaDateMatch;
                    const mIdx = monthNames.findIndex(m => mName.toUpperCase().includes(m)) + 1;
                    if (mIdx > 0) {
                        dateStr = `${new Date().getFullYear()}-${mIdx.toString().padStart(2, '0')}-${d.padStart(2, '0')}`;
                    }
                }
            }

            // 3. Extract Note (Strip date and amount)
            let note = cleanLine
                .replace(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/g, '')
                .replace(amountMatch[amountMatch.length - 1], '')
                .replace(/[€$]/g, '')
                .replace(/\s\s+/g, ' ')
                .trim();
            
            if (note.length < 3) note = "Movimiento Detectado";
            else note = note.charAt(0).toUpperCase() + note.slice(1).toLowerCase();

            detected.push({
                id: crypto.randomUUID(),
                date: dateStr,
                amountVal: amountVal,
                type: type,
                category: guessCategory(note),
                subCategory: '',
                note: note,
                status: 'pending'
            });
        });
        
        if (detected.length > 0) {
            setPendingImports(prev => [...prev, ...detected]);
            showToast(`He detectado ${detected.length} movimientos posibles.`, 'success');
        } else {
            showToast("No he podido identificar movimientos. Prueba a copiar una tabla completa del banco.", 'error');
        }
    };

    const handleMagicParse = async (text) => {
        setIsMagicLoading(true);
        
        try {
            if (geminiKey) {
                // MODO IA REAL (Gemini)
                const parsed = await parseWithGemini(text, categories, geminiKey);
                setPendingMagicTx({
                    ...parsed,
                    id: crypto.randomUUID(),
                    subCategory: ''
                });
            } else {
                throw new Error("USE_LOCAL");
            }
        } catch (error) {
            // MODO LOCAL (Fallback si no hay API Key o falla)
            const cleanText = text.toLowerCase();
            let amountVal = 0;
            let type = 'expense';
            let date = new Date().toISOString().split('T')[0];
            let note = text;

            const amountMatches = cleanText.match(/\d+([.,]\d{1,2})?/g);
            if (amountMatches) amountVal = parseFloat(amountMatches[0].replace(',', '.'));

            if (cleanText.includes('ayer')) {
                const d = new Date(); d.setDate(d.getDate() - 1);
                date = d.toISOString().split('T')[0];
            }

            if (cleanText.includes('nomina') || cleanText.includes('ingreso')) type = 'income';

            note = text.replace(/\d+([.,]\d{1,2})?/g, '').replace(/€|euros/gi, '').replace(/ayer|hoy/gi, '').trim();
            if (note.length < 2) note = "Gasto detectado";
            
            setPendingMagicTx({
                id: crypto.randomUUID(),
                amountVal,
                date,
                type,
                category: guessCategory(note),
                note: note.charAt(0).toUpperCase() + note.slice(1),
                subCategory: ''
            });
        } finally {
            setIsMagicLoading(false);
        }
    };

    const handleAcceptMagicTx = async () => {
        const { id, ...txData } = pendingMagicTx;
        await addTransaction({ ...txData, tags: txData.tags || [], is_joint: false });
        setPendingMagicTx(null);
        showToast("¡Movimiento añadido mágicamente!", 'success');
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            runSmartAnalysis(evt.target.result);
        };
        reader.readAsText(file);
    };

    // 1. Capa de Seguridad Global (Muro)
    if (!isGateUnlocked) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
                <div className={`w-full max-w-sm p-10 rounded-[40px] border border-white/5 bg-[#0E0E11] shadow-2xl transition-all ${gateError ? 'animate-shake border-red-500/50' : ''}`}>
                    <div className="bg-blue-500/10 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-8">
                        <Key className="text-blue-500" size={32} />
                    </div>
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-black tracking-tighter mb-2">Acceso Restringido</h2>
                        <p className="text-xs font-black uppercase tracking-widest opacity-40">Introduce la clave maestra</p>
                    </div>
                    <form onSubmit={handleUnlockGate} className="space-y-4">
                        <input 
                            autoFocus
                            type="password" 
                            placeholder="Clave de acceso..."
                            value={gatePassword}
                            onChange={(e) => setGatePassword(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 p-4 rounded-2xl font-black text-center outline-none focus:border-blue-500/50 transition-all"
                        />
                        <button className="w-full bg-blue-500 hover:bg-blue-600 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg shadow-blue-500/20">
                            Desbloquear Bóveda
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // 2. Pantalla de carga (En el sitio correcto tras los hooks)
    if (isAuthLoading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    <p className="font-black text-[10px] tracking-widest opacity-50 uppercase tracking-widest">AlCash</p>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-[#111111] border border-white/5 p-8 rounded-[40px] shadow-2xl">
                    <div className="flex justify-center mb-8">
                        <Activity size={40} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-2">AlCash</h1>
                    <p className="text-gray-500 text-sm mb-6">
                        {recoveryMode ? 'Introduce tu nueva contraseña'
                            : forgotMode ? 'Recupera el acceso a tu cuenta'
                            : isRegistering ? 'Crea tu cuenta segura'
                            : 'Inicia sesión para continuar'}
                    </p>

                    <form onSubmit={handleAuth} className="space-y-4">
                        {!recoveryMode && (
                            <div className="bg-black/50 p-2 rounded-2xl border border-white/10 flex items-center">
                                <div className="ml-3 text-gray-500">📧</div>
                                <input autoFocus type="email" placeholder="Email" value={authInput} onChange={(e) => setAuthInput(e.target.value)} className="bg-transparent w-full p-3 text-white font-bold outline-none" />
                            </div>
                        )}
                        {!forgotMode && !recoveryMode && (
                            <div className="bg-black/50 p-2 rounded-2xl border border-white/10 flex items-center">
                                <div className="ml-3 text-gray-500">🔒</div>
                                <input type="password" placeholder="Contraseña (mín. 8 caracteres)" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="bg-transparent w-full p-3 text-white font-bold outline-none" />
                            </div>
                        )}
                        {recoveryMode && (
                            <div className="bg-black/50 p-2 rounded-2xl border border-white/10 flex items-center">
                                <div className="ml-3 text-gray-500">🔒</div>
                                <input autoFocus type="password" placeholder="Nueva contraseña (mín. 8 caracteres)" value={newPasswordInput} onChange={(e) => setNewPasswordInput(e.target.value)} className="bg-transparent w-full p-3 text-white font-bold outline-none" />
                            </div>
                        )}

                        {authError && <p className="text-red-500 text-xs font-bold">{authError}</p>}
                        {authInfo && <p className="text-emerald-400 text-xs font-bold">{authInfo}</p>}

                        <button disabled={isLocalLoading} className={`w-full ${activeColor.bg} ${activeColor.hover} text-white font-black py-4 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50`}>
                            {isLocalLoading
                                ? 'CARGANDO...'
                                : recoveryMode ? 'ACTUALIZAR CONTRASEÑA'
                                : forgotMode ? 'ENVIAR ENLACE'
                                : isRegistering ? 'REGISTRARSE'
                                : 'ENTRAR'}
                        </button>

                        {!recoveryMode && !forgotMode && !isRegistering && (
                            <div className="text-xs text-gray-500 text-center cursor-pointer hover:text-white transition-colors" onClick={() => { setForgotMode(true); setAuthError(''); setAuthInfo(''); }}>
                                ¿Olvidaste tu contraseña?
                            </div>
                        )}

                        {!recoveryMode && (
                            <>
                                <div className="relative my-8">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                                    <div className="relative flex justify-center text-[10px] uppercase font-black"><span className={`px-4 ${t.bg} text-gray-500`}>O continúa con</span></div>
                                </div>

                                <button type="button" onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + import.meta.env.BASE_URL } })} className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all font-bold text-xs uppercase tracking-widest">
                                    <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                                    Continuar con Google
                                </button>

                                <div className="text-xs text-gray-500 mt-8 cursor-pointer hover:text-white transition-colors" onClick={() => { setIsRegistering(!isRegistering); setForgotMode(false); setAuthError(''); setAuthInfo(''); }}>
                                    {forgotMode ? 'Volver al login'
                                        : isRegistering ? '¿Ya tienes cuenta? Inicia sesión'
                                        : '¿No tienes cuenta? Regístrate'}
                                </div>
                            </>
                        )}
                    </form>
                </div>
            </div>
        );
    }



    return (
        <div className={`min-h-screen font-sans transition-colors duration-500 overflow-x-hidden ${t.bg} ${t.text}`}>
            <div className="mesh-bg" />

            {/* SIDEBAR (DESKTOP) */}
            <div className="hidden md:block">
                <Sidebar
                    view={view}
                    setView={setView}
                    theme={theme}
                    t={t}
                    activeColor={activeColor}
                    saveStatus={saveStatus}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    travelMode={travelMode}
                    setTravelMode={setTravelMode}
                    travelConfig={travelConfig}
                    setTravelConfig={setTravelConfig}
                />
            </div>

            {/* BARRA DE NAVEGACIÓN INFERIOR (MOBILE) */}
            <Navbar
                view={view}
                setView={setView}
                activeColor={activeColor}
                theme={theme}
                t={t}
                isScrolled={isScrolled}
                onAdd={openNewModal}
            />

            <main className="md:ml-20 lg:ml-72 transition-all duration-500 min-h-screen">
                <div className={`max-w-7xl mx-auto p-4 md:p-12 lg:p-16 space-y-6 md:space-y-10 ${isKeyboardOpen ? 'pb-10' : 'pb-40'} md:pb-16`}>
                {!isDataLoaded ? (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="flex justify-between items-center">
                            <Skeleton className="h-10 w-48" />
                            <Skeleton className="h-10 w-32" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-[24px] border border-white/[0.02] bg-white/[0.08]" />)}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <Skeleton className="h-[400px] rounded-[32px]" />
                            <Skeleton className="h-[400px] rounded-[32px]" />
                        </div>
                    </div>
                ) : (
                    <>
                        {/* BRANDING MÓVIL (TOP) */}
                        <div className="md:hidden flex items-center justify-between mb-4 px-1">
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-xl ${activeColor.bg} flex items-center justify-center text-white shadow-lg`}>
                                    <Sparkles size={16} />
                                </div>
                                <span className="font-black text-xl tracking-tighter text-gradient">AlCash</span>
                            </div>
                        </div>

                        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black tracking-tight">
                                    {view === 'dashboard' ? 'Panel de Control' : view === 'list' ? 'Movimientos' : view === 'debts' ? 'Gestión de Deudas' : view === 'joint' ? 'Cuenta Conjunta' : view === 'settings' ? 'Configuración' : 'Gestión'}
                                </h2>
                                <p className={`font-bold text-[10px] md:text-xs uppercase tracking-widest mt-1 ${t.textSec}`}>{getDateLabel()}</p>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1">
                                <button onClick={() => setIsImportModalOpen(true)} className={`${theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'} ${t.hover} ${t.text} px-4 py-2.5 rounded-2xl font-bold text-xs shadow-sm transition-all flex items-center gap-2 active:scale-95 border ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'} shrink-0`}>
                                    <Globe size={18} className="text-blue-500" />
                                    <span className="hidden lg:inline">Importar</span>
                                </button>
                                <button onClick={() => setIsAutomationModalOpen(true)} className={`${theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'} ${t.hover} ${t.text} px-4 py-2.5 rounded-2xl font-bold text-xs shadow-sm transition-all flex items-center gap-2 active:scale-95 border ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'} shrink-0`}>
                                    <Zap size={18} className="text-yellow-500" />
                                    <span className="hidden lg:inline">Auto</span>
                                </button>
                                <button onClick={openNewModal} className={`${activeColor.bg} ${activeColor.hover} text-white px-5 py-2.5 rounded-2xl font-bold text-xs shadow-lg transition-all flex items-center gap-2 active:scale-95 shrink-0`}>
                                    <Plus size={18} />
                                    <span>Nuevo</span>
                                </button>
                            </div>
                        </header>

                <ErrorBoundary>
                    <React.Suspense fallback={
                        <div className="space-y-8 animate-in fade-in duration-500">
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-[28px]" />)}
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <Skeleton className="h-[400px] rounded-[32px]" />
                                <Skeleton className="h-[400px] rounded-[32px]" />
                            </div>
                        </div>
                    }>
                        {view === 'dashboard' && (
                            <DashboardView
                                dateMode={dateMode}
                                setDateMode={setDateMode}
                                dateRange={dateRange}
                                setDateRange={setDateRange}
                                isDateMenuOpen={isDateMenuOpen}
                                setIsDateMenuOpen={setIsDateMenuOpen}
                                getDateLabel={getDateLabel}
                                handleNavigate={handleNavigate}
                                stats={stats}
                                jointStats={jointStats}
                                netWorth={netWorth}
                                chartData={chartData}
                                hoveredMonth={hoveredMonth}
                                setHoveredMonth={setHoveredMonth}
                                savingsRate={savingsRate}
                                emergencyFundMonths={emergencyFundMonths}
                                filteredTransactions={filteredTransactions}
                                setIsBudgetModalOpen={setIsBudgetModalOpen}
                                selectedChartYear={selectedChartYear}
                                setSelectedChartYear={setSelectedChartYear}
                                onMagicParse={handleMagicParse}
                                isMagicLoading={isMagicLoading}
                            />
                        )}
                        {view === 'list' && (
                            <TransactionListView
                                dateMode={dateMode}
                                setDateMode={setDateMode}
                                dateRange={dateRange}
                                setDateRange={setDateRange}
                                isDateMenuOpen={isDateMenuOpen}
                                setIsDateMenuOpen={setIsDateMenuOpen}
                                getDateLabel={getDateLabel}
                                handleNavigate={handleNavigate}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                filterCategory={filterCategory}
                                setFilterCategory={setFilterCategory}
                                filterPeriodicity={filterPeriodicity}
                                setFilterPeriodicity={setFilterPeriodicity}
                                filterTag={filterTag}
                                setFilterTag={setFilterTag}
                                exportToExcel={exportToExcel}
                                openNewModal={openNewModal}
                                filteredTransactions={filteredTransactions}
                                handleEdit={handleEdit}
                                setConfirmModal={setConfirmModal}
                            />
                        )}

                        {view === 'fixed' && (
                            <FixedExpensesView
                                prorrateoMensual={prorrateoMensual}
                                pagadoFijoEsteMes={pagadoFijoEsteMes}
                                fixedViewMode={fixedViewMode}
                                setFixedViewMode={setFixedViewMode}
                                fixedExpenses={fixedExpenses}
                                monthlyFixedBreakdown={monthlyFixedBreakdown}
                            />
                        )}

                        {view === 'goals' && (
                            <GoalsView
                                goalInputs={goalInputs}
                                setGoalInputs={setGoalInputs}
                                handleAddGoal={handleAddGoal}
                            />
                        )}

                        {view === 'debts' && <DebtsView />}

                        {view === 'analysis' && (
                            <AnalysisView
                                analysisType={analysisType}
                                setAnalysisType={setAnalysisType}
                                analysisDate={analysisDate}
                                setAnalysisDate={setAnalysisDate}
                                personalTransactions={personalTransactions}
                            />
                        )}
                        {view === 'forecasting' && (
                            <ForecastingView 
                                transactions={personalTransactions}
                                netWorth={netWorth}
                                savingsRate={savingsRate}
                            />
                        )}

                        {view === 'settings' && <SettingsView />}

                        {view === 'joint' && (
                            <JointView
                                jointStats={jointStats}
                                filteredJointTransactions={filteredJointTransactions}
                                handleNavigate={handleNavigate}
                                dateMode={dateMode}
                                setDateMode={setDateMode}
                                getDateLabel={getDateLabel}
                                isDateMenuOpen={isDateMenuOpen}
                                setIsDateMenuOpen={setIsDateMenuOpen}
                                setDateRange={setDateRange}
                                dateRange={dateRange}
                                handleEdit={handleEdit}
                                expandedAnalysisCategory={expandedAnalysisCategory}
                                setExpandedAnalysisCategory={setExpandedAnalysisCategory}
                                getDynamicFontSize={getDynamicFontSize}
                            />
                        )}
                    </React.Suspense>
                </ErrorBoundary>
                </>
            )}
            </div>
        </main>
            <CommandPalette 
                isOpen={isCommandPaletteOpen}
                onClose={() => setIsCommandPaletteOpen(false)}
                setView={setView}
                setPrivacyMode={setPrivacyMode}
                privacyMode={privacyMode}
                setTheme={setTheme}
                theme={theme}
                exportToExcel={exportToExcel}
                transactions={transactions}
                activeColor={activeColor}
                t={t}
            />

                <TransactionModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    editingId={editingId}
                    view={view}
                    type={type}
                    setType={setType}
                    amount={amount}
                    setAmount={setAmount}
                    currency={currency}
                    setCurrency={setCurrency}
                    exchangeRate={exchangeRate}
                    setExchangeRate={setExchangeRate}
                    category={category}
                    setCategory={setCategory}
                    subCategory={subCategory}
                    setSubCategory={setSubCategory}
                    date={date}
                    setDate={setDate}
                    note={note}
                    setNote={setNote}
                    onHandleAdd={handleAdd}
                />

                <AutomationModal
                    isOpen={isAutomationModalOpen}
                    onClose={() => setIsAutomationModalOpen(false)}
                />

                <ImportModal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    importText={importText}
                    setImportText={setImportText}
                    pendingImports={pendingImports}
                    setPendingImports={setPendingImports}
                    onHandleFileUpload={handleFileUpload}
                    onRunSmartAnalysis={runSmartAnalysis}
                    onConfirmAll={async () => {
                        const newTxs = pendingImports.map(({ status, id, ...item }) => ({ ...item, is_joint: false }));
                        await Promise.all(newTxs.map(tx => addTransaction(tx)));
                        setPendingImports([]);
                        setIsImportModalOpen(false);
                        showToast(`${newTxs.length} movimientos añadidos correctamente.`, 'success');
                    }}
                    onConfirmImportItem={async (item) => {
                        const { status, id, ...tx } = item;
                        await addTransaction({ ...tx, is_joint: false });
                        setPendingImports(pendingImports.filter(i => i.id !== item.id));
                    }}
                />

                <BudgetModal
                    isOpen={isBudgetModalOpen}
                    onClose={() => setIsBudgetModalOpen(false)}
                />

                {/* MODAL DE CONFIRMACIÓN (REUSABLE) */}
                {confirmModal.open && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                        <div className={`w-full max-w-sm rounded-[32px] p-8 space-y-6 shadow-2xl border animate-in zoom-in-95 duration-200 text-center ${t.card}`}>
                            <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                                <AlertCircle size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black">{confirmModal.title}</h3>
                                <p className={`text-sm font-bold mt-2 ${t.textSec}`}>{confirmModal.message}</p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, open: false }); }} className="w-full py-4 rounded-2xl bg-red-500 text-white font-black shadow-lg shadow-red-500/30 active:scale-95 transition-all">SÍ, ELIMINAR</button>
                                <button onClick={() => setConfirmModal({ ...confirmModal, open: false })} className={`w-full py-4 rounded-2xl font-black ${t.hover} active:scale-95 transition-all`}>CANCELAR</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* SISTEMA DE NOTIFICACIONES */}
                <ToastContainer toasts={toasts} removeToast={removeToast} />

                {/* MAGIA IA */}
                <MagicPreviewCard 
                    transaction={pendingMagicTx}
                    onAccept={handleAcceptMagicTx}
                    onCancel={() => setPendingMagicTx(null)}
                    onEdit={() => {
                        handleEdit(pendingMagicTx);
                        setPendingMagicTx(null);
                    }}
                />
        </div>
    );
}

