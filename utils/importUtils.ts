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
        // produto_nome e quantidade sao obrigatorios.
        // informe insumo_nome OU insumo_especial_nome (um dos dois).
        // Para quantidade por tamanho, preencha quantidade_adulto e
        // quantidade_infantil e deixe quantidade em branco.
        headers: ['produto_nome', 'insumo_nome', 'insumo_especial_nome', 'quantidade', 'quantidade_adulto', 'quantidade_infantil'],
        example: 'Camisa Polo Piquê;Malha Piquet;;1.5;;'
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

// Converte qualquer valor vindo do XLSX/CSV em numero, tolerando:
// - numeros nativos (1.5)
// - strings com ponto como separador decimal ("1.5", "1234.56")
// - strings com virgula decimal e ponto como milhar ("1.234,56", "1,5")
// - strings com espaco ("R$ 1.234,56") — simbolos sao removidos
// Retorna null quando nao for possivel converter.
export const parseBRNumber = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return isNaN(value) ? null : value;
    let s = String(value).trim();
    if (!s) return null;
    // remove qualquer coisa que nao seja digito, ponto, virgula ou sinal
    s = s.replace(/[^0-9.,-]/g, '');
    if (!s) return null;

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) {
        // Formato pt-BR "1.234,56": ponto e milhar, virgula e decimal.
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
        // Apenas virgula: assume decimal "1,5" -> "1.5"
        s = s.replace(',', '.');
    }
    // Apenas ponto ou nenhum: ja esta no formato que o JS entende.
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
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
                // codepage 65001 = UTF-8 para planilhas antigas.
                // raw: true mantem numeros como numeros (evita que o XLSX
                // formate valores como "1.234,56" e perca centavos no parseFloat).
                const workbook = XLSX.read(data, { type: 'array', codepage: 65001 });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json<T>(worksheet, { defval: '', raw: true });
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