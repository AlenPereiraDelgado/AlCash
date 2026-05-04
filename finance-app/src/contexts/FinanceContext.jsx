import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { DEFAULT_CATEGORIES } from '../constants/theme';
import { supabase } from '../lib/supabaseClient';

const FinanceContext = createContext();

const DEFAULT_QUICK_BUTTONS = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1, emoji: '', label: '', type: 'expense', category: '', subCategory: ''
}));

const persistProfileField = async (userId, field, value) => {
    if (!userId) return;
    const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, [field]: value }, { onConflict: 'id' });
    if (error) console.error(`persistProfileField ${field} error`, error);
};

// --- Mapeo camelCase (código) ↔ snake_case (DB) para transactions ---
const TX_KEY_MAP = {
    amountVal: 'amount_val',
    subCategory: 'sub_category',
    originalAmount: 'original_amount',
    originalCurrency: 'original_currency',
};
const TX_KEY_MAP_REV = Object.fromEntries(Object.entries(TX_KEY_MAP).map(([k, v]) => [v, k]));

const txToDb = (tx) => {
    if (!tx || typeof tx !== 'object') return tx;
    const out = {};
    for (const [k, v] of Object.entries(tx)) {
        out[TX_KEY_MAP[k] || k] = v;
    }
    return out;
};

const txFromDb = (row) => {
    if (!row || typeof row !== 'object') return row;
    const out = {};
    for (const [k, v] of Object.entries(row)) {
        out[TX_KEY_MAP_REV[k] || k] = v;
    }
    return out;
};

