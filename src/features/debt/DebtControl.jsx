import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc, getDoc } from '../../services/backendFirestore.js';
import { trackEvent } from '../../lib/analytics';
import { Target, Zap, Building2, User, Plus, ChevronLeft, Calendar, Info, Check, CreditCard, AlertCircle, Play, Save, Trash2, Home, Car, Landmark, Briefcase, PlusCircle, X, Activity, DollarSign, History, ArrowDownCircle, ChevronDown, ChevronRight, Banknote, Wallet, Clock } from 'lucide-react';
import RichInsightsCard from '../insights/RichInsightsCard';
import { calculateCashflowMetrics } from '../../lib/expenseLogic';

const GUATEMALA_BANKS = [
    { name: 'Banco Industrial', color: 'bg-blue-600', initial: 'BI' },
    { name: 'Banrural', color: 'bg-green-700', initial: 'BR' },
    { name: 'BAC Credomatic', color: 'bg-red-600', initial: 'BAC' },
    { name: 'BAM (Banco Agromercantil)', color: 'bg-yellow-500', initial: 'BAM' },
    { name: 'G&T Continental', color: 'bg-blue-800', initial: 'G&T' },
    { name: 'Banco Promerica', color: 'bg-blue-900', initial: 'P' },
    { name: 'Interbanco', color: 'bg-teal-600', initial: 'IB' },
    { name: 'Micoope', color: 'bg-emerald-600', initial: 'MC' },
    { name: 'Banco CHN', color: 'bg-blue-700', initial: 'CHN' },
    { name: 'Banco Ficohsa', color: 'bg-indigo-700', initial: 'F' },
    { name: 'Otro', color: 'bg-gray-600', initial: '?' }
];

const MONTHS_SPANISH = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    // 2 years back, 2 years forward
    for (let i = -24; i <= 24; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const val = d.toISOString().substring(0, 7);
        const label = `${MONTHS_SPANISH[d.getMonth()]} ${d.getFullYear()}`;
        options.push({ val, label });
    }
    return options;
};

const FINANCIAL_CONCEPTS = [
    { label: 'Tarjeta de Crédito', icon: CreditCard },
    { label: 'Préstamo Personal', icon: Landmark },
    { label: 'Préstamo de Vehículo', icon: Car },
    { label: 'Préstamo Hipotecario', icon: Home },
    { label: 'Extra-financiamiento', icon: Zap },
    { label: 'Crédito de Consumo', icon: Briefcase },
    { label: 'Otro', icon: PlusCircle }
];

const PERSONAL_CONCEPTS = [
    { label: 'Préstamo de Familiar', icon: User },
    { label: 'Préstamo de Amigo', icon: User },
    { label: 'Compra Compartida', icon: Briefcase },
    { label: 'Emergencia', icon: AlertCircle },
    { label: 'Adelanto', icon: Zap },
    { label: 'Otro', icon: PlusCircle }
];

const BankLogo = ({ name, type }) => {
    if (type === 'personal') {
        return (
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg border border-white/20">
                <User size={24} />
            </div>
        );
    }

    const bank = GUATEMALA_BANKS.find(b => b.name === name) || GUATEMALA_BANKS[GUATEMALA_BANKS.length - 1];

    return (
        <div className={`w-12 h-12 rounded-2xl ${bank.color} flex items-center justify-center text-white font-black text-xs shadow-lg border border-white/20 tracking-tighter`}>
            {bank.initial}
        </div>
    );
};

const ConceptIcon = ({ title, size = 20 }) => {
    const concept = FINANCIAL_CONCEPTS.find(c => c.label === title) || FINANCIAL_CONCEPTS[FINANCIAL_CONCEPTS.length - 1];
    const Icon = concept.icon;
    return <Icon size={size} />;
};

export default function DebtControl({ userData, user }) {
    const [entities, setEntities] = useState(userData?.debts || []);
    const [isAdding, setIsAdding] = useState(false);
    const [activatingDebt, setActivatingDebt] = useState(null);
    const [payingDebt, setPayingDebt] = useState(null); // { entityId, debt }
    const [viewingHistory, setViewingHistory] = useState(null); // { entityId, debt }
    const [loading, setLoading] = useState(false);
    const [exchangeRate, setExchangeRate] = useState(7.75);

    useEffect(() => {
        const fetchRate = async () => {
            try {
                const response = await fetch('https://open.er-api.com/v6/latest/USD');
                const rateData = await response.json();
                if (rateData?.rates?.GTQ) setExchangeRate(rateData.rates.GTQ);
            } catch (error) { console.error("Error fetching exchange rate:", error); }
        };
        fetchRate();
    }, []);

    useEffect(() => {
        if (userData?.debts) {
            setEntities(userData.debts);
        }
    }, [userData]);

    const persistDebts = async (newEntities) => {
        if (!user?.uid) return;
        setLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);

            // Calculate total monthly payment from active debts and total debt balance
            const currentMonthStr = new Date().toISOString().substring(0, 7);
            let totalMonthlyPayment = 0;
            let totalDebtBalance = 0;
            newEntities.forEach(entity => {
                entity.debts.forEach(debt => {
                    const isFutureDebt = debt.startMonth && debt.startMonth > currentMonthStr;
                    if (debt.isActive && !isFutureDebt) {
                        totalMonthlyPayment += (Number(debt.monthlyPayment) || 0);
                    }
                    totalDebtBalance += (Number(debt.amount) || 0);
                });
            });

            await updateDoc(userRef, {
                'debts': newEntities,
                'finances.totalDebt': totalDebtBalance,
                'finances.monthlyDebtPayment': totalMonthlyPayment
            });
        } catch (error) {
            console.error("Error persisting debts:", error);
            alert("Error al guardar en la base de datos.");
        } finally {
            setLoading(false);
        }
    };

    const handleAddDebt = async (newDebtInfo) => {

        const finalTermMonths = newDebtInfo.hasInstallments
            ? (newDebtInfo.termMonths || (newDebtInfo.amount && newDebtInfo.monthlyPayment ? Math.ceil(parseFloat(newDebtInfo.amount) / parseFloat(newDebtInfo.monthlyPayment)) : null))
            : (newDebtInfo.isSinglePayment ? 1 : null);

        const getDebtTitle = () => {
            if (newDebtInfo.type === 'financial') {
                return newDebtInfo.debtTitle === 'otro' ? (newDebtInfo.customTitle || 'Otra Deuda Bancaria') : newDebtInfo.debtTitle;
            } else {
                return newDebtInfo.customTitle || `Préstamo: ${newDebtInfo.firstName}`;
            }
        };

        const totalPriorPayments = (newDebtInfo.priorPayments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const originalAmount = Number(newDebtInfo.amount);
        const remainingAmount = originalAmount - totalPriorPayments;

        const debtObj = {
            id: Math.random().toString(36).substr(2, 9),
            title: getDebtTitle(),
            amount: remainingAmount,
            originalAmount: originalAmount,
            monthlyPayment: newDebtInfo.isVariablePlan && newDebtInfo.variablePaymentPlan?.length > 0
                ? Number(newDebtInfo.variablePaymentPlan[0].amount)
                : (newDebtInfo.isSinglePayment ? remainingAmount : (Number(newDebtInfo.monthlyPayment) || 0)),
            isActive: newDebtInfo.isActive,
            paymentDay: newDebtInfo.isActive ? (newDebtInfo.isSinglePayment ? (newDebtInfo.dueDate ? new Date(newDebtInfo.dueDate + 'T12:00:00').getDate() : null) : Number(newDebtInfo.paymentDay)) : (newDebtInfo.paymentDay ? Number(newDebtInfo.paymentDay) : null),
            isSinglePayment: newDebtInfo.isSinglePayment,
            dueDate: newDebtInfo.dueDate || null,
            hasInstallments: newDebtInfo.hasInstallments,
            termMonths: finalTermMonths ? Number(finalTermMonths) : null,
            startMonth: newDebtInfo.isSinglePayment && newDebtInfo.dueDate ? newDebtInfo.dueDate.substring(0, 7) : (newDebtInfo.startMonth || new Date().toISOString().substring(0, 7)),
            endMonth: (newDebtInfo.hasInstallments || finalTermMonths) ? calculateEndMonth(newDebtInfo.isSinglePayment && newDebtInfo.dueDate ? newDebtInfo.dueDate.substring(0, 7) : (newDebtInfo.startMonth || new Date().toISOString().substring(0, 7)), finalTermMonths) : null,
            installmentsPaid: Number(newDebtInfo.installmentsPaid) || 0,
            // Nuevos Campos
            cardName: newDebtInfo.cardName || null,
            lastFourDigits: newDebtInfo.lastFourDigits || null,
            loanNumber: newDebtInfo.loanNumber || null,
            loanDescription: newDebtInfo.loanDescription || null,
            priorPayments: newDebtInfo.priorPayments || [],
            isVariablePlan: newDebtInfo.isVariablePlan || false,
            variablePaymentPlan: newDebtInfo.variablePaymentPlan || [],
            fundingSource: newDebtInfo.fundingSource || 'Cashflow'
        };

        let updatedEntities = [...entities];
        const existingEntityIndex = updatedEntities.findIndex(e => e.type === newDebtInfo.type && e.name === (newDebtInfo.type === 'financial' ? newDebtInfo.bankName : `${newDebtInfo.firstName} ${newDebtInfo.lastName}`.trim()));

        if (existingEntityIndex !== -1) {
            updatedEntities[existingEntityIndex] = {
                ...updatedEntities[existingEntityIndex],
                debts: [...updatedEntities[existingEntityIndex].debts, debtObj]
            };
        } else {
            updatedEntities.push({
                id: Math.random().toString(36).substr(2, 9),
                type: newDebtInfo.type,
                name: (newDebtInfo.type === 'financial' ? newDebtInfo.bankName : `${newDebtInfo.firstName} ${newDebtInfo.lastName}`.trim()),
                debts: [debtObj]
            });
        }

        setEntities(updatedEntities);
        await persistDebts(updatedEntities);
        trackEvent('debt_added', { title: debtObj.title, amount: debtObj.amount, type: newDebtInfo.type });
        setIsAdding(false);
    };

    const handleActivateDebt = async (entityId, debtId, activationInfo) => {
        const updatedEntities = entities.map(entity => {
            if (entity.id !== entityId) return entity;
            return {
                ...entity,
                debts: entity.debts.map(debt => {
                    if (debt.id !== debtId) return debt;
                    return {
                        ...debt,
                        ...activationInfo,
                        isActive: true,
                        endMonth: activationInfo.hasInstallments ? calculateEndMonth(activationInfo.startMonth, activationInfo.termMonths) : null
                    };
                })
            };
        });

        setEntities(updatedEntities);
        await persistDebts(updatedEntities);
        setActivatingDebt(null);
    };

    const handleDeleteDebt = async (entityId, debtId) => {
        if (!confirm("¿Estás seguro de eliminar esta deuda?")) return;

        const updatedEntities = entities.map(entity => {
            if (entity.id !== entityId) return entity;
            return {
                ...entity,
                debts: entity.debts.filter(d => d.id !== debtId)
            };
        }).filter(entity => entity.debts.length > 0);

        setEntities(updatedEntities);
        await persistDebts(updatedEntities);
    };

    const handlePayDebt = async (entityId, debtId, paymentInfo) => {
        const paymentAmount = parseFloat(paymentInfo.amount);
        if (!paymentAmount || paymentAmount <= 0) return;

        const now = new Date();

        // Find the debt title for the history record
        let debtTitle = '';
        entities.forEach(entity => {
            entity.debts.forEach(debt => {
                if (debt.id === debtId) debtTitle = debt.title || 'Deuda';
            });
        });

        const paymentRecord = {
            id: Math.random().toString(36).substr(2, 9),
            amount: paymentAmount,
            source: paymentInfo.source,
            sourceAccountId: paymentInfo.sourceAccountId || null,
            note: paymentInfo.note || '',
            date: now.toISOString(),
            type: paymentInfo.isFullPayment ? 'full' : 'partial'
        };

        const updatedEntities = entities.map(entity => {
            if (entity.id !== entityId) return entity;
            return {
                ...entity,
                debts: entity.debts.map(debt => {
                    if (debt.id !== debtId) return debt;
                    const newAmount = Math.max(0, debt.amount - paymentAmount);
                    const monthlyPmt = parseFloat(debt.monthlyPayment) || 0;
                    const addedInstallments = monthlyPmt > 0 ? Math.floor(paymentAmount / monthlyPmt) : 0;
                    const newPaid = (debt.installmentsPaid || 0) + addedInstallments;
                    const payments = [...(debt.payments || []), paymentRecord];
                    return {
                        ...debt,
                        amount: newAmount,
                        installmentsPaid: debt.termMonths ? Math.min(newPaid, debt.termMonths) : newPaid,
                        payments,
                        isPaid: newAmount === 0,
                        isActive: newAmount > 0 ? debt.isActive : false
                    };
                })
            };
        });

        setEntities(updatedEntities);

        try {
            const userRef = doc(db, 'users', user.uid);
            const snap = await getDoc(userRef);
            const currentData = snap.data() || {};
            let updates = { 'debts': updatedEntities };

            if (paymentInfo.source === 'capital' && paymentInfo.sourceAccountId) {
                // Debit from the specific selected savings account and record in history
                const accounts = [...(currentData?.savings?.accounts || [])];
                const updatedAccounts = accounts.map(acc => {
                    if (acc.id !== paymentInfo.sourceAccountId) return acc;
                    const bal = parseFloat(acc.balance) || 0;
                    const deductAmount = acc.currency === 'USD'
                        ? paymentAmount / (parseFloat(paymentInfo.exchangeRate) || 7.75)
                        : paymentAmount;
                    const historyEntry = {
                        id: Date.now().toString() + '_debt',
                        date: now.toISOString().split('T')[0],
                        amount: -deductAmount,
                        source: `Pago deuda: ${debtTitle}`,
                        note: paymentInfo.note || ''
                    };
                    return {
                        ...acc,
                        balance: Math.max(0, bal - deductAmount),
                        history: [historyEntry, ...(acc.history || [])]
                    };
                });
                updates['savings.accounts'] = updatedAccounts;
            } else if (paymentInfo.source === 'income') {
                const currentSpent = currentData?.finances?.monthlySpent || 0;
                updates['finances.monthlySpent'] = currentSpent + paymentAmount;
            }

            let totalDebt = 0;
            updatedEntities.forEach(e => e.debts.forEach(d => { totalDebt += d.amount; }));
            updates['finances.totalDebt'] = totalDebt;
            await updateDoc(userRef, updates);
        } catch (err) {
            console.error('Error saving payment:', err);
            alert('Error al guardar el pago.');
        }

        setPayingDebt(null);
    };

    const currentMonthStr = new Date().toISOString().substring(0, 7);
    
    // Global Metrics from shared logic
    const { TI: income, TP, TDM, CFD, savingsGoal } = useMemo(() => {
        return calculateCashflowMetrics(userData, currentMonthStr, exchangeRate);
    }, [userData, currentMonthStr, exchangeRate]);

    const totalSavingsGTQ = (userData?.savings?.accounts || []).reduce((acc, account) => {
        const bal = parseFloat(account.balance) || 0;
        return acc + (account.currency === 'USD' ? bal * exchangeRate : bal);
    }, 0);

    return (
        <div className="space-y-8 pb-20">
            <DebtDashboard
                entities={entities}
                userData={userData}
                onActivate={(entityId, debt) => setActivatingDebt({ entityId, debt })}
                onDelete={handleDeleteDebt}
                onPay={(entityId, debt) => setPayingDebt({ entityId, debt })}
                onHistory={(entityId, debt) => setViewingHistory({ entityId, debt })}
                onAdd={() => setIsAdding(true)}
                persistDebts={persistDebts}
                loading={loading}
                parentCFD={CFD}
            />

            {isAdding && (
                <DebtWizard 
                    entities={entities} 
                    onComplete={handleAddDebt} 
                    onCancel={() => setIsAdding(false)} 
                    CFD={CFD} 
                    totalSavingsGTQ={totalSavingsGTQ} 
                />
            )}

            {activatingDebt && (
                <ActivationWizard
                    debt={activatingDebt.debt}
                    onComplete={(info) => handleActivateDebt(activatingDebt.entityId, activatingDebt.debt.id, info)}
                    onCancel={() => setActivatingDebt(null)}
                />
            )}

            {payingDebt && (
                <PaymentModal
                    debt={payingDebt.debt}
                    userData={userData}
                    onConfirm={(info) => handlePayDebt(payingDebt.entityId, payingDebt.debt.id, info)}
                    onCancel={() => setPayingDebt(null)}
                    exchangeRate={exchangeRate}
                />
            )}

            {viewingHistory && (
                <PaymentHistoryModal
                    debt={viewingHistory.debt}
                    onClose={() => setViewingHistory(null)}
                />
            )}
        </div>
    );
}

