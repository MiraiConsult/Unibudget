import React,
{ useState, useEffect } from 'react';
import BudgetBuilder from './components/BudgetBuilder';
import AdminPanel from './components/AdminPanel';
import FichasPanel from './components/FichasPanel';
import SettingsPanel from './components/SettingsPanel';
import SavedBudgets from './components/SavedBudgets';
import Dashboard from './components/Dashboard';
import SummaryPanel from './components/SummaryPanel';
import InventoryPanel from './components/InventoryPanel';
import PurchasesPanel from './components/PurchasesPanel';
import PedidosExternosPanel from './components/PedidosExternosPanel';
import ToastContainer from './components/ui/Toast';
import { useData } from './contexts/DataContext';
import HelpPanel from './components/HelpPanel';
import CostAnalysisPanel from './components/CostAnalysisPanel';
import { Shirt, FileText, Wrench, Settings, BookOpen, LayoutDashboard, LogOut, LifeBuoy, Calculator, Package, ShoppingCart, DownloadCloud } from 'lucide-react';
import { supabase } from './services/supabaseClient';
import type { User } from '@supabase/supabase-js';
import type { View } from './types';


const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>(() => {
    // Check URL params to see if we should start on a specific view (e.g., from QR code)
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'consume') {
      return 'inventory';
    }
    return 'dashboard';
  });
  const [user, setUser] = useState<User | null>(null);
  const { currentOrcamento, parametros } = useData();
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
    
    // Fetch pending orders count
    const fetchPendingOrders = async () => {
      const { count } = await supabase
        .from('pedidos_externos')
        .select('*', { count: 'exact', head: true })
        .eq('processado', false);
      
      if (count !== null) setPendingOrdersCount(count);
    };
    
    fetchPendingOrders();
    
    // Set up realtime subscription for new orders
    const channel = supabase
      .channel('public:pedidos_externos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_externos' }, () => {
        fetchPendingOrders();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: <LayoutDashboard size={20} /> },
    { id: 'builder', label: 'Criar Orçamento', icon: <Shirt size={20} /> },
    { id: 'saved', label: 'Orçamentos', icon: <FileText size={20} /> },
    { id: 'pedidos_externos', label: 'Pedidos Externos', icon: <DownloadCloud size={20} />, badge: pendingOrdersCount },
    { id: 'fichas', label: 'Fichas Técnicas', icon: <BookOpen size={20} /> },
    { id: 'cost_analysis', label: 'Análise de Custos', icon: <Calculator size={20} /> },
    { id: 'inventory', label: 'Estoque', icon: <Package size={20} /> },
    { id: 'purchases', label: 'Compras', icon: <ShoppingCart size={20} /> },
    { id: 'admin', label: 'Cadastros', icon: <Wrench size={20} /> },
    { id: 'settings', label: 'Configurações', icon: <Settings size={20} /> },
  ];
  
  const bottomNavItems = [
    { id: 'help', label: 'Ajuda', icon: <LifeBuoy size={20} /> },
  ];

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />;
      case 'builder':
        return <BudgetBuilder />;
      case 'saved':
        return <SavedBudgets setActiveView={setActiveView} />;
      case 'pedidos_externos':
        return <PedidosExternosPanel setActiveView={setActiveView} />;
      case 'fichas':
        return <FichasPanel />;
      case 'inventory':
        return <InventoryPanel />;
      case 'purchases':
        return <PurchasesPanel />;
      case 'cost_analysis':
        return <CostAnalysisPanel />;
      case 'admin':
        return <AdminPanel />;
      case 'settings':
        return <SettingsPanel />;
      case 'help':
        return <HelpPanel />;
      default:
        return <Dashboard />;
    }
  };
  
  const calculateTotals = () => {
    const totalReceita = currentOrcamento.itens.reduce((sum, item) => sum + (item.precoUnitario * item.quantidade), 0);
    const totalReceitaTabela = currentOrcamento.itens.reduce((sum, item) => sum + (item.precoTabelaUnitario * item.quantidade), 0);
    const totalCustoProducao = currentOrcamento.itens.reduce((sum, item) => sum + (item.custoUnitario * item.quantidade), 0);
    
    const taxaImposto = parametros?.taxa_imposto || 0;
    const taxaComissao = parametros?.taxa_comissao || 0;
    const taxaTotal = taxaImposto + taxaComissao;

    const totalCustosVariaveis = totalReceita * taxaTotal;
    const totalLucro = totalReceita - totalCustoProducao - totalCustosVariaveis;
    return { totalReceita, totalReceitaTabela, totalCustoProducao, totalCustosVariaveis, totalLucro };
  };


  return (
    <div className="flex h-screen bg-slate-100 text-slate-800 antialiased">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-lg z-30">
        <div className="h-20 flex items-center justify-center px-6 border-b border-slate-800">
           <h1 className="text-2xl font-extrabold text-white tracking-wider">
              Uni<span className="text-primary-500">Budget</span>
            </h1>
        </div>
        <nav className="flex-1 p-4 space-y-1.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className={`w-full flex items-center px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-150 group ${
                activeView === item.id
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className={`mr-4 ${activeView === item.id ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto bg-primary-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 space-y-1.5">
           {bottomNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className={`w-full flex items-center px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-150 group ${
                activeView === item.id
                  ? 'bg-primary-600 text-white'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className={`mr-4 ${activeView === item.id ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>{item.icon}</span>
              {item.label}
            </button>
          ))}
            <div className="pt-2">
                <div className="w-full flex items-center space-x-3 p-2 bg-slate-800/50 rounded-lg">
                    <div className="bg-primary-500 text-white rounded-full h-9 w-9 flex items-center justify-center font-bold text-sm">
                        {user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left flex-1 overflow-hidden">
                        <p className="text-sm font-semibold text-white truncate">{user?.user_metadata.full_name || user?.email}</p>
                    </div>
                    <button onClick={handleLogout} title="Sair" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </div>
      </aside>
      <main className={`flex-1 overflow-y-auto relative ${activeView === 'builder' ? 'pb-[88px]' : ''}`}>
        <div className="p-6 md:p-8 animate-fade-in">
          {renderView()}
        </div>
      </main>
      <ToastContainer />
      {activeView === 'builder' && <SummaryPanel totals={calculateTotals()} />}
    </div>
  );
};

export default App;