import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, setDoc } from '../../services/backendFirestore.js';
import { ArrowRight, Wallet, CheckCircle, Percent, Info, User, Sparkles } from 'lucide-react';

export default function Onboarding({ user, onComplete }) {
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0); // 0: name, 1: income
    const [nickname, setNickname] = useState('');
    const [age, setAge] = useState('25');
    const [income, setIncome] = useState('');
    const [isUsd, setIsUsd] = useState(false);
    const [isrEnabled, setIsrEnabled] = useState(false);
    const [ivaEnabled, setIvaEnabled] = useState(false);
    const [ivaRate, setIvaRate] = useState(0.05); // 5% or 12%
    const [error, setError] = useState('');
    const [exchangeRate, setExchangeRate] = useState(7.75);

    useEffect(() => {
        const fetchRate = async () => {
            try {
                const response = await fetch('https://open.er-api.com/v6/latest/USD');
                const data = await response.json();
                if (data && data.rates && data.rates.GTQ) {
                    setExchangeRate(data.rates.GTQ);
                }
            } catch (error) {
                console.error("Error fetching rate:", error);
            }
        };
        fetchRate();
    }, []);

    // Pre-fill nickname from Google name
    useEffect(() => {
        if (user?.displayName && !nickname) {
            setNickname(user.displayName.split(' ')[0]);
        }
    }, [user]);

    const handleSave = async () => {
        if (!income || parseFloat(income) <= 0) {
            setError("Por favor ingresa un monto válido.");
            return;
        }

        setLoading(true);
        setError('');
        try {
            const rawIncomeVal = parseFloat(income);
            const finalGTQ = isUsd ? rawIncomeVal * exchangeRate : rawIncomeVal;
            const isrAmount = isrEnabled ? finalGTQ * 0.05 : 0;
            const ivaAmount = ivaEnabled ? finalGTQ * ivaRate : 0;
            const netIncome = finalGTQ - isrAmount - ivaAmount;

            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, {
                setupComplete: true,
                nickname: nickname.trim() || 'Usuario',
                age: parseInt(age) || 25,
                appVersion: '2.0',
                migrationDone: '2.0',
                finances: {
                    rawIncome: rawIncomeVal,
                    isUsd: isUsd,
                    isrEnabled: isrEnabled,
                    ivaEnabled: ivaEnabled,
                    ivaRate: ivaEnabled ? ivaRate : 0,
                    income: netIncome,
                    currentBalance: netIncome,
                    fixedExpenses: 0,
                    totalDebt: 0,
                    savingsGoal: 0,
                    otherIncomes: [],
                    updatedAt: new Date().toISOString()
                },
                budget: {
                    categories: []
                }
            }, { merge: true });
            onComplete();
        } catch (err) {
            console.error("Error saving onboarding data:", err);
            setError("Error al guardar tus datos. Por favor, intenta de nuevo.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] flex flex-col bg-aura-bg relative overflow-x-hidden overflow-y-auto">
            {/* Background elements mask */}
            <div className="fixed top-0 right-0 w-96 h-96 bg-aura-primary/5 rounded-full blur-[120px] translate-x-32 -translate-y-32 pointer-events-none" />
            <div className="fixed bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] -translate-x-32 translate-y-32 pointer-events-none" />

            <div className="flex-1 flex flex-col justify-center w-full max-w-xl mx-auto p-6 pt-[calc(env(safe-area-inset-top)+32px)] pb-safe z-10 my-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
                        Configura tus <span className="text-aura-primary">Finanzas</span>
                    </h1>
                    <p className="text-aura-muted font-medium">
                        {step === 0 ? 'Conozcamos un poco de ti.' : 'Establece tu base financiera.'}
                    </p>
                </div>

                <div className="glass-card p-10 border-aura-border shadow-2xl relative">
                    <div className="min-h-[250px] flex flex-col justify-center">

                        {/* STEP 0: Name and Age */}
                        {step === 0 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="w-16 h-16 rounded-full bg-aura-primary/10 flex items-center justify-center text-aura-primary">
                                        <User size={32} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white mb-1">Tu perfil básico</h2>
                                        <p className="text-sm text-aura-muted">Para personalizar tus insights.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-aura-muted uppercase tracking-widest pl-1">Apodo</label>
                                        <input
                                            type="text"
                                            value={nickname}
                                            onChange={(e) => setNickname(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-aura-primary/50 transition-all font-sans tracking-tight"
                                            placeholder="Ej: Rivas"
                                            autoFocus
                                            maxLength={20}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-aura-muted uppercase tracking-widest pl-1">Edad</label>
                                        <input
                                            type="number"
                                            value={age}
                                            onChange={(e) => setAge(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-aura-primary/50 transition-all font-sans tracking-tight text-center"
                                            placeholder="25"
                                            min="13"
                                            max="120"
                                        />
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 justify-center text-aura-muted bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <Sparkles size={16} className="text-aura-primary shrink-0" />
                                    <span className="text-[11px] font-medium leading-tight">Rich Insights usará estos datos para darte consejos más precisos según tu etapa de vida.</span>
                                </div>
                            </div>
                        )}

                        {/* STEP 1: Income */}
                        {step === 1 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-aura-primary/10 flex items-center justify-center text-aura-primary">
                                            <Wallet size={32} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">¿Cuál es tu ingreso?</h2>
                                            <p className="text-sm text-aura-muted">Base para tu presupuesto.</p>
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer bg-white/5 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={isUsd}
                                            onChange={(e) => setIsUsd(e.target.checked)}
                                            className="w-4 h-4 rounded text-aura-primary"
                                        />
                                        <span className="text-xs font-bold text-white">Es en USD $</span>
                                    </label>
                                </div>

                                <div className="space-y-6">
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold text-xl">
                                            {isUsd ? '$' : 'Q'}
                                        </span>
                                        <input
                                            type="number"
                                            value={income}
                                            onChange={(e) => setIncome(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-6 pl-12 pr-6 text-4xl font-black text-white focus:outline-none focus:ring-2 focus:ring-aura-primary/50 transition-all font-sans tracking-tighter"
                                            placeholder="0.00"
                                            autoFocus
                                        />
                                    </div>

                                    {isUsd && income && !isNaN(income) && (
                                        <div className="text-sm font-semibold text-aura-primary flex items-center gap-2 bg-aura-primary/5 p-4 rounded-xl border border-aura-primary/10">
                                            <Info size={16} />
                                            Equivale a aprox. <b>Q{(parseFloat(income) * exchangeRate).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> GTQ (T.C. {exchangeRate})
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setIsrEnabled(!isrEnabled)}
                                            className={`p-4 rounded-2xl border transition-all flex items-center justify-between group ${isrEnabled ? 'bg-aura-primary/10 border-aura-primary/50 text-white' : 'bg-white/5 border-white/10 text-aura-muted hover:border-white/20'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="text-left">
                                                    <div className="font-bold text-sm">ISR (5%)</div>
                                                </div>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isrEnabled ? 'bg-aura-primary border-aura-primary' : 'border-white/20'}`}>
                                                {isrEnabled && <CheckCircle size={12} className="text-black" />}
                                            </div>
                                        </button>

                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => {
                                                    if (!ivaEnabled) {
                                                        setIvaEnabled(true);
                                                        setIvaRate(0.05);
                                                    } else if (ivaRate === 0.05) {
                                                        setIvaRate(0.12);
                                                    } else {
                                                        setIvaEnabled(false);
                                                    }
                                                }}
                                                className={`p-4 rounded-2xl border transition-all flex items-center justify-between group ${ivaEnabled ? 'bg-orange-500/10 border-orange-500/50 text-white' : 'bg-white/5 border-white/10 text-aura-muted hover:border-white/20'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="text-left">
                                                        <div className="font-bold text-sm">IVA {ivaEnabled ? `(${ivaRate * 100}%)` : ''}</div>
                                                    </div>
                                                </div>
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${ivaEnabled ? 'bg-orange-500 border-orange-500' : 'border-white/20'}`}>
                                                    {ivaEnabled && <CheckCircle size={12} className="text-black" />}
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-10 flex flex-col gap-4 border-t border-white/5 pt-6">
                        {error && (
                            <div className="text-red-400 text-sm font-bold bg-red-400/10 p-3 rounded-lg border border-red-400/20 text-center animate-in fade-in duration-300">
                                {error}
                            </div>
                        )}

                        {step === 0 ? (
                            <button
                                onClick={() => {
                                    if (!nickname.trim()) {
                                        setError('Escribe tu nombre o apodo.');
                                        return;
                                    }
                                    if (!age || parseInt(age) < 13) {
                                        setError('Debes ingresar una edad válida (mínimo 13 años).');
                                        return;
                                    }
                                    setError('');
                                    setStep(1);
                                }}
                                className="w-full bg-white text-black py-4 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-gray-200 transition-all group shadow-xl"
                            >
                                Siguiente <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep(0)}
                                    className="px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
                                >
                                    Atrás
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={loading || !income}
                                    className="flex-1 bg-white text-black py-4 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-xl"
                                >
                                    {loading ? 'Guardando...' : <><CheckCircle size={20} /> Finalizar Configuración</>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 mt-6">
                    <div className={`w-8 h-1 rounded-full transition-all ${step === 0 ? 'bg-aura-primary' : 'bg-white/10'}`} />
                    <div className={`w-8 h-1 rounded-full transition-all ${step === 1 ? 'bg-aura-primary' : 'bg-white/10'}`} />
                </div>
            </div>
        </div>
    );
}
