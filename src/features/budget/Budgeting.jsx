import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from '../../services/backendFirestore.js';
import {
    Plus, Trash2, X, AlertCircle, Zap, Droplets, Wifi, Youtube, Gamepad2,
    ShoppingCart, Info, Home, Car, Dumbbell, Smartphone, CreditCard, Music,
    Wallet, Shield, Cloud, Bot, Sparkles, HeartPulse, ShieldCheck, GraduationCap,
    School, PawPrint, ChevronDown, ChevronRight, ArrowUpDown, Utensils,
    PartyPopper, Scissors, Shirt, Ticket, Film, Beer, Flame, Watch, Pill,
    BusFront, TrendingUp, CircleDollarSign, RefreshCcw, CloudCheck, Banknote,
    AlertTriangle
} from 'lucide-react';
import RichInsightsCard from '../insights/RichInsightsCard';
import { calculateCashflowMetrics } from '../../lib/expenseLogic';

// ──────────────────── SUGGESTION GROUPS ────────────────────
const SUGGESTION_GROUPS = [
    {
        title: "Vivienda & Servicios",
        items: [
            { id: 's1', name: 'Renta (Casa/Apto)', icon: Home, defaultAmount: '', isFixed: true },
            { id: 's2', name: 'Luz (EEGSA/Energuate)', icon: Zap, defaultAmount: '' },
            { id: 's3', name: 'Agua (Empagua)', icon: Droplets, defaultAmount: '', isFixed: true },
            { id: 's42', name: 'Alimentación', icon: Utensils, defaultAmount: '' },
            { id: 's28', name: 'Delivery', icon: Utensils, defaultAmount: '' },
            { id: 's45', name: 'Mercado', icon: ShoppingCart, defaultAmount: '' },
            { id: 's14', name: 'Garita', icon: Shield, defaultAmount: '', isFixed: true },
            { id: 's15', name: 'Basura', icon: Trash2, defaultAmount: '', isFixed: true },
            { id: 's30', name: 'Contador', icon: ShieldCheck, defaultAmount: '', isFixed: true },
            { id: 's35', name: 'Google Workspace', icon: Cloud, defaultAmount: '', isUsd: true, isFixed: true },
        ]
    },
    {
        title: "Comunicaciones",
        items: [
            { id: 's10', name: 'Internet Residencial', icon: Wifi, defaultAmount: '', isFixed: true },
            { id: 's11', name: 'Plan Celular', icon: Smartphone, defaultAmount: '', isFixed: true },
        ]
    },
    {
        title: "Suscripciones Digitales",
        items: [
            { id: 's4', name: 'Netflix', icon: Youtube, defaultAmount: '10.99', isUsd: true, isFixed: true },
            { id: 's5', name: 'Spotify', icon: Music, defaultAmount: '5.99', isUsd: true, isFixed: true },
            { id: 's16', name: 'Apple Music', icon: Music, defaultAmount: '', isUsd: true, isFixed: true },
            { id: 's6', name: 'Amazon Prime', icon: ShoppingCart, defaultAmount: '14.99', isUsd: true, isFixed: true },
            { id: 's17', name: 'HBO Max', icon: Youtube, defaultAmount: '', isUsd: true, isFixed: true },
            { id: 's32', name: 'Disney+', icon: Youtube, defaultAmount: '', isUsd: true, isFixed: true },
            { id: 's33', name: 'Crunchyroll', icon: Gamepad2, defaultAmount: '', isUsd: true, isFixed: true },
            { id: 's21', name: 'YouTube Premium', icon: Youtube, defaultAmount: '', isUsd: true, isFixed: true },
            { id: 's22', name: 'YouTube Music', icon: Music, defaultAmount: '', isUsd: true, isFixed: true },
            { id: 's18', name: 'iCloud+', icon: Cloud, defaultAmount: '', isUsd: true, isFixed: true },
            { id: 's34', name: 'Google One', icon: Cloud, defaultAmount: '', isUsd: true, isFixed: true },
            { id: 's19', name: 'ChatGPT', icon: Bot, defaultAmount: '20.00', isUsd: true, isFixed: true },
            { id: 's20', name: 'Google AI Pro', icon: Sparkles, defaultAmount: '20.00', isUsd: true, isFixed: true },
            { id: 's36', name: 'Microsoft 365', icon: CreditCard, defaultAmount: '', isUsd: true, isFixed: true },
            { id: 's37', name: 'Hostinger n8n', icon: Cloud, defaultAmount: '', isUsd: true, isFixed: true },
            { id: 's38', name: 'Duolingo', icon: GraduationCap, defaultAmount: '', isUsd: true, isFixed: true },
            { id: 's41', name: 'Uber One', icon: ShoppingCart, defaultAmount: '', isFixed: true },
        ]
    },
    {
        title: "Vehículos",
        items: [
            { id: 's9', name: 'Gasolina', icon: Car, defaultAmount: '' },
            { id: 's39', name: 'Diesel', icon: Car, defaultAmount: '' },
            { id: 's24', name: 'Seguro de Auto', icon: ShieldCheck, defaultAmount: '', isFixed: true },
            { id: 's40', name: 'CarWash', icon: Car, defaultAmount: '' },
            { id: 's69', name: 'Transporte Público', icon: BusFront, defaultAmount: '' },
        ]
    },
    {
        title: "Salud",
        items: [
            { id: 's23', name: 'Seguro Médico', icon: HeartPulse, defaultAmount: '', isFixed: true },
            { id: 's60', name: 'Dentista', icon: HeartPulse, defaultAmount: '' },
            { id: 's70', name: 'Medicamentos', icon: Pill, defaultAmount: '' },
            { id: 's71', name: 'Suplementos', icon: Pill, defaultAmount: '' },
            { id: 's72', name: 'Probióticos', icon: Pill, defaultAmount: '' },
            { id: 's43', name: 'IGSS', icon: HeartPulse, defaultAmount: '', isFixed: true },
            { id: 's61', name: 'Seguro de Vida', icon: Shield, defaultAmount: '', isFixed: true },
            { id: 's62', name: 'Seguro de Muerte', icon: Shield, defaultAmount: '', isFixed: true },
            { id: 's31', name: 'Motita Cherry', icon: HeartPulse, defaultAmount: '' },
        ]
    },
    {
        title: "Educación",
        items: [
            { id: 's25', name: 'Universidad', icon: GraduationCap, defaultAmount: '', isFixed: true },
            { id: 's26', name: 'Colegio', icon: School, defaultAmount: '', isFixed: true },
        ]
    },
    {
        title: "Retail",
        items: [
            { id: 's8', name: 'Supermercado', icon: ShoppingCart, defaultAmount: '' },
            { id: 's46', name: 'La Despensa', icon: ShoppingCart, defaultAmount: '' },
            { id: 's47', name: 'La Torre', icon: ShoppingCart, defaultAmount: '' },
            { id: 's48', name: 'Walmart', icon: ShoppingCart, defaultAmount: '' },
            { id: 's49', name: 'Mi SuperFresh', icon: ShoppingCart, defaultAmount: '' },
            { id: 's50', name: 'Mi Super del Barrio', icon: ShoppingCart, defaultAmount: '' },
            { id: 's51', name: 'Suma', icon: ShoppingCart, defaultAmount: '' },
            { id: 's44', name: 'PriceSmart', icon: ShoppingCart, defaultAmount: '' },
        ]
    },
    {
        title: "Mascotas",
        items: [
            { id: 's27', name: 'Mascotas', icon: PawPrint, defaultAmount: '' },
            { id: 's74', name: 'Grooming', icon: PawPrint, defaultAmount: '' },
            { id: 's75', name: 'Comida de Gato', icon: PawPrint, defaultAmount: '' },
            { id: 's76', name: 'Comida de Perro', icon: PawPrint, defaultAmount: '' },
        ]
    },
    {
        title: "Deportes",
        items: [
            { id: 's7', name: 'Gimnasio', icon: Dumbbell, defaultAmount: '' },
            { id: 's52', name: 'Natación', icon: Droplets, defaultAmount: '' },
            { id: 's53', name: 'Pádel', icon: Dumbbell, defaultAmount: '' },
        ]
    },
    {
        title: "Cuidado Personal",
        items: [
            { id: 's54', name: 'Pestañas', icon: Sparkles, defaultAmount: '' },
            { id: 's55', name: 'Uñas', icon: Sparkles, defaultAmount: '' },
            { id: 's56', name: 'Maquillaje', icon: Sparkles, defaultAmount: '' },
            { id: 's57', name: 'Corte de Cabello', icon: Scissors, defaultAmount: '' },
            { id: 's58', name: 'Sauna', icon: Droplets, defaultAmount: '' },
            { id: 's59', name: 'Salón', icon: Scissors, defaultAmount: '' },
        ]
    },
    {
        title: "Ocio",
        items: [
            { id: 's29', name: 'Fast Food', icon: Utensils, defaultAmount: '' },
            { id: 's63', name: 'Ropa', icon: Shirt, defaultAmount: '' },
            { id: 's64', name: 'Zapatos', icon: Shirt, defaultAmount: '' },
            { id: 's73', name: 'Accesorios', icon: Watch, defaultAmount: '' },
            { id: 's65', name: 'Conciertos', icon: Ticket, defaultAmount: '' },
            { id: 's66', name: 'Cine', icon: Film, defaultAmount: '' },
            { id: 's67', name: 'Alcohol', icon: Beer, defaultAmount: '' },
            { id: 's68', name: 'Cigarros', icon: Flame, defaultAmount: '' },
        ]
    }
];

