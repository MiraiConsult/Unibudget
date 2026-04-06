import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { Card } from './ui/Card';
import { Search, Package, AlertTriangle, ArrowUpRight, QrCode, PackageMinus } from 'lucide-react';
import QRCodeModal from './modals/QRCodeModal';
import ConsumoModal from './modals/ConsumoModal';
import type { Insumo } from '../types';

const InventoryPanel: React.FC = () => {
    const { insumos, compras, consumos } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);
    const [selectedInsumoForQR, setSelectedInsumoForQR] = useState<Insumo | null>(null);
    
    const [isConsumoModalOpen, setIsConsumoModalOpen] = useState(false);
    const [selectedInsumoForConsumo, setSelectedInsumoForConsumo] = useState<number | null>(null);

    // Check URL parameters for QR Code scan action
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');
        const insumoId = params.get('insumo_id');

        if (action === 'consume' && insumoId) {
            setSelectedInsumoForConsumo(Number(insumoId));
            setIsConsumoModalOpen(true);
            
            // Clean up URL so it doesn't trigger again on refresh
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    // Calculate stock levels from purchases minus consumptions
    const stockLevels = useMemo(() => {
        const levels: Record<number, number> = {};
        compras.forEach(compra => {
            levels[compra.insumo_id] = (levels[compra.insumo_id] || 0) + Number(compra.quantidade);
        });
        consumos.forEach(consumo => {
            levels[consumo.insumo_id] = (levels[consumo.insumo_id] || 0) - Number(consumo.quantidade);
        });
        return levels;
    }, [compras, consumos]);

    const filteredInsumos = insumos.filter(insumo => 
        insumo.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalStockValue = insumos.reduce((total, insumo) => {
        const stock = stockLevels[insumo.id] || 0;
        return total + (stock * insumo.custo_unitario);
    }, 0);

    const lowStockItems = insumos.filter(insumo => (stockLevels[insumo.id] || 0) < 10);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Controle de Estoque</h1>
                <p className="text-slate-500 mt-1">Acompanhe as quantidades de insumos disponíveis no seu estoque, calculadas a partir das compras.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-brandBlue-100 text-brandBlue-600 rounded-lg">
                            <Package size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Total de Itens</p>
                            <h3 className="text-2xl font-bold text-slate-900">{insumos.length}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="bg-white">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-success-100 text-success-600 rounded-lg">
                            <ArrowUpRight size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Valor em Estoque</p>
                            <h3 className="text-2xl font-bold text-slate-900">
                                {totalStockValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </h3>
                        </div>
                    </div>
                </Card>
                <Card className="bg-white">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-warning-100 text-warning-600 rounded-lg">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Estoque Baixo</p>
                            <h3 className="text-2xl font-bold text-slate-900">{lowStockItems.length}</h3>
                        </div>
                    </div>
                </Card>
            </div>

            <Card>
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                    <h2 className="text-lg font-semibold text-slate-800">Inventário de Insumos</h2>
                    <div className="relative w-full md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={18} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar insumo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="py-3 px-6 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Insumo</th>
                                <th className="py-3 px-6 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Unidade</th>
                                <th className="py-3 px-6 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Custo Unitário</th>
                                <th className="py-3 px-6 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Quantidade em Estoque</th>
                                <th className="py-3 px-6 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações Rápidas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredInsumos.map(insumo => {
                                const stock = stockLevels[insumo.id] || 0;
                                const isLowStock = stock < 10;
                                
                                return (
                                    <tr key={insumo.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-6 text-sm font-medium text-slate-900">
                                            <div className="flex items-center">
                                                {insumo.nome}
                                                {isLowStock && (
                                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-warning-100 text-warning-800">
                                                        Baixo
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-slate-500">{insumo.unidade_medida}</td>
                                        <td className="py-4 px-6 text-sm text-slate-500">
                                            {insumo.custo_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="py-4 px-6 text-sm text-center">
                                            <span className={`font-semibold ${isLowStock ? 'text-warning-600' : 'text-slate-700'}`}>
                                                {stock.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedInsumoForConsumo(insumo.id);
                                                        setIsConsumoModalOpen(true);
                                                    }}
                                                    className="p-1.5 text-danger-600 bg-danger-50 hover:bg-danger-100 rounded transition-colors flex items-center"
                                                    title="Registrar Consumo / Saída"
                                                >
                                                    <PackageMinus size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setSelectedInsumoForQR(insumo);
                                                        setIsQRModalOpen(true);
                                                    }}
                                                    className="p-1.5 text-brandBlue-600 bg-brandBlue-50 hover:bg-brandBlue-100 rounded transition-colors flex items-center"
                                                    title="Gerar Etiqueta QR Code"
                                                >
                                                    <QrCode size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredInsumos.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-500">
                                        Nenhum insumo encontrado com esse nome.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <QRCodeModal 
                isOpen={isQRModalOpen} 
                onClose={() => setIsQRModalOpen(false)} 
                insumo={selectedInsumoForQR} 
            />
            
            <ConsumoModal 
                isOpen={isConsumoModalOpen} 
                onClose={() => {
                    setIsConsumoModalOpen(false);
                    setSelectedInsumoForConsumo(null);
                }} 
                initialInsumoId={selectedInsumoForConsumo} 
            />
        </div>
    );
};

export default InventoryPanel;
