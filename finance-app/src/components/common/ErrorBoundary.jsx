import React from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shadow-inner">
                        <AlertCircle size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black mb-2">Vaya, algo ha fallado</h2>
                        <p className="text-sm font-bold opacity-40 max-w-md mx-auto">
                            Ha ocurrido un error inesperado en este componente. No te preocupes, el resto de la aplicación sigue siendo segura.
                        </p>
                    </div>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="flex items-center gap-2 px-8 py-4 bg-blue-500 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                    >
                        <RefreshCcw size={18} /> RECARGAR APLICACIÓN
                    </button>
                    {import.meta.env.DEV && (
                        <pre className="mt-8 p-4 bg-black/10 rounded-xl text-left text-[10px] overflow-auto max-w-full font-mono opacity-50">
                            {this.state.error?.toString()}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
