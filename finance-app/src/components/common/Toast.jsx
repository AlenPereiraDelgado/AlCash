import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

const Toast = ({ id, message, type = 'success', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, 4000);
        return () => clearTimeout(timer);
    }, [id, onClose]);

    const styles = {
        success: {
            bg: 'bg-[#1C1C1E]/90 border-[#30D158]/20',
            icon: <CheckCircle2 className="text-[#30D158]" size={20} />,
            glow: 'shadow-[0_0_20px_rgba(48,209,88,0.15)]'
        },
        error: {
            bg: 'bg-[#1C1C1E]/90 border-[#FF453A]/20',
            icon: <XCircle className="text-[#FF453A]" size={20} />,
            glow: 'shadow-[0_0_20px_rgba(255,69,58,0.15)]'
        },
        warning: {
            bg: 'bg-[#1C1C1E]/90 border-[#FF9F0A]/20',
            icon: <AlertCircle className="text-[#FF9F0A]" size={20} />,
            glow: 'shadow-[0_0_20px_rgba(255,159,10,0.15)]'
        },
        info: {
            bg: 'bg-[#1C1C1E]/90 border-[#0A84FF]/20',
            icon: <Info className="text-[#0A84FF]" size={20} />,
            glow: 'shadow-[0_0_20px_rgba(10,132,255,0.15)]'
        }
    };

    const style = styles[type] || styles.info;

    return (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border backdrop-blur-xl animate-in slide-in-from-right-full duration-300 ${style.bg} ${style.glow}`}>
            <div className="shrink-0">{style.icon}</div>
            <p className="text-sm font-bold text-white pr-6">{message}</p>
            <button 
                onClick={() => onClose(id)} 
                className="absolute top-2 right-2 text-white/40 hover:text-white transition-colors"
            >
                <X size={14} />
            </button>
        </div>
    );
};

export const ToastContainer = ({ toasts, removeToast }) => {
    return (
        <div className="fixed top-6 right-6 z-[2000] flex flex-col gap-3 max-w-sm w-full">
            {toasts.map(toast => (
                <Toast key={toast.id} {...toast} onClose={removeToast} />
            ))}
        </div>
    );
};

export default Toast;
