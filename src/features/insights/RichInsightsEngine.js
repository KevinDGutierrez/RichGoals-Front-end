export const getRichInsights = (userData, section = 'dashboard') => {
    if (!userData) return [];

    const { finances = {}, budget = {}, nickname = 'Usuario' } = userData;
    const { income = 0, currentBalance = 0, totalDebt = 0 } = finances;
    const categories = budget?.categories || [];
    
    const insights = [];
    const add = (type, message) => insights.push({ type, message });

    // --- Core Metrics ---
    const totalSpent = categories.reduce((acc, cat) => acc + (cat.spent || 0), 0);
    const totalBudgeted = categories.reduce((acc, cat) => acc + (cat.total || 0), 0);
    const debtRatio = income > 0 ? (totalDebt / income) : 0;
    const savingsRatio = income > 0 ? (currentBalance / income) : 0;

    // --- DASHBOARD: The "Big Picture" ---
    if (section === 'dashboard') {
        const welcome = `¡Hola **${nickname}**! Construir tu patrimonio es una carrera de resistencia, no de velocidad.`;
        add('info', `${welcome} He analizado todo tu ecosistema financiero para buscar atajos viables.`);

        if (debtRatio > 0.45) {
            add('danger', 'Ojo, tus deudas están **asfixiando** tu futuro. Necesitamos un plan de choque para liberar oxigeno financiero.');
        } else if (savingsRatio < 0.1 && income > 0) {
            add('warning', 'Vives al día. Un pequeño **fondo de paz** te daría la libertad de elegir, no solo de sobrevivir.');
        } else if (savingsRatio > 0.5) {
            add('success', 'Tu reserva es **impresionante**. Es momento de pensar en cómo ese capital puede empezar a trabajar por ti.');
        }

        if (totalSpent > totalBudgeted && totalBudgeted > 0) {
            add('warning', 'Tus gastos reales están **perforando** tu presupuesto. Revisa dónde se está filtrando el dinero.');
        }
    } 
    
    // --- BUDGET: Planning & Reality ---
    else if (section === 'budget') {
        if (totalBudgeted > income) {
            add('danger', 'Tu plan actual es **insostenible**: quieres gastar más de lo que ganas. Ajustemos la realidad antes que la deuda lo haga.');
        } else if (totalBudgeted === 0) {
            add('info', 'Un presupuesto sin asignar es un barco sin timón. **Asigna cada quetzal** a un propósito hoy mismo.');
        } else {
            add('success', 'Tienes un plan **claro y viable**. Apegarte a él es la forma más rápida de alcanzar tus metas de capital.');
        }

        add('info', 'El secreto está en la constancia. Si automatizas un **15% de ahorro** en tu plan actual, tu "yo" del futuro te lo agradecerá enormemente.');
    }

    // --- DEBT: Freedom Level ---
    else if (section === 'debt') {
        if (totalDebt > 0) {
            add('warning', `Tienes deudas por **Q${totalDebt.toLocaleString()}**. Los intereses son el **freno de mano** de tu riqueza. Ataca la de mayor interés primero.`);
            
            if (debtRatio > 0.3) {
                add('danger', 'Tu nivel de deuda es **crítico**. No asumas nuevos compromisos hasta que bajemos este indicador al 20%.');
            }
        } else {
            add('success', '¡Libertad total! Sin deudas eres el **dueño absoluto** de tu tiempo y tu dinero. Úsalo con sabiduría.');
        }
    }

    // --- EXPENSES: Behavior ---
    else if (section === 'expenses') {
        const topCat = [...categories].sort((a,b) => (b.spent||0) - (a.spent||0))[0];
        if (topCat && topCat.spent > 0) {
            add('info', `Tu fuga principal es **${topCat.name}**. ¿Es una inversión en tu bienestar o solo un hábito automático?`);
        }

        if (totalSpent > income * 0.9) {
            add('danger', 'Estás en la **zona roja**. Gastar el 90% de lo que ganas te deja vulnerable a cualquier imprevisto.');
        } else if (totalSpent < income * 0.6 && totalSpent > 0) {
            add('success', 'Gastar menos del 60% de tus ingresos es **maestría financiera**. Estás comprando tu libertad futura.');
        }
    }

    // --- CAPITAL: Security & Growth ---
    else if (section === 'capital') {
        const monthsReserva = income > 0 ? (currentBalance / (totalSpent || income / 2)).toFixed(1) : 0;
        
        if (monthsReserva < 3) {
            add('warning', `Solo tienes **${monthsReserva} meses** de reserva visible. Todo patrimonio base necesita al menos 6 para dormir tranquilo y absorber golpes.`);
        } else if (monthsReserva > 12) {
            add('success', 'Tienes un **escudo financiero** de más de un año. Es una posición de poder, úsala para invertir con calma.');
        } else {
            add('info', `Tu capital te da **${monthsReserva} meses** de paz. Sigue así hasta llegar a tu meta ideal.`);
        }
    }

    // Limit to 4 for dashboard, 3 for others
    const limitCount = section === 'dashboard' ? 4 : 3;
    return insights.slice(0, limitCount);
};
