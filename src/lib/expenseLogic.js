/**
 * Shared logic for expense categorization and metric calculations.
 * Used by both Expenses.jsx and Dashboard.jsx to ensure "mirror" consistency.
 */

export const OLD_TO_NEW_CATEGORY_MAP = {
    // Vivienda
    'Renta': 'Vivienda & Servicios',
    'Luz (EEGSA)': 'Vivienda & Servicios',
    'Agua (Empagua)': 'Vivienda & Servicios',
    'Alimentación': 'Vivienda & Servicios',
    'Delivery': 'Vivienda & Servicios',
    'Restaurante': 'Vivienda & Servicios',
    'Mercado': 'Vivienda & Servicios',
    'Garita / Seguridad': 'Vivienda & Servicios',
    'Vivienda & Servicios': 'Vivienda & Servicios',

    // Comunicaciones
    'Internet': 'Comunicaciones',
    'Internet Residencial': 'Comunicaciones',
    'Plan Celular': 'Comunicaciones',
    'Comunicaciones': 'Comunicaciones',

    // Suscripciones
    'Netflix': 'Suscripciones Digitales',
    'Spotify': 'Suscripciones Digitales',
    'Apple Music': 'Suscripciones Digitales',
    'Disney+': 'Suscripciones Digitales',
    'Crunchyroll': 'Suscripciones Digitales',
    'HBO': 'Suscripciones Digitales',
    'HBO Max': 'Suscripciones Digitales',
    'ChatGPT': 'Suscripciones Digitales',
    'Microsoft 365': 'Suscripciones Digitales',
    'Google One': 'Suscripciones Digitales',
    'Google Workspace': 'Suscripciones Digitales',
    'iCloud+': 'Suscripciones Digitales',
    'Hostinger n8n': 'Suscripciones Digitales',
    'Duolingo': 'Suscripciones Digitales',
    'Uber One': 'Suscripciones Digitales',
    'Gemini Uber': 'Suscripciones Digitales',
    'Gemini Disney+': 'Suscripciones Digitales',
    'Gemini Hostinger': 'Suscripciones Digitales',
    'Gemini': 'Suscripciones Digitales',
    'UberOne': 'Suscripciones Digitales',
    'Hostinger': 'Suscripciones Digitales',
    'Suscripciones Digitales': 'Suscripciones Digitales',

    // Vehículos
    'Gasolina': 'Vehículos',
    'Diesel': 'Vehículos',
    'CarWash': 'Vehículos',
    'Transporte Público': 'Vehículos',
    'Seguro de Auto': 'Vehículos',
    'Vehículos': 'Vehículos',

    // Salud
    'Seguro Médico': 'Salud',
    'Dentista': 'Salud',
    'Medicamentos': 'Salud',
    'Suplementos': 'Salud',
    'Probióticos': 'Salud',
    'Seguro de Vida': 'Salud',
    'Seguro de Muerte': 'Salud',
    'Seguros y Salud': 'Salud',
    'Motita': 'Salud',
    'Salud': 'Salud',

    // Educación
    'Colegio / Universidad': 'Educación',
    'Educación': 'Educación',

    // Retail
    'Supermercado': 'Retail',
    'La Despensa': 'Retail',
    'La Torre': 'Retail',
    'Walmart': 'Retail',
    'Mi SuperFresh': 'Retail',
    'Mi Super del Barrio': 'Retail',
    'Suma': 'Retail',
    'PriceSmart': 'Retail',
    'Retail': 'Retail',

    // Mascotas
    'Mascotas': 'Mascotas',
    'Grooming': 'Mascotas',
    'Comida de Gato': 'Mascotas',
    'Comida de Perro': 'Mascotas',

    // Deportes
    'Gimnasio': 'Deportes',
    'Natación': 'Deportes',
    'Pádel': 'Deportes',
    'Deportes': 'Deportes',

    // Cuidado Personal
    'Pestañas': 'Cuidado Personal',
    'Uñas': 'Cuidado Personal',
    'Maquillaje': 'Cuidado Personal',
    'Corte de Cabello': 'Cuidado Personal',
    'Sauna': 'Cuidado Personal',
    'Salón': 'Cuidado Personal',
    'Cuidado Personal': 'Cuidado Personal',

    // Ocio
    'Ocio / Entretenimiento': 'Ocio',
    'Fast Food': 'Ocio',
    'Conciertos': 'Ocio',
    'Cine': 'Ocio',
    'Alcohol': 'Ocio',
    'Cigarros': 'Ocio',
    'Ropa': 'Ocio',
    'Zapatos': 'Ocio',
    'Accesorios': 'Ocio',
    'Uber Eats': 'Ocio',
    'Ocio': 'Ocio',

    // Otros
    'Deuda / Cuota': 'Otros',
    'Retiro de Efectivo': 'Otros',
    'Otros': 'Otros'
};

