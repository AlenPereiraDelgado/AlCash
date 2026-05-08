import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFinance } from '../../contexts/FinanceContext';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../constants/theme';
import {
    ChevronLeft, ChevronRight, TrendingUp,
    PieChart as PieChartIcon
} from 'lucide-react';
import {
    DailyEvolutionChart, CategoryDonutChart
} from '../charts/FinanceCharts';
import { parseLocalDate, resolveCategoryColor } from '../../utils/helpers';

const AnalysisView = ({
    analysisType,
    setAnalysisType,
    analysisDate,
    setAnalysisDate,
    personalTransactions
}) => {
    const { theme, t, activeColor } = useAuth();
    const { transactions, categories, categoryColors } = useFinance();

    // 1. FILTRADO DE TRANSACCIONES PARA EL PERIODO
    const periodTransactions = React.useMemo(() => {
        return personalTransactions.filter(tx => {
            const d = parseLocalDate(tx.date);
            if (analysisType === 'month') {
                return d.getMonth() === analysisDate.getMonth() && d.getFullYear() === analysisDate.getFullYear();
            }
            return d.getFullYear() === analysisDate.getFullYear();
        });
    }, [personalTransactions, analysisDate, analysisType]);

    // 2. DATOS DE EVOLUCIÓN
    const evolutionData = React.useMemo(() => {
        if (analysisType === 'month') {
            const daysInMonth = new Date(analysisDate.getFullYear(), analysisDate.getMonth() + 1, 0).getDate();
            return Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const val = periodTransactions
                    .filter(tx => tx.type === 'expense' && parseLocalDate(tx.date).getDate() <= day)
                    .reduce((a, b) => a + b.amountVal, 0);
                return { name: day.toString(), value: val };
            });
        } else {
            return Array.from({ length: 12 }, (_, i) => {
                const val = personalTransactions
                    .filter(tx => { const d = parseLocalDate(tx.date); return tx.type === 'expense' && d.getMonth() === i && d.getFullYear() === analysisDate.getFullYear(); })
                    .reduce((a, b) => a + b.amountVal, 0);
                return { name: new Date(2024, i, 1).toLocaleString('es-ES', { month: 'short' }), value: val };
            });
        }
    }, [periodTransactions, personalTransactions, analysisDate, analysisType]);

    // 3. DATOS DE DISTRIBUCIÓN
    const donutData = React.useMemo(() => {
        return Object.keys(categories.expense).map(cat => ({
            name: cat,
            value: periodTransactions
                .filter(tx => tx.type === 'expense' && tx.category === cat)
                .reduce((a, b) => a + b.amountVal, 0),
            color: resolveCategoryColor(cat, categoryColors, CATEGORY_COLORS)
        })).filter(d => d.value > 0);
    }, [periodTransactions, categories, categoryColors]);

    return (
        <div className="space-y-8 animate-in fade-in">
            {/* CONTROLES DE FECHA PARA ANÁLISIS */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="bg-white/5 p-1 rounded-xl flex border border-white/10">
                    <button onClick={() => setAnalysisType('month')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${analysisType === 'month' ? `${activeColor.bg} text-white shadow` : 'hover:bg-white/5'}`}>Mes</button>
                    <button onClick={() => setAnalysisType('year')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${analysisType === 'year' ? `${activeColor.bg} text-white shadow` : 'hover:bg-white/5'}`}>Año</button>
                </div>

                {analysisType === 'month' ? (
                    <div className="flex-1 flex justify-between items-center bg-white/5 p-2 rounded-2xl border border-white/10">
                        <button onClick={() => setAnalysisDate(new Date(analysisDate.setMonth(analysisDate.getMonth() - 1)))} className="p-2 hover:bg-white/10 rounded-xl"><ChevronLeft /></button>
                        <span className="font-black text-lg capitalize">{analysisDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</span>
                        <button onClick={() => setAnalysisDate(new Date(analysisDate.setMonth(analysisDate.getMonth() + 1)))} className="p-2 hover:bg-white/10 rounded-xl"><ChevronRight /></button>
                    </div>
                ) : (
                    <div className="flex-1 flex justify-between items-center bg-white/5 p-2 rounded-2xl border border-white/10">
                        <button onClick={() => setAnalysisDate(new Date(analysisDate.setFullYear(analysisDate.getFullYear() - 1)))} className="p-2 hover:bg-white/10 rounded-xl"><ChevronLeft /></button>
                        <span className="font-black text-lg">{analysisDate.getFullYear()}</span>
                        <button onClick={() => setAnalysisDate(new Date(analysisDate.setFullYear(analysisDate.getFullYear() + 1)))} className="p-2 hover:bg-white/10 rounded-xl"><ChevronRight /></button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 2. GRÁFICO DE EVOLUCIÓN */}
                <div className={`p-8 rounded-[32px] border ${t.card}`}>
                    <div className="mb-6">
                        <h3 className="text-lg font-bold flex items-center gap-2"><TrendingUp size={18} /> {analysisType === 'month' ? 'Evolución Diaria' : 'Evolución Mensual'}</h3>
                        <p className={`text-xs ${t.textSec} mt-1`}>{analysisType === 'month' ? 'Acumulado diario del mes.' : 'Comparativa de gasto por meses.'}</p>
                    </div>
                    <DailyEvolutionChart
                        theme={theme}
                        color={theme === 'dark' ? '#30D158' : '#10b981'}
                        data={evolutionData}
                    />
                </div>

                {/* 3. DISTRIBUCIÓN POR CATEGORÍA */}
                <div className={`p-8 rounded-[32px] border ${t.card}`}>
                    <div className="mb-6">
                        <h3 className="text-lg font-bold flex items-center gap-2"><PieChartIcon size={18} /> Distribución</h3>
                        <p className={`text-xs ${t.textSec} mt-1`}>Gasto por categorías principales.</p>
                    </div>
                    <CategoryDonutChart
                        theme={theme}
                        data={donutData}
                    />
                </div>
            </div>
        </div>
    );
};

export default AnalysisView;
