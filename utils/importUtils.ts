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
    const csvContent = "data:text/csv;charset=utf-8," 
        + template.headers.join(';') + '\n'
        + template.example;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `modelo_${type}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const parseCSV = <T>(file: File): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) {
                return reject(new Error("O arquivo está vazio."));
            }

            const lines = text.trim().split(/\r\n|\n/);
            if (lines.length < 1) {
                return resolve([]);
            }

            // Detect separator to handle both comma (,) and semicolon (;)
            const separator = lines[0].includes(';') ? ';' : ',';
            
            const headers = lines[0].split(separator).map(h => h.trim());
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
        reader.readAsText(file, 'UTF-8');
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
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json<T>(worksheet);
                resolve(json);
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