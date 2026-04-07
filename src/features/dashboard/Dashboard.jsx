import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { calculateExpensesMetrics, calculateCashflowMetrics } from '../../lib/expenseLogic';
import {
    Activity,
    ArrowUpRight,
    Wallet,
    Clock,
    Zap,
    TrendingUp,
    TrendingDown,
    ShieldCheck,
    AlertCircle,
    Info,
    CreditCard,
    BarChart3,
    DollarSign,
    Receipt,
    CalendarCheck,
    BadgeDollarSign
} from 'lucide-react';
import RichInsightsCard from '../insights/RichInsightsCard';

const CapitalPulseMonitor = ({ totalCapital }) => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const dataRef = useRef([]);

    const formatGTQ = (val) =>
        `Q${(val || 0).toLocaleString('es-GT', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
        };

        resize();

        const width = canvas.getBoundingClientRect().width;
        const numPoints = Math.max(40, Math.ceil(width / 2));

        if (dataRef.current.length === 0) {
            dataRef.current = Array(numPoints).fill(0);
        }

        const draw = () => {
            const rect = canvas.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;

            if (!w || !h) {
                animationRef.current = requestAnimationFrame(draw);
                return;
            }

            const midY = h * 0.5;
            const microNoise = (Math.random() - 0.5) * 2.5;

            dataRef.current.push(microNoise);
            if (dataRef.current.length > numPoints + 10) {
                dataRef.current.shift();
            }

            ctx.clearRect(0, 0, w, h);

            ctx.strokeStyle = 'rgba(255,255,255,0.03)';
            ctx.lineWidth = 0.5;

            for (let y = 0; y < h; y += 16) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }

            for (let x = 0; x < w; x += 24) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
            }

            const gradient = ctx.createLinearGradient(0, 0, w, 0);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.05)');
            gradient.addColorStop(0.7, 'rgba(16, 185, 129, 0.6)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 1)');

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();

            const visibleData = dataRef.current.slice(-numPoints);

            for (let i = 0; i < visibleData.length; i++) {
                const x = (i / numPoints) * w;
                const y = midY + visibleData[i] * 3;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }

            ctx.stroke();

            const lastX = w;
            const lastY = midY + (visibleData[visibleData.length - 1] || 0) * 3;
            const glowGrad = ctx.createRadialGradient(lastX, lastY, 0, lastX, lastY, 20);
            glowGrad.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
            glowGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
            ctx.fillStyle = glowGrad;
            ctx.fillRect(lastX - 20, lastY - 20, 40, 40);

            ctx.beginPath();
            ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#10b981';
            ctx.fill();

            ctx.beginPath();
            for (let i = 0; i < visibleData.length; i++) {
                const x = (i / numPoints) * w;
                const y = midY + visibleData[i] * 3;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.closePath();

            const fillGrad = ctx.createLinearGradient(0, midY, 0, h);
            fillGrad.addColorStop(0, 'rgba(16, 185, 129, 0.08)');
            fillGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
            ctx.fillStyle = fillGrad;
            ctx.fill();

            animationRef.current = requestAnimationFrame(draw);
        };

        const resizeObserver = new ResizeObserver(() => resize());
        resizeObserver.observe(canvas);

        draw();

        return () => {
            resizeObserver.disconnect();
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, []);

    return (
        <div className="relative w-full h-full flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[7px] font-black text-emerald-400/60 uppercase tracking-widest">Live</span>
                </div>
                <span className="text-[7px] font-mono text-white/15">{new Date().toLocaleTimeString('es-GT')}</span>
            </div>
            <div className="flex-1 relative overflow-hidden rounded-lg min-h-[70px]">
                <canvas ref={canvasRef} className="w-full h-full block" />
            </div>
            <div className="mt-1 text-center">
                <span className="text-base font-black text-emerald-400 tracking-tighter italic">{formatGTQ(totalCapital)}</span>
            </div>
        </div>
    );
};

export default function Dashboard({ userData }) {
    const [exchangeRate, setExchangeRate] = useState(7.75);

    useEffect(() => {
        const fetchRate = async () => {
            try {
                const response = await fetch('https://open.er-api.com/v6/latest/USD');
                const data = await response.json();
                if (data?.rates?.GTQ) setExchangeRate(data.rates.GTQ);
            } catch (err) {
                console.error('Dashboard Exchange rate error:', err);
            }
        };
        fetchRate();
    }, []);

    const financesInfo = userData?.finances || {};
    const budgetData = userData?.budget || { categories: [] };
    const expensesRaw = userData?.expenses || [];
    const budgetCats = budgetData.categories || [];

    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7);
    const todayDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthLabel = now.toLocaleString('es-GT', { month: 'long' });
    const monthCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

    const { TI, TP, TDM, CFD } = useMemo(() => {
        return calculateCashflowMetrics(userData, currentMonth, exchangeRate);
    }, [userData, currentMonth, exchangeRate]);

    const TDM_UI = useMemo(() => {
        const debts = userData?.debts || [];
        let total = 0;

        debts.forEach((entity) => {
            (entity.debts || []).forEach((debt) => {
                if (!debt.isActive || debt.isPaid || debt.amount <= 0) return;
                if (debt.startMonth && debt.startMonth > currentMonth) return;

                if (debt.isSinglePayment) {
                    if (debt.dueDate && debt.dueDate.startsWith(currentMonth)) {
                        total += parseFloat(debt.amount) || 0;
                    }
                } else {
                    total += parseFloat(debt.monthlyPayment) || 0;
                }
            });
        });

        return total;
    }, [userData, currentMonth]);

    const { TG, TGP } = useMemo(() => {
        return calculateExpensesMetrics(expensesRaw, budgetCats, currentMonth);
    }, [expensesRaw, budgetCats, currentMonth]);

    const G_PENDIENTE = TGP;

    const totalCapitalGTQ = useMemo(() => {
        return (userData?.savings?.accounts || []).reduce((acc, account) => {
            const bal = parseFloat(account.balance) || 0;
            return acc + (account.currency === 'USD' ? bal * exchangeRate : bal);
        }, 0);
    }, [userData, exchangeRate]);

    const { healthScore, healthStatus, healthDesc, healthColor, healthIcon: HealthIcon } = useMemo(() => {
        if (TI === 0) {
            return {
                healthScore: 0,
                healthStatus: 'INACTIVO',
                healthDesc: 'Configura tus ingresos para ver tu estado financiero.',
                healthColor: '#94a3b8',
                healthIcon: Info,
            };
        }

        let score = 100;
        const debtRatio = TDM / TI;

        if (debtRatio > 0.4) score -= 40;
        else if (debtRatio > 0.25) score -= 20;

        const budgetImpact = TP / TI;
        if (budgetImpact > 1.0) score -= 30;
        else if (budgetImpact > 0.9) score -= 15;

        if (TG > TP && TP > 0) score -= 20;

        score = Math.max(0, Math.min(100, Math.round(score)));

        if (score >= 85) {
            return {
                healthScore: score,
                healthStatus: 'SÓLIDO',
                healthDesc: 'Tu estructura financiera es robusta. Mantienes un control excepcional.',
                healthColor: '#10b981',
                healthIcon: ShieldCheck,
            };
        }

        if (score >= 65) {
            return {
                healthScore: score,
                healthStatus: 'ESTABLE',
                healthDesc: 'Buen balance operativo. Tu flujo mensual está bajo control.',
                healthColor: '#3b82f6',
                healthIcon: Activity,
            };
        }

        if (score >= 45) {
            return {
                healthScore: score,
                healthStatus: 'ALERTA',
                healthDesc: 'Tus compromisos mensuales están comprometiendo tu liquidez.',
                healthColor: '#f59e0b',
                healthIcon: AlertCircle,
            };
        }

        return {
            healthScore: score,
            healthStatus: 'CRÍTICO',
            healthDesc: 'Tu plan financiero supera tus ingresos. Requiere ajuste inmediato.',
            healthColor: '#ef4444',
            healthIcon: AlertCircle,
        };
    }, [TI, TP, TDM, TG]);

    const compositionData = useMemo(() => {
        const groupMap = {};

        budgetCats.forEach((cat) => {
            const groupTitle = cat.group || 'Otros';
            if (!groupMap[groupTitle]) {
                groupMap[groupTitle] = { name: groupTitle, budgeted: 0, spent: 0 };
            }

            groupMap[groupTitle].budgeted += parseFloat(cat.total) || 0;

            const catExpenses = expensesRaw.filter(
                (e) => e.date?.startsWith(currentMonth) && e.category === cat.name
            );

            groupMap[groupTitle].spent += catExpenses.reduce(
                (s, e) => s + (parseFloat(e.amount) || 0),
                0
            );
        });

        return Object.values(groupMap)
            .filter((g) => g.budgeted > 0)
            .map((g) => ({
                ...g,
                pct: g.budgeted > 0 ? Math.round((g.spent / g.budgeted) * 100) : 0,
            }))
            .sort((a, b) => b.budgeted - a.budgeted)
            .slice(0, 8);
    }, [budgetCats, expensesRaw, currentMonth]);

    const dailyFlowData = useMemo(() => {
        const thisMonthExp = expensesRaw.filter((e) => e.date?.startsWith(currentMonth));
        const byDay = {};

        thisMonthExp.forEach((e) => {
            const day = parseInt(e.date?.split('-')[2]);
            if (!isNaN(day)) {
                if (!byDay[day]) byDay[day] = 0;
                byDay[day] += parseFloat(e.amount) || 0;
            }
        });

        const dailyBudget = daysInMonth > 0 ? TP / daysInMonth : 0;
        let cumSpent = 0;
        let cumBudget = 0;
        const data = [];

        for (let d = 1; d <= daysInMonth; d++) {
            cumBudget += dailyBudget;
            if (d <= todayDay) {
                cumSpent += byDay[d] || 0;
                data.push({ day: d, gasto: Math.round(cumSpent), planeado: Math.round(cumBudget) });
            } else {
                data.push({ day: d, gasto: null, planeado: Math.round(cumBudget) });
            }
        }

        return data;
    }, [expensesRaw, currentMonth, TP, daysInMonth, todayDay]);

    const formatGTQ = (val) =>
        `Q${(val || 0).toLocaleString('es-GT', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    const cashflowPct = TI > 0 ? Math.max(3, Math.min(100, (CFD / TI) * 100)) : 0;
    const budgetUsePct = TI > 0 ? Math.min(100, (TP / TI) * 100) : 0;
    const debtPct = TI > 0 ? Math.min(100, (TDM_UI / TI) * 100) : 0;
    const pendingPct = TP > 0 ? Math.min(100, (G_PENDIENTE / TP) * 100) : 0;
    const spentPct = TP > 0 ? Math.round((TG / TP) * 100) : 0;

    return (
        <div
            className="space-y-5 pb-28 animate-in fade-in duration-1000 min-w-0"
            style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}
        >
            <div className="relative group overflow-hidden rounded-[2rem] min-w-0">
                <div
                    className="absolute inset-0 blur-[120px] opacity-12 transition-all duration-1000 group-hover:opacity-20"
                    style={{ backgroundColor: healthColor }}
                />

                <div className="glass-card p-6 md:p-7 border-white/8 relative overflow-hidden backdrop-blur-3xl min-w-0">
                    <div className="relative z-10 flex flex-col lg:flex-row items-stretch gap-5 min-w-0">
                        <div className="flex items-center gap-5 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex-1 min-w-0">
                            <div className="relative w-28 h-28 flex-shrink-0 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 144 144">
                                    <circle cx="72" cy="72" r="60" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-white/5" />
                                    <circle
                                        cx="72"
                                        cy="72"
                                        r="60"
                                        stroke={healthColor}
                                        strokeWidth="6"
                                        fill="transparent"
                                        strokeDasharray={376.99}
                                        strokeDashoffset={376.99 - (376.99 * healthScore) / 100}
                                        strokeLinecap="round"
                                        className="transition-all duration-[1500ms] ease-out"
                                        style={{ filter: `drop-shadow(0 0 8px ${healthColor})` }}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-white tracking-tighter leading-none">{healthScore}</span>
                                    <span className="text-[7px] font-black text-white/40 tracking-[0.2em] uppercase mt-0.5">Puntaje</span>
                                </div>
                            </div>

                            <div className="flex flex-col items-start text-left flex-1 min-w-0">
                                <div className="flex items-center gap-2.5 mb-1.5">
                                    <div className="p-1.5 rounded-lg bg-white/5 border border-white/8">
                                        <HealthIcon size={18} style={{ color: healthColor }} />
                                    </div>
                                    <div>
                                        <span className="text-[8px] font-black text-white/50 tracking-[0.2em] uppercase block leading-none">
                                            Estado Financiero
                                        </span>
                                        <h1
                                            className="text-2xl font-black tracking-tighter uppercase italic leading-none mt-0.5"
                                            style={{ color: healthColor }}
                                        >
                                            {healthStatus}
                                        </h1>
                                    </div>
                                </div>
                                <p className="text-[11px] text-white/55 leading-relaxed font-medium max-w-[280px]">
                                    {healthDesc}
                                </p>
                            </div>
                        </div>

                        <div className="hidden lg:block w-px bg-white/5 self-stretch my-2" />

                        <div className="w-full lg:w-[380px] flex-shrink-0 min-w-0">
                            <RichInsightsCard userData={userData} section="dashboard" limit={5} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
                <div className="glass-card p-4 border-sky-500/15 bg-gradient-to-br from-sky-500/8 via-transparent to-sky-900/5 flex flex-col justify-between group relative overflow-hidden h-[160px] hover:border-sky-400/40 transition-all duration-500 cursor-default">
                    <div className="absolute -right-8 -top-8 bg-sky-500/10 w-28 h-28 rounded-full blur-3xl group-hover:scale-[2] transition-transform duration-700" />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-500/20 to-transparent" />

                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <div className="text-[9px] font-black text-sky-400 uppercase tracking-[0.15em] leading-none">Cashflow Disponible</div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/15 backdrop-blur-sm">
                            <Zap size={13} className="text-sky-400" />
                        </div>
                    </div>

                    <div className="relative z-10 flex-1 flex flex-col justify-center min-w-0">
                        <div className={`text-xl sm:text-2xl lg:text-[1.75rem] font-black tracking-tighter italic leading-none truncate ${CFD >= 0 ? 'text-white' : 'text-red-400'}`}>
                            {formatGTQ(CFD)}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-sky-400 rounded-full transition-all duration-1000" style={{ width: `${cashflowPct}%`, opacity: 0.5 }} />
                            </div>
                            <span className="text-[8px] font-black text-white/20">{TI > 0 ? `${Math.round(cashflowPct)}%` : '—'}</span>
                        </div>
                    </div>

                    <div className="relative z-10 flex items-center gap-1.5">
                        {CFD >= 0 ? (
                            <TrendingUp size={10} className="text-emerald-400/50" />
                        ) : (
                            <TrendingDown size={10} className="text-red-400/50" />
                        )}
                        <span className="text-[8px] font-bold text-white/20">
                            {CFD >= 0 ? 'Flujo positivo' : 'Flujo negativo'}
                        </span>
                    </div>
                </div>

                <div className="glass-card p-4 border-emerald-500/10 bg-gradient-to-br from-emerald-500/6 via-transparent to-emerald-900/5 flex flex-col justify-between group relative overflow-hidden h-[160px] hover:border-emerald-400/30 transition-all duration-500 cursor-default">
                    <div className="absolute -right-8 -top-8 bg-emerald-500/8 w-28 h-28 rounded-full blur-3xl group-hover:scale-[2] transition-transform duration-700" />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <div className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.15em] leading-none">
                                Ingresos Totales <span className="text-emerald-400/30">·</span>{' '}
                                <span className="text-emerald-400/50 normal-case">{monthCapitalized}</span>
                            </div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/15 backdrop-blur-sm">
                            <DollarSign size={13} className="text-emerald-400" />
                        </div>
                    </div>

                    <div className="relative z-10 flex-1 flex flex-col justify-center min-w-0">
                        <div className="text-xl sm:text-2xl lg:text-[1.75rem] font-black text-white tracking-tighter italic leading-none truncate">
                            {formatGTQ(TI)}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full opacity-40 w-full" />
                            </div>
                            <span className="text-[8px] font-black text-white/20">100%</span>
                        </div>
                    </div>

                    <div className="relative z-10 flex items-center gap-1.5">
                        <ArrowUpRight size={10} className="text-emerald-400/50" />
                        <span className="text-[8px] font-bold text-white/20">Base de ingresos</span>
                    </div>
                </div>

                <div className="glass-card p-4 border-purple-500/10 bg-gradient-to-br from-purple-500/6 via-transparent to-purple-900/5 flex flex-col justify-between group relative overflow-hidden h-[160px] hover:border-purple-400/30 transition-all duration-500 cursor-default">
                    <div className="absolute -right-8 -top-8 bg-purple-500/8 w-28 h-28 rounded-full blur-3xl group-hover:scale-[2] transition-transform duration-700" />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <div className="text-[9px] font-black text-purple-400 uppercase tracking-[0.15em] leading-none">
                                Presupuesto Total <span className="text-purple-400/30">·</span>{' '}
                                <span className="text-purple-400/50 normal-case">{monthCapitalized}</span>
                            </div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/15 backdrop-blur-sm">
                            <Wallet size={13} className="text-purple-400" />
                        </div>
                    </div>

                    <div className="relative z-10 flex-1 flex flex-col justify-center min-w-0">
                        <div className="text-xl sm:text-2xl lg:text-[1.75rem] font-black text-white tracking-tighter italic leading-none truncate">
                            {formatGTQ(TP)}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500 rounded-full opacity-40 transition-all duration-1000" style={{ width: `${budgetUsePct}%` }} />
                            </div>
                            <span className="text-[8px] font-black text-white/20">{Math.round(budgetUsePct)}%</span>
                        </div>
                    </div>

                    <div className="relative z-10 flex items-center gap-1.5">
                        <Receipt size={10} className="text-purple-400/50" />
                        <span className="text-[8px] font-bold text-white/20">{budgetCats.length} ítems asignados</span>
                    </div>
                </div>

                <div className="glass-card p-4 border-amber-500/10 bg-gradient-to-br from-amber-500/6 via-transparent to-amber-900/5 flex flex-col justify-between group relative overflow-hidden h-[160px] hover:border-amber-400/30 transition-all duration-500 cursor-default">
                    <div className="absolute -right-8 -top-8 bg-amber-500/8 w-28 h-28 rounded-full blur-3xl group-hover:scale-[2] transition-transform duration-700" />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <div className="text-[9px] font-black text-amber-400 uppercase tracking-[0.15em] leading-none">
                                Deuda por Pagar <span className="text-amber-400/30">·</span>{' '}
                                <span className="text-amber-400/50 normal-case">{monthCapitalized}</span>
                            </div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/15 backdrop-blur-sm">
                            <CreditCard size={13} className="text-amber-400" />
                        </div>
                    </div>

                    <div className="relative z-10 flex-1 flex flex-col justify-center min-w-0">
                        <div className="text-xl sm:text-2xl lg:text-[1.75rem] font-black text-white tracking-tighter italic leading-none truncate">
                            {formatGTQ(TDM_UI)}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full opacity-40 transition-all duration-1000" style={{ width: `${debtPct}%` }} />
                            </div>
                            <span className="text-[8px] font-black text-white/20">{Math.round(debtPct)}%</span>
                        </div>
                    </div>

                    <div className="relative z-10 flex items-center gap-1.5">
                        <CalendarCheck size={10} className="text-amber-400/50" />
                        <span className="text-[8px] font-bold text-white/20">Compromisos del mes</span>
                    </div>
                </div>

                <div className="glass-card p-4 border-fuchsia-500/10 bg-gradient-to-br from-fuchsia-500/6 via-transparent to-fuchsia-900/5 flex flex-col justify-between group relative overflow-hidden h-[160px] hover:border-fuchsia-400/30 transition-all duration-500 cursor-default">
                    <div className="absolute -right-8 -top-8 bg-fuchsia-500/8 w-28 h-28 rounded-full blur-3xl group-hover:scale-[2] transition-transform duration-700" />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/20 to-transparent" />

                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <div className="text-[9px] font-black text-fuchsia-400 uppercase tracking-[0.15em] leading-none">
                                Gastos Pendientes <span className="text-fuchsia-400/30">·</span>{' '}
                                <span className="text-fuchsia-400/50 normal-case">{monthCapitalized}</span>
                            </div>
                        </div>
                        <div className="p-1.5 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/15 backdrop-blur-sm">
                            <Clock size={13} className="text-fuchsia-400" />
                        </div>
                    </div>

                    <div className="relative z-10 flex-1 flex flex-col justify-center min-w-0">
                        <div className="text-xl sm:text-2xl lg:text-[1.75rem] font-black text-white tracking-tighter italic leading-none truncate">
                            {formatGTQ(G_PENDIENTE)}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-fuchsia-500 rounded-full transition-all duration-1000" style={{ width: `${pendingPct}%`, opacity: 0.5 }} />
                            </div>
                            <span className="text-[8px] font-black text-white/20">{Math.round(pendingPct)}% restante</span>
                        </div>
                    </div>

                    <div className="relative z-10 flex items-center gap-1.5">
                        <BadgeDollarSign size={10} className="text-fuchsia-400/50" />
                        <span className="text-[8px] font-bold text-white/20">Presupuesto no ejecutado</span>
                    </div>
                </div>

                <div className="glass-card p-3.5 border-emerald-500/10 bg-gradient-to-br from-emerald-500/6 via-transparent to-emerald-900/5 flex flex-col group relative overflow-hidden h-[160px] hover:border-emerald-400/30 transition-all duration-500 cursor-default">
                    <div className="absolute -right-8 -top-8 bg-emerald-500/8 w-28 h-28 rounded-full blur-3xl group-hover:scale-[2] transition-transform duration-700" />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

                    <div className="flex justify-between items-start relative z-10 mb-0.5">
                        <div className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.15em] leading-none">Capital Monitor</div>
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/15 backdrop-blur-sm">
                            <Activity size={13} className="text-emerald-400" />
                        </div>
                    </div>

                    <div className="relative z-10 flex-1 min-h-0 py-1">
                        <CapitalPulseMonitor totalCapital={totalCapitalGTQ} />
                    </div>
                </div>
            </div>

            <div className="glass-card p-5 relative overflow-hidden group min-w-0">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-5">
                    <div>
                        <h3 className="text-base font-black text-white italic tracking-tighter flex items-center gap-2">
                            ¿Cómo vas este mes? <BarChart3 size={15} className="text-aura-primary" />
                        </h3>
                        <p className="text-[8px] text-white/25 font-bold uppercase tracking-widest mt-0.5">
                            Tu gasto acumulado vs lo que deberías haber gastado · {monthCapitalized}
                        </p>
                    </div>

                    <div className="flex gap-2.5 text-[8px] font-black uppercase tracking-widest">
                        <div className="flex items-center gap-1.5 bg-white/5 py-1 px-2.5 rounded-full border border-white/5">
                            <span className="w-1.5 h-1.5 rounded-full bg-aura-primary" /> Tu Gasto
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/5 py-1 px-2.5 rounded-full border border-dashed border-white/10">
                            <span className="w-1.5 h-1.5 rounded-full border border-dashed border-white/30" /> Lo Planeado
                        </div>
                    </div>
                </div>

                <div className="h-[240px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={dailyFlowData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradGasto" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--aura-primary)" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="var(--aura-primary)" stopOpacity={0} />
                                </linearGradient>
                            </defs>

                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />

                            <XAxis
                                dataKey="day"
                                stroke="#333"
                                fontSize={8}
                                fontWeight="800"
                                tickLine={false}
                                axisLine={false}
                                dy={6}
                                interval={2}
                            />

                            <YAxis
                                stroke="#333"
                                fontSize={8}
                                fontWeight="800"
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => `Q${Math.round(v / 1000)}k`}
                            />

                            <Tooltip
                                cursor={{ stroke: 'rgba(255,255,255,0.05)', strokeWidth: 1 }}
                                contentStyle={{
                                    backgroundColor: 'rgba(0,0,0,0.95)',
                                    backdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '12px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    boxShadow: '0 15px 40px -10px rgba(0,0,0,0.5)',
                                    padding: '8px 12px',
                                }}
                                itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                labelFormatter={(v) => `Día ${v}`}
                                formatter={(value, name) => {
                                    if (value === null) return ['—', name]
                                    const label = name === 'gasto' ? 'Tu Gasto' : 'Lo Planeado'
                                    return [`Q${value.toLocaleString()}`, label]
                                }}
                            />

                            <Area
                                type="monotone"
                                dataKey="planeado"
                                stroke="rgba(255,255,255,0.1)"
                                strokeDasharray="6 4"
                                fill="transparent"
                                strokeWidth={1.5}
                                animationDuration={1500}
                                dot={false}
                            />

                            <Area
                                type="monotone"
                                dataKey="gasto"
                                stroke="var(--aura-primary)"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#gradGasto)"
                                animationDuration={2000}
                                animationEasing="ease-out"
                                dot={false}
                                connectNulls={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-5">
                        <div>
                            <span className="text-[7px] font-black text-white/20 uppercase tracking-widest block">Gastado</span>
                            <span className="text-xs font-black text-aura-primary">{formatGTQ(TG)}</span>
                        </div>
                        <div>
                            <span className="text-[7px] font-black text-white/20 uppercase tracking-widest block">Planeado</span>
                            <span className="text-xs font-black text-white/40">{formatGTQ(TP)}</span>
                        </div>
                        <div>
                            <span className="text-[7px] font-black text-white/20 uppercase tracking-widest block">Disponible</span>
                            <span className={`text-xs font-black ${G_PENDIENTE >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatGTQ(G_PENDIENTE)}
                            </span>
                        </div>
                    </div>

                    <div className="text-right">
                        <span className="text-[7px] font-black text-white/20 uppercase tracking-widest block">Usado</span>
                        <span className={`text-xs font-black ${spentPct > 90 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {spentPct}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}