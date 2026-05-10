import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { DEFAULT_CATEGORIES } from '../constants/theme';
import { supabase } from '../lib/supabaseClient';
import { sanitizeTransaction, sanitizeGoal, sanitizeDebt, sanitizeName } from '../utils/sanitize';

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

const persistHouseholdField = async (householdId, field, value) => {
    if (!householdId) return;
    const { error } = await supabase
        .from('households')
        .update({ [field]: value })
        .eq('id', householdId);
    if (error) console.error(`persistHouseholdField ${field} error`, error);
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
    if (out.amount_val !== undefined && out.amount === undefined) out.amount = out.amount_val;
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

const newBudgetId = () => `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const migrateBudgets = (raw) => {
    if (!raw || typeof raw !== 'object') return {};
    const out = {};
    Object.entries(raw).forEach(([key, val]) => {
        if (typeof val === 'number') {
            const [cat, sub] = String(key).split('::');
            out[newBudgetId()] = { cat: cat || '', sub: sub || '', limit: val, period: 'month', count: 1, note: '' };
        } else if (val && typeof val === 'object') {
            out[key] = {
                cat: val.cat || '',
                sub: val.sub || '',
                limit: Number(val.limit) || 0,
                period: ['day', 'week', 'month', 'year'].includes(val.period) ? val.period : 'month',
                count: Math.max(1, Number(val.count) || 1),
                note: val.note || '',
            };
        }
    });
    return out;
};

export const FinanceProvider = ({ children }) => {
    const { user, isSocial, activeHouseholdId, setActiveHouseholdId, setMode } = useAuth();

    const [transactions, setTransactions] = useState([]);
    const [jointTransactions, setJointTransactions] = useState([]);
    const [goals, setGoals] = useState([]);
    const [debts, setDebts] = useState([]);
    const [expenseGroups, setExpenseGroups] = useState([]);
    const [households, setHouseholds] = useState([]);
    // true cuando la DB no tiene aún las columnas/tablas del modo Social.
    // En ese caso los inserts omiten `household_id` para no fallar.
    const [legacySchema, setLegacySchema] = useState(false);
    const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
    const [globalTags, setGlobalTags] = useState([]);
    const [automationItems, setAutomationItems] = useState([]);

    // Helper de persistencia por scope activo (personal -> profiles, social -> household).
    const persistScopedField = (field, value) => {
        if (isSocial && activeHouseholdId) return persistHouseholdField(activeHouseholdId, field, value);
        return persistProfileField(user?.id, field, value);
    };

    // --- ESTADO SINCRONIZADO EN SUPABASE (profiles) ---
    const [budgets, _setBudgets] = useState({});
    const [recurringRules, _setRecurringRules] = useState([]);
    const [quickButtons, _setQuickButtons] = useState(DEFAULT_QUICK_BUTTONS);
    const [categoryColors, _setCategoryColors] = useState({});
    const [savingsWidgets, _setSavingsWidgets] = useState([]);
    const [dashboardWidgets, _setDashboardWidgets] = useState({ comparativa: true, salud: true, historical: true, pie: true, fixedInfo: true, savings: false, debts: false, nextExpense: false, proyeccion: false, saludGauge: false, radarHabitos: false, lineComparativa: false });

    const setBudgets = (val) => {
        _setBudgets(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            persistScopedField('budgets', next);
            return next;
        });
    };

    const setRecurringRules = (rulesOrFn) => {
        _setRecurringRules(prev => {
            const next = typeof rulesOrFn === 'function' ? rulesOrFn(prev) : rulesOrFn;
            persistScopedField('recurring_rules', next);
            return next;
        });
    };

    const updateQuickButtons = (newQB) => {
        _setQuickButtons(newQB);
        persistScopedField('quick_buttons', newQB);
    };

    const setCategoryColors = (val) => {
        _setCategoryColors(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            persistScopedField('category_colors', next);
            return next;
        });
    };

    const setSavingsWidgets = (val) => {
        _setSavingsWidgets(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            persistScopedField('savings_widgets', next);
            return next;
        });
    };

    const setDashboardWidgets = (val) => {
        _setDashboardWidgets(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            persistScopedField('dashboard_widgets', next);
            return next;
        });
    };

    // Savings widget helpers
    const addSavingsWidget = ({ name, target, linkedRuleId = null, targetDate = null, kind = 'savings' }) => {
        const item = {
            id: crypto.randomUUID(),
            name: name?.trim() || (kind === 'debt' ? 'Deuda' : 'Objetivo'),
            target: Number(target) || 0,
            current: 0,
            linked_rule_id: linkedRuleId,
            target_date: targetDate || null,
            completed_at: null,
            created_at: new Date().toISOString(),
            kind,
        };
        setSavingsWidgets(prev => [...prev, item]);
    };
    const updateSavingsWidget = (id, updates) => {
        setSavingsWidgets(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
    };
    const deleteSavingsWidget = (id) => {
        setSavingsWidgets(prev => prev.filter(w => w.id !== id));
    };
    const adjustSavingsWidget = (id, delta) => {
        setSavingsWidgets(prev => prev.map(w => {
            if (w.id !== id) return w;
            const next = Math.max(0, Number(w.current || 0) + Number(delta));
            const completed = !w.completed_at && next >= Number(w.target || 0) && Number(w.target || 0) > 0;
            return { ...w, current: next, completed_at: completed ? new Date().toISOString() : w.completed_at };
        }));
    };
    const expandSavingsWidget = (id, delta) => {
        setSavingsWidgets(prev => prev.map(w => {
            if (w.id !== id) return w;
            const nextTarget = Math.max(0, Number(w.target || 0) + Number(delta));
            const stillCompleted = nextTarget > 0 && Number(w.current || 0) >= nextTarget;
            return { ...w, target: nextTarget, completed_at: stillCompleted ? w.completed_at : null };
        }));
    };
    const completeSavingsWidget = (id) => {
        setSavingsWidgets(prev => prev.map(w => w.id === id ? { ...w, completed_at: w.completed_at || new Date().toISOString() } : w));
    };
    const reopenSavingsWidget = (id) => {
        setSavingsWidgets(prev => prev.map(w => w.id === id ? { ...w, completed_at: null } : w));
    };
    const linkSavingsRule = (savingsId, ruleId) => {
        if (!savingsId || !ruleId) return;
        setSavingsWidgets(prev => prev.map(w => {
            if (w.id !== savingsId) return w;
            const current = Array.isArray(w.linked_rule_ids)
                ? [...w.linked_rule_ids]
                : (w.linked_rule_id ? [w.linked_rule_id] : []);
            const idx = current.indexOf(ruleId);
            if (idx >= 0) current.splice(idx, 1);
            else current.push(ruleId);
            const next = { ...w, linked_rule_ids: current };
            if (Object.prototype.hasOwnProperty.call(next, 'linked_rule_id')) delete next.linked_rule_id;
            return next;
        }));
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

    const tagsForRule = (ruleId, savingsList) => {
        const tags = ['__auto__', `__rule_${ruleId}__`];
        (savingsList || []).forEach(s => {
            const ids = Array.isArray(s.linked_rule_ids) ? s.linked_rule_ids : (s.linked_rule_id ? [s.linked_rule_id] : []);
            if (ids.includes(ruleId)) tags.push(`__savings_${s.id}__`);
        });
        return tags;
    };

    const makeAutoTx = (cur, savingsList) => ({
        amountVal: cur.amount,
        type: cur.type,
        category: cur.category,
        subCategory: cur.subCategory || '',
        note: cur.name || cur.category,
        tags: tagsForRule(cur.id, savingsList),
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
                const result = await addTransaction(makeAutoTx(cur, savingsWidgets));
                if (!result) console.error('[Auto] Insert falló para fecha', cur.nextRun);
                cur = { ...cur, lastRun: cur.nextRun, nextRun: calcNextRun(cur.nextRun, cur.every, cur.unit) };
            }
            finalRule = cur;
        }
        setRecurringRules(prev => [...prev, finalRule]);
    };
    const deleteRecurringRule = (id) => setRecurringRules(prev => prev.filter(r => r.id !== id));
    const updateRecurringRule = (id, updates) => setRecurringRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

    const convertTxToAutoRule = async (txId, ruleData) => {
        const tx = transactions.find(t => t.id === txId) || jointTransactions.find(t => t.id === txId);
        if (!tx) return null;
        const period = periodFor(ruleData.unit);
        const existingTags = Array.isArray(tx.tags) ? tx.tags : [];
        const newTags = existingTags.includes('__auto__') ? existingTags : [...existingTags, '__auto__'];
        await updateTransaction(txId, { tags: newTags, periodicity: period });
        const rule = {
            ...ruleData,
            id: crypto.randomUUID(),
            amount: parseFloat(ruleData.amount),
            every: Number(ruleData.every),
            nextRun: calcNextRun(ruleData.startDate, ruleData.every, ruleData.unit),
            lastRun: ruleData.startDate,
            active: true,
        };
        setRecurringRules(prev => [...prev, rule]);
        return rule;
    };

    const reactivateRule = async (id, fromDate) => {
        const today = new Date().toISOString().split('T')[0];
        const rule = recurringRules.find(r => r.id === id);
        if (!rule) return;
        let cur = { ...rule, nextRun: fromDate };
        while (cur.nextRun <= today) {
            const result = await addTransaction(makeAutoTx(cur, savingsWidgets));
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
                    await addTransaction({ amountVal: cur.amount, type: cur.type, category: cur.category, subCategory: cur.subCategory || '', note: cur.name || cur.category, tags: tagsForRule(cur.id, savingsWidgets), periodicity: periodForLocal(cur.unit), date: cur.nextRun, is_joint: false });
                    cur = { ...cur, lastRun: cur.nextRun, nextRun: calcNextRun(cur.nextRun, cur.every, cur.unit) };
                }
                const idx = updated.findIndex(r => r.id === rule.id);
                if (idx !== -1) updated[idx] = cur;
            }
            setRecurringRules(updated);
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDataLoaded]);

    // 1. CARGA INICIAL — depende de user + scope (personal vs social household)
    useEffect(() => {
        if (user) {
            loadInitialData();
            loadHouseholds();
        } else {
            resetData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isSocial, activeHouseholdId]);

    const loadHouseholds = async () => {
        if (!user?.id) return;
        const { data, error } = await supabase
            .from('households')
            .select('*')
            .or(`owner_id.eq.${user.id},member_user_ids.cs.{${user.id}}`)
            .order('created_at', { ascending: false });
        if (error) {
            // Tabla no existe (migración no aplicada): silencioso, modo legacy.
            const code = error.code;
            const msg = error.message || '';
            const tableMissing = code === 'PGRST205' || code === '42P01' || msg.includes('does not exist') || msg.includes('relation');
            if (!tableMissing) console.warn('households load error', error);
            if (tableMissing) setLegacySchema(true);
            setHouseholds([]);
            return;
        }
        setHouseholds(data || []);
        if (activeHouseholdId && !(data || []).some(h => h.id === activeHouseholdId)) {
            setActiveHouseholdId(null);
            setMode('personal');
        }
    };

    const loadInitialData = async () => {
        setIsDataLoaded(false);
        const scopeIsSocial = isSocial && !!activeHouseholdId;

        // Detector de errores de schema desincronizado (columna/tabla inexistente):
        // permite operar contra una DB sin las migraciones nuevas aplicadas.
        const isSchemaMiss = (err) => {
            if (!err) return false;
            const code = err.code || '';
            const msg = err.message || '';
            return code === '42703' || code === '42P01' || code === 'PGRST205'
                || msg.includes('does not exist') || msg.includes('column') || msg.includes('relation');
        };

        // Helper: query con filtro household_id; si la columna no existe, reintenta sin él.
        const fetchScoped = async (table, baseSelect, orderCol, ascending) => {
            const build = (withScope) => {
                const q = supabase.from(table).select(baseSelect).order(orderCol, { ascending });
                if (!withScope) return q.eq('user_id', user.id);
                if (scopeIsSocial) return q.eq('household_id', activeHouseholdId);
                return q.eq('user_id', user.id).is('household_id', null);
            };
            const first = await build(true);
            if (!first.error) return first;
            if (!isSchemaMiss(first.error)) return first;
            setLegacySchema(true);
            // Schema viejo: si pedíamos social no hay datos, si era personal cargamos legacy completo.
            if (scopeIsSocial) return { data: [], error: null };
            return await build(false);
        };

        try {
            const [transRes, goalsRes, debtsRes, groupsRes, profileRes] = await Promise.all([
                fetchScoped('transactions', '*', 'date', false),
                fetchScoped('goals', '*', 'created_at', true),
                fetchScoped('debts', '*', 'created_at', false),
                (async () => {
                    const tryNew = await supabase.from('expense_groups').select('*')
                        .or(`user_id.eq.${user.id},shared_user_ids.cs.{${user.id}}`)
                        .order('created_at', { ascending: false });
                    if (!tryNew.error) return tryNew;
                    if (!isSchemaMiss(tryNew.error)) return tryNew;
                    return await supabase.from('expense_groups').select('*')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });
                })(),
                (async () => {
                    if (!scopeIsSocial) {
                        return await supabase.from('profiles').select('categories, global_tags, recurring_rules, budgets, quick_buttons, category_colors, savings_widgets, dashboard_widgets').eq('id', user.id).maybeSingle();
                    }
                    return await supabase.from('households').select('categories, global_tags, recurring_rules, budgets, quick_buttons, category_colors, savings_widgets, dashboard_widgets').eq('id', activeHouseholdId).maybeSingle();
                })(),
            ]);

            if (transRes.data) {
                const mapped = transRes.data.map(txFromDb);
                setTransactions(mapped.filter(t => !t.is_joint));
                setJointTransactions(mapped.filter(t => t.is_joint));
            } else {
                setTransactions([]); setJointTransactions([]);
            }
            if (goalsRes.data) setGoals(goalsRes.data);
            else setGoals([]);
            if (debtsRes.data) setDebts(debtsRes.data);
            else setDebts([]);
            if (groupsRes.data) setExpenseGroups(groupsRes.data);
            else if (groupsRes.error && !isSchemaMiss(groupsRes.error)) {
                console.warn('expense_groups load error', groupsRes.error);
            }

            const profile = profileRes.data || {};
            const remoteRules = Array.isArray(profile.recurring_rules) ? profile.recurring_rules : [];
            const remoteBudgets = profile.budgets && typeof profile.budgets === 'object' ? profile.budgets : {};
            const remoteQB = Array.isArray(profile.quick_buttons) ? profile.quick_buttons : [];
            const remoteColors = profile.category_colors && typeof profile.category_colors === 'object' ? profile.category_colors : {};
            const remoteSavings = Array.isArray(profile.savings_widgets) ? profile.savings_widgets : [];
            const remoteWidgets = profile.dashboard_widgets && typeof profile.dashboard_widgets === 'object' ? profile.dashboard_widgets : {};
            const remoteCats = profile.categories && typeof profile.categories === 'object' ? profile.categories : {};
            const remoteTags = Array.isArray(profile.global_tags) ? profile.global_tags : [];

            // localStorage migration solo aplica al scope personal (legacy). Social arranca limpio.
            if (!scopeIsSocial) {
                const lsRules = (() => { try { return JSON.parse(localStorage.getItem(`alcash_rules_${user.id}`) || 'null'); } catch { return null; } })();
                const lsBudgets = (() => { try { return JSON.parse(localStorage.getItem(`alcash_budgets_${user.id}`) || 'null'); } catch { return null; } })();
                const lsQB = (() => { try { return JSON.parse(localStorage.getItem(`alcash_qb_${user.id}`) || 'null'); } catch { return null; } })();

                const finalRules = remoteRules.length ? remoteRules : (Array.isArray(lsRules) ? lsRules : []);
                const rawBudgetsSrc = Object.keys(remoteBudgets).length ? remoteBudgets : (lsBudgets && typeof lsBudgets === 'object' ? lsBudgets : {});
                const finalBudgets = migrateBudgets(rawBudgetsSrc);
                const budgetsShapeChanged = JSON.stringify(rawBudgetsSrc) !== JSON.stringify(finalBudgets);
                const finalQB = remoteQB.length ? remoteQB : (Array.isArray(lsQB) && lsQB.length ? lsQB : DEFAULT_QUICK_BUTTONS);

                _setRecurringRules(finalRules);
                _setBudgets(finalBudgets);
                _setQuickButtons(finalQB);
                _setCategoryColors(remoteColors);
                _setSavingsWidgets(remoteSavings);
                _setDashboardWidgets(prev => ({ ...prev, ...remoteWidgets }));

                const migrations = [];
                if (!remoteRules.length && Array.isArray(lsRules) && lsRules.length) {
                    migrations.push(persistProfileField(user.id, 'recurring_rules', finalRules));
                    try { localStorage.removeItem(`alcash_rules_${user.id}`); } catch {}
                }
                if (!Object.keys(remoteBudgets).length && lsBudgets && typeof lsBudgets === 'object' && Object.keys(lsBudgets).length) {
                    migrations.push(persistProfileField(user.id, 'budgets', finalBudgets));
                    try { localStorage.removeItem(`alcash_budgets_${user.id}`); } catch {}
                } else if (budgetsShapeChanged && Object.keys(finalBudgets).length) {
                    migrations.push(persistProfileField(user.id, 'budgets', finalBudgets));
                }
                if (!remoteQB.length && Array.isArray(lsQB) && lsQB.length) {
                    migrations.push(persistProfileField(user.id, 'quick_buttons', finalQB));
                    try { localStorage.removeItem(`alcash_qb_${user.id}`); } catch {}
                }
                if (migrations.length) await Promise.all(migrations);
            } else {
                // Social: cargar exactamente lo que hay en el household, sin tocar LS.
                _setRecurringRules(remoteRules);
                _setBudgets(migrateBudgets(remoteBudgets));
                _setQuickButtons(remoteQB.length ? remoteQB : DEFAULT_QUICK_BUTTONS);
                _setCategoryColors(remoteColors);
                _setSavingsWidgets(remoteSavings);
                _setDashboardWidgets({ comparativa: true, salud: true, historical: true, pie: true, fixedInfo: true, savings: false, debts: false, nextExpense: false, proyeccion: false, saludGauge: false, radarHabitos: false, lineComparativa: false, ...remoteWidgets });
            }

            const hasExpense = remoteCats.expense && Object.keys(remoteCats.expense).length > 0;
            const hasIncome  = remoteCats.income  && Object.keys(remoteCats.income).length  > 0;
            setCategories(hasExpense || hasIncome ? remoteCats : DEFAULT_CATEGORIES);
            setGlobalTags(remoteTags);

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
        setExpenseGroups([]);
        setHouseholds([]);
        setCategories(DEFAULT_CATEGORIES);
        setGlobalTags([]);
        _setBudgets({});
        _setRecurringRules([]);
        _setQuickButtons(DEFAULT_QUICK_BUTTONS);
        _setCategoryColors({});
        _setSavingsWidgets([]);
        _setDashboardWidgets({ savings: false, debts: false, fixedInfo: true, nextExpense: true, proyeccion: false, saludGauge: false, radarHabitos: false, lineComparativa: false });
        setIsDataLoaded(false);
    };

    // ---- Transactions ----
    const scopedHouseholdId = () => (isSocial && activeHouseholdId) ? activeHouseholdId : null;
    // Strip household_id si el schema aún no lo soporta.
    const withScope = (payload) => {
        if (legacySchema) {
            const { household_id, ...rest } = payload;
            return rest;
        }
        return { ...payload, household_id: scopedHouseholdId() };
    };

    const addTransaction = async (newTrans) => {
        setSaveStatus('saving');
        const clean = sanitizeTransaction(newTrans);
        const transRecord = txToDb(withScope({ ...clean, user_id: user.id }));
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
        const cleanUpdates = sanitizeTransaction(updates);
        const { data, error } = await supabase.from('transactions').update(txToDb(cleanUpdates)).eq('id', id).select();
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
        const clean = sanitizeGoal(goal);
        const { data, error } = await supabase.from('goals').insert([withScope({ ...clean, user_id: user.id })]).select();
        if (!error && data) setGoals(prev => [...prev, data[0]]);
        else console.error('addGoal error', error);
        return data?.[0] ?? null;
    };

    const updateGoal = async (id, updates) => {
        const clean = sanitizeGoal(updates);
        const { data, error } = await supabase.from('goals').update(clean).eq('id', id).select();
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
        const clean = sanitizeDebt(debt);
        const payload = withScope({ ...clean, user_id: user.id });
        delete payload.id;
        delete payload.date;
        const { data, error } = await supabase.from('debts').insert([payload]).select();
        if (!error && data) setDebts(prev => [data[0], ...prev]);
        else console.error('addDebt error', error);
        return data?.[0] ?? null;
    };

    const updateDebt = async (id, updates) => {
        const clean = sanitizeDebt(updates);
        const { data, error } = await supabase.from('debts').update(clean).eq('id', id).select();
        if (!error && data) setDebts(prev => prev.map(d => d.id === id ? data[0] : d));
        else console.error('updateDebt error', error);
    };

    const deleteDebt = async (id) => {
        const { error } = await supabase.from('debts').delete().eq('id', id);
        if (!error) setDebts(prev => prev.filter(d => d.id !== id));
        else console.error('deleteDebt error', error);
    };

    // ---- Expense groups (liquidación grupal) ----
    const addExpenseGroup = async (group) => {
        const payload = {
            user_id: user.id,
            name: (group?.name || '').trim().slice(0, 120) || 'Grupo',
            members: Array.isArray(group?.members) ? group.members : [],
            entries: Array.isArray(group?.entries) ? group.entries : [],
        };
        const { data, error } = await supabase.from('expense_groups').insert([payload]).select();
        if (!error && data) setExpenseGroups(prev => [data[0], ...prev]);
        else console.error('addExpenseGroup error', error);
        return data?.[0] ?? null;
    };

    const updateExpenseGroup = async (id, updates) => {
        const clean = { ...updates };
        if ('name' in clean) clean.name = String(clean.name || '').trim().slice(0, 120);
        const { data, error } = await supabase.from('expense_groups').update(clean).eq('id', id).select();
        if (!error && data) setExpenseGroups(prev => prev.map(g => g.id === id ? data[0] : g));
        else console.error('updateExpenseGroup error', error);
        return data?.[0] ?? null;
    };

    const deleteExpenseGroup = async (id) => {
        const { error } = await supabase.from('expense_groups').delete().eq('id', id);
        if (!error) setExpenseGroups(prev => prev.filter(g => g.id !== id));
        else console.error('deleteExpenseGroup error', error);
    };

    const addGroupEntry = async (groupId, entry) => {
        const group = expenseGroups.find(g => g.id === groupId);
        if (!group) return null;
        const next = [...(group.entries || []), entry];
        return await updateExpenseGroup(groupId, { entries: next });
    };

    const deleteGroupEntry = async (groupId, entryId) => {
        const group = expenseGroups.find(g => g.id === groupId);
        if (!group) return null;
        const next = (group.entries || []).filter(e => e.id !== entryId);
        return await updateExpenseGroup(groupId, { entries: next });
    };

    // ---- Group invites (link sharing tipo Tricount) ----
    const generateGroupInviteToken = async (groupId) => {
        const group = expenseGroups.find(g => g.id === groupId);
        if (!group) return null;
        if (group.invite_token) return group.invite_token;
        const random = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID().replace(/-/g, '')
            : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        const token = random.slice(0, 24);
        const { data, error } = await supabase
            .from('expense_groups')
            .update({ invite_token: token })
            .eq('id', groupId)
            .select();
        if (error) { console.error('generateGroupInviteToken error', error); return null; }
        if (data && data[0]) setExpenseGroups(prev => prev.map(g => g.id === groupId ? data[0] : g));
        return token;
    };

    const getGroupByToken = async (token) => {
        const { data, error } = await supabase.rpc('get_group_by_token', { p_token: token });
        if (error) { console.error('getGroupByToken error', error); return null; }
        return Array.isArray(data) ? data[0] || null : data;
    };

    // ---- Households (modo Social) ----
    const refreshHouseholds = async () => {
        if (!user?.id) return null;
        const { data, error } = await supabase
            .from('households')
            .select('*')
            .or(`owner_id.eq.${user.id},member_user_ids.cs.{${user.id}}`)
            .order('created_at', { ascending: false });
        if (error) { console.error('refreshHouseholds error', error); return null; }
        setHouseholds(data || []);
        return data || [];
    };

    const createHousehold = async (name, ownerMemberName) => {
        const { data, error } = await supabase.rpc('create_household', {
            p_name: (name || '').trim(),
            p_owner_member_name: (ownerMemberName || '').trim() || 'Yo',
        });
        if (error) { console.error('createHousehold error', error); throw error; }
        await refreshHouseholds();
        return data;
    };

    const addHouseholdMemberSlot = async (householdId, memberName) => {
        const { error } = await supabase.rpc('add_household_member_slot', {
            p_household_id: householdId,
            p_member_name: (memberName || '').trim(),
        });
        if (error) { console.error('addHouseholdMemberSlot error', error); throw error; }
        await refreshHouseholds();
        return true;
    };

    const ensureHouseholdInviteToken = async (householdId) => {
        const { data, error } = await supabase.rpc('ensure_household_invite_token', { p_household_id: householdId });
        if (error) { console.error('ensureHouseholdInviteToken error', error); return null; }
        await refreshHouseholds();
        return data;
    };

    const getHouseholdByToken = async (token) => {
        const { data, error } = await supabase.rpc('get_household_by_token', { p_token: token });
        if (error) { console.error('getHouseholdByToken error', error); return null; }
        return Array.isArray(data) ? data[0] || null : data;
    };

    const acceptHouseholdInvite = async (token, memberId) => {
        const { data, error } = await supabase.rpc('accept_household_invite', {
            p_token: token,
            p_member_id: memberId,
        });
        if (error) { console.error('acceptHouseholdInvite error', error); throw error; }
        await refreshHouseholds();
        return data;
    };

    const leaveHousehold = async (householdId) => {
        const { error } = await supabase.rpc('leave_household', { p_household_id: householdId });
        if (error) { console.error('leaveHousehold error', error); throw error; }
        if (activeHouseholdId === householdId) {
            setActiveHouseholdId(null);
            setMode('personal');
        }
        await refreshHouseholds();
    };

    const deleteHousehold = async (householdId) => {
        console.log('[deleteHousehold] start', { householdId });
        // Intento 1: RPC security-definer (evita falsos negativos de RLS).
        const rpcRes = await supabase.rpc('delete_household', { p_household_id: householdId });
        console.log('[deleteHousehold] rpc result', rpcRes);
        if (rpcRes.error) {
            const code = rpcRes.error.code || '';
            const isMissingFn = code === 'PGRST202' || code === '42883' || (rpcRes.error.message || '').includes('does not exist');
            if (!isMissingFn) {
                console.error('[deleteHousehold] RPC error (not missing fn)', rpcRes.error);
                throw rpcRes.error;
            }
            console.warn('[deleteHousehold] RPC missing → fallback DELETE');
            // Fallback: delete directo + select para detectar RLS deny silencioso.
            const { data, error } = await supabase.from('households').delete().eq('id', householdId).select();
            console.log('[deleteHousehold] fallback result', { data, error });
            if (error) { console.error('[deleteHousehold] fallback error', error); throw error; }
            if (!data || data.length === 0) {
                throw new Error('No tienes permisos para borrar este hogar (¿eres el dueño?). La RPC delete_household no está instalada — ejecuta la migración.');
            }
        }
        if (activeHouseholdId === householdId) {
            setActiveHouseholdId(null);
            setMode('personal');
        }
        await refreshHouseholds();
        console.log('[deleteHousehold] done, refreshed');
    };

    const updateHousehold = async (householdId, updates) => {
        const clean = { ...updates };
        if ('name' in clean) clean.name = String(clean.name || '').trim().slice(0, 80);
        const { data, error } = await supabase.from('households').update(clean).eq('id', householdId).select();
        if (error) { console.error('updateHousehold error', error); return null; }
        if (data && data[0]) setHouseholds(prev => prev.map(h => h.id === householdId ? data[0] : h));
        return data?.[0] ?? null;
    };

    const acceptGroupInvite = async (token, memberId) => {
        const { data, error } = await supabase.rpc('accept_group_invite', {
            p_token: token,
            p_member_id: memberId,
        });
        if (error) { console.error('acceptGroupInvite error', error); throw error; }
        // Recargar grupos para incluir el grupo recién compartido
        const { data: refreshed } = await supabase
            .from('expense_groups')
            .select('*')
            .or(`user_id.eq.${user.id},shared_user_ids.cs.{${user.id}}`)
            .order('created_at', { ascending: false });
        if (refreshed) setExpenseGroups(refreshed);
        return data;
    };

    // ---- Profile / settings (routed por scope) ----
    const updateCategories = async (newCats) => {
        setCategories(newCats);
        if (isSocial && activeHouseholdId) {
            const { error } = await supabase.from('households').update({ categories: newCats }).eq('id', activeHouseholdId);
            if (error) console.error('updateCategories (household) error', error);
        } else {
            const { error } = await supabase.from('profiles').update({ categories: newCats }).eq('id', user.id);
            if (error) console.error('updateCategories error', error);
        }
    };

    const addCustomCategory = async (type, name) => {
        const clean = sanitizeName(name, 80);
        if (!clean) return;
        await updateCategories({ ...categories, [type]: { ...categories[type], [clean]: [] } });
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
        const clean = sanitizeName(sub, 80);
        if (!clean) return;
        const newSection = { ...categories[type], [cat]: [...(categories[type][cat] || []), clean] };
        await updateCategories({ ...categories, [type]: newSection });
    };

    const renameCategory = async (type, oldName, newName) => {
        const trimmed = (newName || '').trim();
        if (!trimmed || trimmed === oldName) return;
        if (categories[type]?.[trimmed]) {
            console.warn('renameCategory: target name already exists');
            return;
        }
        // 1. categorías (preservar orden)
        const oldKeys = Object.keys(categories[type] || {});
        const newSection = {};
        oldKeys.forEach(k => {
            newSection[k === oldName ? trimmed : k] = categories[type][k];
        });
        const newCats = { ...categories, [type]: newSection };
        // 2. DB: actualizar transactions del scope activo
        const renameQ = supabase.from('transactions').update({ category: trimmed });
        if (isSocial && activeHouseholdId) renameQ.eq('household_id', activeHouseholdId);
        else renameQ.eq('user_id', user.id).is('household_id', null);
        const { error: txErr } = await renameQ.eq('type', type).eq('category', oldName);
        if (txErr) {
            console.error('renameCategory tx error', txErr);
            return;
        }
        // 3. Estado local de transactions/jointTransactions
        const patchTx = (arr) => arr.map(tx =>
            (tx.type === type && tx.category === oldName) ? { ...tx, category: trimmed } : tx
        );
        setTransactions(prev => patchTx(prev));
        setJointTransactions(prev => patchTx(prev));
        // 4. recurring_rules
        const newRules = recurringRules.map(r =>
            (r.type === type && r.category === oldName) ? { ...r, category: trimmed } : r
        );
        setRecurringRules(newRules);
        // 5. quick_buttons
        const newQB = quickButtons.map(b =>
            (b.type === type && b.category === oldName) ? { ...b, category: trimmed } : b
        );
        updateQuickButtons(newQB);
        // 6. budgets (entradas con cat == oldName)
        if (type === 'expense' && budgets) {
            let changed = false;
            const newBudgets = { ...budgets };
            Object.entries(newBudgets).forEach(([id, b]) => {
                if (b && b.cat === oldName) {
                    newBudgets[id] = { ...b, cat: trimmed };
                    changed = true;
                }
            });
            if (changed) setBudgets(newBudgets);
        }
        // 7. categorías
        await updateCategories(newCats);
    };

    const renameSubCategory = async (type, cat, oldSub, newSub) => {
        const trimmed = (newSub || '').trim();
        if (!trimmed || trimmed === oldSub) return;
        const subs = categories[type]?.[cat] || [];
        if (subs.includes(trimmed)) {
            console.warn('renameSubCategory: target name already exists');
            return;
        }
        // 1. categorías
        const newSubs = subs.map(s => s === oldSub ? trimmed : s);
        const newSection = { ...categories[type], [cat]: newSubs };
        const newCats = { ...categories, [type]: newSection };
        // 2. DB (scope activo)
        const renameSubQ = supabase.from('transactions').update({ sub_category: trimmed });
        if (isSocial && activeHouseholdId) renameSubQ.eq('household_id', activeHouseholdId);
        else renameSubQ.eq('user_id', user.id).is('household_id', null);
        const { error: txErr } = await renameSubQ.eq('type', type).eq('category', cat).eq('sub_category', oldSub);
        if (txErr) {
            console.error('renameSubCategory tx error', txErr);
            return;
        }
        // 3. estado local
        const patchTx = (arr) => arr.map(tx =>
            (tx.type === type && tx.category === cat && tx.subCategory === oldSub) ? { ...tx, subCategory: trimmed } : tx
        );
        setTransactions(prev => patchTx(prev));
        setJointTransactions(prev => patchTx(prev));
        // 4. recurring_rules
        const newRules = recurringRules.map(r =>
            (r.type === type && r.category === cat && r.subCategory === oldSub) ? { ...r, subCategory: trimmed } : r
        );
        setRecurringRules(newRules);
        // 5. quick_buttons
        const newQB = quickButtons.map(b =>
            (b.type === type && b.category === cat && b.subCategory === oldSub) ? { ...b, subCategory: trimmed } : b
        );
        updateQuickButtons(newQB);
        // 6. budgets
        if (type === 'expense' && budgets) {
            let changed = false;
            const newBudgets = { ...budgets };
            Object.entries(newBudgets).forEach(([id, b]) => {
                if (b && b.cat === cat && b.sub === oldSub) {
                    newBudgets[id] = { ...b, sub: trimmed };
                    changed = true;
                }
            });
            if (changed) setBudgets(newBudgets);
        }
        // 7. categorías
        await updateCategories(newCats);
    };

    const resetAllData = async () => {
        await Promise.all([
            supabase.from('transactions').delete().eq('user_id', user.id),
            supabase.from('goals').delete().eq('user_id', user.id),
            supabase.from('debts').delete().eq('user_id', user.id),
            supabase.from('expense_groups').delete().eq('user_id', user.id),
            supabase.from('profiles').update({
                recurring_rules: [],
                budgets: {},
                quick_buttons: DEFAULT_QUICK_BUTTONS,
                category_colors: {},
                savings_widgets: [],
                dashboard_widgets: { comparativa: true, salud: true, historical: true, pie: true, fixedInfo: true, savings: false, debts: false, nextExpense: false, proyeccion: false, saludGauge: false, radarHabitos: false, lineComparativa: false },
            }).eq('id', user.id),
        ]);
        try { localStorage.removeItem(`alcash_budgets_${user.id}`); } catch {}
        try { localStorage.removeItem(`alcash_rules_${user.id}`); } catch {}
        try { localStorage.removeItem(`alcash_qb_${user.id}`); } catch {}
        setTransactions([]);
        setJointTransactions([]);
        setGoals([]);
        setDebts([]);
        setExpenseGroups([]);
        _setBudgets({});
        _setRecurringRules([]);
        _setQuickButtons(DEFAULT_QUICK_BUTTONS);
        _setCategoryColors({});
        _setSavingsWidgets([]);
        _setDashboardWidgets({ savings: false, debts: false, fixedInfo: true, nextExpense: true, proyeccion: false, saludGauge: false, radarHabitos: false, lineComparativa: false });
    };

    const updateGlobalTags = async (newTags) => {
        setGlobalTags(newTags);
        if (isSocial && activeHouseholdId) {
            const { error } = await supabase.from('households').update({ global_tags: newTags }).eq('id', activeHouseholdId);
            if (error) console.error('updateGlobalTags (household) error', error);
        } else {
            const { error } = await supabase.from('profiles').update({ global_tags: newTags }).eq('id', user.id);
            if (error) console.error('updateGlobalTags error', error);
        }
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
            expenseGroups, addExpenseGroup, updateExpenseGroup, deleteExpenseGroup, addGroupEntry, deleteGroupEntry,
            generateGroupInviteToken, getGroupByToken, acceptGroupInvite,
            households, refreshHouseholds, createHousehold, addHouseholdMemberSlot,
            ensureHouseholdInviteToken, getHouseholdByToken, acceptHouseholdInvite,
            leaveHousehold, deleteHousehold, updateHousehold,
            updateCategories, updateGlobalTags,
            addCustomCategory, deleteCustomCategory, moveCategory, addSubCategory,
            renameCategory, renameSubCategory,
            globalTags, setGlobalTags,
            quickButtons, updateQuickButtons,
            recurringRules, addRecurringRule, deleteRecurringRule, updateRecurringRule, reactivateRule, calcNextRun, convertTxToAutoRule,
            automationItems, setAutomationItems,
            travelMode, setTravelMode,
            travelConfig, setTravelConfig,
            categoryColors, setCategoryColors,
            savingsWidgets, addSavingsWidget, updateSavingsWidget, deleteSavingsWidget, adjustSavingsWidget, expandSavingsWidget, completeSavingsWidget, reopenSavingsWidget, linkSavingsRule,
            dashboardWidgets, setDashboardWidgets,
            resetAllData
        }}>
            {children}
        </FinanceContext.Provider>
    );
};

export const useFinance = () => useContext(FinanceContext);