const calculateEndMonth = (startMonthStr, termMonths) => {
    if (!startMonthStr || !termMonths) return '';
    const [year, month] = startMonthStr.split('-');
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    startDate.setMonth(startDate.getMonth() + parseInt(termMonths));
    const endYear = startDate.getFullYear();
    const endMonth = String(startDate.getMonth() + 1).padStart(2, '0');
    return `${endYear}-${endMonth}`;
}

const DebtDashboard = ({ entities, userData, onActivate, onDelete, onPay, onHistory, onAdd, persistDebts, loading, parentCFD }) => {
    const [sortBy, setSortBy] = useState('amount-desc');
    const [expandedDebtId, setExpandedDebtId] = useState(null);
    const [editingDebt, setEditingDebt] = useState(null);

    const allDebts = useMemo(() => {
        const flat = [];
        entities.forEach(entity => {
            entity.debts.forEach(debt => {
                flat.push({ ...debt, entityName: entity.name, entityId: entity.id, entityType: entity.type });
            });
        });
        return flat;
    }, [entities]);

    const paidDebts = allDebts.filter(d => d.isPaid || d.amount <= 0);
    const activeDebts = allDebts.filter(d => d.isActive && !d.isPaid && d.amount > 0);
    const inactiveDebts = allDebts.filter(d => !d.isActive && !d.isPaid && d.amount > 0);

    const currentMonthStr = new Date().toISOString().substring(0, 7);
    const now = new Date();
    const monthName = now.toLocaleString('es-GT', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());

    const hasCurrentMonthPayment = (debt) => {
        if (!debt.payments?.length) return false;
        return debt.payments.some(p => p.date?.startsWith(currentMonthStr));
    };

    // ── CORE METRICS ──
    const TDA = activeDebts.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    const TDI = inactiveDebts.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    const TD = TDA + TDI;

    // Filter into categories
    const activeCuotas = activeDebts.filter(d => !d.isSinglePayment);
    const activePagos = activeDebts.filter(d => d.isSinglePayment);

    // For the "Acitve" view, we focus on what's relevant for THIS month
    const currentCuotas = activeCuotas.filter(d => {
        const isFuture = d.startMonth && d.startMonth > currentMonthStr;
        return !isFuture;
    });
    
    const currentPagos = activePagos.filter(d => d.dueDate && d.dueDate.startsWith(currentMonthStr));

    // TDACV: Total Deuda Activa Cuotas (Este Mes) - Only Cashflow for CFD
    const TDACV = currentCuotas.reduce((sum, d) => {
        if (d.fundingSource === 'Capital') return sum;
        return sum + (parseFloat(d.monthlyPayment) || 0);
    }, 0);

    // TDAUV: Total Deuda Activa Única (Este Mes) - Only Cashflow for CFD
    const TDAUV = currentPagos.reduce((sum, d) => {
        if (d.fundingSource === 'Capital') return sum;
        return sum + (parseFloat(d.amount) || 0);
    }, 0);

    // UI Totals (shown in subsection headers/footers) - includes all sources for clarity
    const TDACV_UI = currentCuotas.reduce((sum, d) => sum + (parseFloat(d.monthlyPayment) || 0), 0);
    const TDAUV_UI = currentPagos.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

    const TDM = TDACV + TDAUV;
    const TDM_UI = TDACV_UI + TDAUV_UI;

    // Use CFD from parent (calculated via shared calculateCashflowMetrics with live exchange rate)
    const CFD = parentCFD != null ? parentCFD : 0;

    const totalPaidDebt = paidDebts.reduce((sum, d) => sum + (parseFloat(d.originalAmount) || 0), 0);

    const sortDebts = (debts) => {
        let sorted = [...debts];
        if (sortBy === 'amount-desc') sorted.sort((a, b) => b.amount - a.amount);
        else if (sortBy === 'amount-asc') sorted.sort((a, b) => a.amount - b.amount);
        return sorted;
    };

    const handleQuickEdit = async (entityId, debtId, updates) => {
        const updatedEntities = entities.map(entity => {
            if (entity.id !== entityId) return entity;
            return { ...entity, debts: entity.debts.map(d => d.id !== debtId ? d : { ...d, ...updates }) };
        });
        await persistDebts(updatedEntities);
        setEditingDebt(null);
    };

    // ── Debt Card ──
    const renderDebtCard = (debt, showActivate = false) => {
        const isExpanded = expandedDebtId === debt.id;
        const covered = hasCurrentMonthPayment(debt);
        const isEditing = editingDebt?.debt?.id === debt.id;
        const subtitle = debt.cardName && debt.lastFourDigits ? `${debt.cardName} •••• ${debt.lastFourDigits}` : debt.loanNumber ? `#${debt.loanNumber}${debt.loanDescription ? ` – ${debt.loanDescription}` : ''}` : null;

        return (
            <div key={debt.id} 
                className={`relative p-3.5 rounded-2xl border transition-all duration-300 text-left ${!showActivate && covered ? 'bg-emerald-500/10 border-emerald-500/30' : (!showActivate && !covered && debt.isActive ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/[0.03] border-white/5')}`}>
                
                <div className="flex justify-between items-center cursor-pointer group" onClick={() => !isEditing && setExpandedDebtId(isExpanded ? null : debt.id)}>
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="shrink-0 scale-90 sm:scale-100 origin-left">
                            <BankLogo name={debt.entityName} type={debt.entityType} />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <span className={`text-[13px] sm:text-sm font-black truncate leading-snug ${!showActivate && covered ? 'text-emerald-400' : (!showActivate && !covered && debt.isActive ? 'text-orange-400' : 'text-white')}`}>
                                {debt.title}
                            </span>
                            <div className="text-[10px] sm:text-[11px] font-bold text-white/80 mt-0.5 truncate">
                                {debt.entityName}
                            </div>
                            <div className="text-[9px] text-aura-muted mt-0.5 uppercase tracking-widest overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
                                {debt.isSinglePayment ? 'Pago único' : (debt.hasInstallments ? 'Cuotas' : 'Crédito revolvente')}
                                {subtitle && <span className="text-white/30"> · {subtitle}</span>}
                                {debt.fundingSource && <span className="ml-1 text-emerald-400 font-bold">· Saldado con {debt.fundingSource}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="text-right shrink-0 ml-3 flex flex-col justify-center min-w-0 max-w-[45%]">
                        {debt.isSinglePayment ? (
                            <div className="text-[12px] sm:text-sm font-black text-amber-400 truncate w-full" title={`Q${(Number(debt.amount) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                                Q{(Number(debt.amount) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        ) : (
                            <>
                                <div className="text-[12px] sm:text-sm font-black text-amber-400 truncate w-full" title={`Cuota Q${(Number(debt.monthlyPayment) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                                    Cuota Q{(Number(debt.monthlyPayment) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-[10px] font-bold text-white mt-1 truncate w-full" title={`Restante Q${(Number(debt.amount) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
                                    Restante Q{(Number(debt.amount) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </>
                        )}
                    </div>
                </div>



                {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                        {debt.originalAmount && debt.originalAmount !== debt.amount && (
                            <div><span className="text-[10px] text-aura-muted uppercase tracking-widest font-bold">Monto Original</span>
                            <div className="text-white text-sm mt-1 font-bold">Q{Number(debt.originalAmount).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
                        )}
                        <div><span className="text-[10px] text-aura-muted uppercase tracking-widest font-bold">{debt.isSinglePayment ? 'Fecha de Pago' : 'Día de Pago'}</span>
                        <div className="text-white text-sm mt-1 font-bold">{debt.isSinglePayment && debt.dueDate ? new Date(debt.dueDate + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' }) : `${debt.paymentDay} de cada mes`}</div></div>
                        {debt.hasInstallments && (
                            <div className="col-span-2">
                                <div className="flex justify-between items-end mb-1"><span className="text-[10px] text-aura-muted uppercase tracking-widest font-bold">Progreso</span><span className="text-xs font-bold text-white">{debt.installmentsPaid} de {debt.termMonths} ({((debt.installmentsPaid/debt.termMonths)*100).toFixed(0)}%)</span></div>
                                <div className="h-1.5 w-full bg-black/40 border border-white/5 rounded-full overflow-hidden mt-1">
                                    <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500" style={{ width: `${Math.max((debt.installmentsPaid / debt.termMonths) * 100, 0)}%` }} />
                                </div>
                            </div>
                        )}
                        {debt.priorPayments?.length > 0 && (
                            <div className="col-span-2"><span className="text-[10px] text-aura-muted uppercase tracking-widest font-bold">Pagos Previos</span>
                            <div className="text-white text-sm mt-1 font-bold">{debt.priorPayments.length} pagos · Q{debt.priorPayments.reduce((s, p) => (s + (Number(p.amount) || 0)), 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
                        )}
                        {debt.isVariablePlan && debt.variablePaymentPlan?.length > 0 && (
                            <div className="col-span-2 md:col-span-4 mt-2">
                                <span className="text-[10px] text-amber-400 uppercase tracking-widest font-black">Plan de Pagos Variable</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                    {debt.variablePaymentPlan.map((item, idx) => (
                                        <div key={item.id || idx} className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
                                            <span className="text-[10px] font-bold text-white uppercase tracking-tighter">{item.plannedDate ? new Date(item.plannedDate + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short' }) : 'Sin fecha'}</span>
                                            <span className="text-sm font-black text-amber-400">Q{(Number(item.amount) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="col-span-2 md:col-span-4 flex flex-wrap justify-end gap-2 mt-2">
                            {showActivate ? (
                                <button onClick={(e) => { e.stopPropagation(); onActivate(debt.entityId, debt); }} className="flex items-center gap-2 text-xs font-bold px-4 py-2 text-black bg-amber-500 hover:bg-amber-400 transition-all rounded-lg shadow-lg"><Play size={14} fill="currentColor" /> Activar</button>
                            ) : (
                                <button onClick={(e) => { e.stopPropagation(); onPay(debt.entityId, debt); }} className="flex items-center gap-2 text-xs font-bold px-4 py-2 text-black bg-amber-500 hover:bg-amber-400 transition-all rounded-lg shadow-lg"><DollarSign size={14} /> Abonar</button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); setEditingDebt({ entityId: debt.entityId, debt }); }} className="flex items-center gap-2 text-xs font-bold px-4 py-2 text-aura-muted hover:text-amber-400 hover:bg-amber-400/10 transition-all rounded-lg"><Info size={14} /> Editar</button>
                            {(debt.payments?.length > 0) && (
                                <button onClick={(e) => { e.stopPropagation(); onHistory(debt.entityId, debt); }} className="flex items-center gap-2 text-xs font-bold px-4 py-2 text-aura-muted hover:text-blue-400 hover:bg-blue-400/10 transition-all rounded-lg"><History size={14} /> Historial</button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); onDelete(debt.entityId, debt.id); }} className="flex items-center gap-2 text-xs font-bold px-4 py-2 text-aura-muted hover:text-red-400 hover:bg-red-400/10 transition-all rounded-lg"><Trash2 size={14} /> Eliminar</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* ═══════════════════ BANNER PRINCIPAL ═══════════════════ */}
            <div className="glass-card p-6 md:p-10 relative overflow-hidden border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.15)]">
                <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/20 rounded-full blur-[100px] translate-x-20 -translate-y-20 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-56 h-56 bg-yellow-400/10 rounded-full blur-[80px] -translate-x-20 translate-y-20 pointer-events-none" />

                {/* Rich Insights — Desktop */}
                <div className="hidden lg:block absolute top-8 right-8 w-72 z-20">
                    <RichInsightsCard section="debt" userData={userData} />
                </div>

                <div className="relative z-10">
                    {/* Hero: Total Deuda */}
                    <div className="mb-6">
                        <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400 mb-2">
                            Total Deuda Registrada
                        </div>
                        <div className="text-4xl md:text-5xl font-black tracking-tighter text-amber-400">
                            Q{TD.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>

                        {/* Composition bar: Activa vs Inactiva */}
                        {TD > 0 && (
                            <>
                                <div className="mt-4 h-2.5 bg-black/40 rounded-full overflow-hidden w-full max-w-sm flex">
                                    {TDA > 0 && (<div className="h-full bg-amber-500 transition-all duration-700" style={{ width: `${(TDA / TD) * 100}%` }} />)}
                                    {TDI > 0 && (<div className="h-full bg-amber-800 transition-all duration-700" style={{ width: `${(TDI / TD) * 100}%` }} />)}
                                </div>
                                <div className="mt-1.5 flex items-center gap-4 text-[10px]">
                                    <span className="flex items-center gap-1.5 font-bold text-aura-muted/60">
                                        <span className="w-2 h-2 rounded-full bg-amber-500" /> 
                                        Activa {(TDA / TD * 100).toFixed(0)}%
                                    </span>
                                    {TDI > 0 && (
                                        <span className="flex items-center gap-1.5 font-bold text-aura-muted/60">
                                            <span className="w-2 h-2 rounded-full bg-amber-800" /> 
                                            Inactiva {(TDI / TD * 100).toFixed(0)}%
                                        </span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Secondary Metrics */}
                    <div className="max-w-md grid grid-cols-2 gap-3">
                        <div className="flex flex-col p-3 rounded-xl border transition-all bg-amber-500/5 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.05)]">
                            <div className="text-[10px] uppercase tracking-widest font-black mb-1 text-amber-400">
                                A Pagar este mes
                            </div>
                            <div className={`text-lg font-black ${TDM_UI > 0 ? 'text-amber-400' : 'text-white'}`}>
                                Q{TDM_UI.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className={`flex flex-col p-3 rounded-xl border transition-all ${CFD >= 0 ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : 'bg-red-500/5 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)]'}`}>
                            <div className={`text-[10px] uppercase tracking-widest font-black mb-1 ${CFD >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                Cash Flow Disponible
                            </div>
                            <div className={`text-lg font-black ${CFD >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                Q{CFD.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>
                </div>

                {loading && <div className="absolute top-4 right-4 animate-spin text-amber-400 z-30"><Save size={16} /></div>}


            </div>

            <button
                onClick={onAdd}
                className="w-full mt-2 mb-6 glass-card border-dashed border-amber-500/30 p-5 flex items-center justify-center gap-3 hover:bg-amber-500/5 hover:border-amber-500/50 transition-all group"
            >
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus size={20} className="text-amber-400" />
                </div>
                <span className="text-sm font-bold text-amber-400 uppercase tracking-widest">Registrar nueva deuda</span>
            </button>

            {/* ═══════════════════ DEUDA ACTIVA ═══════════════════ */}
            <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="glass-card p-4 md:p-6">
                        <div className="flex justify-between items-start mb-6 px-1">
                            <div>
                                <div className="flex gap-2 items-center">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-amber-500">Deuda Activa</h3>
                                    <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-md font-bold">{activeDebts.length} registradas</span>
                                </div>
                                <p className="text-[10px] text-aura-muted/60 mt-0.5">Créditos que estás pagando actualmente.</p>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] uppercase tracking-widest text-aura-muted font-bold mb-0.5">Total Deuda Activa</div>
                                <div className="text-xl font-black text-amber-400">
                                    Q{TDA.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* Cuotas subsection */}
                        {activeCuotas.length > 0 && (
                            <div className="space-y-4 mb-6">
                                <div className="flex items-center px-1">
                                    <div className="flex items-center gap-2">
                                        <Activity size={14} className="text-amber-400" />
                                        <span className="text-xs font-black text-white uppercase tracking-[0.15em]">Cuotas ({activeCuotas.length})</span>
                                    </div>
                                </div>
                                <div className="grid gap-3">
                                    {sortDebts(currentCuotas).map(debt => renderDebtCard(debt, false))}
                                </div>
                                <div className="flex justify-end items-end flex-wrap gap-x-2 gap-y-1 mt-4 px-1 text-right">
                                    <div className="text-[10px] uppercase tracking-widest text-aura-muted font-bold w-full sm:w-auto">Total cuotas mensuales</div>
                                    <div className="text-xl font-black text-amber-400 truncate max-w-full" title={`Q${TDACV_UI.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>Q{TDACV_UI.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                            </div>
                        )}

                        {activeCuotas.length > 0 && activePagos.length > 0 && (
                            <div className="border-b border-white/5 my-6"></div>
                        )}

                        {/* Pagos Únicos subsection */}
                        {currentPagos.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center px-1">
                                    <div className="flex items-center gap-2">
                                        <DollarSign size={14} className="text-yellow-400" />
                                        <span className="text-xs font-black text-white uppercase tracking-[0.15em]">Pagos Únicos ({currentPagos.length})</span>
                                    </div>
                                </div>
                                <div className="grid gap-3">
                                    {sortDebts(currentPagos).map(debt => renderDebtCard(debt, false))}
                                </div>
                                <div className="flex justify-end items-end flex-wrap gap-x-2 gap-y-1 mt-4 px-1 text-right">
                                    <div className="text-[10px] uppercase tracking-widest text-aura-muted font-bold w-full sm:w-auto">Total pagos únicos del mes</div>
                                    <div className="text-xl font-black text-yellow-400 truncate max-w-full" title={`Q${TDAUV_UI.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>Q{TDAUV_UI.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                            </div>
                        )}

                        {activeDebts.length === 0 && (
                            <div className="text-center py-16 border-dashed border border-white/10 rounded-2xl mb-4">
                                <Check size={48} className="mx-auto text-amber-400 mb-4 opacity-50" />
                                <h3 className="text-xl font-bold text-white mb-2">¡Todo bajo control!</h3>
                                <p className="text-aura-muted text-sm px-8">No tienes deudas activas registradas.</p>
                            </div>
                        )}


                    </div>
                </div>



            {/* ═══════════════════ DEUDA INACTIVA ═══════════════════ */}
            {inactiveDebts.length > 0 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="glass-card p-4 md:p-6">
                        <div className="flex justify-between items-start mb-6 px-1">
                            <div>
                                <div className="flex gap-2 items-center">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-amber-700">Deuda Inactiva</h3>
                                    <span className="text-[9px] bg-amber-700/10 border border-amber-700/20 text-amber-700 px-1.5 py-0.5 rounded-md font-bold">{inactiveDebts.length} en espera</span>
                                </div>
                                <p className="text-[10px] text-aura-muted/60 mt-0.5">Créditos pendientes sin actividad actual.</p>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] uppercase tracking-widest text-aura-muted font-bold mb-0.5">Total Deuda Inactiva</div>
                                <div className="text-xl font-black text-amber-700">
                                    Q{TDI.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-600/10 border border-amber-600/20 p-4 rounded-2xl flex gap-4 items-start mb-6">
                            <AlertCircle className="text-amber-500 mt-0.5 shrink-0" size={20} />
                            <div>
                                <div className="text-amber-100 font-bold text-sm">Deudas en Espera</div>
                                <p className="text-amber-200/60 text-xs mt-1">Puedes activarlas para incluirlas en tu estrategia de pago.</p>
                            </div>
                        </div>

                        <div className="grid gap-3 mb-4">
                            {sortDebts(inactiveDebts).map(debt => renderDebtCard(debt, true))}
                        </div>

                    </div>
                </div>
            )}

            {/* ═══════════════════ HISTORIAL ═══════════════════ */}
            {paidDebts.length > 0 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="glass-card p-4 md:p-6">
                        <div className="flex justify-between items-start mb-6 px-1">
                            <div>
                                <div className="flex gap-2 items-center">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-500">Historial</h3>
                                    <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded-md font-bold">{paidDebts.length} liquidadas</span>
                                </div>
                                <p className="text-[10px] text-aura-muted/60 mt-0.5">Deudas que ya fueron pagadas en su totalidad.</p>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] uppercase tracking-widest text-aura-muted font-bold mb-0.5">Total Historial</div>
                                <div className="text-xl font-black text-emerald-400">
                                    Q{totalPaidDebt.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-3">
                            {paidDebts.map(debt => {
                                const totalPaidAmount = (debt.payments || []).reduce((s, p) => s + p.amount, 0);
                                const paidDate = debt.payments?.length > 0 ? new Date(debt.payments[debt.payments.length - 1].date).toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
                                return (
                                    <div key={debt.id} className="glass-card p-5 border border-emerald-500/10 hover:bg-white/5 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0"><Check size={20} /></div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-white">{debt.title}</div>
                                                <div className="text-[10px] text-aura-muted mt-0.5">{debt.entityName}{paidDate && <span> · Liquidada {paidDate}</span>}</div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-[10px] text-aura-muted uppercase tracking-widest font-bold">Total Pagado</div>
                                                <div className="font-black text-emerald-400">Q{totalPaidAmount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                            </div>
                                        </div>
                                        {(debt.payments?.length > 0) && (
                                            <div className="mt-3 pt-3 border-t border-white/5 flex justify-end">
                                                <button onClick={() => onHistory(debt.entityId, debt)} className="flex items-center gap-2 text-xs font-bold px-4 py-2 text-aura-muted hover:text-blue-400 hover:bg-blue-400/10 transition-all rounded-lg"><History size={14} /> Ver Pagos</button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                    </div>
                </div>
            )}

            {/* ═══════════════════ QUICK EDIT MODAL ═══════════════════ */}
            {editingDebt && (
                <QuickEditModal
                    debt={editingDebt.debt}
                    entityId={editingDebt.entityId}
                    onSave={handleQuickEdit}
                    onCancel={() => setEditingDebt(null)}
                />
            )}
        </div>
    );
};

const QuickEditModal = ({ debt, entityId, onSave, onCancel }) => {
    const [amount, setAmount] = useState(debt.amount?.toString() || '');
    const [monthlyPayment, setMonthlyPayment] = useState(debt.monthlyPayment?.toString() || '');
    const [isActive, setIsActive] = useState(debt.isActive);
    const [isSinglePayment, setIsSinglePayment] = useState(debt.isSinglePayment || false);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await onSave(entityId, debt.id, {
            amount: parseFloat(amount) || 0,
            monthlyPayment: parseFloat(monthlyPayment) || 0,
            isActive,
            isSinglePayment
        });
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-md p-6 md:p-8 relative border border-amber-500/20 shadow-2xl animate-in zoom-in-95 duration-200 text-white">
                <button onClick={onCancel} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-aura-muted hover:text-white transition-colors"><X size={18} /></button>
                <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Edición Rápida</div>
                <h3 className="text-xl font-black text-white mb-6">{debt.title}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest">Saldo Restante</label>
                        <div className="relative mt-1"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold">Q</span>
                        <input type="number" className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-amber-500 font-bold" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest">Cuota / Pago Mensual</label>
                        <div className="relative mt-1"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold">Q</span>
                        <input type="number" className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-amber-500 font-bold" value={monthlyPayment} onChange={(e) => setMonthlyPayment(e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setIsActive(!isActive)} className={`p-3 rounded-xl border text-xs font-bold transition-all ${isActive ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-white/10 bg-black/20 text-aura-muted'}`}>{isActive ? '✓ Activa' : 'Inactiva'}</button>
                        <button onClick={() => setIsSinglePayment(!isSinglePayment)} className={`p-3 rounded-xl border text-xs font-bold transition-all ${isSinglePayment ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400' : 'border-white/10 bg-black/20 text-aura-muted'}`}>{isSinglePayment ? 'Pago Único' : 'Cuotas'}</button>
                    </div>
                </div>
                <div className="mt-6 pt-4 border-t border-white/5 flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 text-aura-muted font-bold hover:text-white transition-colors rounded-xl">Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="flex-[2] bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black py-3 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-[1.02] transition-all disabled:opacity-50">{saving ? 'Guardando...' : 'GUARDAR CAMBIOS'}</button>
                </div>
            </div>
        </div>
    );
};

const ActivationWizard = ({ debt, onComplete, onCancel }) => {
    const monthOptions = useMemo(() => generateMonthOptions(), []);

    const [formData, setFormData] = useState({
        paymentDay: debt.paymentDay || '15',
        monthlyPayment: debt.monthlyPayment || '',
        hasInstallments: debt.hasInstallments || false,
        termMonths: debt.termMonths || '',
        startMonth: new Date().toISOString().substring(0, 7),
        installmentsPaid: '0',
        isSinglePayment: debt.isSinglePayment || false,
        dueDate: debt.dueDate || ''
    });

    const updateForm = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        if (formData.isSinglePayment) {
            if (!formData.dueDate) return alert('Pacta la fecha de pago única.');
        } else {
            if (!formData.paymentDay) return alert('Ingresa un día de pago.');
            if (!formData.monthlyPayment) return alert('Ingresa la cuota o pago mensual.');
        }

        // Calcular cuotas si es mensualidad
        let finalData = { ...formData };
        if (!formData.isSinglePayment && debt.amount && formData.monthlyPayment) {
            finalData.hasInstallments = true;
            finalData.termMonths = Math.ceil(parseFloat(debt.amount) / parseFloat(formData.monthlyPayment)).toString();
        } else {
            finalData.hasInstallments = false;
            finalData.termMonths = '1';
            finalData.installmentsPaid = '0';
        }

        onComplete(finalData);
    };

    const projectedInstallments = useMemo(() => {
        const amt = parseFloat(debt.amount) || 0;
        const pmt = parseFloat(formData.monthlyPayment) || 0;
        if (amt > 0 && pmt > 0) {
            return Math.ceil(amt / pmt);
        }
        return 0;
    }, [debt.amount, formData.monthlyPayment]);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 text-white">
            <div className="glass-card w-full max-w-lg p-6 md:p-8 relative border-aura-border shadow-2xl animate-in zoom-in-95 duration-200 hide-scrollbar overflow-y-auto max-h-[90vh]">
                <button onClick={onCancel} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-aura-muted hover:text-white transition-colors z-[110]">
                    <X size={20} />
                </button>
                <h3 className="text-2xl font-bold text-white mb-2">Activando: {debt.title}</h3>
                <p className="text-aura-muted text-sm mb-6">Ingresa los detalles para proyectar tus pagos.</p>

                <div className="space-y-6">
                    {/* Toggle common to all types now */}
                    <div className="flex bg-black/30 p-1.5 rounded-2xl border border-white/10 overflow-hidden">
                        <button
                            onClick={() => updateForm('isSinglePayment', true)}
                            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${formData.isSinglePayment ? 'bg-yellow-500 text-white shadow-lg' : 'text-aura-muted hover:text-white'}`}
                        >
                            <Calendar size={14} /> UN SOLO PAGO
                        </button>
                        <button
                            onClick={() => updateForm('isSinglePayment', false)}
                            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${!formData.isSinglePayment ? 'bg-yellow-500 text-white shadow-lg' : 'text-aura-muted hover:text-white'}`}
                        >
                            <Activity size={14} /> MENSUALIDADES
                        </button>
                    </div>

                    {formData.isSinglePayment ? (
                        <div className="space-y-4 animate-in slide-in-from-top-2">
                            <div className="bg-black/30 p-5 rounded-2xl border border-white/5 space-y-2">
                                <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1 flex items-center gap-2">
                                    <Calendar size={14} className="text-purple-400" /> ¿Cuándo pactaste pagar?
                                </label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-purple-500 font-black text-xl appearance-none cursor-pointer"
                                        style={{ colorScheme: 'dark' }}
                                        value={formData.dueDate}
                                        onChange={(e) => updateForm('dueDate', e.target.value)}
                                    />
                                    {!formData.dueDate && (
                                        <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
                                            <span className="text-white/30 font-bold">Seleccionar fecha</span>
                                            <Calendar size={20} className="text-purple-400" />
                                        </div>
                                    )}
                                </div>
                                {formData.dueDate && (
                                    <div className="text-sm text-purple-300 font-bold pl-1">
                                        📅 {new Date(formData.dueDate + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </div>
                                )}
                            </div>

                        </div>
                    ) : (
                        <>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-2">
                                    <label className="block text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1 flex items-center gap-2">
                                        <Calendar size={14} className="text-yellow-400" /> Día de Pago
                                    </label>
                                    <select
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 text-center font-bold appearance-none cursor-pointer"
                                        value={formData.paymentDay}
                                        onChange={(e) => updateForm('paymentDay', e.target.value)}
                                    >
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                            <option key={day} value={day} className="bg-zinc-900">Día {day}</option>
                                        ))}
                                    </select>
                                    <div className="text-[10px] text-yellow-400 font-bold text-center">EL {formData.paymentDay} DE CADA MES</div>
                                </div>

                                <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-2">
                                    <label className="block text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1 flex items-center gap-2">
                                        <CreditCard size={14} className="text-yellow-400" /> Cuota Mensual
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold">Q</span>
                                        <input
                                            type="number"
                                            className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-yellow-500 text-center font-bold"
                                            value={formData.monthlyPayment}
                                            placeholder="0.00"
                                            onChange={(e) => updateForm('monthlyPayment', e.target.value)}
                                        />
                                    </div>
                                    {projectedInstallments > 0 && (
                                        <div className="text-[10px] text-aura-muted font-bold text-center truncate">
                                            ~ {projectedInstallments} CUOTAS
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-aura-muted font-bold uppercase tracking-widest pl-1">Mes de Inicio</label>
                                        <select
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-yellow-500 cursor-pointer"
                                            value={formData.startMonth}
                                            onChange={(e) => updateForm('startMonth', e.target.value)}
                                        >
                                            {monthOptions.map(opt => (
                                                <option key={opt.val} value={opt.val} className="bg-zinc-900">{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-aura-muted font-bold uppercase tracking-widest pl-1">Cuotas ya pagadas</label>
                                        <select
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-yellow-500 cursor-pointer"
                                            value={formData.installmentsPaid}
                                            onChange={(e) => updateForm('installmentsPaid', e.target.value)}
                                        >
                                            <option value="0" className="bg-zinc-900">Ninguna</option>
                                            {Array.from({ length: Math.max(0, projectedInstallments - 1) }, (_, i) => i + 1).map(num => (
                                                <option key={num} value={num} className="bg-zinc-900">{num} cuotas</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex gap-4">
                    <button onClick={onCancel} className="flex-1 py-4 text-aura-muted font-bold hover:text-white transition-colors">Cancelar</button>
                    <button
                        onClick={handleSave}
                        className="flex-[2] bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-[1.02] transition-all"
                    >
                        CONFIRMAR ACTIVACIÓN
                    </button>
                </div>
            </div>
        </div>
    );
};

const PaymentModal = ({ debt, userData, onConfirm, onCancel, exchangeRate }) => {
    // Suggested instalment amount
    const instAmount = parseFloat(debt.monthlyPayment) || 0;
    const currentMonthStr = new Date().toISOString().substring(0, 7);
    const [amount, setAmount] = useState(instAmount > 0 ? instAmount.toString() : '');
    const [source, setSource] = useState('income');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [note, setNote] = useState('');
    const [isFullPayment, setIsFullPayment] = useState(false);

    // Correct data paths matching how Dashboard.jsx reads them
    // Correct logic synced with global CFD and Dashboard
    const monthlyIncome = userData?.finances?.income || 0; // Already includes base + variable
    const savingsGoal = userData?.finances?.savingsGoal || 0;

    // Budget assigned
    const budgetCategories = userData?.budget?.categories || [];
    const totalBudget = budgetCategories.reduce((acc, cat) => acc + (parseFloat(cat.total) || 0), 0);

    // Active debt monthly payments (excluding current debt to avoid double-counting)
    const debtsData = userData?.debts || [];
    let otherCommitments = 0;

    debtsData.forEach(entity => {
        (entity.debts || []).forEach(d => {
            const isFutureDebt = d.startMonth && d.startMonth > currentMonthStr;
            if (d.id === debt.id) return; // Skip current debt being paid
            if (d.isActive && !isFutureDebt && d.fundingSource !== 'Capital') {
                if (d.isSinglePayment) {
                    if (d.dueDate && d.dueDate.startsWith(currentMonthStr)) otherCommitments += (Number(d.amount) || 0);
                } else {
                    otherCommitments += (Number(d.monthlyPayment) || 0);
                }
            }
        });
    });

    // Available = Income - Budget - Other Commitments - Savings Goal
    const availableLiquidity = Math.max(0, monthlyIncome - totalBudget - otherCommitments - savingsGoal);

    const savingsAccounts = userData?.savings?.accounts || [];
    const capitalBalance = savingsAccounts.reduce((acc, account) => {
        const bal = parseFloat(account.balance) || 0;
        return acc + (account.currency === 'USD' ? bal * (exchangeRate || 7.75) : bal);
    }, 0);

    const selectedAccount = savingsAccounts.find(a => a.id === selectedAccountId);
    const selectedAccountBalance = selectedAccount
        ? (selectedAccount.currency === 'USD'
            ? (parseFloat(selectedAccount.balance) || 0) * 7.75
            : (parseFloat(selectedAccount.balance) || 0))
        : 0;

    const handleConfirm = () => {
        const payAmt = isFullPayment ? debt.amount : parseFloat(amount);
        if (!payAmt || payAmt <= 0) return alert('Ingresa un monto válido.');
        if (payAmt > debt.amount) return alert(`El monto no puede superar el saldo de Q${debt.amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
        if (source === 'capital') {
            if (!selectedAccountId) return alert('Selecciona una cuenta de Capital.');
            if (payAmt > selectedAccountBalance) return alert(`Fondos insuficientes en ${selectedAccount?.name}. Disponible: Q${selectedAccountBalance.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        }
        if (source === 'income' && payAmt > availableLiquidity) return alert(`Fondos insuficientes. Liquidez disponible: Q${availableLiquidity.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        onConfirm({ amount: payAmt.toString(), source, sourceAccountId: selectedAccountId || null, exchangeRate: '7.75', note, isFullPayment });
    };


    return (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-md p-6 md:p-8 border-aura-border shadow-2xl animate-in zoom-in-95 duration-200 relative text-white max-h-[90vh] overflow-y-auto hide-scrollbar">
                <button onClick={onCancel} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-aura-muted hover:text-white transition-colors">
                    <X size={18} />
                </button>

                <div className="mb-6">
                    <span className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase">Registrar Pago</span>
                    <h2 className="text-2xl font-black text-white italic mt-1">{debt.title}</h2>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="text-sm text-aura-muted">Saldo actual:</div>
                        <div className="text-lg font-black text-red-400">Q{debt.amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                </div>

                <div className="space-y-5">
                    {/* Source Selection */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">¿Desde dónde pagas?</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setSource('income'); setSelectedAccountId(''); }}
                                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${source === 'income' ? 'border-yellow-500 bg-yellow-500/10 scale-[1.02]' : 'border-white/10 bg-black/20 text-aura-muted'}`}
                            >
                                <Banknote size={24} />
                                <div className="text-center">
                                    <div className="font-bold text-xs">Liquidez Libre</div>
                                    <div className={`text-[10px] mt-0.5 font-bold ${availableLiquidity > 0 ? 'text-yellow-400' : 'text-red-400'}`}>Q{availableLiquidity.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                            </button>
                            <button
                                onClick={() => setSource('capital')}
                                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${source === 'capital' ? 'border-blue-400 bg-blue-400/10 scale-[1.02]' : 'border-white/10 bg-black/20 text-aura-muted'}`}
                            >
                                <Wallet size={24} />
                                <div className="text-center">
                                    <div className="font-bold text-xs">Capital / Ahorros</div>
                                    <div className="text-[10px] text-aura-muted mt-0.5">Q{capitalBalance.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Account Selection when source is capital */}
                    {source === 'capital' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">Selecciona la cuenta</label>
                            {savingsAccounts.length === 0 ? (
                                <div className="text-center py-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                                    <p className="text-xs text-red-300 font-bold">No tienes cuentas en Capital.</p>
                                    <p className="text-[10px] text-aura-muted mt-1">Agrega una cuenta en la pestaña de Capital primero.</p>
                                </div>
                            ) : (
                                <div className="grid gap-2">
                                    {savingsAccounts.map(acc => {
                                        const bal = parseFloat(acc.balance) || 0;
                                        const balGTQ = acc.currency === 'USD' ? bal * 7.75 : bal;
                                        const isSelected = selectedAccountId === acc.id;
                                        return (
                                            <button
                                                key={acc.id}
                                                onClick={() => setSelectedAccountId(acc.id)}
                                                className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${isSelected
                                                    ? 'border-blue-400 bg-blue-400/10 shadow-[0_0_15px_rgba(96,165,250,0.15)]'
                                                    : 'border-white/10 bg-black/20 hover:border-white/20'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isSelected ? 'bg-blue-400/20 text-blue-400' : 'bg-white/5 text-aura-muted'}`}>
                                                        {acc.type === 'bank' ? <Landmark size={18} /> : <Banknote size={18} />}
                                                    </div>
                                                    <div className="text-left">
                                                        <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-aura-muted'}`}>{acc.name}</div>
                                                        <div className="text-[10px] text-aura-muted">
                                                            {acc.type === 'bank' ? 'Banco' : 'Efectivo'} • {acc.currency}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`font-black text-sm ${isSelected ? 'text-white' : 'text-aura-muted'}`}>
                                                        {acc.currency === 'USD' ? '$' : 'Q'}{bal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                    {acc.currency === 'USD' && (
                                                        <div className="text-[10px] text-blue-400/70">~ Q{balGTQ.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Payment Type Toggle */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">Tipo de Pago</label>
                        <div className="flex bg-black/30 p-1 rounded-2xl border border-white/10">
                            <button
                                onClick={() => { setIsFullPayment(false); setAmount(''); }}
                                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all ${!isFullPayment ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' : 'text-aura-muted hover:text-white'}`}
                            >
                                Abono Parcial
                            </button>
                            <button
                                onClick={() => { setIsFullPayment(true); setAmount(debt.amount.toString()); }}
                                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all ${isFullPayment ? 'bg-green-400/20 text-green-400 border border-green-400/40' : 'text-aura-muted hover:text-white'}`}
                            >
                                Liquidar Deuda
                            </button>
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">
                            Monto a Pagar {isFullPayment && <span className="text-green-400">(Pago Total)</span>}
                        </label>
                        {!isFullPayment && instAmount > 0 && (
                            <div className="flex gap-2 mb-2">
                                <button onClick={() => setAmount(instAmount.toString())} className="text-[10px] px-3 py-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg font-bold hover:bg-yellow-500/20 transition-all">
                                    Cuota: Q{instAmount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </button>
                            </div>
                        )}
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-aura-muted font-bold text-xl">Q</span>
                            <input
                                type="number"
                                className={`w-full bg-black/50 border rounded-2xl pl-12 pr-4 py-5 text-3xl font-black focus:outline-none transition-all ${isFullPayment ? 'border-green-500/50 text-green-400' : 'border-white/10 focus:border-yellow-500'}`}
                                placeholder="0.00"
                                value={isFullPayment ? debt.amount : amount}
                                onChange={(e) => !isFullPayment && setAmount(e.target.value)}
                                readOnly={isFullPayment}
                            />
                        </div>
                    </div>

                    {/* Note */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">Nota (Opcional)</label>
                        <input
                            type="text"
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-500 transition-all"
                            placeholder="Ej. Cuota de marzo..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6 pt-5 border-t border-white/5">
                    <button onClick={onCancel} className="flex-1 py-3 text-aura-muted font-bold hover:text-white transition-colors text-sm">
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={source === 'capital' && !selectedAccountId}
                        className={`flex-[2] font-black py-4 rounded-2xl transition-all text-sm shadow-lg disabled:opacity-40 disabled:cursor-not-allowed ${isFullPayment
                            ? 'bg-gradient-to-r from-green-500 to-emerald-400 text-black shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:scale-[1.02]'
                            : 'bg-gradient-to-r from-yellow-500 to-pink-500 text-black shadow-[0_0_20px_rgba(244,63,94,0.3)] hover:scale-[1.02]'}`}
                    >
                        {isFullPayment ? '✓ LIQUIDAR DEUDA' : 'REGISTRAR ABONO'}
                    </button>
                </div>
            </div>
        </div>
    );
};


const PaymentHistoryModal = ({ debt, onClose }) => {
    const payments = debt.payments || [];
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    const sourceLabel = { capital: 'Capital / Ahorros', income: 'Ingresos Mensuales' };
    const sourceIcon = { capital: <Wallet size={12} />, income: <Banknote size={12} /> };

    return (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-lg p-6 md:p-8 border-aura-border shadow-2xl animate-in zoom-in-95 duration-200 relative text-white max-h-[90vh] flex flex-col">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-aura-muted hover:text-white transition-colors">
                    <X size={18} />
                </button>

                <div className="mb-6">
                    <span className="text-[10px] font-black tracking-[0.2em] text-blue-400 uppercase">Historial de Pagos</span>
                    <h2 className="text-2xl font-black text-white italic mt-1">{debt.title}</h2>
                    <div className="flex gap-4 mt-3">
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2">
                            <div className="text-[10px] text-aura-muted uppercase tracking-widest">Total Abonado</div>
                            <div className="font-black text-yellow-400">Q{totalPaid.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                            <div className="text-[10px] text-aura-muted uppercase tracking-widest">Pagos Registrados</div>
                            <div className="font-black text-white">{payments.length}</div>
                        </div>
                        <div className="bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2">
                            <div className="text-[10px] text-aura-muted uppercase tracking-widest">Saldo Restante</div>
                            <div className="font-black text-red-400">Q{debt.amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 space-y-3 hide-scrollbar pr-1">
                    {payments.length === 0 ? (
                        <div className="text-center py-12 text-aura-muted">
                            <Clock size={36} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-bold">No hay pagos registrados aún.</p>
                        </div>
                    ) : (
                        [...payments].reverse().map((payment, idx) => {
                            const d = new Date(payment.date);
                            return (
                                <div key={payment.id || idx} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/8 transition-all">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${payment.type === 'full' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                        {payment.type === 'full' ? <Check size={18} /> : <ArrowDownCircle size={18} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-white text-sm">
                                            {payment.type === 'full' ? 'Liquidación Total' : 'Abono Parcial'}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] text-aura-muted mt-0.5">
                                            {sourceIcon[payment.source]}
                                            <span>{sourceLabel[payment.source] || payment.source}</span>
                                            {payment.note && <span className="text-white/40">• {payment.note}</span>}
                                        </div>
                                        <div className="text-[10px] text-aura-muted/60 mt-0.5">
                                            {d.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })} — {d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div className={`font-black text-lg shrink-0 ${payment.type === 'full' ? 'text-green-400' : 'text-yellow-400'}`}>
                                        Q{payment.amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="mt-5 pt-4 border-t border-white/5">
                    <button onClick={onClose} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all text-sm">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

const DebtWizard = ({ onComplete, onCancel, entities = [], CFD = 0, totalSavingsGTQ = 0 }) => {
    const monthOptions = useMemo(() => generateMonthOptions(), []);

    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        type: 'financial',
        bankName: GUATEMALA_BANKS[0].name,
        firstName: '',
        lastName: '',
        debtTitle: FINANCIAL_CONCEPTS[0].label,
        customTitle: '',
        amount: '',
        monthlyPayment: '',
        isSinglePayment: false,
        dueDate: '',
        isActive: true,
        paymentDay: '15',
        hasInstallments: false,
        startMonth: new Date().toISOString().substring(0, 7),
        termMonths: '',
        installmentsPaid: '0',
        cardName: '',
        lastFourDigits: '',
        loanNumber: '',
        loanDescription: '',
        priorPayments: [],
        isVariablePlan: false,
        variablePaymentPlan: [],
        fundingSource: '', // Empty initially to force selection
        acquisitionDate: new Date().toISOString().substring(0, 10),
        isAlreadyPaying: false,
        totalPaidAmount: ''
    });

    const updateForm = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleNext = () => {
        if (step === 1) {
            if (formData.type === 'financial') {
                if (!formData.bankName) return alert('Selecciona una entidad financiera.');
                if (formData.debtTitle === 'Tarjeta de Crédito') {
                    if (!formData.cardName) return alert('Ingresa el nombre de la tarjeta.');
                    if (!formData.lastFourDigits || formData.lastFourDigits.length < 4) return alert('Ingresa los últimos 4 dígitos.');
                }
                if (formData.debtTitle?.includes('Préstamo')) {
                    if (!formData.loanNumber) return alert('Ingresa el número de préstamo.');
                }
            } else {
                if (!formData.firstName || !formData.lastName) return alert('Ingresa los nombres y apellidos.');
            }
            setStep(2);
            return;
        }

        if (step === 2) {
            if (formData.isActive === null || formData.isActive === undefined) return alert('Selecciona el estado de la deuda.');
            setStep(3);
            return;
        }

        if (step === 3) {
            const amt = parseFloat(formData.amount);
            if (!amt || amt <= 0) return alert('Ingresa el monto total.');

            if (formData.isActive) {
                if (!formData.fundingSource) return alert('Selecciona el origen de los fondos.');
                
                if (!formData.isSinglePayment) {
                    if (!formData.monthlyPayment || parseFloat(formData.monthlyPayment) <= 0) {
                        return alert('Ingresa la cuota mensual.');
                    }
                }

                // Validation logic for active debt
                let available = formData.fundingSource === 'Cashflow' ? CFD : totalSavingsGTQ;
                let currentPayment = formData.isSinglePayment ? amt : parseFloat(formData.monthlyPayment);

                if (currentPayment > available) {
                    if (!confirm(`El pago (Q${currentPayment.toLocaleString()}) supera tu ${formData.fundingSource} disponible (Q${available.toLocaleString()}). ¿Deseas registrarla como Deuda Inactiva?`)) {
                        return;
                    }
                    // If they confirm making it inactive, we finalize it as inactive
                    onComplete({ ...formData, isActive: false, hasInstallments: false });
                    return;
                }
            }

            setStep(4);
            return;
        }

        if (step === 4) {
            if (formData.isActive) {
                if (!formData.isSinglePayment && !formData.paymentDay) return alert('Selecciona el día de pago.');
                if (formData.isSinglePayment && !formData.dueDate) return alert('Selecciona la fecha de pago.');
            } else {
                if (!formData.acquisitionDate) return alert('Selecciona la fecha de adquisición.');
            }

            let finalData = { ...formData };
            if (formData.isActive && !formData.isSinglePayment && formData.amount && formData.monthlyPayment && !formData.isVariablePlan) {
                finalData.hasInstallments = true;
                const rem = (parseFloat(formData.amount) || 0) - (parseFloat(formData.totalPaidAmount) || 0);
                finalData.termMonths = Math.ceil(rem / parseFloat(formData.monthlyPayment)).toString();
            }

            onComplete(finalData);
        }
    };

    const projectedInstallments = useMemo(() => {
        const amt = parseFloat(formData.amount) || 0;
        const prior = (formData.priorPayments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const rem = Math.max(0, amt - prior);
        const pmt = parseFloat(formData.monthlyPayment) || 0;
        if (rem > 0 && pmt > 0) {
            return Math.ceil(rem / pmt);
        }
        return 0;
    }, [formData.amount, formData.priorPayments, formData.monthlyPayment]);

    const addPriorPayment = () => {
        setFormData(prev => ({
            ...prev,
            priorPayments: [...prev.priorPayments, { id: Math.random().toString(36).substr(2, 9), amount: '', date: '', note: '' }]
        }));
    };
    const updatePriorPayment = (id, key, value) => {
        setFormData(prev => ({
            ...prev,
            priorPayments: prev.priorPayments.map(p => p.id === id ? { ...p, [key]: value } : p)
        }));
    };
    const removePriorPayment = (id) => {
        setFormData(prev => ({
            ...prev,
            priorPayments: prev.priorPayments.filter(p => p.id !== id)
        }));
    };

    const addVariablePlanItem = () => {
        setFormData(prev => ({
            ...prev,
            variablePaymentPlan: [...prev.variablePaymentPlan, { id: Math.random().toString(36).substr(2, 9), amount: '', plannedDate: '' }]
        }));
    };
    const updateVariablePlanItem = (id, key, value) => {
        setFormData(prev => ({
            ...prev,
            variablePaymentPlan: prev.variablePaymentPlan.map(p => p.id === id ? { ...p, [key]: value } : p)
        }));
    };
    const removeVariablePlanItem = (id) => {
        setFormData(prev => ({
            ...prev,
            variablePaymentPlan: prev.variablePaymentPlan.filter(p => p.id !== id)
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-xl p-6 md:p-8 border-aura-border shadow-2xl animate-in zoom-in-95 duration-200 hide-scrollbar overflow-y-auto max-h-[95vh] relative text-white">
                <button onClick={onCancel} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-aura-muted hover:text-white transition-colors">
                    <X size={20} />
                </button>

                <div className="flex flex-col gap-1 mb-8">
                    <span className="text-[10px] font-black tracking-[0.2em] text-amber-500 uppercase">Registro de Deuda</span>
                    <div className="flex items-center justify-between">
                        <h2 className="text-3xl font-black text-white italic">
                            {step === 1 ? '¿A quién le debes?' : 
                             step === 2 ? 'Estado de la Deuda' :
                             step === 3 ? 'Configuración de Pago' :
                             'Fechas y Detalles'}
                        </h2>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : i < step ? 'w-4 bg-amber-500/40' : 'w-2 bg-white/10'}`} />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="min-h-[350px]">
                    {step === 1 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => updateForm('type', 'financial')}
                                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${formData.type === 'financial' ? 'border-yellow-500 bg-yellow-500/10 scale-[1.02]' : 'border-white/10 bg-black/20 text-aura-muted'}`}
                                >
                                    <Landmark size={32} />
                                    <span className="font-bold text-sm">Entidad Bancaria</span>
                                </button>
                                <button
                                    onClick={() => updateForm('type', 'personal')}
                                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${formData.type === 'personal' ? 'border-purple-500 bg-purple-500/10 scale-[1.02]' : 'border-white/10 bg-black/20 text-aura-muted'}`}
                                >
                                    <User size={32} />
                                    <span className="font-bold text-sm">Persona Particular</span>
                                </button>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-white/5">
                                {entities.filter(e => e.type === formData.type).length > 0 && (
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">Seleccionar existente</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {entities.filter(e => e.type === formData.type).map(entity => (
                                                <button
                                                    key={entity.id}
                                                    onClick={() => {
                                                        if (formData.type === 'financial') {
                                                            updateForm('bankName', entity.name);
                                                        } else {
                                                            const parts = entity.name.split(' ');
                                                            updateForm('firstName', parts[0]);
                                                            updateForm('lastName', parts.slice(1).join(' '));
                                                        }
                                                    }}
                                                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 text-center ${(formData.type === 'financial' ? formData.bankName === entity.name : (formData.firstName + ' ' + formData.lastName).trim() === entity.name)
                                                        ? 'border-yellow-500 bg-yellow-500/20 shadow-lg'
                                                        : 'border-white/5 bg-white/5 text-aura-muted hover:border-white/20'
                                                        }`}
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-black text-xs">
                                                        {entity.name.substring(0, 1)}
                                                    </div>
                                                    <span className="text-[10px] font-bold uppercase truncate w-full">{entity.name}</span>
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => {
                                                    if (formData.type === 'financial') updateForm('bankName', '');
                                                    else { updateForm('firstName', ''); updateForm('lastName', ''); }
                                                }}
                                                className="p-3 rounded-xl border border-dashed border-white/10 bg-black/20 text-aura-muted hover:border-white/20 flex flex-col items-center justify-center gap-2"
                                            >
                                                <Plus size={16} />
                                                <span className="text-[10px] font-bold uppercase">Nuevo</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {formData.type === 'financial' ? (
                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-6">
                                            {(!formData.bankName || !entities.some(e => e.name === formData.bankName)) && (
                                                <div>
                                                    <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1 mb-3 block">Nuevo Banco o Institución</label>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {GUATEMALA_BANKS.map(bank => (
                                                            <button
                                                                key={bank.name}
                                                                onClick={() => updateForm('bankName', bank.name)}
                                                                className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 group ${formData.bankName === bank.name ? 'border-yellow-500 bg-yellow-500/20 shadow-lg' : 'border-white/5 bg-white/5 text-aura-muted hover:border-white/20'}`}
                                                            >
                                                                <div className={`w-10 h-10 rounded-lg ${bank.color} flex items-center justify-center text-white font-black text-sm shadow-md group-hover:scale-110 transition-transform`}>{bank.initial}</div>
                                                                <span className="text-[10px] font-bold uppercase tracking-tighter truncate w-full text-center">{bank.name.split(' (')[0]}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">Concepto de la Deuda</label>
                                                <select
                                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-yellow-500 font-bold appearance-none cursor-pointer text-sm"
                                                    value={formData.debtTitle}
                                                    onChange={(e) => updateForm('debtTitle', e.target.value)}
                                                >
                                                    {FINANCIAL_CONCEPTS.map(concept => (
                                                        <option key={concept.id} value={concept.label} className="bg-zinc-900">{concept.label}</option>
                                                    ))}
                                                    <option value="otro" className="bg-zinc-900">Otro (Especificar)</option>
                                                </select>
                                                {formData.debtTitle === 'otro' && (
                                                    <input
                                                        type="text"
                                                        className="w-full bg-black/50 border border-yellow-500/30 rounded-xl px-4 py-4 mt-2 text-white focus:outline-none focus:border-yellow-500 font-bold text-sm"
                                                        placeholder="Ej. Línea de Crédito Rotativa"
                                                        value={formData.customTitle}
                                                        onChange={(e) => updateForm('customTitle', e.target.value)}
                                                    />
                                                )}

                                                {formData.debtTitle === 'Tarjeta de Crédito' && (
                                                    <div className="grid grid-cols-2 gap-3 mt-4 animate-in slide-in-from-top-2">
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">Nombre de Tarjeta</label>
                                                            <input
                                                                type="text"
                                                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 font-bold text-xs"
                                                                placeholder="Ej. Visa Oro"
                                                                value={formData.cardName}
                                                                onChange={(e) => updateForm('cardName', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">Últimos 4 Dígitos</label>
                                                            <input
                                                                type="text"
                                                                maxLength="4"
                                                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 font-mono text-center font-bold text-xs"
                                                                placeholder="0000"
                                                                value={formData.lastFourDigits}
                                                                onChange={(e) => updateForm('lastFourDigits', e.target.value.replace(/\D/g, ''))}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {formData.debtTitle?.includes('Préstamo') && (
                                                    <div className="space-y-4 mt-4 animate-in slide-in-from-top-2">
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">Número de Préstamo</label>
                                                            <input
                                                                type="text"
                                                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 font-bold text-xs"
                                                                placeholder="Ej. 12345678"
                                                                value={formData.loanNumber}
                                                                onChange={(e) => updateForm('loanNumber', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">Descripción del Préstamo (Opcional)</label>
                                                            <input
                                                                type="text"
                                                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 font-bold text-xs"
                                                                placeholder="Ej. Remodelación Cocina"
                                                                value={formData.loanDescription}
                                                                onChange={(e) => updateForm('loanDescription', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 pt-2">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">Nombre</label>
                                                <input
                                                    type="text" placeholder="Nombres"
                                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-purple-500 font-bold text-sm"
                                                    value={formData.firstName} onChange={(e) => updateForm('firstName', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">Apellido</label>
                                                <input
                                                    type="text" placeholder="Apellidos"
                                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-purple-500 font-bold text-sm"
                                                    value={formData.lastName} onChange={(e) => updateForm('lastName', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">Título/Concepto (Opcional)</label>
                                            <input
                                                type="text" placeholder="Ej. Préstamo para viaje, Compra..."
                                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:border-purple-500 font-bold text-sm"
                                                value={formData.customTitle} onChange={(e) => updateForm('customTitle', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                            <div className="p-8 bg-black/40 border border-white/5 rounded-3xl text-center space-y-6">
                                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                                    <Activity size={40} className="text-amber-500" />
                                </div>
                                <div className="space-y-3">
                                    <h3 className="text-xl font-black text-white uppercase italic">¿Cuál es el estado de la deuda?</h3>
                                    <p className="text-aura-muted text-[10px] font-bold uppercase tracking-wider">
                                        Selecciona deuda Activa si la estas pagando actualmente<br/>
                                        Selecciona Inactiva si no estás pagando la deuda actualmente.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-3 max-w-xs mx-auto pt-4">
                                    <button
                                        onClick={() => { updateForm('isActive', true); setStep(3); }}
                                        className={`w-full py-5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 border-2 ${formData.isActive === true ? 'border-emerald-500 bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'border-white/10 bg-white/5 text-aura-muted'}`}
                                    >
                                        <Activity size={20} /> DEUDA ACTIVA (PAGANDO)
                                    </button>
                                    <button
                                        onClick={() => { updateForm('isActive', false); setStep(3); }}
                                        className={`w-full py-5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 border-2 ${formData.isActive === false ? 'border-orange-500 bg-orange-500 text-black shadow-lg shadow-orange-500/20' : 'border-white/10 bg-white/5 text-aura-muted'}`}
                                    >
                                        <Clock size={20} /> DEUDA INACTIVA (EN ESPERA)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                            {formData.isActive && (
                                <div className="space-y-4 animate-in fade-in">
                                    <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1 mb-2 block">¿De dónde se pagará y Tipo de Pago?</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => updateForm('fundingSource', 'Cashflow')}
                                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${formData.fundingSource === 'Cashflow' ? 'border-emerald-500 bg-emerald-500/10 scale-[1.02]' : 'border-white/10 bg-black/20 text-aura-muted'}`}
                                        >
                                            <Wallet size={32} className={formData.fundingSource === 'Cashflow' ? 'text-emerald-400' : ''} />
                                            <div className="text-center font-bold">
                                                <div className="text-sm">Cashflow</div>
                                                <div className="text-[10px] opacity-60">Mensual: Q{CFD.toLocaleString()}</div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => updateForm('fundingSource', 'Capital')}
                                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${formData.fundingSource === 'Capital' ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' : 'border-white/10 bg-black/20 text-aura-muted'}`}
                                        >
                                            <Landmark size={32} className={formData.fundingSource === 'Capital' ? 'text-blue-400' : ''} />
                                            <div className="text-center font-bold">
                                                <div className="text-sm">Capital</div>
                                                <div className="text-[10px] opacity-60">Total: Q{totalSavingsGTQ.toLocaleString()}</div>
                                            </div>
                                        </button>
                                    </div>

                                    <div className="flex bg-black/30 p-1.5 rounded-2xl border border-white/10 mt-4">
                                        <button
                                            onClick={() => updateForm('isSinglePayment', false)}
                                            className={`flex-1 py-4 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${!formData.isSinglePayment ? 'bg-amber-500 text-black shadow-lg' : 'text-aura-muted hover:text-white'}`}
                                        >
                                            <Activity size={16} /> MENSUALIDADES
                                        </button>
                                        <button
                                            onClick={() => updateForm('isSinglePayment', true)}
                                            className={`flex-1 py-4 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${formData.isSinglePayment ? 'bg-amber-500 text-black shadow-lg' : 'text-aura-muted hover:text-white'}`}
                                        >
                                            <Calendar size={16} /> UN SOLO PAGO
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className={`grid grid-cols-1 ${formData.isActive ? 'md:grid-cols-2' : ''} gap-6 pt-6 border-t border-white/5`}>
                                <div className="relative">
                                    <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest mb-2 block ml-1">Monto Total de la Deuda</label>
                                    <span className="absolute left-4 top-11 font-bold text-aura-muted text-2xl">Q</span>
                                    <input
                                        type="number" placeholder="0.00"
                                        className="w-full bg-black/50 border border-white/10 rounded-2xl pl-12 pr-4 py-6 text-2xl font-black focus:outline-none focus:border-amber-500 transition-all shadow-inner"
                                        value={formData.amount} onChange={(e) => updateForm('amount', e.target.value)}
                                    />
                                </div>

                                {formData.isActive && !formData.isSinglePayment && (
                                    <div className="relative animate-in slide-in-from-right-4">
                                        <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest mb-2 block ml-1">Cuota Mensual</label>
                                        <span className="absolute left-4 top-11 font-bold text-aura-muted text-2xl">Q</span>
                                        <input
                                            type="number" placeholder="0.00"
                                            className="w-full bg-black/50 border border-white/10 rounded-2xl pl-12 pr-4 py-6 text-2xl font-black focus:outline-none focus:border-amber-500 transition-all shadow-inner"
                                            value={formData.monthlyPayment} onChange={(e) => updateForm('monthlyPayment', e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>

                            {formData.isActive && formData.amount && (
                                <div className="animate-in fade-in zoom-in-95 space-y-4">
                                    {(() => {
                                        const amt = parseFloat(formData.amount) || 0;
                                        const monthly = parseFloat(formData.monthlyPayment) || 0;
                                        const available = formData.fundingSource === 'Cashflow' ? CFD : totalSavingsGTQ;
                                        const paymentToCheck = formData.isSinglePayment ? amt : (monthly || 0);
                                        const isOk = paymentToCheck <= available;

                                        return (
                                            <div className={`p-4 rounded-2xl border flex flex-col gap-4 ${isOk ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'}`}>
                                                <div className="flex items-start gap-3">
                                                    <Info size={20} className="shrink-0 mt-0.5" />
                                                    <div className="text-xs font-bold leading-relaxed">
                                                        {isOk ? (
                                                            `Perfecto. El pago de Q${paymentToCheck.toLocaleString()} es cubierto por tu ${formData.fundingSource || 'fondo'} (Disp: Q${available.toLocaleString()}).`
                                                        ) : (
                                                            `Atención: El pago (Q${paymentToCheck.toLocaleString()}) supera tu ${formData.fundingSource} disponible (Q${available.toLocaleString()}).`
                                                        )}
                                                    </div>
                                                </div>
                                                {!isOk && (
                                                    <button 
                                                        onClick={() => {
                                                            onComplete({ ...formData, isActive: false, hasInstallments: false });
                                                        }}
                                                        className="w-full py-3 bg-orange-500 text-black rounded-xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-all"
                                                    >
                                                        Guardar como Inactiva (En Espera)
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {formData.isActive && (
                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <label className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-all">
                                        <div className="flex gap-3 items-center">
                                            <Check size={18} className={formData.isAlreadyPaying ? 'text-amber-500' : 'text-aura-muted'} />
                                            <span className="font-bold text-sm">¿Ya has realizado pagos?</span>
                                        </div>
                                        <div className="relative">
                                            <input type="checkbox" className="sr-only peer" checked={formData.isAlreadyPaying} onChange={(e) => updateForm('isAlreadyPaying', e.target.checked)} />
                                            <div className="w-10 h-6 bg-white/10 rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                                        </div>
                                    </label>

                                    {formData.isAlreadyPaying && (
                                        <div className="space-y-4 animate-in slide-in-from-top-2">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">Monto Total Pagado a la fecha</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold text-xs">Q</span>
                                                    <input
                                                        type="number"
                                                        className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-amber-500 text-sm font-bold"
                                                        value={formData.totalPaidAmount}
                                                        onChange={(e) => updateForm('totalPaidAmount', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            {!formData.isSinglePayment && formData.amount && formData.monthlyPayment && (
                                                <div className="text-[10px] text-amber-500/80 italic font-bold">
                                                    * Se calcularán aproximadamente {Math.round((parseFloat(formData.totalPaidAmount) || 0) / (parseFloat(formData.monthlyPayment) || 1))} cuotas pagadas.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">Fecha de Adquisición</label>
                                        <input
                                            type="date"
                                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-xs font-bold focus:outline-none focus:border-amber-500"
                                            style={{ colorScheme: 'dark' }}
                                            value={formData.acquisitionDate}
                                            onChange={(e) => updateForm('acquisitionDate', e.target.value)}
                                        />
                                    </div>
                                    {formData.isActive && (
                                        <div className="space-y-2 animate-in fade-in">
                                            <label className="text-[10px] font-bold text-aura-muted uppercase tracking-widest pl-1">
                                                {formData.isSinglePayment ? 'Fecha de Pago' : 'Día de Pago Mensual'}
                                            </label>
                                            {formData.isSinglePayment ? (
                                                <input
                                                    type="date"
                                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-xs font-bold focus:outline-none focus:border-amber-500"
                                                    style={{ colorScheme: 'dark' }}
                                                    value={formData.dueDate}
                                                    onChange={(e) => updateForm('dueDate', e.target.value)}
                                                />
                                            ) : (
                                                <select
                                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-xs font-bold focus:outline-none focus:border-amber-500 appearance-none"
                                                    value={formData.paymentDay}
                                                    onChange={(e) => updateForm('paymentDay', e.target.value)}
                                                >
                                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                                        <option key={day} value={day} className="bg-zinc-900">Día {day}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    )}

                                {formData.isActive && !formData.isSinglePayment && (
                                    <div className="space-y-2 italic text-[10px] text-aura-muted pl-1">
                                        * Se registró una cuota mensual de Q{parseFloat(formData.monthlyPayment || 0).toLocaleString()}.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
                    <button 
                        onClick={() => setStep(s => Math.max(1, s - 1))} 
                        className={`flex items-center gap-2 text-xs font-black uppercase tracking-tighter transition-all hover:text-white ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-aura-muted'}`}
                    >
                        <ChevronLeft size={16} /> Volver
                    </button>
                    <button 
                        onClick={handleNext} 
                        className="flex items-center gap-2 bg-amber-500 text-black px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.05] active:scale-95 transition-all shadow-lg shadow-amber-500/20 group"
                    >
                        {step === 4 ? 'Finalizar Registro' : 'Continuar'} 
                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
};