const CATEGORY_KEYWORDS = {
    'Vivienda & Servicios': ['renta', 'alquiler', 'arrendamiento', 'luz', 'eegsa', 'energuate', 'electricidad', 'agua', 'empagua', 'alimentación', 'alimentacion', 'delivery', 'pedidos', 'rappi', 'domicilio', 'restaurante', 'almuerzo', 'cena', 'desayuno', 'comida', 'café', 'cafe', 'tortillas', 'mercado', 'placita', 'verdura', 'mercado central', 'garita', 'seguridad', 'viña', 'basura', 'contador'],
    'Comunicaciones': ['internet', 'tigo', 'claro', 'wifi', 'fibra', 'celular', 'plan', 'teléfono', 'telefono', 'saldo', 'comunicaciones', 'residencial', 'roaming'],
    'Suscripciones Digitales': ['netflix', 'spotify', 'apple music', 'hbo', 'hbo max', 'disney', 'disney+', 'crunchyroll', 'anime', 'chatgpt', 'openai', 'microsoft 365', 'office', 'microsoft', 'google one', 'google drive', 'google workspace', 'workspace', 'icloud', 'icloud+', 'hostinger', 'hosting', 'duolingo', 'uberone', 'uber one', 'suscripción', 'suscripcion'],
    'Vehículos': ['gasolina', 'gas', 'puma', 'texaco', 'shell', 'combustible', 'diesel', 'carwash', 'lavado', 'car wash', 'transporte', 'bus', 'transmetro', 'urbano', 'taxi', 'pasaje', 'uber', 'indrive', 'yango', 'carro', 'vehículo', 'vehiculo', 'parqueo', 'parking', 'estacionamiento', 'seguro de auto'],
    'Salud': ['seguro', 'médico', 'medico', 'hospital', 'clínica', 'clinica', 'dentista', 'dientes', 'odontólogo', 'odontologo', 'medicamentos', 'medicamento', 'medicina', 'medicinas', 'farmacia', 'suplementos', 'suplemento', 'proteína', 'proteina', 'vitaminas', 'creatina', 'probióticos', 'probioticos', 'probiótico', 'probiotico', 'seguro de vida', 'vida', 'seguro de muerte', 'muerte', 'funeraria', 'igss', 'salud', 'motita'],
    'Educación': ['colegio', 'universidad', 'escuela', 'estudio', 'matrícula', 'matricula', 'educación', 'educacion'],
    'Retail': ['super', 'hipermás', 'colonia', 'compra', 'supermercado', 'despensa', 'despensa familiar', 'torre', 'la torre', 'walmart', 'superfresh', 'super fresh', 'fresh', 'super del barrio', 'barrio', 'suma', 'super suma', 'pricesmart', 'price smart', 'retail'],
    'Mascotas': ['mascota', 'veterinaria', 'veterinario', 'grooming', 'estética canina', 'peluquería canina', 'comida de gato', 'concentrado gato', 'gatarina', 'arena', 'whiskas', 'purina gato', 'comida de perro', 'concentrado perro', 'perrarina', 'dog chow', 'pedigree', 'purina perro'],
    'Deportes': ['gym', 'gimnasio', 'smartfit', 'crossfit', 'ejercicio', 'natación', 'natacion', 'piscina', 'nadar', 'pádel', 'padel', 'cancha padel', 'deporte', 'deportes'],
    'Cuidado Personal': ['pestañas', 'pestaña', 'uñas', 'uña', 'acrílico', 'acrilico', 'esmalte', 'maquillaje', 'makeup', 'corte', 'cabello', 'pelo', 'barbería', 'barberia', 'barbero', 'sauna', 'spa', 'salón', 'salon', 'tinte', 'keratina', 'cuidado personal'],
    'Ocio': ['ocio', 'bar', 'fiesta', 'diversion', 'diversión', 'fast food', 'hamburguesa', 'pizza', 'mcdonalds', 'pollo campero', 'campero', 'pollo', 'granjero', 'pollería', 'snack', 'snacks', 'uber eats', 'concierto', 'evento', 'ticket', 'entrada', 'cine', 'película', 'pelicula', 'alcohol', 'cerveza', 'licor', 'trago', 'bebida', 'vino', 'cigarro', 'fumar', 'vape', 'tabaco', 'ropa', 'camisa', 'pantalón', 'pantalon', 'vestido', 'zara', 'pull', 'zapatos', 'tenis', 'calzado', 'sneakers', 'accesorio', 'accesorios', 'reloj', 'pulsera', 'collar', 'lentes', 'joyas', 'relojes'],
    'Otros': ['cuota', 'deuda', 'préstamo', 'prestamo', 'bac', 'bi ', 'banrural', 'bam', 'g&t', 'interbanco', 'pago banco', 'abono', 'tarjeta', 'crédito', 'credito', 'retiro', 'efectivo', 'cash', 'molino']
};

