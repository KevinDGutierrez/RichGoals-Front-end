import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc } from '../../services/backendFirestore.js';
import {
    Wallet, Plus, Trash2, CheckCircle, Info, Monitor, Car, Briefcase, Gift,
    DollarSign, ShoppingBag, Landmark, HeartHandshake, CloudCheck, RefreshCcw,
    PiggyBank, AlertTriangle, Zap, Pencil, X, Calendar, TrendingUp, Banknote
} from 'lucide-react';
import RichInsightsCard from '../insights/RichInsightsCard';

// ─────────────────────── Icon Helper ──────────────────────────
const getIncomeIcon = (name) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('traspaso') || lower.includes('capital') || lower.includes('ahorro')) return PiggyBank;
    if (lower.includes('compu') || lower.includes('laptop') || lower.includes('pc') || lower.includes('mac')) return Monitor;
    if (lower.includes('auto') || lower.includes('carro') || lower.includes('vehiculo') || lower.includes('moto')) return Car;
    if (lower.includes('negocio') || lower.includes('emprendimiento') || lower.includes('proyecto')) return Briefcase;
    if (lower.includes('regalo') || lower.includes('donacion')) return Gift;
    if (lower.includes('venta') || lower.includes('vendi')) return ShoppingBag;
    if (lower.includes('banco') || lower.includes('interes') || lower.includes('rendimiento')) return Landmark;
    if (lower.includes('favor') || lower.includes('amigo') || lower.includes('ayuda')) return HeartHandshake;
    if (lower.includes('salario') || lower.includes('sueldo') || lower.includes('nómina') || lower.includes('nomina')) return Banknote;
    return DollarSign;
};

