import { Plus, Zap, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const TABS = [
    { id: 'tx',     label: 'Movimiento',   Icon: Plus   },
    { id: 'auto',   label: 'Auto',         Icon: Zap    },
    { id: 'shared', label: 'Compartido',   Icon: Users  },
];

const AddTabBar = ({ active, onChange }) => {
    const { theme, t, activeColor } = useAuth();
    return (
        <div className={`relative flex p-1.5 rounded-2xl gap-1 border ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
            {TABS.map(({ id, label, Icon }) => {
                const isActive = active === id;
                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onChange(id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-200 ${
                            isActive
                                ? `${activeColor.bg} text-white shadow-lg scale-[1.02]`
                                : `${t.textSec} hover:opacity-90 ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-white'}`
                        }`}
                    >
                        <Icon size={13} strokeWidth={2.6} />
                        <span className="hidden sm:inline">{label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default AddTabBar;