export const getSubCategory = (itemOrName) => {
    const name = typeof itemOrName === 'string' ? itemOrName : itemOrName?.name;
    const group = typeof itemOrName === 'object' ? itemOrName?.group : null;
    if (group) return group;
    if (OLD_TO_NEW_CATEGORY_MAP[name]) return OLD_TO_NEW_CATEGORY_MAP[name];
    const lower = (name || '').toLowerCase();
    
    // Exact overrides
    if (lower.includes('molino')) return 'Otros';
    if (lower.includes('parqueo') || lower.includes('parking') || lower.includes('estacionamiento')) return 'Vehículos';
    if (lower.includes('pañal') || lower.includes('juguete')) return 'Otros';

    for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(kw => lower.includes(kw))) return catName;
    }
    return 'Otros';
};

export const calculateExpensesMetrics = (expensesRaw, budgetCategories, currentMonth) => {
    const thisMonthExpenses = expensesRaw.filter(e => e.date?.startsWith(currentMonth));
    const fixed = budgetCategories.filter(c => c.isFixed === true);
    const variable = budgetCategories.filter(c => c.isFixed !== true);

    // 1. GFP -> Gastos Fijos Pendientes
    const isActuallyFixed = (e) => Boolean(e.isFixed);
    const isPaidLocal = (catName) => 
        thisMonthExpenses.some(e => (e.category === catName || e.description === catName) && isActuallyFixed(e));
    
    const ptFijo = fixed.reduce((s, c) => s + (parseFloat(c.total) || 0), 0);
    const totalPaidFixed = fixed.filter(c => isPaidLocal(c.name)).reduce((s, c) => s + (parseFloat(c.total) || 0), 0);
    const gfp = Math.max(0, ptFijo - totalPaidFixed);

    // 2. GVP -> Gastos Variables Pendientes
    const spentByCat = {};
    thisMonthExpenses.filter(e => !isActuallyFixed(e)).forEach(e => {
        const superCat = getSubCategory(e.category);
        spentByCat[superCat] = (spentByCat[superCat] || 0) + (parseFloat(e.amount) || 0);
    });

    const varGroups = variable.reduce((acc, cat) => {
        const superCat = getSubCategory(cat);
        if (!acc[superCat]) acc[superCat] = [];
        acc[superCat].push(cat);
        return acc;
    }, {});

    let gvp = 0;
    Object.keys(varGroups).forEach(name => {
        const limit = varGroups[name].reduce((s, c) => s + (parseFloat(c.total) || 0), 0);
        const spent = spentByCat[name] || 0;
        if (spent < limit) gvp += (limit - spent);
    });

    return {
        TG: thisMonthExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
        TGP: gfp + gvp,
        GFP: gfp,
        GVP: gvp
    };
};

