import React, { useState } from 'react';
import { BarChart, DollarSign, Package, CheckCircle, LogIn } from 'lucide-react';
import AuthPage from './AuthPage';

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; children: string }> = ({ icon, title, children }) => (
  <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200/80 transform hover:-translate-y-1 transition-transform">
    <div className="flex items-center justify-center w-12 h-12 bg-primary-100 text-primary-600 rounded-full mb-4">
      {icon}
    </div>
    <h3 className="text-xl font-semibold text-slate-800 mb-2">{title}</h3>
    <p className="text-slate-500">{children}</p>
  </div>
);

const LandingPage: React.FC = () => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <div className="bg-slate-50 text-slate-800 font-sans antialiased">
      {isAuthModalOpen && <AuthPage onClose={() => setIsAuthModalOpen(false)} />}
      
      <header className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Uni<span className="text-primary-500">Budget</span>
          </h1>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="flex items-center text-sm font-semibold text-slate-700 bg-white px-4 py-2 rounded-lg shadow-sm hover:bg-slate-100 transition-colors"
          >
            <LogIn size={16} className="mr-2" />
            Entrar
          </button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 bg-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 leading-tight mb-4">
              O sistema de orçamentos <br />
              feito para <span className="text-primary-600">sua confecção</span>.
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-slate-600 mb-8">
              Transforme seus custos em propostas de venda lucrativas. UniBudget é a ferramenta CPQ (Configure, Price, Quote) que simplifica a precificação de uniformes e produtos personalizados.
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-primary-600 text-white font-bold text-lg px-8 py-4 rounded-lg shadow-lg shadow-primary-500/30 hover:bg-primary-700 transition-all"
            >
              Comece a usar gratuitamente
            </button>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900">Tudo que você precisa para precificar com precisão</h2>
              <p className="text-slate-500 mt-2">De insumos a propostas, controle total sobre seus custos e lucros.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FeatureCard icon={<Package size={24} />} title="Fichas Técnicas Detalhadas">
                Cadastre todos os seus insumos e monte fichas técnicas para cada produto, calculando o custo de produção automaticamente.
              </FeatureCard>
              <FeatureCard icon={<DollarSign size={24} />} title="Simulador de Vendas">
                Aplique markups, adicione opcionais e veja em tempo real o preço final, custo e margem de lucro de cada item.
              </FeatureCard>
              <FeatureCard icon={<BarChart size={24} />} title="Dashboards Inteligentes">
                Acompanhe suas vendas, produtos mais rentáveis e desempenho dos vendedores com gráficos e relatórios visuais.
              </FeatureCard>
            </div>
          </div>
        </section>
        
        {/* Call to Action Section */}
        <section className="bg-white py-20">
            <div className="container mx-auto px-4 text-center">
                 <h2 className="text-3xl font-bold text-slate-900 mb-4">Pronto para organizar seus orçamentos?</h2>
                 <p className="text-slate-500 text-lg mb-8 max-w-xl mx-auto">Crie sua conta e comece a transformar a gestão financeira da sua confecção hoje mesmo.</p>
                 <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="bg-primary-600 text-white font-bold text-lg px-8 py-4 rounded-lg shadow-lg shadow-primary-500/30 hover:bg-primary-700 transition-all"
                 >
                    Criar minha conta
                </button>
            </div>
        </section>
      </main>

      <footer className="py-8 border-t border-slate-200">
        <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
            <p>&copy; {new Date().getFullYear()} UniBudget. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