// ──────────────────── ICON RESOLVER ────────────────────
const getCategoryIcon = (name) => {
    const allSug = SUGGESTION_GROUPS.flatMap(g => g.items);
    const sug = allSug.find(s => s.name === name);
    if (sug) return sug.icon;

    const lower = name.toLowerCase();
    if (lower.includes('renta') || lower.includes('casa') || lower.includes('apto')) return Home;
    if (lower.includes('luz') || lower.includes('eegsa') || lower.includes('energuate') || lower.includes('electricidad')) return Zap;
    if (lower.includes('agua') || lower.includes('empagua')) return Droplets;
    if (lower.includes('internet') || lower.includes('tigo') || lower.includes('claro')) return Wifi;
    if (lower.includes('super') || lower.includes('despensa') || lower.includes('walmart') || lower.includes('torre')) return ShoppingCart;
    if (lower.includes('gasolina') || lower.includes('auto') || lower.includes('carro')) return Car;
    if (lower.includes('gym') || lower.includes('gimnasio') || lower.includes('smartfit') || lower.includes('pádel')) return Dumbbell;
    if (lower.includes('pestaña') || lower.includes('uña') || lower.includes('maquillaje')) return Sparkles;
    if (lower.includes('corte') || lower.includes('cabello') || lower.includes('salón') || lower.includes('salon')) return Scissors;
    if (lower.includes('celular') || lower.includes('plan') || lower.includes('telefon')) return Smartphone;
    if (lower.includes('crunchyroll') || lower.includes('anime')) return Gamepad2;
    if (lower.includes('youtube') || lower.includes('netflix') || lower.includes('hbo') || lower.includes('disney')) return Youtube;
    if (lower.includes('spotify') || lower.includes('apple music') || lower.includes('deezer')) return Music;
    if (lower.includes('seguro') || lower.includes('salud') || lower.includes('medico') || lower.includes('dentista') || lower.includes('vida') || lower.includes('muerte')) return HeartPulse;
    if (lower.includes('medicina') || lower.includes('medicamento') || lower.includes('suplemento') || lower.includes('probiótico') || lower.includes('probiotico') || lower.includes('farmacia') || lower.includes('motita')) return Pill;
    if (lower.includes('garita') || lower.includes('basura')) return Shield;
    if (lower.includes('mascota') || lower.includes('perro') || lower.includes('gato') || lower.includes('grooming')) return PawPrint;
    if (lower.includes('delivery') || lower.includes('food') || lower.includes('comida') || lower.includes('alimento') || lower.includes('restaurante')) return Utensils;
    if (lower.includes('contador') || lower.includes('sat') || lower.includes('impuestos')) return ShieldCheck;
    if (lower.includes('ropa') || lower.includes('zapato') || lower.includes('zapatos')) return Shirt;
    if (lower.includes('concierto') || lower.includes('ticket')) return Ticket;
    if (lower.includes('cine') || lower.includes('película') || lower.includes('pelicula')) return Film;
    if (lower.includes('alcohol') || lower.includes('cerveza') || lower.includes('trago') || lower.includes('licor')) return Beer;
    if (lower.includes('cigarro') || lower.includes('fumar') || lower.includes('vape')) return Flame;
    if (lower.includes('accesorio') || lower.includes('reloj') || lower.includes('pulsera') || lower.includes('collar') || lower.includes('lentes') || lower.includes('joyas')) return Watch;
    if (lower.includes('transporte') || lower.includes('bus') || lower.includes('taxi') || lower.includes('transmetro') || lower.includes('uber') || lower.includes('indrive') || lower.includes('yango') || lower.includes('pasaje')) return BusFront;
    if (lower.includes('ocio') || lower.includes('cherry') || lower.includes('diversion') || lower.includes('juegos')) return PartyPopper;
    if (lower.includes('colegio') || lower.includes('universidad') || lower.includes('duolingo')) return GraduationCap;
    if (lower.includes('icloud') || lower.includes('cloud') || lower.includes('google one') || lower.includes('workspace') || lower.includes('hostinger')) return Cloud;
    if (lower.includes('chatgpt') || lower.includes('gemini') || lower.includes('ia')) return Sparkles;
    if (lower.includes('microsoft') || lower.includes('365') || lower.includes('office')) return CreditCard;
    if (lower.includes('uberone') || lower.includes('uber one')) return ShoppingCart;
    if (lower.includes('carwash') || lower.includes('lavado') || lower.includes('diesel')) return Car;
    return CreditCard;
};