/**
 * Shared logic for Cashflow (CFD) calculation to ensure consistency.
 * TI (Total Income)
 * TP (Total Presupuestado)
 * TDM (Total Deuda Mes) - Excludes debts funded by Capital
 * CFD = TI - TP - TDM - savingsGoal
 *
 * @param {Object} userData - The full user document from Firestore.
 * @param {string} currentMonth - Current month string (YYYY-MM).
 * @param {number|null} exchangeRate - Optional live USD→GTQ rate. When provided,
 *   TI is calculated in real-time from fixedIncomes/rawIncome (matching Income.jsx).
 *   When omitted, falls back to the stored finances.income value.
 */
export const calculateCashflowMetrics = (userData, currentMonth, exchangeRate = null) => {
    const finances = userData?.finances || {};
    const budget = userData?.budget?.categories || [];
    const debts = userData?.debts || [];

    // TI -> Total Ingreso
    let TI;
    if (exchangeRate !== null) {
        // Live calculation — mirrors Income.jsx's migrateToFixedIncomes + persist logic
        const fixedIncomes = finances.fixedIncomes || [];
        const variableIncomes = finances.variableIncomes || [];
        let TF = 0;

        if (fixedIncomes.length > 0) {
            fixedIncomes.forEach(inc => {
                if (inc.total != null) {
                    TF += parseFloat(inc.total) || 0;
                } else {
                    const raw = parseFloat(inc.amount) || 0;
                    const gtq = inc.isUsd ? raw * exchangeRate : raw;
                    const isr = inc.isrEnabled ? gtq * 0.05 : 0;
                    const iva = inc.ivaEnabled ? gtq * (inc.ivaRate || 0.05) : 0;
                    TF += (gtq - isr - iva);
                }
            });
        } else {
            // Fallback: fixedIncomes not persisted yet — calculate from rawIncome
            const rawVal = parseFloat(finances.rawIncome) || 0;
            if (rawVal > 0) {
                const isUsd = finances.isUsd || false;
                const gtq = isUsd ? rawVal * exchangeRate : rawVal;
                const isr = finances.isrEnabled ? gtq * 0.05 : 0;
                const iva = finances.ivaEnabled ? gtq * (finances.ivaRate || 0.05) : 0;
                TF = gtq - isr - iva;
            }
        }

        const TV = variableIncomes.reduce((acc, v) => acc + (parseFloat(v.amount) || 0), 0);
        TI = TF + TV;
    } else {
        // Legacy fallback — use stored value from Firestore
        TI = finances.income || 0;
    }
    
    // TP -> Total Presupuestado
    const TP = budget.reduce((acc, cat) => acc + (parseFloat(cat.total) || 0), 0);
    
    // Savings Goal
    const savingsGoal = finances.savingsGoal || 0;
    
    // TDM -> Total Deuda Mensual (Solo los que se pagan con Cashflow)
    const TDM = debts.reduce((total, entity) => {
        return total + (entity.debts || []).reduce((sum, debt) => {
            const isFutureDebt = debt.startMonth && debt.startMonth > currentMonth;
            if (debt.isActive && !isFutureDebt && debt.fundingSource !== 'Capital') {
                if (debt.isSinglePayment) {
                    return (debt.dueDate && debt.dueDate.startsWith(currentMonth)) 
                        ? sum + (parseFloat(debt.amount) || 0) 
                        : sum;
                }
                return sum + (parseFloat(debt.monthlyPayment) || 0);
            }
            return sum;
        }, 0);
    }, 0);

    const CFD = TI - TP - TDM - savingsGoal;
    
    return { TI, TP, TDM, CFD, savingsGoal };
};
