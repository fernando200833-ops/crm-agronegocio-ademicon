import React, { useState, useMemo, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import * as XLSX from 'xlsx';
import { 
  Users, 
  Kanban, 
  CheckSquare, 
  FileText, 
  TrendingUp, 
  Search, 
  Filter, 
  Phone, 
  MessageCircle, 
  ExternalLink, 
  Calendar, 
  AlertCircle,
  Plus,
  CheckCircle2,
  Clock,
  ChevronRight,
  ShieldAlert,
  Building2,
  MapPin,
  Tractor,
  Download,
  Upload,
  Calculator,
  UserCheck,
  Percent,
  Copy,
  Printer,
  Bell,
  Send,
  Eye,
  SlidersHorizontal,
  BookmarkCheck,
  BarChart3,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'contacts' | 'kanban' | 'tasks' | 'templates' | 'team' | 'reminders'>('dashboard');
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  
  // Modo de visualização de carteira (Simulação de consultor logado / Carteira restrita)
  const [activeRepView, setActiveRepView] = useState<string>('all'); // 'all' ou ID do vendedor

  // Filtros de contatos
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [tempFilter, setTempFilter] = useState('all');

  // Seleção múltipla para atribuição em lote
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkRepId, setBulkRepId] = useState<string>('none');

  // Calculadora de consórcio
  const [simCredit, setSimCredit] = useState<number>(450000);
  const [adminFee, setAdminFee] = useState<number>(16);
  const [proposalTitle, setProposalTitle] = useState('Estudo para Renovação de Frota 2026/2027');
  const [proposalNotes, setProposalNotes] = useState('Cenários comparativos apresentados com foco em redução de custo financeiro perante Finame/CPR.');

  // Modal de Importação de Planilhas
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Queries
  const statsQuery = trpc.crm.stats.useQuery({
    viewRepId: activeRepView !== 'all' ? parseInt(activeRepView, 10) : undefined,
  });
  const repsQuery = trpc.crm.listReps.useQuery();
  const reminderSettingsQuery = trpc.crm.getReminderSettings.useQuery();
  const contactsQuery = trpc.crm.listContacts.useQuery({
    search: search || undefined,
    state: stateFilter !== 'all' ? stateFilter : undefined,
    pipelineStage: stageFilter !== 'all' ? stageFilter : undefined,
    temperature: tempFilter !== 'all' ? tempFilter : undefined,
    assignedRepId: activeRepView !== 'all' ? parseInt(activeRepView, 10) : undefined,
  });
  const tasksQuery = trpc.crm.listTasks.useQuery();
  const templatesQuery = trpc.crm.listTemplates.useQuery();
  const detailQuery = trpc.crm.getContact.useQuery(
    { id: selectedContactId! },
    { enabled: !!selectedContactId }
  );
  const scenarioQuery = trpc.crm.calculateScenarios.useQuery({
    creditValue: simCredit,
    adminFeePercent: adminFee,
  });

  // Mutations
  const utils = trpc.useUtils();
  const updateStageMutation = trpc.crm.updateContactStage.useMutation({
    onSuccess: () => {
      toast.success('Contato atualizado');
      utils.crm.invalidate();
    }
  });
  const assignRepMutation = trpc.crm.assignRep.useMutation({
    onSuccess: () => {
      toast.success('Vendedor atribuído com sucesso');
      utils.crm.invalidate();
    }
  });
  const bulkAssignMutation = trpc.crm.bulkAssign.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} contatos atribuídos com sucesso!`);
      setSelectedIds([]);
      utils.crm.invalidate();
    }
  });
  const addInteractionMutation = trpc.crm.addInteraction.useMutation({
    onSuccess: () => {
      toast.success('Interação registrada com sucesso');
      utils.crm.invalidate();
      setInteractionText('');
      setInteractionNext('');
    }
  });
  const addTaskMutation = trpc.crm.addTask.useMutation({
    onSuccess: () => {
      toast.success('Tarefa criada com sucesso');
      utils.crm.invalidate();
      setTaskTitle('');
    }
  });
  const toggleTaskMutation = trpc.crm.toggleTask.useMutation({
    onSuccess: () => {
      utils.crm.invalidate();
    }
  });
  const createRepMutation = trpc.crm.createRep.useMutation({
    onSuccess: () => {
      toast.success('Novo consultor cadastrado!');
      setNewRepName('');
      setNewRepEmail('');
      setNewRepPhone('');
      utils.crm.invalidate();
    }
  });
  const updateRemindersMutation = trpc.crm.updateReminderSettings.useMutation({
    onSuccess: () => {
      toast.success('Configurações de lembretes salvas!');
      utils.crm.invalidate();
    }
  });
  const testTriggerMutation = trpc.crm.testTriggerReminders.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Disparo realizado com sucesso! ${data.count || 0} tarefas notificadas.`);
      utils.crm.invalidate();
    }
  });
  const importContactsMutation = trpc.crm.importContacts.useMutation({
    onSuccess: (data) => {
      toast.success(`Importação concluída! ${data.inserted} novos contatos cadastrados.`);
      setIsImportModalOpen(false);
      utils.crm.invalidate();
    },
    onError: (err) => {
      toast.error(`Falha na importação: ${err.message}`);
    }
  });
  const saveProposalMutation = trpc.crm.saveProposal.useMutation({
    onSuccess: () => {
      toast.success('Proposta salva com sucesso no histórico deste contato!');
      utils.crm.invalidate();
    }
  });

  // Form states
  const [interactionChannel, setInteractionChannel] = useState<'whatsapp' | 'ligacao' | 'reuniao_presencial' | 'reuniao_online' | 'email'>('whatsapp');
  const [interactionText, setInteractionText] = useState('');
  const [interactionNext, setInteractionNext] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDays, setTaskDays] = useState('2');
  const [newRepName, setNewRepName] = useState('');
  const [newRepEmail, setNewRepEmail] = useState('');
  const [newRepPhone, setNewRepPhone] = useState('');

  // Estados de lembrete
  const [webhookInput, setWebhookInput] = useState('');
  const [emailInput, setEmailInput] = useState('');

  const selectedContact = detailQuery.data?.contact;

  const stageLabels: Record<string, string> = {
    novo: 'Novo Lead',
    em_qualificacao: 'Em Qualificação',
    diagnostico_feito: 'Diagnóstico Realizado',
    proposta_enviada: 'Proposta Enviada',
    negociacao: 'Em Negociação',
    fechado: 'Venda Concluída',
    nao_avancou: 'Não Avançou',
  };

  const stageColors: Record<string, string> = {
    novo: 'bg-stone-200 text-stone-800',
    em_qualificacao: 'bg-blue-100 text-blue-800',
    diagnostico_feito: 'bg-amber-100 text-amber-800',
    proposta_enviada: 'bg-purple-100 text-purple-800',
    negociacao: 'bg-orange-100 text-orange-800',
    fechado: 'bg-emerald-100 text-emerald-800',
    nao_avancou: 'bg-rose-100 text-rose-800',
  };

  const handleWhatsAppClick = (phone: string, org: string, city: string, asset?: string | null) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = `Bom dia. Sou consultor autorizado da Ademicon na região de ${city}. Vi que a ${org} atua no agronegócio. Trabalho com planejamento para aquisição de máquinas, caminhões e equipamentos. Posso fazer duas perguntas rápidas para saber se existe algum investimento planejado para a próxima safra?`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Exportar lista filtrada para CSV compatível com Excel
  const handleExportCSV = () => {
    if (!contactsQuery.data || contactsQuery.data.length === 0) {
      toast.error('Nenhum contato encontrado para exportar');
      return;
    }

    const headers = ['ID', 'Estado', 'Municipio', 'Organizacao', 'Segmento', 'Atividade', 'Telefone', 'Interesse', 'Etapa', 'Consultor_Atribuido'];
    const rows = contactsQuery.data.map(c => {
      const rep = repsQuery.data?.find(r => r.id === c.assignedRepId);
      return [
        c.id,
        `"${c.state}"`,
        `"${c.city}"`,
        `"${c.organization.replace(/"/g, '""')}"`,
        `"${c.segment}"`,
        `"${c.activity.replace(/"/g, '""')}"`,
        `"${c.formattedPhone}"`,
        `"${c.interestAsset || ''}"`,
        `"${stageLabels[c.pipelineStage] || c.pipelineStage}"`,
        `"${rep ? rep.name : 'Nenhum'}"`
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `contatos_agronegocio_ademicon_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Relatório CSV baixado com sucesso!');
  };

  // Processar upload de arquivo XLSX/CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (data.length === 0) {
          toast.error('A planilha selecionada está vazia.');
          setImporting(false);
          return;
        }

        // Mapear campos flexíveis da planilha
        const formatted = data.map((row) => {
          const state = row['Estado'] || row['UF'] || row['estado'] || 'Minas Gerais';
          const city = row['Municipio'] || row['Município'] || row['Cidade'] || row['cidade'] || 'Região Agro';
          const organization = row['Organizacao'] || row['Organização'] || row['Empresa'] || row['Fazenda'] || row['Nome'] || 'Produtor Rural';
          const segment = row['Segmento'] || row['Tipo'] || row['Ramo'] || 'Produção Agrícola';
          const activity = row['Atividade'] || row['Culturas'] || row['Descricao'] || segment;
          const phone = String(row['Telefone'] || row['Celular'] || row['WhatsApp'] || row['Contato'] || '(00) 00000-0000');
          const interestAsset = row['Interesse'] || row['Bem'] || 'Tratores e Implementos';
          const address = row['Endereco'] || row['Endereço'] || `${city} - ${state}`;
          const sourceUrl = row['Fonte'] || row['Link'] || 'https://ademicon.com.br';
          const verificationNote = row['Nota'] || 'Contato importado via planilha cadastrada pelo usuário';

          return {
            state: String(state).trim(),
            city: String(city).trim(),
            organization: String(organization).trim(),
            segment: String(segment).trim(),
            activity: String(activity).trim(),
            phone: phone.trim(),
            formattedPhone: phone.trim(),
            address: String(address).trim(),
            channelType: 'Planilha Importada',
            sourceUrl: String(sourceUrl).trim(),
            verificationNote: String(verificationNote).trim(),
            interestAsset: String(interestAsset).trim(),
          };
        });

        importContactsMutation.mutate({ items: formatted });
      } catch (err: any) {
        toast.error(`Erro ao ler o arquivo: ${err.message}`);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Salvar a cotação gerada no histórico da ficha
  const handleSaveCurrentProposal = () => {
    if (!selectedContact || !scenarioQuery.data) return;
    saveProposalMutation.mutate({
      contactId: selectedContact.id,
      title: proposalTitle,
      creditValue: simCredit,
      adminFeePercent: adminFee,
      reserveFundPercent: 2,
      scenarioSnapshot: JSON.stringify(scenarioQuery.data),
      notes: proposalNotes,
      createdByRepId: selectedContact.assignedRepId || undefined,
    });
  };

  // Copiar simulação dos 3 cenários formatada para enviar no WhatsApp
  const handleCopySimulation = () => {
    if (!scenarioQuery.data) return;
    const s = scenarioQuery.data;
    const formatMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const text = `*Planejamento Financeiro de Aquisição — Ademicon Agro*\n\n` +
      `*Objetivo de Crédito:* ${formatMoney(s.creditValue)}\n\n` +
      `*${s.scenarioA.title}*\n• Prazo: ${s.scenarioA.termMonths} meses\n• Parcela estimada: ${formatMoney(s.scenarioA.monthlyInstallment)}\n• Ideal para planejamento longo com menor impacto no caixa.\n\n` +
      `*${s.scenarioB.title}*\n• Prazo: ${s.scenarioB.termMonths} meses\n• Parcela estimada: ${formatMoney(s.scenarioB.monthlyInstallment)}\n• Cenário equilibrado para safras médias.\n\n` +
      `*${s.scenarioC.title}*\n• Prazo: ${s.scenarioC.termMonths} meses\n• Parcela estimada: ${formatMoney(s.scenarioC.monthlyInstallment)}\n• Lance referencial sugerido (${s.scenarioC.suggestedBidPercent}%): ${formatMoney(s.scenarioC.suggestedBidValue!)}\n\n` +
      `_Obs: Valores orientativos. A contemplação depende de sorteio ou lance conforme as regras oficiais da administradora. Não há data garantida._`;

    navigator.clipboard.writeText(text);
    toast.success('Simulação de 3 cenários copiada para a área de transferência!');
  };

  const activeRep = repsQuery.data?.find(r => r.id.toString() === activeRepView);

  return (
    <div className="flex h-screen bg-[#F5F2EB] text-[#1A3643]">
      {/* Sidebar de Navegação */}
      <aside className="w-64 bg-[#1B4D3E] text-[#F5F2EB] flex flex-col justify-between p-4 border-r border-[#1B4D3E]/20">
        <div>
          <div className="flex items-center gap-3 px-2 py-4 mb-2 border-b border-[#88B04B]/30">
            <div className="w-10 h-10 rounded-lg bg-[#88B04B] flex items-center justify-center text-[#1B4D3E] font-bold text-xl">
              <Tractor className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Ademicon Agro</h1>
              <p className="text-xs text-[#88B04B]">CRM de Prospecção</p>
            </div>
          </div>

          {/* Seletor de Perfil / Carteira Restrita */}
          <div className="mb-4 bg-white/10 p-2.5 rounded-lg border border-white/10">
            <label className="text-[11px] font-semibold text-[#88B04B] uppercase tracking-wider block mb-1">
              Visualização de Carteira
            </label>
            <Select value={activeRepView} onValueChange={setActiveRepView}>
              <SelectTrigger className="w-full bg-[#1B4D3E] text-white border-white/20 text-xs h-8">
                <SelectValue placeholder="Modo da visão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visão Geral (Gestor / Todos)</SelectItem>
                {repsQuery.data?.map(r => (
                  <SelectItem key={r.id} value={r.id.toString()}>
                    Carteira: {r.name.split(' ')[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeRep && (
              <p className="text-[10px] text-white/70 mt-1 italic">
                Modo restrito: exibindo apenas contatos de {activeRep.name}
              </p>
            )}
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'dashboard' ? 'bg-[#88B04B] text-[#1B4D3E]' : 'hover:bg-white/10 text-white/90'
              }`}
            >
              <TrendingUp className="w-4 h-4" /> Visão Geral & Conversão
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'contacts' ? 'bg-[#88B04B] text-[#1B4D3E]' : 'hover:bg-white/10 text-white/90'
              }`}
            >
              <Users className="w-4 h-4" /> Contatos ({contactsQuery.data?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('kanban')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'kanban' ? 'bg-[#88B04B] text-[#1B4D3E]' : 'hover:bg-white/10 text-white/90'
              }`}
            >
              <Kanban className="w-4 h-4" /> Funil de Vendas
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'team' ? 'bg-[#88B04B] text-[#1B4D3E]' : 'hover:bg-white/10 text-white/90'
              }`}
            >
              <UserCheck className="w-4 h-4" /> Equipe Comercial ({repsQuery.data?.length || 4})
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'tasks' ? 'bg-[#88B04B] text-[#1B4D3E]' : 'hover:bg-white/10 text-white/90'
              }`}
            >
              <CheckSquare className="w-4 h-4" /> Follow-ups e Tarefas
            </button>
            <button
              onClick={() => setActiveTab('reminders')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'reminders' ? 'bg-[#88B04B] text-[#1B4D3E]' : 'hover:bg-white/10 text-white/90'
              }`}
            >
              <Bell className="w-4 h-4" /> Lembretes Automáticos
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'templates' ? 'bg-[#88B04B] text-[#1B4D3E]' : 'hover:bg-white/10 text-white/90'
              }`}
            >
              <FileText className="w-4 h-4" /> Scripts & Modelos
            </button>
          </nav>
        </div>

        <div className="bg-[#1A3643] p-3 rounded-lg text-xs space-y-2 border border-white/10">
          <div className="flex items-center gap-2 text-[#88B04B] font-semibold">
            <ShieldAlert className="w-4 h-4" /> Diretriz de Vendas
          </div>
          <p className="text-white/80 leading-relaxed">
            Nunca prometa contemplação rápida ou taxa zero. O consórcio é uma ferramenta de planejamento produtivo.
          </p>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="flex-1 overflow-y-auto p-8">
        {/* TAB DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-extrabold text-[#1B4D3E]">
                  {activeRep ? `Painel de ${activeRep.name}` : 'Painel Comercial & Conversão'}
                </h2>
                <p className="text-sm text-[#5C727D]">
                  {activeRep ? 'Carteira individual filtrada para o consultor' : 'Gestão de oportunidades, taxas por cultura e prospecção de consórcio agro'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setIsImportModalOpen(true)} className="bg-[#88B04B] text-[#1B4D3E] hover:bg-[#88B04B]/90 font-bold">
                  <Upload className="w-4 h-4 mr-1.5" /> Importar Planilha (XLSX/CSV)
                </Button>
                <Button onClick={handleExportCSV} variant="outline" className="border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#1B4D3E]/10">
                  <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
                </Button>
                <Button onClick={() => setActiveTab('contacts')} className="bg-[#1B4D3E] hover:bg-[#1B4D3E]/90 text-[#F5F2EB]">
                  Iniciar Prospecção
                </Button>
              </div>
            </div>

            {/* Métricas do topo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-[#EBE6DB] border-[#D1CCC1]">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[#5C727D]">
                    {activeRep ? 'Minha Carteira' : 'Base Cadastrada'}
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold text-[#1B4D3E]">
                    {statsQuery.data?.totalContacts || 0}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-[#5C727D]">
                  {activeRep ? 'Contatos sob minha responsabilidade' : 'Minas, Goiás, Mato Grosso, SP e PR'}
                </CardContent>
              </Card>

              <Card className="bg-[#EBE6DB] border-[#D1CCC1]">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[#5C727D]">Leads em Andamento</CardDescription>
                  <CardTitle className="text-3xl font-bold text-[#1A3643]">
                    {(statsQuery.data?.stageCounts['em_qualificacao'] || 0) +
                     (statsQuery.data?.stageCounts['diagnostico_feito'] || 0) +
                     (statsQuery.data?.stageCounts['proposta_enviada'] || 0) +
                     (statsQuery.data?.stageCounts['negociacao'] || 0)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-[#5C727D]">
                  Em qualificação e propostas
                </CardContent>
              </Card>

              <Card className="bg-[#EBE6DB] border-[#D1CCC1]">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[#5C727D]">Tarefas Pendentes</CardDescription>
                  <CardTitle className="text-3xl font-bold text-[#88B04B]">{statsQuery.data?.pendingTasks || 0}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-[#5C727D]">
                  Follow-ups agendados para a semana
                </CardContent>
              </Card>

              <Card className="bg-[#EBE6DB] border-[#D1CCC1]">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[#5C727D]">Consultores na Equipe</CardDescription>
                  <CardTitle className="text-3xl font-bold text-[#1B4D3E]">{repsQuery.data?.length || 4}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-[#5C727D]">
                  Distribuição ativa de carteira
                </CardContent>
              </Card>
            </div>

            {/* TABELA DE CONVERSÃO POR SEGMENTO AGRÍCOLA (RECURSO 3) */}
            <Card className="bg-white border-[#D1CCC1]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-[#1B4D3E] flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[#88B04B]" /> Desempenho & Conversão por Cultura / Segmento
                  </CardTitle>
                  <CardDescription className="text-xs text-[#5C727D]">
                    Taxa de avanço e interesse por segmento produtivo para orientar o foco das abordagens
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#F5F2EB] text-[#1A3643]">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Cultura / Segmento</th>
                        <th className="py-2.5 px-4 font-semibold text-center">Total Contatos</th>
                        <th className="py-2.5 px-4 font-semibold text-center">Em Negociação / Proposta</th>
                        <th className="py-2.5 px-4 font-semibold text-center">Contratos Fechados</th>
                        <th className="py-2.5 px-4 font-semibold text-center">Taxa de Avanço</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D1CCC1]/50">
                      {statsQuery.data?.segmentStats.map((seg) => (
                        <tr key={seg.name} className="hover:bg-[#F5F2EB]/40">
                          <td className="py-3 px-4 font-bold text-[#1A3643] flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#88B04B]" /> {seg.name}
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-[#1B4D3E]">{seg.total}</td>
                          <td className="py-3 px-4 text-center font-semibold text-amber-700">{seg.inProgress}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-700">{seg.closed}</td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant="outline" className="bg-[#EBE6DB] text-[#1B4D3E] border-[#D1CCC1]">
                              {seg.progressRate}% qualificado
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Desempenho por Vendedor */}
            {!activeRep && (
              <Card className="bg-white border-[#D1CCC1]">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-[#1B4D3E]">Distribuição e Metas por Consultor</CardTitle>
                    <CardDescription className="text-xs text-[#5C727D]">Acompanhe carteira, leads qualificados e conversão individual</CardDescription>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setActiveTab('team')} className="text-[#1B4D3E]">
                    Gerenciar Equipe <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {statsQuery.data?.repStats.map((rep) => (
                      <div key={rep.id} className="p-3.5 rounded-lg bg-[#F5F2EB] border border-[#D1CCC1]">
                        <h4 className="font-bold text-sm text-[#1A3643]">{rep.name}</h4>
                        <p className="text-xs text-[#5C727D] mb-3">{rep.email || rep.phone || 'Consultor Comercial'}</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-[#5C727D]">Carteira Atribuída:</span>
                            <span className="font-bold text-[#1B4D3E]">{rep.assignedContacts}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#5C727D]">Em Negociação:</span>
                            <span className="font-bold text-[#88B04B]">{rep.qualifiedLeads}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#5C727D]">Fechados:</span>
                            <span className="font-bold text-emerald-700">{rep.closedDeals}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Distribuição Regional & Funil */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white border-[#D1CCC1]">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#1B4D3E]">Distribuição por Estado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {statsQuery.data?.stateCounts && Object.entries(statsQuery.data.stateCounts).map(([uf, count]) => (
                      <div key={uf} className="flex justify-between items-center text-sm py-1 border-b border-[#D1CCC1]/40">
                        <span className="font-medium text-[#1A3643]">{uf}</span>
                        <Badge variant="outline" className="bg-[#EBE6DB] text-[#1B4D3E] border-[#D1CCC1]">
                          {count} contatos
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-[#D1CCC1]">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#1B4D3E]">Funil Comercial</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stageLabels).map(([stage, label]) => {
                      const count = statsQuery.data?.stageCounts[stage] || 0;
                      return (
                        <div key={stage} className="flex justify-between items-center text-sm py-1 border-b border-[#D1CCC1]/40">
                          <span className="font-medium text-[#1A3643]">{label}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${stageColors[stage]}`}>
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* TAB CONTATOS */}
        {activeTab === 'contacts' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-3xl font-extrabold text-[#1B4D3E]">
                  {activeRep ? `Carteira de ${activeRep.name}` : 'Base do Agronegócio'}
                </h2>
                <p className="text-sm text-[#5C727D]">
                  {contactsQuery.data?.length || 0} contatos qualificados. Filtre, atribua a vendedores ou importe novos lotes.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setIsImportModalOpen(true)} className="bg-[#88B04B] text-[#1B4D3E] hover:bg-[#88B04B]/90 font-bold">
                  <Upload className="w-4 h-4 mr-2" /> Importar Planilha
                </Button>
                <Button onClick={handleExportCSV} className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90">
                  <Download className="w-4 h-4 mr-2" /> Exportar Planilha CSV
                </Button>
              </div>
            </div>

            {/* Barra de Busca e Filtros */}
            <div className="bg-white p-4 rounded-xl border border-[#D1CCC1] shadow-sm flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[220px] relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-[#5C727D]" />
                <Input
                  placeholder="Buscar fazenda, empresa, cidade ou segmento..."
                  className="pl-9 bg-[#F5F2EB]/60 border-[#D1CCC1]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-36 bg-[#F5F2EB]/60 border-[#D1CCC1]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Estados</SelectItem>
                  <SelectItem value="Minas Gerais">Minas Gerais</SelectItem>
                  <SelectItem value="Goiás">Goiás</SelectItem>
                  <SelectItem value="Mato Grosso">Mato Grosso</SelectItem>
                  <SelectItem value="São Paulo">São Paulo</SelectItem>
                  <SelectItem value="Paraná">Paraná</SelectItem>
                </SelectContent>
              </Select>

              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-40 bg-[#F5F2EB]/60 border-[#D1CCC1]">
                  <SelectValue placeholder="Etapa do Funil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Etapas</SelectItem>
                  {Object.entries(stageLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={activeRepView} onValueChange={setActiveRepView}>
                <SelectTrigger className="w-48 bg-[#F5F2EB]/60 border-[#D1CCC1]">
                  <SelectValue placeholder="Carteira do Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda a Equipe (Todos)</SelectItem>
                  {repsQuery.data?.map((r) => (
                    <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ações em Lote (Atribuição) */}
            {selectedIds.length > 0 && (
              <div className="bg-[#1B4D3E] text-white p-3 rounded-xl flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedIds.length} contato(s) selecionado(s)
                </span>
                <div className="flex items-center gap-3">
                  <Select value={bulkRepId} onValueChange={setBulkRepId}>
                    <SelectTrigger className="w-52 bg-white text-[#1A3643]">
                      <SelectValue placeholder="Atribuir a consultor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Remover Atribuição</SelectItem>
                      {repsQuery.data?.map((r) => (
                        <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="bg-[#88B04B] text-[#1B4D3E] hover:bg-[#88B04B]/90 font-bold"
                    onClick={() => {
                      const repId = bulkRepId === 'none' ? null : parseInt(bulkRepId, 10);
                      bulkAssignMutation.mutate({ contactIds: selectedIds, repId });
                    }}
                  >
                    Confirmar Atribuição
                  </Button>
                  <Button size="sm" variant="ghost" className="text-white/80" onClick={() => setSelectedIds([])}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Tabela de Contatos */}
            <div className="bg-white rounded-xl border border-[#D1CCC1] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#1B4D3E] text-[#F5F2EB]">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-[#D1CCC1]"
                          checked={contactsQuery.data?.length === selectedIds.length && selectedIds.length > 0}
                          onChange={(e) => {
                            if (e.target.checked && contactsQuery.data) {
                              setSelectedIds(contactsQuery.data.map(c => c.id));
                            } else {
                              setSelectedIds([]);
                            }
                          }}
                        />
                      </th>
                      <th className="py-3 px-4 font-semibold">Organização / Fazenda</th>
                      <th className="py-3 px-4 font-semibold">Localização</th>
                      <th className="py-3 px-4 font-semibold">Segmento & Atividade</th>
                      <th className="py-3 px-4 font-semibold">Consultor Atribuído</th>
                      <th className="py-3 px-4 font-semibold">Etapa</th>
                      <th className="py-3 px-4 font-semibold text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D1CCC1]/60">
                    {contactsQuery.data?.map((contact) => {
                      const assignedRep = repsQuery.data?.find(r => r.id === contact.assignedRepId);
                      const isSelected = selectedIds.includes(contact.id);
                      return (
                        <tr 
                          key={contact.id} 
                          className={`hover:bg-[#F5F2EB]/50 cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50/50' : ''}`}
                          onClick={() => setSelectedContactId(contact.id)}
                        >
                          <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds([...selectedIds, contact.id]);
                                else setSelectedIds(selectedIds.filter(id => id !== contact.id));
                              }}
                            />
                          </td>
                          <td className="py-3.5 px-4 font-bold text-[#1A3643]">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-[#88B04B] flex-shrink-0" />
                              <span>{contact.organization}</span>
                            </div>
                            <span className="text-xs font-normal text-[#5C727D] block pl-6">
                              {contact.formattedPhone}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[#5C727D]">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                              {contact.city} - {contact.state}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-[#1A3643] block">{contact.segment}</span>
                            <span className="text-xs text-[#5C727D] line-clamp-1">{contact.activity}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            {assignedRep ? (
                              <Badge variant="outline" className="bg-[#EBE6DB] text-[#1B4D3E] border-[#D1CCC1] flex items-center gap-1 w-fit">
                                <UserCheck className="w-3 h-3 text-[#88B04B]" /> {assignedRep.name}
                              </Badge>
                            ) : (
                              <span className="text-xs text-[#5C727D] italic">Não atribuído</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${stageColors[contact.pipelineStage]}`}>
                              {stageLabels[contact.pipelineStage]}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                              onClick={() => handleWhatsAppClick(contact.phone, contact.organization, contact.city, contact.interestAsset)}
                            >
                              <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
                            </Button>
                            <Button
                              size="sm"
                              className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90"
                              onClick={() => setSelectedContactId(contact.id)}
                            >
                              Ficha & Cotações
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB FUNIL KANBAN */}
        {activeTab === 'kanban' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-extrabold text-[#1B4D3E]">Funil de Oportunidades</h2>
                <p className="text-sm text-[#5C727D]">
                  {activeRep ? `Funil restrito à carteira de ${activeRep.name}` : 'Acompanhe o fluxo comercial da primeira abordagem até o fechamento'}
                </p>
              </div>
              <Button onClick={handleExportCSV} variant="outline" className="border-[#1B4D3E] text-[#1B4D3E]">
                <Download className="w-4 h-4 mr-1.5" /> Exportar Funil
              </Button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4">
              {Object.entries(stageLabels).map(([stageKey, stageTitle]) => {
                const stageContacts = contactsQuery.data?.filter(c => c.pipelineStage === stageKey) || [];
                return (
                  <div key={stageKey} className="w-72 flex-shrink-0 bg-[#EBE6DB]/80 rounded-xl p-3 border border-[#D1CCC1] flex flex-col max-h-[75vh]">
                    <div className="flex justify-between items-center mb-3 px-1">
                      <h3 className="font-bold text-sm text-[#1B4D3E]">{stageTitle}</h3>
                      <span className="text-xs bg-white text-[#1B4D3E] font-bold px-2 py-0.5 rounded-full border border-[#D1CCC1]">
                        {stageContacts.length}
                      </span>
                    </div>

                    <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
                      {stageContacts.map((contact) => (
                        <div
                          key={contact.id}
                          onClick={() => setSelectedContactId(contact.id)}
                          className="bg-white p-3 rounded-lg border border-[#D1CCC1] shadow-xs hover:border-[#88B04B] cursor-pointer transition-all"
                        >
                          <h4 className="font-bold text-sm text-[#1A3643] mb-1">{contact.organization}</h4>
                          <p className="text-xs text-[#5C727D] mb-2">{contact.city} - {contact.state}</p>
                          <div className="text-xs bg-[#F5F2EB] text-[#1B4D3E] p-1.5 rounded font-medium mb-2">
                            {contact.interestAsset}
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#5C727D]">{contact.formattedPhone.split(';')[0]}</span>
                            <ChevronRight className="w-4 h-4 text-[#88B04B]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB EQUIPE COMERCIAL */}
        {activeTab === 'team' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-extrabold text-[#1B4D3E]">Equipe Comercial</h2>
                <p className="text-sm text-[#5C727D]">Gerencie consultores e metas individuais de prospecção</p>
              </div>
            </div>

            {/* Cadastro de Novo Consultor */}
            <Card className="bg-white border-[#D1CCC1]">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-[#1B4D3E]">Cadastrar Novo Consultor</CardTitle>
                <CardDescription className="text-xs text-[#5C727D]">Adicione membros para distribuir lotes de contatos agrícolas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Input 
                    placeholder="Nome completo..." 
                    value={newRepName} 
                    onChange={(e) => setNewRepName(e.target.value)} 
                    className="bg-[#F5F2EB]/60 border-[#D1CCC1]"
                  />
                  <Input 
                    placeholder="E-mail profissional..." 
                    value={newRepEmail} 
                    onChange={(e) => setNewRepEmail(e.target.value)} 
                    className="bg-[#F5F2EB]/60 border-[#D1CCC1]"
                  />
                  <Input 
                    placeholder="Telefone / WhatsApp..." 
                    value={newRepPhone} 
                    onChange={(e) => setNewRepPhone(e.target.value)} 
                    className="bg-[#F5F2EB]/60 border-[#D1CCC1]"
                  />
                  <Button 
                    className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90"
                    disabled={!newRepName.trim()}
                    onClick={() => {
                      createRepMutation.mutate({
                        name: newRepName,
                        email: newRepEmail || undefined,
                        phone: newRepPhone || undefined,
                      });
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Adicionar Consultor
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Consultores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {repsQuery.data?.map((rep) => {
                const repStat = statsQuery.data?.repStats.find(s => s.id === rep.id);
                return (
                  <Card key={rep.id} className="bg-white border-[#D1CCC1] shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg font-bold text-[#1B4D3E]">{rep.name}</CardTitle>
                          <CardDescription className="text-xs text-[#5C727D]">{rep.email || 'Sem e-mail'} • {rep.phone || 'Sem telefone'}</CardDescription>
                        </div>
                        <Badge className="bg-[#88B04B] text-[#1B4D3E]">Ativo</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 bg-[#F5F2EB] p-3 rounded-lg text-center">
                        <div>
                          <span className="text-xs text-[#5C727D] block">Carteira</span>
                          <span className="text-lg font-bold text-[#1B4D3E]">{repStat?.assignedContacts || 0}</span>
                        </div>
                        <div>
                          <span className="text-xs text-[#5C727D] block">Qualificados</span>
                          <span className="text-lg font-bold text-[#88B04B]">{repStat?.qualifiedLeads || 0}</span>
                        </div>
                        <div>
                          <span className="text-xs text-[#5C727D] block">Fechados</span>
                          <span className="text-lg font-bold text-emerald-700">{repStat?.closedDeals || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB LEMBRETES AUTOMÁTICOS & WEBHOOK */}
        {activeTab === 'reminders' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div>
              <h2 className="text-3xl font-extrabold text-[#1B4D3E]">Central de Lembretes Automáticos</h2>
              <p className="text-sm text-[#5C727D]">
                Configure avisos diários das tarefas e sincronize follow-ups com ferramentas externas via Webhook.
              </p>
            </div>

            <Card className="bg-white border-[#D1CCC1]">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-[#1B4D3E] flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#88B04B]" /> Notificações & Integrações de Follow-up
                </CardTitle>
                <CardDescription className="text-xs text-[#5C727D]">
                  Dispara alertas das tarefas agendadas para o gestor e para sistemas externos (n8n, Make, Slack, Zapier).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-[#5C727D] block mb-1">E-mail do Gestor Comercial</label>
                  <Input 
                    defaultValue={reminderSettingsQuery.data?.recipientEmail || 'comercial@ademicon.agro'}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="comercial@ademicon.agro"
                    className="bg-[#F5F2EB]/60 border-[#D1CCC1]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#5C727D] block mb-1">Webhook URL (Opcional - Slack, Discord, n8n)</label>
                  <Input 
                    defaultValue={reminderSettingsQuery.data?.webhookUrl || ''}
                    onChange={(e) => setWebhookInput(e.target.value)}
                    placeholder="https://hooks.slack.com/services/... ou https://seu-webhook.com"
                    className="bg-[#F5F2EB]/60 border-[#D1CCC1]"
                  />
                  <p className="text-[11px] text-[#5C727D] mt-1">
                    Envia payload JSON completo com tarefas pendentes, nomes de produtores e prazos.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#D1CCC1]/60">
                  <div className="text-xs text-[#5C727D]">
                    Último disparo: {reminderSettingsQuery.data?.lastRunAt ? new Date(reminderSettingsQuery.data.lastRunAt).toLocaleString('pt-BR') : 'Ainda não executado'}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="border-[#1B4D3E] text-[#1B4D3E]"
                      onClick={() => {
                        updateRemindersMutation.mutate({
                          recipientEmail: emailInput || reminderSettingsQuery.data?.recipientEmail || undefined,
                          webhookUrl: webhookInput || reminderSettingsQuery.data?.webhookUrl || undefined,
                          enabled: true,
                        });
                      }}
                    >
                      Salvar Configurações
                    </Button>
                    <Button
                      className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90"
                      onClick={() => testTriggerMutation.mutate()}
                    >
                      <Send className="w-4 h-4 mr-1.5" /> Disparar Lembretes Agora
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB TAREFAS */}
        {activeTab === 'tasks' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div>
              <h2 className="text-3xl font-extrabold text-[#1B4D3E]">Follow-ups & Cadência</h2>
              <p className="text-sm text-[#5C727D]">Tarefas de acompanhamento para não perder o momento da compra</p>
            </div>

            <div className="bg-white rounded-xl border border-[#D1CCC1] p-6 shadow-sm">
              <h3 className="font-bold text-lg text-[#1B4D3E] mb-4">Minhas Atividades</h3>
              
              <div className="space-y-3">
                {tasksQuery.data?.length === 0 && (
                  <p className="text-sm text-[#5C727D] py-6 text-center">
                    Nenhuma tarefa pendente. Abra um contato para agendar uma atividade de retorno.
                  </p>
                )}

                {tasksQuery.data?.map((task) => (
                  <div 
                    key={task.id} 
                    className={`flex items-start justify-between p-3.5 rounded-lg border transition-colors ${
                      task.completed ? 'bg-[#F5F2EB]/40 border-stone-200' : 'bg-white border-[#D1CCC1]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleTaskMutation.mutate({ id: task.id, completed: !task.completed })}
                        className="mt-0.5 text-[#1B4D3E]"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-[#88B04B]" />
                        ) : (
                          <div className="w-5 h-5 rounded border-2 border-[#D1CCC1] hover:border-[#88B04B]" />
                        )}
                      </button>
                      <div>
                        <h4 className={`text-sm font-bold ${task.completed ? 'line-through text-[#5C727D]' : 'text-[#1A3643]'}`}>
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-xs text-[#5C727D] mt-0.5">{task.description}</p>
                        )}
                        <span className="text-xs text-amber-700 font-medium flex items-center gap-1 mt-1.5">
                          <Clock className="w-3.5 h-3.5" /> Prazo: {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB MODELOS & SCRIPTS */}
        {activeTab === 'templates' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div>
              <h2 className="text-3xl font-extrabold text-[#1B4D3E]">Modelos de Abordagem</h2>
              <p className="text-sm text-[#5C727D]">Scripts testados para iniciar conversas de planejamento rural com respeito</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {templatesQuery.data?.map((tmpl) => (
                <Card key={tmpl.id} className="bg-white border-[#D1CCC1] shadow-sm flex flex-col justify-between">
                  <CardHeader>
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#88B04B]">
                        {tmpl.category} • {tmpl.segment}
                      </span>
                    </div>
                    <CardTitle className="text-lg font-bold text-[#1B4D3E]">{tmpl.title}</CardTitle>
                    <CardDescription className="text-xs text-[#5C727D]">
                      {tmpl.recommendedUsage}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-[#F5F2EB] p-3.5 rounded-lg border border-[#D1CCC1]/60 text-sm text-[#1A3643] leading-relaxed italic">
                      "{tmpl.content}"
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#1B4D3E] hover:text-white"
                      onClick={() => {
                        navigator.clipboard.writeText(tmpl.content);
                        toast.success('Script copiado para a área de transferência!');
                      }}
                    >
                      Copiar Mensagem
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE IMPORTAÇÃO DE PLANILHA (RECURSO 1) */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-lg bg-white border-[#D1CCC1]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#1B4D3E] flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-[#88B04B]" /> Importar Nova Base de Contatos
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5C727D]">
              Faça upload de arquivos XLSX ou CSV com cabeçalhos como Estado, Município, Empresa/Fazenda, Segmento e Telefone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="border-2 border-dashed border-[#88B04B]/60 bg-[#F5F2EB] p-6 rounded-xl text-center space-y-3">
              <Upload className="w-8 h-8 text-[#1B4D3E] mx-auto" />
              <div>
                <p className="text-sm font-semibold text-[#1A3643]">Selecione um arquivo .xlsx ou .csv</p>
                <p className="text-xs text-[#5C727D]">Os contatos serão adicionados automaticamente à base do CRM</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90"
              >
                {importing ? 'Processando Planilha...' : 'Escolher Arquivo do Computador'}
              </Button>
            </div>

            <div className="bg-[#EBE6DB] p-3 rounded-lg text-xs space-y-1 text-[#1A3643]">
              <span className="font-bold block text-[#1B4D3E]">Colunas recomendadas na planilha:</span>
              <p>• Estado ou UF (ex: Minas Gerais)</p>
              <p>• Município ou Cidade (ex: Patos de Minas)</p>
              <p>• Empresa, Fazenda ou Organização</p>
              <p>• Segmento ou Atividade Agrícola (ex: Grãos, Café)</p>
              <p>• Telefone ou WhatsApp comercial</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DETALHES DO CONTATO (FICHA COMPLETA COM HISTÓRICO DE COTAÇÕES - RECURSO 2) */}
      <Dialog open={!!selectedContactId} onOpenChange={(open) => !open && setSelectedContactId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border-[#D1CCC1] print:m-0 print:p-4 print:max-w-none">
          {selectedContact && (
            <div className="space-y-6">
              {/* Cabeçalho Oficial Imprimível */}
              <div className="hidden print:block border-b-2 border-[#1B4D3E] pb-3 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-[#1B4D3E]">ADEMICON CONSÓRCIO E INVESTIMENTO</h2>
                    <p className="text-xs text-[#5C727D]">Estudo Financeiro de Planejamento e Renovação Agrícola</p>
                  </div>
                  <div className="text-right text-xs text-[#5C727D]">
                    Data: {new Date().toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>

              <DialogHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <DialogTitle className="text-2xl font-bold text-[#1B4D3E]">{selectedContact.organization}</DialogTitle>
                    <DialogDescription className="text-[#5C727D] flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4" /> {selectedContact.city} - {selectedContact.state} • {selectedContact.segment}
                    </DialogDescription>
                  </div>
                  <div className="flex gap-2 print:hidden">
                    <Button
                      variant="outline"
                      className="border-[#1B4D3E] text-[#1B4D3E]"
                      onClick={() => window.print()}
                    >
                      <Printer className="w-4 h-4 mr-1.5" /> Imprimir Proposta
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleWhatsAppClick(selectedContact.phone, selectedContact.organization, selectedContact.city, selectedContact.interestAsset)}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" /> Abrir WhatsApp
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              {/* Status, Atribuição e Interesse */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[#F5F2EB] p-4 rounded-xl border border-[#D1CCC1]">
                <div>
                  <label className="text-xs font-semibold text-[#5C727D] uppercase">Consultor Responsável</label>
                  <Select 
                    value={selectedContact.assignedRepId ? selectedContact.assignedRepId.toString() : 'none'} 
                    onValueChange={(val) => {
                      const repId = val === 'none' ? null : parseInt(val, 10);
                      assignRepMutation.mutate({ contactId: selectedContact.id, repId });
                    }}
                  >
                    <SelectTrigger className="mt-1 bg-white border-[#D1CCC1]">
                      <SelectValue placeholder="Atribuir..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não atribuído</SelectItem>
                      {repsQuery.data?.map(r => (
                        <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#5C727D] uppercase">Etapa do Funil</label>
                  <Select 
                    value={selectedContact.pipelineStage} 
                    onValueChange={(val: any) => updateStageMutation.mutate({ id: selectedContact.id, pipelineStage: val })}
                  >
                    <SelectTrigger className="mt-1 bg-white border-[#D1CCC1]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(stageLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#5C727D] uppercase">Temperatura</label>
                  <Select 
                    value={selectedContact.temperature} 
                    onValueChange={(val: any) => updateStageMutation.mutate({ id: selectedContact.id, pipelineStage: selectedContact.pipelineStage, temperature: val })}
                  >
                    <SelectTrigger className="mt-1 bg-white border-[#D1CCC1]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frio">Frio (Início)</SelectItem>
                      <SelectItem value="morno">Morno (Interesse)</SelectItem>
                      <SelectItem value="quente">Quente (Quer simulação)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#5C727D] uppercase">Investimento Provável</label>
                  <Input 
                    defaultValue={selectedContact.interestAsset || ''} 
                    onBlur={(e) => updateStageMutation.mutate({ id: selectedContact.id, pipelineStage: selectedContact.pipelineStage, interestAsset: e.target.value })}
                    className="mt-1 bg-white border-[#D1CCC1]"
                  />
                </div>
              </div>

              {/* SIMULADOR DE 3 CENÁRIOS DE CONSÓRCIO E HISTÓRICO DE COTAÇÕES */}
              <div className="bg-white p-5 rounded-xl border border-[#D1CCC1] space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-[#D1CCC1]/60 pb-3">
                  <div>
                    <h4 className="font-bold text-base text-[#1B4D3E] flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-[#88B04B]" /> Proposta Comercial (3 Cenários Comparativos)
                    </h4>
                    <p className="text-xs text-[#5C727D]">
                      Gere, salve e compare versões de simulações personalizadas para a propriedade
                    </p>
                  </div>
                  <div className="flex gap-2 print:hidden">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-[#88B04B] text-[#1B4D3E] hover:bg-[#88B04B]/20"
                      onClick={handleSaveCurrentProposal}
                    >
                      <BookmarkCheck className="w-3.5 h-3.5 mr-1" /> Salvar Proposta no Histórico
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#1B4D3E]/10"
                      onClick={handleCopySimulation}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copiar para WhatsApp
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
                  <div>
                    <label className="text-xs font-bold text-[#5C727D]">Título da Proposta / Safra</label>
                    <Input
                      value={proposalTitle}
                      onChange={(e) => setProposalTitle(e.target.value)}
                      placeholder="Ex: Renovação Frota Safra 26/27"
                      className="mt-1 bg-[#F5F2EB]/60 border-[#D1CCC1]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#5C727D]">Valor do Bem / Crédito (R$)</label>
                    <Input
                      type="number"
                      step={50000}
                      value={simCredit}
                      onChange={(e) => setSimCredit(Math.max(50000, Number(e.target.value)))}
                      className="mt-1 bg-[#F5F2EB]/60 border-[#D1CCC1]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#5C727D]">Taxa de Adm. Referencial Total (%)</label>
                    <Input
                      type="number"
                      value={adminFee}
                      onChange={(e) => setAdminFee(Number(e.target.value))}
                      className="mt-1 bg-[#F5F2EB]/60 border-[#D1CCC1]"
                    />
                  </div>
                </div>

                {scenarioQuery.data && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    {/* Cenário A */}
                    <div className="p-3.5 rounded-lg bg-[#F5F2EB] border border-[#D1CCC1] flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#1B4D3E]">Cenário A</span>
                        <h5 className="font-bold text-sm text-[#1A3643] mb-1">Parcela Menor</h5>
                        <p className="text-xs text-[#5C727D] mb-2">{scenarioQuery.data.scenarioA.termMonths} meses</p>
                        <div className="text-lg font-extrabold text-[#1B4D3E]">
                          {scenarioQuery.data.scenarioA.monthlyInstallment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                        </div>
                      </div>
                      <p className="text-xs text-[#5C727D] mt-2 italic">{scenarioQuery.data.scenarioA.profile}</p>
                    </div>

                    {/* Cenário B */}
                    <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-300 flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#88B04B]">Cenário B</span>
                        <h5 className="font-bold text-sm text-[#1A3643] mb-1">Equilibrado</h5>
                        <p className="text-xs text-[#5C727D] mb-2">{scenarioQuery.data.scenarioB.termMonths} meses</p>
                        <div className="text-lg font-extrabold text-[#1A3643]">
                          {scenarioQuery.data.scenarioB.monthlyInstallment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                        </div>
                      </div>
                      <p className="text-xs text-[#5C727D] mt-2 italic">{scenarioQuery.data.scenarioB.profile}</p>
                    </div>

                    {/* Cenário C */}
                    <div className="p-3.5 rounded-lg bg-[#EBE6DB] border border-[#D1CCC1] flex flex-col justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#1A3643]">Cenário C</span>
                        <h5 className="font-bold text-sm text-[#1A3643] mb-1">Antecipação por Lance</h5>
                        <p className="text-xs text-[#5C727D] mb-2">{scenarioQuery.data.scenarioC.termMonths} meses</p>
                        <div className="text-base font-bold text-[#1A3643]">
                          Lance sug.: {scenarioQuery.data.scenarioC.suggestedBidValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div className="text-sm font-semibold text-[#1B4D3E]">
                          Parcela: {scenarioQuery.data.scenarioC.monthlyInstallment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                        </div>
                      </div>
                      <p className="text-xs text-[#5C727D] mt-2 italic">{scenarioQuery.data.scenarioC.profile}</p>
                    </div>
                  </div>
                )}

                {/* HISTÓRICO DE COTAÇÕES SALVAS NESTE CONTATO (RECURSO 2) */}
                <div className="border-t border-[#D1CCC1]/60 pt-4">
                  <h5 className="font-bold text-sm text-[#1B4D3E] mb-2 flex items-center gap-1.5">
                    <BookmarkCheck className="w-4 h-4 text-[#88B04B]" /> Histórico de Propostas Emitidas
                  </h5>
                  {detailQuery.data?.proposals.length === 0 ? (
                    <p className="text-xs text-[#5C727D] italic">Nenhuma versão gravada ainda. Clique em "Salvar Proposta no Histórico" para registrar.</p>
                  ) : (
                    <div className="space-y-2">
                      {detailQuery.data?.proposals.map((prop) => (
                        <div key={prop.id} className="p-3 bg-[#F5F2EB] rounded-lg border border-[#D1CCC1] flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold text-[#1A3643] block">{prop.title}</span>
                            <span className="text-[#5C727D]">
                              Crédito: R$ {Number(prop.creditValue).toLocaleString('pt-BR')} • Taxa Adm: {prop.adminFeePercent}% • Salvo em {new Date(prop.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <Badge className="bg-[#1B4D3E] text-white">Versão Registrada</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Dados Comerciais e Verificação */}
              <div className="bg-white p-4 rounded-xl border border-[#D1CCC1] space-y-2 text-sm">
                <div><strong className="text-[#1A3643]">Telefone(s):</strong> {selectedContact.phone}</div>
                <div><strong className="text-[#1A3643]">Endereço Comercial:</strong> {selectedContact.address || 'Não informado'}</div>
                <div><strong className="text-[#1A3643]">Atividade Agrícola:</strong> {selectedContact.activity}</div>
                <div className="print:hidden">
                  <strong className="text-[#1A3643]">Fonte Pública:</strong>{' '}
                  <a href={selectedContact.sourceUrl} target="_blank" rel="noreferrer" className="text-[#1B4D3E] underline inline-flex items-center gap-1">
                    Abrir link oficial <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <div className="text-xs text-[#5C727D] pt-1">
                  <strong>Nota de Checagem:</strong> {selectedContact.verificationNote}
                </div>
              </div>

              {/* Registrar Nova Interação */}
              <div className="border-t border-[#D1CCC1] pt-4 space-y-4 print:hidden">
                <h4 className="font-bold text-[#1B4D3E] flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-[#88B04B]" /> Registrar Nova Interação
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Select value={interactionChannel} onValueChange={(val: any) => setInteractionChannel(val)}>
                    <SelectTrigger className="bg-white border-[#D1CCC1]">
                      <SelectValue placeholder="Canal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="ligacao">Ligação Telefônica</SelectItem>
                      <SelectItem value="reuniao_presencial">Reunião Presencial</SelectItem>
                      <SelectItem value="reuniao_online">Reunião Online</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="md:col-span-3">
                    <Input 
                      placeholder="Resumo do contato (ex: Explicou que colhe em abril e quer trator de 180cv)..." 
                      value={interactionText}
                      onChange={(e) => setInteractionText(e.target.value)}
                      className="bg-white border-[#D1CCC1]"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <Input 
                    placeholder="Próximo passo combinado (opcional)..." 
                    value={interactionNext}
                    onChange={(e) => setInteractionNext(e.target.value)}
                    className="max-w-md bg-white border-[#D1CCC1]"
                  />
                  <Button 
                    className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90"
                    disabled={!interactionText.trim()}
                    onClick={() => {
                      addInteractionMutation.mutate({
                        contactId: selectedContact.id,
                        channel: interactionChannel,
                        summary: interactionText,
                        nextStep: interactionNext || undefined,
                      });
                    }}
                  >
                    Salvar Interação
                  </Button>
                </div>
              </div>

              {/* Agendar Follow-up / Tarefa */}
              <div className="bg-[#EBE6DB] p-4 rounded-xl border border-[#D1CCC1] space-y-3 print:hidden">
                <h4 className="font-bold text-sm text-[#1B4D3E] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#88B04B]" /> Agendar Próximo Follow-up
                </h4>
                <div className="flex flex-wrap gap-3 items-center">
                  <Input 
                    placeholder="Motivo (ex: Ligar para apresentar simulação de 3 cenários)" 
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="flex-1 bg-white border-[#D1CCC1]"
                  />
                  <Select value={taskDays} onValueChange={setTaskDays}>
                    <SelectTrigger className="w-36 bg-white border-[#D1CCC1]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Em 1 dia</SelectItem>
                      <SelectItem value="2">Em 2 dias</SelectItem>
                      <SelectItem value="5">Em 5 dias</SelectItem>
                      <SelectItem value="10">Em 10 dias</SelectItem>
                      <SelectItem value="30">Em 30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90"
                    disabled={!taskTitle.trim()}
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + parseInt(taskDays, 10));
                      addTaskMutation.mutate({
                        contactId: selectedContact.id,
                        title: taskTitle,
                        dueDate: d,
                      });
                    }}
                  >
                    Criar Lembrete
                  </Button>
                </div>
              </div>

              {/* Histórico de Interações */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-[#1B4D3E]">Histórico deste Contato</h4>
                {detailQuery.data?.interactions.length === 0 && (
                  <p className="text-xs text-[#5C727D] italic">Nenhuma interação registrada ainda. Use o botão WhatsApp para iniciar.</p>
                )}
                {detailQuery.data?.interactions.map((int) => (
                  <div key={int.id} className="bg-[#F5F2EB] p-3 rounded-lg border border-[#D1CCC1] text-xs space-y-1">
                    <div className="flex justify-between font-semibold text-[#1A3643]">
                      <span className="capitalize">{int.channel} ({int.direction})</span>
                      <span className="text-[#5C727D] font-normal">{new Date(int.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-[#1A3643]">{int.summary}</p>
                    {int.nextStep && (
                      <p className="text-amber-800 font-medium">Próximo passo: {int.nextStep}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