export const FinanceProvider = ({ children }) => {
    const { user } = useAuth();

    const [transactions, setTransactions] = useState([]);
    const [jointTransactions, setJointTransactions] = useState([]);
    const [goals, setGoals] = useState([]);
    const [debts, setDebts] = useState([]);
    const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
    const [globalTags, setGlobalTags] = useState([]);
    const [automationItems, setAutomationItems] = useState([]);

    // --- ESTADO SINCRONIZADO EN SUPABASE (profiles) ---
    const [budgets, _setBudgets] = useState({});
    const [recurringRules, _setRecurringRules] = useState([]);
    const [quickButtons, _setQuickButtons] = useState(DEFAULT_QUICK_BUTTONS);

    const setBudgets = (val) => {
        _setBudgets(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            persistProfileField(user?.id, 'budgets', next);
            return next;
        });
    };

    const setRecurringRules = (rulesOrFn) => {
        _setRecurringRules(prev => {
            const next = typeof rulesOrFn === 'function' ? rulesOrFn(prev) : rulesOrFn;
            persistProfileField(user?.id, 'recurring_rules', next);
            return next;
        });
    };

    const updateQuickButtons = (newQB) => {
        _setQuickButtons(newQB);
        persistProfileField(user?.id, 'quick_buttons', newQB);
    };

    const calcNextRun = (fromDate, every, unit) => {
        const d = new Date(fromDate + 'T12:00:00');
        if (unit === 'day')   d.setDate(d.getDate() + Number(every));
        if (unit === 'week')  d.setDate(d.getDate() + Number(every) * 7);
        if (unit === 'month') d.setMonth(d.getMonth() + Number(every));
        if (unit === 'year')  d.setFullYear(d.getFullYear() + Number(every));
        return d.toISOString().split('T')[0];
    };

    const [travelMode, setTravelMode] = useState(false);
    const [travelConfig, setTravelConfig] = useState({ currency: 'USD', rate: 1.1 });
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [saveStatus, setSaveStatus] = useState('idle');

    const periodFor = (unit) => unit === 'month' ? 'mensual' : unit === 'year' ? 'anual' : 'semanal';

    const makeAutoTx = (cur) => ({
        amountVal: cur.amount,
        type: cur.type,
        category: cur.category,
        subCategory: cur.subCategory || '',
        note: cur.name || cur.category,
        tags: ['__auto__'],
        periodicity: periodFor(cur.unit),
        date: cur.nextRun,
        is_joint: false,
    });

    const addRecurringRule = async (rule) => {
        const withId = { ...rule, id: crypto.randomUUID() };
        const today = new Date().toISOString().split('T')[0];
        let finalRule = withId;
        if (withId.active && withId.nextRun <= today) {
            let cur = { ...withId };
            while (cur.nextRun <= today) {
                const result = await addTransaction(makeAutoTx(cur));
                if (!result) console.error('[Auto] Insert falló para fecha', cur.nextRun);
                cur = { ...cur, lastRun: cur.nextRun, nextRun: calcNextRun(cur.nextRun, cur.every, cur.unit) };
            }
            finalRule = cur;
        }
        setRecurringRules(prev => [...prev, finalRule]);
    };
    const deleteRecurringRule = (id) => setRecurringRules(prev => prev.filter(r => r.id !== id));
    const updateRecurringRule = (id, updates) => setRecurringRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

    const reactivateRule = async (id, fromDate) => {
        const today = new Date().toISOString().split('T')[0];
        const rule = recurringRules.find(r => r.id === id);
        if (!rule) return;
        let cur = { ...rule, nextRun: fromDate };
        while (cur.nextRun <= today) {
            const result = await addTransaction(makeAutoTx(cur));
            if (!result) console.error('[Auto] Reactivate insert falló para fecha', cur.nextRun);
            cur = { ...cur, lastRun: cur.nextRun, nextRun: calcNextRun(cur.nextRun, cur.every, cur.unit) };
        }
        updateRecurringRule(id, { active: true, nextRun: cur.nextRun, lastRun: cur.lastRun });
    };

    // Auto-ejecutar reglas vencidas al cargar datos
    useEffect(() => {
        if (!isDataLoaded || !user?.id || recurringRules.length === 0) return;
        const today = new Date().toISOString().split('T')[0];
        const due = recurringRules.filter(r => r.active && r.nextRun <= today);
        if (!due.length) return;
        const periodForLocal = (unit) => unit === 'month' ? 'mensual' : unit === 'year' ? 'anual' : 'semanal';
        (async () => {
            const updated = recurringRules.map(rule => ({ ...rule }));
            for (const rule of due) {
                let cur = { ...rule };
                while (cur.nextRun <= today) {
                    await addTransaction({ amountVal: cur.amount, type: cur.type, category: cur.category, subCategory: cur.subCategory || '', note: cur.name || cur.category, tags: ['__auto__'], periodicity: periodForLocal(cur.unit), date: cur.nextRun, is_joint: false });
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
                supabase.from('profiles').select('categories, global_tags, recurring_rules, budgets, quick_buttons').eq('id', user.id).maybeSingle()
            ]);

            if (transRes.data) {
                const mapped = transRes.data.map(txFromDb);
                setTransactions(mapped.filter(t => !t.is_joint));
                setJointTransactions(mapped.filter(t => t.is_joint));
            }
            if (goalsRes.data) setGoals(goalsRes.data);
            if (debtsRes.data) setDebts(debtsRes.data);

            // Migración localStorage -> Supabase (una vez)
            const lsRules = (() => { try { return JSON.parse(localStorage.getItem(`alcash_rules_${user.id}`) || 'null'); } catch { return null; } })();
            const lsBudgets = (() => { try { return JSON.parse(localStorage.getItem(`alcash_budgets_${user.id}`) || 'null'); } catch { return null; } })();
            const lsQB = (() => { try { return JSON.parse(localStorage.getItem(`alcash_qb_${user.id}`) || 'null'); } catch { return null; } })();

            const profile = profileRes.data || {};
            const remoteRules = Array.isArray(profile.recurring_rules) ? profile.recurring_rules : [];
            const remoteBudgets = profile.budgets && typeof profile.budgets === 'object' ? profile.budgets : {};
            const remoteQB = Array.isArray(profile.quick_buttons) ? profile.quick_buttons : [];

            const finalRules = remoteRules.length ? remoteRules : (Array.isArray(lsRules) ? lsRules : []);
            const finalBudgets = Object.keys(remoteBudgets).length ? remoteBudgets : (lsBudgets && typeof lsBudgets === 'object' ? lsBudgets : {});
            const finalQB = remoteQB.length ? remoteQB : (Array.isArray(lsQB) && lsQB.length ? lsQB : DEFAULT_QUICK_BUTTONS);

            _setRecurringRules(finalRules);
            _setBudgets(finalBudgets);
            _setQuickButtons(finalQB);

            // Si Supabase estaba vacío y migramos desde localStorage → persistir y limpiar LS
            const migrations = [];
            if (!remoteRules.length && Array.isArray(lsRules) && lsRules.length) {
                migrations.push(persistProfileField(user.id, 'recurring_rules', finalRules));
                try { localStorage.removeItem(`alcash_rules_${user.id}`); } catch {}
            }
            if (!Object.keys(remoteBudgets).length && lsBudgets && typeof lsBudgets === 'object' && Object.keys(lsBudgets).length) {
                migrations.push(persistProfileField(user.id, 'budgets', finalBudgets));
                try { localStorage.removeItem(`alcash_budgets_${user.id}`); } catch {}
            }
            if (!remoteQB.length && Array.isArray(lsQB) && lsQB.length) {
                migrations.push(persistProfileField(user.id, 'quick_buttons', finalQB));
                try { localStorage.removeItem(`alcash_qb_${user.id}`); } catch {}
            }
            if (migrations.length) await Promise.all(migrations);

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
        _setBudgets({});
        _setRecurringRules([]);
        _setQuickButtons(DEFAULT_QUICK_BUTTONS);
        setIsDataLoaded(false);
    };

    // ---- Transactions ----
    const addTransaction = async (newTrans) => {
        setSaveStatus('saving');
        const transRecord = txToDb({ ...newTrans, user_id: user.id });
        const { data, error } = await supabase.from('transactions').insert([transRecord]).select();
        if (!error && data) {
            const mapped = txFromDb(data[0]);
            if (mapped.is_joint) setJointTransactions(prev => [mapped, ...prev]);
            else setTransactions(prev => [mapped, ...prev]);
            setSaveStatus('success');
            return mapped;
        }
        console.error('addTransaction error', error);
        setSaveStatus('error');
        return null;
    };

    const updateTransaction = async (id, updates) => {
        setSaveStatus('saving');
        const { data, error } = await supabase.from('transactions').update(txToDb(updates)).eq('id', id).select();
        if (!error && data) {
            const mapped = txFromDb(data[0]);
            setTransactions(prev => prev.map(t => t.id === id ? mapped : t));
            setJointTransactions(prev => prev.map(t => t.id === id ? mapped : t));
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

    const resetAllData = async () => {
        await Promise.all([
            supabase.from('transactions').delete().eq('user_id', user.id),
            supabase.from('goals').delete().eq('user_id', user.id),
            supabase.from('debts').delete().eq('user_id', user.id),
            supabase.from('profiles').update({
                recurring_rules: [],
                budgets: {},
                quick_buttons: DEFAULT_QUICK_BUTTONS,
            }).eq('id', user.id),
        ]);
        try { localStorage.removeItem(`alcash_budgets_${user.id}`); } catch {}
        try { localStorage.removeItem(`alcash_rules_${user.id}`); } catch {}
        try { localStorage.removeItem(`alcash_qb_${user.id}`); } catch {}
        setTransactions([]);
        setJointTransactions([]);
        setGoals([]);
        setDebts([]);
        _setBudgets({});
        _setRecurringRules([]);
        _setQuickButtons(DEFAULT_QUICK_BUTTONS);
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
            recurringRules, addRecurringRule, deleteRecurringRule, updateRecurringRule, reactivateRule, calcNextRun,
            automationItems, setAutomationItems,
            travelMode, setTravelMode,
            travelConfig, setTravelConfig,
            resetAllData
        }}>
            {children}
        </FinanceContext.Provider>
    );
};

export const useFinance = () => useContext(FinanceContext);
