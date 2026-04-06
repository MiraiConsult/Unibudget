import React, { useRef, useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { X, Printer } from 'lucide-react';
import type { Insumo } from '../../types';
import { supabase } from '../../services/supabaseClient';

interface QRCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    insumo: Insumo | null;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, insumo }) => {
    const qrRef = useRef<HTMLDivElement>(null);
    const [tenantId, setTenantId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        // Usa o tenant_id do próprio insumo se disponível; caso contrário
        // busca via RPC get_my_tenant_id(). Assim o QR fica amarrado ao
        // tenant que o gerou e a página pública consegue filtrar.
        const fromInsumo = (insumo as any)?.tenant_id as string | null | undefined;
        if (fromInsumo) {
            setTenantId(fromInsumo);
            return;
        }
        supabase.rpc('get_my_tenant_id').then(({ data }) => {
            if (data) setTenantId(data as unknown as string);
        });
    }, [isOpen, insumo]);

    if (!isOpen || !insumo) return null;

    // The URL that the QR code will point to — inclui tenant_id para
    // isolar o fluxo de consumo público entre empresas.
    const tenantParam = tenantId ? `&tenant_id=${encodeURIComponent(tenantId)}` : '';
    const qrUrl = `${window.location.origin}?action=consume&insumo_id=${insumo.id}${tenantParam}`;

    const handlePrint = () => {
        const printContent = qrRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Imprimir QR Code - ${insumo.nome}</title>
                    <style>
                        body {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            font-family: sans-serif;
                        }
                        .label-container {
                            text-align: center;
                            border: 2px solid #000;
                            padding: 20px;
                            border-radius: 8px;
                            width: 300px;
                        }
                        h2 {
                            margin: 0 0 5px 0;
                            font-size: 18px;
                        }
                        p {
                            margin: 0 0 15px 0;
                            font-size: 14px;
                            color: #555;
                        }
                        .qr-wrapper {
                            display: flex;
                            justify-content: center;
                        }
                    </style>
                </head>
                <body>
                    <div class="label-container">
                        <h2>${insumo.nome}</h2>
                        <p>Unidade: ${insumo.unidade_medida}</p>
                        <div class="qr-wrapper">
                            ${printContent.innerHTML}
                        </div>
                    </div>
                    <script>
                        window.onload = function() {
                            window.print();
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
                <div className="flex justify-between items-center p-4 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">QR Code do Insumo</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 flex flex-col items-center">
                    <div className="text-center mb-6">
                        <h3 className="font-semibold text-slate-900 text-lg">{insumo.nome}</h3>
                        <p className="text-sm text-slate-500">Unidade: {insumo.unidade_medida}</p>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100" ref={qrRef}>
                        <QRCode 
                            value={qrUrl} 
                            size={200}
                            level="H"
                        />
                    </div>

                    <p className="text-xs text-slate-400 mt-4 text-center">
                        Cole esta etiqueta na prateleira. Leia com a câmera do celular para registrar o consumo.
                    </p>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={handlePrint}
                        className="flex items-center px-4 py-2 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors"
                    >
                        <Printer size={18} className="mr-2" />
                        Imprimir Etiqueta
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QRCodeModal;