// ─────────── Current month helper ────────────
const currentMonthStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default function Income({ userData, user }) {
    const finances = userData?.finances || {};

    // ═══════ DATA MIGRATION: single rawIncome → fixedIncomes[] ═══════
    const migrateToFixedIncomes = () => {
        const existing = finances.fixedIncomes;
        if (existing && Array.isArray(existing) && existing.length > 0) return existing;

        // Migrate from legacy single income
        const rawVal = parseFloat(finances.rawIncome) || 0;
        if (rawVal === 0) return [];

        return [{
            id: 'migrated_' + Date.now(),
            name: 'Salario Principal',
            amount: rawVal,
            isUsd: finances.isUsd || false,
            isrEnabled: finances.isrEnabled || false,
            ivaEnabled: finances.ivaEnabled || false,
            ivaRate: finances.ivaRate || 0.05,
            startDate: '2025-01-01',
            createdAt: new Date().toISOString()
        }];
    };

    // ─── State ────────────────────────────────────────────────────
    // ─── State initialization directly from props for instant render ──────────
    const [fixedIncomes, setFixedIncomes] = useState(() => {
        const stored = userData?.finances?.fixedIncomes;
        if (stored && Array.isArray(stored) && stored.length > 0) return stored;
        return migrateToFixedIncomes();
    });
    const [variableIncomes, setVariableIncomes] = useState(userData?.finances?.variableIncomes || []);
    const [saving, setSaving] = useState(false);
    const [exchangeRate, setExchangeRate] = useState(7.75);
    const [editingFixedId, setEditingFixedId] = useState(null);
    const [editAmount, setEditAmount] = useState('');
    const [editStartDate, setEditStartDate] = useState('');
    const [showAddFixed, setShowAddFixed] = useState(false);
    const [newFixed, setNewFixed] = useState({ name: '', amount: '', isUsd: false, isrEnabled: false, ivaEnabled: false, ivaRate: 0.05 });

    // ─── Fetch exchange rate ──────────────────────────────────────
    useEffect(() => {
        const fetchRate = async () => {
            try {
                const response = await fetch('https://open.er-api.com/v6/latest/USD');
                const data = await response.json();
                if (data?.rates?.GTQ) setExchangeRate(data.rates.GTQ);
            } catch (err) {
                console.error("Exchange rate error:", err);
            }
        };
        fetchRate();
    }, []);

    // ─── Sync from Firestore ──────────────────────────────────────
    useEffect(() => {
        if (userData?.finances && !saving) {
            const f = userData.finances;
            if (f.fixedIncomes && Array.isArray(f.fixedIncomes)) {
                setFixedIncomes(f.fixedIncomes);
            }
            setVariableIncomes(f.variableIncomes || []);
        }
    }, [userData, saving]);

    // ─── Persist ──────────────────────────────────────────────────
    const persist = useCallback(async (updates) => {
        if (!user?.uid) return;
        setSaving(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            const fixed = updates.fixedIncomes ?? fixedIncomes;
            const vars = updates.variableIncomes ?? variableIncomes;

            // Calculate TF and enrich fixed incomes with pre-calculated totals
            let TF = 0;
            const enrichedFixed = fixed.map(inc => {
                const raw = parseFloat(inc.amount) || 0;
                const gtq = inc.isUsd ? raw * exchangeRate : raw;
                const isr = inc.isrEnabled ? gtq * 0.05 : 0;
                const iva = inc.ivaEnabled ? gtq * (inc.ivaRate || 0.05) : 0;
                const total = (gtq - isr - iva);
                TF += total;
                return { ...inc, total }; // Save calculated total in item
            });

            // Enrich variable incomes and calculate TV
            const enrichedVars = vars.map(v => ({
                ...v,
                total: parseFloat(v.amount) || 0 // Variables are already in GTQ
            }));
            const TV = enrichedVars.reduce((acc, v) => acc + v.total, 0);

            // TI = TF + TV
            const TI = TF + TV;

            // Legacy compatibility: keep rawIncome as first fixed income
            const primaryFixed = enrichedFixed[0];
            const legacyRawIncome = primaryFixed ? (parseFloat(primaryFixed.amount) || 0) : 0;

            const payload = {
                'finances.fixedIncomes': enrichedFixed,
                'finances.variableIncomes': enrichedVars,
                'finances.income': TI,
                'finances.updatedAt': new Date().toISOString(),
                'finances.rawIncome': legacyRawIncome,
                'finances.isUsd': primaryFixed?.isUsd || false,
                'finances.isrEnabled': primaryFixed?.isrEnabled || false,
                'finances.ivaEnabled': primaryFixed?.ivaEnabled || false,
                'finances.ivaRate': primaryFixed?.ivaRate || 0.05,
                ...(legacyRawIncome > 0 ? { 'finances.lastKnownIncome': legacyRawIncome } : {}),
            };

            await updateDoc(userRef, payload);
        } catch (err) {
            console.error("Persist error:", err);
        } finally {
            setTimeout(() => setSaving(false), 500);
        }
    }, [user, fixedIncomes, variableIncomes, exchangeRate]);

    // ═══════ FIXED INCOME HANDLERS ═══════
    const addFixedIncome = () => {
        if (!newFixed.name.trim() || !newFixed.amount) return;
        const item = {
            id: Date.now().toString(),
            name: newFixed.name.trim(),
            amount: parseFloat(newFixed.amount) || 0,
            isUsd: newFixed.isUsd,
            isrEnabled: newFixed.isrEnabled,
            ivaEnabled: newFixed.ivaEnabled,
            ivaRate: newFixed.ivaRate,
            startDate: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            history: []
        };
        const updated = [...fixedIncomes, item];
        setFixedIncomes(updated);
        setShowAddFixed(false);
        setNewFixed({ name: '', amount: '', isUsd: false, isrEnabled: false, ivaEnabled: false, ivaRate: 0.05 });
        persist({ fixedIncomes: updated });
    };

    const removeFixedIncome = (id) => {
        const updated = fixedIncomes.filter(i => i.id !== id);
        setFixedIncomes(updated);
        persist({ fixedIncomes: updated });
    };

    const startEditFixed = (inc) => {
        setEditingFixedId(inc.id);
        setEditAmount(inc.amount);
        setEditStartDate(new Date().toISOString().split('T')[0]);
    };

    const confirmEditFixed = () => {
        const updated = fixedIncomes.map(inc => {
            if (inc.id !== editingFixedId) return inc;
            // Save history for proration
            const history = inc.history || [];
            history.push({
                amount: inc.amount,
                endDate: editStartDate,
                changedAt: new Date().toISOString()
            });
            return {
                ...inc,
                amount: parseFloat(editAmount) || inc.amount,
                startDate: editStartDate,
                history
            };
        });
        setFixedIncomes(updated);
        setEditingFixedId(null);
        persist({ fixedIncomes: updated });
    };

    const toggleFixedRetention = (id, field, value) => {
        const updated = fixedIncomes.map(inc => {
            if (inc.id !== id) return inc;

            if (field === 'ivaEnabled') {
                // Cycle: off → 5% → 12% → off
                if (!inc.ivaEnabled) return { ...inc, ivaEnabled: true, ivaRate: 0.05 };
                if (inc.ivaRate === 0.05) return { ...inc, ivaRate: 0.12 };
                return { ...inc, ivaEnabled: false };
            }

            return { ...inc, [field]: value };
        });
        setFixedIncomes(updated);
        persist({ fixedIncomes: updated });
    };

    // ═══════ VARIABLE INCOME HANDLERS ═══════
    const addVariableIncome = () => {
        const item = { id: Date.now().toString(), name: '', amount: 0, date: new Date().toISOString().split('T')[0] };
        const updated = [...variableIncomes, item];
        setVariableIncomes(updated);
        persist({ variableIncomes: updated });
    };

    const removeVariableIncome = (id) => {
        const updated = variableIncomes.filter(i => i.id !== id);
        setVariableIncomes(updated);
        persist({ variableIncomes: updated });
    };

    const updateVariableIncome = (id, field, value) => {
        const updated = variableIncomes.map(i => i.id === id ? { ...i, [field]: value } : i);
        setVariableIncomes(updated);
        persist({ variableIncomes: updated });
    };

    // ═══════ COMPUTED METRICS ═══════
    const metrics = useMemo(() => {
        let totalGrossFixed = 0;
        let totalRetentions = 0;
        let TF = 0;

        fixedIncomes.forEach(inc => {
            // Priority: Pre-calculated 'total' or fallback to live calculation
            const raw = parseFloat(inc.amount) || 0;
            const gtq = inc.isUsd ? raw * exchangeRate : raw;
            totalGrossFixed += gtq;
            
            const isr = inc.isrEnabled ? gtq * 0.05 : 0;
            const iva = inc.ivaEnabled ? gtq * (inc.ivaRate || 0.05) : 0;
            const currentNet = gtq - isr - iva;
            
            // Use inc.total if available for display consistency until next edit
            const itemTotal = inc.total ?? currentNet;
            
            totalRetentions += (isr + iva);
            TF += itemTotal;
        });

        const TV = variableIncomes.reduce((acc, v) => acc + (parseFloat(v.amount) || 0), 0);
        const TI = TF + TV;
        const TR = totalRetentions;

        return { TI, TF, TV, TR, totalGrossFixed };
    }, [fixedIncomes, variableIncomes, exchangeRate]);

    const { TI, TF, TV, TR, totalGrossFixed } = metrics;

    const monthName = new Date().toLocaleString('es-GT', { month: 'long' });

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className="space-y-6 pb-28">

            {/* ══════ 1. BANNER PRINCIPAL ══════ */}
            {(() => {
                const fixedPct = TI > 0 ? (TF / TI) * 100 : 0;
                const variablePct = TI > 0 ? (TV / TI) * 100 : 0;

                return (
                    <div className="glass-card p-6 md:p-8 relative overflow-hidden border border-white/5">
                        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] -mr-20 -mt-20 bg-blue-500/20" />

                        {/* Rich Insights — Top Right */}
                        <div className="hidden lg:block absolute top-8 right-8 w-80 z-20">
                            <RichInsightsCard userData={userData} section="income" />
                        </div>

                        <div className="relative z-10">
                            {/* Hero: Total Ingresos (TI) */}
                            <div className="mb-6">
                                <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400 mb-2">
                                    Total Ingresos · {monthName}
                                </div>
                                <div className="text-4xl md:text-5xl font-black tracking-tighter text-blue-400">
                                    Q{TI.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                {/* Composition bar */}
                                <div className="mt-4 h-2.5 bg-black/40 rounded-full overflow-hidden w-full max-w-sm flex">
                                    {TF > 0 && (
                                        <div
                                            className="h-full bg-blue-500 transition-all duration-700"
                                            style={{ width: `${fixedPct}%` }}
                                        />
                                    )}
                                    {TV > 0 && (
                                        <div
                                            className="h-full bg-emerald-400 transition-all duration-700"
                                            style={{ width: `${variablePct}%` }}
                                        />
                                    )}
                                </div>
                                <div className="mt-1.5 flex items-center gap-4 text-[10px]">
                                    <span className="flex items-center gap-1.5 font-bold text-aura-muted/60"><span className="w-2 h-2 rounded-full bg-blue-500" /> Fijo {fixedPct.toFixed(0)}%</span>
                                    <span className="flex items-center gap-1.5 font-bold text-aura-muted/60"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Variable {variablePct.toFixed(0)}%</span>
                                </div>
                            </div>

                            {/* Secondary Metrics: TF & TV */}
                            <div className="max-w-md grid grid-cols-2 gap-3">
                                <div className="flex flex-col p-3 rounded-xl border transition-all bg-blue-500/5 border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.05)]">
                                    <div className="text-[10px] uppercase tracking-widest font-black mb-1 text-blue-400">
                                        Ingreso Fijo
                                    </div>
                                    <div className="text-lg font-black text-blue-400">
                                        Q{TF.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="flex flex-col p-3 rounded-xl border transition-all bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                                    <div className="text-[10px] uppercase tracking-widest font-black mb-1 text-emerald-400">
                                        Ingreso Variable
                                    </div>
                                    <div className="text-lg font-black text-emerald-400">
                                        Q{TV.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                        </div>


                    </div>
                );
            })()}

            {/* Action Bar: New Income Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                    onClick={() => setShowAddFixed(true)}
                    className="w-full glass-card border-dashed border-blue-500/30 p-5 flex items-center justify-center gap-3 hover:bg-blue-500/5 hover:border-blue-500/50 transition-all group"
                >
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Plus size={20} className="text-blue-400" />
                    </div>
                    <span className="text-sm font-bold text-blue-400 uppercase tracking-widest">Nuevo Ingreso Fijo</span>
                </button>

                <button
                    onClick={addVariableIncome}
                    className="w-full glass-card border-dashed border-emerald-500/30 p-5 flex items-center justify-center gap-3 hover:bg-emerald-500/5 hover:border-emerald-500/50 transition-all group"
                >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Plus size={20} className="text-emerald-400" />
                    </div>
                    <span className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Entrada Variable</span>
                </button>
            </div>
            <div className="glass-card p-4 md:p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex gap-2 items-center">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-blue-400">Salarios / Ingresos Fijos</h3>
                            <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-md font-bold">
                                {fixedIncomes.length} {fixedIncomes.length === 1 ? 'fuente' : 'fuentes'}
                            </span>
                        </div>
                        <p className="text-[10px] text-aura-muted/60 mt-0.5">Ingresos recurrentes con retenciones aplicadas.</p>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] uppercase tracking-widest text-aura-muted font-bold mb-0.5">Total Neto Fijo</div>
                        <div className="text-xl font-black text-blue-400">
                            Q{TF.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>

                {/* Fixed Income Cards */}
                <div className="space-y-4">
                    {fixedIncomes.map(inc => {
                        const Icon = getIncomeIcon(inc.name);
                        const rawAmt = parseFloat(inc.amount) || 0;
                        const gtq = inc.isUsd ? rawAmt * exchangeRate : rawAmt;
                        const isr = inc.isrEnabled ? gtq * 0.05 : 0;
                        const iva = inc.ivaEnabled ? gtq * (inc.ivaRate || 0.05) : 0;
                        const net = gtq - isr - iva;
                        const isEditing = editingFixedId === inc.id;

                        return (
                            <div key={inc.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 md:p-5 hover:border-blue-500/20 transition-all duration-300">
                                {/* Card Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400">
                                            <Icon size={20} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-black text-white">{inc.name}</div>
                                            <div className="text-[9px] text-aura-muted uppercase font-bold tracking-tight">
                                                {inc.isUsd ? `$${rawAmt.toLocaleString()} USD · Q${gtq.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'GTQ · Mensual'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => isEditing ? setEditingFixedId(null) : startEditFixed(inc)}
                                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white transition-all"
                                        >
                                            {isEditing ? <X size={14} /> : <Pencil size={14} />}
                                        </button>
                                        {fixedIncomes.length > 1 && (
                                            <button
                                                onClick={() => removeFixedIncome(inc.id)}
                                                className="p-2 rounded-lg bg-red-500/5 hover:bg-red-500/10 text-red-400/40 hover:text-red-400 transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Edit Panel (Proration) */}
                                {isEditing && (
                                    <div className="mb-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Calendar size={12} /> Modificar Monto (con prorrateo)
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[9px] text-aura-muted uppercase font-bold tracking-tight block mb-1">Nuevo Monto</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-aura-muted font-bold text-sm">{inc.isUsd ? '$' : 'Q'}</span>
                                                    <input
                                                        type="number"
                                                        value={editAmount}
                                                        onChange={(e) => setEditAmount(e.target.value)}
                                                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-8 pr-3 text-lg font-black text-white focus:outline-none focus:border-blue-400 transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[9px] text-aura-muted uppercase font-bold tracking-tight block mb-1">A partir de</label>
                                                <input
                                                    type="date"
                                                    value={editStartDate}
                                                    onChange={(e) => setEditStartDate(e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-blue-400 transition-all"
                                                    style={{ colorScheme: 'dark' }}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={confirmEditFixed}
                                            className="mt-3 px-4 py-2 bg-blue-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all"
                                        >
                                            Confirmar Cambio
                                        </button>
                                        {(inc.history || []).length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-white/5">
                                                <div className="text-[9px] text-aura-muted/50 uppercase font-bold tracking-tight mb-1">Historial de cambios</div>
                                                {inc.history.map((h, i) => (
                                                    <div key={i} className="text-[9px] text-aura-muted/40 flex justify-between">
                                                        <span>Q{parseFloat(h.amount).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        <span>hasta {h.endDate}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Card Content: Amount & Retentions */}
                                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                                    {/* Net Amount */}
                                    <div>
                                        <div className="text-2xl font-black text-white">
                                            Q{net.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        {(isr > 0 || iva > 0) && (
                                            <div className="text-[9px] text-red-400/70 font-bold mt-0.5">
                                                −Q{(isr + iva).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} en retenciones
                                            </div>
                                        )}
                                    </div>

                                    {/* Retention Toggles */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => toggleFixedRetention(inc.id, 'isrEnabled', !inc.isrEnabled)}
                                            className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-tight transition-all ${inc.isrEnabled
                                                ? 'bg-red-500/15 border-red-500/30 text-red-400'
                                                : 'bg-white/5 border-white/10 text-aura-muted hover:border-white/20'
                                                }`}
                                        >
                                            ISR 5% {inc.isrEnabled && <span className="ml-1">✓</span>}
                                        </button>
                                        <button
                                            onClick={() => toggleFixedRetention(inc.id, 'ivaEnabled')}
                                            className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-tight transition-all ${inc.ivaEnabled
                                                ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                                                : 'bg-white/5 border-white/10 text-aura-muted hover:border-white/20'
                                                }`}
                                        >
                                            IVA {inc.ivaEnabled ? `${(inc.ivaRate || 0.05) * 100}%` : ''} {inc.ivaEnabled && <span className="ml-1">✓</span>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Add Fixed Income */}
                    {showAddFixed ? (
                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-[10px] text-blue-400 font-black uppercase tracking-widest flex items-center gap-2">
                                    <Plus size={14} /> Nuevo Ingreso Fijo
                                </div>
                                <button onClick={() => setShowAddFixed(false)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-aura-muted hover:text-white transition-all">
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                <input
                                    type="text"
                                    value={newFixed.name}
                                    onChange={(e) => setNewFixed(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Nombre (ej: Salario Empresa X)"
                                    className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-blue-400 placeholder:text-white/15"
                                />
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-aura-muted font-bold">Q</span>
                                    <input
                                        type="number"
                                        value={newFixed.amount}
                                        onChange={(e) => setNewFixed(p => ({ ...p, amount: e.target.value }))}
                                        placeholder="Monto mensual"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-8 pr-3 text-lg font-black text-white focus:outline-none focus:border-blue-400 placeholder:text-white/15"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-4">
                                <label className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                                    <input type="checkbox" checked={newFixed.isUsd} onChange={(e) => setNewFixed(p => ({ ...p, isUsd: e.target.checked }))} className="w-4 h-4 rounded bg-black/50 border-white/10 text-blue-500" />
                                    <span className="text-[10px] font-black text-white">USD $</span>
                                </label>
                                <label className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                                    <input type="checkbox" checked={newFixed.isrEnabled} onChange={(e) => setNewFixed(p => ({ ...p, isrEnabled: e.target.checked }))} className="w-4 h-4 rounded bg-black/50 border-white/10 text-blue-500" />
                                    <span className="text-[10px] font-black text-white">ISR 5%</span>
                                </label>
                                <label className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                                    <input type="checkbox" checked={newFixed.ivaEnabled} onChange={(e) => setNewFixed(p => ({ ...p, ivaEnabled: e.target.checked }))} className="w-4 h-4 rounded bg-black/50 border-white/10 text-blue-500" />
                                    <span className="text-[10px] font-black text-white">IVA</span>
                                </label>
                            </div>
                            <button
                                onClick={addFixedIncome}
                                disabled={!newFixed.name.trim() || !newFixed.amount}
                                className="px-5 py-3 bg-blue-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                            >
                                Agregar Ingreso Fijo
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>


            {/* ══════ 3. INGRESOS VARIABLES DEL MES ══════ */}
            <div className="glass-card p-4 md:p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex gap-2 items-center">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-400">Ingresos Variables</h3>
                            <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md font-bold">
                                {variableIncomes.length} {variableIncomes.length === 1 ? 'ingreso' : 'ingresos'}
                            </span>
                        </div>
                        <p className="text-[10px] text-aura-muted/60 mt-0.5">Ventas, bonos, regalos, o cualquier extra de este mes.</p>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] uppercase tracking-widest text-aura-muted font-bold mb-0.5">Total Variables</div>
                        <div className="text-xl font-black text-emerald-400">
                            Q{TV.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    {variableIncomes.map((item) => {
                        const Icon = getIncomeIcon(item.name || '');
                        return (
                            <div key={item.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 hover:border-emerald-500/20 transition-all duration-300 animate-in slide-in-from-right-4">
                                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                            <Icon size={18} />
                                        </div>
                                        <div className="flex-1 flex flex-col gap-1">
                                            {item.isTransfer && (
                                                <span className="text-[9px] font-black bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 tracking-tighter uppercase w-fit">Traspaso de Capital</span>
                                            )}
                                            <input
                                                type="text"
                                                value={item.name}
                                                onChange={(e) => updateVariableIncome(item.id, 'name', e.target.value)}
                                                placeholder="Descripción del ingreso"
                                                disabled={item.isTransfer}
                                                className={`w-full bg-transparent border-b border-white/10 py-1 text-sm font-bold text-white focus:outline-none focus:border-emerald-400 transition-all placeholder:text-white/10 ${item.isTransfer ? 'opacity-60 grayscale' : ''}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 justify-end">
                                        <input
                                            type="date"
                                            value={item.date || ''}
                                            onChange={(e) => updateVariableIncome(item.id, 'date', e.target.value)}
                                            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                            style={{ colorScheme: 'dark' }}
                                        />
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/30">Q</span>
                                            <input
                                                type="number"
                                                value={item.amount}
                                                onChange={(e) => updateVariableIncome(item.id, 'amount', e.target.value)}
                                                className="w-24 bg-black/40 border border-white/10 rounded-xl py-2.5 pl-7 pr-3 text-base font-black text-right text-white focus:outline-none focus:border-emerald-400 transition-all"
                                            />
                                        </div>
                                        <button
                                            onClick={() => removeVariableIncome(item.id)}
                                            className="w-10 h-10 flex items-center justify-center text-red-400/30 hover:text-red-400 bg-red-400/5 hover:bg-red-400/10 rounded-xl transition-all border border-transparent hover:border-red-400/10"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}



                    {variableIncomes.length === 0 && (
                        <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-10 text-center group cursor-pointer hover:bg-white/[0.07] transition-all" onClick={addVariableIncome}>
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                <Plus className="text-aura-muted group-hover:text-emerald-400 transition-colors" />
                            </div>
                            <p className="text-aura-muted text-sm font-medium">No hay ingresos variables este mes.</p>
                            <p className="text-[10px] text-aura-muted/60 uppercase font-black tracking-widest mt-2">Haz clic para agregar</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
