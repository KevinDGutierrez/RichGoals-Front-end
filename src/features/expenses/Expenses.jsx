import React, { useState, useMemo, useRef, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc } from '../../services/backendFirestore.js';
import RichInsightsCard from '../insights/RichInsightsCard';
import {
    Plus, Mic, Send, ShoppingCart, Car, Home, Wifi, Dumbbell, Utensils,
    Music, Heart, GraduationCap, Zap, Droplets, Smartphone, CreditCard,
    Shield, PawPrint, Cloud, Sparkles, PartyPopper, Trash2, ChevronDown,
    X, CheckCircle2, AlertTriangle, TrendingDown, Calendar,
    Receipt, Check, Undo2, Gamepad2, Wallet, ChevronUp, Scissors, Shirt, Ticket, Film, Beer, Flame, Watch, Pill, BusFront
} from 'lucide-react';
import { 
    getSubCategory, 
    calculateExpensesMetrics, 
    calculateCashflowMetrics 
} from '../../lib/expenseLogic';
import { trackEvent } from '../../lib/analytics';

// ─────────────────────────── constants ────────────────────────────
const monthName = new Date().toLocaleString('es-GT', { month: 'long' });

// (Logic moved to expenseLogic.js)

const CATEGORY_MAP = [
    { name: 'Vivienda & Servicios', icon: Home, color: '#8b5cf6' },
    { name: 'Comunicaciones', icon: Smartphone, color: '#ec4899' },
    { name: 'Suscripciones Digitales', icon: Music, color: '#3b82f6' },
    { name: 'Vehículos', icon: Car, color: '#ef4444' },
    { name: 'Salud', icon: Heart, color: '#f43f5e' },
    { name: 'Educación', icon: GraduationCap, color: '#6366f1' },
    { name: 'Retail', icon: ShoppingCart, color: '#f97316' },
    { name: 'Mascotas', icon: PawPrint, color: '#f59e0b' },
    { name: 'Deportes', icon: Dumbbell, color: '#3b82f6' },
    { name: 'Cuidado Personal', icon: Sparkles, color: '#ec4899' },
    { name: 'Ocio', icon: PartyPopper, color: '#a855f7' },
    { name: 'Otros', icon: CreditCard, color: '#f97316' }
];

const normalizeExpense = (exp) => {
    const superCat = getSubCategory(exp.category || 'Otros');
    return {
        ...exp,
        category: superCat,
        description: (!exp.description || exp.description === 'Otro' || exp.description === 'Otros' || exp.description === superCat) 
            ? (exp.category || 'Otros') 
            : exp.description
    };
};

const getCategoryByName = (name) => {
    if (name === 'ATM') return { name: 'ATM', icon: Wallet, color: '#f59e0b', keywords: [] };
    return CATEGORY_MAP.find(c => c.name === name) || CATEGORY_MAP[CATEGORY_MAP.length - 1];
};

// Parses natural language like "supermercado 350" o "gasté 180 en almuerzo"
const parseNaturalText = (text) => {
    const lower = text.toLowerCase().trim();

    // Extract amount
    const amountMatch = lower.match(/\bq?\s*(\d+(?:[.,]\d{1,2})?)\b/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : null;

    // Guess category by keywords
    let guessedCategory = CATEGORY_MAP[CATEGORY_MAP.length - 1]; // default Otros
    let keywordMatched = '';

    // Specific overrides antes del loop genérico
    const OVERRIDES = [
        { test: (l) => l.includes('molino'), cat: 'Otros' },
        { test: (l) => l.includes('parqueo') || l.includes('parking') || l.includes('estacionamiento'), cat: 'Vehículos' },
        { test: (l) => l.includes('pañal') || l.includes('juguete'), cat: 'Otros' },
        { test: (l) => l.includes('tortillas'), cat: 'Vivienda & Servicios' },
        { test: (l) => l.includes('pollo') || l.includes('granjero'), cat: 'Ocio' },
    ];
    const override = OVERRIDES.find(o => o.test(lower));
    if (override) {
        guessedCategory = CATEGORY_MAP.find(c => c.name === override.cat) || guessedCategory;
    } else {
        // Use shared getSubCategory logic for keyword-based categorization
        const detectedCat = getSubCategory(lower);
        if (detectedCat !== 'Otros') {
            const found = CATEGORY_MAP.find(c => c.name === detectedCat);
            if (found) {
                guessedCategory = found;
                keywordMatched = detectedCat;
            }
        }
    }

    // Remaining text as description
    let description = text;
    if (amountMatch) description = text.replace(amountMatch[0], '').replace(/^[Qq]\s*/, '').trim();
    description = description.replace(/^(gasté|comprá|compré|pagué|pagú|gaste|pague|en|de|por)\s+/i, '').trim();

    if (!description && keywordMatched) {
        description = keywordMatched.charAt(0).toUpperCase() + keywordMatched.slice(1);
    }

    if (!description) description = 'Gasto';

    return { amount, category: guessedCategory.name, description };
};

const formatDate = (iso) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' });
};

const today = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const safeParse = (val) => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

// Helper: check if expense is fixed
const isActuallyFixed = (e) => Boolean(e.isFixed);

