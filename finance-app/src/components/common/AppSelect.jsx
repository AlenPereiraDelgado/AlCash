import { ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const AppSelect = ({ className = '', wrapperClass = '', children, ...props }) => {
    const { t } = useAuth();
    return (
        <div className={`relative w-full ${wrapperClass}`}>
            <select
                className={`appearance-none w-full pr-8 ${t.input} ${className}`}
                {...props}
            >
                {children}
            </select>
            <ChevronDown
                size={14}
                className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 ${t.textSec}`}
            />
        </div>
    );
};

export default AppSelect;
