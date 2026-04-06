import React, { ReactElement } from 'react';

interface EmptyStateProps {
    icon: React.ReactElement<React.SVGAttributes<SVGSVGElement>>;
    message: string;
    description: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, message, description }) => {
    return (
        <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-lg">
            <div className="flex justify-center items-center mb-4 text-slate-400">
                 {/* FIX: Cast props to `any` to resolve issue where `className` is not recognized on the cloned element's props type. */}
                 {React.cloneElement(icon, { className: 'w-10 h-10' } as any)}
            </div>
            <h3 className="text-lg font-semibold text-slate-800">{message}</h3>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
    );
};

export default EmptyState;