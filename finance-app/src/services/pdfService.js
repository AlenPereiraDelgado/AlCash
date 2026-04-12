import { jsPDF } from 'jspdf';

/**
 * Genera un reporte PDF profesional con los datos anuales.
 */
export const generateYearlyPDF = (personalTransactions, jointTransactions, year, activeColor) => {
    const doc = new jsPDF();
    const primaryColor = activeColor.hex || '#2563EB';

    const drawAlCashLogo = (x, y, size) => {
        doc.setFillColor(40, 40, 40);
        doc.circle(x, y, size / 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(size * 0.6);
        doc.setFont('helvetica', 'bold');
        doc.text('A', x, y + size * 0.2, { align: 'center' });

        doc.setDrawColor(40, 40, 40);
        doc.setLineWidth(0.2);
        doc.circle(x, y, size * 0.6, 'S');
    };

    const addHeader = (title, subtitle) => {
        doc.setFillColor(30, 30, 30);
        doc.rect(0, 0, 210, 45, 'F');

        drawAlCashLogo(30, 22, 12);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('AlCash', 42, 25);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(title, 42, 32);
        doc.setTextColor(180, 180, 180);
        doc.text(`EJERCICIO FISCAL ${year} | EMITIDO: ${new Date().toLocaleDateString()}`, 42, 37);
    };

    const drawSectionTitle = (text, y) => {
        doc.setTextColor(20, 20, 20);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(text, 20, y);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        doc.line(20, y + 2, 190, y + 2);
    };

    const renderAccountReport = (transList, accountLabel) => {
        const yearTrans = transList.filter(t => new Date(t.date).getFullYear() === year);
        const totalIncome = yearTrans.filter(t => t.type === 'income').reduce((a, b) => a + b.amountVal, 0);
        const totalExpense = yearTrans.filter(t => t.type === 'expense').reduce((a, b) => a + b.amountVal, 0);
        const balance = totalIncome - totalExpense;

        addHeader(`${accountLabel.toUpperCase()}: REPORTE DE RESULTADOS`, `Consolidado anual de operaciones financieras`);

        // 1. Global Balance
        drawSectionTitle('RESUMEN EJECUTIVO ANUAL', 60);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(120, 120, 120);
        doc.text('FLUJO DE INGRESOS', 25, 75);
        doc.text('FLUJO DE GASTOS', 85, 75);
        doc.text('MARGEN NETO', 145, 75);

        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.text(`${totalIncome.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, 25, 85);
        doc.text(`${totalExpense.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, 85, 85);

        if (balance >= 0) doc.setTextColor(16, 185, 129);
        else doc.setTextColor(239, 68, 68);
        doc.setFont('helvetica', 'bold');
        doc.text(`${balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, 145, 85);

        // 2. Monthly Table
        drawSectionTitle('DESGLOSE MENSUAL', 100);
        const headers = ['MES', 'INGRESOS', 'GASTOS', 'BALANCE'];
        const startY = 110;
        doc.setFillColor(245, 245, 245);
        doc.rect(20, startY, 170, 8, 'F');
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        headers.forEach((h, i) => doc.text(h, 25 + (i * 42.5), startY + 5.5));

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        for (let m = 0; m < 12; m++) {
            const y = startY + 14 + (m * 7);
            const monthName = new Date(year, m, 1).toLocaleString('es-ES', { month: 'long' }).toUpperCase();
            const mTrans = yearTrans.filter(t => new Date(t.date).getMonth() === m);
            const mInc = mTrans.filter(t => t.type === 'income').reduce((a, b) => a + b.amountVal, 0);
            const mExp = mTrans.filter(t => t.type === 'expense').reduce((a, b) => a + b.amountVal, 0);
            const mBal = mInc - mExp;

            if (m % 2 === 0) {
                doc.setFillColor(252, 252, 252);
                doc.rect(20, y - 5, 170, 7, 'F');
            }

            doc.text(monthName, 25, y);
            doc.text(`${mInc.toLocaleString('es-ES')}€`, 67.5, y);
            doc.setTextColor(239, 68, 68);
            doc.text(`${mExp.toLocaleString('es-ES')}€`, 110, y);
            if (mBal >= 0) doc.setTextColor(16, 185, 129);
            else doc.setTextColor(239, 68, 68);
            doc.setFont('helvetica', 'bold');
            doc.text(`${mBal.toLocaleString('es-ES')}€`, 152.5, y);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
        }

        // 3. Category Breakdown
        drawSectionTitle('DISTRIBUCIÓN POR CATEGORÍAS', 210);
        const catTotals = {};
        yearTrans.filter(t => t.type === 'expense').forEach(t => {
            catTotals[t.category] = (catTotals[t.category] || 0) + t.amountVal;
        });
        const sortedCats = Object.entries(catTotals).sort(([, a], [, b]) => b - a);

        doc.setFontSize(8.5);
        sortedCats.slice(0, 15).forEach(([cat, val], idx) => {
            const col = idx < 8 ? 0 : 1;
            const row = idx < 8 ? idx : idx - 8;
            const x = 25 + (col * 85);
            const y = 222 + (row * 7);

            const barWidth = 40;
            const percent = (val / (totalExpense || 1));
            doc.setFillColor(245, 245, 245);
            doc.rect(x + 35, y - 3, barWidth, 2, 'F');
            doc.setFillColor(60, 60, 60);
            doc.rect(x + 35, y - 3, barWidth * percent, 2, 'F');

            doc.setTextColor(40, 40, 40);
            doc.setFont('helvetica', 'bold');
            doc.text(cat.toUpperCase().substring(0, 12), x, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.text(`${val.toLocaleString('es-ES')} € (${(percent * 100).toFixed(1)}%)`, x + 35, y + 3.5);
            doc.setFontSize(8.5);
        });

        doc.setFontSize(7);
        doc.setTextColor(180, 180, 180);
        doc.text(`REPORTE CONFIDENCIAL ALCASH - ${accountLabel.toUpperCase()} - ${year} | PÁGINA ${doc.internal.getNumberOfPages()}`, 105, 285, { align: 'center' });
    };

    // Page 1: Personal Report
    renderAccountReport(personalTransactions, 'Cuenta Personal');

    // Page 2: Joint Report
    doc.addPage();
    renderAccountReport(jointTransactions, 'Cuenta Conjunta');

    doc.save(`Resumen_Ejecutivo_${year}.pdf`);
};

/**
 * Reporte Mensual Detallado
 */
export const exportMonthlyPDF = (transactions, stats, activeMonth, activeColor, theme) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const primaryColor = activeColor.hex || '#3B82F6';
    
    const COLORS = {
        primary: primaryColor,
        text: theme === 'dark' ? '#000000' : '#000000', // For PDF printing, light is usually better
        bg: '#FFFFFF',
        card: '#F9FAFB',
        border: 'rgba(0,0,0,0.05)',
        income: '#22C55E',
        expense: '#EF4444'
    };

    // 1. Cabecera (Sólida)
    doc.setFillColor(30,30,30);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Logo "A"
    doc.setFillColor(primaryColor);
    doc.circle(25, 20, 8, 'F');
    doc.setTextColor('#FFFFFF');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('A', 25, 22.5, { align: 'center' });

    doc.setTextColor('#FFFFFF');
    doc.setFontSize(22);
    doc.text('AlCash', 38, 22);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const subTitle = `REPORTE FINANCIERO MENSUAL | ${activeMonth.toUpperCase()}`;
    doc.text(subTitle, 38, 29);
    
    // 2. Sección Resumen
    let y = 60;
    doc.setTextColor(40,40,40);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN DE INDICADORES', 20, y);
    
    y += 10;
    const kpis = [
        { label: 'INGRESOS', val: `${stats.income.toFixed(0)}€`, color: COLORS.income },
        { label: 'GASTOS', val: `${stats.expense.toFixed(0)}€`, color: COLORS.expense },
        { label: 'BALANCE', val: `${stats.balance.toFixed(0)}€`, color: stats.balance >= 0 ? COLORS.income : COLORS.expense }
    ];

    kpis.forEach((kpi, i) => {
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(20 + (i * 60), y, 55, 25, 3, 3, 'F');
        
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, 25 + (i * 60), y + 7);
        
        doc.setFontSize(14);
        doc.setTextColor(kpi.color);
        doc.text(kpi.val, 25 + (i * 60), y + 17);
    });

    y += 45;

    // 3. Distribución de Gastos
    doc.setTextColor(40,40,40);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DISTRIBUCIÓN DE GASTOS', 20, y);
    
    y += 10;
    const byCat = {};
    transactions.filter(tx => tx.type === 'expense').forEach(tx => {
        byCat[tx.category] = (byCat[tx.category] || 0) + tx.amountVal;
    });

    const sortedCats = Object.entries(byCat).sort((a,b) => b[1] - a[1]).slice(0, 10);
    
    sortedCats.forEach(([cat, val], i) => {
        const percent = (val / (stats.expense || 1));
        const barWidth = 100;
        
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
        doc.text(cat, 25, y + 5);
        
        doc.setFillColor(241, 245, 249);
        doc.rect(70, y + 1.5, barWidth, 4, 'F');
        
        doc.setFillColor(primaryColor);
        doc.rect(70, y + 1.5, barWidth * percent, 4, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${val.toFixed(0)}€`, 180, y + 5, { align: 'right' });
        y += 10;
    });

    y += 20;

    // 4. Tabla de Movimientos
    if (y > 200) { doc.addPage(); y = 20; }
    
    doc.setTextColor(40,40,40);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('MUESTRA DE ÚLTIMOS MOVIMIENTOS', 20, y);
    
    y += 10;
    
    // Header Tabla
    doc.setFillColor(241, 245, 249);
    doc.rect(20, y, 170, 8, 'F');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('FECHA', 25, y + 5.5);
    doc.text('CONCEPTO', 45, y + 5.5);
    doc.text('CATEGORÍA', 110, y + 5.5);
    doc.text('IMPORTE', 185, y + 5.5, { align: 'right' });
    
    y += 13;
    doc.setFont('helvetica', 'normal');
    
    transactions.slice(0, 20).forEach((tx, i) => {
        if (y > 275) { doc.addPage(); y = 20; }
        
        if (i % 2 === 0) {
            doc.setFillColor(250, 251, 253);
            doc.rect(20, y - 5, 170, 7.5, 'F');
        }
        
        doc.setTextColor(100, 116, 139);
        doc.text(tx.date, 25, y);
        
        doc.setTextColor(51, 65, 85);
        const note = (tx.note || tx.subCategory || 'Sin concepto').substring(0, 35);
        doc.text(note, 45, y);
        doc.text(tx.category, 110, y);
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(tx.type === 'income' ? COLORS.income : COLORS.expense);
        doc.text(`${tx.type === 'income' ? '+' : '-'}${tx.amountVal.toFixed(2)}€`, 185, y, { align: 'right' });
        
        doc.setFont('helvetica', 'normal');
        y += 7.5;
    });

    // Pie de página en todas las páginas
    const totalPages = doc.internal.getNumberOfPages();
    for(let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Página ${i} de ${totalPages} | Reporte generado automáticamente por AlCash Smart Money`, pageWidth / 2, 287, { align: 'center' });
    }

    doc.save(`AlCash_Monthly_${activeMonth.replace(' ', '_')}.pdf`);
};
