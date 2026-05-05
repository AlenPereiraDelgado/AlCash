import React, { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Sparkles, TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { parseLocalDate } from '../../utils/helpers';

const InsightCard = ({ transactions, t, activeColor }) => {
    const { theme } = useAuth();
    const insights = useMemo(() => {
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();
        const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
        const lastYear = thisMonth === 0 ? thisYear - 1 : thisYear;

        const currentMonthData = transactions.filter(tx => {
            const d = parseLocalDate(tx.date);
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        });

        const lastMonthData = transactions.filter(tx => {
            const d = parseLocalDate(tx.date);
            return d.getMonth() === lastMonth && d.getFullYear() === lastYear;
        });

        const currentExp = currentMonthData.filter(t => t.type === 'expense').reduce((a, b) => a + b.amountVal, 0);
        const lastExp = lastMonthData.filter(t => t.type === 'expense').reduce((a, b) => a + b.amountVal, 0);

        const list = [];

        // 1. Comparativa de Gasto
        if (lastExp > 0) {
            const diff = ((currentExp - lastExp) / lastExp) * 100;
            if (diff < -5) {
                list.push({
                    type: 'success',
                    icon: TrendingDown,
                    title: '¡Excelente control!',
                    desc: `Estás gastando un ${Math.abs(diff).toFixed(0)}% menos que el mes pasado.`
                });
            } else if (diff > 10) {
                list.push({
                    type: 'warning',
                    icon: AlertCircle,
                    title: 'Ritmo acelerado',
                    desc: `Tus gastos han subido un ${diff.toFixed(0)}% respecto al mes anterior.`
                });
            }
        }

        // 2. Categoría Top
        const catTotals = {};
        currentMonthData.filter(t => t.type === 'expense').forEach(tx => {
            catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amountVal;
        });
        const topCat = Object.entries(catTotals).sort((a,b) => b[1] - a[1])[0];
        if (topCat) {
            list.push({
                type: 'info',
                icon: Sparkles,
                title: `Enfoque en ${topCat[0]}`,
                desc: `Esta categoría representa el ${((topCat[1] / (currentExp || 1)) * 100).toFixed(0)}% de tus gastos actuales.`
            });
        }

        // 3. Tasa de Ahorro
        const currentInc = currentMonthData.filter(t => t.type === 'income').reduce((a, b) => a + b.amountVal, 0);
        if (currentInc > 0) {
            const rate = ((currentInc - currentExp) / currentInc) * 100;
            if (rate > 20) {
                list.push({
                    type: 'success',
                    icon: CheckCircle,
                    title: 'Ahorro Saludable',
                    desc: `Has retenido el ${rate.toFixed(0)}% de tus ingresos este mes. ¡Sigue así!`
                });
            }
        }

        return list.length > 0 ? list : [{
            type: 'info',
            icon: Sparkles,
            title: 'Analista AlCash',
            desc: 'Sigue registrando tus movimientos para obtener consejos personalizados sobre tus finanzas.'
        }];
    }, [transactions]);

    return (
        <div className={`p-6 rounded-[32px] border relative overflow-hidden ${t.card}`}>
            <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-xl ${activeColor.bg} text-white shadow-lg shadow-blue-500/20`}>
                    <Sparkles size={20} />
                </div>
                <h3 className="font-black text-lg tracking-tight">Analista Inteligente</h3>
            </div>

            <div className="space-y-4">
                {insights.map((ins, i) => (
                    <div key={i} className={`p-4 rounded-2xl border transition-all hover:scale-[1.02] flex gap-4 ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                        <div className={`mt-1 ${ins.type === 'success' ? 'text-green-500' : ins.type === 'warning' ? 'text-orange-500' : 'text-blue-500'}`}>
                            <ins.icon size={20} />
                        </div>
                        <div>
                            <p className="font-black text-sm">{ins.title}</p>
                            <p className="text-xs font-bold opacity-40 leading-relaxed">{ins.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="absolute -right-6 -bottom-6 opacity-[0.03]">
                <Sparkles size={120} />
            </div>
        </div>
    );
};

export default InsightCard;