// ─────────────────────────── component ────────────────────────────
export default function Expenses({ userData, user }) {
    const finances = userData?.finances || {};
    const income = finances.income || 0;
    const budgetCats = userData?.budget?.categories || [];
    const fixedBudgetCats = budgetCats.filter(c => c.isFixed === true);
    const variableBudgetCats = budgetCats.filter(c => c.isFixed !== true);
    const debtsData = userData?.debts || [];
    const savingsData = userData?.savings || {};
    const accounts = savingsData.accounts || [];

    const [expenses, setExpenses] = useState(() => (userData?.expenses || []).map(normalizeExpense));
    const [loading, setLoading] = useState(false);

    // Keep in sync with Firestore real-time + auto-normalize old category names
    useEffect(() => {
        if (!userData?.expenses) return;
        const normalized = userData.expenses.map(normalizeExpense);
        setExpenses(normalized);

        // Persist if any names changed (one-time migration)
        const changed = userData.expenses.some((e, i) => e.category !== normalized[i].category);
        if (changed && user?.uid) {
            updateDoc(doc(db, 'users', user.uid), { expenses: normalized }).catch(console.error);
        }
    }, [userData, user]);

    // ── quick-add form state
    const [chatInput, setChatInput] = useState('');
    const [showQuickPick, setShowQuickPick] = useState(false);
    const [confirmEntry, setConfirmEntry] = useState(null); // parsed entry awaiting confirm
    const [manualEntry, setManualEntry] = useState(null); // { amount, category, description, date }
    const [collapsedDays, setCollapsedDays] = useState({}); // { '2026-03-05': true }
    const [showCashWithdrawal, setShowCashWithdrawal] = useState(false);
    const [cashWithdrawal, setCashWithdrawal] = useState({ amount: '', source: 'Cashflow', description: '', accountId: '' });
    const [selectedParentCat, setSelectedParentCat] = useState('Todos');
    const [selectedVarCategory, setSelectedVarCategory] = useState(null); // Drill-down for variable expenses
    const inputRef = useRef(null);

    // ── Exchange rate for live TI calculation ──
    const [exchangeRate, setExchangeRate] = useState(7.75);
    useEffect(() => {
        const fetchRate = async () => {
            try {
                const response = await fetch('https://open.er-api.com/v6/latest/USD');
                const data = await response.json();
                if (data?.rates?.GTQ) setExchangeRate(data.rates.GTQ);
            } catch (error) { console.error("Exchange rate error:", error); }
        };
        fetchRate();
    }, []);

    // ── current month filter
    const currentMonth = new Date().toISOString().substring(0, 7); // "2026-03"
    const thisMonthExpenses = useMemo(
        () => expenses.filter(e => e.date?.startsWith(currentMonth)),
        [expenses, currentMonth]
    );

    // ── Global Metrics (Unified Calculation via shared function)
    const { TI, TP, TDM, CFD } = useMemo(() => {
        return calculateCashflowMetrics(userData, currentMonth, exchangeRate);
    }, [userData, currentMonth, exchangeRate]);

    const totalSavingsGTQ = useMemo(() => {
        return (userData?.savings?.accounts || []).reduce((acc, account) => {
            const bal = parseFloat(account.balance) || 0;
            return acc + (account.currency === 'USD' ? bal * exchangeRate : bal);
        }, 0);
    }, [userData, exchangeRate]);


    // Per-category spent (variable only)
    const variableSpentByCategory = useMemo(() => {
        const map = {};
        thisMonthExpenses.filter(e => !isActuallyFixed(e)).forEach(e => {
            const superCat = getSubCategory(e.category);
            map[superCat] = (map[superCat] || 0) + (e.amount || 0);
        });
        return map;
    }, [thisMonthExpenses]);

    // Per-category spent by ID (variable only)
    const variableSpentById = useMemo(() => {
        const map = {};
        thisMonthExpenses.filter(e => !isActuallyFixed(e) && e.budgetCategoryId).forEach(e => {
            map[e.budgetCategoryId] = (map[e.budgetCategoryId] || 0) + (e.amount || 0);
        });
        return map;
    }, [thisMonthExpenses]);

    // ── Detailed Expense Metrics (GFP, GVP, TGP, TG)
    const { TG, GFP, GVP, GVE, TGP, dailyData } = useMemo(() => {
        const categories = userData?.budget?.categories || [];
        const metrics = calculateExpensesMetrics(userData?.expenses || [], categories, currentMonth);

        // GVE -> Gastos Variables Excedidos (specific to this module's view)
        const spentByCat = {};
        thisMonthExpenses.filter(e => !isActuallyFixed(e)).forEach(e => {
            const superCat = getSubCategory(e.category);
            spentByCat[superCat] = (spentByCat[superCat] || 0) + (e.amount || 0);
        });

        let gveVal = 0;
        
        // Calculate GVE accurately using grouping logic
        const varGroupsLocal = variableBudgetCats.reduce((acc, cat) => {
            const superCat = getSubCategory(cat);
            if (!acc[superCat]) acc[superCat] = [];
            acc[superCat].push(cat);
            return acc;
        }, {});

        Object.keys(varGroupsLocal).forEach(name => {
            const limit = varGroupsLocal[name].reduce((s, c) => s + (parseFloat(c.total) || 0), 0);
            const spent = spentByCat[name] || 0;
            if (spent > limit) gveVal += (spent - limit);
        });

        // Daily Data
        const daysInMonthLocal = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const todayDayLocal = new Date().getDate();
        const dailyBudgetValue = TP / daysInMonthLocal;
        const accumByDay = {};
        thisMonthExpenses.forEach(e => {
            const day = parseInt(e.date?.split('-')[2]);
            if (!isNaN(day)) accumByDay[day] = (accumByDay[day] || 0) + (e.amount || 0);
        });

        let cumulative = 0;
        const dailyDataArray = Array.from({ length: daysInMonthLocal }, (_, i) => {
            const day = i + 1;
            if (day <= todayDayLocal) {
                cumulative += accumByDay[day] || 0;
                return { day, real: cumulative, ideal: Math.round(dailyBudgetValue * day) };
            }
            return { day, real: null, ideal: Math.round(dailyBudgetValue * day) };
        });

        return { TG: metrics.TG, GFP: metrics.GFP, GVP: metrics.GVP, GVE: gveVal, TGP: metrics.TGP, dailyData: dailyDataArray };
    }, [thisMonthExpenses, budgetCats, TP, userData, currentMonth, variableBudgetCats]);


    // ──────────────── save to Firestore ────────────────
    const persistExpenses = async (newList) => {
        if (!user?.uid) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), { expenses: newList });
        } catch (err) {
            console.error('Error saving expense:', err);
        } finally {
            setLoading(false);
        }
    };

    const addExpense = async (entry) => {
        // Determinar si la categoría tiene presupuesto variable proyectado
        let finalCategory = entry.category;
        let originalCategory = null;
        const isFixed = entry.isFixed || budgetCats.some(c => c.isFixed && (c.name === entry.category || c.name === entry.description));

        if (!isFixed && finalCategory !== 'ATM') {
            // Verificar si existe algún budget item variable para esta super-categoría
            const superCat = getSubCategory(finalCategory);
            const hasBudgetItems = budgetCats.some(c => !c.isFixed && getSubCategory(c) === superCat);
            if (!hasBudgetItems) {
                originalCategory = finalCategory;
                finalCategory = 'Otros';
            }
        }

        const newExp = {
            id: Date.now().toString(),
            amount: Number(entry.amount),
            category: finalCategory,
            description: entry.description || entry.category,
            date: entry.date || today(),
            createdAt: new Date().toISOString(),
            isFixed,
            ...(originalCategory ? { originalCategory } : {}),
            ...(entry.budgetCategoryId ? { budgetCategoryId: entry.budgetCategoryId } : {}),
            ...(entry.source ? { source: entry.source } : {}),
            fundingSource: entry.fundingSource || 'Cashflow',
        };
        const updated = [newExp, ...expenses];
        setExpenses(updated);
        await persistExpenses(updated);
        trackEvent('expense_added', { method: entry._method || 'manual', category: finalCategory, amount: Number(entry.amount) });
    };

    // ──────────────── change expense date by ±1 day ────────────────
    const changeExpenseDate = async (expenseId, direction) => {
        const updated = expenses.map(e => {
            if (e.id !== expenseId) return e;
            const d = new Date(e.date + 'T12:00:00');
            d.setDate(d.getDate() + direction);
            return { ...e, date: d.toISOString().split('T')[0] };
        });
        setExpenses(updated);
        await persistExpenses(updated);
    };

    // ──────────────── cash withdrawal submit ────────────────
    const handleCashWithdrawal = async () => {
        if (!cashWithdrawal.amount || isNaN(cashWithdrawal.amount)) return;
        if (cashWithdrawal.source === 'Capital' && !cashWithdrawal.accountId) return;

        setLoading(true);
        try {
            await addExpense({
                amount: cashWithdrawal.amount,
                category: 'ATM',
                description: cashWithdrawal.description || `Retiro de ${cashWithdrawal.source}`,
                date: today(),
                fundingSource: cashWithdrawal.source || 'Cashflow',
                _method: 'cash_withdrawal',
            });

            if (user?.uid) {
                const userRef = doc(db, 'users', user.uid);
                if (cashWithdrawal.source === 'Cashflow') {
                    // Deducción Global: Restar del ingreso mensual
                    const currentIncome = safeParse(finances.income);
                    const newIncome = currentIncome - (parseFloat(cashWithdrawal.amount) || 0);
                    await updateDoc(userRef, { 'finances.income': newIncome });
                } else if (cashWithdrawal.source === 'Capital') {
                    const updatedAccounts = accounts.map(acc => {
                        if (acc.id === cashWithdrawal.accountId) {
                            const amt = safeParse(cashWithdrawal.amount);
                            const deductInAccCurrency = acc.currency === 'USD' ? amt / 7.75 : amt;
                            return {
                                ...acc,
                                balance: safeParse(acc.balance) - deductInAccCurrency,
                                history: [
                                    {
                                        id: Date.now().toString(),
                                        date: today(),
                                        amount: -deductInAccCurrency,
                                        source: `ATM: ${cashWithdrawal.description || 'Retiro de Efectivo'}`
                                    },
                                    ...(acc.history || [])
                                ]
                            };
                        }
                        return acc;
                    });
                    await updateDoc(userRef, { 'savings.accounts': updatedAccounts });
                }
            }

            setCashWithdrawal({ amount: '', source: 'Cashflow', description: '', accountId: '' });
            setShowCashWithdrawal(false);
        } catch (err) {
            console.error("ATM error:", err);
        } finally {
            setLoading(false);
        }
    };

    const deleteExpense = async (id) => {
        const updated = expenses.filter(e => e.id !== id);
        setExpenses(updated);
        await persistExpenses(updated);
        trackEvent('expense_deleted');
    };

    // ──────────────── chat / text parse flow ────────────────
    const handleSendText = () => {
        const text = chatInput.trim();
        if (!text) return;
        const parsed = parseNaturalText(text);

        const desc = parsed.description || text;
        const capDesc = desc.charAt(0).toUpperCase() + desc.slice(1);

        setConfirmEntry({
            ...parsed,
            amount: parsed.amount || '',
            description: capDesc,
            date: today(),
            fundingSource: 'Cashflow',
            _method: 'text'
        });
        setChatInput('');
    };

    const confirmAdd = async () => {
        if (!confirmEntry || !confirmEntry.amount || isNaN(confirmEntry.amount)) return;
        const amt = parseFloat(confirmEntry.amount);
        const source = confirmEntry.fundingSource || 'Cashflow';

        // Determine if this expense needs global deduction and how much
        const cat = budgetCats.find(c => c.id === confirmEntry.budgetCategoryId);
        const catLimit = cat ? (parseFloat(cat.total) || 0) : 0;
        const catSpent = cat ? (variableSpentById[cat.id] || 0) : 0;
        const catAvailable = Math.max(0, catLimit - catSpent);
        const isAlreadyOver = cat && catLimit > 0 && catSpent >= catLimit;

        // For categories with budget: only the excess beyond remaining budget needs external funding
        // For Otros/ATM or no-budget: the full amount needs external funding
        let deductAmt = 0;
        let needsDeduction = false;

        if (!cat || confirmEntry.category === 'Otros' || confirmEntry.category === 'ATM') {
            // No budget category → full amount from external source
            needsDeduction = true;
            deductAmt = amt;
        } else if (isAlreadyOver) {
            // Already over budget → full amount from external source
            needsDeduction = true;
            deductAmt = amt;
        } else if (amt > catAvailable) {
            // Partially over → only the excess from external source
            needsDeduction = true;
            deductAmt = amt - catAvailable;
        }

        if (needsDeduction && deductAmt > 0) {
            if (source === 'Cashflow' && deductAmt > CFD) {
                alert(`No tienes suficiente Cashflow. El pago extra es de Q${deductAmt.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} y solo tienes Q${CFD.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
                return;
            }
            if (source === 'Capital' && deductAmt > totalSavingsGTQ) {
                alert(`No tienes suficiente Capital. El pago extra es de Q${deductAmt.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} y solo tienes Q${totalSavingsGTQ.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
                return;
            }
        }

        await addExpense(confirmEntry);

        // Global deduction: only the excess amount
        if (needsDeduction && deductAmt > 0 && user?.uid) {
            const userRef = doc(db, 'users', user.uid);
            if (source === 'Cashflow') {
                const currentIncome = safeParse(finances.income);
                await updateDoc(userRef, { 'finances.income': currentIncome - deductAmt });
            } else if (source === 'Capital') {
                const targetAccId = confirmEntry.accountId;
                if (!targetAccId) {
                    alert('Selecciona una cuenta de Capital.');
                    return;
                }
                const updatedAccounts = accounts.map(acc => {
                    if (acc.id === targetAccId) {
                        const deductInAccCurrency = acc.currency === 'USD' ? deductAmt / 7.75 : deductAmt;
                        return {
                            ...acc,
                            balance: safeParse(acc.balance) - deductInAccCurrency,
                            history: [
                                {
                                    id: Date.now().toString(),
                                    date: today(),
                                    amount: -deductInAccCurrency,
                                    source: `Gasto: ${confirmEntry.description || confirmEntry.category}`
                                },
                                ...(acc.history || [])
                            ]
                        };
                    }
                    return acc;
                });
                await updateDoc(userRef, { 'savings.accounts': updatedAccounts });
            }
        }

        setConfirmEntry(null);
        setSelectedVarCategory(null);
    };


    // ──────────────── quick pick (tap a category) ────────────────
    const handleQuickPick = (catName) => {
        setShowQuickPick(false);
        setManualEntry({ amount: '', category: catName, description: catName, date: today(), fundingSource: 'Cashflow', accountId: '', _method: 'quick' });
    };

    // ──────────────── manual form submit ────────────────
    const handleManualSubmit = async () => {
        if (!manualEntry?.amount || isNaN(manualEntry.amount)) return;
        const amt = parseFloat(manualEntry.amount);
        const source = manualEntry.fundingSource || 'Cashflow';

        // Determine if this expense needs global deduction and how much
        const cat = budgetCats.find(c => c.id === manualEntry.budgetCategoryId);
        const catLimit = cat ? (parseFloat(cat.total) || 0) : 0;
        const catSpent = cat ? (variableSpentById[cat.id] || 0) : 0;
        const catAvailable = Math.max(0, catLimit - catSpent);
        const isAlreadyOver = cat && catLimit > 0 && catSpent >= catLimit;

        let deductAmt = 0;
        let needsDeduction = false;

        if (!cat || manualEntry.category === 'Otros' || manualEntry.category === 'ATM') {
            needsDeduction = true;
            deductAmt = amt;
        } else if (isAlreadyOver) {
            needsDeduction = true;
            deductAmt = amt;
        } else if (amt > catAvailable) {
            needsDeduction = true;
            deductAmt = amt - catAvailable;
        }

        if (needsDeduction && deductAmt > 0) {
            if (source === 'Cashflow' && deductAmt > CFD) {
                alert(`No tienes suficiente Cashflow. El pago extra es de Q${deductAmt.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} y solo tienes Q${CFD.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
                return;
            }
            if (source === 'Capital' && deductAmt > totalSavingsGTQ) {
                alert(`No tienes suficiente Capital. El pago extra es de Q${deductAmt.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} y solo tienes Q${totalSavingsGTQ.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
                return;
            }
        }

        await addExpense(manualEntry);

        // Global deduction when expense is outside budget
        if (needsDeduction && deductAmt > 0 && user?.uid) {
            const userRef = doc(db, 'users', user.uid);
            if (source === 'Cashflow') {
                const currentIncome = safeParse(finances.income);
                await updateDoc(userRef, { 'finances.income': currentIncome - deductAmt });
            } else if (source === 'Capital') {
                const targetAccId = manualEntry.accountId;
                if (!targetAccId) {
                    alert('Selecciona una cuenta de Capital.');
                    return;
                }
                const updatedAccounts = accounts.map(acc => {
                    if (acc.id === targetAccId) {
                        const deductInAccCurrency = acc.currency === 'USD' ? deductAmt / 7.75 : deductAmt;
                        return {
                            ...acc,
                            balance: safeParse(acc.balance) - deductInAccCurrency,
                            history: [
                                {
                                    id: Date.now().toString(),
                                    date: today(),
                                    amount: -deductInAccCurrency,
                                    source: `Gasto: ${manualEntry.description || manualEntry.category}`
                                },
                                ...(acc.history || [])
                            ]
                        };
                    }
                    return acc;
                });
                await updateDoc(userRef, { 'savings.accounts': updatedAccounts });
            }
        }

        setManualEntry(null);
    };

    // ──────────────── group expenses by day ────────────────
    const grouped = useMemo(() => {
        const map = {};
        thisMonthExpenses.forEach(e => {
            if (!map[e.date]) map[e.date] = [];
            map[e.date].push(e);
        });
        return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
    }, [thisMonthExpenses]);

    const budgetPct = TP > 0 ? Math.min(100, (TG / TP) * 100) : 0;
    const isOverBudget = TG > TP;

    // ──────────────── fixed expenses (one-tap) ────────────────
    const isPaidThisMonth = (catName) =>
        thisMonthExpenses.some(e => (e.category === catName || e.description === catName) && isActuallyFixed(e));

    const getPaidExpense = (catName) =>
        thisMonthExpenses.find(e => (e.category === catName || e.description === catName) && isActuallyFixed(e));

    const handleMarkPaid = async (cat) => {
        const amount = parseFloat(cat.total) || 0;
        if (amount <= 0) return;
        const newExp = {
            id: Date.now().toString(),
            amount,
            category: getSubCategory(cat),
            description: cat.name,
            date: today(),
            createdAt: new Date().toISOString(),
            isFixed: true,
            budgetCategoryId: cat.id
        };
        const updated = [newExp, ...expenses];
        setExpenses(updated);
        await persistExpenses(updated);
        trackEvent('fixed_expense_paid', { category: cat.name, amount });
    };

    const handleUnmarkPaid = async (cat) => {
        const exp = getPaidExpense(cat.name);
        if (!exp) return;
        const updated = expenses.filter(e => e.id !== exp.id);
        setExpenses(updated);
        await persistExpenses(updated);
    };

    const paidCount = budgetCats.filter(c => isPaidThisMonth(c.name)).length;

    // ──────────────── mini sparkline ────────────────
    const sparkMaxY = dailyData.reduce((m, d) => Math.max(m, d.ideal || 0, d.real || 0), 1);
    const toSvgY = (v) => 44 - Math.round((v / sparkMaxY) * 44);

    const buildPath = (arr, key) => {
        const pts = arr.filter(d => d[key] !== null);
        if (pts.length === 0) return '';
        const w = 320 / (arr.length - 1);
        return pts.map((d, i) => {
            const x = arr.findIndex(a => a.day === d.day) * w;
            return `${i === 0 ? 'M' : 'L'}${x},${toSvgY(d[key])}`;
        }).join(' ');
    };

    // (Calculations moved to useMemo)

    // ──────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6 pb-28">
            {/* ── MAIN BANNER — Dinero Disponible ── */}
            {(() => {
                const usedPct = TI > 0 ? (TG / TI) * 100 : 0;

                // Color by urgency - using full red/orange palette
                const getBlobColor = (pct) => {
                    if (pct > 75) return 'bg-red-500/20';
                    if (pct > 50) return 'bg-orange-500/20';
                    return 'bg-amber-500/10';
                };
                const blobColor = getBlobColor(usedPct);

                return (
                    <div className="glass-card p-6 md:p-8 relative overflow-hidden border border-white/5">
                        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] -mr-20 -mt-20 ${blobColor}`} />

                        {/* Rich Insights Box - Top Right */}
                        <div className="hidden lg:block absolute top-6 right-6 w-80 z-20">
                            <RichInsightsCard userData={userData} section="expenses" />
                        </div>

                        <div className="relative z-10">
                            {/* Hero: Total Gastado */}
                            <div className="mb-6">
                                <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500 mb-2">
                                    Total Gastado · {monthName}
                                </div>
                                <div className="text-4xl md:text-5xl font-black tracking-tighter text-orange-400">
                                    Q{TG.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                {/* progress bar */}
                                <div className="mt-4 h-2.5 bg-black/40 rounded-full overflow-hidden w-full max-w-sm">
                                    <div
                                        className="h-full rounded-full transition-all duration-700 bg-orange-500"
                                        style={{ width: `${Math.min(usedPct, 100)}%` }}
                                    />
                                </div>
                                <div className="mt-1.5 flex items-center gap-4 text-[10px]">
                                    <span className="flex items-center gap-1.5 font-bold text-aura-muted/60">
                                        <span className="w-2 h-2 rounded-full bg-orange-500" /> {usedPct.toFixed(0)}% utilizado
                                    </span>
                                    <span className="flex items-center gap-1.5 font-bold text-aura-muted/60">
                                        <span className="w-2 h-2 rounded-full bg-white/10" /> {(100 - usedPct).toFixed(0)}% disponible
                                    </span>
                                </div>
                            </div>

                            {/* Secondary Metrics */}
                            <div className="max-w-md grid grid-cols-2 gap-3">
                                <div className="flex flex-col p-3 rounded-xl border transition-all bg-orange-500/5 border-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.05)]">
                                    <div className="text-[10px] uppercase tracking-widest font-black mb-1 text-orange-400">
                                        Gastos Pendientes
                                    </div>
                                    <div className={`text-lg font-black ${TGP < 0 ? 'text-red-400' : 'text-orange-400'}`}>
                                        Q{TGP.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className={`flex flex-col p-3 rounded-xl border transition-all ${CFD >= 0 ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : 'bg-red-500/5 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)]'}`}>
                                    <div className={`text-[10px] uppercase tracking-widest font-black mb-1 ${CFD >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        CashFlow Disponible
                                    </div>
                                    <div className={`text-lg font-black ${CFD >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        Q{CFD.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── GASTOS FIJOS (Punto de Equilibrio) ── */}
            {(() => {
                const paidFixedCount = fixedBudgetCats.filter(c => isPaidThisMonth(c.name)).length;

                if (fixedBudgetCats.length === 0) return null;
                return (
                    <div className="glass-card p-4 md:p-6">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <div className="flex gap-2 items-center">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-orange-500">Gastos Fijos</h3>
                                    <span className="text-[9px] bg-orange-500/10 border border-orange-500/20 text-orange-500 px-1.5 py-0.5 rounded-md font-bold">{paidFixedCount} / {fixedBudgetCats.length} pagados</span>
                                </div>
                                <p className="text-[10px] text-aura-muted/60 mt-0.5">Selecciona un gasto para registrarlo como pagado este mes</p>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] uppercase tracking-widest text-aura-muted font-bold mb-0.5">Pendiente por Pagar</div>
                                <div className={`text-xl font-black ${GFP < 0 ? 'text-red-400' : 'text-orange-400'}`}>
                                    Q{GFP.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {fixedBudgetCats.map(cat => {
                                const paid = isPaidThisMonth(cat.name);
                                const paidExp = getPaidExpense(cat.name);
                                const catInfo = getCategoryByName(cat.name);
                                const Icon = catInfo.icon;
                                const amount = parseFloat(cat.total) || 0;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => paid ? handleUnmarkPaid(cat) : handleMarkPaid(cat)}
                                        disabled={loading}
                                        className={`relative p-3 rounded-2xl border transition-all duration-300 text-left active:scale-95 ${paid
                                            ? 'bg-aura-primary/10 border-aura-primary/30 shadow-[0_0_12px_rgba(0,255,196,0.1)]'
                                            : 'bg-white/[0.03] border-white/5 hover:bg-white/5 hover:border-white/10'
                                            }`}
                                    >
                                        {paid && (
                                            <div className="absolute top-2 right-2">
                                                <Check size={14} className="text-aura-primary" />
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                                style={{ backgroundColor: paid ? '#00ffc422' : catInfo.color + '22', color: paid ? '#00ffc4' : catInfo.color }}>
                                                <Icon size={14} />
                                            </div>
                                            <span className={`text-[11px] font-bold truncate ${paid ? 'text-aura-primary' : 'text-white'}`}>
                                                {cat.name}
                                            </span>
                                        </div>
                                        <div className={`text-xs font-black ${paid ? 'text-aura-primary' : 'text-white'}`}>
                                            Q{amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        {paid && paidExp && (
                                            <div className="text-[9px] text-aura-primary/60 mt-1 flex items-center gap-1">
                                                <Calendar size={9} /> {formatDate(paidExp.date)}
                                            </div>
                                        )}
                                        {!paid && (
                                            <div className="text-[9px] text-amber-400/60 mt-1">Pendiente</div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                    </div>
                );
            })()}


            {/* ── GASTOS VARIABLES ── */}
            {(() => {
                const historyGrouped = Object.entries(
                    thisMonthExpenses.reduce((acc, exp) => {
                        const d = exp.date || today();
                        if (!acc[d]) acc[d] = [];
                        acc[d].push(exp);
                        return acc;
                    }, {})
                ).sort((a, b) => b[0].localeCompare(a[0]));

                return (
                    <>
                        <div className="glass-card p-4 md:p-6 mt-4">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-orange-500">Gastos Variables</h3>
                                    <p className="text-[10px] text-aura-muted/60 mt-0.5">Selecciona una categoría para registrar un consumo. Si tu gasto no se clasifica en ninguna de las categorías actuales, selecciona "Otros".</p>
                                </div>
                                <div className="flex items-start gap-4">
                                    {GVE > 0 && (
                                        <div className="text-right">
                                            <div className="text-[10px] uppercase tracking-widest text-red-400 font-bold mb-0.5 flex items-center justify-end gap-1 whitespace-nowrap">
                                                <AlertTriangle size={10} strokeWidth={3} />
                                                Gastado de más
                                            </div>
                                            <div className="text-xl font-black text-red-400">
                                                Q{GVE.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    )}
                                    <div className="text-right">
                                        <div className="text-[10px] uppercase tracking-widest text-aura-muted font-bold mb-0.5 whitespace-nowrap">Pendiente por gastar</div>
                                        <div className={`text-xl font-black ${GVP < 0 ? 'text-red-400' : 'text-orange-400'}`}>
                                            Q{GVP.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ════ VARIABLE CATEGORY CARDS ════ */}
                            <div className="mb-6">
                                {(() => {
                                    // If we ARE in a sub-view
                                    if (selectedVarCategory) {
                                        const subItems = variableBudgetCats.filter(c => getSubCategory(c) === selectedVarCategory);

                                        return (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <button
                                                        onClick={() => setSelectedVarCategory(null)}
                                                        className="flex items-center gap-2 text-aura-muted hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest"
                                                    >
                                                        <Undo2 size={14} />
                                                        Volver
                                                    </button>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                                        <span className="text-[10px] text-orange-500 font-black uppercase tracking-widest">{selectedVarCategory}</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                                    {subItems.length > 0 ? (
                                                        subItems.map(cat => {
                                                            const catInfo = getCategoryByName(cat.name);
                                                            const Icon = catInfo.icon;
                                                            const spent = thisMonthExpenses.filter(e => e.budgetCategoryId === cat.id || (!e.budgetCategoryId && e.description === cat.name)).reduce((sum, e) => sum + (e.amount || 0), 0);
                                                            const limit = parseFloat(cat.total) || 0;
                                                            const available = limit - spent;
                                                            const isOver = limit > 0 && spent > limit;
                                                            const isComplete = limit > 0 && spent >= limit && !isOver;

                                                            return (
                                                                <button
                                                                    key={cat.id}
                                                                    onClick={() => {
                                                                        setConfirmEntry({
                                                                            amount: '',
                                                                            category: getSubCategory(cat),
                                                                            description: cat.name,
                                                                            budgetCategoryId: cat.id
                                                                        });
                                                                    }}
                                                                    className={`relative p-3 rounded-2xl border transition-all duration-300 text-left hover:bg-white/5 active:scale-95 ${isOver ? 'bg-red-500/10 border-red-500/30' : isComplete ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.03] border-white/5'
                                                                        }`}
                                                                >
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                                                                style={{ backgroundColor: isOver ? '#ef444422' : isComplete ? '#10b98122' : catInfo.color + '22', color: isOver ? '#ef4444' : isComplete ? '#10b981' : catInfo.color }}>
                                                                                <Icon size={14} />
                                                                            </div>
                                                                            <span className={`text-[11px] font-bold truncate ${isOver ? 'text-red-400' : isComplete ? 'text-emerald-400' : 'text-white'}`}>
                                                                                {cat.name}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-right shrink-0">
                                                                            <div className={`text-[10px] font-black ${isOver ? 'text-red-400' : isComplete ? 'text-emerald-400' : 'text-aura-primary'}`}>
                                                                                Q{Math.abs(available).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                            </div>
                                                                            <div className={`text-[8px] uppercase tracking-tighter font-bold ${isOver ? 'text-red-400/60' : isComplete ? 'text-emerald-400/60' : 'text-aura-muted'}`}>
                                                                                {isOver ? 'Excedido' : isComplete ? '✓ Completado' : 'Disponible'}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="mt-auto">
                                                                        {/* Progress bar per card */}
                                                                        <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-2">
                                                                            <div
                                                                                className={`h-full transition-all duration-500 ${isOver ? 'bg-red-500' : isComplete ? 'bg-emerald-500' : 'bg-aura-primary'}`}
                                                                                style={{ width: `${limit > 0 ? (isOver ? Math.min(((spent - limit) / limit) * 100, 100) : (spent / limit) * 100) : 0}%` }}
                                                                            />
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[8px] uppercase tracking-tighter font-bold text-aura-muted">Gastado</span>
                                                                                <span className={`text-[10px] font-black ${isOver ? 'text-red-400' : isComplete ? 'text-emerald-400' : 'text-white'}`}>
                                                                                    Q{spent.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                </span>
                                                                            </div>
                                                                            <div className={`text-[11px] font-black shrink-0 text-right self-end ${isOver ? 'text-red-400' : isComplete ? 'text-emerald-400' : 'text-aura-primary'}`}>
                                                                                {limit > 0 ? Math.round((spent / limit) * 100) : 0}%
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="col-span-full py-12 text-center bg-white/5 border border-dashed border-white/10 rounded-3xl">
                                                            <p className="text-aura-muted text-xs">No hay ítems específicos presupuestados en esta categoría.</p>
                                                            {selectedVarCategory === 'Otros' && (
                                                                <button
                                                                    onClick={() => setConfirmEntry({ amount: '', category: 'Otros', description: '', budgetCategoryId: null })}
                                                                    className="mt-4 px-4 py-2 bg-orange-500/20 text-orange-500 border border-orange-500/30 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all"
                                                                >
                                                                    Registrar Gasto Directo
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }

                                    // ──────── VIEW 1: MAIN SUPER-CATEGORIES ────────
                                    const groups = variableBudgetCats.reduce((acc, cat) => {
                                        const superCat = getSubCategory(cat);
                                        if (!acc[superCat]) acc[superCat] = [];
                                        acc[superCat].push(cat);
                                        return acc;
                                    }, {});

                                    const superCatsToShow = Object.keys(groups)
                                        .filter(name => name !== 'Otros')
                                        .sort((a, b) => {
                                            if (a === 'Vivienda & Servicios') return -1;
                                            if (b === 'Vivienda & Servicios') return 1;
                                            return a.localeCompare(b);
                                        });

                                    return (
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                            {/* 1. SUPER CATEGORY CARDS */}
                                            {superCatsToShow.map(name => {
                                                const items = groups[name];
                                                const catInfo = getCategoryByName(name);
                                                const Icon = catInfo.icon;
                                                const totalLimit = items.reduce((s, c) => s + (parseFloat(c.total) || 0), 0);
                                                const totalSpent = variableSpentByCategory[name] || 0;

                                                // Check if ANY sub-item is individually over its own budget
                                                let totalOverAmount = 0;
                                                const hasAnySubItemOver = items.some(cat => {
                                                    const catLimit = parseFloat(cat.total) || 0;
                                                    const catSpent = thisMonthExpenses
                                                        .filter(e => e.budgetCategoryId === cat.id || (!e.budgetCategoryId && e.description === cat.name))
                                                        .reduce((sum, e) => sum + (e.amount || 0), 0);
                                                    if (catLimit > 0 && catSpent > catLimit) {
                                                        totalOverAmount += (catSpent - catLimit);
                                                        return true;
                                                    }
                                                    return false;
                                                });

                                                const isOver = totalSpent > totalLimit || hasAnySubItemOver;
                                                const isComplete = totalLimit > 0 && totalSpent >= totalLimit && !isOver;

                                                return (
                                                    <button
                                                        key={name}
                                                        onClick={() => setSelectedVarCategory(name)}
                                                        className={`relative p-3 rounded-2xl border transition-all duration-300 text-left hover:bg-white/5 active:scale-95 ${isOver ? 'bg-red-500/10 border-red-500/30' : isComplete ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.03] border-white/5'
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                                                    style={{ backgroundColor: isOver ? '#ef444422' : isComplete ? '#10b98122' : catInfo.color + '22', color: isOver ? '#ef4444' : isComplete ? '#10b981' : catInfo.color }}>
                                                                    <Icon size={14} />
                                                                </div>
                                                                <span className={`text-[11px] font-bold truncate ${isOver ? 'text-red-400' : isComplete ? 'text-emerald-400' : 'text-white'}`}>
                                                                    {name}
                                                                </span>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <div className={`text-[10px] font-black ${isOver ? 'text-red-400' : isComplete ? 'text-emerald-400' : 'text-aura-primary'}`}>
                                                                    Q{Math.abs(totalLimit - totalSpent).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </div>
                                                                <div className={`text-[8px] uppercase tracking-tighter font-bold ${isOver ? 'text-red-400/60' : isComplete ? 'text-emerald-400/60' : 'text-aura-muted'}`}>
                                                                    {isOver ? 'Excedido' : isComplete ? '✓ Completado' : 'Disponible'}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="mt-auto">
                                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-2">
                                                                <div
                                                                    className={`h-full transition-all duration-500 ${isOver ? 'bg-red-500' : isComplete ? 'bg-emerald-500' : 'bg-white/20'}`}
                                                                    style={{ width: `${totalLimit > 0 ? (isOver ? Math.min(((totalSpent - totalLimit) / totalLimit) * 100, 100) : (totalSpent / totalLimit) * 100) : 0}%` }}
                                                                />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[8px] uppercase tracking-tighter font-bold text-aura-muted">Gastado</span>
                                                                    <span className={`text-[10px] font-black ${isOver ? 'text-red-400' : isComplete ? 'text-emerald-400' : 'text-white'}`}>
                                                                        Q{totalSpent.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                                <div className={`text-[11px] font-black shrink-0 text-right self-end ${isOver ? 'text-red-400' : isComplete ? 'text-emerald-400' : 'text-aura-primary'}`}>
                                                                    {totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0}%
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}

                                            {/* 2. OTROS CATEGORY CARD (Logic-driven items or unbudgeted spending) */}
                                            {(groups['Otros'] || variableSpentByCategory['Otros'] > 0) && (() => {
                                                const name = 'Otros';
                                                const items = groups[name] || [];
                                                const catInfo = getCategoryByName(name);
                                                const Icon = catInfo.icon;
                                                const totalLimit = items.reduce((s, c) => s + (parseFloat(c.total) || 0), 0);
                                                const totalSpent = variableSpentByCategory[name] || 0;
                                                const isOver = totalSpent > totalLimit;
                                                const isComplete = totalLimit > 0 && totalSpent >= totalLimit && !isOver;

                                                return (
                                                    <button
                                                        key={name}
                                                        onClick={() => setSelectedVarCategory(name)}
                                                        className={`relative p-3 rounded-2xl border transition-all duration-300 text-left hover:bg-white/5 active:scale-95 ${isOver ? 'bg-red-500/10 border-red-500/30' : isComplete ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.03] border-white/5'
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                                                    style={{ backgroundColor: isOver ? '#ef444422' : isComplete ? '#10b98122' : catInfo.color + '22', color: isOver ? '#ef4444' : isComplete ? '#10b981' : catInfo.color }}>
                                                                    <Icon size={14} />
                                                                </div>
                                                                <span className={`text-[11px] font-bold truncate ${isOver ? 'text-red-400' : isComplete ? 'text-emerald-400' : 'text-white'}`}>
                                                                    {name}
                                                                </span>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <div className={`text-[10px] font-black ${isOver ? 'text-red-400' : isComplete ? 'text-emerald-400' : 'text-aura-primary'}`}>
                                                                    Q{Math.abs(totalLimit - totalSpent).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </div>
                                                                <div className={`text-[8px] uppercase tracking-tighter font-bold ${isOver ? 'text-red-400/60' : isComplete ? 'text-emerald-400/60' : 'text-aura-muted'}`}>
                                                                    {isOver ? 'Excedido' : isComplete ? '✓ Completado' : 'Disponible'}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="mt-auto">
                                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-2">
                                                                <div
                                                                    className={`h-full transition-all duration-500 ${isOver ? 'bg-red-500' : isComplete ? 'bg-emerald-500' : 'bg-white/20'}`}
                                                                    style={{ width: `${totalLimit > 0 ? (isOver ? Math.min(((totalSpent - totalLimit) / totalLimit) * 100, 100) : (totalSpent / totalLimit) * 100) : 0}%` }}
                                                                />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[8px] uppercase tracking-tighter font-bold text-aura-muted">Gastado</span>
                                                                    <span className={`text-[10px] font-black ${isOver ? 'text-red-400' : isComplete ? 'text-emerald-400' : 'text-white'}`}>
                                                                        Q{totalSpent.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                                <div className={`text-[11px] font-black shrink-0 text-right self-end ${isOver ? 'text-red-400' : isComplete ? 'text-emerald-400' : 'text-aura-primary'}`}>
                                                                    {totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0}%
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })()}

                                            {/* 3. ATM CARD (Retiro de Efectivo) */}
                                            <button
                                                onClick={() => setShowCashWithdrawal(true)}
                                                className="relative p-3 rounded-2xl border bg-amber-500/5 border-amber-500/10 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all duration-300 text-left active:scale-95 group"
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                                                        <Wallet size={14} />
                                                    </div>
                                                    <span className="text-[11px] font-black text-amber-500 uppercase tracking-widest leading-tight">
                                                        Retiro de Efectivo
                                                    </span>
                                                </div>
                                                <div className="text-[9px] text-amber-500/70 font-bold group-hover:text-amber-500">
                                                    ATM
                                                </div>
                                            </button>

                                            {/* 4. OTROS ADD BUTTON (Gasto directo / Agregar Otros) */}
                                            <button
                                                onClick={() => {
                                                    setConfirmEntry({
                                                        amount: '',
                                                        category: 'Otros',
                                                        description: '',
                                                        budgetCategoryId: null,
                                                        fundingSource: 'Cashflow'
                                                    });
                                                }}
                                                className="relative p-3 rounded-2xl border bg-purple-500/5 border-purple-500/10 hover:bg-purple-500/10 hover:border-purple-500/30 transition-all duration-300 text-left active:scale-95 group"
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-500 flex items-center justify-center shrink-0">
                                                        <Plus size={14} />
                                                    </div>
                                                    <span className="text-[11px] font-black text-purple-500 uppercase tracking-widest">
                                                        Otros
                                                    </span>
                                                </div>
                                                <div className="text-[9px] text-purple-500/70 font-bold group-hover:text-purple-500">
                                                    Agregar Gasto
                                                </div>
                                            </button>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* ── TRANSACTION HISTORY BLOCK ── */}
                        <div className="glass-card p-4 md:p-6 mt-4">
                            <div className="mb-4">
                                <h3 className="text-sm font-bold text-white uppercase tracking-widest text-aura-primary">Historial de Transacciones</h3>
                                <p className="text-[10px] text-aura-muted mt-0.5">Todos tus gastos del mes, listados por día.</p>
                            </div>
                            <div className="space-y-3">
                                {historyGrouped.length === 0 ? (
                                    <div className="p-8 text-center border border-dashed border-white/5 rounded-2xl">
                                        <Receipt size={32} className="mx-auto mb-3 text-aura-muted opacity-30" />
                                        <p className="text-aura-muted text-xs">Aún no hay gastos este mes.</p>
                                    </div>
                                ) : (
                                    historyGrouped.map(([date, items]) => {
                                        const isToday = date === today();
                                        const isCollapsed = isToday ? (collapsedDays[date] === true) : (collapsedDays[date] !== false);
                                        const dayTotal = items.reduce((s, e) => s + (e.amount || 0), 0);
                                        return (
                                            <div key={date} className="rounded-2xl border bg-white/[0.02] border-white/5 overflow-hidden transition-all">
                                                <button
                                                    onClick={() => setCollapsedDays(prev => ({ ...prev, [date]: !isCollapsed }))}
                                                    className={`w-full flex justify-between items-center p-4 transition-all hover:bg-white/[0.04] ${isToday ? 'bg-orange-500/5' : ''}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white/5 text-aura-muted">
                                                            <Calendar size={14} />
                                                        </div>
                                                        <div className="text-left">
                                                            <div className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-orange-500' : 'text-white'}`}>
                                                                {formatDate(date)} {isToday && <span className="ml-1 text-[9px] bg-orange-500/20 text-orange-500 px-1.5 py-0.5 rounded-sm">HOY</span>}
                                                            </div>
                                                            <div className="text-[10px] text-aura-muted mt-0.5">{items.length} transacción{items.length !== 1 ? 'es' : ''}</div>
                                                        </div>
                                                    </div>
                                                    <div className={`text-base font-black ${isToday ? 'text-orange-400' : 'text-white'}`}>
                                                        Q{dayTotal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                </button>

                                                {!isCollapsed && (
                                                    <div className="border-t border-white/5 p-3 space-y-2 bg-black/20">
                                                        {items.map(exp => {
                                                            const catInfo = getCategoryByName(exp.category);
                                                            const Icon = catInfo.icon;
                                                            return (
                                                                <div key={exp.id} className="p-3 rounded-xl flex items-center gap-3 group hover:bg-white/5 transition-all">
                                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                                                        style={{ backgroundColor: catInfo.color + '22', color: catInfo.color }}>
                                                                        <Icon size={14} />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-[11px] font-bold text-white truncate">{exp.description || exp.category}</div>
                                                                        <div className="text-[9px] text-aura-muted">{catInfo.name}</div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="text-right">
                                                                            <div className="text-xs font-black text-white">Q{exp.amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => deleteExpense(exp.id)}
                                                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </>
                );
            })()}

            {/* ═══════════════ CONFIRM ENTRY MODAL ═══════════════ */}
            {
                confirmEntry && (() => {
                    const cat = budgetCats.find(c => c.id === confirmEntry.budgetCategoryId);
                    const limit = cat ? (parseFloat(cat.total) || 0) : 0;
                    const spent = cat ? (variableSpentById[cat.id] || 0) : 0;
                    const available = Math.max(0, limit - spent);
                    const enteredAmt = parseFloat(confirmEntry.amount) || 0;
                    const excess = cat && limit > 0 ? Math.max(0, enteredAmt - available) : 0;
                    const isAlreadyOver = cat && limit > 0 && spent >= limit;
                    // Show source selector if: no budget cat, already over, is Otros/ATM, OR new entry would exceed budget
                    const showSourceSelector = !cat || isAlreadyOver || confirmEntry.category === 'Otros' || confirmEntry.category === 'ATM' || (enteredAmt > 0 && excess > 0);

                    return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <div className="glass-card rounded-3xl p-6 w-full max-w-sm border border-orange-500/20 text-center shadow-2xl">
                                <div className="w-16 h-16 mx-auto bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mb-4">
                                    <span className="text-3xl">✓</span>
                                </div>
                                <h3 className="text-xs font-bold text-aura-muted uppercase tracking-widest mb-1">Confirmar Gasto Rapido</h3>
                                <div className="flex justify-center items-center mb-4 relative">
                                    <span className="text-3xl font-black text-white mr-1">Q</span>
                                    <input
                                        autoFocus={!confirmEntry.amount}
                                        type="number"
                                        placeholder="0.00"
                                        value={confirmEntry.amount}
                                        onChange={e => setConfirmEntry(p => ({ ...p, amount: e.target.value }))}
                                        className="bg-transparent text-3xl font-black text-white w-28 outline-none text-center placeholder-white/20"
                                    />
                                </div>
                                <input
                                    type="text"
                                    value={confirmEntry.description}
                                    onChange={e => {
                                        const val = e.target.value;
                                        const cap = val ? val.charAt(0).toUpperCase() + val.slice(1) : '';
                                        setConfirmEntry(p => ({ ...p, description: cap }));
                                    }}
                                    className="w-full mb-3 bg-black/30 border border-orange-500/20 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-orange-500/50 text-center"
                                    placeholder="Nombre del gasto"
                                />
                                <select
                                    value={confirmEntry.category}
                                    disabled
                                    className="w-full mb-3 bg-black/30 border border-orange-500/20 rounded-xl px-4 py-3 text-orange-500 font-bold outline-none appearance-none text-center opacity-80 cursor-not-allowed"
                                >
                                    {CATEGORY_MAP.map(c => (
                                        <option key={c.name} value={c.name} className="bg-[#0a0a0c] text-white text-left">{c.name}</option>
                                    ))}
                                </select>

                                {showSourceSelector && (
                                    <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        {/* Breakdown info when partially covered by budget */}
                                        {cat && limit > 0 && !isAlreadyOver && excess > 0 && enteredAmt > 0 && (
                                            <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left">
                                                <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-1">Distribución del pago</div>
                                                <div className="flex justify-between text-xs text-white/70 mb-0.5">
                                                    <span>Tu presupuesto cubre</span>
                                                    <span className="font-bold text-emerald-400">Q{available.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="flex justify-between text-xs text-white/70">
                                                    <span>Pagarás extra</span>
                                                    <span className="font-bold text-red-400">Q{excess.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        )}
                                        <label className="text-[10px] uppercase tracking-widest text-aura-muted font-bold block mb-1">¿De dónde cobrar el extra?</label>
                                        <div className="flex gap-2">
                                            {[{ val: 'Cashflow', label: 'Cashflow' }, { val: 'Capital', label: 'Capital' }].map(opt => {
                                                const isSelected = (confirmEntry.fundingSource || 'Cashflow') === opt.val;
                                                return (
                                                    <button
                                                        key={opt.val}
                                                        type="button"
                                                        onClick={() => setConfirmEntry(p => ({ ...p, fundingSource: opt.val }))}
                                                        className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all border ${isSelected
                                                            ? 'bg-orange-500/20 border-orange-500/40 text-orange-500'
                                                            : 'bg-white/5 border-white/10 text-aura-muted hover:bg-white/10'
                                                            }`}
                                                    >
                                                        {opt.label}
                                                        <div className="text-[9px] font-normal opacity-70 mt-0.5">
                                                            Disp: Q{(opt.val === 'Cashflow' ? CFD : totalSavingsGTQ).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {/* Account selector when Capital is chosen */}
                                        {(confirmEntry.fundingSource || 'Cashflow') === 'Capital' && accounts.length > 0 && (
                                            <div className="mt-2">
                                                <label className="text-[10px] uppercase tracking-widest text-aura-muted font-bold block mb-1">Cuenta</label>
                                                <select
                                                    value={confirmEntry.accountId || ''}
                                                    onChange={e => setConfirmEntry(p => ({ ...p, accountId: e.target.value }))}
                                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold text-sm outline-none focus:border-orange-500/50 appearance-none"
                                                >
                                                    <option value="" className="bg-[#0a0a0c]">Seleccionar cuenta...</option>
                                                    {accounts.map(acc => {
                                                        const bal = parseFloat(acc.balance) || 0;
                                                        const balGTQ = acc.currency === 'USD' ? bal * 7.75 : bal;
                                                        return (
                                                            <option key={acc.id} value={acc.id} className="bg-[#0a0a0c]">
                                                                {acc.name} — {acc.currency === 'USD' ? '$' : 'Q'}{bal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (~Q{balGTQ.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <button onClick={() => setConfirmEntry(null)} className="flex-1 py-3 rounded-xl border border-white/10 text-aura-muted font-bold text-sm hover:bg-white/5 transition-all">Cancelar</button>
                                    <button onClick={confirmAdd} disabled={loading} className="flex-1 py-3 rounded-xl bg-orange-500 text-black font-black text-sm hover:opacity-90 transition-all disabled:opacity-50">
                                        {loading ? '...' : 'Aceptar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }

            {/* ═══════════════ MANUAL ENTRY MODAL ═══════════════ */}
            {
                manualEntry && (() => {
                    const cat = budgetCats.find(c => c.id === manualEntry.budgetCategoryId);
                    const limit = cat ? (parseFloat(cat.total) || 0) : 0;
                    const spent = cat ? (variableSpentById[cat.id] || 0) : 0;
                    const isOver = cat && limit > 0 && spent >= limit;
                    const showSourceSelector = !cat || isOver || manualEntry.category === 'Otros' || manualEntry.category === 'ATM';

                    return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <div className="glass-card rounded-3xl p-6 w-full max-w-sm border border-white/10">
                                <h3 className="font-bold text-white text-lg mb-5">Agregar gasto</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-widest text-aura-muted font-bold">Monto (Q)</label>
                                        <input
                                            autoFocus
                                            type="number"
                                            placeholder="0.00"
                                            value={manualEntry.amount}
                                            onChange={e => setManualEntry(p => ({ ...p, amount: e.target.value }))}
                                            className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white font-black text-xl outline-none focus:border-aura-primary/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-widest text-aura-muted font-bold">Categoría</label>
                                        <select
                                            value={manualEntry.category}
                                            onChange={e => setManualEntry(p => ({ ...p, category: e.target.value }))}
                                            className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white font-semibold outline-none focus:border-aura-primary/50"
                                        >
                                            {CATEGORY_MAP.map(c => (
                                                <option key={c.name} value={c.name} className="bg-[#0a0a0c]">{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-widest text-aura-muted font-bold">Descripción</label>
                                        <input
                                            type="text"
                                            value={manualEntry.description}
                                            onChange={e => setManualEntry(p => ({ ...p, description: e.target.value }))}
                                            className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white font-semibold outline-none focus:border-aura-primary/50"
                                            placeholder="Descripción opcional"
                                        />
                                    </div>

                                    {showSourceSelector && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-[10px] uppercase tracking-widest text-aura-muted font-bold">Fuente</label>
                                            <div className="flex gap-2 mt-1">
                                                {[{ val: 'Cashflow', label: 'Cashflow' }, { val: 'Capital', label: 'Capital' }].map(opt => {
                                                    const isSelected = (manualEntry.fundingSource || 'Cashflow') === opt.val;
                                                    return (
                                                        <button
                                                            key={opt.val}
                                                            type="button"
                                                            onClick={() => setManualEntry(p => ({ ...p, fundingSource: opt.val }))}
                                                            className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all border ${isSelected
                                                                ? 'bg-aura-primary/20 border-aura-primary/40 text-aura-primary'
                                                                : 'bg-white/5 border-white/10 text-aura-muted hover:bg-white/10'
                                                                }`}
                                                        >
                                                            {opt.label}
                                                            <div className="text-[9px] font-normal opacity-70 mt-0.5">
                                                                Disp: Q{(opt.val === 'Cashflow' ? CFD : totalSavingsGTQ).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Account selector when Capital is chosen in manual entry */}
                                    {showSourceSelector && (manualEntry.fundingSource || 'Cashflow') === 'Capital' && accounts.length > 0 && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-[10px] uppercase tracking-widest text-aura-muted font-bold block mb-1">Cuenta de Capital</label>
                                            <select
                                                value={manualEntry.accountId || ''}
                                                onChange={e => setManualEntry(p => ({ ...p, accountId: e.target.value }))}
                                                className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white font-semibold outline-none focus:border-aura-primary/50 appearance-none"
                                            >
                                                <option value="" className="bg-[#0a0a0c]">Seleccionar cuenta...</option>
                                                {accounts.map(acc => {
                                                    const bal = parseFloat(acc.balance) || 0;
                                                    const balGTQ = acc.currency === 'USD' ? bal * 7.75 : bal;
                                                    return (
                                                        <option key={acc.id} value={acc.id} className="bg-[#0a0a0c]">
                                                            {acc.name} — {acc.currency === 'USD' ? '$' : 'Q'}{bal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (~Q{balGTQ.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-[10px] uppercase tracking-widest text-aura-muted font-bold">Fecha</label>
                                        <input
                                            type="date"
                                            value={manualEntry.date}
                                            onChange={e => setManualEntry(p => ({ ...p, date: e.target.value }))}
                                            className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white font-semibold outline-none focus:border-aura-primary/50"
                                        />
                                    </div>
                                    {/* Budget category link */}
                                    {budgetCats.length > 0 && (
                                        <div>
                                            <label className="text-[10px] uppercase tracking-widest text-aura-muted font-bold">Vincular a presupuesto</label>
                                            <select
                                                value={manualEntry.budgetCategoryId || ''}
                                                onChange={e => setManualEntry(p => ({ ...p, budgetCategoryId: e.target.value || null }))}
                                                className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white font-semibold outline-none focus:border-aura-primary/50"
                                            >
                                                <option value="" className="bg-[#0a0a0c]">— Sin vincular —</option>
                                                {budgetCats.map(c => (
                                                    <option key={c.id} value={c.id} className="bg-[#0a0a0c]">{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button onClick={() => setManualEntry(null)} className="flex-1 py-3 rounded-xl border border-white/10 text-aura-muted font-bold text-sm hover:bg-white/5 transition-all">Cancelar</button>
                                    <button onClick={handleManualSubmit} disabled={loading || !manualEntry.amount} className="flex-1 py-3 rounded-xl bg-aura-primary text-black font-black text-sm hover:bg-[#00e6b0] transition-all disabled:opacity-50">
                                        {loading ? 'Guardando...' : '✓ Guardar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }



            {/* ═══════════════ CASH WITHDRAWAL MODAL ═══════════════ */}
            {
                showCashWithdrawal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="glass-card rounded-3xl p-6 w-full max-w-sm border border-amber-500/20">
                            <h3 className="font-bold text-amber-400 text-lg mb-5 flex items-center gap-2"><Wallet size={20} /> Retiro de Efectivo</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-aura-muted font-bold">Monto (Q)</label>
                                    <input
                                        autoFocus
                                        type="number"
                                        placeholder="0.00"
                                        value={cashWithdrawal.amount}
                                        onChange={e => setCashWithdrawal(p => ({ ...p, amount: e.target.value }))}
                                        className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white font-black text-xl outline-none focus:border-amber-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-aura-muted font-bold">Fuente</label>
                                    <div className="flex gap-2 mt-1">
                                        {[{ val: 'Cashflow', label: 'Cashflow' }, { val: 'Capital', label: 'Capital' }].map(opt => {
                                            const isSelected = cashWithdrawal.source === opt.val;
                                            return (
                                                <button
                                                    key={opt.val}
                                                    type="button"
                                                    onClick={() => setCashWithdrawal(p => ({ ...p, source: opt.val, accountId: opt.val === 'Cashflow' ? '' : p.accountId }))}
                                                    className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all border ${isSelected
                                                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                                        : 'bg-white/5 border-white/10 text-aura-muted hover:bg-white/10'
                                                        }`}
                                                >
                                                    {opt.label}
                                                    <div className="text-[9px] font-normal opacity-70 mt-0.5">
                                                        Disp: Q{(opt.val === 'Cashflow' ? CFD : totalSavingsGTQ).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {
                                    cashWithdrawal.source === 'Capital' && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-[10px] uppercase tracking-widest text-aura-muted font-bold">Seleccionar Cuenta</label>
                                            <select
                                                value={cashWithdrawal.accountId}
                                                onChange={e => setCashWithdrawal(p => ({ ...p, accountId: e.target.value }))}
                                                className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white font-semibold outline-none focus:border-amber-500/50 appearance-none"
                                            >
                                                <option value="" disabled className="bg-slate-900">Elegir cuenta...</option>
                                                {accounts.map(acc => (
                                                    <option key={acc.id} value={acc.id} className="bg-slate-900">
                                                        {acc.name} (Q{parseFloat(acc.balance).toLocaleString()})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )
                                }
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-aura-muted font-bold">Descripción (opcional)</label>
                                    <input
                                        type="text"
                                        value={cashWithdrawal.description}
                                        onChange={e => setCashWithdrawal(p => ({ ...p, description: e.target.value }))}
                                        className="w-full mt-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white font-semibold outline-none focus:border-amber-500/50"
                                        placeholder="Ej: ATM Banrural"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowCashWithdrawal(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-aura-muted font-bold text-sm hover:bg-white/5 transition-all">Cancelar</button>
                                <button onClick={handleCashWithdrawal} disabled={loading || !cashWithdrawal.amount || (cashWithdrawal.source === 'Capital' && !cashWithdrawal.accountId)} className="flex-1 py-3 rounded-xl bg-amber-500 text-black font-black text-sm hover:bg-amber-400 transition-all disabled:opacity-50">
                                    {loading ? 'Guardando...' : '💰 Registrar Retiro'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

