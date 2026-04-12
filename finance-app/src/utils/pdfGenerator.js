import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportMonthlyPDF = async (transactions, stats, activeMonth, t, theme) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Configuración de colores según tema
    const COLORS = {
        primary: '#3B82F6',
        text: theme === 'dark' ? '#FFFFFF' : '#000000',
        bg: theme === 'dark' ? '#0A0A0B' : '#FFFFFF',
        card: theme === 'dark' ? '#141415' : '#F9FAFB',
        border: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        income: '#22C55E',
        expense: '#EF4444'
    };

    // 1. Cabecera
    doc.setFillColor(COLORS.primary);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor('#FFFFFF');
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('ALCASH', 20, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`REPORTE FINANCIERO MENSUAL - ${activeMonth}`, 20, 32);
    
    // 2. Resumen KPI
    let y = 60;
    
    doc.setTextColor(COLORS.text);
    doc.setFontSize(14);
    doc.text('RESUMEN GENERAL', 20, y);
    
    y += 15;
    
    const kpis = [
        { label: 'Ingresos Totales', val: `${stats.income.toFixed(2)}€`, color: COLORS.income },
        { label: 'Gastos Totales', val: `${stats.expense.toFixed(2)}€`, color: COLORS.expense },
        { label: 'Ahorro Neto', val: `${stats.balance.toFixed(2)}€`, color: COLORS.primary }
    ];

    kpis.forEach((kpi, i) => {
        doc.setFillColor(COLORS.card);
        doc.roundedRect(20 + (i * 58), y, 54, 30, 4, 4, 'F');
        
        doc.setFontSize(8);
        doc.setTextColor(COLORS.text);
        doc.text(kpi.label, 25 + (i * 58), y + 10);
        
        doc.setFontSize(12);
        doc.setTextColor(kpi.color);
        doc.text(kpi.val, 25 + (i * 58), y + 22);
    });

    y += 50;

    // 3. Gastos por Categoría
    doc.setTextColor(COLORS.text);
    doc.setFontSize(14);
    doc.text('GASTOS POR CATEGORÍA', 20, y);
    
    y += 10;
    
    const byCat = {};
    transactions.filter(tx => tx.type === 'expense').forEach(tx => {
        byCat[tx.category] = (byCat[tx.category] || 0) + tx.amountVal;
    });

    const sortedCats = Object.entries(byCat).sort((a,b) => b[1] - a[1]);
    
    doc.setFontSize(9);
    sortedCats.forEach(([cat, val], i) => {
        if (y > 270) { doc.addPage(); y = 20; }
        
        doc.setTextColor(COLORS.text);
        doc.text(cat, 25, y + 5);
        
        const barMax = 100;
        const barVal = (val / stats.expense) * barMax;
        
        doc.setFillColor(COLORS.border);
        doc.rect(70, y, barMax, 5, 'F');
        
        doc.setFillColor(COLORS.primary);
        doc.rect(70, y, barVal, 5, 'F');
        
        doc.text(`${val.toFixed(0)}€`, 175, y + 5);
        y += 10;
    });

    y += 20;

    // 4. Últimas Transacciones
    doc.setTextColor(COLORS.text);
    doc.setFontSize(14);
    doc.text('MUESTRA DE MOVIMIENTOS', 20, y);
    
    y += 10;
    doc.setFontSize(8);
    doc.setTextColor(COLORS.text);
    
    const sampleTx = transactions.slice(0, 15);
    sampleTx.forEach(tx => {
        if (y > 270) { doc.addPage(); y = 20; }
        
        doc.text(tx.date, 20, y);
        doc.text(tx.note || tx.subCategory, 40, y);
        doc.text(tx.category, 110, y);
        
        doc.setTextColor(tx.type === 'income' ? COLORS.income : COLORS.expense);
        doc.text(`${tx.type === 'income' ? '+' : '-'}${tx.amountVal.toFixed(2)}€`, 170, y, { align: 'right' });
        
        doc.setTextColor(COLORS.text);
        y += 7;
    });

    // Pie de página
    const totalPages = doc.internal.getNumberOfPages();
    for(let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor('#888888');
        doc.text(`Página ${i} de ${totalPages} - Generado por AlCash Smart Money`, pageWidth / 2, 285, { align: 'center' });
    }

    doc.save(`AlCash_Reporte_${activeMonth.replace(' ', '_')}.pdf`);
};