// ──────────────────── GROUP CLASSIFIER ────────────────────
const classifyToGroup = (itemName, itemGroup) => {
    if (itemGroup) return itemGroup;
    const iName = itemName.toLowerCase();

    for (const g of SUGGESTION_GROUPS) {
        if (g.items.some(s => s.name.toLowerCase() === iName)) return g.title;
    }

    if (iName.includes("gasolina") || iName.includes("carro") || iName.includes("auto") || iName.includes("vehículo") || iName.includes("vehiculo") || iName.includes("diesel") || iName.includes("carwash") || iName.includes("parqueo") || iName.includes("transporte") || iName.includes("bus") || iName.includes("taxi") || iName.includes("uber") || iName.includes("transmetro") || iName.includes("indrive") || iName.includes("yango") || iName.includes("pasaje")) return "Vehículos";
    if ((iName.includes("renta") || iName.includes("luz") || iName.includes("agua") || iName.includes("garita") || iName.includes("basura") || iName.includes("contador") || iName.includes("delivery") || iName.includes("food") || iName.includes("comida") || iName.includes("alimento") || iName.includes("restaurante") || iName.includes("mercado") || iName.includes("tortillas") || iName.includes("café") || iName.includes("cafe")) && !iName.includes("molino")) return "Vivienda & Servicios";
    if (iName.includes("seguro") || iName.includes("médico") || iName.includes("medico") || iName.includes("salud") || iName.includes("hospital") || iName.includes("igss") || iName.includes("motita") || iName.includes("cherry") || iName.includes("dentista") || iName.includes("vida") || iName.includes("muerte") || iName.includes("medicina") || iName.includes("medicamento") || iName.includes("suplemento") || iName.includes("probiótico") || iName.includes("probiotico") || iName.includes("farmacia")) return "Salud";
    if (iName.includes("netflix") || iName.includes("spotify") || iName.includes("hbo") || iName.includes("disney") || iName.includes("apple music") || iName.includes("youtube") || iName.includes("premium") || iName.includes("amazon") || iName.includes("icloud") || iName.includes("chatgpt") || iName.includes("google ai") || iName.includes("hostinger") || iName.includes("crunchyroll") || iName.includes("microsoft")) return "Suscripciones Digitales";
    if (iName.includes("universidad") || iName.includes("colegio") || iName.includes("escuela") || iName.includes("estudio") || iName.includes("duolingo")) return "Educación";
    if (iName.includes("celular") || iName.includes("plan") || iName.includes("internet") || iName.includes("wifi") || iName.includes("telefon") || iName.includes("roaming")) return "Comunicaciones";
    if (iName.includes("ocio") || iName.includes("diversion") || iName.includes("juego") || iName.includes("cine") || iName.includes("fast food") || iName.includes("pollo") || iName.includes("granjero") || iName.includes("ropa") || iName.includes("zapato") || iName.includes("concierto") || iName.includes("alcohol") || iName.includes("cigarro") || iName.includes("cerveza") || iName.includes("licor") || iName.includes("trago") || iName.includes("vape") || iName.includes("ticket") || iName.includes("película") || iName.includes("pelicula") || iName.includes("fumar") || iName.includes("accesorio") || iName.includes("reloj") || iName.includes("pulsera") || iName.includes("collar") || iName.includes("lentes") || iName.includes("joyas")) return "Ocio";
    if (iName.includes("perro") || iName.includes("gato") || iName.includes("mascota") || iName.includes("grooming")) return "Mascotas";
    if (iName.includes("super") || iName.includes("uber one") || iName.includes("price") || iName.includes("smart") || iName.includes("despensa") || iName.includes("torre") || iName.includes("walmart") || iName.includes("suma")) return "Retail";
    if (iName.includes("gym") || iName.includes("gimnasio") || iName.includes("natación") || iName.includes("natacion") || iName.includes("padel") || iName.includes("pádel")) return "Deportes";
    if (iName.includes("pestaña") || iName.includes("uña") || iName.includes("maquillaje") || iName.includes("corte") || iName.includes("cabello") || iName.includes("sauna") || iName.includes("salón") || iName.includes("salon")) return "Cuidado Personal";
    return "Otros";
};

