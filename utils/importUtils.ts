import * as XLSX from 'xlsx';

export const templates: Record<string, { headers: string[], example: string }> = {
    insumos: {
        headers: ['nome', 'unidade_medida', 'custo_unitario'],
        example: 'Linha de Poliéster;Cone;15.50'
    },
    produtos: {
        headers: ['nome', 'preco_venda_manual'],
        example: 'Camisa Polo Piquet;75.90'
    },
    adicionais: {
        headers: ['tipo_adicional', 'nome_opcao', 'custo_adicional', 'preco_venda'],
        example: 'Bordado;Peito Esquerdo;3.50;12.00'
    },
    vendedores: {
        headers: ['nome'],
        example: 'João da Silva'
    },
    fichas_tecnicas: {
        headers: ['produto_nome', 'insumo_nome', 'quantidade'],
        example: 'Camisa Polo Piquet;Malha Piquet;1.5'
    }
};

export const downloadCSVTemplate = (type: keyof typeof templates) => {
    const template = templates[type];
    if (!template) return;

    // Using semicolon as a separator for better Excel compatibility in some regions.
    // BOM UTF-8 garante que o Excel abra o arquivo em UTF-8 (e preserve ç/acentos)
    // em vez de cair no encoding ANSI/Windows-1252 padrão do Office em pt-BR.
    const csvBody = template.headers.join(';') + '\n' + template.example;
    const blob = new Blob(['\uFEFF' + csvBody], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `modelo_${type}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// Decodifica um ArrayBuffer tentando UTF-8 primeiro e, se detectar
// mojibake (caractere de substituição ou sequências típicas de ANSI
// lido como UTF-8), cai para windows-1252. Resolve o caso do Excel
// salvar CSV em pt-BR no encoding ANSI padrão.
const decodeCsvBuffer = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    try {
        const strict = new TextDecoder('utf-8', { fatal: true });
        return strict.decode(bytes);
    } catch {
        // Bytes invalidos em UTF-8 -> provavelmente Windows-1252
        return new TextDecoder('windows-1252').decode(bytes);
    }
};

export const parseCSV = <T>(file: File): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const buffer = event.target?.result as ArrayBuffer;
            if (!buffer) {
                return reject(new Error("O arquivo está vazio."));
            }

            // Remove BOM UTF-8 se presente (Excel costuma adicionar)
            let text = decodeCsvBuffer(buffer);
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

            const lines = text.trim().split(/\r\n|\n/);
            if (lines.length < 1) {
                return resolve([]);
            }

            // Detect separator to handle both comma (,) and semicolon (;)
            const separator = lines[0].includes(';') ? ';' : ',';

            const headers = lines[0].split(separator).map(h => h.trim().replace(/^\uFEFF/, ''));
            const data: T[] = [];

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue; // Skip empty lines

                const values = lines[i].split(separator);
                const obj: any = {};

                for (let j = 0; j < headers.length; j++) {
                    obj[headers[j]] = values[j]?.trim() || '';
                }
                data.push(obj);
            }
            resolve(data);
        };
        reader.onerror = () => {
            reject(new Error("Falha ao ler o arquivo."));
        };
        reader.readAsArrayBuffer(file);
    });
};

export const parseXLSX = <T>(file: File): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target?.result;
                if (!data) {
                    return reject(new Error("O arquivo está vazio."));
                }
                // codepage 65001 = UTF-8. Garante que strings com ç/acentos
                // em arquivos XLSX mais antigos sejam interpretadas corretamente.
                const workbook = XLSX.read(data, { type: 'array', codepage: 65001 });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json<T>(worksheet, { defval: '', raw: false });
                // Normaliza cabeçalhos: trim + remove BOM residual caso o arquivo
                // venha de um CSV convertido pelo Excel.
                const cleaned = (json as any[]).map(row => {
                    const out: any = {};
                    for (const k of Object.keys(row)) {
                        const key = String(k).trim().replace(/^\uFEFF/, '');
                        const v = row[k];
                        out[key] = typeof v === 'string' ? v.trim() : v;
                    }
                    return out;
                });
                resolve(cleaned as T[]);
            } catch (e) {
                console.error("XLSX parsing error:", e);
                reject(new Error("Falha ao processar o arquivo XLSX. Verifique se o formato está correto."));
            }
        };
        reader.onerror = () => {
            reject(new Error("Falha ao ler o arquivo."));
        };
        reader.readAsArrayBuffer(file);
    });
};