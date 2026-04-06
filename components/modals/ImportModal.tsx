import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import { X, UploadCloud, FileDown, Loader2 } from 'lucide-react';
import { downloadCSVTemplate, parseCSV, parseXLSX, templates } from '../../utils/importUtils';

type ImportType = 'insumos' | 'produtos' | 'adicionais' | 'vendedores' | 'fichas_tecnicas';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialType?: ImportType;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, initialType }) => {
    const [importType, setImportType] = useState<ImportType>(initialType ?? 'insumos');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const { fetchData, produtosBase, insumos, insumosEspeciais, recalculateProdutoCost } = useData();

    React.useEffect(() => {
        if (isOpen && initialType) setImportType(initialType);
    }, [isOpen, initialType]);
    const { showNotification } = useNotification();

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleImport = async () => {
        if (!file) {
            showNotification('Por favor, selecione um arquivo.', 'warning');
            return;
        }
        setLoading(true);

        try {
            let parsedData: any[];
            if (file.name.endsWith('.csv')) {
                 parsedData = await parseCSV<any>(file);
            } else if (file.name.endsWith('.xlsx')) {
                 parsedData = await parseXLSX<any>(file);
            } else {
                throw new Error("Formato de arquivo não suportado. Use .csv ou .xlsx.");
            }

            if (parsedData.length === 0) {
                throw new Error("O arquivo não contém dados para importar.");
            }
            
            const expectedHeaders = templates[importType].headers;
            const fileHeaders = Object.keys(parsedData[0]);
            // Para fichas_tecnicas apenas produto_nome e quantidade sao
            // realmente obrigatorios; os demais campos (insumo_nome,
            // insumo_especial_nome, quantidade_adulto, quantidade_infantil)
            // sao opcionais por linha.
            const requiredHeaders = importType === 'fichas_tecnicas'
                ? ['produto_nome']
                : expectedHeaders;
            const hasAllHeaders = requiredHeaders.every(h => fileHeaders.includes(h));
            if (!hasAllHeaders) {
                throw new Error(`Cabeçalhos inválidos. Esperado: ${expectedHeaders.join(', ')}`);
            }
            
            let dataToInsert: any[] = [];
            const uniqueProductIdsToUpdate = new Set<number>();

            if (importType === 'fichas_tecnicas') {
                // Normaliza para comparacao case/acentos-insensivel
                const norm = (s: string) => (s || '').toString().trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                // Normaliza um header: minusculas, sem acento, sem espacos
                // ou separadores. "Quantidade Adulto" -> "quantidadeadulto".
                const normHeader = (s: string) => norm(s).replace(/[\s_\-./]+/g, '');

                // Aliases aceitos para cada campo logico
                const aliases: Record<string, string[]> = {
                    produto_nome:        ['produtonome', 'produto', 'nomeproduto', 'nomedoproduto'],
                    insumo_nome:         ['insumonome', 'insumo', 'nomeinsumo', 'nomedoinsumo', 'insumocomum', 'insumonomecomum'],
                    insumo_especial_nome:['insumoespecialnome', 'insumoespecial', 'nomeinsumoespecial', 'especial', 'nomedoinsumoespecial'],
                    quantidade:          ['quantidade', 'qtd', 'qtde', 'quantidadegeral', 'qtdgeral'],
                    quantidade_adulto:   ['quantidadeadulto', 'qtdadulto', 'qtdeadulto', 'adulto', 'quantidadead'],
                    quantidade_infantil: ['quantidadeinfantil', 'qtdinfantil', 'qtdeinfantil', 'infantil', 'quantidadeinf'],
                };

                // Mapeia chave logica -> nome de coluna real no arquivo
                const headerMap: Record<string, string | undefined> = {};
                const headersNormToReal = new Map<string, string>();
                for (const h of fileHeaders) headersNormToReal.set(normHeader(h), h);
                for (const [key, opts] of Object.entries(aliases)) {
                    for (const opt of opts) {
                        const real = headersNormToReal.get(opt);
                        if (real) { headerMap[key] = real; break; }
                    }
                }

                if (!headerMap.produto_nome) {
                    throw new Error(`Cabeçalho "produto_nome" não encontrado. Detectados: ${fileHeaders.join(', ')}`);
                }
                const getCell = (row: any, key: string) => {
                    const col = headerMap[key];
                    return col ? row[col] : undefined;
                };

                const produtoMap = new Map(produtosBase.map(p => [norm(p.nome), p.id]));
                const insumoMap = new Map(insumos.map(i => [norm(i.nome), i.id]));
                const insumoEspecialMap = new Map(insumosEspeciais.map(i => [norm(i.nome), i.id]));

                dataToInsert = parsedData.map((row, index) => {
                    const produtoNomeRaw = getCell(row, 'produto_nome');
                    const produtoId = produtoMap.get(norm(produtoNomeRaw));
                    if (typeof produtoId !== 'number') throw new Error(`Linha ${index + 2}: Produto "${produtoNomeRaw}" não encontrado.`);

                    const insumoNome = (getCell(row, 'insumo_nome') || '').toString().trim();
                    const insumoEspecialNome = (getCell(row, 'insumo_especial_nome') || '').toString().trim();
                    if (!insumoNome && !insumoEspecialNome) {
                        throw new Error(`Linha ${index + 2}: informe insumo_nome OU insumo_especial_nome.`);
                    }
                    if (insumoNome && insumoEspecialNome) {
                        throw new Error(`Linha ${index + 2}: preencha apenas um entre insumo_nome e insumo_especial_nome.`);
                    }

                    let insumoId: number | null = null;
                    let insumoEspecialId: number | null = null;
                    if (insumoNome) {
                        const found = insumoMap.get(norm(insumoNome));
                        if (typeof found !== 'number') throw new Error(`Linha ${index + 2}: Insumo "${insumoNome}" não encontrado.`);
                        insumoId = found;
                    } else {
                        const found = insumoEspecialMap.get(norm(insumoEspecialNome));
                        if (typeof found !== 'number') throw new Error(`Linha ${index + 2}: Insumo Especial "${insumoEspecialNome}" não encontrado.`);
                        insumoEspecialId = found;
                    }

                    // Quantidade: geral OU (adulto + infantil)
                    const parseNum = (v: any): number | null => {
                        if (v === undefined || v === null || String(v).trim() === '') return null;
                        const n = parseFloat(String(v).replace(',', '.'));
                        return isNaN(n) ? null : n;
                    };
                    const qGeral = parseNum(getCell(row, 'quantidade'));
                    const qAdulto = parseNum(getCell(row, 'quantidade_adulto'));
                    const qInfantil = parseNum(getCell(row, 'quantidade_infantil'));

                    let payload: any = { produto_base_id: produtoId, insumo_id: insumoId, insumo_especial_id: insumoEspecialId };
                    // Regra: a coluna 'quantidade' (geral) e 'quantidade_adulto'
                    // recebem o mesmo valor. Se o arquivo trouxer adulto, ele
                    // e copiado para geral. Se trouxer apenas geral, ele e
                    // copiado para adulto. quantidade_infantil so e gravado
                    // se vier explicitamente preenchido.
                    const quantidadeFinal = qAdulto !== null && qAdulto > 0
                        ? qAdulto
                        : (qGeral !== null && qGeral > 0 ? qGeral : null);

                    if (quantidadeFinal === null) {
                        throw new Error(`Linha ${index + 2}: informe quantidade ou quantidade_adulto.`);
                    }
                    payload.quantidade = quantidadeFinal;
                    payload.quantidade_adulto = quantidadeFinal;
                    payload.quantidade_infantil = qInfantil !== null && qInfantil > 0 ? qInfantil : null;

                    uniqueProductIdsToUpdate.add(produtoId);
                    return payload;
                });
                
                if (uniqueProductIdsToUpdate.size > 0) {
                    const { error: deleteError } = await supabase
                        .from('fichas_tecnicas')
                        .delete()
                        .in('produto_base_id', Array.from(uniqueProductIdsToUpdate));
                    if (deleteError) throw new Error(`Falha ao limpar fichas antigas: ${deleteError.message}`);
                }

            } else {
                 dataToInsert = parsedData.map((row, index) => {
                    try {
                        switch (importType) {
                            case 'insumos': {
                                const custo = parseFloat(row.custo_unitario);
                                if (!row.nome || !row.unidade_medida || isNaN(custo)) throw new Error(`Linha ${index + 2}: Dados inválidos.`);
                                return { nome: row.nome, unidade_medida: row.unidade_medida, custo_unitario: custo };
                            }
                            case 'produtos': {
                                if (!row.nome) {
                                    throw new Error(`Linha ${index + 2}: Nome do produto é obrigatório.`);
                                }
                            
                                const precoRaw = row.preco_venda_manual;
                                let precoFinal: number | null = null;
                            
                                if (precoRaw && String(precoRaw).trim()) {
                                    const parsedPreco = parseFloat(precoRaw);
                                    if (isNaN(parsedPreco)) {
                                        throw new Error(`Linha ${index + 2}: Preço de venda manual inválido.`);
                                    }
                                    precoFinal = parsedPreco;
                                }
                            
                                return { 
                                    nome: row.nome, 
                                    preco_venda_manual: precoFinal 
                                };
                            }
                            case 'adicionais': {
                                 const custo = parseFloat(row.custo_adicional);
                                 const precoRaw = row.preco_venda;
                                 let precoFinal: number | null = null;
                                 
                                 if (precoRaw && String(precoRaw).trim()) {
                                     const parsedPreco = parseFloat(precoRaw);
                                     if (isNaN(parsedPreco)) {
                                         throw new Error(`Linha ${index + 2}: Preço de venda inválido.`);
                                     }
                                     precoFinal = parsedPreco;
                                 }
                             
                                 if (!row.tipo_adicional || !row.nome_opcao || isNaN(custo)) {
                                     throw new Error(`Linha ${index + 2}: Dados obrigatórios (tipo, opção, custo) estão faltando ou são inválidos.`);
                                 }
                                 
                                 return { 
                                     tipo_adicional: row.tipo_adicional, 
                                     nome_opcao: row.nome_opcao, 
                                     custo_adicional: custo, 
                                     preco_venda: precoFinal 
                                 };
                            }
                            case 'vendedores': {
                                if (!row.nome) throw new Error(`Linha ${index + 2}: Nome do vendedor é obrigatório.`);
                                return { nome: row.nome };
                            }
                            default:
                                throw new Error("Tipo de importação desconhecido.");
                        }
                    } catch (e: any) {
                        throw new Error(e.message);
                    }
                });
            }


            if (dataToInsert.length === 0) {
                 throw new Error("Nenhum dado válido para importar foi encontrado no arquivo.");
            }

            const tableName = importType === 'produtos' ? 'produtos_base' : importType;
            const { error } = await supabase.from(tableName).insert(dataToInsert);

            if (error) throw error;
            
            if (importType === 'fichas_tecnicas') {
                // Recalculate costs for all affected products
                await Promise.all(Array.from(uniqueProductIdsToUpdate).map(id => recalculateProdutoCost(id)));
            }

            showNotification(`${dataToInsert.length} ${importType === 'fichas_tecnicas' ? 'registros' : 'itens'} importados com sucesso!`, 'success');
            await fetchData();
            onClose();

        } catch (error: any) {
            showNotification(`Falha na importação: ${error.message}`, 'danger');
        } finally {
            setLoading(false);
            setFile(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-60 flex justify-center items-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-slate-800">Importar Dados</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">1. Selecione o tipo de dado:</label>
                        <select
                            value={importType}
                            onChange={(e) => setImportType(e.target.value as ImportType)}
                            className="w-full p-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="insumos">Insumos</option>
                            <option value="produtos">Produtos Base</option>
                            <option value="adicionais">Adicionais</option>
                            <option value="vendedores">Vendedores</option>
                            <option value="fichas_tecnicas">Fichas Técnicas</option>
                        </select>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-700 mb-2">2. Baixe o modelo CSV e preencha com seus dados:</p>
                        <button onClick={() => downloadCSVTemplate(importType)} className="flex items-center text-sm font-medium text-primary-600 hover:text-primary-800">
                            <FileDown size={16} className="mr-2" />
                            Baixar modelo {importType}.csv
                        </button>
                    </div>
                     <div>
                        <p className="text-sm font-medium text-slate-700 mb-2">3. Faça o upload do arquivo:</p>
                        <label htmlFor="csv-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-8 h-8 mb-3 text-slate-500" />
                                {file ? (
                                    <p className="font-semibold text-primary-600">{file.name}</p>
                                ) : (
                                    <>
                                        <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Clique para enviar</span> ou arraste e solte</p>
                                        <p className="text-xs text-slate-500">Arquivo CSV ou XLSX</p>
                                    </>
                                )}
                            </div>
                            <input id="csv-upload" type="file" className="hidden" accept=".csv, .xlsx" onChange={handleFileChange} />
                        </label>
                     </div>
                </div>
                <div className="bg-slate-50 p-4 border-t flex justify-end space-x-3">
                     <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
                     <button onClick={handleImport} disabled={!file || loading} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:bg-slate-400 min-w-[120px]">
                        {loading ? <Loader2 className="animate-spin" size={18} /> : 'Importar'}
                     </button>
                </div>
            </div>
        </div>
    );
};

export default ImportModal;