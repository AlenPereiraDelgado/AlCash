import { Plus, Zap, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const TABS = [
    { id: 'tx',     label: 'Movimiento', Icon: Plus  },
    { id: 'auto',   label: 'Auto',       Icon: Zap   },
    { id: 'shared', label: 'Compartido', Icon: Users },
];

const AddTabBar = ({ active, onChange, disabled = false }) => {
    const { theme, t, activeColor } = useAuth();
    return (
        <div className={`flex p-1 rounded-2xl gap-1 ${theme === 'dark' ? 'bg-black/40 border border-white/5' : 'bg-gray-100'}`}>
            {TABS.map(({ id, label, Icon }) => {
                const isActive = active === id;
                return (
                    <button
                        key={id}
                        type="button"
                        disabled={disabled && !isActive}
                        onClick={() => onChange(id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-30 ${
                            isActive
                                ? `${activeColor.bg} text-white shadow-lg`
                                : `${t.textSec} hover:opacity-100`
                        }`}
                    >
                        <Icon size={13} strokeWidth={2.6} />
                        {label}
                    </button>
                );
            })}
        </div>
    );
};

export default AddTabBar;
