import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc } from '../../services/backendFirestore.js';
import { trackEvent } from '../../lib/analytics';
import {
    Plus, TrendingUp, Landmark, Banknote, ArrowRightLeft,
    X, Wallet, History, AlertCircle, Trash2, Minus,
    ChevronDown, ChevronUp, ExternalLink, RotateCw, RefreshCw, Info,
    Calculator, Zap
} from 'lucide-react';
import RichInsightsCard from '../insights/RichInsightsCard';

export default function Savings({ userData, user }) {
    const finances = userData?.finances || {};
    const savings = userData?.savings || { accounts: [] };
    const incomeAmount = finances.income || 0;
    const accounts = savings.accounts || [];

    const [exchangeRate, setExchangeRate] = useState(7.75);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchRates = async () => {
        setIsRefreshing(true);
        try {
            // Tasa de cambio GTQ
            const exResponse = await fetch('https://open.er-api.com/v6/latest/USD');
            const exData = await exResponse.json();
            if (exData && exData.rates && exData.rates.GTQ) {
                setExchangeRate(exData.rates.GTQ);
            }
        } catch (error) {
            console.error("Error fetching rates:", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRates();
    }, []);

    // Modals state
    const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
    const [isAddFundsModalOpen, setIsAddFundsModalOpen] = useState(false);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [deleteConfirmStep, setDeleteConfirmStep] = useState(1);

    // Form states for modals
    const [fundAmount, setFundAmount] = useState('');
    const [fundSource, setFundSource] = useState('Ingresos');
    const [fundDate, setFundDate] = useState(new Date().toISOString().split('T')[0]);

    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawReason, setWithdrawReason] = useState('');
    const [withdrawDate, setWithdrawDate] = useState(new Date().toISOString().split('T')[0]);

    const [transferAmount, setTransferAmount] = useState('');
    const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);



    // Add Account Form
    const [newAccName, setNewAccName] = useState('');
    const [newAccType, setNewAccType] = useState('bank'); // 'bank' or 'cash'
    const [newAccCurrency, setNewAccCurrency] = useState('GTQ'); // 'GTQ' or 'USD'
    const [newAccBalance, setNewAccBalance] = useState('');


    const [loading, setLoading] = useState(false);


    // Calculation of total values
    const totalNetCapitalGTQ = accounts.reduce((acc, account) => {
        const bal = parseFloat(account.balance) || 0;
        return acc + (account.currency === 'USD' ? bal * exchangeRate : bal);
    }, 0);

    // Rich Insights Calculations
    const bankAccounts = accounts.filter(a => a.type === 'bank');
    const cashAccounts = accounts.filter(a => a.type === 'cash');
    const totalBankGTQ = bankAccounts.reduce((acc, a) => acc + (a.currency === 'USD' ? (parseFloat(a.balance) || 0) * exchangeRate : (parseFloat(a.balance) || 0)), 0);
    const totalCashGTQ = cashAccounts.reduce((acc, a) => acc + (a.currency === 'USD' ? (parseFloat(a.balance) || 0) * exchangeRate : (parseFloat(a.balance) || 0)), 0);
    const bankPct = totalNetCapitalGTQ > 0 ? (totalBankGTQ / totalNetCapitalGTQ) * 100 : 0;
    const cashPct = totalNetCapitalGTQ > 0 ? (totalCashGTQ / totalNetCapitalGTQ) * 100 : 0;

    const totalInGTQ = accounts.filter(a => a.currency === 'GTQ').reduce((acc, a) => acc + (parseFloat(a.balance) || 0), 0);
    const totalInUSD = accounts.filter(a => a.currency === 'USD').reduce((acc, a) => acc + (parseFloat(a.balance) || 0), 0);
    const gtqPct = totalNetCapitalGTQ > 0 ? (totalInGTQ / totalNetCapitalGTQ) * 100 : 0;
    const usdPct = totalNetCapitalGTQ > 0 ? ((totalInUSD * exchangeRate) / totalNetCapitalGTQ) * 100 : 0;

    const handleAddAccount = async () => {
        if (!newAccName || !newAccBalance || isNaN(newAccBalance)) return;
        setLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);

            const newAccountObj = {
                id: Date.now().toString(),
                name: newAccName,
                type: newAccType,
                currency: newAccCurrency,
                balance: parseFloat(newAccBalance),
                history: [
                    {
                        id: Date.now().toString() + '_init',
                        date: new Date().toISOString().split('T')[0],
                        amount: parseFloat(newAccBalance),
                        source: 'Saldo Inicial'
                    }
                ]
            };

            const updatedAccounts = [...accounts, newAccountObj];
            await updateDoc(userRef, { 'savings.accounts': updatedAccounts });

            setIsAddAccountModalOpen(false);
            setNewAccName('');
            setNewAccBalance('');
            setNewAccType('bank');
            setNewAccCurrency('GTQ');
        } catch (error) {
            console.error("Error adding account:", error);
            alert("Error al agregar la cuenta. Revisa tus permisos de Firebase o tu conexión a internet.");
        } finally {
            setLoading(false);
        }
    };
    const handleAddFunds = async () => {
        if (!selectedAccount || !fundAmount || isNaN(fundAmount)) return;
        setLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            const amountToAdd = parseFloat(fundAmount);

            const updatedAccounts = accounts.map(acc => {
                if (acc.id === selectedAccount.id) {
                    return {
                        ...acc,
                        balance: (acc.balance || 0) + amountToAdd,
                        history: [
                            {
                                id: Date.now().toString(),
                                date: fundDate,
                                amount: amountToAdd,
                                source: fundSource === 'Ingresos' ? 'Transferencia (Ingresos)' : 'Ingreso Externo (Capital)'
                            },
                            ...(acc.history || [])
                        ]
                    };
                }
                return acc;
            });

            await updateDoc(userRef, { 'savings.accounts': updatedAccounts });
            trackEvent('funds_added', { amount: amountToAdd, source: fundSource, account: selectedAccount.name });

            // Reset states
            setIsAddFundsModalOpen(false);
            setFundAmount('');
            setFundSource('Ingresos');
            setFundDate(new Date().toISOString().split('T')[0]);
            setSelectedAccount(null);
        } catch (error) {
            console.error("Error adding funds:", error);
            alert("Error al añadir fondos.");
        } finally {
            setLoading(false);
        }
    };


    const handleWithdrawFunds = async () => {
        if (!selectedAccount || !withdrawAmount || isNaN(withdrawAmount)) return;
        setLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            const amountToSub = parseFloat(withdrawAmount);

            const updatedAccounts = accounts.map(acc => {
                if (acc.id === selectedAccount.id) {
                    return {
                        ...acc,
                        balance: (acc.balance || 0) - amountToSub,
                        history: [
                            {
                                id: Date.now().toString(),
                                date: withdrawDate,
                                amount: -amountToSub,
                                source: withdrawReason || 'Retiro'
                            },
                            ...(acc.history || [])
                        ]
                    };
                }
                return acc;
            });

            await updateDoc(userRef, { 'savings.accounts': updatedAccounts });
            trackEvent('funds_withdrawn', { amount: amountToSub, reason: withdrawReason, account: selectedAccount.name });
            setIsWithdrawModalOpen(false);
            setWithdrawAmount('');
            setWithdrawReason('');
            setWithdrawDate(new Date().toISOString().split('T')[0]);
            setSelectedAccount(null);
        } catch (error) {
            console.error("Error withdrawing funds:", error);
            alert("Error al retirar fondos.");
        } finally {
            setLoading(false);
        }
    };

    const handleTransferToIncome = async () => {
        if (!selectedAccount || !transferAmount || isNaN(transferAmount)) return;
        setLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            const amt = parseFloat(transferAmount);
            const amtInGTQ = selectedAccount.currency === 'USD' ? amt * exchangeRate : amt;

            // 1. Update Savings Accounts
            const updatedAccounts = accounts.map(acc => {
                if (acc.id === selectedAccount.id) {
                    return {
                        ...acc,
                        balance: (acc.balance || 0) - amt,
                        history: [
                            {
                                id: Date.now().toString(),
                                date: transferDate,
                                amount: -amt,
                                source: 'Traspaso a Ingresos'
                            },
                            ...(acc.history || [])
                        ]
                    };
                }
                return acc;
            });

            // 2. Prepare Income Update
            const currentFinances = userData?.finances || {};
            const currentVars = [...(currentFinances.variableIncomes || [])];

            const newVarIncome = {
                id: Date.now().toString() + '_transfer',
                name: `Traspaso de Capital (${selectedAccount.name})`,
                amount: amtInGTQ,
                date: transferDate,
                isTransfer: true // Metadata
            };

            const updatedVars = [...currentVars, newVarIncome];

            // Re-calculate total income (Mirroring Income.jsx logic)
            const rawVal = parseFloat(currentFinances.rawIncome) || 0;
            const isUsdVal = !!currentFinances.isUsd;
            const isrVal = !!currentFinances.isrEnabled;

            const finalGTQ = isUsdVal ? rawVal * exchangeRate : rawVal;
            const isrAmount = isrVal ? finalGTQ * 0.05 : 0;
            const mainNetIncome = finalGTQ - isrAmount;

            const varTotal = updatedVars.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
            const totalNetIncome = mainNetIncome + varTotal;

            // 3. Save all at once
            await updateDoc(userRef, {
                'savings.accounts': updatedAccounts,
                'finances.variableIncomes': updatedVars,
                'finances.income': totalNetIncome,
                'finances.updatedAt': new Date().toISOString()
            });
            trackEvent('transfer_to_income', { amount: amt, currency: selectedAccount.currency, account: selectedAccount.name });

            setIsTransferModalOpen(false);
            setTransferAmount('');
            setSelectedAccount(null);
            alert("Traspaso realizado con éxito. Revisa tus Ingresos.");
        } catch (error) {
            console.error("Error transferring to income:", error);
            alert("Error al realizar el traspaso.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!selectedAccount) return;
        setLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            const updatedAccounts = accounts.filter(acc => acc.id !== selectedAccount.id);
            await updateDoc(userRef, { 'savings.accounts': updatedAccounts });
            setSelectedAccount(null);
            setIsDeleteModalOpen(false);
            setDeleteConfirmStep(1);
        } catch (error) {
            console.error("Error deleting account:", error);
            alert("Error al eliminar la cuenta.");
        } finally {
            setLoading(false);
        }
    };



    return (
        <div className="space-y-8 pb-20 animate-in fade-in zoom-in-95 duration-500">


            {/* Main Banner (Standardized) */}
            <div className="glass-card p-6 md:p-8 relative overflow-hidden border border-white/5">
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] -mr-20 -mt-20 bg-green-500/20" />
                {/* Rich Insights — Top Right */}
                <div className="hidden lg:block absolute top-8 right-8 w-72 z-20">
                    <RichInsightsCard section="capital" userData={{...userData, capitalBalanceCalc: totalNetCapitalGTQ}} />
                </div>

                <div className="relative z-10">
                    <div className="mb-6">
                        <div className="text-xs font-bold uppercase tracking-[0.2em] text-green-500 mb-2">
                            Patrimonio Neto Total
                        </div>
                        <div className="text-4xl md:text-5xl font-black text-green-500 tracking-tighter flex items-baseline gap-2">
                            {totalNetCapitalGTQ.toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' })}
                        </div>
                        {/* Composition bar: GTQ vs USD */}
                        <div className="mt-4 h-2.5 bg-black/40 rounded-full overflow-hidden w-full max-w-sm flex">
                            {gtqPct > 0 && (
                                <div
                                    className="h-full bg-green-500 transition-all duration-700"
                                    style={{ width: `${gtqPct}%` }}
                                />
                            )}
                            {usdPct > 0 && (
                                <div
                                    className="h-full bg-emerald-400 transition-all duration-700"
                                    style={{ width: `${usdPct}%` }}
                                />
                            )}
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-[10px]">
                            <span className="flex items-center gap-1.5 font-bold text-aura-muted/60">
                                <span className="w-2 h-2 rounded-full bg-green-500" /> GTQ {gtqPct.toFixed(0)}%
                            </span>
                            <span className="flex items-center gap-1.5 font-bold text-aura-muted/60">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" /> USD {usdPct.toFixed(0)}%
                            </span>
                        </div>
                    </div>

                    <div className="max-w-md grid grid-cols-2 gap-3">
                        <div className="flex flex-col p-3 rounded-xl border transition-all bg-green-500/5 border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.05)]">
                            <div className="text-[10px] uppercase tracking-widest font-black mb-1 text-green-400">
                                En Banco
                            </div>
                            <div className="text-lg font-black text-green-400">
                                Q{totalBankGTQ.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="flex flex-col p-3 rounded-xl border transition-all bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                            <div className="text-[10px] uppercase tracking-widest font-black mb-1 text-emerald-400">
                                En Efectivo
                            </div>
                            <div className="text-lg font-black text-emerald-400">
                                Q{totalCashGTQ.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Bar: New Account */}
            <button
                onClick={() => setIsAddAccountModalOpen(true)}
                className="w-full glass-card border-dashed border-green-500/30 p-5 flex items-center justify-center gap-3 hover:bg-green-500/5 hover:border-green-500/50 transition-all group"
            >
                <div className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus size={20} className="text-green-400" />
                </div>
                <span className="text-sm font-bold text-green-400 uppercase tracking-widest">Registrar nueva cuenta</span>
            </button>

            <div className="space-y-4">
                <h3 className="font-bold px-1 text-aura-muted uppercase text-xs tracking-widest">Tus Cuentas</h3>

                <div className="grid gap-4">
                    {accounts.map(account => (
                        <div key={account.id} className="glass-card p-5 group hover:bg-white/5 transition-all relative border border-white/5 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-green-400 shadow-inner">
                                        {account.type === 'bank' ? <Landmark size={24} /> : <Banknote size={24} />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-lg text-white">{account.name}</div>
                                        <div className="text-xs text-aura-muted font-bold flex items-center gap-1 uppercase tracking-widest mt-0.5">
                                            {account.type === 'bank' ? 'Banco' : 'Efectivo'} • {account.currency}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2">
                                    <div className="text-2xl font-black text-white tracking-tight">
                                        {account.currency === 'USD' ? '$' : 'Q'}{(account.balance || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    {account.currency === 'USD' && (
                                        <div className="text-[10px] text-green-400 opacity-80 font-bold uppercase tracking-widest">
                                            ~ Q{((account.balance || 0) * exchangeRate).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => {
                                            setSelectedAccount(account);
                                            setDeleteConfirmStep(1);
                                            setIsDeleteModalOpen(true);
                                        }}
                                        className="p-2 text-red-400/50 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                        title="Eliminar Cuenta"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
                                <button
                                    onClick={() => {
                                        setSelectedAccount(account);
                                        setIsAddFundsModalOpen(true);
                                    }}
                                    className="flex-1 text-xs font-bold text-green-400 hover:text-green-300 transition-colors flex items-center justify-center gap-2 bg-green-500/10 px-3 py-2.5 rounded-xl border border-green-500/20 hover:scale-[1.02] active:scale-95 min-w-[90px]"
                                >
                                    <Plus size={14} /> Añadir
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedAccount(account);
                                        setIsWithdrawModalOpen(true);
                                    }}
                                    className="flex-1 text-xs font-bold text-green-400 hover:text-green-300 transition-colors flex items-center justify-center gap-2 bg-green-500/10 px-3 py-2.5 rounded-xl border border-green-500/20 hover:scale-[1.02] active:scale-95 min-w-[90px]"
                                >
                                    <Minus size={14} /> Retirar
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedAccount(account);
                                        setIsTransferModalOpen(true);
                                    }}
                                    className="flex-1 text-xs font-bold text-green-400 hover:text-green-300 transition-colors flex items-center justify-center gap-2 bg-green-500/10 px-3 py-2.5 rounded-xl border border-green-500/20 hover:scale-[1.02] active:scale-95 min-w-[90px]"
                                >
                                    <RefreshCw size={14} /> Traspaso
                                </button>
                            </div>

                            {account.history && account.history.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                                    {[...account.history].reverse().slice(0, 5).map((tx, idx) => (
                                        <div key={tx.id || idx} className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <div className="flex gap-2 text-aura-muted">
                                                    <span className="opacity-50">{tx.date}</span>
                                                    <span className="font-bold">{tx.source === 'Ingresos' ? 'Transferencia (Ingresos)' : tx.source}</span>
                                                </div>
                                                <div className={`font-black ${tx.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                    {tx.amount < 0 ? '-' : '+'}{account.currency === 'USD' ? '$' : 'Q'}{Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                            {tx.note && (
                                                <div className="text-[10px] text-aura-muted italic pl-2 border-l border-white/10 ml-2">
                                                    {tx.note}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {account.history.length > 5 && (
                                        <div className="text-center text-[10px] text-aura-muted pt-2 opacity-50">+ {account.history.length - 5} movimientos más</div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {accounts.length === 0 && (
                        <div className="text-center py-20 glass-card border-dashed border-white/10 text-aura-muted">
                            <AlertCircle className="mx-auto mb-4 opacity-20" size={48} />
                            <p>No has registrado ninguna cuenta de capital.</p>
                            <p className="text-xs mt-2">Usa el botón superior para crear tu primera cuenta o registrar tu efectivo.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Account Modal */}
            {isAddAccountModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="glass-card w-full max-w-lg p-6 relative border-aura-border shadow-2xl animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsAddAccountModalOpen(false)}
                            className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-aura-muted hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <h3 className="text-2xl font-bold text-white mb-6">Nueva Cuenta de Capital</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-aura-muted font-bold uppercase tracking-wider mb-2 block">Nombre / Banco</label>
                                <input
                                    type="text"
                                    value={newAccName}
                                    onChange={(e) => setNewAccName(e.target.value)}
                                    placeholder="Ej. Banrural, Bantrab, Caja Fuerte"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 text-base"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-aura-muted font-bold uppercase tracking-wider mb-2 block">Tipo</label>
                                    <select
                                        value={newAccType}
                                        onChange={(e) => setNewAccType(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none"
                                    >
                                        <option value="bank">Banco</option>
                                        <option value="cash">Efectivo Físico</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-aura-muted font-bold uppercase tracking-wider mb-2 block">Moneda</label>
                                    <select
                                        value={newAccCurrency}
                                        onChange={(e) => setNewAccCurrency(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none"
                                    >
                                        <option value="GTQ">GTQ (Quetzales)</option>
                                        <option value="USD">USD (Dólares)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-aura-muted font-bold uppercase tracking-wider mb-2 block">Saldo Inicial</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold">
                                        {newAccCurrency === 'USD' ? '$' : 'Q'}
                                    </span>
                                    <input
                                        type="number"
                                        value={newAccBalance}
                                        onChange={(e) => setNewAccBalance(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 text-xl font-black tracking-tighter"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleAddAccount}
                                disabled={loading || !newAccName || !newAccBalance}
                                className="w-full bg-green-500 text-black font-black py-4 rounded-xl hover:bg-green-400 transition-colors mt-4 shadow-[0_0_20px_rgba(168,85,247,0.2)] disabled:opacity-50 disabled:shadow-none"
                            >
                                {loading ? 'Creando...' : 'Crear Cuenta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Funds Modal */}
            {isAddFundsModalOpen && selectedAccount && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="glass-card w-full max-w-lg p-6 relative border-aura-border shadow-2xl animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsAddFundsModalOpen(false)}
                            className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-aura-muted hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <h3 className="text-2xl font-bold text-white mb-2">Añadir Fondos</h3>
                        <p className="text-aura-muted text-sm mb-6">A {selectedAccount.name} ({selectedAccount.currency === 'USD' ? '$' : 'Q'})</p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-aura-muted font-bold uppercase tracking-wider mb-2 block">Monto a Añadir</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold">
                                        {selectedAccount.currency === 'USD' ? '$' : 'Q'}
                                    </span>
                                    <input
                                        type="number"
                                        value={fundAmount}
                                        onChange={(e) => setFundAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 text-xl font-black tracking-tighter"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-aura-muted font-bold uppercase tracking-wider mb-2 block">Origen del Fondo</label>
                                <select
                                    value={fundSource}
                                    onChange={(e) => setFundSource(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none"
                                >
                                    <option value="Ingresos">Desde mis Ingresos ({incomeAmount > 0 ? `Q${incomeAmount.toLocaleString()}` : 'Registrados'})</option>
                                    <option value="Otro">Otro (Regalos, Bonos, etc)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs text-aura-muted font-bold uppercase tracking-wider mb-2 block">Fecha de Transacción</label>
                                <input
                                    type="date"
                                    value={fundDate}
                                    onChange={(e) => setFundDate(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none text-base"
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>

                            <button
                                onClick={handleAddFunds}
                                disabled={loading || !fundAmount}
                                className="w-full bg-green-500 text-black font-black py-4 rounded-xl hover:bg-green-400 transition-colors mt-4 shadow-[0_0_20px_rgba(168,85,247,0.2)] disabled:opacity-50 disabled:shadow-none"
                            >
                                {loading ? 'Añadiendo...' : 'Añadir a la cuenta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Withdraw Funds Modal */}
            {isWithdrawModalOpen && selectedAccount && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="glass-card w-full max-w-lg p-6 relative border-aura-border shadow-2xl animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsWithdrawModalOpen(false)}
                            className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-aura-muted hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <h3 className="text-2xl font-bold text-white mb-2 text-green-400">Retirar Fondos</h3>
                        <p className="text-aura-muted text-sm mb-6">De {selectedAccount.name} ({selectedAccount.currency === 'USD' ? '$' : 'Q'})</p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-aura-muted font-bold uppercase tracking-wider mb-2 block">Monto a Retirar</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold">
                                        {selectedAccount.currency === 'USD' ? '$' : 'Q'}
                                    </span>
                                    <input
                                        type="number"
                                        value={withdrawAmount}
                                        onChange={(e) => setWithdrawAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 text-xl font-black tracking-tighter"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-aura-muted font-bold uppercase tracking-wider mb-2 block">Motivo / Destino</label>
                                <input
                                    type="text"
                                    value={withdrawReason}
                                    onChange={(e) => setWithdrawReason(e.target.value)}
                                    placeholder="Ej. Gasto médico, Inversión, etc."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 text-base"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-aura-muted font-bold uppercase tracking-wider mb-2 block">Fecha</label>
                                <input
                                    type="date"
                                    value={withdrawDate}
                                    onChange={(e) => setWithdrawDate(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none text-base"
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>

                            <button
                                onClick={handleWithdrawFunds}
                                disabled={loading || !withdrawAmount}
                                className="w-full bg-green-500 text-white font-black py-4 rounded-xl hover:bg-green-400 transition-colors mt-4 shadow-[0_0_20px_rgba(168,85,247,0.2)] disabled:opacity-50 disabled:shadow-none"
                            >
                                {loading ? 'Procesando...' : 'Confirmar Retiro'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Account Modal (Double Confirmation) */}
            {isDeleteModalOpen && selectedAccount && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="glass-card w-full max-w-md p-8 relative border-red-500/20 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6 border border-red-500/20">
                            <AlertCircle size={32} />
                        </div>

                        {deleteConfirmStep === 1 ? (
                            <>
                                <h3 className="text-xl font-bold text-white mb-2">¿Eliminar esta cuenta?</h3>
                                <p className="text-aura-muted text-sm mb-8">
                                    Estás por eliminar <span className="text-white font-bold">{selectedAccount?.name}</span>.
                                    Esta acción no se puede deshacer y perderás el historial de saldos.
                                </p>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => setDeleteConfirmStep(2)}
                                        className="w-full bg-red-500 text-white font-bold py-3 rounded-xl hover:bg-red-600 transition-colors"
                                    >
                                        Sí, deseo eliminarla
                                    </button>
                                    <button
                                        onClick={() => setIsDeleteModalOpen(false)}
                                        className="w-full bg-white/5 text-aura-muted font-bold py-3 rounded-xl hover:text-white transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h3 className="text-xl font-bold text-white mb-2 text-red-500">¿Estás completamente seguro?</h3>
                                <p className="text-aura-muted text-sm mb-8">
                                    Confirma una última vez que deseas eliminar definitivamente <br /> <span className="text-white font-bold">{selectedAccount?.name}</span>.
                                </p>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handleDeleteAccount}
                                        className="w-full bg-red-600 text-white font-black py-4 rounded-xl hover:bg-red-700 transition-all shadow-[0_0_30px_rgba(220,38,38,0.3)] animate-pulse"
                                    >
                                        {loading ? 'Eliminando...' : 'ELIMINAR DEFINITIVAMENTE'}
                                    </button>
                                    <button
                                        onClick={() => setIsDeleteModalOpen(false)}
                                        className="w-full bg-white/5 text-aura-muted font-bold py-3 rounded-xl hover:text-white transition-colors"
                                    >
                                        No, regresar
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            {/* Transfer to Income Modal */}
            {isTransferModalOpen && selectedAccount && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="glass-card w-full max-w-md p-6 relative border-green-500/30 shadow-2xl animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => { setIsTransferModalOpen(false); setSelectedAccount(null); }}
                            className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-aura-muted hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center text-green-400 shadow-inner">
                                <RefreshCw size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Traspaso a Ingresos</h3>
                                <p className="text-[10px] text-aura-muted uppercase font-bold tracking-widest mt-0.5">Mover de Capital a Liquidez Libre</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                <div className="text-[10px] text-aura-muted font-bold uppercase tracking-widest mb-1">Cuenta de Origen</div>
                                <div className="text-white font-bold">{selectedAccount.name}</div>
                                <div className="text-sm text-green-400 font-black mt-1">
                                    Disponible: {selectedAccount.currency === 'USD' ? '$' : 'Q'}{(selectedAccount.balance || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-aura-muted font-bold uppercase tracking-widest pl-1">Monto a traspasar</label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 font-black text-xl">
                                        {selectedAccount.currency === 'USD' ? '$' : 'Q'}
                                    </span>
                                    <input
                                        type="number"
                                        value={transferAmount}
                                        onChange={(e) => setTransferAmount(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-2xl font-black text-white focus:outline-none focus:ring-2 focus:ring-green-500/30 transition-all"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                                {selectedAccount.currency === 'USD' && transferAmount && (
                                    <p className="text-[10px] text-green-400 font-bold pl-1 italic">
                                        Equivale a Q{(parseFloat(transferAmount) * exchangeRate).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} en Ingresos Extras.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-aura-muted font-bold uppercase tracking-widest pl-1">Fecha efectiva</label>
                                <input
                                    type="date"
                                    value={transferDate}
                                    onChange={(e) => setTransferDate(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:ring-1 focus:ring-green-400/50"
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>

                            <div className="p-4 bg-green-500/5 rounded-2xl border border-green-500/10 flex gap-3">
                                <Info size={20} className="text-green-400 shrink-0" />
                                <p className="text-[11px] text-aura-muted leading-relaxed">
                                    Este monto se descontará de tu cuenta de capital y aparecerá como un <span className="text-white font-bold">Ingreso Extra</span> en el presupuesto de este mes.
                                </p>
                            </div>

                            <button
                                onClick={handleTransferToIncome}
                                disabled={loading || !transferAmount || parseFloat(transferAmount) <= 0 || parseFloat(transferAmount) > (selectedAccount.balance || 0)}
                                className="w-full bg-gradient-to-r from-green-500 to-green-400 text-white font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
                            >
                                {loading ? 'Procesando...' : 'CONFIRMAR TRASPASO'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
