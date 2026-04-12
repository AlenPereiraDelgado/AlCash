import React from 'react';

const EmptyState = ({ title, description, icon: Icon, action, t }) => (
    <div className={`p-12 rounded-[40px] border-2 border-dashed flex flex-col items-center text-center gap-6 ${t.card} border-white/5`}>
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-gray-500">
            {Icon && <Icon size={32} />}
        </div>
        <div>
            <h3 className="text-xl font-bold mb-2">{title}</h3>
            <p className="text-gray-500 text-sm max-w-sm font-medium">{description}</p>
        </div>
        {action && (
            <button onClick={action} className="px-8 py-3 rounded-2xl bg-blue-500 text-white font-bold shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                Empezar ahora
            </button>
        )}
    </div>
);

export default EmptyState;
