import React, { useState } from 'react';
import { Card, CardHeader, CardTitle } from './ui/Card';
import { ChevronDown } from 'lucide-react';

interface FaqItemProps {
    question: string;
    children: React.ReactNode;
}

const FaqItem: React.FC<FaqItemProps> = ({ question, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    return (
        <div className="border-b border-slate-200">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center text-left p-5 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-expanded={isOpen}
            >
                <span className="font-semibold text-slate-800 text-md">{question}</span>
                <ChevronDown
                    className={`transform transition-transform duration-300 text-slate-500 ${isOpen ? 'rotate-180 text-primary-600' : ''}`}
                    size={20}
                />
            </button>
            {isOpen && (
                <div className="p-5 pt-0 text-slate-600 animate-fade-in">
                    {children}
                </div>
            )}
        </div>
    );
};

const HelpPanel: React.FC = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Central de Ajuda</h1>
                <p className="text-slate-500 mt-1">Encontre respostas para as perguntas mais frequentes sobre o UniBudget.</p>
            </div>
            <Card className="p-0">
                <CardHeader className="p-6">
                    <CardTitle>Perguntas Frequentes (FAQ)</CardTitle>
                </CardHeader>
                <div className="border-t border-slate-200">
                    <FaqItem question="Como funciona o cálculo de custo de um produto?">
                        <p>O custo de um produto é a soma dos custos de seus insumos, definidos na <strong>Ficha Técnica</strong>. Para cada insumo, o sistema multiplica a quantidade necessária pelo seu custo unitário cadastrado e soma todos os resultados para obter o custo de produção final do produto.</p>
                    </FaqItem>
                    <FaqItem question="O que são os Markups (P1, P2, P3)?">
                        <p>Markups são os <strong>multiplicadores</strong> que você aplica sobre o custo do produto para definir o preço de venda. P1, P2 e P3 representam três níveis de preço que você pode configurar (ex: Varejo, Atacado, Especial). Você pode definir os valores desses multiplicadores na tela de <strong>Configurações</strong>.</p>
                    </FaqItem>
                    <FaqItem question="Como faço para exportar um orçamento para PDF?">
                        <p>Na tela de <strong>Orçamentos Salvos</strong>, clique no ícone de impressora (<span className="inline-block align-middle"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg></span>) de um orçamento para ver seus detalhes. No topo da janela que abrir, você encontrará o botão "Exportar PDF", que irá gerar e baixar um arquivo com as informações da proposta.</p>
                    </FaqItem>
                    <FaqItem question="Posso carregar um orçamento salvo para editá-lo?">
                        <p>Atualmente, a funcionalidade de carregar um orçamento para edição direta ainda não foi implementada. No entanto, você pode usar a função <strong>Duplicar</strong> (ícone de cópia) para criar uma cópia exata de um orçamento existente. Esta cópia pode então ser ajustada e salva como um novo orçamento.</p>
                    </FaqItem>
                </div>
            </Card>
        </div>
    );
};

export default HelpPanel;
