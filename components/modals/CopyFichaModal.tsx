import React, { useState, useEffect } from 'react';
import type { ProdutoBase } from '../../types';
import { X, CopyCheck } from 'lucide-react';

interface CopyFichaModalProps {
    isOpen: boolean;
    onClose: () => void;
    produtos: ProdutoBase[];
    sourceProduto: ProdutoBase | null;
    onConfirmCopy: (targetProductId: number) => Promise<void>;
}

const MiniSpinner: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const CopyFichaModal: React.FC<CopyFichaModalProps> = ({ isOpen, onClose, produtos, sourceProduto, onConfirmCopy }) => {
    const [targetProductId, setTargetProductId] = useState<string>('');
    const [isCopying, setIsCopying] = useState(false);

    useEffect(() => {
        if(isOpen) {
            setTargetProductId('');
            setIsCopying(false);
        }
    }, [isOpen]);

    if (!isOpen || !sourceProduto) return null;

    const availableProducts = produtos.filter(p => p.id !== sourceProduto.id);

    const handleConfirm = async () => {
        if (!targetProductId) return;
        setIsCopying(true);
        await onConfirmCopy(parseInt(targetProductId));
        setIsCopying(false);
    };

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-slate-800">Copiar Ficha Técnica</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600">
                        Você está copiando a ficha técnica do produto: <strong className="text-primary-600">{sourceProduto.nome}</strong>.
                    </p>
                    <div>
                        <label htmlFor="targetProduct" className="block text-sm font-medium text-slate-700 mb-2">
                            Selecione o produto de destino:
                        </label>
                        <select
                            id="targetProduct"
                            value={targetProductId}
                            onChange={(e) => setTargetProductId(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                            <option value="">Selecione um produto...</option>
                            {availableProducts.map(p => (
                                <option key={p.id} value={p.id}>{p.nome}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="bg-slate-50 p-4 border-t flex justify-end space-x-3">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={!targetProductId || isCopying}
                        className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:bg-slate-400 transition-colors min-w-[160px]"
                    >
                        {isCopying ? (
                            <><MiniSpinner /> Copiando...</>
                        ) : (
                            <><CopyCheck size={16} className="mr-2" /> Confirmar Cópia</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CopyFichaModal;
