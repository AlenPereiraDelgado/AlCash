import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { DEFAULT_CATEGORIES } from '../constants/theme';
import { supabase } from '../lib/supabaseClient';

const FinanceContext = createContext();

export const FinanceProvider = ({ children }) => {
    const { user } = useAuth();

    const [transactions, setTransactions] = useState([]);
    const [jointTransactions, setJointTransactions] = useState([]);
    const [goals, setGoals] = useState([]);
    const [debts, setDebts] = useState([]);
    const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
    const [budgets, _setBudgets] = useState({});
    const setBudgets = (val) => {
        _setBudgets(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            try { if (user?.id) localStorage.setItem(`alcash_budgets_${user.id}`, JSON.stringify(next)); } catch {}
            return next;
        });
    };
    const [globalTags, setGlobalTags] = useState([]);
    const [automationItems, setAutomationItems] = useState([]);

    // --- REGLAS RECURRENTES ---
    const calcNextRun = (fromDate, every, unit) => {
        const d = new Date(fromDate + 'T12:00:00');
        if (unit === 'day')   d.setDate(d.getDate() + Number(every));
        if (unit === 'week')  d.setDate(d.getDate() + Number(every) * 7);
        if (unit === 'month') d.setMonth(d.getMonth() + Number(every));
        if (unit === 'year')  d.setFullYear(d.getFullYear() + Number(every));
        return d.toISOString().split('T')[0];
    };

    const [recurringRules, _setRecurringRules] = useState([]);

    const setRecurringRules = (rulesOrFn) => {
        _setRecurringRules(prev => {
            const next = typeof rulesOrFn === 'function' ? rulesOrFn(prev) : rulesOrFn;
            try { if (user?.id) localStorage.setItem(`alcash_rules_${user.id}`, JSON.stringify(next)); } catch {}
            return next;
        });
    };

    const DEFAULT_QUICK_BUTTONS = Array.from({ length: 6 }, (_, i) => ({
        id: i + 1, emoji: '', label: '', type: 'expense', category: '', subCategory: ''
    }));
    const [quickButtons, setQuickButtons] = useState(DEFAULT_QUICK_BUTTONS);
    const [travelMode, setTravelMode] = useState(false);
    const [travelConfig, setTravelConfig] = useState({ currency: 'USD', rate: 1.1 });
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [saveStatus, setSaveStatus] = useState('idle');

    useEffect(() => {
        if (user?.id) {
            try {
                const stored = localStorage.getItem(`alcash_qb_${user.id}`);
                if (stored) setQuickButtons(JSON.parse(stored));
            } catch {}
        }
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;
        try {
            const stored = localStorage.getItem(`alcash_rules_${user.id}`);
            if (stored) _setRecurringRules(JSON.parse(stored));
        } catch {}
        try {
            const stored = localStorage.getItem(`alcash_budgets_${user.id}`);
            if (stored) _setBudgets(JSON.parse(stored));
        } catch {}
    }, [user?.id]);

    const addRecurringRule    = (rule) => setRecurringRules(prev => [...prev, { ...rule, id: crypto.randomUUID() }]);
    const deleteRecurringRule = (id)   => setRecurringRules(prev => prev.filter(r => r.id !== id));
    const updateRecurringRule = (id, updates) => setRecurringRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

    const updateQuickButtons = (newQB) => {
        setQuickButtons(newQB);
        if (user?.id) {
            try { localStorage.setItem(`alcash_qb_${user.id}`, JSON.stringify(newQB)); } catch {}
        }
    };

    // Auto-ejecutar reglas vencidas al cargar datos
    useEffect(() => {
        if (!isDataLoaded || !user?.id || recurringRules.length === 0) return;
        const today = new Date().toISOString().split('T')[0];
        const due = recurringRules.filter(r => r.active && r.nextRun <= today);
        if (!due.length) return;
        const periodFor = (unit) => unit === 'month' ? 'mensual' : unit === 'year' ? 'anual' : 'puntual';
        (async () => {
            const updated = recurringRules.map(rule => ({ ...rule }));
            for (const rule of due) {
                let cur = { ...rule };
                while (cur.nextRun <= today) {
                    await addTransaction({ amountVal: cur.amount, originalAmount: cur.amount, originalCurrency: 'EUR', type: cur.type, category: cur.category, subCategory: cur.subCategory || '', note: cur.name || '', tags: [], periodicity: periodFor(cur.unit), date: cur.nextRun, is_joint: false });
                    cur = { ...cur, lastRun: cur.nextRun, nextRun: calcNextRun(cur.nextRun, cur.every, cur.unit) };
                }
                const idx = updated.findIndex(r => r.id === rule.id);
                if (idx !== -1) updated[idx] = cur;
            }
            setRecurringRules(updated);
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDataLoaded]);

    // 1. CARGA INICIAL
    useEffect(() => {
        if (user) {
            loadInitialData();
        } else {
            resetData();
        }
    }, [user]);

    const loadInitialData = async () => {
        setIsDataLoaded(false);
        try {
            const [transRes, goalsRes, debtsRes, profileRes] = await Promise.all([
                supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
                supabase.from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
                supabase.from('debts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
                supabase.from('profiles').select('categories, global_tags').eq('id', user.id).maybeSingle()
            ]);

            if (transRes.data) {
                setTransactions(transRes.data.filter(t => !t.is_joint));
                setJointTransactions(transRes.data.filter(t => t.is_joint));
            }
            if (goalsRes.data) setGoals(goalsRes.data);
            if (debtsRes.data) setDebts(debtsRes.data);
            if (profileRes.data) {
                if (profileRes.data.categories) {
                    const cats = profileRes.data.categories;
                    const hasExpense = cats.expense && Object.keys(cats.expense).length > 0;
                    const hasIncome = cats.income && Object.keys(cats.income).length > 0;
                    if (hasExpense || hasIncome) setCategories(cats);
                }
                if (profileRes.data.global_tags) setGlobalTags(profileRes.data.global_tags);
            }

            setIsDataLoaded(true);
        } catch (err) {
            console.error("Error al cargar datos:", err);
            setIsDataLoaded(true);
        }
    };

    const resetData = () => {
        setTransactions([]);
        setJointTransactions([]);
        setGoals([]);
        setDebts([]);
        setCategories(DEFAULT_CATEGORIES);
        setGlobalTags([]);
        setIsDataLoaded(false);
    };

    // ---- Transactions ----
    const addTransaction = async (newTrans) => {
        setSaveStatus('saving');
        const transRecord = { ...newTrans, user_id: user.id };
        const { data, error } = await supabase.from('transactions').insert([transRecord]).select();
        if (!error && data) {
            if (newTrans.is_joint) setJointTransactions(prev => [data[0], ...prev]);
            else setTransactions(prev => [data[0], ...prev]);
            setSaveStatus('success');
            return data[0];
        }
        console.error('addTransaction error', error);
        setSaveStatus('error');
        return null;
    };

    const updateTransaction = async (id, updates) => {
        setSaveStatus('saving');
        const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select();
        if (!error && data) {
            setTransactions(prev => prev.map(t => t.id === id ? data[0] : t));
            setJointTransactions(prev => prev.map(t => t.id === id ? data[0] : t));
            setSaveStatus('success');
            return true;
        }
        console.error('updateTransaction error', error);
        setSaveStatus('error');
        return false;
    };

    const deleteTransaction = async (id, isJoint) => {
        setSaveStatus('saving');
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (!error) {
            if (isJoint) setJointTransactions(prev => prev.filter(t => t.id !== id));
            else setTransactions(prev => prev.filter(t => t.id !== id));
            setSaveStatus('success');
            return true;
        }
        console.error('deleteTransaction error', error);
        setSaveStatus('error');
        return false;
    };

    // ---- Goals ----
    const addGoal = async (goal) => {
        const { data, error } = await supabase.from('goals').insert([{ ...goal, user_id: user.id }]).select();
        if (!error && data) setGoals(prev => [...prev, data[0]]);
        else console.error('addGoal error', error);
        return data?.[0] ?? null;
    };

    const updateGoal = async (id, updates) => {
        const { data, error } = await supabase.from('goals').update(updates).eq('id', id).select();
        if (!error && data) setGoals(prev => prev.map(g => g.id === id ? data[0] : g));
        else console.error('updateGoal error', error);
    };

    const deleteGoal = async (id) => {
        const { error } = await supabase.from('goals').delete().eq('id', id);
        if (!error) setGoals(prev => prev.filter(g => g.id !== id));
        else console.error('deleteGoal error', error);
    };

    // ---- Debts ----
    const addDebt = async (debt) => {
        const payload = { ...debt, user_id: user.id };
        delete payload.id;
        delete payload.date;
        const { data, error } = await supabase.from('debts').insert([payload]).select();
        if (!error && data) setDebts(prev => [data[0], ...prev]);
        else console.error('addDebt error', error);
        return data?.[0] ?? null;
    };

    const updateDebt = async (id, updates) => {
        const { data, error } = await supabase.from('debts').update(updates).eq('id', id).select();
        if (!error && data) setDebts(prev => prev.map(d => d.id === id ? data[0] : d));
        else console.error('updateDebt error', error);
    };

    const deleteDebt = async (id) => {
        const { error } = await supabase.from('debts').delete().eq('id', id);
        if (!error) setDebts(prev => prev.filter(d => d.id !== id));
        else console.error('deleteDebt error', error);
    };

    // ---- Profile / settings ----
    const updateCategories = async (newCats) => {
        setCategories(newCats);
        const { error } = await supabase.from('profiles').update({ categories: newCats }).eq('id', user.id);
        if (error) console.error('updateCategories error', error);
    };

    const addCustomCategory = async (type, name) => {
        if (!name) return;
        await updateCategories({ ...categories, [type]: { ...categories[type], [name]: [] } });
    };

    const deleteCustomCategory = async (type, catName) => {
        const newSection = { ...categories[type] };
        delete newSection[catName];
        await updateCategories({ ...categories, [type]: newSection });
    };

    const moveCategory = async (type, catName, direction) => {
        const keys = Object.keys(categories[type]);
        const index = keys.indexOf(catName);
        if (index === -1) return;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= keys.length) return;
        const newKeys = [...keys];
        [newKeys[index], newKeys[newIndex]] = [newKeys[newIndex], newKeys[index]];
        const newSection = {};
        newKeys.forEach(k => { newSection[k] = categories[type][k]; });
        await updateCategories({ ...categories, [type]: newSection });
    };

    const addSubCategory = async (type, cat, sub) => {
        if (!sub) return;
        const newSection = { ...categories[type], [cat]: [...(categories[type][cat] || []), sub] };
        await updateCategories({ ...categories, [type]: newSection });
    };

    const updateGlobalTags = async (newTags) => {
        setGlobalTags(newTags);
        const { error } = await supabase.from('profiles').update({ global_tags: newTags }).eq('id', user.id);
        if (error) console.error('updateGlobalTags error', error);
    };

    return (
        <FinanceContext.Provider value={{
            transactions, setTransactions,
            jointTransactions, setJointTransactions,
            goals, setGoals,
            debts, setDebts,
            categories, setCategories,
            budgets, setBudgets,
            isDataLoaded, saveStatus,
            addTransaction, updateTransaction, deleteTransaction,
            addGoal, updateGoal, deleteGoal,
            addDebt, updateDebt, deleteDebt,
            updateCategories, updateGlobalTags,
            addCustomCategory, deleteCustomCategory, moveCategory, addSubCategory,
            globalTags, setGlobalTags,
            quickButtons, updateQuickButtons,
            recurringRules, addRecurringRule, deleteRecurringRule, updateRecurringRule, calcNextRun,
            automationItems, setAutomationItems,
            travelMode, setTravelMode,
            travelConfig, setTravelConfig
        }}>
            {children}
        </FinanceContext.Provider>
    );
};

export const useFinance = () => useContext(FinanceContext);
