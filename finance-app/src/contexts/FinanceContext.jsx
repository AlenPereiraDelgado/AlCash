import React, { createContext, useContext, useState, useEffect } from 'react';
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
    const [travelMode, setTravelMode] = useState(false);
    const [travelConfig, setTravelConfig] = useState({ currency: 'USD', rate: 1.1 });
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [saveStatus, setSaveStatus] = useState('idle');

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
                supabase.from('goals').select('*').eq('user_id', user.id),
                supabase.from('debts').select('*').eq('user_id', user.id),
                supabase.from('profiles').select('categories, global_tags').eq('id', user.id).single()
            ]);

            if (transRes.data) {
                setTransactions(transRes.data.filter(t => !t.is_joint));
                setJointTransactions(transRes.data.filter(t => t.is_joint));
            }
            if (goalsRes.data) setGoals(goalsRes.data);
            if (debtsRes.data) setDebts(debtsRes.data);
            if (profileRes.data) {
                if (profileRes.data.categories) setCategories(profileRes.data.categories);
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
        setIsDataLoaded(false);
    };

    // 2. OPERACIONES ATÓMICAS (CRUD)
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
        setSaveStatus('error');
        return false;
    };

    const addGoal = async (goal) => {
        const { data, error } = await supabase.from('goals').insert([{ ...goal, user_id: user.id }]).select();
        if (data) setGoals(prev => [...prev, data[0]]);
    };

    const updateGoal = async (id, current) => {
        await supabase.from('goals').update({ current }).eq('id', id);
        setGoals(prev => prev.map(g => g.id === id ? { ...g, current } : g));
    };

    const updateCategories = async (newCats) => {
        setCategories(newCats);
        await supabase.from('profiles').update({ categories: newCats }).eq('id', user.id);
    };

    const updateGlobalTags = async (newTags) => {
        setGlobalTags(newTags);
        await supabase.from('profiles').update({ global_tags: newTags }).eq('id', user.id);
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
            addGoal, updateGoal,
            updateCategories, updateGlobalTags,
            globalTags, setGlobalTags,
            automationItems, setAutomationItems,
            travelMode, setTravelMode,
            travelConfig, setTravelConfig
        }}>
            {children}
        </FinanceContext.Provider>
    );
};

export const useFinance = () => useContext(FinanceContext);
