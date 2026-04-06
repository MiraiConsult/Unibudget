import React from 'react';

interface SummaryPanelProps {
  totals: {
    totalReceita: number;
    totalReceitaTabela: number;
    totalCustoProducao: number;
    totalCustosVariaveis: number;
    totalLucro: number;
  }
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({ totals }) => {
  const { totalReceita, totalReceitaTabela, totalCustoProducao, totalCustosVariaveis, totalLucro } = totals;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const lucroPercent = totalReceita > 0 ? (totalLucro / totalReceita) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-64 right-0 bg-slate-900 text-white shadow-lg border-t border-slate-700 z-20">
      <div className="max-w-full mx-auto grid grid-cols-2 md:grid-cols-5 gap-4 text-center items-center p-4">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Receita Tabela</p>
          <p className="text-xl font-bold text-slate-200">{formatCurrency(totalReceitaTabela)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Receita Praticada</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalReceita)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Custo Produção</p>
          <p className="text-xl font-bold text-danger-400">{formatCurrency(totalCustoProducao)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Custos Variáveis</p>
          <p className="text-xl font-bold text-warning-400">{formatCurrency(totalCustosVariaveis)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Lucro Estimado</p>
          <p className={`text-2xl font-extrabold ${lucroPercent >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
            {formatCurrency(totalLucro)} 
            <span className="text-base font-medium ml-1.5">({lucroPercent.toFixed(1)}%)</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SummaryPanel;