// ──────────────────── MONTH NAME HELPER ────────────────────
const monthName = new Date().toLocaleString('es-GT', { month: 'long' });

// ======================== COMPONENT ========================
export default function Budgeting({ userData, user }) {
    const financesInfo = userData?.finances || {};
    const budget = userData?.budget || { categories: [] };
    const income = financesInfo.income || 0;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [newCatAmount, setNewCatAmount] = useState('');
    const [isUsd, setIsUsd] = useState(false);
    const [isFixed, setIsFixed] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [loading, setLoading] = useState(false);
    const [exchangeRate, setExchangeRate] = useState(7.75);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [expandedSuggestionGroups, setExpandedSuggestionGroups] = useState({});
    const [sortType, setSortType] = useState('amount-desc');
    const [showUpcoming, setShowUpcoming] = useState(false);

    // ── Fetch exchange rate ──
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

    const categories = budget?.categories || [];

    // ── Current month helpers ──
    const now = new Date();
    const currentMonthStr = now.toISOString().substring(0, 7);

    // Global Metrics from shared logic
    const { TI, TP, TDM, CFD } = useMemo(() => {
        return calculateCashflowMetrics(userData, currentMonthStr, exchangeRate);
    }, [userData, currentMonthStr, exchangeRate]);

    // DAM = Disponible para Asignar Mensualmente
    const rawDAM = CFD;
    const DAM = Math.max(0, rawDAM);

    const TMP = TP;

    // Capital deviation: sum of all "Transferencia (Ingresos)" transactions this month
    const capitalDeviation = useMemo(() => {
        const accs = userData?.savings?.accounts || [];
        let total = 0;
        accs.forEach(acc => {
            (acc.history || []).forEach(tx => {
                if (tx.date && tx.date.startsWith(currentMonthStr) && tx.amount > 0 && tx.source && tx.source.includes('Transferencia')) {
                    total += (acc.currency === 'USD' ? tx.amount * exchangeRate : tx.amount);
                }
            });
        });
        return total;
    }, [userData, currentMonthStr, exchangeRate]);

    const fixedTotal = useMemo(() => categories.filter(c => c.isFixed).reduce((a, c) => a + (parseFloat(c.total) || 0), 0), [categories]);
    const variableTotal = TMP - fixedTotal;
    const fixedPct = TMP > 0 ? (fixedTotal / TMP) * 100 : 0;
    const variablePct = TMP > 0 ? (variableTotal / TMP) * 100 : 0;



    // ── Group categories for display ──
    const grouped = useMemo(() => {
        const g = {};
        categories.forEach(item => {
            const groupTitle = classifyToGroup(item.name, item.group);
            if (!g[groupTitle]) g[groupTitle] = { items: [], total: 0 };
            g[groupTitle].items.push(item);
            g[groupTitle].total += parseFloat(item.total) || 0;
        });
        return g;
    }, [categories]);

    const sortedGroupEntries = useMemo(() => {
        const entries = Object.entries(grouped);
        return entries.sort((a, b) => {
            if (sortType === 'amount-asc') return a[1].total - b[1].total;
            if (sortType === 'amount-desc') return b[1].total - a[1].total;
            if (sortType === 'name') return a[0].localeCompare(b[0]);
            return 0;
        });
    }, [grouped, sortType]);

    const toggleGroup = (title) => setExpandedGroups(prev => ({ ...prev, [title]: !prev[title] }));

    // ── Handlers: Monthly Budget ──
    const handleSelectSuggestion = (sug, groupTitle) => {
        setNewCatName(sug.name);
        setNewCatAmount(sug.defaultAmount);
        setIsUsd(!!sug.isUsd);
        setIsFixed(!!sug.isFixed);
        setSelectedGroup(groupTitle || '');
    };

    const handleAddCategory = async () => {
        if (!newCatName || !newCatAmount) return;
        setLoading(true);
        try {
            const amountVal = parseFloat(newCatAmount);
            const finalTotalGTQ = isUsd ? amountVal * exchangeRate : amountVal;
            const userRef = doc(db, 'users', user.uid);
            const newCategory = {
                id: Date.now().toString(), name: newCatName, total: finalTotalGTQ,
                originalUsd: isUsd ? amountVal : null, spent: 0, isFixed,
                ...(selectedGroup ? { group: selectedGroup } : {}), color: 'bg-purple-500'
            };
            await updateDoc(userRef, { 'budget.categories': arrayUnion(newCategory) });
            setNewCatName(''); setNewCatAmount(''); setIsUsd(false); setIsFixed(false); setSelectedGroup('');
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error adding category:", error);
            alert("Error al agregar. Verifica conexión.");
        } finally { setLoading(false); }
    };

    const handleDeleteCategory = async (category) => {
        if (!window.confirm(`¿Eliminar ${category.name}?`)) return;
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { 'budget.categories': arrayRemove(category) });
        } catch (error) { console.error("Error deleting:", error); }
    };





    // ======================== RENDER ========================
    return (
        <div className="space-y-8 pb-24">

            {/* ═══════════════════ 1. BANNER PRINCIPAL ═══════════════════ */}
            <div className="glass-card p-6 md:p-10 relative overflow-hidden border-purple-500/20 shadow-[0_0_50px_rgba(168,85,247,0.15)]">
                <div className="absolute top-0 right-0 w-72 h-72 bg-purple-500/20 rounded-full blur-[100px] translate-x-20 -translate-y-20 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-56 h-56 bg-purple-400/10 rounded-full blur-[80px] -translate-x-20 translate-y-20 pointer-events-none" />

                {/* Rich Insights — Desktop */}
                <div className="hidden lg:block absolute top-8 right-8 w-72 z-20">
                    <RichInsightsCard userData={{...userData, cfdCalc: CFD}} section="budget" />
                </div>

                <div className="relative z-10">
                    {/* Hero: Total Presupuestado */}
                    <div className="mb-6">
                        <div className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-purple-400 mb-2">
                            Total Presupuestado · {monthName}
                        </div>
                        <div className="text-4xl md:text-5xl font-black tracking-tighter text-purple-400">
                            Q{TP.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>

                        {/* Composition bar with percentages */}
                        {TMP > 0 && (
                            <>
                                <div className="mt-4 h-2.5 bg-black/40 rounded-full overflow-hidden w-full max-w-sm flex">
                                    {fixedTotal > 0 && (
                                        <div className="h-full bg-purple-500 transition-all duration-700" style={{ width: `${fixedPct}%` }} />
                                    )}
                                    {variableTotal > 0 && (
                                        <div className="h-full bg-fuchsia-400 transition-all duration-700" style={{ width: `${variablePct}%` }} />
                                    )}
                                </div>
                                <div className="mt-1.5 flex items-center gap-4 text-[10px]">
                                    <span className="flex items-center gap-1.5 font-bold text-aura-muted/60"><span className="w-2 h-2 rounded-full bg-purple-500" /> Fijo {fixedPct.toFixed(0)}%</span>
                                    <span className="flex items-center gap-1.5 font-bold text-aura-muted/60"><span className="w-2 h-2 rounded-full bg-fuchsia-400" /> Variable {variablePct.toFixed(0)}%</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Secondary Metrics */}
                    <div className="max-w-md grid grid-cols-2 gap-3 mt-6">
                        <div className="flex flex-col p-3 rounded-xl border transition-all bg-purple-500/5 border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.05)]">
                            <div className="text-[10px] uppercase tracking-widest font-black mb-1 text-purple-400">
                                Desviación a Capital
                            </div>
                            <div className="text-lg font-black text-purple-400">
                                Q{capitalDeviation.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            </div>

            {/* Action Bar: New Budget Category */}
            <button
                onClick={() => setIsModalOpen(true)}
                className="w-full glass-card border-dashed border-purple-500/30 p-5 flex items-center justify-center gap-3 hover:bg-purple-500/5 hover:border-purple-500/50 transition-all group"
            >
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus size={20} className="text-purple-400" />
                </div>
                <span className="text-sm font-bold text-purple-400 uppercase tracking-widest">Añadir Sección</span>
            </button>

            {/* ═══════════════ 2. CATEGORÍAS PRESUPUESTADAS ═══════════════ */}
            <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold text-purple-400 uppercase text-xs tracking-widest">Presupuesto Mensual</h3>
                        <span className="text-[9px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-bold border border-purple-500/20">
                            {categories.length} {categories.length === 1 ? 'ítem' : 'ítems'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ArrowUpDown size={12} className="text-aura-muted" />
                        <select
                            value={sortType}
                            onChange={(e) => setSortType(e.target.value)}
                            className="bg-transparent text-[10px] font-bold text-aura-muted uppercase tracking-tighter outline-none cursor-pointer hover:text-white transition-colors"
                        >
                            <option value="amount-asc" className="bg-[#0a0a0c]">Menor a Mayor</option>
                            <option value="amount-desc" className="bg-[#0a0a0c]">Mayor a Menor</option>
                            <option value="name" className="bg-[#0a0a0c]">A-Z</option>
                        </select>
                    </div>
                </div>

                <div className="grid gap-3">
                    {sortedGroupEntries.length === 0 ? (
                        <div className="text-center py-20 glass-card border-dashed border-white/10 text-aura-muted">
                            <AlertCircle className="mx-auto mb-4 opacity-20" size={48} />
                            <p>No has añadido ítems aún.</p>
                            <p className="text-xs mt-2">Usa el botón inferior para empezar a asignar tu presupuesto.</p>
                        </div>
                    ) : (
                        sortedGroupEntries.map(([title, group]) => {
                            const isExpanded = expandedGroups[title] === true;
                            const groupPct = TP > 0 ? ((group.total / TP) * 100).toFixed(1) : 0;
                            return (
                                <div key={title} className="space-y-2">
                                    <button
                                        onClick={() => toggleGroup(title)}
                                        className="w-full glass-card p-4 flex items-center justify-between hover:bg-white/5 transition-all border border-purple-500/10"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="text-purple-400">
                                                {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                            </div>
                                            <div className="text-left">
                                                <div className="font-bold text-white text-sm uppercase tracking-wider">{title}</div>
                                                <div className="text-[10px] text-aura-muted">
                                                    {group.items.length} {group.items.length === 1 ? 'ítem' : 'ítems'} · {groupPct}% del presupuesto
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-black text-purple-400">
                                                Q{group.total.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="grid gap-2 pl-4 animate-in slide-in-from-top-2 duration-200">
                                            {group.items.map(cat => {
                                                const IconComponent = getCategoryIcon(cat.name);
                                                return (
                                                    <div key={cat.id} className="glass-card p-4 group hover:bg-white/5 transition-all relative border border-white/5 shadow-sm">
                                                        <button
                                                            onClick={() => handleDeleteCategory(cat)}
                                                            className="absolute top-3 right-3 p-1.5 text-aura-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-400/10"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                                                                    <IconComponent size={16} />
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-sm text-white">{cat.name}</div>
                                                                    {cat.isFixed && (
                                                                        <span className="text-[8px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-full border border-purple-500/20">FIJO</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-xs font-black text-white">Q{(parseFloat(cat.total) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                                {cat.originalUsd && (
                                                                    <div className="text-[9px] text-aura-muted opacity-80">
                                                                        (${cat.originalUsd} USD)
                                                                    </div>
                                                                )}
                                                            </div>
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



            {/* ═══════════════ MODAL ═══════════════ */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="glass-card w-full max-w-lg p-6 md:p-8 relative border-purple-500/20 shadow-2xl animate-in zoom-in-95 duration-200 hide-scrollbar overflow-y-auto max-h-[90vh]">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-aura-muted hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <h3 className="text-2xl font-bold text-white mb-1">Añadir Categoría</h3>
                        <p className="text-xs text-aura-muted mb-6">Selecciona una sugerencia o crea una sección personalizada.</p>

                        {/* Suggestions */}
                        <div className="mb-6 space-y-2">
                            <label className="text-[10px] text-purple-400 font-black tracking-widest uppercase block">
                                Sugerencias Rápidas 🇬🇹
                            </label>
                            <div className="space-y-1.5 max-h-[35vh] overflow-y-auto hide-scrollbar">
                                {SUGGESTION_GROUPS.map((group, idx) => {
                                    const isOpen = expandedSuggestionGroups[group.title];
                                    return (
                                        <div key={idx} className="bg-black/20 rounded-xl border border-white/5 overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => setExpandedSuggestionGroups(prev => ({ ...prev, [group.title]: !prev[group.title] }))}
                                                className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-all"
                                            >
                                                <h4 className="text-[10px] uppercase font-black tracking-widest text-aura-muted">{group.title}</h4>
                                                <div className="text-aura-muted">
                                                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </div>
                                            </button>
                                            {isOpen && (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-3 pb-3 animate-in slide-in-from-top-2 duration-200">
                                                    {group.items.map(sug => {
                                                        const SugIcon = sug.icon;
                                                        return (
                                                            <button
                                                                key={sug.id}
                                                                type="button"
                                                                onClick={() => handleSelectSuggestion(sug, group.title)}
                                                                className="bg-white/5 hover:bg-purple-500/10 border border-white/5 hover:border-purple-500/20 rounded-lg p-2 flex items-center gap-2 text-left transition-all active:scale-95"
                                                            >
                                                                <SugIcon size={14} className="text-purple-400 shrink-0 opacity-80" />
                                                                <span className="text-[9px] sm:text-[10px] font-semibold text-white/90 truncate leading-tight">{sug.name}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Manual Form */}
                        <div className="space-y-5 border-t border-white/5 pt-5">
                            <div>
                                <label className="text-xs text-aura-muted font-bold uppercase tracking-wider mb-2 block">Nombre</label>
                                <input
                                    type="text"
                                    value={newCatName}
                                    onChange={(e) => setNewCatName(e.target.value)}
                                    placeholder="Ej. Alimentación, Renta, etc."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-base"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs text-aura-muted font-bold uppercase tracking-wider block">Monto Mensual</label>
                                    <label className="flex items-center gap-2 cursor-pointer bg-white/5 px-2 py-1 rounded-md hover:bg-white/10 transition-colors">
                                        <input type="checkbox" checked={isUsd} onChange={(e) => setIsUsd(e.target.checked)} className="w-3 h-3 rounded text-purple-500" />
                                        <span className="text-xs font-bold text-white">USD $</span>
                                    </label>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-bold">
                                        {isUsd ? '$' : 'Q'}
                                    </span>
                                    <input
                                        type="number"
                                        value={newCatAmount}
                                        onChange={(e) => setNewCatAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xl font-black tracking-tighter"
                                    />
                                </div>
                                {isUsd && newCatAmount && !isNaN(newCatAmount) && (
                                    <div className="mt-2 text-xs text-purple-400 flex items-center gap-1 bg-purple-500/10 p-2 rounded-lg border border-purple-500/20">
                                        <Info size={14} className="shrink-0" />
                                        Equivale a aprox. <b>Q{(parseFloat(newCatAmount) * exchangeRate).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> (T.C. {exchangeRate})
                                    </div>
                                )}
                            </div>

                            {/* Fixed toggle */}
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <label className="flex items-center justify-between cursor-pointer group">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg transition-colors ${isFixed ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-aura-muted'}`}>
                                            <Shield size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">¿Monto fijo mensual?</div>
                                            <div className="text-[10px] text-aura-muted">Se considera "Gasto Fijo" en los reportes.</div>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-5 rounded-full relative transition-colors ${isFixed ? 'bg-purple-500' : 'bg-white/10'}`}>
                                        <input type="checkbox" checked={isFixed} onChange={(e) => setIsFixed(e.target.checked)} className="sr-only" />
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isFixed ? 'left-6' : 'left-1'}`} />
                                    </div>
                                </label>
                            </div>

                            <button
                                onClick={handleAddCategory}
                                disabled={loading || !newCatName || !newCatAmount}
                                className="w-full bg-purple-500 text-black font-black py-4 rounded-xl hover:bg-purple-400 transition-colors mt-2 shadow-[0_0_20px_rgba(168,85,247,0.3)] disabled:opacity-50 disabled:shadow-none"
                            >
                                {loading ? 'Agregando...' : 'Añadir al Presupuesto Mensual'}
                            </button>
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
}
