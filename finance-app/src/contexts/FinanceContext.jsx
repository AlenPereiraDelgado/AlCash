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
    const [budgets, setBudgets] = useState({});
    const [globalTags, setGlobalTags] = useState([]);
    const [automationItems, setAutomationItems] = useState([]);

    const DEFAULT_QUICK_BUTTONS = [
        { id: 1, emoji: '🛒', label: 'Super',   type: 'expense', category: 'Alimentación', subCategory: 'Supermercado' },
        { id: 2, emoji: '🍕', label: 'Comer',   type: 'expense', category: 'Alimentación', subCategory: 'Restaurantes' },
        { id: 3, emoji: '🚌', label: 'Trans',   type: 'expense', category: 'Transporte',   subCategory: 'Transporte Público' },
        { id: 4, emoji: '🎮', label: 'Ocio',    type: 'expense', category: 'Suscripciones',subCategory: 'Streaming' },
        { id: 5, emoji: '🏠', label: 'Casa',    type: 'expense', category: 'Hogar',        subCategory: 'Alquiler/Hipoteca' },
        { id: 6, emoji: '💰', label: 'Sueldo',  type: 'income',  category: 'Salario',      subCategory: 'Nómina Principal' },
    ];
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

    const updateQuickButtons = (newQB) => {
        setQuickButtons(newQB);
        if (user?.id) {
            try { localStorage.setItem(`alcash_qb_${user.id}`, JSON.stringify(newQB)); } catch {}
        }
    };

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
                if (profileRes.data.categories && Object.keys(profileRes.data.categories).length > 0) {
                    setCategories(profileRes.data.categories);
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
            automationItems, setAutomationItems,
            travelMode, setTravelMode,
            travelConfig, setTravelConfig
        }}>
            {children}
        </FinanceContext.Provider>
    );
};

export const useFinance = () => useContext(FinanceContext);
