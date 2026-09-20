import React, { useState, useMemo, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
import { 
  Tractor, 
  Users, 
  Search, 
  Filter, 
  CheckSquare, 
  FileText, 
  Send, 
  PhoneCall, 
  Clock, 
  ChevronRight, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  MessageCircle,
  ShieldAlert,
  Building,
  Calendar,
  Layers,
  MapPin,
  ExternalLink,
  DollarSign,
  Download,
  UserCheck,
  UserPlus,
  Bell,
  Printer,
  Copy,
  Upload,
  History,
  BookmarkCheck,
  BarChart3,
  FileSpreadsheet,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

const chartColors = ['#1B4D3E', '#88B04B', '#D39B39', '#5C727D', '#B96A50', '#6B7F5B', '#8D6E63', '#3F7D7A'];

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'contacts' | 'kanban' | 'team' | 'tasks' | 'reminders' | 'templates' | 'audit'>('dashboard');
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [leadTypeFilter, setLeadTypeFilter] = useState('all');
  const [leadBatchFilter, setLeadBatchFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [tempFilter, setTempFilter] = useState('all');
  const [activeRepView, setActiveRepView] = useState('all'); // Carteira selecionada
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);

  // Estados da Calculadora de Propostas e Histórico
  const [simCredit, setSimCredit] = useState<number>(450000);
  const [adminFee, setAdminFee] = useState<number>(16);
  const [proposalTitle, setProposalTitle] = useState('Proposta Planejada — Trator 180cv');
  const [proposalNotes, setProposalNotes] = useState('');

  // Estados de Importação
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Queries
  const statsQuery = trpc.crm.stats.useQuery({
    viewRepId: activeRepView !== 'all' ? parseInt(activeRepView, 10) : undefined,
  });
  const repsQuery = trpc.crm.listReps.useQuery();
  const reminderSettingsQuery = trpc.crm.getReminderSettings.useQuery();
  const auditLogsQuery = trpc.crm.auditLogs.useQuery(undefined, {
    enabled: activeTab === 'audit',
  });
  const contactsQuery = trpc.crm.listContacts.useQuery({
    search: search || undefined,
    state: stateFilter !== 'all' ? stateFilter : undefined,
    pipelineStage: stageFilter !== 'all' ? stageFilter : undefined,
    temperature: tempFilter !== 'all' ? tempFilter : undefined,
    assignedRepId: activeRepView !== 'all' ? parseInt(activeRepView, 10) : undefined,
    leadType: leadTypeFilter !== 'all' ? leadTypeFilter : undefined,
    leadBatch: leadBatchFilter !== 'all' ? leadBatchFilter : undefined,
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
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.reload();
    }
  });
  const logExportMutation = trpc.crm.logExport.useMutation();
  const updateStageMutation = trpc.crm.updateContactStage.useMutation({
    onSuccess: () => {
      toast.success('Etapa do lead atualizada com sucesso!');
      utils.crm.invalidate();
    }
  });
  const assignRepMutation = trpc.crm.assignRep.useMutation({
    onSuccess: () => {
      toast.success('Consultor atribuído com sucesso!');
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
  const addInteractionMutation = trpc.crm.addInteraction.useMutation({
    onSuccess: () => {
      toast.success('Interação registrada!');
      setInteractionText('');
      setInteractionNext('');
      utils.crm.invalidate();
    }
  });
  const addTaskMutation = trpc.crm.addTask.useMutation({
    onSuccess: () => {
      toast.success('Tarefa de follow-up criada!');
      setTaskTitle('');
      utils.crm.invalidate();
    }
  });
  const toggleTaskMutation = trpc.crm.toggleTask.useMutation({
    onSuccess: () => {
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
    onSuccess: (data) => {
      toast.success(`Disparo executado! ${data.count} tarefas notificadas.`);
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
  const [twoFactorSetupSecret, setTwoFactorSetupSecret] = useState<string | null>(null);
  const [twoFactorCodeInput, setTwoFactorCodeInput] = useState('');

  const setup2faMutation = trpc.auth.setupTwoFactor.useMutation({
    onSuccess: (data) => {
      setTwoFactorSetupSecret(data.secret);
      toast.info('Chave 2FA gerada. Insira o código de 6 dígitos para confirmar.');
    }
  });
  const confirm2faMutation = trpc.auth.confirmTwoFactor.useMutation({
    onSuccess: () => {
      toast.success('Autenticação em duas etapas (2FA) ativada com sucesso!');
      setTwoFactorSetupSecret(null);
      setTwoFactorCodeInput('');
      utils.auth.me.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || 'Código 2FA inválido');
    }
  });
  const disable2faMutation = trpc.auth.disableTwoFactor.useMutation({
    onSuccess: () => {
      toast.success('2FA desativado.');
      utils.auth.me.invalidate();
    }
  });
  const meQuery = trpc.auth.me.useQuery();

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
    novo: 'bg-blue-100 text-blue-800 border-blue-200',
    em_qualificacao: 'bg-amber-100 text-amber-800 border-amber-200',
    diagnostico_feito: 'bg-purple-100 text-purple-800 border-purple-200',
    proposta_enviada: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    negociacao: 'bg-orange-100 text-orange-800 border-orange-200',
    fechado: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    nao_avancou: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const states = useMemo(() => {
    if (!contactsQuery.data) return ['all'];
    const unique = Array.from(new Set(contactsQuery.data.map(c => c.state))).filter(Boolean).sort();
    return ['all', ...unique];
  }, [contactsQuery.data]);

  const leadTypes = useMemo(() => {
    if (!contactsQuery.data) return ['all'];
    const unique = Array.from(new Set(contactsQuery.data.map(c => c.leadType || c.segment))).filter(Boolean).sort();
    return ['all', ...unique];
  }, [contactsQuery.data]);

  const leadBatches = useMemo(() => {
    return ['all', 'Expansão Nacional 2026', 'Base existente'];
  }, []);

  const stateChartData = useMemo(() => {
    return Object.entries(statsQuery.data?.stateCounts || {})
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [statsQuery.data?.stateCounts]);

  const leadTypeChartData = useMemo(() => {
    return Object.entries(statsQuery.data?.leadTypeCounts || {})
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [statsQuery.data?.leadTypeCounts]);

  const handleStateChartClick = (payload: { name?: string }) => {
    if (!payload.name) return;
    setStateFilter(payload.name);
    setLeadBatchFilter('all');
    setLeadTypeFilter('all');
    setActiveTab('contacts');
    toast.success(`Filtro aplicado: ${payload.name}`);
  };

  const handleLeadTypeChartClick = (payload: { name?: string }) => {
    if (!payload.name) return;
    setLeadTypeFilter(payload.name);
    setLeadBatchFilter('all');
    setStateFilter('all');
    setActiveTab('contacts');
    toast.success(`Filtro aplicado: ${payload.name}`);
  };

  // Iniciar conversa direta no WhatsApp
  const handleWhatsAppClick = (phone: string, org: string, city: string, asset?: string | null) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const targetItem = asset ? `aquisição e renovação de ${asset.toLowerCase()}` : 'aquisição planejada de máquinas, caminhões e implementos';
    const text = `Bom dia. Sou consultor autorizado da Ademicon na região de ${city}. Vi que a ${org} atua fortemente no agronegócio regional. Trabalho com planejamento financeiro para ${targetItem} com parcelas estruturadas e sem juros bancários abusivos. Posso fazer duas perguntas rápidas para saber se existe algum investimento previsto para as próximas safras?`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Exportar lista filtrada para CSV compatível com Excel com Marca D'água Confidencial
  const handleExportCSV = () => {
    if (!contactsQuery.data || contactsQuery.data.length === 0) {
      toast.error('Nenhum contato encontrado para exportar');
      return;
    }

    const headers = ['ID', 'Lote_Origem', 'Estado', 'Municipio', 'Organizacao', 'Tipo_Lead', 'Atividade', 'Telefone', 'Ativo_Consorcio', 'Etapa', 'Consultor_Atribuido', 'Fonte_Oficial'];
    const rows = contactsQuery.data.map(c => {
      const rep = repsQuery.data?.find(r => r.id === c.assignedRepId);
      return [
        c.id,
        `"${c.leadBatch || 'Base existente'}"`,
        `"${c.state}"`,
        `"${c.city}"`,
        `"${c.organization.replace(/"/g, '""')}"`,
        `"${c.leadType || c.segment}"`,
        `"${c.activity.replace(/"/g, '""')}"`,
        `"${c.formattedPhone}"`,
        `"${c.interestAsset || ''}"`,
        `"${stageLabels[c.pipelineStage] || c.pipelineStage}"`,
        `"${rep ? rep.name : 'Nenhum'}"`,
        `"${c.sourceUrl || ''}"`
      ].join(';');
    });

    const nowStr = new Date().toLocaleString('pt-BR');
    const userWatermark = meQuery.data ? `${meQuery.data.name || 'Consultor'} (${meQuery.data.email || 'autenticado'})` : 'Usuário Autenticado';
    const watermarkLines = [
      `# DOCUMENTO CONFIDENCIAL — ADEMICON AGRO CRM`,
      `# EXPORTADO POR: ${userWatermark} EM ${nowStr}`,
      `# REGISTROS: ${contactsQuery.data.length} | USO ESTRITAMENTE INTERNO E RASTREADO`,
      `# A REPRODUÇÃO OU COMPARTILHAMENTO NÃO AUTORIZADO É MONITORADO POR AUDITORIA`,
      ''
    ];

    const csvContent = '\uFEFF' + [...watermarkLines, headers.join(';'), ...rows].join('\r\n');
    logExportMutation.mutate({ recordCount: contactsQuery.data.length, format: 'CSV' });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `contatos_agronegocio_ademicon_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Relatório CSV confidencial baixado com marca d’água registrada em auditoria!');
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

        const items = data.map((row) => ({
          state: row['Estado'] || row['estado'] || row['UF'] || 'Minas Gerais',
          city: row['Município'] || row['Municipio'] || row['cidade'] || 'Não informada',
          organization: row['Organização'] || row['Organizacao'] || row['Nome'] || row['empresa'] || 'Produtor / Empresa',
          segment: row['Segmento'] || row['segmento'] || 'Agronegócio Geral',
          activity: row['Atividade'] || row['atividade'] || 'Produção Agropecuária',
          phone: String(row['Telefone'] || row['telefone'] || row['Contato'] || ''),
          formattedPhone: String(row['Telefone'] || row['telefone'] || row['Contato'] || ''),
          sourceUrl: row['Fonte'] || row['fonte'] || 'Importação Manual de Planilha',
          verificationNote: row['Nota'] || row['nota'] || 'Contato importado via planilha CSV/XLSX',
          interestAsset: row['Interesse'] || row['interesse'] || 'Consórcio de Máquinas / Equipamentos',
        })).filter(item => item.phone.length >= 8);

        if (items.length === 0) {
          toast.error('Nenhum telefone válido encontrado na planilha.');
          setImporting(false);
          return;
        }

        importContactsMutation.mutate({ items });
      } catch (err: any) {
        toast.error(`Erro ao processar planilha: ${err.message}`);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Salvar proposta atual no histórico permanente
  const handleSaveProposal = () => {
    if (!selectedContact || !scenarioQuery.data) return;
    const s = scenarioQuery.data;
    const snapshot = JSON.stringify({
      scenarioA: s.scenarioA,
      scenarioB: s.scenarioB,
      scenarioC: s.scenarioC,
      totalDue: s.totalDue,
    });

    saveProposalMutation.mutate({
      contactId: selectedContact.id,
      title: proposalTitle,
      creditValue: simCredit,
      adminFeePercent: adminFee,
      reserveFundPercent: 2,
      scenarioSnapshot: snapshot,
      notes: proposalNotes || undefined,
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
      <aside className="w-64 bg-[#1B4D3E] text-white flex flex-col justify-between p-4 shadow-xl z-20">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-[#88B04B] text-[#1B4D3E] flex items-center justify-center font-bold shadow-md">
              <Tractor className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-base leading-tight tracking-wide">Ademicon Agro</h1>
              <p className="text-[11px] text-[#88B04B] font-medium">CRM de Prospecção</p>
            </div>
          </div>

          {/* Seletor de Carteira Individual vs Geral */}
          <div className="bg-[#1A3643] p-2.5 rounded-lg border border-white/10 space-y-1.5">
            <label className="text-[10px] font-bold tracking-wider text-[#88B04B] uppercase block">
              Visualização de Carteira
            </label>
            <select
              value={activeRepView}
              onChange={(e) => setActiveRepView(e.target.value)}
              className="w-full bg-[#1B4D3E] text-white text-xs rounded p-1.5 border border-white/20 focus:outline-none focus:ring-1 focus:ring-[#88B04B]"
            >
              <option value="all">Visão Geral (Gestor / Todos)</option>
              {repsQuery.data?.map((rep) => (
                <option key={rep.id} value={rep.id.toString()}>
                  Carteira: {rep.name}
                </option>
              ))}
            </select>
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
              <Users className="w-4 h-4" /> Base & Leads Nacionais ({contactsQuery.data?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('kanban')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'kanban' ? 'bg-[#88B04B] text-[#1B4D3E]' : 'hover:bg-white/10 text-white/90'
              }`}
            >
              <Layers className="w-4 h-4" /> Funil de Vendas
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'team' ? 'bg-[#88B04B] text-[#1B4D3E]' : 'hover:bg-white/10 text-white/90'
              }`}
            >
              <UserCheck className="w-4 h-4" /> Equipe Comercial ({repsQuery.data?.length || 0})
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
              <Bell className="w-4 h-4" /> Lembretes & 2FA
            </button>
            {meQuery.data?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('audit')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'audit' ? 'bg-[#88B04B] text-[#1B4D3E]' : 'hover:bg-white/10 text-white/90'
                }`}
              >
                <ShieldCheck className="w-4 h-4" /> Auditoria de Acessos
              </button>
            )}
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
          <div className="pt-2 mt-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-[11px] text-[#88B04B] font-semibold truncate max-w-[120px]">
              {meQuery.data?.name || 'Sessão Ativa'}
            </span>
            <button
              onClick={() => logoutMutation.mutate()}
              className="text-white/80 hover:text-white flex items-center gap-1 text-[11px] font-semibold"
              title="Sair do CRM"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 bg-white border-b border-[#D1CCC1] flex items-center justify-between px-8 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#EBE6DB] text-[#1B4D3E]">
              {activeRep ? `Carteira: ${activeRep.name}` : `Base Nacional: 27 UFs (${contactsQuery.data?.length || 183} Leads Agro)`}
            </span>
            <span className="text-xs text-[#5C727D]">
              Perfil: <strong>{meQuery.data?.role === 'admin' ? 'Administrador Geral' : 'Consultor Comercial'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {meQuery.data?.role === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                className="border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#F5F2EB]"
                onClick={() => setIsImportModalOpen(true)}
              >
                <Upload className="w-4 h-4 mr-1.5" /> Importar Planilha (XLSX/CSV)
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="border-[#D1CCC1] text-[#1A3643]"
              onClick={handleExportCSV}
              title="Baixar lista filtrada com marca d'água confidencial e rastreamento"
            >
              <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
            </Button>

            <Button 
              size="sm" 
              className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90"
              onClick={() => setActiveTab('contacts')}
            >
              Iniciar Prospecção
            </Button>
          </div>
        </header>

        <div className="p-8 space-y-6">
          {/* TAB AUDITORIA DE ACESSOS & LOGS */}
          {activeTab === 'audit' && meQuery.data?.role === 'admin' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div>
                <h2 className="text-3xl font-extrabold text-[#1B4D3E]">Trilha de Auditoria & Segurança</h2>
                <p className="text-sm text-[#5C727D]">
                  Registro cronológico de logins, bloqueios, exportações de dados e alterações comerciais críticas com endereço IP.
                </p>
              </div>

              <Card className="bg-white border-[#D1CCC1] shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#1B4D3E] flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#88B04B]" /> Registros de Atividade Recentes
                  </CardTitle>
                  <CardDescription className="text-xs text-[#5C727D]">
                    Últimas 50 ações registradas com data, hora, usuário e endereço IP.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#F5F2EB] text-[#5C727D] uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Data / Hora</th>
                          <th className="py-2.5 px-3">Ação</th>
                          <th className="py-2.5 px-3">Entidade</th>
                          <th className="py-2.5 px-3">Usuário ID</th>
                          <th className="py-2.5 px-3">Endereço IP</th>
                          <th className="py-2.5 px-3">Detalhes / Metadados</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D1CCC1]/50">
                        {auditLogsQuery.data?.map((log) => (
                          <tr key={log.id} className="hover:bg-[#F5F2EB]/50">
                            <td className="py-2.5 px-3 font-mono text-[#5C727D]">
                              {new Date(log.createdAt).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge variant="outline" className={`font-mono ${
                                log.action.includes('failed') || log.action.includes('blocked')
                                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                                  : log.action.includes('export')
                                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              }`}>
                                {log.action}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-[#1A3643] font-medium">{log.entityType || '-'}</td>
                            <td className="py-2.5 px-3 text-[#5C727D]">{log.userId ? `#${log.userId}` : 'Sistema / Anônimo'}</td>
                            <td className="py-2.5 px-3 font-mono text-[#5C727D]">{log.ipAddress || '-'}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-[#5C727D] max-w-xs truncate" title={log.metadata || ''}>
                              {log.metadata || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div>
                <h2 className="text-3xl font-extrabold text-[#1B4D3E]">Painel Comercial & Conversão</h2>
                <p className="text-sm text-[#5C727D]">
                  {activeRep ? `Métricas exclusivas da carteira de ${activeRep.name}` : 'Gestão de oportunidades, taxas por cultura e prospecção de consórcio agro'}
                </p>
              </div>

              {/* Cards de Métricas */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <Card className="bg-white border-[#D1CCC1]">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-bold uppercase tracking-wider text-[#5C727D]">Total de Leads Agro</CardDescription>
                    <CardTitle className="text-3xl font-extrabold text-[#1B4D3E]">{statsQuery.data?.totalContacts || 183}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-[#5C727D]">27 UFs cobertas (Norte a Sul)</p>
                  </CardContent>
                </Card>

                <Card className="bg-white border-[#D1CCC1]">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-bold uppercase tracking-wider text-[#5C727D]">Expansão Nacional 2026</CardDescription>
                    <CardTitle className="text-3xl font-extrabold text-[#88B04B]">
                      {statsQuery.data?.batchCounts?.['Expansão Nacional 2026'] || 88}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-[#5C727D]">Usinas, cooperativas e pivôs novos</p>
                  </CardContent>
                </Card>

                <Card className="bg-white border-[#D1CCC1]">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-bold uppercase tracking-wider text-[#5C727D]">Base Inicial Preservada</CardDescription>
                    <CardTitle className="text-3xl font-extrabold text-[#1A3643]">
                      {statsQuery.data?.batchCounts?.['Base existente'] || 95}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-[#5C727D]">95 contatos de MG, GO, MT, SP e PR</p>
                  </CardContent>
                </Card>

                <Card className="bg-white border-[#D1CCC1]">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-bold uppercase tracking-wider text-[#5C727D]">Consultores na Equipe</CardDescription>
                    <CardTitle className="text-3xl font-extrabold text-[#1B4D3E]">{repsQuery.data?.length || 0}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-[#5C727D]">Prontos para assumir carteiras</p>
                  </CardContent>
                </Card>
              </div>

              {/* Gráficos Interativos de Distribuição */}
              <div className="space-y-6">
                <Card className="bg-white border-[#D1CCC1]">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg font-bold text-[#1B4D3E] flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-[#88B04B]" /> Distribuição por Estado (UF)
                        </CardTitle>
                        <CardDescription className="text-xs text-[#5C727D] mt-1">
                          Ranking de leads por unidade federativa cobrindo as 27 UFs. Clique em qualquer barra para abrir a listagem filtrada.
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-[#EBE6DB] text-[#1B4D3E] border-[#D1CCC1]">
                        {stateChartData.length} UFs
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full overflow-x-auto">
                      {stateChartData.length > 0 ? (
                          <BarChart
                            width={920}
                            height={520}
                            data={stateChartData}
                            layout="vertical"
                            margin={{ top: 8, right: 30, left: 8, bottom: 8 }}
                            barCategoryGap={6}
                            onClick={(data: any) => {
                              const name = data?.activePayload?.[0]?.payload?.name;
                              handleStateChartClick({ name });
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E7E2D8" />
                            <XAxis type="number" allowDecimals={false} tick={{ fill: '#5C727D', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" width={130} tick={{ fill: '#1A3643', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                            <RechartsTooltip
                              cursor={{ fill: '#F5F2EB' }}
                              contentStyle={{ borderRadius: 10, border: '1px solid #D1CCC1', backgroundColor: '#FFFFFF', color: '#1A3643' }}
                              formatter={(value: any) => [`${value} leads`, 'Quantidade']}
                            />
                            <Bar dataKey="value" name="Leads" fill="#1B4D3E" radius={[0, 6, 6, 0]} barSize={15} cursor="pointer" />
                          </BarChart>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-sm text-[#5C727D]">Carregando distribuição por UF...</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border-[#D1CCC1]">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg font-bold text-[#1B4D3E] flex items-center gap-2">
                          <Building className="w-5 h-5 text-[#88B04B]" /> Tipo de Negócio
                        </CardTitle>
                        <CardDescription className="text-xs text-[#5C727D] mt-1">
                          Distribuição por segmento de atuação agrícola e industrial. Clique em uma barra para filtrar a base.
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-[#EBE6DB] text-[#1B4D3E] border-[#D1CCC1]">
                        {leadTypeChartData.length} categorias
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full overflow-x-auto">
                      {leadTypeChartData.length > 0 ? (
                          <BarChart
                            width={920}
                            height={280}
                            data={leadTypeChartData}
                            layout="vertical"
                            margin={{ top: 8, right: 30, left: 16, bottom: 8 }}
                            barCategoryGap={8}
                            onClick={(data: any) => {
                              const name = data?.activePayload?.[0]?.payload?.name;
                              handleLeadTypeChartClick({ name });
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E7E2D8" />
                            <XAxis type="number" allowDecimals={false} tick={{ fill: '#5C727D', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={240}
                              tick={{ fill: '#1A3643', fontSize: 11, fontWeight: 600 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <RechartsTooltip
                              cursor={{ fill: '#F5F2EB' }}
                              contentStyle={{ borderRadius: 10, border: '1px solid #D1CCC1', backgroundColor: '#FFFFFF', color: '#1A3643' }}
                              formatter={(value: any) => [`${value} leads`, 'Quantidade']}
                            />
                            <Bar dataKey="value" name="Leads" fill="#88B04B" radius={[0, 6, 6, 0]} barSize={18} cursor="pointer" />
                          </BarChart>
                      ) : (
                        <div className="h-[280px] flex items-center justify-center text-sm text-[#5C727D]">Carregando tipos de negócio...</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela de Conversão por Cultura */}
              <Card className="bg-white border-[#D1CCC1]">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#1B4D3E] flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[#88B04B]" /> Desempenho & Conversão por Cultura / Segmento
                  </CardTitle>
                  <CardDescription className="text-xs text-[#5C727D]">
                    Taxa de avanço e interesse por segmento produtivo para orientar o foco das abordagens
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-[#F5F2EB] text-[#5C727D] text-xs uppercase tracking-wider">
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
            </div>
          )}

          {/* TAB CONTATOS & FICHA */}
          {activeTab === 'contacts' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-3xl font-extrabold text-[#1B4D3E]">Base & Leads Nacionais do Agronegócio</h2>
                  <p className="text-sm text-[#5C727D]">
                    {activeRep ? `Exibindo contatos atribuídos a ${activeRep.name}` : '183 empresas agrícolas, fazendas e usinas de todo o Brasil com canais comerciais e telefones verificados'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportCSV}
                    className="border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#F5F2EB]"
                  >
                    <Download className="w-4 h-4 mr-1.5" /> Exportar CSV Rastreável
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsImportModalOpen(true)}
                    className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90"
                  >
                    <Upload className="w-4 h-4 mr-1.5" /> Importar Planilha
                  </Button>
                </div>
              </div>

              {/* Barra de Filtros Avançados */}
              <div className="bg-white rounded-xl border border-[#D1CCC1] p-4 shadow-sm space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5C727D] block mb-1">Origem / Lote:</label>
                    <select
                      value={leadBatchFilter}
                      onChange={(e) => setLeadBatchFilter(e.target.value)}
                      className="w-full bg-[#F5F2EB]/60 border border-[#D1CCC1] rounded-lg text-xs p-2 text-[#1A3643] focus:outline-none"
                    >
                      <option value="all">Todos os Lotes (183 Leads)</option>
                      <option value="Expansão Nacional 2026">Expansão Nacional 2026 (88 Novos)</option>
                      <option value="Base existente">Base Inicial Preservada (95 Contatos)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5C727D] block mb-1">Estado (UF):</label>
                    <select
                      value={stateFilter}
                      onChange={(e) => setStateFilter(e.target.value)}
                      className="w-full bg-[#F5F2EB]/60 border border-[#D1CCC1] rounded-lg text-xs p-2 text-[#1A3643] focus:outline-none"
                    >
                      {states.map(s => (
                        <option key={s} value={s}>{s === 'all' ? 'Todos os Estados (27 UFs)' : s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5C727D] block mb-1">Tipo de Lead / Segmento:</label>
                    <select
                      value={leadTypeFilter}
                      onChange={(e) => setLeadTypeFilter(e.target.value)}
                      className="w-full bg-[#F5F2EB]/60 border border-[#D1CCC1] rounded-lg text-xs p-2 text-[#1A3643] focus:outline-none"
                    >
                      {leadTypes.map(lt => (
                        <option key={lt} value={lt}>{lt === 'all' ? 'Todos os Tipos' : lt}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#5C727D] block mb-1">Etapa no Funil:</label>
                    <select
                      value={stageFilter}
                      onChange={(e) => setStageFilter(e.target.value)}
                      className="w-full bg-[#F5F2EB]/60 border border-[#D1CCC1] rounded-lg text-xs p-2 text-[#1A3643] focus:outline-none"
                    >
                      <option value="all">Todas as Etapas</option>
                      {Object.entries(stageLabels).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {(stateFilter !== 'all' || leadTypeFilter !== 'all' || leadBatchFilter !== 'all' || stageFilter !== 'all' || search) && (
                  <div className="flex justify-between items-center pt-2 border-t border-[#D1CCC1]/40 text-xs">
                    <span className="text-[#5C727D]">
                      Filtros ativos: {contactsQuery.data?.length || 0} registro(s) encontrado(s)
                    </span>
                    <button
                      onClick={() => {
                        setStateFilter('all');
                        setLeadTypeFilter('all');
                        setLeadBatchFilter('all');
                        setStageFilter('all');
                        setSearch('');
                      }}
                      className="text-amber-800 hover:underline font-semibold"
                    >
                      Limpar Filtros
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-[#D1CCC1] p-4 shadow-sm space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-[#5C727D]" />
                  <Input
                    placeholder="Pesquisar por nome da empresa, fazenda, usina, município, cultura ou telefone..."
                    className="pl-9 bg-[#F5F2EB]/50 border-[#D1CCC1]"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#F5F2EB] text-[#5C727D] text-xs uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Organização / Usina / Fazenda</th>
                        <th className="py-3 px-4 font-semibold">Localização</th>
                        <th className="py-3 px-4 font-semibold">Tipo & Origem</th>
                        <th className="py-3 px-4 font-semibold">Ativo Recomendado (Consórcio)</th>
                        <th className="py-3 px-4 font-semibold">Consultor</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Ações Rápidas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D1CCC1]/50">
                      {contactsQuery.data?.map((contact) => {
                        const assignedRep = repsQuery.data?.find(r => r.id === contact.assignedRepId);
                        const isExpansion = contact.leadBatch === 'Expansão Nacional 2026';
                        return (
                          <tr key={contact.id} className="hover:bg-[#F5F2EB]/40 cursor-pointer" onClick={() => setSelectedContactId(contact.id)}>
                            <td className="py-3.5 px-4 font-bold text-[#1B4D3E]">
                              {contact.organization}
                              <span className="block font-normal text-xs text-[#5C727D] font-mono">{contact.formattedPhone}</span>
                            </td>
                            <td className="py-3.5 px-4 text-[#1A3643]">
                              <span className="font-semibold block">{contact.city}</span>
                              <span className="text-xs text-[#5C727D]">{contact.state}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge variant="outline" className="bg-[#EBE6DB] text-[#1B4D3E] border-[#D1CCC1] block w-fit mb-1 text-[11px]">
                                {contact.leadType || contact.segment}
                              </Badge>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isExpansion ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'}`}>
                                {isExpansion ? 'Expansão 2026' : 'Base Inicial'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="text-xs font-semibold text-[#1A3643] block">
                                {contact.interestAsset || 'Tratores e Implementos'}
                              </span>
                              <span className="text-[11px] text-[#5C727D] line-clamp-1">{contact.activity}</span>
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

          {/* TAB EQUIPE COMERCIAL */}
          {activeTab === 'team' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div>
                <h2 className="text-3xl font-extrabold text-[#1B4D3E]">Gestão da Equipe Comercial</h2>
                <p className="text-sm text-[#5C727D]">
                  Cadastre consultores, acompanhe metas e distribua a carteira de produtores rurais.
                </p>
              </div>

              {meQuery.data?.role === 'admin' && (
                <Card className="bg-white border-[#D1CCC1]">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-[#1B4D3E] flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-[#88B04B]" /> Cadastrar Novo Consultor
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <Input 
                        placeholder="Nome do Consultor..." 
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
              )}

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

          {/* TAB LEMBRETES & SEGURANÇA 2FA */}
          {activeTab === 'reminders' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div>
                <h2 className="text-3xl font-extrabold text-[#1B4D3E]">Central de Lembretes & Segurança</h2>
                <p className="text-sm text-[#5C727D]">
                  Configure notificações automáticas e proteja seu acesso com autenticação em duas etapas (2FA).
                </p>
              </div>

              {meQuery.data?.role === 'admin' && (
                <Card className="bg-white border-[#D1CCC1]">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-[#1B4D3E] flex items-center gap-2">
                      <Bell className="w-5 h-5 text-[#88B04B]" /> Notificações & Integrações de Follow-up
                    </CardTitle>
                    <CardDescription className="text-xs text-[#5C727D]">
                      Dispara alertas das tarefas agendadas para o gestor e para sistemas externos via Webhook.
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
                      <label className="text-xs font-bold text-[#5C727D] block mb-1">Webhook URL (Slack, Discord, n8n)</label>
                      <Input 
                        defaultValue={reminderSettingsQuery.data?.webhookUrl || ''}
                        onChange={(e) => setWebhookInput(e.target.value)}
                        placeholder="https://seu-webhook.com"
                        className="bg-[#F5F2EB]/60 border-[#D1CCC1]"
                      />
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
              )}

              {/* SEGURANÇA DA CONTA & 2FA */}
              <Card className="bg-white border-[#D1CCC1]">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-[#1B4D3E] flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-[#88B04B]" /> Segurança da Conta & Autenticação em Duas Etapas (2FA)
                  </CardTitle>
                  <CardDescription className="text-xs text-[#5C727D]">
                    Perfil atual: <strong>{meQuery.data?.role === 'admin' ? 'Administrador Geral' : 'Consultor Comercial'}</strong> ({meQuery.data?.email})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 p-3.5 bg-[#F5F2EB] rounded-lg border border-[#D1CCC1]">
                    <div>
                      <span className="font-bold text-sm text-[#1A3643] block">
                        Status do 2FA: {meQuery.data?.twoFactorEnabled ? 'Ativado (Protegido)' : 'Desativado'}
                      </span>
                      <span className="text-xs text-[#5C727D]">
                        Exige código de 6 dígitos gerado pelo aplicativo autenticador a cada login.
                      </span>
                    </div>
                    <div>
                      {meQuery.data?.twoFactorEnabled ? (
                        <Button
                          variant="outline"
                          className="border-rose-300 text-rose-700 hover:bg-rose-50"
                          onClick={() => disable2faMutation.mutate()}
                        >
                          Desativar 2FA
                        </Button>
                      ) : (
                        <Button
                          className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90"
                          onClick={() => setup2faMutation.mutate()}
                        >
                          Configurar 2FA Agora
                        </Button>
                      )}
                    </div>
                  </div>

                  {twoFactorSetupSecret && (
                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg space-y-3">
                      <h5 className="font-bold text-sm text-[#1B4D3E]">Chave de Configuração do Autenticador</h5>
                      <p className="text-xs text-[#5C727D]">
                        Adicione esta chave no seu aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou 1Password):
                      </p>
                      <div className="p-2 bg-white rounded border border-emerald-200 font-mono text-sm tracking-wider font-bold text-[#1B4D3E] select-all">
                        {twoFactorSetupSecret}
                      </div>
                      <div className="flex gap-2 items-center pt-2">
                        <Input
                          placeholder="Código de 6 dígitos"
                          maxLength={6}
                          value={twoFactorCodeInput}
                          onChange={(e) => setTwoFactorCodeInput(e.target.value.replace(/\D/g, ''))}
                          className="w-48 bg-white border-emerald-300 text-center font-mono tracking-widest text-base"
                        />
                        <Button
                          className="bg-[#1B4D3E] text-white"
                          disabled={twoFactorCodeInput.length !== 6}
                          onClick={() => confirm2faMutation.mutate({ code: twoFactorCodeInput })}
                        >
                          Ativar e Confirmar 2FA
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB TAREFAS */}
          {activeTab === 'tasks' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div>
                <h2 className="text-3xl font-extrabold text-[#1B4D3E]">Follow-ups & Cadência</h2>
                <p className="text-sm text-[#5C727D]">Tarefas de acompanhamento para não perder o momento da safra</p>
              </div>

              <div className="bg-white rounded-xl border border-[#D1CCC1] p-6 shadow-sm space-y-3">
                {tasksQuery.data?.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border border-[#D1CCC1]/60 hover:bg-[#F5F2EB]/50">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={(e) => toggleTaskMutation.mutate({ id: task.id, completed: e.target.checked })}
                        className="w-4 h-4 text-[#1B4D3E] rounded"
                      />
                      <span className={task.completed ? 'line-through text-[#5C727D]' : 'font-semibold text-[#1A3643]'}>
                        {task.title}
                      </span>
                    </div>
                    <span className="text-xs text-[#5C727D] font-mono">
                      Prazo: {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB MODELOS DE MENSAGEM */}
          {activeTab === 'templates' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div>
                <h2 className="text-3xl font-extrabold text-[#1B4D3E]">Scripts & Modelos Homologados</h2>
                <p className="text-sm text-[#5C727D]">Abordagens testadas para WhatsApp e reuniões presenciais com produtores</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templatesQuery.data?.map((tpl) => (
                  <Card key={tpl.id} className="bg-white border-[#D1CCC1]">
                    <CardHeader>
                      <Badge className="w-fit bg-[#EBE6DB] text-[#1B4D3E] border-[#D1CCC1]">{tpl.category}</Badge>
                      <CardTitle className="text-base font-bold text-[#1B4D3E]">{tpl.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-[#1A3643] bg-[#F5F2EB] p-3 rounded font-mono leading-relaxed whitespace-pre-wrap">
                        {tpl.content}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-[#1B4D3E] text-[#1B4D3E]"
                        onClick={() => {
                          navigator.clipboard.writeText(tpl.content);
                          toast.success('Script copiado!');
                        }}
                      >
                        <Copy className="w-4 h-4 mr-1.5" /> Copiar Mensagem
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL FICHA DETALHADA E CALCULADORA */}
      {selectedContactId && selectedContact && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#D1CCC1]">
            <div className="p-6 border-b border-[#D1CCC1] flex justify-between items-center bg-[#F5F2EB]">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge className="bg-[#1B4D3E] text-[#88B04B]">{selectedContact.leadType || selectedContact.segment}</Badge>
                  <Badge variant="outline" className={selectedContact.leadBatch === 'Expansão Nacional 2026' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-stone-200 text-stone-800 border-stone-300'}>
                    {selectedContact.leadBatch || 'Base existente'}
                  </Badge>
                </div>
                <h3 className="text-2xl font-bold text-[#1B4D3E]">{selectedContact.organization}</h3>
                <p className="text-xs text-[#5C727D]">{selectedContact.city} - {selectedContact.state} • {selectedContact.formattedPhone}</p>
              </div>
              <Button variant="ghost" onClick={() => setSelectedContactId(null)} className="text-[#5C727D]">
                Fechar
              </Button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Dados Cadastrais & Inteligência do Lead */}
              <div className="bg-white p-4 rounded-xl border border-[#D1CCC1] shadow-sm space-y-3">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h4 className="font-bold text-sm text-[#1B4D3E] uppercase tracking-wider">Perfil & Atividade Produtiva</h4>
                    <p className="text-xs text-[#1A3643] mt-0.5 leading-relaxed">{selectedContact.activity}</p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                    onClick={() => handleWhatsAppClick(selectedContact.phone, selectedContact.organization, selectedContact.city, selectedContact.interestAsset)}
                  >
                    <MessageCircle className="w-4 h-4 mr-1.5" /> Iniciar WhatsApp
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#D1CCC1]/50 text-xs">
                  <div>
                    <span className="font-bold text-[#5C727D] block">Ativo Recomendado p/ Consórcio:</span>
                    <span className="font-semibold text-[#1B4D3E]">{selectedContact.interestAsset || 'Tratores e Implementos'}</span>
                  </div>
                  <div>
                    <span className="font-bold text-[#5C727D] block">Endereço / Sede:</span>
                    <span className="text-[#1A3643]">{selectedContact.address || 'Município confirmado no cadastro público'}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="font-bold text-[#5C727D] block">Fonte Oficial & Nota de Verificação:</span>
                    <p className="text-[11px] text-[#5C727D] leading-relaxed mt-0.5">
                      {selectedContact.verificationNote} • <a href={selectedContact.sourceUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline font-semibold">Acessar Fonte Pública</a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Simulador 3 Cenários */}
              <div className="bg-[#F5F2EB] p-5 rounded-xl border border-[#D1CCC1] space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-base text-[#1B4D3E] flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-[#88B04B]" /> Proposta em 3 Cenários (Ademicon Agro)
                  </h4>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCopySimulation} className="border-[#1B4D3E] text-[#1B4D3E]">
                      <Copy className="w-4 h-4 mr-1" /> Copiar WhatsApp
                    </Button>
                    <Button size="sm" onClick={handleSaveProposal} className="bg-[#1B4D3E] text-white">
                      <BookmarkCheck className="w-4 h-4 mr-1" /> Salvar Proposta
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-[#5C727D] block mb-1">Crédito Desejado (R$)</label>
                    <Input
                      type="number"
                      step={50000}
                      value={simCredit}
                      onChange={(e) => setSimCredit(Number(e.target.value))}
                      className="bg-white border-[#D1CCC1]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#5C727D] block mb-1">Título da Proposta</label>
                    <Input
                      value={proposalTitle}
                      onChange={(e) => setProposalTitle(e.target.value)}
                      className="bg-white border-[#D1CCC1]"
                    />
                  </div>
                </div>

                {scenarioQuery.data && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div className="bg-white p-3 rounded-lg border border-[#D1CCC1]">
                      <span className="text-xs font-bold text-[#1B4D3E] block">{scenarioQuery.data.scenarioA.title}</span>
                      <span className="text-lg font-extrabold text-[#1B4D3E] block">
                        {scenarioQuery.data.scenarioA.monthlyInstallment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                      </span>
                      <span className="text-[11px] text-[#5C727D]">{scenarioQuery.data.scenarioA.termMonths} meses</span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-[#D1CCC1]">
                      <span className="text-xs font-bold text-[#88B04B] block">{scenarioQuery.data.scenarioB.title}</span>
                      <span className="text-lg font-extrabold text-[#1B4D3E] block">
                        {scenarioQuery.data.scenarioB.monthlyInstallment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                      </span>
                      <span className="text-[11px] text-[#5C727D]">{scenarioQuery.data.scenarioB.termMonths} meses</span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-[#D1CCC1]">
                      <span className="text-xs font-bold text-amber-700 block">{scenarioQuery.data.scenarioC.title}</span>
                      <span className="text-lg font-extrabold text-[#1B4D3E] block">
                        {scenarioQuery.data.scenarioC.monthlyInstallment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                      </span>
                      <span className="text-[11px] text-[#5C727D]">
                        Lance {scenarioQuery.data.scenarioC.suggestedBidPercent}%: {scenarioQuery.data.scenarioC.suggestedBidValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Histórico de Propostas Salvas */}
              {detailQuery.data?.proposals && detailQuery.data.proposals.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-[#1B4D3E] flex items-center gap-1.5">
                    <History className="w-4 h-4 text-[#88B04B]" /> Propostas Salvas Anteriormente ({detailQuery.data.proposals.length})
                  </h4>
                  <div className="space-y-2">
                    {detailQuery.data.proposals.map((prop) => (
                      <div key={prop.id} className="p-3 bg-[#F5F2EB]/60 rounded-lg border border-[#D1CCC1] flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-[#1A3643] block">{prop.title}</span>
                          <span className="text-[#5C727D]">
                            Crédito: {Number(prop.creditValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} • Salvo em {new Date(prop.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <Badge className="bg-[#1B4D3E] text-white">Salva</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE IMPORTAÇÃO DE PLANILHA */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#D1CCC1] space-y-5">
            <div>
              <h3 className="text-xl font-bold text-[#1B4D3E] flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#88B04B]" /> Importar Nova Base Agro (XLSX / CSV)
              </h3>
              <p className="text-xs text-[#5C727D] mt-1">
                Selecione uma planilha com contatos agrícolas. O sistema reconhece colunas como Organização, Município, Estado, Telefone e Segmento.
              </p>
            </div>

            <div className="border-2 border-dashed border-[#D1CCC1] rounded-xl p-6 text-center space-y-3 bg-[#F5F2EB]/50">
              <FileSpreadsheet className="w-10 h-10 text-[#1B4D3E] mx-auto" />
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={importing}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Button
                  type="button"
                  variant="outline"
                  disabled={importing}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-[#1B4D3E] text-[#1B4D3E]"
                >
                  {importing ? 'Processando registros...' : 'Selecionar Arquivo no Computador'}
                </Button>
              </label>
              <p className="text-[11px] text-[#5C727D]">Formatos aceitos: .xlsx, .xls ou .csv</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D1CCC1]">
              <Button variant="ghost" onClick={() => setIsImportModalOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
