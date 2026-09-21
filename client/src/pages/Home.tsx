import React, { useState, useMemo, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
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
  ShieldCheck,
  FileDown,
  UserCheck2,
  Edit3,
  RotateCcw,
  Crown,
  Award,
  Trophy,
  Mic,
  MicOff,
  Play,
  Square,
  Sparkles,
  CalendarDays,
  FileCheck,
  Flame,
  Target,
  Trash2,
  GripVertical,
  ClipboardCheck,
  Tag,
  FileSearch,
  GitMerge,
  DatabaseZap,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

const chartColors = ['#1B4D3E', '#88B04B', '#D39B39', '#5C727D', '#B96A50', '#6B7F5B', '#8D6E63', '#3F7D7A'];

const interestTagOptions = [
  'Interesse Imediato',
  'Aguardando Safra',
  'Avalia Lance Livre',
  'Em Negociação Ativa',
  'Sem Interesse no Momento',
  'Sem Retorno (+48h)',
] as const;

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'contacts' | 'kanban' | 'team' | 'tasks' | 'reminders' | 'templates' | 'audit' | 'users' | 'sanitization'>('dashboard');
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [leadTypeFilter, setLeadTypeFilter] = useState('all');
  const [leadBatchFilter, setLeadBatchFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [tempFilter, setTempFilter] = useState('all');
  const [interestTagFilter, setInterestTagFilter] = useState('all');
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [bulkInterestTag, setBulkInterestTag] = useState<string | null>('Interesse Imediato');
  const [activeRepView, setActiveRepView] = useState('all'); // Carteira selecionada
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [copiedTemplateId, setCopiedTemplateId] = useState<number | null>(null);

  // Estados para Envio Direto via WhatsApp com Variáveis
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [whatsAppTargetContactId, setWhatsAppTargetContactId] = useState<number | null>(null);
  const [whatsAppCustomName, setWhatsAppCustomName] = useState('');
  const [whatsAppCustomConsultant, setWhatsAppCustomConsultant] = useState('');
  const [whatsAppCustomPhone, setWhatsAppCustomPhone] = useState('');
  const [whatsAppCustomOrg, setWhatsAppCustomOrg] = useState('');
  const [whatsAppCustomCity, setWhatsAppCustomCity] = useState('');
  const [whatsAppCustomAsset, setWhatsAppCustomAsset] = useState('');
  const [whatsAppCustomReferrer, setWhatsAppCustomReferrer] = useState('');
  const [whatsAppActiveScript, setWhatsAppActiveScript] = useState<{ id: number; title: string; content: string } | null>(null);

  // Estados para Edição de Variação Própria do Consultor
  const [editVariantModalOpen, setEditVariantModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<{ id: number; originalTitle: string; originalContent: string } | null>(null);
  const [variantTitleInput, setVariantTitleInput] = useState('');
  const [variantContentInput, setVariantContentInput] = useState('');

  // Estados para Criação de Novo Script Homologado (Admin)
  const [newScriptModalOpen, setNewScriptModalOpen] = useState(false);
  const [newScriptTitle, setNewScriptTitle] = useState('');
  const [newScriptCategory, setNewScriptCategory] = useState('Prospecção WhatsApp');
  const [newScriptSegment, setNewScriptSegment] = useState('Geral');
  const [newScriptContent, setNewScriptContent] = useState('');
  const [newScriptUsage, setNewScriptUsage] = useState('');

  // Controle de Visualização na aba de Scripts: Lista vs Métricas de Conversão
  const [scriptSubTab, setScriptSubTab] = useState<'scripts' | 'metrics'>('scripts');
  const [metricsConsultantFilter, setMetricsConsultantFilter] = useState<'all' | string>('all');
  const [interestMatrixRepFilter, setInterestMatrixRepFilter] = useState<'all' | string>('all');
  const [interestMatrixTagFilter, setInterestMatrixTagFilter] = useState<'all' | string>('all');

  // Estados da Central de Saneamento e Mesclagem de Contatos
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [activeMergeCluster, setActiveMergeCluster] = useState<any | null>(null);
  const [primaryContactIdChoice, setPrimaryContactIdChoice] = useState<number | null>(null);
  const [mergeReasonInput, setMergeReasonInput] = useState('Mesclagem de contato duplicado na prospecção');
  const [sanitizationFilter, setSanitizationFilter] = useState<'all' | 'duplicates' | 'unassigned' | 'invalid_phone'>('all');

  // Estado do seletor rápido de script dentro da ficha do contato
  const [contactModalScriptId, setContactModalScriptId] = useState<string>('');

  // Estados para Disparos em Sequência por Cultura / Segmento
  const [isBulkSequenceModalOpen, setIsBulkSequenceModalOpen] = useState(false);
  const [bulkCultureFilter, setBulkCultureFilter] = useState<string>('Grãos e Cereais');
  const [bulkScriptId, setBulkScriptId] = useState<string>('');
  const [bulkSelectedContactIds, setBulkSelectedContactIds] = useState<number[]>([]);
  const [bulkCurrentIndex, setBulkCurrentIndex] = useState<number>(0);

  // Central de tarefas: filtros por status/carteira e fila de segundo contato vencido
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'pending' | 'overdue'>('all');
  const [taskConsultantFilter, setTaskConsultantFilter] = useState<'all' | string>('all');
  const [taskSourceFilter, setTaskSourceFilter] = useState<'all' | 'minute_only' | 'standard_only'>('all');
  const [isOverdueSequenceModalOpen, setIsOverdueSequenceModalOpen] = useState(false);
  const [overdueSequenceIndex, setOverdueSequenceIndex] = useState(0);

  // Estado do campo de observação extensa do contato (até 3.000 caracteres)
  const [contactObservationInput, setContactObservationInput] = useState('');
  const [isEditingObservation, setIsEditingObservation] = useState(false);

  // Modal de anotações rápidas para registro de resposta sem sair do painel
  const [isQuickResponseModalOpen, setIsQuickResponseModalOpen] = useState(false);
  const [quickResponseTaskId, setQuickResponseTaskId] = useState<number | null>(null);
  const [quickResponseContactName, setQuickResponseContactName] = useState('');
  const [quickResponseStatus, setQuickResponseStatus] = useState<'respondeu' | 'reuniao_agendada' | 'sem_resposta'>('respondeu');
  const [quickResponseNotes, setQuickResponseNotes] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceAudioBlob, setVoiceAudioBlob] = useState<Blob | null>(null);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);
  const [voiceDuration, setVoiceDuration] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Modal de confirmação de reunião via WhatsApp
  const [isMeetingConfirmationModalOpen, setIsMeetingConfirmationModalOpen] = useState(false);
  const [meetingDateInput, setMeetingDateInput] = useState('');
  const [meetingTimeInput, setMeetingTimeInput] = useState('14:00');
  const [meetingLocationInput, setMeetingLocationInput] = useState('Fazenda / Sede do Produtor');

  // Modal de lembrete de reunião via WhatsApp (2 horas antes)
  const [isMeetingReminderModalOpen, setIsMeetingReminderModalOpen] = useState(false);
  const [reminderTimeInput, setReminderTimeInput] = useState('14:00');
  const [reminderLocationInput, setReminderLocationInput] = useState('Fazenda / Sede do Produtor');

  // Modal de roteiro de ligação telefônica sugerida pós-48h WhatsApp
  const [isPhoneCallModalOpen, setIsPhoneCallModalOpen] = useState(false);
  const [phoneCallTaskData, setPhoneCallTaskData] = useState<any>(null);

  // Modal e Estado do Briefing Pré-Reunião gerado por IA
  const [isAiBriefingModalOpen, setIsAiBriefingModalOpen] = useState(false);
  const [aiBriefingContent, setAiBriefingContent] = useState<string | null>(null);
  const [customChecklistItemInput, setCustomChecklistItemInput] = useState('');
  const [aiChecklistSuggestions, setAiChecklistSuggestions] = useState<Array<{ title: string; rationale: string }>>([]);
  const [aiSuggestionsGeneratedForContactId, setAiSuggestionsGeneratedForContactId] = useState<number | null>(null);
  const [editingChecklistItemKey, setEditingChecklistItemKey] = useState<string | null>(null);
  const [editingChecklistItemLabel, setEditingChecklistItemLabel] = useState('');
  const [draggedChecklistIndex, setDraggedChecklistIndex] = useState<number | null>(null);
  const [meetingMinutesText, setMeetingMinutesText] = useState('');
  const [meetingMinutesDueHours, setMeetingMinutesDueHours] = useState(48);

  // Estados da Calculadora de Propostas e Histórico
  const [simCredit, setSimCredit] = useState<number>(450000);
  const [adminFee, setAdminFee] = useState<number>(16);
  const [proposalTitle, setProposalTitle] = useState('Proposta Planejada — Trator 180cv');
  const [proposalNotes, setProposalNotes] = useState('');

  // Estados de Importação
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Estados de Novo Cliente Manual (PF / PJ)
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientType, setNewClientType] = useState<'pf' | 'pj'>('pj');
  const [newClientOrg, setNewClientOrg] = useState('');
  const [newClientTaxId, setNewClientTaxId] = useState('');
  const [newClientState, setNewClientState] = useState('Minas Gerais');
  const [newClientCity, setNewClientCity] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientActivity, setNewClientActivity] = useState('');
  const [newClientSegment, setNewClientSegment] = useState('Grãos e Cereais');
  const [newClientAsset, setNewClientAsset] = useState('Tratores, Colheitadeiras e Implementos');
  const [newClientRepId, setNewClientRepId] = useState<number | undefined>(undefined);

  // Consulta de Usuários com Acesso ao Sistema
  const usersQuery = trpc.crm.listSystemUsers.useQuery(undefined, {
    enabled: activeTab === 'users',
  });

  // Mutation de Novo Cliente
  const createClientMutation = trpc.crm.createManualContact.useMutation({
    onSuccess: () => {
      toast.success(newClientType === 'pf' ? 'Produtor Rural (Pessoa Física) cadastrado com sucesso!' : 'Empresa / Usina (Pessoa Jurídica) cadastrada!');
      setIsNewClientModalOpen(false);
      setNewClientOrg('');
      setNewClientTaxId('');
      setNewClientCity('');
      setNewClientPhone('');
      setNewClientActivity('');
      utils.crm.invalidate();
    },
    onError: (err) => {
      toast.error('Erro ao cadastrar cliente: ' + err.message);
    }
  });

  // Mutation de Alerta de Metas
  const triggerTargetAlertMutation = trpc.crm.triggerTargetAlertCheck.useMutation({
    onSuccess: (data) => {
      if (data.triggered > 0) {
        toast.success(`Alerta de meta disparado para ${data.triggered} consultor(es) via Webhook!`);
      } else {
        toast.info(data.message || 'Nenhum consultor novo com 100% da meta atingida neste mês.');
      }
    },
    onError: (err) => {
      toast.error('Erro ao verificar alerta de metas: ' + err.message);
    }
  });

  // Geração de Relatório Executivo em PDF
  const handleDownloadExecutivePDF = () => {
    try {
      const doc = new jsPDF();
      const currentMonth = statsQuery.data?.repStats?.[0]?.targetMonthKey || `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
      
      // Cabeçalho
      doc.setFillColor(27, 77, 62); // #1B4D3E
      doc.rect(0, 0, 210, 36, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('ADEMICON AGRO — RELATÓRIO EXECUTIVO', 14, 16);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Desempenho da Equipe Comercial & Metas Mensais • Competência: ${currentMonth}`, 14, 24);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} por ${meQuery.data?.name || 'Administrador'}`, 14, 30);
      
      // Resumo Geral
      doc.setTextColor(27, 77, 62);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('1. Resumo da Operação Comercial', 14, 46);
      
      doc.setDrawColor(209, 204, 193);
      doc.setFillColor(245, 242, 235);
      doc.roundedRect(14, 50, 182, 24, 3, 3, 'FD');
      
      doc.setTextColor(26, 54, 67);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      const totalLeads = contactsQuery.data?.length || 0;
      const totalReps = repsQuery.data?.length || 0;
      const totalFechados = statsQuery.data?.stageCounts?.fechado || 0;
      const totalVolumeRealizado = statsQuery.data?.repStats?.reduce((acc, r) => acc + (r.actualFinancialAmount || 0), 0) || 0;
      
      doc.text(`Total de Leads na Base: ${totalLeads}`, 20, 58);
      doc.text(`Consultores em Atividade: ${totalReps}`, 20, 66);
      doc.text(`Contratos Fechados: ${totalFechados}`, 110, 58);
      doc.text(`Volume Financeiro Realizado: ${totalVolumeRealizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 110, 66);
      
      // Tabela de Desempenho dos Consultores
      doc.setTextColor(27, 77, 62);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('2. Desempenho Individual dos Membros da Equipe', 14, 84);
      
      let y = 92;
      doc.setFillColor(235, 230, 219);
      doc.rect(14, y, 182, 8, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(27, 77, 62);
      doc.text('CONSULTOR', 16, y + 5.5);
      doc.text('CARTEIRA', 70, y + 5.5);
      doc.text('FECHADOS', 92, y + 5.5);
      doc.text('META (R$)', 114, y + 5.5);
      doc.text('REALIZADO (R$)', 146, y + 5.5);
      doc.text('% META', 180, y + 5.5);
      
      y += 8;
      const repsList = statsQuery.data?.repStats || [];
      repsList.forEach((rep, index) => {
        const target = rep.targetFinancialAmount || 0;
        const actual = rep.actualFinancialAmount || 0;
        const percent = target > 0 ? Math.round((actual / target) * 100) : 0;
        const isOdd = index % 2 === 1;
        
        if (isOdd) {
          doc.setFillColor(250, 248, 245);
          doc.rect(14, y, 182, 7, 'F');
        }
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(26, 54, 67);
        doc.text(rep.name.substring(0, 26), 16, y + 5);
        doc.text(String(rep.assignedContacts || 0), 74, y + 5);
        doc.text(String(rep.closedDeals || 0), 96, y + 5);
        doc.text(target > 0 ? target.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—', 114, y + 5);
        doc.text(actual > 0 ? actual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'R$ 0', 146, y + 5);
        
        if (percent >= 100) {
          doc.setTextColor(16, 120, 60);
          doc.setFont('helvetica', 'bold');
          doc.text(`${percent}% (Batida)`, 176, y + 5);
        } else if (target > 0) {
          doc.setTextColor(180, 100, 20);
          doc.text(`${percent}%`, 180, y + 5);
        } else {
          doc.setTextColor(120, 120, 120);
          doc.text('Sem meta', 178, y + 5);
        }
        
        y += 7;
      });
      
      // Rodapé Institucional
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'italic');
      doc.text('Documento gerado pelo sistema CRM Ademicon Agro — Uso interno e confidencial da equipe comercial.', 14, 285);
      
      doc.save(`relatorio_executivo_equipe_${currentMonth}.pdf`);
      toast.success('Relatório executivo em PDF baixado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao gerar PDF: ' + err.message);
    }
  };

  // Exportação do Relatório de Conversão por Cultura / Segmento em PDF
  const handleExportCultureConversionPDF = () => {
    try {
      const doc = new jsPDF();
      const currentMonth = statsQuery.data?.repStats?.[0]?.targetMonthKey || `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
      const segmentData = statsQuery.data?.segmentStats || [];

      // Topo
      doc.setFillColor(27, 77, 62);
      doc.rect(0, 0, 210, 36, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('ADEMICON AGRO — CONVERSÃO POR CULTURA', 14, 16);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Desempenho Comercial por Segmento Agrícola • Competência: ${currentMonth}`, 14, 24);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} por ${meQuery.data?.name || 'Consultor'}`, 14, 30);

      // Tabela de Segmentos
      doc.setTextColor(27, 77, 62);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Métricas de Funil e Fechamento por Cultura / Segmento', 14, 46);

      let y = 52;
      doc.setFillColor(235, 230, 219);
      doc.rect(14, y, 182, 8, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(27, 77, 62);
      doc.text('CULTURA / SEGMENTO', 16, y + 5.5);
      doc.text('TOTAL LEADS', 80, y + 5.5);
      doc.text('EM NEGOCIAÇÃO', 110, y + 5.5);
      doc.text('FECHADOS', 145, y + 5.5);
      doc.text('TAXA CONV. (%)', 170, y + 5.5);

      y += 8;
      segmentData.forEach((seg, index) => {
        const isOdd = index % 2 === 1;
        if (isOdd) {
          doc.setFillColor(250, 248, 245);
          doc.rect(14, y, 182, 7, 'F');
        }
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(26, 54, 67);
        doc.text(seg.name, 16, y + 5);
        doc.text(String(seg.total), 85, y + 5);
        doc.text(String(seg.inProgress), 118, y + 5);
        doc.text(String(seg.closed), 150, y + 5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(27, 77, 62);
        doc.text(`${seg.conversionRate}%`, 175, y + 5);
        y += 7;
      });

      // Rodapé
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'italic');
      doc.text('Relatório analítico de inteligência agrícola — CRM Agronegócio Ademicon.', 14, 285);

      doc.save(`relatorio_conversao_culturas_${currentMonth}.pdf`);
      toast.success('Relatório de conversão por cultura em PDF baixado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao gerar relatório em PDF: ' + err.message);
    }
  };

  // Exportação do Relatório de Conversão por Cultura / Segmento em Excel
  const handleExportCultureConversionExcel = () => {
    try {
      const segmentData = statsQuery.data?.segmentStats || [];
      const rows = segmentData.map(s => ({
        'Cultura / Segmento': s.name,
        'Total de Leads': s.total,
        'Em Negociação': s.inProgress,
        'Vendas Fechadas': s.closed,
        'Taxa de Conversão (%)': `${s.conversionRate}%`,
        'Taxa de Avanço (%)': `${s.progressRate}%`,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Conversão por Cultura');
      XLSX.writeFile(workbook, `relatorio_conversao_culturas_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Planilha Excel de conversão por cultura exportada com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao exportar Excel: ' + err.message);
    }
  };

  // Exportação do Briefing Completo e Checklist da Reunião em PDF para Uso Offline em Visitas a Campo
  const handleExportBriefingChecklistPDF = () => {
    if (!selectedContact) {
      toast.error('Selecione um produtor para exportar o briefing.');
      return;
    }
    try {
      const doc = new jsPDF();
      const orgName = selectedContact.organization || 'Produtor Rural';
      const checklistItems = meetingChecklistQuery.data || [];
      const completedCount = checklistItems.filter(i => i.completed).length;
      const totalCount = checklistItems.length;
      const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      // Cabeçalho institucional verde floresta Ademicon
      doc.setFillColor(27, 77, 62); // #1B4D3E
      doc.rect(0, 0, 210, 36, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('ADEMICON AGRO — BRIEFING EXECUTIVO & CHECKLIST', 14, 15);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Material de Apoio para Reunião Presencial em Campo • Uso Offline`, 14, 22);
      doc.text(`Produtor: ${orgName.slice(0, 48)} • Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, 29);

      let y = 44;

      // Bloco de Identificação da Propriedade / Empresa
      doc.setDrawColor(209, 204, 193);
      doc.setFillColor(245, 242, 235);
      doc.roundedRect(14, y, 182, 22, 2, 2, 'FD');

      doc.setTextColor(27, 77, 62);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Dados da Propriedade / Negócio', 18, y + 6);

      doc.setTextColor(26, 54, 67);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Localização: ${selectedContact.city} - ${selectedContact.state}`, 18, y + 13);
      doc.text(`Atividade: ${selectedContact.activity} • Tipo: ${selectedContact.clientType === 'pf' ? 'Pessoa Física (Produtor)' : 'Pessoa Jurídica (Empresa/Usina)'}`, 18, y + 18);
      doc.text(`Ativo de Interesse: ${selectedContact.interestAsset || 'Tratores e Implementos'}`, 105, y + 13);
      doc.text(`Telefone: ${selectedContact.formattedPhone || selectedContact.phone}`, 105, y + 18);

      y += 28;

      // Síntese Executiva Pré-Reunião (IA)
      doc.setTextColor(27, 77, 62);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('1. Síntese Executiva Pré-Reunião (Inteligência Comercial)', 14, y);
      y += 4;

      const briefingText = aiBriefingContent || 'Nenhum briefing pré-gerado. Utilize o histórico da ficha para orientar a condução da conversa.';
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);

      const splitBriefing = doc.splitTextToSize(briefingText, 182);
      doc.text(splitBriefing.slice(0, 22), 14, y + 3);
      y += Math.min(splitBriefing.length * 3.8, 85) + 6;

      // Checklist de Pauta da Reunião
      doc.setTextColor(27, 77, 62);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`2. Checklist de Alinhamento Comercial (${completedCount}/${totalCount} abordados — ${completionPercent}%)`, 14, y);
      y += 5;

      checklistItems.forEach((item, idx) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        const isDone = item.completed;
        doc.setFillColor(isDone ? 230 : 255, isDone ? 245 : 255, isDone ? 235 : 255);
        doc.setDrawColor(isDone ? 136 : 209, isDone ? 176 : 204, isDone ? 75 : 193);
        doc.roundedRect(14, y, 182, 7.5, 1.5, 1.5, 'FD');

        // Quadrado do checkbox
        doc.rect(17, y + 1.8, 3.8, 3.8);
        if (isDone) {
          doc.setTextColor(27, 77, 62);
          doc.setFont('helvetica', 'bold');
          doc.text('X', 18, y + 4.8);
        }

        doc.setFontSize(8);
        doc.setTextColor(isDone ? 27 : 30, isDone ? 77 : 30, isDone ? 62 : 30);
        doc.setFont('helvetica', isDone ? 'bold' : 'normal');
        const itemLabel = `${idx + 1}. ${item.label}${item.isCustom ? ' [Personalizado]' : ''}`;
        doc.text(itemLabel.slice(0, 95), 23, y + 4.8);

        y += 9;
      });

      // Campo de Ata / Anotações de Campo
      if (y > 235) {
        doc.addPage();
        y = 20;
      }
      y += 3;
      doc.setTextColor(27, 77, 62);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('3. Ata & Desfecho da Reunião em Campo', 14, y);
      y += 4;

      doc.setDrawColor(209, 204, 193);
      doc.setFillColor(252, 250, 247);
      doc.roundedRect(14, y, 182, 35, 2, 2, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      const minuteContent = meetingMinutesText || meetingMinutesQuery.data?.content || 'Espaço reservado para registro de ata física durante a visita à fazenda. Registre os valores discutidos, prazos de safra e decisores presentes.';
      const splitMinutes = doc.splitTextToSize(minuteContent, 176);
      doc.text(splitMinutes.slice(0, 7), 17, y + 6);

      // Rodapé
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'italic');
      doc.text('Documento confidencial gerado pelo CRM Ademicon Agro — Válido para consultas offline em visitas técnicas e reuniões comerciais.', 14, 285);

      const safeFilename = orgName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24);
      doc.save(`briefing_checklist_${safeFilename}.pdf`);
      toast.success('PDF do briefing e checklist gerado para uso offline!');
    } catch (err: any) {
      toast.error('Erro ao gerar PDF do briefing: ' + err.message);
    }
  };

  // Queries
  const statsQuery = trpc.crm.stats.useQuery({
    viewRepId: activeRepView !== 'all' ? parseInt(activeRepView, 10) : undefined,
  });
  const repsQuery = trpc.crm.listReps.useQuery();
  const reminderSettingsQuery = trpc.crm.getReminderSettings.useQuery();
  const auditLogsQuery = trpc.crm.auditLogs.useQuery(undefined, {
    enabled: activeTab === 'audit',
  });
  const sanitizationReportQuery = trpc.crm.getSanitizationReport.useQuery(undefined, {
    enabled: activeTab === 'sanitization',
  });
  const contactsQuery = trpc.crm.listContacts.useQuery({
    search: search || undefined,
    state: stateFilter !== 'all' ? stateFilter : undefined,
    pipelineStage: stageFilter !== 'all' ? stageFilter : undefined,
    temperature: tempFilter !== 'all' ? tempFilter : undefined,
    assignedRepId: activeRepView !== 'all' ? parseInt(activeRepView, 10) : undefined,
    interestTag: interestTagFilter !== 'all' ? interestTagFilter : undefined,
    leadType: leadTypeFilter !== 'all' ? leadTypeFilter : undefined,
    leadBatch: leadBatchFilter !== 'all' ? leadBatchFilter : undefined,
  });
  const tasksQuery = trpc.crm.listTasks.useQuery({
    status: taskStatusFilter,
    assignedRepId: taskConsultantFilter !== 'all' ? parseInt(taskConsultantFilter, 10) : undefined,
    source: taskSourceFilter,
  });
  const templatesQuery = trpc.crm.listTemplates.useQuery();
  const myVariantsQuery = trpc.crm.listMyScriptVariants.useQuery();
  const scriptMetricsQuery = trpc.crm.scriptMetrics.useQuery(
    { repId: metricsConsultantFilter !== 'all' ? parseInt(metricsConsultantFilter, 10) : undefined },
    {
      enabled: activeTab === 'templates' && scriptSubTab === 'metrics',
    }
  );
  const contactDispatchesQuery = trpc.crm.contactDispatches.useQuery(
    { contactId: selectedContactId! },
    { enabled: !!selectedContactId }
  );
  const detailQuery = trpc.crm.getContact.useQuery(
    { id: selectedContactId! },
    { enabled: !!selectedContactId }
  );
  const meetingChecklistQuery = trpc.crm.getMeetingChecklist.useQuery(
    { contactId: selectedContactId! },
    { enabled: !!selectedContactId && isAiBriefingModalOpen }
  );
  const meetingMinutesQuery = trpc.crm.getMeetingMinutes.useQuery(
    { contactId: selectedContactId! },
    {
      enabled: !!selectedContactId && isAiBriefingModalOpen,
    }
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
  const updateObservationMutation = trpc.crm.updateContactObservation.useMutation({
    onSuccess: () => {
      toast.success('Observação do produtor atualizada com sucesso!');
      setIsEditingObservation(false);
      utils.crm.getContact.invalidate({ id: selectedContactId! });
      utils.crm.listContacts.invalidate();
    },
    onError: (err) => toast.error('Erro ao salvar observação: ' + err.message),
  });
  const updateInterestTagMutation = trpc.crm.updateContactInterestTag.useMutation({
    onSuccess: () => {
      toast.success('Classificação rápida de interesse atualizada!');
      utils.crm.getContact.invalidate({ id: selectedContactId! });
      utils.crm.listContacts.invalidate();
    },
    onError: (err) => toast.error('Erro ao atualizar tag de interesse: ' + err.message),
  });
  const bulkUpdateInterestTagMutation = trpc.crm.bulkUpdateContactInterestTag.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.updated} contato(s) receberam a classificação selecionada.`);
      setSelectedContactIds([]);
      utils.crm.listContacts.invalidate();
      utils.crm.stats.invalidate();
    },
    onError: (err) => toast.error('Erro ao aplicar classificação em lote: ' + err.message),
  });
  const mergeContactsMutation = trpc.crm.mergeContacts.useMutation({
    onSuccess: (data) => {
      toast.success(`Mesclagem concluída! ${data.mergedCount} contato(s) unificados com sucesso.`);
      setMergeModalOpen(false);
      setActiveMergeCluster(null);
      setPrimaryContactIdChoice(null);
      utils.crm.getSanitizationReport.invalidate();
      utils.crm.listContacts.invalidate();
      utils.crm.stats.invalidate();
      utils.crm.auditLogs.invalidate();
    },
    onError: (err) => toast.error('Falha ao mesclar contatos: ' + err.message),
  });
  const summarizeObservationMutation = trpc.crm.summarizeContactObservation.useMutation({
    onSuccess: () => {
      toast.success('Resumo inteligente de observações gerado com sucesso pela IA!');
      utils.crm.getContact.invalidate({ id: selectedContactId! });
      utils.crm.listContacts.invalidate();
    },
    onError: (err) => toast.error('Erro ao resumir observações: ' + err.message),
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
  const rescheduleTaskMutation = trpc.crm.rescheduleTask.useMutation({
    onSuccess: () => {
      toast.success('Follow-up remarcado para daqui a 48 horas.');
      utils.crm.listTasks.invalidate();
      utils.crm.stats.invalidate();
    },
    onError: (err) => toast.error('Não foi possível remarcar o follow-up: ' + err.message),
  });
  const registerTaskResponseMutation = trpc.crm.registerTaskResponse.useMutation({
    onSuccess: (_data, variables) => {
      const label = variables.status === 'reuniao_agendada' ? 'Reunião agendada' : variables.status === 'respondeu' ? 'Resposta registrada' : 'Sem resposta registrado';
      toast.success(`${label}. A tarefa foi atualizada.`);
      utils.crm.invalidate();
    },
    onError: (err) => toast.error('Não foi possível registrar a resposta: ' + err.message),
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
  const generateBriefingMutation = trpc.crm.generateContactBriefing.useMutation({
    onSuccess: (data) => {
      setAiBriefingContent(data.briefing);
      setAiChecklistSuggestions([]);
      setAiSuggestionsGeneratedForContactId(null);
      setMeetingMinutesText('');
      setIsAiBriefingModalOpen(true);
      toast.success('Briefing pré-reunião gerado com sucesso pela IA!');
    },
    onError: (err) => {
      toast.error('Erro ao gerar briefing: ' + err.message);
    }
  });
  const toggleChecklistItemMutation = trpc.crm.toggleMeetingChecklistItem.useMutation({
    onSuccess: () => {
      utils.crm.getMeetingChecklist.invalidate();
    },
    onError: (err) => {
      toast.error('Não foi possível salvar o checklist: ' + err.message);
    }
  });
  const addCustomChecklistItemMutation = trpc.crm.addCustomMeetingChecklistItem.useMutation({
    onSuccess: (_data, variables) => {
      setCustomChecklistItemInput('');
      setAiChecklistSuggestions((current) => current.filter((suggestion) => suggestion.title.trim().toLowerCase() !== variables.label.trim().toLowerCase()));
      utils.crm.getMeetingChecklist.invalidate();
      toast.success('Tópico personalizado adicionado ao checklist.');
    },
    onError: (err) => {
      toast.error('Não foi possível adicionar o tópico: ' + err.message);
    }
  });
  const suggestChecklistTopicsMutation = trpc.crm.suggestMeetingChecklistTopics.useMutation({
    onSuccess: (data, variables) => {
      setAiChecklistSuggestions(data.suggestions);
      setAiSuggestionsGeneratedForContactId(variables.contactId);
      toast.success(`${data.suggestions.length} sugestão(ões) de pauta gerada(s) pela IA.`);
    },
    onError: (err) => {
      toast.error('Não foi possível gerar sugestões: ' + err.message);
    }
  });
  const updateCustomChecklistItemMutation = trpc.crm.updateCustomMeetingChecklistItem.useMutation({
    onSuccess: () => {
      setEditingChecklistItemKey(null);
      setEditingChecklistItemLabel('');
      utils.crm.getMeetingChecklist.invalidate();
      toast.success('Tópico personalizado atualizado.');
    },
    onError: (err) => {
      toast.error('Não foi possível editar o tópico: ' + err.message);
    }
  });
  const deleteCustomChecklistItemMutation = trpc.crm.deleteCustomMeetingChecklistItem.useMutation({
    onSuccess: () => {
      utils.crm.getMeetingChecklist.invalidate();
      toast.success('Tópico personalizado excluído.');
    },
    onError: (err) => {
      toast.error('Não foi possível excluir o tópico: ' + err.message);
    }
  });
  const reorderChecklistMutation = trpc.crm.reorderMeetingChecklist.useMutation({
    onSuccess: () => {
      utils.crm.getMeetingChecklist.invalidate();
      toast.success('Ordem dos tópicos da reunião atualizada.');
    },
    onError: (err) => {
      toast.error('Não foi possível reordenar: ' + err.message);
    }
  });
  const saveMeetingMinutesMutation = trpc.crm.saveMeetingMinutes.useMutation({
    onSuccess: (data) => {
      utils.crm.getMeetingMinutes.invalidate();
      utils.crm.listTasks.invalidate();
      utils.crm.getContact.invalidate();
      utils.crm.stats.invalidate();
      const count = data?.pendingCount ?? 0;
      if (count > 0) {
        toast.success(`Ata registrada! ${count} tópico(s) pendente(s) foram convertidos em tarefas de follow-up.`);
      } else {
        toast.success('Ata da reunião salva com sucesso! Todos os tópicos da pauta foram concluídos.');
      }
    },
    onError: (err) => {
      toast.error('Não foi possível salvar a ata: ' + err.message);
    }
  });

  React.useEffect(() => {
    if (meetingMinutesQuery.data?.content && !meetingMinutesText) {
      setMeetingMinutesText(meetingMinutesQuery.data.content);
    }
  }, [meetingMinutesQuery.data?.content]);

  React.useEffect(() => {
    if (detailQuery.data?.contact) {
      setContactObservationInput((detailQuery.data.contact as any).observation || '');
      setIsEditingObservation(false);
    }
  }, [detailQuery.data?.contact?.id, (detailQuery.data?.contact as any)?.observation]);

  React.useEffect(() => {
    if (
      isAiBriefingModalOpen &&
      selectedContactId &&
      aiSuggestionsGeneratedForContactId !== selectedContactId &&
      !suggestChecklistTopicsMutation.isPending
    ) {
      suggestChecklistTopicsMutation.mutate({ contactId: selectedContactId });
    }
  }, [isAiBriefingModalOpen, selectedContactId, aiSuggestionsGeneratedForContactId]);

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

  const saveVariantMutation = trpc.crm.saveMyScriptVariant.useMutation({
    onSuccess: () => {
      toast.success('Sua variação personalizada do script foi salva com sucesso!');
      setEditVariantModalOpen(false);
      utils.crm.listMyScriptVariants.invalidate();
    },
    onError: (err) => {
      toast.error('Erro ao salvar variação: ' + err.message);
    }
  });

  const resetVariantMutation = trpc.crm.resetMyScriptVariant.useMutation({
    onSuccess: () => {
      toast.success('Script restaurado para o padrão homologado!');
      setEditVariantModalOpen(false);
      utils.crm.listMyScriptVariants.invalidate();
    },
    onError: (err) => {
      toast.error('Erro ao restaurar script: ' + err.message);
    }
  });

  const createTemplateMutation = trpc.crm.createTemplate.useMutation({
    onSuccess: () => {
      toast.success('Novo roteiro homologado cadastrado com sucesso!');
      setNewScriptModalOpen(false);
      setNewScriptTitle('');
      setNewScriptContent('');
      setNewScriptUsage('');
      utils.crm.listTemplates.invalidate();
    },
    onError: (err) => {
      toast.error('Erro ao criar roteiro: ' + err.message);
    }
  });

  const recordDispatchMutation = trpc.crm.recordDispatch.useMutation({
    onSuccess: () => {
      utils.crm.scriptMetrics.invalidate();
      utils.crm.contactDispatches.invalidate();
      utils.crm.getContact.invalidate();
      utils.crm.listContacts.invalidate();
      utils.crm.listTasks.invalidate();
      utils.crm.stats.invalidate();
    }
  });

  const updateDispatchStatusMutation = trpc.crm.updateDispatchStatus.useMutation({
    onSuccess: () => {
      toast.success('Status da resposta do produtor atualizado com sucesso!');
      utils.crm.scriptMetrics.invalidate();
      utils.crm.contactDispatches.invalidate();
    },
    onError: (err) => {
      toast.error('Erro ao atualizar status: ' + err.message);
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
  const [targetDrafts, setTargetDrafts] = useState<Record<number, number>>({});
  const [targetFinancialDrafts, setTargetFinancialDrafts] = useState<Record<number, number>>({});

  const setMonthlyTargetMutation = trpc.crm.setMonthlyTarget.useMutation({
    onSuccess: () => {
      toast.success('Meta mensal atualizada com sucesso!');
      utils.crm.invalidate();
    },
    onError: (err) => {
      toast.error(`Falha ao salvar meta: ${err.message}`);
    }
  });

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

  const visibleContactIds = useMemo(
    () => new Set((contactsQuery.data || []).map((contact) => contact.id)),
    [contactsQuery.data]
  );
  const allVisibleContactsSelected = Boolean(
    contactsQuery.data?.length && contactsQuery.data.every((contact) => selectedContactIds.includes(contact.id))
  );

  const toggleContactSelection = (contactId: number) => {
    setSelectedContactIds((current) =>
      current.includes(contactId) ? current.filter((id) => id !== contactId) : [...current, contactId]
    );
  };

  const toggleAllVisibleContacts = () => {
    if (allVisibleContactsSelected) {
      setSelectedContactIds((current) => current.filter((id) => !visibleContactIds.has(id)));
      return;
    }
    setSelectedContactIds((current) => Array.from(new Set([...current, ...(contactsQuery.data || []).map((contact) => contact.id)])));
  };

  const applyBulkInterestTag = () => {
    if (selectedContactIds.length === 0) {
      toast.info('Selecione ao menos um produtor para aplicar uma classificação.');
      return;
    }
    bulkUpdateInterestTagMutation.mutate({
      contactIds: selectedContactIds,
      interestTag: bulkInterestTag,
    });
  };

  React.useEffect(() => {
    setSelectedContactIds((current) => {
      const next = current.filter((id) => visibleContactIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [visibleContactIds]);

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

  const repConversionChartData = useMemo(() => {
    const raw = statsQuery.data?.repConversionStats || [];
    const filtered = activeRepView !== 'all'
      ? raw.filter((r) => String(r.id) === activeRepView)
      : raw;
    return filtered.map((rep) => ({
      ...rep,
      shortName: rep.name.length > 24 ? `${rep.name.slice(0, 24)}…` : rep.name,
      targetRate: rep.targetRate || 0,
    }));
  }, [statsQuery.data?.repConversionStats, activeRepView]);

  const interestTagMatrixRows = useMemo(() => {
    const rows = statsQuery.data?.interestTagByRep || [];
    return interestMatrixRepFilter === 'all'
      ? rows
      : rows.filter((row) => String(row.repId) === interestMatrixRepFilter);
  }, [statsQuery.data?.interestTagByRep, interestMatrixRepFilter]);

  const interestTagMatrixColumns = useMemo(() => {
    const discoveredTags = interestTagMatrixRows.flatMap((row) => row.tags.map((item) => item.tag));
    const columns = Array.from(new Set([...interestTagOptions, ...discoveredTags]));
    return interestMatrixTagFilter === 'all' ? columns : columns.filter((tag) => tag === interestMatrixTagFilter);
  }, [interestTagMatrixRows, interestMatrixTagFilter]);

  const monthlyEvolutionChartData = useMemo(() => {
    return statsQuery.data?.monthlyStats || [];
  }, [statsQuery.data?.monthlyStats]);

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

  const handleRepChartClick = (payload: { id?: number }) => {
    if (!payload.id) return;
    setActiveRepView(String(payload.id));
    setStateFilter('all');
    setLeadBatchFilter('all');
    setLeadTypeFilter('all');
    setStageFilter('all');
    setInterestTagFilter('all');
    setActiveTab('contacts');
    toast.success('Carteira do consultor selecionada');
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

    const nowStr = new Date().toLocaleString('pt-BR');
    const userWatermark = meQuery.data ? `${meQuery.data.name || 'Consultor'} (${meQuery.data.email || 'autenticado'})` : 'Usuário Autenticado';
    const csvContent = buildContactsCsv(
      contactsQuery.data,
      repsQuery.data || [],
      stageLabels,
      { exportedBy: userWatermark, exportedAt: nowStr },
    );
    logExportMutation.mutate({ recordCount: contactsQuery.data.length, format: 'CSV' });
    downloadContactsCsv(csvContent, `contatos_agronegocio_ademicon_${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success('CSV confidencial baixado com observações completas, resumos de IA e auditoria registrada!');
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

  const renderTaskScript = (content: string, task: any) => content
    .replace(/\{\{nome\}\}/g, task.contactName || 'Produtor')
    .replace(/\{\{consultor\}\}/g, meQuery.data?.name || activeRep?.name || 'Consultor Ademicon')
    .replace(/\{\{organizacao\}\}/g, task.contactName || 'sua propriedade')
    .replace(/\{\{cidade\}\}/g, task.contactCity || 'sua região')
    .replace(/\{\{bem_interesse\}\}/g, task.contactAsset || 'máquinas agrícolas')
    .replace(/\{\{indicador\}\}/g, 'parceiro comercial');

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
            {meQuery.data?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('sanitization')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'sanitization' ? 'bg-[#88B04B] text-[#1B4D3E]' : 'hover:bg-white/10 text-white/90'
                }`}
              >
                <GitMerge className="w-4 h-4" /> Saneamento & Deduplicação
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

          {/* TAB SANEAMENTO, DEDUPLICAÇÃO & QUALIDADE DA BASE */}
          {activeTab === 'sanitization' && meQuery.data?.role === 'admin' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-extrabold text-[#1B4D3E] flex items-center gap-2.5">
                    <GitMerge className="w-8 h-8 text-[#88B04B]" /> Central de Saneamento & Deduplicação
                  </h2>
                  <p className="text-sm text-[#5C727D]">
                    Identifique duplicidades por documento, telefone e similaridade, resolva pendências cadastrais e unifique históricos sem perda de dados.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sanitizationReportQuery.refetch()}
                  disabled={sanitizationReportQuery.isFetching}
                  className="border-[#D1CCC1] text-[#1B4D3E] font-bold text-xs"
                >
                  <DatabaseZap className="w-4 h-4 mr-1.5 text-[#88B04B]" />
                  {sanitizationReportQuery.isFetching ? 'Atualizando diagnóstico...' : 'Atualizar Diagnóstico'}
                </Button>
              </div>

              {/* Cards de Métricas de Integridade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 border border-[#D1CCC1] shadow-xs">
                  <span className="text-xs font-semibold text-[#5C727D] block">Leads Ativos na Base</span>
                  <span className="text-2xl font-black text-[#1B4D3E]">
                    {sanitizationReportQuery.data?.summary.totalActive || 0}
                  </span>
                  <span className="text-[11px] text-[#5C727D] block mt-1">
                    +{sanitizationReportQuery.data?.summary.totalMerged || 0} já mesclados/arquivados
                  </span>
                </div>

                <div className="bg-white rounded-xl p-4 border border-amber-200 bg-amber-50/40 shadow-xs">
                  <span className="text-xs font-semibold text-amber-800 block">Grupos de Duplicados</span>
                  <span className="text-2xl font-black text-amber-700">
                    {sanitizationReportQuery.data?.summary.duplicateClustersCount || 0}
                  </span>
                  <span className="text-[11px] text-amber-900 block mt-1">
                    {sanitizationReportQuery.data?.summary.candidatesCount || 0} contatos envolvidos
                  </span>
                </div>

                <div className="bg-white rounded-xl p-4 border border-rose-200 bg-rose-50/40 shadow-xs">
                  <span className="text-xs font-semibold text-rose-800 block">Leads Sem Consultor</span>
                  <span className="text-2xl font-black text-rose-700">
                    {sanitizationReportQuery.data?.summary.unassignedCount || 0}
                  </span>
                  <span className="text-[11px] text-rose-900 block mt-1">Pendentes de carteira</span>
                </div>

                <div className="bg-white rounded-xl p-4 border border-[#D1CCC1] shadow-xs">
                  <span className="text-xs font-semibold text-[#5C727D] block">Telefones Atípicos</span>
                  <span className="text-2xl font-black text-[#1A3643]">
                    {sanitizationReportQuery.data?.summary.invalidPhoneCount || 0}
                  </span>
                  <span className="text-[11px] text-[#5C727D] block mt-1">Dígitos fora do padrão nacional</span>
                </div>
              </div>

              {/* Filtros da Central */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={sanitizationFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setSanitizationFilter('all')}
                  className={sanitizationFilter === 'all' ? 'bg-[#1B4D3E] text-white text-xs font-bold' : 'border-[#D1CCC1] text-[#1A3643] text-xs'}
                >
                  Visão Geral ({sanitizationReportQuery.data?.clusters.length || 0} grupos)
                </Button>
                <Button
                  size="sm"
                  variant={sanitizationFilter === 'duplicates' ? 'default' : 'outline'}
                  onClick={() => setSanitizationFilter('duplicates')}
                  className={sanitizationFilter === 'duplicates' ? 'bg-[#1B4D3E] text-white text-xs font-bold' : 'border-[#D1CCC1] text-[#1A3643] text-xs'}
                >
                  Apenas Duplicados ({sanitizationReportQuery.data?.clusters.length || 0})
                </Button>
                <Button
                  size="sm"
                  variant={sanitizationFilter === 'unassigned' ? 'default' : 'outline'}
                  onClick={() => setSanitizationFilter('unassigned')}
                  className={sanitizationFilter === 'unassigned' ? 'bg-[#1B4D3E] text-white text-xs font-bold' : 'border-[#D1CCC1] text-[#1A3643] text-xs'}
                >
                  Sem Carteira ({sanitizationReportQuery.data?.summary.unassignedCount || 0})
                </Button>
                <Button
                  size="sm"
                  variant={sanitizationFilter === 'invalid_phone' ? 'default' : 'outline'}
                  onClick={() => setSanitizationFilter('invalid_phone')}
                  className={sanitizationFilter === 'invalid_phone' ? 'bg-[#1B4D3E] text-white text-xs font-bold' : 'border-[#D1CCC1] text-[#1A3643] text-xs'}
                >
                  Telefones com Atenção ({sanitizationReportQuery.data?.summary.invalidPhoneCount || 0})
                </Button>
              </div>

              {/* Seção 1: Grupos de Duplicados Identificados */}
              {(sanitizationFilter === 'all' || sanitizationFilter === 'duplicates') && (
                <Card className="bg-white border-[#D1CCC1]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold text-[#1B4D3E] flex items-center justify-between">
                      <span>Grupos de Duplicidades Suspeitas</span>
                      <Badge className="bg-[#88B04B] text-[#1B4D3E] text-xs font-extrabold">
                        {sanitizationReportQuery.data?.clusters.length || 0} encontrados
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs text-[#5C727D]">
                      Analise os leads lado a lado. Ao mesclar, o contato principal preserva os dados mais atualizados e herda tarefas, interações e propostas dos secundários.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {sanitizationReportQuery.data?.clusters.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#5C727D] bg-[#F5F2EB]/50 rounded-xl border border-dashed border-[#D1CCC1]">
                        Nenhuma duplicidade crítica encontrada na base ativa pelos critérios de CPF/CNPJ, telefone ou organização.
                      </div>
                    ) : (
                      sanitizationReportQuery.data?.clusters.map((cluster) => (
                        <div key={cluster.id} className="rounded-xl border border-[#D1CCC1] p-4 bg-[#F5F2EB]/30 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D1CCC1]/60 pb-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-bold text-xs text-[#1B4D3E]">{cluster.reason}</span>
                              <Badge variant="outline" className="text-[10px] bg-white border-amber-300 text-amber-800">
                                Confiança: {cluster.score}%
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90 text-xs font-bold h-8"
                              onClick={() => {
                                setActiveMergeCluster(cluster);
                                setPrimaryContactIdChoice(cluster.contacts[0].id);
                                setMergeReasonInput(`Mesclagem segura: ${cluster.reason}`);
                                setMergeModalOpen(true);
                              }}
                            >
                              <GitMerge className="w-3.5 h-3.5 mr-1" /> Comparar & Mesclar ({cluster.contacts.length})
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {cluster.contacts.map((c) => (
                              <div key={c.id} className="bg-white rounded-lg p-3 border border-[#D1CCC1] text-xs space-y-1.5 shadow-2xs">
                                <div className="flex justify-between items-start">
                                  <span className="font-bold text-[#1A3643] leading-snug">{c.organization}</span>
                                  <Badge className="text-[9px] bg-[#EBE6DB] text-[#1B4D3E]">ID #{c.id}</Badge>
                                </div>
                                <p className="text-[#5C727D] text-[11px]">{c.city} - {c.state} • {c.segment}</p>
                                <p className="font-mono text-[11px] text-[#1B4D3E] font-semibold">{c.phone}</p>
                                {c.taxId && <p className="text-[10px] text-[#5C727D]">Doc: {c.taxId}</p>}
                                <div className="pt-1.5 border-t border-[#EBE6DB] flex flex-wrap gap-1 text-[10px]">
                                  <span className="px-1.5 py-0.5 rounded bg-[#F5F2EB] text-[#1A3643]">
                                    Carteira: <strong>{c.assignedRepName}</strong>
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-[#F5F2EB] text-[#5C727D]">
                                    {c.interactionsCount} interações
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-[#F5F2EB] text-[#5C727D]">
                                    {c.tasksCount} tarefas
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Seção 2: Contatos Sem Consultor */}
              {(sanitizationFilter === 'all' || sanitizationFilter === 'unassigned') && (
                <Card className="bg-white border-[#D1CCC1]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold text-[#1B4D3E] flex items-center justify-between">
                      <span>Contatos sem Consultor Responsável</span>
                      <Badge className="bg-rose-100 text-rose-800 text-xs font-bold">
                        {sanitizationReportQuery.data?.unassignedContacts.length || 0} pendentes
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs text-[#5C727D]">
                      Leads que não possuem vendedor vinculado não participam da cobrança de metas individuais e nem do pódio.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sanitizationReportQuery.data?.unassignedContacts.length === 0 ? (
                      <div className="py-4 text-center text-xs text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
                        Excelente! 100% dos leads ativos estão atribuídos a um consultor comercial da equipe.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-[#F5F2EB] text-[#5C727D] font-semibold uppercase">
                            <tr>
                              <th className="py-2 px-3">Organização</th>
                              <th className="py-2 px-3">Localização</th>
                              <th className="py-2 px-3">Segmento</th>
                              <th className="py-2 px-3">Telefone</th>
                              <th className="py-2 px-3 text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#D1CCC1]/50">
                            {sanitizationReportQuery.data?.unassignedContacts.map((c) => (
                              <tr key={c.id} className="hover:bg-[#F5F2EB]/40">
                                <td className="py-2 px-3 font-bold text-[#1A3643]">{c.organization}</td>
                                <td className="py-2 px-3 text-[#5C727D]">{c.city} - {c.state}</td>
                                <td className="py-2 px-3">{c.segment}</td>
                                <td className="py-2 px-3 font-mono">{c.phone}</td>
                                <td className="py-2 px-3 text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] border-[#D1CCC1]"
                                    onClick={() => {
                                      setSelectedContactId(c.id);
                                      setActiveTab('contacts');
                                    }}
                                  >
                                    Abrir Ficha
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Seção 3: Histórico Recente de Mesclagens */}
              <Card className="bg-white border-[#D1CCC1]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-[#1B4D3E] flex items-center gap-1.5">
                    <History className="w-4 h-4 text-[#88B04B]" /> Histórico de Mesclagens Executadas
                  </CardTitle>
                  <CardDescription className="text-xs text-[#5C727D]">
                    Registro seguro de todas as deduplicações realizadas para fins de auditoria e conformidade.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {sanitizationReportQuery.data?.recentMerges.length === 0 ? (
                    <p className="text-xs text-[#5C727D] py-2">Nenhuma mesclagem foi realizada até o momento.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#F5F2EB] text-[#5C727D] uppercase font-semibold">
                          <tr>
                            <th className="py-2 px-3">Data</th>
                            <th className="py-2 px-3">Contato Mantido (Principal)</th>
                            <th className="py-2 px-3">Contato Arquivado</th>
                            <th className="py-2 px-3">Motivo / Tipo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#D1CCC1]/50">
                          {sanitizationReportQuery.data?.recentMerges.map((m) => (
                            <tr key={m.id} className="hover:bg-[#F5F2EB]/40">
                              <td className="py-2 px-3 font-mono text-[#5C727D]">
                                {new Date(m.createdAt).toLocaleString('pt-BR')}
                              </td>
                              <td className="py-2 px-3 font-bold text-[#1B4D3E]">Lead #{m.primaryContactId}</td>
                              <td className="py-2 px-3 font-semibold text-rose-700">Lead #{m.mergedContactId} (arquivado)</td>
                              <td className="py-2 px-3 text-[#5C727D]">{m.reason || m.matchType}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-extrabold text-[#1B4D3E]">Painel Comercial & Conversão</h2>
                  <p className="text-sm text-[#5C727D]">
                    {activeRep ? `Métricas e desempenho exclusivo da carteira de ${activeRep.name}` : 'Gestão unificada de oportunidades, taxas por cultura e prospecção de consórcio agro'}
                  </p>
                </div>

                {/* Seletor Rápido de Consultor / Gestão */}
                {meQuery.data?.role === 'admin' ? (
                  <div className="flex items-center gap-1.5 bg-[#F5F2EB] p-1.5 rounded-xl border border-[#D1CCC1]">
                    <span className="text-[11px] font-bold text-[#5C727D] uppercase tracking-wider px-2 flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5 text-[#1B4D3E]" /> Consultor:
                    </span>
                    <Button
                      size="sm"
                      variant={activeRepView === 'all' ? 'default' : 'ghost'}
                      className={activeRepView === 'all' ? 'bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90 h-8 text-xs font-semibold' : 'text-[#1A3643] hover:bg-[#D1CCC1]/40 h-8 text-xs'}
                      onClick={() => setActiveRepView('all')}
                    >
                      Geral (Equipe)
                    </Button>
                    {repsQuery.data?.map((r) => (
                      <Button
                        key={r.id}
                        size="sm"
                        variant={activeRepView === String(r.id) ? 'default' : 'ghost'}
                        className={activeRepView === String(r.id) ? 'bg-[#88B04B] text-[#1B4D3E] font-bold hover:bg-[#88B04B]/90 h-8 text-xs' : 'text-[#1A3643] hover:bg-[#D1CCC1]/40 h-8 text-xs'}
                        onClick={() => setActiveRepView(String(r.id))}
                      >
                        {r.name}
                      </Button>
                    ))}
                  </div>
                ) : (
                  activeRep && (
                    <Badge className="bg-[#1B4D3E] text-white text-xs px-3 py-1.5">
                      Carteira: {activeRep.name}
                    </Badge>
                  )
                )}
              </div>

              {/* Banner Informativo de Filtro Ativo no Painel */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm ${
                activeRep
                  ? 'bg-gradient-to-r from-emerald-50 via-white to-[#F5F2EB] border-emerald-300'
                  : 'bg-white border-[#D1CCC1]'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${
                    activeRep ? 'bg-[#88B04B] text-[#1B4D3E]' : 'bg-[#1B4D3E] text-white'
                  }`}>
                    {activeRep ? activeRep.name.charAt(0) : <Users className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-extrabold tracking-wider text-[#5C727D]">
                        {activeRep ? 'Desempenho Individual Selecionado' : 'Visão Geral Consolidada'}
                      </span>
                      {activeRep ? (
                        <Badge className="bg-[#88B04B] text-[#1B4D3E] font-bold text-[10px]">
                          Carteira Ativa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-[#1B4D3E] text-[#1B4D3E] text-[10px] font-semibold">
                          Equipe Completa
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-extrabold text-[#1B4D3E]">
                      {activeRep ? `${activeRep.name} (${activeRep.email || 'Consultor Financeiro'})` : 'Todas as Carteiras (Wesley Amancio & Daiani Chagas)'}
                    </h3>
                    <p className="text-xs text-[#5C727D]">
                      {activeRep
                        ? `Exibindo indicadores, metas e leads sob responsabilidade exclusiva de ${activeRep.name}.`
                        : 'Exibindo a distribuição nacional integrada de leads e o desempenho conjunto da equipe comercial.'}
                    </p>
                  </div>
                </div>
                {activeRep && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveRepView('all')}
                    className="border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#F5F2EB] text-xs font-semibold shrink-0"
                  >
                    Ver Painel Consolidado
                  </Button>
                )}
              </div>

              {/* BUSCA POR PALAVRAS-CHAVE E TERMOS NAS OBSERVAÇÕES NO PAINEL PRINCIPAL */}
              <div className="bg-white p-4 rounded-xl border border-[#D1CCC1] shadow-xs space-y-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <span className="text-xs font-extrabold text-[#1B4D3E] uppercase tracking-wider flex items-center gap-1.5">
                    <FileSearch className="w-4 h-4 text-[#88B04B]" /> Busca por Palavras-chave nas Observações & Pareceres Comerciais
                  </span>
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="text-xs text-rose-700 hover:underline font-bold"
                    >
                      Limpar busca ("{search}")
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-[#5C727D]" />
                  <Input
                    placeholder="Pesquise por termos anotados nas observações (ex.: 'soja', 'colheitadeira', 'lance livre 25%', 'aguardando safra', 'sem interesse', 'não possui restrições')..."
                    className="pl-9 bg-[#F5F2EB]/50 border-[#D1CCC1] text-xs h-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#5C727D] pt-1">
                  <span>
                    A pesquisa analisa simultaneamente pareceres extensos, tags de interesse, perfil produtivo e resumos gerados por IA.
                  </span>
                  <span className="font-semibold text-[#1B4D3E]">
                    {contactsQuery.data?.length || 0} produtor(es) retornado(s)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[#D1CCC1]/40">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5C727D] flex items-center gap-1 mr-1">
                    <Tag className="w-3.5 h-3.5 text-[#1B4D3E]" /> Filtrar rapidamente:
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={interestTagFilter === 'all' ? 'default' : 'outline'}
                    className={interestTagFilter === 'all' ? 'bg-[#1B4D3E] text-white h-7 text-[11px] font-bold' : 'border-[#D1CCC1] text-[#1A3643] h-7 text-[11px] font-semibold'}
                    onClick={() => setInterestTagFilter('all')}
                  >
                    Todas as tags
                  </Button>
                  {interestTagOptions.map((tag) => (
                    <Button
                      key={tag}
                      type="button"
                      size="sm"
                      variant={interestTagFilter === tag ? 'default' : 'outline'}
                      className={interestTagFilter === tag ? 'bg-[#88B04B] text-[#1B4D3E] border-[#88B04B] h-7 text-[11px] font-extrabold shadow-xs' : 'border-[#D1CCC1] text-[#1A3643] h-7 text-[11px] font-semibold hover:bg-[#F5F2EB]'}
                      onClick={() => {
                        setInterestTagFilter(tag);
                        setActiveTab('contacts');
                      }}
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>

              {/* ALERTA EM DESTAQUE NO PAINEL PRINCIPAL: LEADS CLASSIFICADOS COM 'ALTO INTERESSE' POR IA */}
              {((statsQuery.data as any)?.highInterestCount || 0) > 0 && (
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-2 border-emerald-500 rounded-2xl p-5 shadow-md space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm animate-bounce" style={{ animationDuration: '2.5s' }}>
                        <Flame className="w-5 h-5 text-amber-300 fill-amber-300" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
                            🔥 Oportunidade Quente — Análise de Sentimento
                          </Badge>
                          <span className="text-xs font-bold text-emerald-900">
                            {(statsQuery.data as any).highInterestCount} lead(s) com 'Alto Interesse' identificado pela IA
                          </span>
                        </div>
                        <h4 className="text-base font-extrabold text-[#1B4D3E] mt-0.5">
                          Produtores Prontos para Apresentação e Fechamento
                        </h4>
                        <p className="text-xs text-[#5C727D]">
                          A inteligência artificial analisou as transcrições e confirmou forte adesão para consórcio de máquinas, implementos e fazendas.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="border-emerald-600 text-emerald-800 bg-white font-bold text-xs py-1 px-3">
                        Prioridade Máxima de Reunião
                      </Badge>
                    </div>
                  </div>

                  {/* Grid de leads com alto interesse */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-emerald-200">
                    {(statsQuery.data as any)?.highInterestLeads?.map((lead: any) => (
                      <div
                        key={lead.contactId}
                        className="p-3.5 bg-white rounded-xl border border-emerald-300 shadow-xs flex flex-col justify-between space-y-2.5 hover:border-emerald-500 transition-colors cursor-pointer"
                        onClick={() => setSelectedContactId(lead.contactId)}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <span className="font-extrabold text-[#1B4D3E] text-xs truncate block" title={lead.organization}>
                              {lead.organization}
                            </span>
                            <Badge className="bg-emerald-600 text-white text-[9px] font-extrabold px-1.5 py-0.2 shrink-0">
                              {lead.confidence}% Confiança
                            </Badge>
                          </div>
                          <span className="text-[11px] text-[#5C727D] block mt-0.5">
                            {lead.city} - {lead.state} • Ativo: <strong className="text-[#1B4D3E]">{lead.interestAsset}</strong>
                          </span>
                          {lead.reason && (
                            <p className="text-[11px] text-emerald-900 bg-emerald-50/80 p-1.5 rounded mt-1.5 line-clamp-2 border border-emerald-100 italic">
                              "{lead.reason}"
                            </p>
                          )}
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-emerald-100 text-[10px]">
                          <span className="text-[#5C727D]">
                            Consultor: <strong className="text-[#1B4D3E]">{lead.assignedRepName}</strong>
                          </span>
                          <span className="font-bold text-emerald-700 hover:underline flex items-center gap-0.5">
                            Abrir Ficha & Briefing <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ALERTA VISUAL DESTACADO: FOLLOW-UPS QUE ULTRAPASSARAM 48 HORAS SEM TRATAMENTO */}
              {(statsQuery.data as any)?.overdueFollowUpsCount > 0 && (
                <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-white border-2 border-rose-400/80 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shrink-0 animate-pulse">
                        <Clock className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
                            Atenção Comercial — Atraso Crítico
                          </Badge>
                          <span className="text-xs font-bold text-rose-800">
                            {(statsQuery.data as any).overdueFollowUpsCount} tarefa(s) ultrapassaram o prazo de 48 horas
                          </span>
                        </div>
                        <h4 className="text-base font-extrabold text-[#1B4D3E] mt-0.5">
                          Follow-ups de Segundo Contato Pendentes de Resposta
                        </h4>
                        <p className="text-xs text-[#5C727D]">
                          Produtores que receberam o primeiro roteiro via WhatsApp há mais de 48 horas e ainda não tiveram retorno nem avanço de reunião.
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-9 shadow-sm shrink-0"
                      onClick={() => setActiveTab('tasks')}
                    >
                      <CheckSquare className="w-4 h-4 mr-1.5" /> Tratar Follow-ups Vencidos na Aba Tarefas
                    </Button>
                  </div>

                  {/* Mini-cards das tarefas vencidas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2 border-t border-rose-200/60">
                    {(statsQuery.data as any)?.overdueFollowUpTasks?.slice(0, 6).map((task: any) => (
                      <div key={task.id} className="p-3 bg-white/90 rounded-xl border border-rose-200 text-xs shadow-2xs flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <span className="font-extrabold text-[#1B4D3E] truncate block">{task.contactName}</span>
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded shrink-0">
                              Vencido
                            </span>
                          </div>
                          <span className="text-[11px] text-[#5C727D] block">
                            {task.contactCity} • {task.title}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#5C727D] pt-1 border-t border-stone-100 font-mono">
                          <span>Prazo original: {new Date(task.dueDate).toLocaleDateString('pt-BR')}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedContactId(task.contactId);
                            }}
                            className="text-[#1B4D3E] hover:underline font-bold"
                          >
                            Abrir Lead →
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <button
                            type="button"
                            onClick={() => rescheduleTaskMutation.mutate({
                              id: task.id,
                              dueDate: new Date(Date.now() + 48 * 60 * 1000 * 60),
                              reason: 'Remarcado via ação rápida do painel para retorno em 48h.',
                            })}
                            className="px-2 py-1 rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200 font-bold text-[10px] transition-colors"
                          >
                            Remarcar +48h
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickResponseTaskId(task.id);
                              setQuickResponseContactName(task.contactName);
                              setQuickResponseStatus('respondeu');
                              setQuickResponseNotes('');
                              setIsQuickResponseModalOpen(true);
                            }}
                            className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-bold text-[10px] transition-colors"
                          >
                            Registrar resposta
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickResponseTaskId(task.id);
                              setQuickResponseContactName(task.contactName);
                              setQuickResponseStatus('reuniao_agendada');
                              setQuickResponseNotes('Reunião presencial / online alinhada a partir do follow-up.');
                              setIsQuickResponseModalOpen(true);
                            }}
                            className="px-2 py-1 rounded-md bg-[#1B4D3E] text-white hover:bg-[#163c31] font-bold text-[10px] transition-colors"
                          >
                            Marcar reunião
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPhoneCallTaskData(task);
                              setIsPhoneCallModalOpen(true);
                            }}
                            className="px-2 py-1 rounded-md bg-sky-100 text-sky-800 hover:bg-sky-200 font-bold text-[10px] transition-colors flex items-center gap-1"
                            title="Ver roteiro curto sugerido para ligação telefônica"
                          >
                            <PhoneCall className="w-3 h-3" /> Ligar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ALERTA E GERENCIAMENTO DESTACADO: PENDÊNCIAS GERADAS POR ATAS DE REUNIÃO */}
              {((statsQuery.data as any)?.minuteTasksCount || 0) > 0 && (
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-2 border-emerald-500/80 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                        <ClipboardCheck className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-700 text-white text-[10px] font-extrabold uppercase tracking-wider">
                            Desdobramentos Comerciais — Atas de Reunião
                          </Badge>
                          <span className="text-xs font-bold text-emerald-900">
                            {(statsQuery.data as any).minuteTasksCount} follow-up(s) ativos originados em reuniões
                          </span>
                        </div>
                        <h4 className="text-base font-extrabold text-[#1B4D3E] mt-0.5">
                          Tópicos Pendentes do Checklist & Compromissos Pós-Encontro
                        </h4>
                        <p className="text-xs text-[#5C727D]">
                          Pendências comerciais acordadas em visitas ou videoconferências que exigem envio de propostas, documentos ou alinhamentos de safra.
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-9 shadow-sm shrink-0 flex items-center gap-1.5"
                      onClick={() => {
                        setTaskSourceFilter('minute_only');
                        setActiveTab('tasks');
                      }}
                    >
                      <Filter className="w-4 h-4 text-emerald-200" /> Ver Apenas Follow-ups de Atas na Central
                    </Button>
                  </div>

                  {/* Mini cards das tarefas originadas de atas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2 border-t border-emerald-200/60">
                    {(statsQuery.data as any)?.minuteFollowUpTasks?.slice(0, 6).map((task: any) => (
                      <div key={task.id} className="p-3 bg-white/95 rounded-xl border border-emerald-200 text-xs shadow-2xs flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <span className="font-extrabold text-[#1B4D3E] truncate block">{task.contactName}</span>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                              Ata de Reunião
                            </span>
                          </div>
                          <span className="text-[11px] text-[#5C727D] block line-clamp-2 mt-0.5">
                            {task.title}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#5C727D] pt-1 border-t border-stone-100 font-mono">
                          <span>Prazo: {new Date(task.dueDate).toLocaleDateString('pt-BR')}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedContactId(task.contactId);
                            }}
                            className="text-emerald-800 hover:underline font-bold"
                          >
                            Ver Ficha →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

              {/* Gráficos de Conversão e Evolução */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="bg-white border-[#D1CCC1]">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg font-bold text-[#1B4D3E] flex items-center gap-2">
                          <UserCheck className="w-5 h-5 text-[#88B04B]" /> Conversão por Consultor
                        </CardTitle>
                        <CardDescription className="text-xs text-[#5C727D] mt-1">
                          Percentual de contratos fechados comparado com a meta mensal definida para o consultor.
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-[#EBE6DB] text-[#1B4D3E] border-[#D1CCC1]">
                        {repConversionChartData.length} consultores
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {repConversionChartData.length > 0 ? (
                      <div className="w-full overflow-x-auto">
                        <ComposedChart
                          width={560}
                          height={320}
                          data={repConversionChartData}
                          layout="vertical"
                          margin={{ top: 8, right: 30, left: 8, bottom: 8 }}
                          barCategoryGap={14}
                          onClick={(data: any) => {
                            const id = data?.activePayload?.[0]?.payload?.id;
                            handleRepChartClick({ id });
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E7E2D8" />
                          <XAxis
                            type="number"
                            domain={[0, 100]}
                            allowDecimals={false}
                            tickFormatter={(value) => `${value}%`}
                            tick={{ fill: '#5C727D', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="shortName"
                            width={150}
                            tick={{ fill: '#1A3643', fontSize: 11, fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <RechartsTooltip
                            cursor={{ fill: '#F5F2EB' }}
                            contentStyle={{ borderRadius: 10, border: '1px solid #D1CCC1', backgroundColor: '#FFFFFF', color: '#1A3643' }}
                            formatter={(value: any, name: any) => {
                              if (name === 'Conversão') return [`${value}%`, 'Conversão'];
                              if (name === 'Meta Mensal') return [`${value}%`, 'Meta Mensal'];
                              return [value, name];
                            }}
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
                          />
                          <Legend wrapperStyle={{ fontSize: 11, color: '#1A3643' }} />
                          <Bar dataKey="conversionRate" name="Conversão" fill="#1B4D3E" radius={[0, 6, 6, 0]} barSize={20} cursor="pointer" />
                          <Line dataKey="targetRate" name="Meta Mensal" type="monotone" stroke="#D39B39" strokeWidth={3} strokeDasharray="4 4" dot={{ r: 5, fill: '#D39B39' }} />
                        </ComposedChart>
                      </div>
                    ) : (
                      <div className="h-[320px] rounded-lg border border-dashed border-[#D1CCC1] bg-[#F5F2EB]/40 flex flex-col items-center justify-center text-center px-6">
                        <UserPlus className="w-8 h-8 text-[#88B04B] mb-3" />
                        <p className="font-bold text-[#1B4D3E]">Nenhum consultor cadastrado</p>
                        <p className="text-xs text-[#5C727D] mt-1 max-w-sm">Cadastre membros em “Equipe Comercial” e atribua as carteiras para acompanhar a conversão individual.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white border-[#D1CCC1]">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg font-bold text-[#1B4D3E] flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-[#88B04B]" /> Evolução Mensal
                        </CardTitle>
                        <CardDescription className="text-xs text-[#5C727D] mt-1">
                          Novos leads, fechamentos e crescimento acumulado da base nos últimos seis meses.
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-[#EBE6DB] text-[#1B4D3E] border-[#D1CCC1]">
                        6 meses
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {monthlyEvolutionChartData.length > 0 ? (
                      <div className="w-full overflow-x-auto">
                        <ComposedChart
                          width={560}
                          height={320}
                          data={monthlyEvolutionChartData}
                          margin={{ top: 8, right: 18, left: 0, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E7E2D8" />
                          <XAxis dataKey="label" tick={{ fill: '#5C727D', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="left" allowDecimals={false} tick={{ fill: '#5C727D', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fill: '#5C727D', fontSize: 11 }} axisLine={false} tickLine={false} />
                          <RechartsTooltip
                            contentStyle={{ borderRadius: 10, border: '1px solid #D1CCC1', backgroundColor: '#FFFFFF', color: '#1A3643' }}
                            formatter={(value: any, name: any) => [value, name]}
                          />
                          <Legend wrapperStyle={{ fontSize: 11, color: '#1A3643' }} />
                          <Bar yAxisId="left" dataKey="newLeads" name="Novos leads" fill="#88B04B" radius={[5, 5, 0, 0]} barSize={24} />
                          <Line yAxisId="left" type="monotone" dataKey="closedDeals" name="Fechados" stroke="#D39B39" strokeWidth={3} dot={{ r: 4, fill: '#D39B39' }} />
                          <Line yAxisId="right" type="monotone" dataKey="cumulativeLeads" name="Base acumulada" stroke="#1B4D3E" strokeWidth={3} dot={{ r: 4, fill: '#1B4D3E' }} />
                        </ComposedChart>
                      </div>
                    ) : (
                      <div className="h-[320px] flex items-center justify-center text-sm text-[#5C727D]">Carregando evolução mensal...</div>
                    )}
                    <p className="text-[11px] text-[#5C727D] mt-1">Fechamentos usam o mês da última atualização do lead enquanto o CRM não possui uma data de fechamento dedicada.</p>
                  </CardContent>
                </Card>
              </div>

              {/* Matriz combinada de interesse por consultor */}
              <Card className="bg-white border-[#D1CCC1]">
                <CardHeader className="pb-3">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg font-bold text-[#1B4D3E] flex items-center gap-2">
                        <Tag className="w-5 h-5 text-[#88B04B]" /> Tags de Interesse por Consultor
                      </CardTitle>
                      <CardDescription className="text-xs text-[#5C727D] mt-1">
                        Cruze o responsável pela carteira com uma classificação para priorizar abordagens e comparar a qualidade dos leads.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label="Filtrar matriz por consultor"
                        value={interestMatrixRepFilter}
                        onChange={(event) => setInterestMatrixRepFilter(event.target.value)}
                        className="h-8 min-w-[175px] rounded-lg border border-[#D1CCC1] bg-[#F5F2EB]/60 px-2 text-xs font-semibold text-[#1A3643] focus:outline-none focus:ring-2 focus:ring-[#88B04B]"
                      >
                        <option value="all">Todos os consultores</option>
                        {repsQuery.data?.map((rep) => (
                          <option key={rep.id} value={String(rep.id)}>{rep.name}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Filtrar matriz por tag de interesse"
                        value={interestMatrixTagFilter}
                        onChange={(event) => setInterestMatrixTagFilter(event.target.value)}
                        className="h-8 min-w-[190px] rounded-lg border border-[#D1CCC1] bg-[#F5F2EB]/60 px-2 text-xs font-semibold text-[#1A3643] focus:outline-none focus:ring-2 focus:ring-[#88B04B]"
                      >
                        <option value="all">Todas as classificações</option>
                        {interestTagOptions.map((tag) => (
                          <option key={tag} value={tag}>{tag}</option>
                        ))}
                        <option value="Sem classificação">Sem classificação</option>
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm text-left">
                      <thead className="bg-[#F5F2EB] text-[#5C727D] text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Consultor responsável</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Carteira</th>
                          {interestTagMatrixColumns.map((tag) => (
                            <th key={tag} className="py-2.5 px-3 font-semibold text-center">{tag}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D1CCC1]/50">
                        {interestTagMatrixRows.map((row) => (
                          <tr key={row.repId} className="hover:bg-[#F5F2EB]/40">
                            <td className="py-3 px-3 font-bold text-[#1A3643]">{row.repName}</td>
                            <td className="py-3 px-3 text-center font-semibold text-[#1B4D3E]">{row.totalContacts}</td>
                            {interestTagMatrixColumns.map((tag) => {
                              const count = row.tags.find((item) => item.tag === tag)?.count || 0;
                              return (
                                <td key={tag} className="py-3 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInterestTagFilter(tag);
                                      setActiveRepView(String(row.repId));
                                      setActiveTab('contacts');
                                    }}
                                    className={`min-w-9 rounded-full px-2 py-1 text-xs font-extrabold transition-colors ${count > 0 ? 'bg-[#E4F1D1] text-[#1B4D3E] hover:bg-[#CFE8AD]' : 'bg-[#F5F2EB] text-[#9A958B] hover:bg-[#EBE6DB]'}`}
                                    title={`Abrir ${count} contato(s) de ${row.repName} com a tag ${tag}`}
                                  >
                                    {count}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {interestTagMatrixRows.length === 0 && (
                    <div className="py-8 text-center text-sm text-[#5C727D]">Nenhum consultor encontrado para os filtros selecionados.</div>
                  )}
                  <p className="text-[11px] text-[#5C727D] mt-3">Clique em qualquer quantidade para abrir a base já filtrada pela carteira e pela tag correspondente.</p>
                </CardContent>
              </Card>

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
                    <Download className="w-4 h-4 mr-1.5" /> Exportar CSV + Observações
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsNewClientModalOpen(true)}
                    className="bg-[#88B04B] text-[#1B4D3E] font-bold hover:bg-[#88B04B]/90"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Adicionar Cliente (PF / PJ)
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

                {/* Filtro rápido por tags de classificação de interesse */}
                <div className="pt-3 border-t border-[#D1CCC1]/50 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#1B4D3E]" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5C727D]">Interesse do produtor:</span>
                    {interestTagFilter !== 'all' && (
                      <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold">
                        {interestTagFilter}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      variant={interestTagFilter === 'all' ? 'default' : 'outline'}
                      className={interestTagFilter === 'all' ? 'bg-[#1B4D3E] text-white h-7 text-[11px] font-bold' : 'border-[#D1CCC1] text-[#1A3643] h-7 text-[11px] font-semibold'}
                      onClick={() => setInterestTagFilter('all')}
                    >
                      Todos os interesses
                    </Button>
                    {interestTagOptions.map((tag) => (
                      <Button
                        key={tag}
                        type="button"
                        size="sm"
                        variant={interestTagFilter === tag ? 'default' : 'outline'}
                        className={interestTagFilter === tag ? 'bg-[#88B04B] text-[#1B4D3E] border-[#88B04B] h-7 text-[11px] font-extrabold shadow-xs' : 'border-[#D1CCC1] text-[#1A3643] h-7 text-[11px] font-semibold hover:bg-[#F5F2EB]'}
                        onClick={() => setInterestTagFilter(tag)}
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>
                </div>

                {(stateFilter !== 'all' || leadTypeFilter !== 'all' || leadBatchFilter !== 'all' || stageFilter !== 'all' || interestTagFilter !== 'all' || search) && (
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
                        setInterestTagFilter('all');
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
                {selectedContactIds.length > 0 && (
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-[#88B04B]/60 bg-[#F3F8E9] px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-[#1B4D3E]">
                      <CheckSquare className="w-4 h-4 text-[#1B4D3E]" />
                      <span className="font-extrabold">{selectedContactIds.length} produtor(es) selecionado(s)</span>
                      <span className="hidden sm:inline text-xs text-[#5C727D]">Aplique uma classificação em todos de uma vez.</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label="Classificação para aplicação em lote"
                        value={bulkInterestTag ?? '__none__'}
                        onChange={(event) => setBulkInterestTag(event.target.value === '__none__' ? null : event.target.value)}
                        className="h-8 min-w-[190px] rounded-lg border border-[#D1CCC1] bg-white px-2 text-xs font-semibold text-[#1A3643] focus:outline-none focus:ring-2 focus:ring-[#88B04B]"
                      >
                        <option value="__none__">Remover classificação</option>
                        {interestTagOptions.map((tag) => (
                          <option key={tag} value={tag}>{tag}</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        disabled={bulkUpdateInterestTagMutation.isPending}
                        onClick={applyBulkInterestTag}
                        className="h-8 bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90 text-xs font-bold"
                      >
                        <Tag className="w-3.5 h-3.5 mr-1.5" />
                        {bulkUpdateInterestTagMutation.isPending ? 'Aplicando...' : 'Aplicar tag em lote'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedContactIds([])}
                        className="h-8 border-[#D1CCC1] text-[#5C727D] text-xs"
                      >
                        Limpar seleção
                      </Button>
                    </div>
                  </div>
                )}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-[#5C727D]" />
                  <Input
                    placeholder="Pesquisar empresa, fazenda, município, cultura, telefone, tag ou termo das observações..."
                    className="pl-9 bg-[#F5F2EB]/50 border-[#D1CCC1]"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#F5F2EB] text-[#5C727D] text-xs uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-3 w-10">
                          <input
                            type="checkbox"
                            aria-label="Selecionar todos os contatos visíveis"
                            checked={allVisibleContactsSelected}
                            onChange={toggleAllVisibleContacts}
                            className="h-4 w-4 accent-[#1B4D3E] cursor-pointer"
                          />
                        </th>
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
                            <td className="py-3.5 px-3" onClick={(event) => event.stopPropagation()}>
                              <input
                                type="checkbox"
                                aria-label={`Selecionar ${contact.organization}`}
                                checked={selectedContactIds.includes(contact.id)}
                                onChange={() => toggleContactSelection(contact.id)}
                                className="h-4 w-4 accent-[#1B4D3E] cursor-pointer"
                              />
                            </td>
                            <td className="py-3.5 px-4 font-bold text-[#1B4D3E]">
                              {contact.organization}
                              <span className="block font-normal text-xs text-[#5C727D] font-mono">{contact.formattedPhone}</span>
                              {(contact as any).interestTag && (
                                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded border border-emerald-300">
                                  <Tag className="w-2.5 h-2.5" /> {(contact as any).interestTag}
                                </span>
                              )}
                              {(contact as any).observation && (
                                <span className="block text-[10px] text-[#5C727D] italic line-clamp-1 font-normal mt-0.5" title={(contact as any).observation}>
                                  📝 {(contact as any).observation}
                                </span>
                              )}
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-3xl font-extrabold text-[#1B4D3E]">Gestão da Equipe Comercial</h2>
                  <p className="text-sm text-[#5C727D]">
                    Cadastre consultores, acompanhe metas e distribua a carteira de produtores rurais.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadExecutivePDF}
                    className="border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#F5F2EB] font-semibold"
                  >
                    <Download className="w-4 h-4 mr-1.5" /> Relatório Executivo (PDF)
                  </Button>
                  {meQuery.data?.role === 'admin' && (
                    <Button
                      size="sm"
                      onClick={() => triggerTargetAlertMutation.mutate()}
                      className="bg-[#88B04B] text-[#1B4D3E] hover:bg-[#88B04B]/90 font-bold"
                    >
                      <Bell className="w-4 h-4 mr-1.5" /> Verificar Metas 100%
                    </Button>
                  )}
                </div>
              </div>

              {/* RANKING VISUAL DE CONSULTORES COM PÓDIO */}
              <Card className="bg-gradient-to-br from-white to-[#F5F2EB] border-[#D1CCC1] shadow-sm">
                <CardHeader className="pb-3 border-b border-[#D1CCC1]/60">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-xl font-bold text-[#1B4D3E] flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-[#D39B39]" /> Ranking Comercial de Fechamento do Mês
                      </CardTitle>
                      <CardDescription className="text-xs text-[#5C727D]">
                        Classificação oficial da equipe pelos maiores volumes financeiros fechados na safra.
                      </CardDescription>
                    </div>
                    <Badge className="bg-[#1B4D3E] text-[#88B04B]">Competência Atual</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-5">
                  {/* Pódio Top 3 */}
                  {(() => {
                    const sortedReps = [...(statsQuery.data?.repStats || [])].sort((a, b) => (b.actualFinancialAmount || 0) - (a.actualFinancialAmount || 0));
                    const top1 = sortedReps[0];
                    const top2 = sortedReps[1];
                    const top3 = sortedReps[2];

                    const formatCurrency = (val?: number) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

                    if (sortedReps.length === 0) {
                      return <p className="text-center text-sm text-[#5C727D] py-6">Nenhum consultor cadastrado para exibição do ranking.</p>;
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-2">
                        {/* 2º Lugar - Prata */}
                        <div className="p-4 bg-white rounded-xl border border-stone-300 shadow-sm text-center flex flex-col justify-between order-2 md:order-1 h-[210px]">
                          <div>
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-slate-800 font-extrabold text-sm mb-2 shadow-inner">
                              2º
                            </span>
                            <h4 className="font-bold text-[#1B4D3E] text-base truncate">{top2?.name || 'Vago'}</h4>
                            <span className="text-xs text-[#5C727D] block">{top2 ? `${top2.closedDeals} fechamento(s)` : 'Sem consultor'}</span>
                          </div>
                          <div className="pt-2 border-t border-[#D1CCC1]/40">
                            <span className="text-[10px] text-[#5C727D] uppercase font-bold block">Volume Fechado</span>
                            <span className="text-lg font-extrabold text-[#1B4D3E]">{formatCurrency(top2?.actualFinancialAmount)}</span>
                          </div>
                        </div>

                        {/* 1º Lugar - Ouro */}
                        <div className="p-5 bg-gradient-to-b from-amber-50 to-white rounded-xl border-2 border-[#D39B39] shadow-md text-center flex flex-col justify-between order-1 md:order-2 h-[240px] relative">
                          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#D39B39] text-[#1A3643] px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow">
                            👑 Líder do Mês
                          </div>
                          <div>
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-200 text-amber-900 font-black text-base mb-2 shadow-inner">
                              1º
                            </span>
                            <h4 className="font-extrabold text-[#1B4D3E] text-lg truncate">{top1?.name || 'Vago'}</h4>
                            <span className="text-xs text-[#5C727D] block font-medium">{top1 ? `${top1.closedDeals} fechamento(s)` : 'Sem consultor'}</span>
                          </div>
                          <div className="pt-2 border-t border-amber-200">
                            <span className="text-[10px] text-amber-800 uppercase font-black block">Volume Campeão</span>
                            <span className="text-2xl font-black text-[#1B4D3E]">{formatCurrency(top1?.actualFinancialAmount)}</span>
                          </div>
                        </div>

                        {/* 3º Lugar - Bronze */}
                        <div className="p-4 bg-white rounded-xl border border-amber-200/80 shadow-sm text-center flex flex-col justify-between order-3 md:order-3 h-[190px]">
                          <div>
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-extrabold text-sm mb-2 shadow-inner">
                              3º
                            </span>
                            <h4 className="font-bold text-[#1B4D3E] text-base truncate">{top3?.name || 'Vago'}</h4>
                            <span className="text-xs text-[#5C727D] block">{top3 ? `${top3.closedDeals} fechamento(s)` : 'Sem consultor'}</span>
                          </div>
                          <div className="pt-2 border-t border-[#D1CCC1]/40">
                            <span className="text-[10px] text-[#5C727D] uppercase font-bold block">Volume Fechado</span>
                            <span className="text-base font-extrabold text-[#1B4D3E]">{formatCurrency(top3?.actualFinancialAmount)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

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
                  const assigned = repStat?.assignedContacts || 0;
                  const closed = repStat?.closedDeals || 0;
                  const convRate = assigned > 0 ? Math.round((closed / assigned) * 100) : 0;
                  const targetRate = repStat?.targetRate || 0;
                  const targetAmount = repStat?.targetFinancialAmount || 0;
                  const actualAmount = repStat?.actualFinancialAmount || 0;

                  const hasRateTarget = targetRate > 0;
                  const hasAmountTarget = targetAmount > 0;
                  const rateMet = hasRateTarget && convRate >= targetRate;
                  const amountMet = hasAmountTarget && actualAmount >= targetAmount;
                  const isSuperAchiever = rateMet && amountMet;
                  const isAchiever = (rateMet || amountMet) || (hasRateTarget && rateMet) || (hasAmountTarget && amountMet);

                  const formatBRL = (val: number) => {
                    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
                  };

                  return (
                    <Card key={rep.id} className={`bg-white border shadow-sm transition-all ${
                      isSuperAchiever
                        ? 'border-emerald-400 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                        : isAchiever
                        ? 'border-[#88B04B] ring-1 ring-[#88B04B]/30'
                        : 'border-[#D1CCC1]'
                    }`}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-lg font-bold text-[#1B4D3E]">{rep.name}</CardTitle>
                              {isSuperAchiever ? (
                                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 text-[11px] font-bold shadow-sm">
                                  <CheckCircle2 className="w-3 h-3" /> Meta Batida (100%+)
                                </Badge>
                              ) : isAchiever ? (
                                <Badge className="bg-[#88B04B] text-[#1B4D3E] flex items-center gap-1 text-[11px] font-bold">
                                  <CheckCircle2 className="w-3 h-3" /> Meta Parcial Batida
                                </Badge>
                              ) : (hasRateTarget || hasAmountTarget) ? (
                                <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-800 text-[11px] font-semibold">
                                  Em Andamento
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-stone-300 text-stone-600 text-[11px]">
                                  Sem Meta
                                </Badge>
                              )}
                            </div>
                            <CardDescription className="text-xs text-[#5C727D] mt-0.5">{rep.email || 'Sem e-mail'} • {rep.phone || 'Sem telefone'}</CardDescription>
                          </div>
                          <Badge className="bg-[#1B4D3E] text-white shrink-0 text-xs">Consultor Ativo</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-4 gap-2 bg-[#F5F2EB] p-2.5 rounded-lg text-center">
                          <div>
                            <span className="text-[10px] text-[#5C727D] uppercase font-bold block">Carteira</span>
                            <span className="text-base font-extrabold text-[#1B4D3E]">{assigned}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#5C727D] uppercase font-bold block">Qualificados</span>
                            <span className="text-base font-extrabold text-[#88B04B]">{repStat?.qualifiedLeads || 0}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#5C727D] uppercase font-bold block">Fechados</span>
                            <span className="text-base font-extrabold text-emerald-700">{closed}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#5C727D] uppercase font-bold block">Conversão</span>
                            <span className="text-base font-extrabold text-[#1A3643]">{convRate}%</span>
                          </div>
                        </div>

                        {/* Metas e Desempenho em Reais */}
                        <div className="p-3 bg-white rounded-lg border border-[#D1CCC1]/70 space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-[#5C727D] font-medium flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5 text-[#88B04B]" /> Volume Financeiro Realizado:
                            </span>
                            <span className="font-extrabold text-[#1B4D3E]">
                              {formatBRL(actualAmount)}
                            </span>
                          </div>
                          {(repStat as any)?.quotedFinancialAmount > actualAmount && (
                            <div className="flex justify-between items-center text-[11px] text-[#5C727D]">
                              <span>Volume Cotado em Andamento:</span>
                              <span className="font-semibold text-[#1A3643]">{formatBRL((repStat as any).quotedFinancialAmount)}</span>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#D1CCC1]/40">
                            <div>
                              <span className="text-[11px] text-[#5C727D] block">Meta Conversão:</span>
                              <span className="font-bold text-[#1A3643]">
                                {hasRateTarget ? `${targetRate}%` : 'Não definida'}
                              </span>
                              {hasRateTarget && (
                                <span className={`text-[10px] block font-semibold ${convRate >= targetRate ? 'text-emerald-700' : 'text-amber-700'}`}>
                                  {convRate >= targetRate ? `✓ Superou (+${convRate - targetRate}%)` : `Faltam ${targetRate - convRate}%`}
                                </span>
                              )}
                            </div>

                            <div>
                              <span className="text-[11px] text-[#5C727D] block">Meta Financeira (R$):</span>
                              <span className="font-bold text-[#1A3643]">
                                {hasAmountTarget ? formatBRL(targetAmount) : 'Não definida'}
                              </span>
                              {hasAmountTarget && (
                                <span className={`text-[10px] block font-semibold ${actualAmount >= targetAmount ? 'text-emerald-700' : 'text-amber-700'}`}>
                                  {actualAmount >= targetAmount ? '✓ Atingida' : `${Math.round((actualAmount / targetAmount) * 100)}% atingido`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Formulário Admin para Configurar Metas */}
                        {meQuery.data?.role === 'admin' ? (
                          <div className="pt-2 border-t border-[#D1CCC1]/60 space-y-2">
                            <span className="text-[11px] font-bold text-[#1B4D3E] uppercase tracking-wider block">
                              Definir Metas do Mês ({repStat?.targetMonthKey || 'Atual'})
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="text-[10px] text-[#5C727D] block mb-0.5 font-medium">Meta Conversão (%):</label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  placeholder="0 a 100%"
                                  value={targetDrafts[rep.id] ?? (repStat?.targetRate || '')}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setTargetDrafts(prev => ({ ...prev, [rep.id]: Number.isNaN(val) ? 0 : Math.min(100, Math.max(0, val)) }));
                                  }}
                                  className="h-8 bg-[#F5F2EB]/60 border-[#D1CCC1] text-xs"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] text-[#5C727D] block mb-0.5 font-medium">Volume Financeiro (R$):</label>
                                <Input
                                  type="number"
                                  min={0}
                                  step={10000}
                                  placeholder="Ex: 1500000"
                                  value={targetFinancialDrafts[rep.id] ?? (repStat?.targetFinancialAmount || '')}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setTargetFinancialDrafts(prev => ({ ...prev, [rep.id]: Number.isNaN(val) ? 0 : Math.max(0, val) }));
                                  }}
                                  className="h-8 bg-[#F5F2EB]/60 border-[#D1CCC1] text-xs"
                                />
                              </div>
                            </div>

                            <Button
                              size="sm"
                              className="w-full h-8 bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90 text-xs font-semibold"
                              onClick={() => {
                                const monthKey = repStat?.targetMonthKey || `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
                                const rate = targetDrafts[rep.id] ?? (repStat?.targetRate || 0);
                                const fin = targetFinancialDrafts[rep.id] ?? (repStat?.targetFinancialAmount || 0);
                                setMonthlyTargetMutation.mutate({
                                  salesRepId: rep.id,
                                  monthKey,
                                  targetRate: rate,
                                  targetFinancialAmount: fin,
                                });
                              }}
                            >
                              Salvar Metas do Consultor
                            </Button>
                          </div>
                        ) : null}
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
                      <label className="text-xs font-bold text-[#5C727D] block mb-1">Webhook URL (Slack, Discord, n8n, WhatsApp API)</label>
                      <Input 
                        defaultValue={reminderSettingsQuery.data?.webhookUrl || ''}
                        onChange={(e) => setWebhookInput(e.target.value)}
                        placeholder="https://seu-webhook.com"
                        className="bg-[#F5F2EB]/60 border-[#D1CCC1]"
                      />
                    </div>

                    <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm text-[#1B4D3E] flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-[#D39B39]" /> Alerta Automático de Meta Atingida (100%+)
                          </span>
                          <p className="text-xs text-[#5C727D] mt-0.5">
                            Envia payload JSON para a Webhook URL sempre que um consultor atingir ou superar a meta financeira do mês.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          defaultChecked={reminderSettingsQuery.data?.targetAlertEnabled ?? true}
                          id="target-alert-toggle"
                          className="w-4 h-4 text-[#1B4D3E] rounded cursor-pointer"
                        />
                      </div>
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

              <div className="bg-white rounded-xl border border-[#D1CCC1] p-4 shadow-sm space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-extrabold text-[#5C727D] uppercase tracking-wider flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5 text-[#1B4D3E]" /> Exibir:
                    </span>
                    {([
                      ['all', 'Todas'],
                      ['pending', 'Pendentes'],
                      ['overdue', 'Vencidas (+48h)'],
                    ] as const).map(([value, label]) => (
                      <Button
                        key={value}
                        size="sm"
                        variant={taskStatusFilter === value ? 'default' : 'outline'}
                        className={taskStatusFilter === value ? 'bg-[#1B4D3E] text-white text-xs h-8 font-bold' : 'border-[#D1CCC1] text-[#1A3643] text-xs h-8 font-semibold'}
                        onClick={() => setTaskStatusFilter(value)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>

                  {/* Filtro por Origem: Geral vs Exclusivo de Atas de Reunião */}
                  <div className="flex items-center gap-1.5 bg-[#F5F2EB] p-1 rounded-lg border border-[#D1CCC1]">
                    <span className="text-[11px] font-bold text-[#5C727D] px-2 flex items-center gap-1">
                      <ClipboardCheck className="w-3.5 h-3.5 text-[#1B4D3E]" /> Origem:
                    </span>
                    <Button
                      size="sm"
                      variant={taskSourceFilter === 'all' ? 'default' : 'ghost'}
                      className={taskSourceFilter === 'all' ? 'bg-[#1B4D3E] text-white text-xs h-7 font-bold' : 'text-[#1A3643] text-xs h-7 font-semibold'}
                      onClick={() => setTaskSourceFilter('all')}
                    >
                      Todas as Origens
                    </Button>
                    <Button
                      size="sm"
                      variant={taskSourceFilter === 'minute_only' ? 'default' : 'ghost'}
                      className={taskSourceFilter === 'minute_only' ? 'bg-emerald-700 text-white text-xs h-7 font-bold' : 'text-emerald-800 text-xs h-7 font-semibold hover:bg-emerald-100/60'}
                      onClick={() => setTaskSourceFilter('minute_only')}
                    >
                      Atas de Reunião
                    </Button>
                    <Button
                      size="sm"
                      variant={taskSourceFilter === 'standard_only' ? 'default' : 'ghost'}
                      className={taskSourceFilter === 'standard_only' ? 'bg-[#1B4D3E] text-white text-xs h-7 font-bold' : 'text-[#1A3643] text-xs h-7 font-semibold'}
                      onClick={() => setTaskSourceFilter('standard_only')}
                    >
                      Rotina Comercial
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {meQuery.data?.role === 'admin' ? (
                      <select
                        value={taskConsultantFilter}
                        onChange={(e) => setTaskConsultantFilter(e.target.value as 'all' | string)}
                        className="h-8 bg-[#F5F2EB] border border-[#D1CCC1] rounded-lg px-2.5 text-xs font-semibold text-[#1A3643] focus:outline-none"
                        aria-label="Filtrar tarefas por consultor"
                      >
                        <option value="all">Todos os consultores</option>
                        {repsQuery.data?.map((rep) => (
                          <option key={rep.id} value={String(rep.id)}>{rep.name}</option>
                        ))}
                      </select>
                    ) : (
                      <Badge className="bg-[#EBE6DB] text-[#1B4D3E] border border-[#D1CCC1] text-xs font-bold">
                        Minha carteira: {meQuery.data?.name || activeRep?.name}
                      </Badge>
                    )}

                    <Button
                      size="sm"
                      disabled={!tasksQuery.data?.some((task: any) => task.isOverdue && !task.completed)}
                      className="bg-rose-600 hover:bg-rose-700 disabled:bg-stone-300 text-white text-xs h-8 font-bold shadow-sm"
                      onClick={() => {
                        setOverdueSequenceIndex(0);
                        setIsOverdueSequenceModalOpen(true);
                      }}
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1" />
                      Sequência 2º Contato ({tasksQuery.data?.filter((task: any) => task.isOverdue && !task.completed).length || 0})
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#5C727D] pt-2 border-t border-[#D1CCC1]/60">
                  <span>Consultores comerciais visualizam automaticamente apenas os leads atribuídos às suas próprias carteiras.</span>
                  <span className="font-mono font-bold">{tasksQuery.data?.length || 0} tarefa(s) nesta visão</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#D1CCC1] p-6 shadow-sm space-y-3">
                {tasksQuery.data?.map((task: any) => {
                  const isOverdue = task.isOverdue || (!task.completed && new Date(task.dueDate).getTime() < Date.now());
                  const suggestedTpl = task.suggestedTemplate;

                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-xl border transition-all space-y-3 ${
                        task.completed
                          ? 'bg-stone-50/70 border-stone-200 opacity-70'
                          : isOverdue
                          ? 'bg-rose-50/50 border-rose-300 shadow-xs ring-1 ring-rose-200'
                          : 'bg-white border-[#D1CCC1]/80 hover:bg-[#F5F2EB]/40'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={(e) => toggleTaskMutation.mutate({ id: task.id, completed: e.target.checked })}
                            className="w-4 h-4 text-[#1B4D3E] rounded cursor-pointer shrink-0 mt-0.5 sm:mt-0"
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-bold text-sm ${task.completed ? 'line-through text-[#5C727D]' : 'text-[#1B4D3E]'}`}>
                                {task.title}
                              </span>
                              {task.isFromMeetingMinute && (
                                <Badge className="bg-emerald-700 text-white text-[10px] font-extrabold flex items-center gap-1">
                                  <ClipboardCheck className="w-3 h-3" /> Origem: Ata de Reunião
                                </Badge>
                              )}
                              {isOverdue && (
                                <Badge className="bg-rose-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
                                  Atrasado (+48h)
                                </Badge>
                              )}
                              {task.contactName && (
                                <Badge variant="outline" className="border-[#1B4D3E] text-[#1B4D3E] text-[10px] font-semibold">
                                  {task.contactName} ({task.contactCity || 'Agro'})
                                </Badge>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-xs text-[#5C727D] mt-0.5 leading-relaxed">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <span className={`text-xs font-mono font-bold ${isOverdue ? 'text-rose-700' : 'text-[#5C727D]'}`}>
                            Prazo: {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      {/* Sugestão Automática de Modelo de Segundo Contato (48h) */}
                      {!task.completed && suggestedTpl && (
                        <div className="bg-white p-3 rounded-lg border border-[#D1CCC1]/80 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-[#1B4D3E] flex items-center gap-1.5">
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                              Sugestão de Segundo Contato: <strong>{suggestedTpl.title}</strong>
                            </span>
                            <span className="text-[10px] text-[#5C727D] uppercase font-bold">
                              {suggestedTpl.category}
                            </span>
                          </div>

                          {(() => {
                            const rendered = renderTaskScript(suggestedTpl.content, task);

                            return (
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-stone-100">
                                <p className="text-[11px] text-[#5C727D] line-clamp-1 italic max-w-xl">
                                  "{rendered}"
                                </p>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 shrink-0 flex items-center gap-1 shadow-2xs"
                                  onClick={() => {
                                    // 1. Gravar disparo
                                    recordDispatchMutation.mutate({
                                      templateId: suggestedTpl.id,
                                      contactId: task.contactId,
                                      title: suggestedTpl.title,
                                      content: rendered,
                                    });

                                    // 2. Concluir a tarefa atual
                                    toggleTaskMutation.mutate({ id: task.id, completed: true });

                                    // 3. Abrir WhatsApp Web
                                    const cleanPhone = (task.contactPhone || '').replace(/\D/g, '');
                                    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                                    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(rendered)}`, '_blank');
                                    toast.success(`Segundo contato enviado e tarefa de follow-up concluída com sucesso!`);
                                  }}
                                >
                                  <MessageCircle className="w-3.5 h-3.5" /> Disparar 2º Contato no WhatsApp
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-sky-300 text-sky-800 hover:bg-sky-50 font-bold text-xs h-8 shrink-0 flex items-center gap-1 shadow-2xs"
                                  onClick={() => {
                                    setPhoneCallTaskData(task);
                                    setIsPhoneCallModalOpen(true);
                                  }}
                                >
                                  <PhoneCall className="w-3.5 h-3.5" /> Roteiro Ligação Telefônica
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#F5F2EB] font-bold text-xs h-8 shrink-0 flex items-center gap-1"
                                  onClick={() => {
                                    setQuickResponseTaskId(task.id);
                                    setQuickResponseContactName(task.contactName);
                                    setQuickResponseStatus('respondeu');
                                    setQuickResponseNotes('');
                                    setIsQuickResponseModalOpen(true);
                                  }}
                                >
                                  Registrar Feedback / Anotação
                                </Button>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB MODELOS DE MENSAGEM */}
          {activeTab === 'templates' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-extrabold text-[#1B4D3E]">Scripts & Modelos Homologados</h2>
                  <p className="text-sm text-[#5C727D]">
                    Abordagens comerciais de alta conversão: transmitem clareza imediata sobre a economia do consórcio e conduzem ao agendamento de reunião.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex bg-[#F5F2EB] p-1 rounded-lg border border-[#D1CCC1]">
                    <Button
                      size="sm"
                      variant={scriptSubTab === 'scripts' ? 'default' : 'ghost'}
                      className={scriptSubTab === 'scripts' ? 'bg-[#1B4D3E] text-white text-xs h-8 font-bold' : 'text-[#1A3643] text-xs h-8 font-semibold'}
                      onClick={() => setScriptSubTab('scripts')}
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5" /> Roteiros Homologados
                    </Button>
                    <Button
                      size="sm"
                      variant={scriptSubTab === 'metrics' ? 'default' : 'ghost'}
                      className={scriptSubTab === 'metrics' ? 'bg-[#1B4D3E] text-white text-xs h-8 font-bold' : 'text-[#1A3643] text-xs h-8 font-semibold'}
                      onClick={() => setScriptSubTab('metrics')}
                    >
                      <TrendingUp className="w-3.5 h-3.5 mr-1.5 text-[#88B04B]" /> Métricas de Resposta
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-600 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 text-xs h-9 font-bold shadow-sm"
                    onClick={() => {
                      setIsBulkSequenceModalOpen(true);
                      setBulkCultureFilter('Grãos e Cereais');
                      setBulkCurrentIndex(0);
                      const firstScript = templatesQuery.data?.[0];
                      if (firstScript) setBulkScriptId(String(firstScript.id));
                      // Inicializar lista de selecionados da cultura
                      const filtered = contactsQuery.data?.filter(c => c.segment.includes('Grãos') || (c.activity && c.activity.toLowerCase().includes('grãos'))) || [];
                      setBulkSelectedContactIds(filtered.map(c => c.id));
                    }}
                  >
                    <MessageCircle className="w-4 h-4 mr-1.5 text-emerald-600" /> Disparos em Sequência (Por Cultura)
                  </Button>

                  <Button
                    size="sm"
                    className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90 text-xs h-9 font-bold shadow-sm"
                    onClick={() => {
                      setNewScriptTitle('');
                      setNewScriptCategory('Prospecção WhatsApp');
                      setNewScriptSegment('Geral');
                      setNewScriptContent('');
                      setNewScriptUsage('');
                      setNewScriptModalOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1 text-[#88B04B]" /> Adicionar Script
                  </Button>
                </div>
              </div>

              {/* Barra de Filtros e Busca de Scripts */}
              {scriptSubTab === 'scripts' ? (
                <>
              <div className="bg-white rounded-xl border border-[#D1CCC1] p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                  <span className="text-[11px] font-bold text-[#5C727D] uppercase tracking-wider shrink-0">Etapa:</span>
                  <Button
                    size="sm"
                    variant={templateCategoryFilter === 'all' ? 'default' : 'outline'}
                    className={templateCategoryFilter === 'all' ? 'bg-[#1B4D3E] text-white text-xs' : 'border-[#D1CCC1] text-[#1A3643] text-xs'}
                    onClick={() => setTemplateCategoryFilter('all')}
                  >
                    Todos ({templatesQuery.data?.length || 0})
                  </Button>
                  <Button
                    size="sm"
                    variant={templateCategoryFilter === 'Prospecção WhatsApp' ? 'default' : 'outline'}
                    className={templateCategoryFilter === 'Prospecção WhatsApp' ? 'bg-[#1B4D3E] text-white text-xs' : 'border-[#D1CCC1] text-[#1A3643] text-xs'}
                    onClick={() => setTemplateCategoryFilter('Prospecção WhatsApp')}
                  >
                    WhatsApp Direto
                  </Button>
                  <Button
                    size="sm"
                    variant={templateCategoryFilter === 'Reunião Comercial' ? 'default' : 'outline'}
                    className={templateCategoryFilter === 'Reunião Comercial' ? 'bg-[#1B4D3E] text-white text-xs' : 'border-[#D1CCC1] text-[#1A3643] text-xs'}
                    onClick={() => setTemplateCategoryFilter('Reunião Comercial')}
                  >
                    Reunião Presencial / Vídeo
                  </Button>
                  <Button
                    size="sm"
                    variant={templateCategoryFilter === 'Quebra de Objeções' ? 'default' : 'outline'}
                    className={templateCategoryFilter === 'Quebra de Objeções' ? 'bg-[#1B4D3E] text-white text-xs' : 'border-[#D1CCC1] text-[#1A3643] text-xs'}
                    onClick={() => setTemplateCategoryFilter('Quebra de Objeções')}
                  >
                    Objeções (Prazo / Lance)
                  </Button>
                  <Button
                    size="sm"
                    variant={templateCategoryFilter === 'Follow-up' ? 'default' : 'outline'}
                    className={templateCategoryFilter === 'Follow-up' ? 'bg-[#1B4D3E] text-white text-xs' : 'border-[#D1CCC1] text-[#1A3643] text-xs'}
                    onClick={() => setTemplateCategoryFilter('Follow-up')}
                  >
                    Follow-up
                  </Button>
                </div>

                <div className="w-full md:w-72 relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#5C727D]" />
                  <Input
                    placeholder="Buscar script por palavra-chave..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    className="pl-9 h-9 text-xs bg-[#F5F2EB]/50 border-[#D1CCC1]"
                  />
                </div>
              </div>

              {/* Listagem de Cartões de Scripts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templatesQuery.data
                  ?.filter((tpl) => {
                    const matchCat = templateCategoryFilter === 'all' || tpl.category === templateCategoryFilter;
                    const matchSearch = !templateSearch.trim() ||
                      tpl.title.toLowerCase().includes(templateSearch.toLowerCase()) ||
                      tpl.content.toLowerCase().includes(templateSearch.toLowerCase()) ||
                      (tpl.segment && tpl.segment.toLowerCase().includes(templateSearch.toLowerCase()));
                    return matchCat && matchSearch;
                  })
                  .map((tpl) => {
                    const userVariant = myVariantsQuery.data?.find((v) => v.templateId === tpl.id);
                    const activeTitle = userVariant ? userVariant.title : tpl.title;
                    const activeContent = userVariant ? userVariant.content : tpl.content;
                    const isCopied = copiedTemplateId === tpl.id;

                    return (
                      <Card key={tpl.id} className={`bg-white border shadow-sm flex flex-col justify-between hover:border-[#1B4D3E] transition-all ${
                        userVariant ? 'border-[#88B04B] ring-1 ring-[#88B04B]/30' : 'border-[#D1CCC1]'
                      }`}>
                        <CardHeader className="pb-3 border-b border-[#D1CCC1]/40">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Badge className="bg-[#EBE6DB] text-[#1B4D3E] border-[#D1CCC1] text-[11px] font-bold">
                                {tpl.category}
                              </Badge>
                              {userVariant && (
                                <Badge className="bg-[#88B04B] text-[#1B4D3E] text-[10px] font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Minha Versão Salva
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-[#5C727D] bg-[#F5F2EB] px-2 py-0.5 rounded">
                              Segmento: {tpl.segment || 'Geral'}
                            </span>
                          </div>

                          <CardTitle className="text-base font-extrabold text-[#1B4D3E] mt-2">
                            {activeTitle}
                          </CardTitle>
                          {tpl.recommendedUsage && (
                            <CardDescription className="text-xs text-[#5C727D] mt-1 leading-snug">
                              💡 <strong>Objetivo tático:</strong> {tpl.recommendedUsage}
                            </CardDescription>
                          )}
                        </CardHeader>

                        <CardContent className="space-y-3 pt-3 flex-1 flex flex-col justify-between">
                          <div className="bg-[#F5F2EB] p-3.5 rounded-lg border border-[#D1CCC1]/60 font-sans text-xs text-[#1A3643] leading-relaxed whitespace-pre-wrap select-all">
                            {activeContent}
                          </div>

                          <div className="space-y-2 pt-2">
                            {/* Ações Rápidas: Enviar WhatsApp + Copiar com Feedback + Editar Variação */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 flex items-center justify-center gap-1.5 shadow-sm"
                                onClick={() => {
                                  setWhatsAppActiveScript({ id: tpl.id, title: activeTitle, content: activeContent });
                                  // Pré-preencher com primeiro contato ou defaults
                                  const defaultContact = contactsQuery.data?.[0];
                                  if (defaultContact) {
                                    setWhatsAppTargetContactId(defaultContact.id);
                                    setWhatsAppCustomName(defaultContact.organization);
                                    setWhatsAppCustomOrg(defaultContact.organization);
                                    setWhatsAppCustomPhone(defaultContact.phone);
                                    setWhatsAppCustomCity(defaultContact.city);
                                    setWhatsAppCustomAsset(defaultContact.interestAsset || 'Tratores e Implementos');
                                  } else {
                                    setWhatsAppTargetContactId(null);
                                    setWhatsAppCustomName('Produtor Rural');
                                    setWhatsAppCustomOrg('Propriedade Agrícola');
                                    setWhatsAppCustomPhone('');
                                    setWhatsAppCustomCity('Região');
                                    setWhatsAppCustomAsset('Tratores e Implementos');
                                  }
                                  setWhatsAppCustomConsultant(meQuery.data?.name || (activeRep ? activeRep.name : 'Wesley Amancio'));
                                  setWhatsAppCustomReferrer('Revenda Parceira');
                                  setWhatsAppModalOpen(true);
                                }}
                              >
                                <MessageCircle className="w-4 h-4 text-white" /> Abrir no WhatsApp Web
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className={`border text-xs h-9 font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                                  isCopied
                                    ? 'bg-emerald-500 text-white border-emerald-600 scale-[1.02] shadow-sm'
                                    : 'border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#F5F2EB]'
                                }`}
                                onClick={() => {
                                  navigator.clipboard.writeText(activeContent);
                                  setCopiedTemplateId(tpl.id);
                                  toast.success(`Script "${activeTitle}" copiado para a área de transferência!`);
                                  setTimeout(() => {
                                    setCopiedTemplateId((prev) => (prev === tpl.id ? null : prev));
                                  }, 2200);
                                }}
                              >
                                {isCopied ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 text-white animate-bounce" /> Copiado com Sucesso!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4 text-[#88B04B]" /> Copiar Roteiro
                                  </>
                                )}
                              </Button>
                            </div>

                            {/* Botão de personalização por consultor */}
                            <div className="flex items-center justify-between pt-1 border-t border-[#D1CCC1]/40 text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTemplate({
                                    id: tpl.id,
                                    originalTitle: tpl.title,
                                    originalContent: tpl.content,
                                  });
                                  setVariantTitleInput(activeTitle);
                                  setVariantContentInput(activeContent);
                                  setEditVariantModalOpen(true);
                                }}
                                className="text-[#1B4D3E] hover:text-[#88B04B] font-bold flex items-center gap-1"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                {userVariant ? 'Editar Minha Variação' : 'Criar e Salvar Minha Variação'}
                              </button>

                              {userVariant && (
                                <button
                                  type="button"
                                  onClick={() => resetVariantMutation.mutate({ templateId: tpl.id })}
                                  className="text-stone-500 hover:text-rose-600 flex items-center gap-1"
                                  title="Restaurar para a versão original homologada"
                                >
                                  <RotateCcw className="w-3 h-3" /> Restaurar Original
                                </button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
                </>
              ) : (
                /* PAINEL DE MÉTRICAS DE RESPOSTA E AGENDAMENTOS */
                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-2xl border border-[#D1CCC1] shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-[#D1CCC1]/60">
                      <div>
                        <h3 className="text-lg font-extrabold text-[#1B4D3E] flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-[#88B04B]" /> Eficiência Comercial por Roteiro
                        </h3>
                        <p className="text-xs text-[#5C727D] mt-0.5">
                          Rastreamento em tempo real de envios via WhatsApp, respostas obtidas e taxa de conversão em reuniões agendadas.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Filtro Comparativo por Consultor */}
                        {meQuery.data?.role === 'admin' ? (
                          <div className="flex items-center gap-1.5 bg-[#F5F2EB] p-1 rounded-lg border border-[#D1CCC1]">
                            <span className="text-[11px] font-bold text-[#5C727D] px-2">Consultor:</span>
                            <Button
                              size="sm"
                              variant={metricsConsultantFilter === 'all' ? 'default' : 'ghost'}
                              className={metricsConsultantFilter === 'all' ? 'bg-[#1B4D3E] text-white text-xs h-7 font-bold' : 'text-[#1A3643] text-xs h-7'}
                              onClick={() => setMetricsConsultantFilter('all')}
                            >
                              Consolidado (Equipe)
                            </Button>
                            {repsQuery.data?.map(rep => (
                              <Button
                                key={rep.id}
                                size="sm"
                                variant={metricsConsultantFilter === String(rep.id) ? 'default' : 'ghost'}
                                className={metricsConsultantFilter === String(rep.id) ? 'bg-[#1B4D3E] text-white text-xs h-7 font-bold' : 'text-[#1A3643] text-xs h-7'}
                                onClick={() => setMetricsConsultantFilter(String(rep.id))}
                              >
                                {rep.name}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <Badge className="bg-[#EBE6DB] text-[#1B4D3E] text-xs font-bold border border-[#D1CCC1]">
                            Consultor: {meQuery.data?.name}
                          </Badge>
                        )}

                        <Badge className="bg-[#1B4D3E] text-[#88B04B] text-xs">
                          {scriptMetricsQuery.data?.reduce((acc, m) => acc + m.totalSent, 0) || 0} Envios
                        </Badge>

                        {/* Botões de Exportação do Relatório de Conversão por Cultura */}
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#F5F2EB] text-xs h-7 font-bold flex items-center gap-1"
                            onClick={handleExportCultureConversionPDF}
                          >
                            <FileDown className="w-3.5 h-3.5 text-rose-600" /> Exportar PDF (Culturas)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-emerald-600 text-emerald-800 hover:bg-emerald-50 text-xs h-7 font-bold flex items-center gap-1"
                            onClick={handleExportCultureConversionExcel}
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Exportar Excel (Culturas)
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto pt-4">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#D1CCC1] text-[#5C727D] font-bold uppercase tracking-wider text-[11px]">
                            <th className="pb-3 pr-4">Roteiro / Abordagem</th>
                            <th className="pb-3 px-3">Etapa</th>
                            <th className="pb-3 px-3 text-center">Disparos</th>
                            <th className="pb-3 px-3 text-center">Respostas</th>
                            <th className="pb-3 px-3 text-center">Taxa Resposta</th>
                            <th className="pb-3 px-3 text-center">Reuniões Agendadas</th>
                            <th className="pb-3 pl-3 text-right">Conversão em Reunião</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#D1CCC1]/40">
                          {scriptMetricsQuery.data?.map((m) => (
                            <tr key={m.templateId} className="hover:bg-[#F5F2EB]/50 transition-colors">
                              <td className="py-3 pr-4 font-extrabold text-[#1B4D3E]">
                                {m.title}
                              </td>
                              <td className="py-3 px-3">
                                <span className="bg-[#EBE6DB] text-[#1B4D3E] px-2 py-0.5 rounded text-[10px] font-bold">
                                  {m.category}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-[#1A3643]">
                                {m.totalSent}
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-emerald-700">
                                {m.respondedCount}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="font-extrabold text-[#1B4D3E] bg-[#88B04B]/20 px-2 py-0.5 rounded">
                                  {m.responseRate}%
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center font-bold text-[#D39B39]">
                                {m.meetingCount}
                              </td>
                              <td className="py-3 pl-3 text-right">
                                <span className="font-extrabold text-[#1B4D3E] bg-[#D39B39]/20 px-2 py-0.5 rounded">
                                  {m.meetingConversionRate}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
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
                  {/* Indicador Visual com o Número Exato de Remarcações Realizadas */}
                  <div className="flex items-center gap-1.5">
                    <Badge
                      className={`${
                        ((detailQuery.data as any)?.reschedulesCount || 0) >= 3
                          ? 'bg-rose-600 text-white font-extrabold shadow-sm'
                          : ((detailQuery.data as any)?.reschedulesCount || 0) > 0
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      } text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1.5`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        <strong>{((detailQuery.data as any)?.reschedulesCount || 0)}</strong> {((detailQuery.data as any)?.reschedulesCount || 0) === 1 ? 'remarcação realizada' : 'remarcações realizadas'}
                      </span>
                      {((detailQuery.data as any)?.reschedulesCount || 0) >= 3 && (
                        <span className="bg-white/20 text-white text-[9px] px-1.5 py-0.2 rounded font-mono uppercase tracking-wider">
                          Frio / Rebaixado
                        </span>
                      )}
                    </Badge>
                  </div>
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
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#88B04B] text-[#1B4D3E] hover:bg-[#88B04B]/20 font-bold text-xs shadow-sm flex items-center gap-1.5"
                      disabled={generateBriefingMutation.isPending}
                      onClick={() => generateBriefingMutation.mutate({ contactId: selectedContact.id })}
                      title="Gerar resumo executivo e briefing inteligente com histórico completo antes da reunião"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-600 animate-spin" style={{ animationDuration: generateBriefingMutation.isPending ? '1.5s' : '0s' }} />
                      {generateBriefingMutation.isPending ? 'Gerando Briefing IA...' : 'Briefing Pré-Reunião (IA)'}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#1B4D3E] hover:bg-[#163c31] text-white font-bold text-xs shadow-sm"
                      onClick={() => {
                        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
                        setMeetingDateInput(tomorrow.toISOString().slice(0, 10));
                        setMeetingTimeInput('14:00');
                        setMeetingLocationInput('Fazenda / Sede do Produtor');
                        setIsMeetingConfirmationModalOpen(true);
                      }}
                    >
                      <Calendar className="w-4 h-4 mr-1.5 text-[#88B04B]" /> Confirmar Reunião (WhatsApp)
                    </Button>
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm"
                      onClick={() => {
                        setReminderTimeInput('14:00');
                        setReminderLocationInput('Fazenda / Sede do Produtor');
                        setIsMeetingReminderModalOpen(true);
                      }}
                      title="Enviar lembrete de reunião no WhatsApp 2 horas antes do encontro"
                    >
                      <Bell className="w-4 h-4 mr-1.5" /> Lembrete 2h Antes (WhatsApp)
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                      onClick={() => handleWhatsAppClick(selectedContact.phone, selectedContact.organization, selectedContact.city, selectedContact.interestAsset)}
                    >
                      <MessageCircle className="w-4 h-4 mr-1.5" /> Iniciar WhatsApp
                    </Button>
                  </div>
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

              {/* CAMPO DE OBSERVAÇÃO DETALHADA DO CONTATO (ATÉ 3.000 CARACTERES) */}
              <div className="bg-white p-4 rounded-xl border border-[#D1CCC1] shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h4 className="font-extrabold text-sm text-[#1B4D3E] flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#88B04B]" /> Observações & Parecer do Produtor (Até 3.000 caracteres)
                    </h4>
                    <p className="text-[11px] text-[#5C727D]">
                      Registre detalhadamente cada contato realizado, se o cliente demonstrou interesse, perfil de tomada de decisão, faturamento ou restrições.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-mono ${contactObservationInput.length > 2900 ? 'text-rose-600 font-bold' : 'text-[#5C727D]'}`}>
                      {contactObservationInput.length}/3000 caracteres
                    </span>
                    {!isEditingObservation && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#1B4D3E] text-[#1B4D3E] text-xs h-7 font-bold hover:bg-[#F5F2EB]"
                        onClick={() => setIsEditingObservation(true)}
                      >
                        <Edit3 className="w-3.5 h-3.5 mr-1" /> Editar Parecer
                      </Button>
                    )}
                  </div>
                </div>

                {/* TAGS RÁPIDAS DE CLASSIFICAÇÃO DE INTERESSE ACIMA DO CAMPO DE OBSERVAÇÃO */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-[#F5F2EB] border border-[#D1CCC1]/60">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-extrabold text-[#5C727D] uppercase tracking-wider flex items-center gap-1 mr-1">
                      <Tag className="w-3.5 h-3.5 text-[#1B4D3E]" /> Classificação Rápida:
                    </span>
                    {[
                      { label: 'Interesse Imediato', color: 'bg-emerald-600 text-white', hover: 'hover:bg-emerald-700' },
                      { label: 'Aguardando Safra', color: 'bg-amber-600 text-white', hover: 'hover:bg-amber-700' },
                      { label: 'Avalia Lance Livre', color: 'bg-sky-600 text-white', hover: 'hover:bg-sky-700' },
                      { label: 'Em Negociação Ativa', color: 'bg-[#1B4D3E] text-white', hover: 'hover:bg-[#163c31]' },
                      { label: 'Sem Interesse no Momento', color: 'bg-stone-500 text-white', hover: 'hover:bg-stone-600' },
                      { label: 'Sem Retorno (+48h)', color: 'bg-rose-600 text-white', hover: 'hover:bg-rose-700' },
                    ].map((tag) => {
                      const currentTag = (detailQuery.data?.contact as any)?.interestTag || (selectedContact as any).interestTag;
                      const isSelected = currentTag === tag.label;
                      return (
                        <button
                          key={tag.label}
                          type="button"
                          disabled={updateInterestTagMutation.isPending}
                          onClick={() => {
                            updateInterestTagMutation.mutate({
                              contactId: selectedContact.id,
                              interestTag: isSelected ? null : tag.label,
                            });
                          }}
                          className={`text-[11px] px-2.5 py-1 rounded-full font-bold transition-all flex items-center gap-1 ${
                            isSelected
                              ? `${tag.color} shadow-xs ring-2 ring-[#1B4D3E]/30`
                              : 'bg-white text-[#1A3643] border border-[#D1CCC1] hover:bg-stone-100'
                          }`}
                        >
                          {isSelected && '✓ '}
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Botão de Resumo Automático por IA */}
                  <div className="shrink-0 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        summarizeObservationMutation.isPending ||
                        !((detailQuery.data?.contact as any)?.observation || (selectedContact as any).observation) ||
                        (((detailQuery.data?.contact as any)?.observation || (selectedContact as any).observation)?.trim().length < 20)
                      }
                      onClick={() => {
                        summarizeObservationMutation.mutate({ contactId: selectedContact.id });
                      }}
                      className="border-emerald-600 text-emerald-800 hover:bg-emerald-50 text-xs h-7 font-bold shadow-2xs flex items-center gap-1.5"
                      title="Gerar resumo executivo dos pontos principais de interesse com IA"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-spin" style={{ animationDuration: summarizeObservationMutation.isPending ? '1.5s' : '0s' }} />
                      {summarizeObservationMutation.isPending ? 'Resumindo com IA...' : 'Resumir com IA'}
                    </Button>
                  </div>
                </div>

                {/* CARD DE RESUMO AUTOMÁTICO GERADO POR IA */}
                {Boolean((detailQuery.data?.contact as any)?.observationSummary || (selectedContact as any).observationSummary) && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-white border border-emerald-300 text-xs shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-700" />
                        <span className="font-extrabold text-[#1B4D3E] uppercase tracking-wider text-[11px]">
                          Síntese Executiva de IA — Principais Pontos de Interesse
                        </span>
                      </div>
                      <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                        Destaques Automáticos
                      </Badge>
                    </div>
                    <div className="text-[#1A3643] leading-relaxed whitespace-pre-wrap font-sans text-xs">
                      {(detailQuery.data?.contact as any)?.observationSummary || (selectedContact as any).observationSummary}
                    </div>
                  </div>
                )}

                {isEditingObservation ? (
                  <div className="space-y-2">
                    <textarea
                      rows={5}
                      maxLength={3000}
                      value={contactObservationInput}
                      onChange={(e) => setContactObservationInput(e.target.value)}
                      placeholder="Exemplo: Entrei em contato com o produtor no dia 21/09. Ele demonstrou interesse na compra de duas colheitadeiras para a próxima safra de soja, porém no momento aguarda liquidação de recebíveis de grãos em novembro. Não possui restrições cadastrais, prefere parcelas anuais pós-colheita e aceita avaliar simulação de lance livre de 25% a 30%..."
                      className="w-full p-3 rounded-lg border border-[#D1CCC1] text-xs bg-white text-[#1A3643] focus:ring-1 focus:ring-[#1B4D3E] focus:border-[#1B4D3E] font-sans leading-relaxed"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-8 text-[#5C727D]"
                        onClick={() => {
                          setContactObservationInput((selectedContact as any).observation || '');
                          setIsEditingObservation(false);
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        disabled={updateObservationMutation.isPending}
                        onClick={() => {
                          updateObservationMutation.mutate({
                            contactId: selectedContact.id,
                            observation: contactObservationInput,
                          });
                        }}
                        className="bg-[#1B4D3E] hover:bg-[#163c31] text-white text-xs h-8 font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#88B04B]" />
                        {updateObservationMutation.isPending ? 'Salvando...' : 'Salvar Observação'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-lg bg-[#F5F2EB]/70 border border-[#D1CCC1]/60 text-xs text-[#1A3643] leading-relaxed whitespace-pre-wrap select-text">
                    {(selectedContact as any).observation ? (
                      (selectedContact as any).observation
                    ) : (
                      <span className="italic text-[#5C727D]">
                        Nenhuma observação comercial registrada ainda para este produtor. Clique em "Editar Parecer" para descrever se o cliente terá interesse ou não.
                      </span>
                    )}
                  </div>
                )}
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

              {/* Seletor Rápido de Scripts Homologados para Envio Imediato */}
              <div className="bg-[#F5F2EB] p-4 rounded-xl border border-[#D1CCC1] space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h4 className="font-bold text-sm text-[#1B4D3E] flex items-center gap-2">
                    <Send className="w-4 h-4 text-[#88B04B]" /> Envio Rápido de Script via WhatsApp (1 Clique)
                  </h4>
                  <span className="text-[11px] text-[#5C727D]">
                    Preenche automaticamente variáveis e registra na ficha do produtor
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <select
                    value={contactModalScriptId}
                    onChange={(e) => setContactModalScriptId(e.target.value)}
                    className="w-full bg-white border border-[#D1CCC1] rounded-lg p-2 text-xs text-[#1A3643] focus:outline-none"
                  >
                    <option value="">Selecione um roteiro homologado para envio rápido...</option>
                    {templatesQuery.data?.map((tpl) => {
                      const userVariant = myVariantsQuery.data?.find((v) => v.templateId === tpl.id);
                      return (
                        <option key={tpl.id} value={String(tpl.id)}>
                          [{tpl.category}] {userVariant ? `${userVariant.title} (Minha Versão)` : tpl.title}
                        </option>
                      );
                    })}
                  </select>

                  <Button
                    size="sm"
                    disabled={!contactModalScriptId}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 w-full sm:w-auto h-9"
                    onClick={() => {
                      const scriptId = parseInt(contactModalScriptId, 10);
                      const tpl = templatesQuery.data?.find((t) => t.id === scriptId);
                      if (!tpl || !selectedContact) return;

                      const userVariant = myVariantsQuery.data?.find((v) => v.templateId === tpl.id);
                      const activeTitle = userVariant ? userVariant.title : tpl.title;
                      const rawContent = userVariant ? userVariant.content : tpl.content;
                      const consultantName = meQuery.data?.name || (activeRep ? activeRep.name : 'Wesley Amancio');

                      const rendered = rawContent
                        .replace(/\{\{nome\}\}/g, selectedContact.organization)
                        .replace(/\{\{consultor\}\}/g, consultantName)
                        .replace(/\{\{organizacao\}\}/g, selectedContact.organization)
                        .replace(/\{\{cidade\}\}/g, selectedContact.city)
                        .replace(/\{\{bem_interesse\}\}/g, selectedContact.interestAsset || 'Tratores e Implementos')
                        .replace(/\{\{indicador\}\}/g, 'Revenda Parceira');

                      // 1. Grava no banco o disparo para histórico e métricas
                      recordDispatchMutation.mutate({
                        templateId: tpl.id,
                        variantId: userVariant ? userVariant.id : undefined,
                        contactId: selectedContact.id,
                        title: activeTitle,
                        content: rendered,
                      });

                      // 2. Abre o WhatsApp Web com texto preenchido
                      const cleanPhone = selectedContact.phone.replace(/\D/g, '');
                      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(rendered)}`, '_blank');
                      toast.success(`Script "${activeTitle}" registrado e enviado para o WhatsApp de ${selectedContact.organization}!`);
                    }}
                  >
                    <MessageCircle className="w-4 h-4 mr-1.5" /> Enviar Agora no WhatsApp
                  </Button>
                </div>
              </div>

              {/* Histórico de Disparos de Scripts com Atualização de Resposta */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm text-[#1B4D3E] flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-[#88B04B]" /> Histórico de Scripts Disparados ({contactDispatchesQuery.data?.length || 0})
                  </h4>
                  <span className="text-[11px] text-[#5C727D]">
                    Atualize o status conforme o produtor responder no WhatsApp
                  </span>
                </div>

                {contactDispatchesQuery.data && contactDispatchesQuery.data.length > 0 ? (
                  <div className="space-y-2">
                    {contactDispatchesQuery.data.map((d) => (
                      <div key={d.id} className="p-3 bg-white rounded-xl border border-[#D1CCC1] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs shadow-sm">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#1B4D3E]">{d.title}</span>
                            <span className="text-[10px] text-[#5C727D]">
                              Enviado em {new Date(d.sentAt).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#5C727D] line-clamp-1 italic font-sans max-w-xl">
                            "{d.content.substring(0, 120)}..."
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={d.responseStatus}
                            onChange={(e) => {
                              updateDispatchStatusMutation.mutate({
                                dispatchId: d.id,
                                status: e.target.value as any,
                              });
                            }}
                            className={`text-xs font-bold rounded-lg px-2.5 py-1 border focus:outline-none ${
                              d.responseStatus === 'reuniao_agendada'
                                ? 'bg-[#D39B39]/20 text-[#1B4D3E] border-[#D39B39]'
                                : d.responseStatus === 'respondeu'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : d.responseStatus === 'sem_resposta'
                                ? 'bg-stone-200 text-stone-700 border-stone-300'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            <option value="enviado">Enviado (Sem Retorno)</option>
                            <option value="respondeu">Produtor Respondeu</option>
                            <option value="reuniao_agendada">Reunião Agendada</option>
                            <option value="sem_resposta">Sem Resposta / Frio</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-[#F5F2EB]/50 border border-dashed border-[#D1CCC1] rounded-xl text-center text-xs text-[#5C727D]">
                    Nenhum script foi disparado para este produtor ainda. Utilize o seletor rápido acima para iniciar o primeiro contato.
                  </div>
                )}
              </div>

              {/* Histórico de Remarcações de Follow-up (Identificação de Leads Frios) */}
              <div className="bg-white p-4 rounded-xl border border-[#D1CCC1] shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm text-[#1B4D3E] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" /> Histórico de Remarcações ({((detailQuery.data as any)?.reschedules?.length || 0)})
                  </h4>
                  {((detailQuery.data as any)?.reschedules?.length || 0) >= 2 ? (
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      Atenção: adiado {((detailQuery.data as any)?.reschedules?.length || 0)} vezes. Recomenda-se ligação direta ou qualificação de interesse.
                    </span>
                  ) : (
                    <span className="text-xs text-[#5C727D]">
                      Rastreamento das datas em que o produtor solicitou novo prazo ou adiamento.
                    </span>
                  )}
                </div>

                {(detailQuery.data as any)?.reschedules && (detailQuery.data as any).reschedules.length > 0 ? (
                  <div className="space-y-2">
                    {(detailQuery.data as any).reschedules.map((r: any) => (
                      <div key={r.id} className="p-2.5 bg-[#F5F2EB]/60 rounded-lg border border-[#D1CCC1]/70 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs gap-1.5">
                        <div>
                          <span className="font-extrabold text-[#1B4D3E]">
                            De {new Date(r.previousDueDate).toLocaleDateString('pt-BR')} para {new Date(r.newDueDate).toLocaleDateString('pt-BR')}
                          </span>
                          <p className="text-[11px] text-[#5C727D] mt-0.5">
                            {r.reason || 'Remarcado pelo consultor durante a cadência comercial.'}
                          </p>
                        </div>
                        <span className="text-[10px] text-[#5C727D] font-mono shrink-0">
                          {new Date(r.createdAt).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#5C727D] italic">
                    Este produtor ainda não possui remarcações registradas no histórico.
                  </p>
                )}
              </div>

              {/* Histórico Geral de Interações e Notas de Voz Gravadas */}
              <div className="bg-white p-4 rounded-xl border border-[#D1CCC1] shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm text-[#1B4D3E] flex items-center gap-1.5">
                    <History className="w-4 h-4 text-emerald-600" /> Histórico de Contatos & Notas de Voz ({detailQuery.data?.interactions?.length || 0})
                  </h4>
                  <span className="text-xs text-[#5C727D]">
                    Registros de conversas, feedbacks e áudios gravados pelo consultor.
                  </span>
                </div>

                {detailQuery.data?.interactions && detailQuery.data.interactions.length > 0 ? (
                  <div className="space-y-2.5">
                    {detailQuery.data.interactions.map((int: any) => (
                      <div key={int.id} className="p-3 bg-[#F5F2EB]/50 rounded-xl border border-[#D1CCC1] space-y-1.5 text-xs">
                        <div className="flex justify-between items-start">
                          <span className="font-extrabold text-[#1B4D3E] flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] uppercase font-bold border-[#1B4D3E] text-[#1B4D3E]">
                              {int.channel}
                            </Badge>
                            {int.summary}
                          </span>
                          <span className="text-[10px] text-[#5C727D] font-mono">
                            {new Date(int.createdAt).toLocaleString('pt-BR')}
                          </span>
                        </div>

                        {int.details && (
                          <p className="text-[11px] text-[#1A3643] leading-relaxed bg-white p-2.5 rounded-lg border border-stone-200">
                            {int.details}
                          </p>
                        )}

                        {int.voiceNoteUrl && (
                          <div className="space-y-2 pt-1 border-t border-stone-200 mt-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                                <Mic className="w-3.5 h-3.5 text-emerald-600" /> Áudio Original ({int.voiceNoteDurationSeconds ? `${int.voiceNoteDurationSeconds}s` : 'Áudio'}):
                              </span>
                              <audio src={int.voiceNoteUrl} controls className="h-7 flex-1 max-w-md" />
                            </div>
                            {int.voiceNoteTranscription && (
                              <div className="bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200 text-[11px] text-[#1A3643] space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-emerald-800 flex items-center gap-1 text-[10px] uppercase tracking-wider">
                                    <Sparkles className="w-3 h-3 text-emerald-600" /> Transcrição & Síntese por IA
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(int.voiceNoteTranscription);
                                      toast.success('Transcrição copiada!');
                                    }}
                                    className="text-emerald-700 hover:underline text-[10px] font-bold flex items-center gap-1"
                                  >
                                    <Copy className="w-3 h-3" /> Copiar
                                  </button>
                                </div>
                                <p className="leading-relaxed whitespace-pre-wrap font-sans">
                                  {int.voiceNoteTranscription}
                                </p>
                              </div>
                            )}
                            {int.voiceNoteSentiment && (
                              <div className="bg-white p-2.5 rounded-lg border border-[#D1CCC1] text-[11px] text-[#1A3643] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5C727D]">
                                    Nível de Interesse (IA):
                                  </span>
                                  <Badge
                                    className={`${
                                      int.voiceNoteSentiment === 'Alto Interesse'
                                        ? 'bg-emerald-600 text-white font-extrabold'
                                        : int.voiceNoteSentiment === 'Neutro / Em Avaliação'
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                        : 'bg-rose-100 text-rose-800 border border-rose-300 font-bold'
                                    } text-[10px] px-2 py-0.5`}
                                  >
                                    {int.voiceNoteSentiment === 'Alto Interesse' ? '🔥 Alto Interesse' : int.voiceNoteSentiment === 'Neutro / Em Avaliação' ? '⚖️ Neutro / Em Avaliação' : '⚠️ Objeção / Resistência'}
                                    {int.voiceNoteSentimentConfidence ? ` (${int.voiceNoteSentimentConfidence}%)` : ''}
                                  </Badge>
                                </div>
                                {int.voiceNoteSentimentReason && (
                                  <span className="text-[11px] text-[#5C727D] italic">
                                    "{int.voiceNoteSentimentReason}"
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#5C727D] italic">
                    Nenhuma interação detalhada registrada ainda.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

            {/* MODAL DE CADASTRO DE NOVO CLIENTE (PF / PJ) */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#D1CCC1] space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[#D1CCC1]">
              <div>
                <h3 className="text-xl font-bold text-[#1B4D3E] flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#88B04B]" /> Cadastrar Novo Cliente no CRM
                </h3>
                <p className="text-xs text-[#5C727D] mt-0.5">
                  Adicione produtores rurais individuais (PF) ou empresas/usinas agrícolas (PJ) para prospecção de consórcio.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setIsNewClientModalOpen(false)}>
                Fechar
              </Button>
            </div>

            {/* Alternador PF vs PJ */}
            <div className="flex gap-3 bg-[#F5F2EB] p-1.5 rounded-xl border border-[#D1CCC1]">
              <button
                type="button"
                onClick={() => setNewClientType('pj')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  newClientType === 'pj' ? 'bg-[#1B4D3E] text-white shadow-sm' : 'text-[#5C727D] hover:text-[#1A3643]'
                }`}
              >
                Pessoa Jurídica (Empresa / Usina / Cooperativa)
              </button>
              <button
                type="button"
                onClick={() => setNewClientType('pf')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  newClientType === 'pf' ? 'bg-[#1B4D3E] text-white shadow-sm' : 'text-[#5C727D] hover:text-[#1A3643]'
                }`}
              >
                Pessoa Física (Produtor Rural Individual / Fazendeiro)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="font-bold text-[#5C727D] block mb-1">
                  {newClientType === 'pf' ? 'Nome Completo do Produtor / Fazendeiro *' : 'Razão Social ou Nome Fantasia da Empresa / Usina *'}
                </label>
                <Input
                  placeholder={newClientType === 'pf' ? 'Ex: João Carlos de Almeida' : 'Ex: Fazenda Santa Maria Agropecuária S/A'}
                  value={newClientOrg}
                  onChange={(e) => setNewClientOrg(e.target.value)}
                  className="bg-[#F5F2EB]/60 border-[#D1CCC1]"
                />
              </div>

              <div>
                <label className="font-bold text-[#5C727D] block mb-1">
                  {newClientType === 'pf' ? 'CPF do Produtor' : 'CNPJ da Empresa'}
                </label>
                <Input
                  placeholder={newClientType === 'pf' ? '000.000.000-00' : '00.000.000/0001-00'}
                  value={newClientTaxId}
                  onChange={(e) => setNewClientTaxId(e.target.value)}
                  className="bg-[#F5F2EB]/60 border-[#D1CCC1]"
                />
              </div>

              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Telefone / WhatsApp Comercial *</label>
                <Input
                  placeholder="(34) 99999-8888"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  className="bg-[#F5F2EB]/60 border-[#D1CCC1]"
                />
              </div>

              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Estado (UF) *</label>
                <select
                  value={newClientState}
                  onChange={(e) => setNewClientState(e.target.value)}
                  className="w-full h-9 bg-[#F5F2EB]/60 border border-[#D1CCC1] rounded-md px-3 text-xs text-[#1A3643] focus:outline-none"
                >
                  {states.filter(s => s !== 'all').map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Município Sede *</label>
                <Input
                  placeholder="Ex: Patos de Minas, Rio Verde..."
                  value={newClientCity}
                  onChange={(e) => setNewClientCity(e.target.value)}
                  className="bg-[#F5F2EB]/60 border-[#D1CCC1]"
                />
              </div>

              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Segmento / Cultura Produtiva *</label>
                <select
                  value={newClientSegment}
                  onChange={(e) => setNewClientSegment(e.target.value)}
                  className="w-full h-9 bg-[#F5F2EB]/60 border border-[#D1CCC1] rounded-md px-3 text-xs text-[#1A3643] focus:outline-none"
                >
                  <option value="Grãos e Cereais">Grãos e Cereais (Soja, Milho)</option>
                  <option value="Café">Cafeicultura</option>
                  <option value="Cana-de-Açúcar">Cana-de-Açúcar / Sucroalcooleiro</option>
                  <option value="Pecuária de Corte e Leite">Pecuária de Corte / Leite</option>
                  <option value="Citros e Hortifrúti">Citros e Fruticultura</option>
                  <option value="Algodão">Algodão e Fibras</option>
                  <option value="Máquinas e Insumos">Revenda / Insumos Agrícolas</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Ativo de Interesse (Consórcio)</label>
                <Input
                  placeholder="Ex: Trator 200cv, Colheitadeira de Grãos..."
                  value={newClientAsset}
                  onChange={(e) => setNewClientAsset(e.target.value)}
                  className="bg-[#F5F2EB]/60 border-[#D1CCC1]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-[#5C727D] block mb-1">Atividade Produtiva & Histórico da Propriedade *</label>
                <Input
                  placeholder="Ex: Plantio direto em 1.500 hectares, renovação de frota prevista para safra 2026/2027"
                  value={newClientActivity}
                  onChange={(e) => setNewClientActivity(e.target.value)}
                  className="bg-[#F5F2EB]/60 border-[#D1CCC1]"
                />
              </div>

              {meQuery.data?.role === 'admin' && (
                <div className="sm:col-span-2">
                  <label className="font-bold text-[#5C727D] block mb-1">Atribuir Carteira a um Consultor</label>
                  <select
                    value={newClientRepId ? String(newClientRepId) : ''}
                    onChange={(e) => setNewClientRepId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    className="w-full h-9 bg-[#F5F2EB]/60 border border-[#D1CCC1] rounded-md px-3 text-xs text-[#1A3643] focus:outline-none"
                  >
                    <option value="">Nenhum consultor atribuído (Fila Geral)</option>
                    {repsQuery.data?.map(rep => (
                      <option key={rep.id} value={String(rep.id)}>{rep.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D1CCC1]">
              <Button variant="ghost" onClick={() => setIsNewClientModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!newClientOrg.trim() || !newClientPhone.trim() || !newClientCity.trim() || !newClientActivity.trim() || createClientMutation.isPending}
                className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90 font-bold"
                onClick={() => {
                  createClientMutation.mutate({
                    organization: newClientOrg,
                    clientType: newClientType,
                    taxId: newClientTaxId || undefined,
                    state: newClientState,
                    city: newClientCity,
                    phone: newClientPhone,
                    activity: newClientActivity,
                    segment: newClientSegment,
                    interestAsset: newClientAsset || undefined,
                    assignedRepId: newClientRepId,
                  });
                }}
              >
                {createClientMutation.isPending ? 'Cadastrando...' : 'Salvar Novo Cliente'}
              </Button>
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

      {/* MODAL DE SEQUÊNCIA DE SEGUNDO CONTATO PARA FOLLOW-UPS VENCIDOS */}
      {isOverdueSequenceModalOpen && (() => {
        const overdueTasks = (tasksQuery.data || []).filter((task: any) => task.isOverdue && !task.completed) as any[];
        const currentTask = overdueTasks[overdueSequenceIndex];
        const suggestedTpl = currentTask?.suggestedTemplate || templatesQuery.data?.find((tpl) => tpl.category === 'Segundo Contato (48h)');
        const rendered = currentTask && suggestedTpl ? renderTaskScript(suggestedTpl.content, currentTask) : '';

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-rose-300 space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start gap-3 pb-3 border-b border-[#D1CCC1]">
                <div>
                  <Badge className="bg-rose-600 text-white text-[10px] mb-1">Fila de Follow-ups Vencidos</Badge>
                  <h3 className="text-xl font-bold text-[#1B4D3E]">Sequência de Segundo Contato</h3>
                  <p className="text-xs text-[#5C727D] mt-1">
                    O sistema avança lead por lead, registra o disparo e abre a conversa personalizada no WhatsApp Web.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsOverdueSequenceModalOpen(false)}>
                  Fechar
                </Button>
              </div>

              {!currentTask || !suggestedTpl ? (
                <div className="p-6 text-center bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h4 className="font-extrabold text-[#1B4D3E]">Fila concluída</h4>
                  <p className="text-xs text-[#5C727D]">Não há mais follow-ups vencidos nesta visão.</p>
                  <Button className="bg-[#1B4D3E] text-white" onClick={() => setIsOverdueSequenceModalOpen(false)}>Voltar para tarefas</Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <Badge className="bg-[#F5F2EB] text-[#1B4D3E] border border-[#D1CCC1] font-bold">
                      Lead {overdueSequenceIndex + 1} de {overdueTasks.length}
                    </Badge>
                    <span className="text-xs font-mono font-bold text-rose-700">Prazo: {new Date(currentTask.dueDate).toLocaleString('pt-BR')}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 space-y-1">
                    <h4 className="font-extrabold text-[#1B4D3E]">{currentTask.contactName}</h4>
                    <p className="text-xs text-[#5C727D]">{currentTask.contactCity} • {currentTask.contactSegment} • {currentTask.contactPhone || 'Telefone não informado'}</p>
                    <p className="text-xs text-rose-800 font-semibold">{currentTask.title}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold text-[#1B4D3E]">Modelo sugerido: {suggestedTpl.title}</span>
                      <button
                        type="button"
                        className="text-xs font-bold text-[#1B4D3E] hover:underline"
                        onClick={() => {
                          navigator.clipboard.writeText(rendered);
                          toast.success('Segundo contato copiado para a área de transferência.');
                        }}
                      >
                        <Copy className="w-3.5 h-3.5 inline mr-1" /> Copiar
                      </button>
                    </div>
                    <div className="bg-[#F5F2EB] p-4 rounded-xl border border-[#D1CCC1] text-xs text-[#1A3643] leading-relaxed whitespace-pre-wrap">
                      {rendered}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between gap-2 pt-3 border-t border-[#D1CCC1]">
                    <Button
                      variant="outline"
                      className="border-[#D1CCC1] text-[#5C727D]"
                      onClick={() => setOverdueSequenceIndex((index) => Math.min(index + 1, overdueTasks.length))}
                    >
                      Pular por agora
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      onClick={() => {
                        const cleanPhone = (currentTask.contactPhone || '').replace(/\D/g, '');
                        if (!cleanPhone) {
                          toast.error('Este lead não possui telefone válido para abrir no WhatsApp.');
                          return;
                        }

                        recordDispatchMutation.mutate({
                          templateId: suggestedTpl.id,
                          contactId: currentTask.contactId,
                          title: suggestedTpl.title,
                          content: rendered,
                        });
                        toggleTaskMutation.mutate({ id: currentTask.id, completed: true });
                        const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(rendered)}`, '_blank');

                        if (overdueSequenceIndex >= overdueTasks.length - 1) {
                          toast.success('Sequência concluída. Todos os contatos vencidos desta visão foram tratados.');
                          setIsOverdueSequenceModalOpen(false);
                        } else {
                          toast.success(`Segundo contato registrado para ${currentTask.contactName}. Avançando para o próximo lead.`);
                          setOverdueSequenceIndex((index) => index + 1);
                        }
                      }}
                    >
                      <MessageCircle className="w-4 h-4 mr-1.5" /> Disparar e avançar para o próximo
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* MODAL DE ENVIO VIA WHATSAPP COM VARIÁVEIS PREENCHIDAS */}
      {whatsAppModalOpen && whatsAppActiveScript && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#D1CCC1] space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[#D1CCC1]">
              <div>
                <Badge className="bg-[#1B4D3E] text-[#88B04B] text-[10px] mb-1">WhatsApp Web Direto</Badge>
                <h3 className="text-xl font-bold text-[#1B4D3E]">
                  Enviar Script: {whatsAppActiveScript.title}
                </h3>
                <p className="text-xs text-[#5C727D]">
                  Selecione um lead da carteira ou preencha as variáveis para gerar a mensagem personalizada e abrir no WhatsApp Web.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setWhatsAppModalOpen(false)}>
                Fechar
              </Button>
            </div>

            {/* Selecionar contato cadastrado para preenchimento automático */}
            <div className="bg-[#F5F2EB] p-3 rounded-xl border border-[#D1CCC1] space-y-2 text-xs">
              <label className="font-bold text-[#1B4D3E] block">
                Preencher dados automaticamente a partir de um lead da base:
              </label>
              <select
                value={whatsAppTargetContactId ? String(whatsAppTargetContactId) : ''}
                onChange={(e) => {
                  const id = e.target.value ? parseInt(e.target.value, 10) : null;
                  setWhatsAppTargetContactId(id);
                  if (id) {
                    const target = contactsQuery.data?.find((c) => c.id === id);
                    if (target) {
                      setWhatsAppCustomName(target.organization);
                      setWhatsAppCustomOrg(target.organization);
                      setWhatsAppCustomPhone(target.phone);
                      setWhatsAppCustomCity(target.city);
                      setWhatsAppCustomAsset(target.interestAsset || 'Tratores e Implementos');
                    }
                  }
                }}
                className="w-full bg-white border border-[#D1CCC1] rounded-lg p-2 text-xs text-[#1A3643] focus:outline-none"
              >
                <option value="">Selecione um contato da lista nacional ({contactsQuery.data?.length || 0} leads)...</option>
                {contactsQuery.data?.slice(0, 150).map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.organization} ({c.city} - {c.state}) • {c.formattedPhone}
                  </option>
                ))}
              </select>
            </div>

            {/* Campos das variáveis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Telefone WhatsApp (com DDD) *</label>
                <Input
                  placeholder="(34) 99999-9999"
                  value={whatsAppCustomPhone}
                  onChange={(e) => setWhatsAppCustomPhone(e.target.value)}
                  className="bg-[#F5F2EB]/50 border-[#D1CCC1]"
                />
              </div>
              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Nome do Consultor (&#123;&#123;consultor&#125;&#125;) *</label>
                <Input
                  placeholder="Seu nome"
                  value={whatsAppCustomConsultant}
                  onChange={(e) => setWhatsAppCustomConsultant(e.target.value)}
                  className="bg-[#F5F2EB]/50 border-[#D1CCC1]"
                />
              </div>
              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Nome / Produtor (&#123;&#123;nome&#125;&#125;) *</label>
                <Input
                  placeholder="Nome do cliente"
                  value={whatsAppCustomName}
                  onChange={(e) => setWhatsAppCustomName(e.target.value)}
                  className="bg-[#F5F2EB]/50 border-[#D1CCC1]"
                />
              </div>
              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Empresa / Fazenda (&#123;&#123;organizacao&#125;&#125;) *</label>
                <Input
                  placeholder="Nome da fazenda ou usina"
                  value={whatsAppCustomOrg}
                  onChange={(e) => setWhatsAppCustomOrg(e.target.value)}
                  className="bg-[#F5F2EB]/50 border-[#D1CCC1]"
                />
              </div>
              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Município / Região (&#123;&#123;cidade&#125;&#125;)</label>
                <Input
                  placeholder="Ex: Patos de Minas"
                  value={whatsAppCustomCity}
                  onChange={(e) => setWhatsAppCustomCity(e.target.value)}
                  className="bg-[#F5F2EB]/50 border-[#D1CCC1]"
                />
              </div>
              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Ativo / Maquinário (&#123;&#123;bem_interesse&#125;&#125;)</label>
                <Input
                  placeholder="Ex: Tratores e Colheitadeiras"
                  value={whatsAppCustomAsset}
                  onChange={(e) => setWhatsAppCustomAsset(e.target.value)}
                  className="bg-[#F5F2EB]/50 border-[#D1CCC1]"
                />
              </div>
            </div>

            {/* Pré-visualização da Mensagem Renderizada */}
            {(() => {
              const renderedMessage = whatsAppActiveScript.content
                .replace(/\{\{nome\}\}/g, whatsAppCustomName.trim() || 'Produtor')
                .replace(/\{\{consultor\}\}/g, whatsAppCustomConsultant.trim() || 'Consultor Ademicon')
                .replace(/\{\{organizacao\}\}/g, whatsAppCustomOrg.trim() || 'sua propriedade')
                .replace(/\{\{cidade\}\}/g, whatsAppCustomCity.trim() || 'sua região')
                .replace(/\{\{bem_interesse\}\}/g, whatsAppCustomAsset.trim() || 'máquinas agrícolas')
                .replace(/\{\{indicador\}\}/g, whatsAppCustomReferrer.trim() || 'parceiro comercial');

              return (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-[#1B4D3E]">Mensagem Personalizada Pronta:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(renderedMessage);
                        toast.success('Texto personalizado copiado!');
                      }}
                      className="text-[#1B4D3E] hover:underline font-semibold flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar Texto
                    </button>
                  </div>
                  <div className="bg-[#F5F2EB] p-4 rounded-xl border border-[#D1CCC1] text-xs text-[#1A3643] leading-relaxed whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
                    {renderedMessage}
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-[#D1CCC1]">
                    <Button variant="ghost" onClick={() => setWhatsAppModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      onClick={() => {
                        const cleanPhone = whatsAppCustomPhone.replace(/\D/g, '');
                        if (!cleanPhone) {
                          toast.error('Informe um número de telefone com DDD');
                          return;
                        }

                        // Se houver contato selecionado na base, registrar histórico e métricas
                        if (whatsAppTargetContactId) {
                          recordDispatchMutation.mutate({
                            templateId: whatsAppActiveScript.id,
                            contactId: whatsAppTargetContactId,
                            title: whatsAppActiveScript.title,
                            content: renderedMessage,
                          });
                        }

                        const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(renderedMessage)}`, '_blank');
                        toast.success(whatsAppTargetContactId ? 'Script registrado no histórico do lead e aberto no WhatsApp Web!' : 'Abrindo WhatsApp Web com o script preenchido!');
                        setWhatsAppModalOpen(false);
                      }}
                    >
                      <MessageCircle className="w-4 h-4 mr-1.5" /> Abrir WhatsApp Web Agora
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL PARA SALVAR / EDITAR VARIAÇÃO PRÓPRIA DO CONSULTOR */}
      {editVariantModalOpen && editingTemplate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#D1CCC1] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[#D1CCC1]">
              <div>
                <Badge className="bg-[#88B04B] text-[#1B4D3E] text-[10px] mb-1">Personalização do Consultor</Badge>
                <h3 className="text-xl font-bold text-[#1B4D3E]">
                  Minha Variação do Script
                </h3>
                <p className="text-xs text-[#5C727D]">
                  Você pode adaptar o tom, incluir seu estilo de abordagem ou argumentos específicos sem alterar o modelo dos demais membros.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditVariantModalOpen(false)}>
                Fechar
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Título Personalizado da Abordagem</label>
                <Input
                  value={variantTitleInput}
                  onChange={(e) => setVariantTitleInput(e.target.value)}
                  placeholder="Ex: Minha Abordagem Direta para Grãos"
                  className="bg-[#F5F2EB]/50 border-[#D1CCC1]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-[#5C727D] block">
                    Texto do Roteiro (com variáveis como &#123;&#123;nome&#125;&#125;, &#123;&#123;consultor&#125;&#125;, &#123;&#123;organizacao&#125;&#125;)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setVariantTitleInput(editingTemplate.originalTitle);
                      setVariantContentInput(editingTemplate.originalContent);
                    }}
                    className="text-stone-500 hover:text-[#1B4D3E] font-semibold text-[11px]"
                  >
                    Carregar Modelo Original
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={variantContentInput}
                  onChange={(e) => setVariantContentInput(e.target.value)}
                  className="w-full p-3 rounded-lg bg-[#F5F2EB]/60 border border-[#D1CCC1] font-sans text-xs text-[#1A3643] leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#D1CCC1]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetVariantMutation.mutate({ templateId: editingTemplate.id })}
                disabled={resetVariantMutation.isPending}
                className="border-rose-300 text-rose-700 hover:bg-rose-50 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurar Homologado
              </Button>

              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditVariantModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={!variantTitleInput.trim() || !variantContentInput.trim() || saveVariantMutation.isPending}
                  className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90 font-bold"
                  onClick={() => {
                    saveVariantMutation.mutate({
                      templateId: editingTemplate.id,
                      title: variantTitleInput,
                      content: variantContentInput,
                    });
                  }}
                >
                  {saveVariantMutation.isPending ? 'Salvando...' : 'Salvar Minha Variação'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA ADICIONAR NOVO SCRIPT HOMOLOGADO */}
      {newScriptModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#D1CCC1] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[#D1CCC1]">
              <div>
                <Badge className="bg-[#1B4D3E] text-[#88B04B] text-[10px] mb-1">Novo Roteiro Homologado</Badge>
                <h3 className="text-xl font-bold text-[#1B4D3E]">
                  Cadastrar Novo Script Comercial
                </h3>
                <p className="text-xs text-[#5C727D]">
                  Crie uma abordagem padronizada com variáveis dinâmicas para disponibilizar a toda a equipe comercial.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setNewScriptModalOpen(false)}>
                Fechar
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="font-bold text-[#5C727D] block mb-1">Título do Script *</label>
                <Input
                  placeholder="Ex: Abordagem Rápida — Pecuária de Corte e Confinamento"
                  value={newScriptTitle}
                  onChange={(e) => setNewScriptTitle(e.target.value)}
                  className="bg-[#F5F2EB]/50 border-[#D1CCC1]"
                />
              </div>

              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Etapa / Categoria *</label>
                <select
                  value={newScriptCategory}
                  onChange={(e) => setNewScriptCategory(e.target.value)}
                  className="w-full bg-[#F5F2EB]/50 border border-[#D1CCC1] rounded-md p-2 text-xs text-[#1A3643] focus:outline-none"
                >
                  <option value="Prospecção WhatsApp">Prospecção WhatsApp</option>
                  <option value="Reunião Comercial">Reunião Comercial</option>
                  <option value="Quebra de Objeções">Quebra de Objeções</option>
                  <option value="Follow-up">Follow-up</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Segmento Agrícola</label>
                <Input
                  placeholder="Ex: Grãos, Café, Pecuária, Irrigação..."
                  value={newScriptSegment}
                  onChange={(e) => setNewScriptSegment(e.target.value)}
                  className="bg-[#F5F2EB]/50 border-[#D1CCC1]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-[#5C727D] block mb-1">
                  Objetivo Tático / Instrução de Uso
                </label>
                <Input
                  placeholder="Ex: Conduzir produtor à reunião presencial demonstrando custo financeiro do crédito bancário"
                  value={newScriptUsage}
                  onChange={(e) => setNewScriptUsage(e.target.value)}
                  className="bg-[#F5F2EB]/50 border-[#D1CCC1]"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-[#5C727D] block">
                    Texto Completo do Script * (utilize &#123;&#123;nome&#125;&#125;, &#123;&#123;consultor&#125;&#125;, &#123;&#123;organizacao&#125;&#125;, &#123;&#123;cidade&#125;&#125;, &#123;&#123;bem_interesse&#125;&#125;)
                  </label>
                </div>
                <textarea
                  rows={7}
                  placeholder="Escreva a mensagem aqui..."
                  value={newScriptContent}
                  onChange={(e) => setNewScriptContent(e.target.value)}
                  className="w-full p-3 rounded-lg bg-[#F5F2EB]/60 border border-[#D1CCC1] font-sans text-xs text-[#1A3643] leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D1CCC1]">
              <Button variant="ghost" size="sm" onClick={() => setNewScriptModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!newScriptTitle.trim() || !newScriptContent.trim() || createTemplateMutation.isPending}
                className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90 font-bold"
                onClick={() => {
                  createTemplateMutation.mutate({
                    title: newScriptTitle,
                    category: newScriptCategory,
                    segment: newScriptSegment,
                    content: newScriptContent,
                    recommendedUsage: newScriptUsage || undefined,
                  });
                }}
              >
                {createTemplateMutation.isPending ? 'Salvando...' : 'Cadastrar Roteiro Homologado'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DISPAROS DE WHATSAPP EM SEQUÊNCIA POR CULTURA / SEGMENTO */}
      {isBulkSequenceModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-[#D1CCC1] space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[#D1CCC1]">
              <div>
                <Badge className="bg-emerald-100 text-emerald-800 text-[10px] mb-1 font-bold">
                  Campanha em Sequência
                </Badge>
                <h3 className="text-xl font-bold text-[#1B4D3E]">
                  Disparos Sequenciais de WhatsApp por Cultura
                </h3>
                <p className="text-xs text-[#5C727D]">
                  Selecione múltiplos produtores da mesma atividade agrícola para disparar mensagens personalizadas de forma rápida e controlada, com registro automático de follow-up.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsBulkSequenceModalOpen(false)}>
                Fechar
              </Button>
            </div>

            {/* Filtro de Cultura e Escolha do Roteiro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F5F2EB] p-3 rounded-xl border border-[#D1CCC1] text-xs">
              <div>
                <label className="font-bold text-[#1B4D3E] block mb-1">Cultura / Segmento Agrícola:</label>
                <select
                  value={bulkCultureFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBulkCultureFilter(val);
                    setBulkCurrentIndex(0);
                    const filtered = contactsQuery.data?.filter(c =>
                      c.segment.toLowerCase().includes(val.toLowerCase()) ||
                      (c.activity && c.activity.toLowerCase().includes(val.toLowerCase()))
                    ) || [];
                    setBulkSelectedContactIds(filtered.map(c => c.id));
                  }}
                  className="w-full bg-white border border-[#D1CCC1] rounded-lg p-2 text-xs text-[#1A3643] focus:outline-none"
                >
                  <option value="Grãos e Cereais">Grãos e Cereais (Soja, Milho, Trigo)</option>
                  <option value="Café">Cafeicultura (Arábica, Conilon)</option>
                  <option value="Cana-de-Açúcar">Cana-de-Açúcar / Sucroenergético</option>
                  <option value="Pecuária">Pecuária (Corte, Leite, Confinamento)</option>
                  <option value="Irrigação">Irrigação e Pivôs Centrais</option>
                  <option value="Citros">Citros e Hortifrúti</option>
                  <option value="Algodão">Algodão e Fibras</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#1B4D3E] block mb-1">Roteiro Homologado para a Campanha:</label>
                <select
                  value={bulkScriptId}
                  onChange={(e) => setBulkScriptId(e.target.value)}
                  className="w-full bg-white border border-[#D1CCC1] rounded-lg p-2 text-xs text-[#1A3643] focus:outline-none"
                >
                  {templatesQuery.data?.map(tpl => (
                    <option key={tpl.id} value={String(tpl.id)}>
                      [{tpl.category}] {tpl.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lista de Produtores Selecionados */}
            {(() => {
              const matchingContacts = contactsQuery.data?.filter(c =>
                c.segment.toLowerCase().includes(bulkCultureFilter.toLowerCase()) ||
                (c.activity && c.activity.toLowerCase().includes(bulkCultureFilter.toLowerCase()))
              ) || [];

              const selectedList = matchingContacts.filter(c => bulkSelectedContactIds.includes(c.id));
              const currentTarget = selectedList[bulkCurrentIndex];
              const selectedTemplate = templatesQuery.data?.find(t => String(t.id) === bulkScriptId) || templatesQuery.data?.[0];

              let currentRendered = '';
              if (currentTarget && selectedTemplate) {
                const consultantName = meQuery.data?.name || (activeRep ? activeRep.name : 'Wesley Amancio');
                currentRendered = selectedTemplate.content
                  .replace(/\{\{nome\}\}/g, currentTarget.organization)
                  .replace(/\{\{consultor\}\}/g, consultantName)
                  .replace(/\{\{organizacao\}\}/g, currentTarget.organization)
                  .replace(/\{\{cidade\}\}/g, currentTarget.city)
                  .replace(/\{\{bem_interesse\}\}/g, currentTarget.interestAsset || 'Tratores e Implementos')
                  .replace(/\{\{indicador\}\}/g, 'Revenda Parceira');
              }

              return (
                <div className="space-y-3">
                  {/* Controle de Seleção em Massa */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-[#1A3643]">
                      {matchingContacts.length} produtores encontrados na cultura "{bulkCultureFilter}" ({selectedList.length} selecionados)
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setBulkSelectedContactIds(matchingContacts.map(c => c.id))}
                        className="text-[#1B4D3E] hover:underline font-bold text-[11px]"
                      >
                        Marcar Todos
                      </button>
                      <span className="text-stone-300">•</span>
                      <button
                        type="button"
                        onClick={() => setBulkSelectedContactIds([])}
                        className="text-rose-600 hover:underline font-bold text-[11px]"
                      >
                        Desmarcar Todos
                      </button>
                    </div>
                  </div>

                  {/* Área do Contato Atual da Fila */}
                  {currentTarget && selectedTemplate ? (
                    <div className="bg-white border-2 border-[#1B4D3E]/30 rounded-xl p-4 space-y-3 shadow-sm">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-[#D1CCC1]">
                        <div>
                          <span className="text-[10px] font-bold text-[#88B04B] uppercase tracking-wider block">
                            Fila de Disparo: {bulkCurrentIndex + 1} de {selectedList.length}
                          </span>
                          <h4 className="text-base font-extrabold text-[#1B4D3E]">
                            {currentTarget.organization} ({currentTarget.city} - {currentTarget.state})
                          </h4>
                          <span className="text-xs text-[#5C727D] font-mono">
                            Telefone: {currentTarget.formattedPhone} • Atividade: {currentTarget.activity}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={bulkCurrentIndex === 0}
                            onClick={() => setBulkCurrentIndex(prev => Math.max(0, prev - 1))}
                            className="text-xs h-8"
                          >
                            Anterior
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={bulkCurrentIndex >= selectedList.length - 1}
                            onClick={() => setBulkCurrentIndex(prev => Math.min(selectedList.length - 1, prev + 1))}
                            className="text-xs h-8"
                          >
                            Próximo
                          </Button>
                        </div>
                      </div>

                      {/* Mensagem Personalizada Renderizada */}
                      <div>
                        <label className="text-[11px] font-bold text-[#5C727D] block mb-1">
                          Mensagem Pronta para Envio:
                        </label>
                        <div className="bg-[#F5F2EB] p-3 rounded-lg border border-[#D1CCC1] text-xs text-[#1A3643] leading-relaxed whitespace-pre-wrap font-sans">
                          {currentRendered}
                        </div>
                      </div>

                      {/* Ação de Disparo Imediato e Avanço Automático */}
                      <div className="flex justify-between items-center pt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-[#5C727D]"
                          onClick={() => {
                            navigator.clipboard.writeText(currentRendered);
                            toast.success('Texto copiado!');
                          }}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copiar Texto
                        </Button>

                        <Button
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-sm"
                          onClick={() => {
                            // 1. Gravar disparo no banco com follow-up automático de 48h
                            recordDispatchMutation.mutate({
                              templateId: selectedTemplate.id,
                              contactId: currentTarget.id,
                              title: selectedTemplate.title,
                              content: currentRendered,
                            });

                            // 2. Abrir WhatsApp Web
                            const cleanPhone = currentTarget.phone.replace(/\D/g, '');
                            const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                            window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(currentRendered)}`, '_blank');
                            toast.success(`Disparo aberto para ${currentTarget.organization}! Follow-up de 48h agendado.`);

                            // 3. Avançar para o próximo da fila se houver
                            if (bulkCurrentIndex < selectedList.length - 1) {
                              setBulkCurrentIndex(prev => prev + 1);
                            } else {
                              toast.success('Você completou todos os disparos da lista selecionada!');
                            }
                          }}
                        >
                          <MessageCircle className="w-4 h-4 mr-1.5" /> Disparar WhatsApp & Ir para o Próximo
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-[#F5F2EB]/60 rounded-xl text-center text-xs text-[#5C727D] border border-dashed border-[#D1CCC1]">
                      Nenhum produtor selecionado nesta cultura. Marque produtores para iniciar a fila de disparos.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL DE ANOTAÇÕES RÁPIDAS (REGISTRAR RESPOSTA SEM SAIR DO PAINEL) */}
      {isQuickResponseModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#D1CCC1] space-y-4">
            <div className="flex justify-between items-start pb-3 border-b border-[#D1CCC1]">
              <div>
                <Badge className="bg-[#1B4D3E] text-[#88B04B] text-[10px] mb-1 font-bold">
                  Registro Rápido de Resposta
                </Badge>
                <h3 className="text-xl font-bold text-[#1B4D3E]">
                  Feedback do Produtor: {quickResponseContactName}
                </h3>
                <p className="text-xs text-[#5C727D]">
                  Registre a resposta ou o alinhamento de reunião sem precisar sair do painel principal.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsQuickResponseModalOpen(false)}>
                Fechar
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Resultado do Contato *</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['respondeu', 'Respondeu'],
                    ['reuniao_agendada', 'Reunião Agendada'],
                    ['sem_resposta', 'Sem Resposta / Adiado'],
                  ] as const).map(([st, label]) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setQuickResponseStatus(st)}
                      className={`py-2 px-2 rounded-lg font-bold text-xs border transition-all ${
                        quickResponseStatus === st
                          ? 'bg-[#1B4D3E] text-white border-[#1B4D3E] shadow-sm'
                          : 'bg-[#F5F2EB] text-[#1A3643] border-[#D1CCC1] hover:bg-stone-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-[#5C727D] block mb-1">
                  Anotação / Feedback do Produtor (obrigatório para reuniões ou objeções)
                </label>
                <textarea
                  rows={4}
                  placeholder="Digite aqui o que o produtor falou (ex: achou a parcela acessível, pediu para retornar na próxima semana, quer simulação de 500k)..."
                  value={quickResponseNotes}
                  onChange={(e) => setQuickResponseNotes(e.target.value)}
                  className="w-full p-3 rounded-lg bg-[#F5F2EB]/60 border border-[#D1CCC1] font-sans text-xs text-[#1A3643] leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#1B4D3E]"
                />
              </div>

              {/* Gravador de Nota de Voz Direto do Navegador */}
              <div className="p-3 bg-[#F5F2EB] rounded-xl border border-[#D1CCC1] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#1B4D3E] flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-emerald-600" /> Gravar Nota de Voz (Resumo Falado)
                  </span>
                  {isRecordingVoice && (
                    <span className="text-xs font-mono font-bold text-rose-600 animate-pulse flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-600"></span> Gravando: {voiceDuration}s
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {!isRecordingVoice ? (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8"
                      onClick={async () => {
                        try {
                          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                          const mediaRecorder = new MediaRecorder(stream);
                          mediaRecorderRef.current = mediaRecorder;
                          audioChunksRef.current = [];
                          setVoiceDuration(0);

                          mediaRecorder.ondataavailable = (event) => {
                            if (event.data.size > 0) {
                              audioChunksRef.current.push(event.data);
                            }
                          };

                          mediaRecorder.onstop = () => {
                            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                            setVoiceAudioBlob(audioBlob);
                            const localUrl = URL.createObjectURL(audioBlob);
                            setVoiceAudioUrl(localUrl);
                            stream.getTracks().forEach(track => track.stop());
                            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
                          };

                          mediaRecorder.start();
                          setIsRecordingVoice(true);
                          recordingTimerRef.current = setInterval(() => {
                            setVoiceDuration(prev => prev + 1);
                          }, 1000);
                        } catch (err: any) {
                          toast.error('Não foi possível acessar o microfone: ' + (err.message || 'Permissão negada.'));
                        }
                      }}
                    >
                      <Mic className="w-3.5 h-3.5 mr-1" /> Iniciar Gravação
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-8"
                      onClick={() => {
                        if (mediaRecorderRef.current && isRecordingVoice) {
                          mediaRecorderRef.current.stop();
                          setIsRecordingVoice(false);
                        }
                      }}
                    >
                      <Square className="w-3.5 h-3.5 mr-1" /> Concluir Áudio ({voiceDuration}s)
                    </Button>
                  )}

                  {voiceAudioUrl && (
                    <div className="flex items-center gap-2 pt-1 w-full">
                      <audio src={voiceAudioUrl} controls className="h-8 max-w-full flex-1" />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 text-xs h-7"
                        onClick={() => {
                          setVoiceAudioBlob(null);
                          setVoiceAudioUrl(null);
                          setVoiceDuration(0);
                        }}
                      >
                        Excluir
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D1CCC1]">
              <Button variant="ghost" size="sm" onClick={() => setIsQuickResponseModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!quickResponseTaskId || registerTaskResponseMutation.isPending}
                className="bg-[#1B4D3E] text-white hover:bg-[#1B4D3E]/90 font-bold"
                onClick={async () => {
                  if (quickResponseTaskId) {
                    let base64Audio: string | undefined = undefined;
                    if (voiceAudioBlob) {
                      const buffer = await voiceAudioBlob.arrayBuffer();
                      let binary = '';
                      const bytes = new Uint8Array(buffer);
                      for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i]);
                      }
                      base64Audio = btoa(binary);
                    }

                    registerTaskResponseMutation.mutate({
                      id: quickResponseTaskId,
                      status: quickResponseStatus,
                      notes: quickResponseNotes.trim() || undefined,
                      voiceNoteBase64: base64Audio,
                      voiceNoteDurationSeconds: voiceDuration > 0 ? voiceDuration : undefined,
                    });
                    setIsQuickResponseModalOpen(false);
                    setVoiceAudioBlob(null);
                    setVoiceAudioUrl(null);
                    setVoiceDuration(0);
                  }
                }}
              >
                {registerTaskResponseMutation.isPending ? 'Salvando...' : 'Salvar Feedback no CRM'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ROTEIRO CURTO PARA LIGAÇÃO TELEFÔNICA (PÓS-48H SEM RESPOSTA NO WHATSAPP) */}
      {isPhoneCallModalOpen && phoneCallTaskData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-sky-300 space-y-4">
            <div className="flex justify-between items-start pb-3 border-b border-[#D1CCC1]">
              <div>
                <Badge className="bg-sky-600 text-white text-[10px] mb-1 font-bold">
                  Contato Telefônico Direto (Pós-48h WhatsApp)
                </Badge>
                <h3 className="text-xl font-bold text-[#1B4D3E]">
                  Roteiro de Ligação Rápida
                </h3>
                <p className="text-xs text-[#5C727D]">
                  Sugestão tática de abordagem por telefone para quando o WhatsApp não tiver resposta em 48 horas.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsPhoneCallModalOpen(false)}>
                Fechar
              </Button>
            </div>

            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs space-y-1">
              <span className="font-extrabold text-[#1B4D3E] block">{phoneCallTaskData.contactName}</span>
              <p className="text-[#5C727D]">
                {phoneCallTaskData.contactCity} • {phoneCallTaskData.contactSegment} • Telefone: <strong>{phoneCallTaskData.contactPhone || 'Não informado'}</strong>
              </p>
            </div>

            {(() => {
              const rawPhoneTpl = phoneCallTaskData.phoneCallTemplate?.content ||
                'Olá, {{nome}}! Tudo bem? Aqui é {{consultor}}, da Ademicon Agro. Mandei uma mensagem no seu WhatsApp há dois dias sobre a renovação de {{bem_interesse}} na {{organizacao}}. Te liguei rapidinho só para confirmar se você recebeu e se faz sentido conversarmos 5 minutinhos hoje sobre o custo do crédito para a próxima safra.';
              const renderedPhoneScript = renderTaskScript(rawPhoneTpl, phoneCallTaskData);

              return (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-[#1B4D3E]">Fala sugerida para o consultor:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(renderedPhoneScript);
                        toast.success('Roteiro de ligação copiado!');
                      }}
                      className="text-[#1B4D3E] hover:underline font-semibold flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar Roteiro
                    </button>
                  </div>

                  <div className="bg-[#F5F2EB] p-4 rounded-xl border border-[#D1CCC1] text-xs text-[#1A3643] leading-relaxed whitespace-pre-wrap font-sans">
                    {renderedPhoneScript}
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between gap-2 pt-2 border-t border-[#D1CCC1]">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#D1CCC1] text-[#5C727D] text-xs"
                      onClick={() => setIsPhoneCallModalOpen(false)}
                    >
                      Fechar Roteiro
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                        onClick={() => {
                          setIsPhoneCallModalOpen(false);
                          setQuickResponseTaskId(phoneCallTaskData.id);
                          setQuickResponseContactName(phoneCallTaskData.contactName);
                          setQuickResponseStatus('reuniao_agendada');
                          setQuickResponseNotes('Reunião agendada com sucesso após ligação telefônica de retorno.');
                          setIsQuickResponseModalOpen(true);
                        }}
                      >
                        Reunião Agendada na Ligação
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#1B4D3E] hover:bg-[#1B4D3E]/90 text-white font-bold text-xs"
                        onClick={() => {
                          setIsPhoneCallModalOpen(false);
                          setQuickResponseTaskId(phoneCallTaskData.id);
                          setQuickResponseContactName(phoneCallTaskData.contactName);
                          setQuickResponseStatus('respondeu');
                          setQuickResponseNotes('Produtor atendeu a ligação telefônica e forneceu direcionamento.');
                          setIsQuickResponseModalOpen(true);
                        }}
                      >
                        Registrar Feedback da Ligação
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE REUNIÃO VIA WHATSAPP COM O PRODUTOR */}
      {isMeetingConfirmationModalOpen && selectedContact && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-emerald-300 space-y-4">
            <div className="flex justify-between items-start pb-3 border-b border-[#D1CCC1]">
              <div>
                <Badge className="bg-emerald-600 text-white text-[10px] mb-1 font-bold">
                  Agendamento Blindado
                </Badge>
                <h3 className="text-xl font-bold text-[#1B4D3E]">
                  Confirmar Reunião via WhatsApp
                </h3>
                <p className="text-xs text-[#5C727D]">
                  Gere uma mensagem oficial personalizada para confirmar dia, horário e local da reunião com o produtor.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsMeetingConfirmationModalOpen(false)}>
                Fechar
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#F5F2EB] rounded-xl border border-[#D1CCC1]">
                <span className="font-extrabold text-[#1B4D3E] block">{selectedContact.organization}</span>
                <span className="text-[#5C727D] block">{selectedContact.city} - {selectedContact.state} • WhatsApp: {selectedContact.formattedPhone}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#5C727D] block mb-1">Data da Reunião *</label>
                  <Input
                    type="date"
                    value={meetingDateInput}
                    onChange={(e) => setMeetingDateInput(e.target.value)}
                    className="bg-white border-[#D1CCC1]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#5C727D] block mb-1">Horário *</label>
                  <Input
                    type="time"
                    value={meetingTimeInput}
                    onChange={(e) => setMeetingTimeInput(e.target.value)}
                    className="bg-white border-[#D1CCC1]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#5C727D] block mb-1">Local / Formato do Encontro *</label>
                <Input
                  placeholder="Ex: Fazenda / Sede do Produtor, Escritório da Revenda ou Videochamada Google Meet"
                  value={meetingLocationInput}
                  onChange={(e) => setMeetingLocationInput(e.target.value)}
                  className="bg-white border-[#D1CCC1]"
                />
              </div>

              {(() => {
                const consultantName = meQuery.data?.name || (activeRep ? activeRep.name : 'Wesley Amancio');
                const formattedDate = meetingDateInput
                  ? new Date(`${meetingDateInput}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : 'Data a confirmar';

                const confirmationMessage = `Olá, ${selectedContact.organization}! Tudo bem?\nAqui é ${consultantName}, da Ademicon Agro.\n\nPassando para confirmar nossa conversa sobre o planejamento financeiro para aquisição de ${selectedContact.interestAsset || 'Tratores e Implementos'}.\n\n📅 Data: ${formattedDate}\n⏰ Horário: ${meetingTimeInput}h\n📍 Local: ${meetingLocationInput}\n\nNosso alinhamento está agendado e reservado na minha agenda. Se preferir ajustar o horário ou incluir mais alguém da fazenda, pode me avisar diretamente por aqui.\n\nAté breve!`;

                return (
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#1B4D3E]">Prévia da Mensagem Oficial:</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(confirmationMessage);
                          toast.success('Mensagem copiada para a área de transferência!');
                        }}
                        className="text-[#1B4D3E] hover:underline font-semibold flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copiar
                      </button>
                    </div>
                    <div className="bg-[#F5F2EB] p-3.5 rounded-xl border border-[#D1CCC1] text-xs text-[#1A3643] leading-relaxed whitespace-pre-wrap font-sans max-h-44 overflow-y-auto">
                      {confirmationMessage}
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-[#D1CCC1]">
                      <Button variant="ghost" size="sm" onClick={() => setIsMeetingConfirmationModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#1B4D3E]/10 font-bold text-xs flex items-center gap-1.5"
                        onClick={() => {
                          try {
                            const dateStr = meetingDateInput || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                            const timeStr = meetingTimeInput || '14:00';
                            const [hours, minutes] = timeStr.split(':').map(Number);
                            const startDateTime = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
                            const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hora de reunião

                            const formatIcsDate = (d: Date) => {
                              return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                            };

                            const dtStamp = formatIcsDate(new Date());
                            const dtStart = formatIcsDate(startDateTime);
                            const dtEnd = formatIcsDate(endDateTime);

                            const summary = `Reunião Comercial Ademicon Agro — ${selectedContact.organization}`;
                            const description = `Reunião comercial de alinhamento e apresentação de plano de consórcio agro (Ademicon) para aquisição de ${selectedContact.interestAsset || 'Tratores e Implementos'}.\\nProdutor: ${selectedContact.organization}\\nTelefone: ${selectedContact.phone}\\nConsultor: ${consultantName}`;
                            const location = meetingLocationInput || 'Fazenda / Sede do Produtor';

                            const icsContent = [
                              'BEGIN:VCALENDAR',
                              'VERSION:2.0',
                              'PRODID:-//Ademicon Agro CRM//Agendamento Comercial//PT',
                              'CALSCALE:GREGORIAN',
                              'METHOD:PUBLISH',
                              'BEGIN:VEVENT',
                              `UID:ademicon-${selectedContact.id}-${Date.now()}@crm.ademicon.agro`,
                              `DTSTAMP:${dtStamp}`,
                              `DTSTART:${dtStart}`,
                              `DTEND:${dtEnd}`,
                              `SUMMARY:${summary}`,
                              `DESCRIPTION:${description}`,
                              `LOCATION:${location}`,
                              'STATUS:CONFIRMED',
                              'BEGIN:VALARM',
                              'TRIGGER:-PT120M',
                              'ACTION:DISPLAY',
                              'DESCRIPTION:Lembrete de Reunião Ademicon Agro (2 horas antes)',
                              'END:VALARM',
                              'END:VEVENT',
                              'END:VCALENDAR',
                            ].join('\r\n');

                            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.setAttribute('download', `reuniao_ademicon_${selectedContact.organization.toLowerCase().replace(/\s+/g, '_')}_${dateStr}.ics`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);

                            toast.success('Arquivo .ics gerado com sucesso! Sincronize com Google Agenda ou Outlook.');
                          } catch (err: any) {
                            toast.error('Erro ao gerar arquivo .ics: ' + err.message);
                          }
                        }}
                        title="Exportar arquivo .ics compatível com Google Agenda, Outlook e Apple Calendar"
                      >
                        <CalendarDays className="w-4 h-4 mr-1 text-[#88B04B]" /> Exportar p/ Calendário (.ics)
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                        onClick={() => {
                          // 1. Gravar interação no CRM
                          addInteractionMutation.mutate({
                            contactId: selectedContact.id,
                            channel: 'whatsapp',
                            direction: 'saida',
                            summary: `Confirmação de Reunião para ${formattedDate} às ${meetingTimeInput}h`,
                            details: `Local: ${meetingLocationInput}. Mensagem enviada para garantir a presença do produtor.`,
                            nextStep: `Realizar reunião comercial em ${formattedDate}`,
                          });

                          // 2. Atualizar etapa do funil para negociação / quente
                          updateStageMutation.mutate({
                            id: selectedContact.id,
                            pipelineStage: 'negociacao',
                            temperature: 'quente',
                          });

                          // 3. Abrir WhatsApp Web
                          const cleanPhone = selectedContact.phone.replace(/\D/g, '');
                          const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                          window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(confirmationMessage)}`, '_blank');
                          toast.success('Confirmação enviada no WhatsApp e registrada na ficha do produtor!');
                          setIsMeetingConfirmationModalOpen(false);
                        }}
                      >
                        <MessageCircle className="w-4 h-4 mr-1" /> Disparar Confirmação no WhatsApp
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE LEMBRETE DE REUNIÃO VIA WHATSAPP (2 HORAS ANTES) */}
      {isMeetingReminderModalOpen && selectedContact && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-amber-300 space-y-4">
            <div className="flex justify-between items-start pb-3 border-b border-[#D1CCC1]">
              <div>
                <Badge className="bg-amber-600 text-white text-[10px] mb-1 font-bold">
                  Lembrete Pré-Reunião (2 Horas Antes)
                </Badge>
                <h3 className="text-xl font-bold text-[#1B4D3E]">
                  Enviar Lembrete de Reunião
                </h3>
                <p className="text-xs text-[#5C727D]">
                  Avise o produtor 2 horas antes do encontro para garantir pontualidade, evitar imprevistos e reforçar o compromisso comercial.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsMeetingReminderModalOpen(false)}>
                Fechar
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#F5F2EB] rounded-xl border border-[#D1CCC1]">
                <span className="font-extrabold text-[#1B4D3E] block">{selectedContact.organization}</span>
                <span className="text-[#5C727D] block">{selectedContact.city} - {selectedContact.state} • WhatsApp: {selectedContact.formattedPhone}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#5C727D] block mb-1">Horário Previsto do Encontro *</label>
                  <Input
                    type="time"
                    value={reminderTimeInput}
                    onChange={(e) => setReminderTimeInput(e.target.value)}
                    className="bg-white border-[#D1CCC1]"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#5C727D] block mb-1">Local / Formato *</label>
                  <Input
                    placeholder="Ex: Fazenda / Sede do Produtor ou Online"
                    value={reminderLocationInput}
                    onChange={(e) => setReminderLocationInput(e.target.value)}
                    className="bg-white border-[#D1CCC1]"
                  />
                </div>
              </div>

              {(() => {
                const consultantName = meQuery.data?.name || (activeRep ? activeRep.name : 'Wesley Amancio');
                const reminderMessage = `Olá, ${selectedContact.organization}! Tudo bem?\nAqui é ${consultantName}, da Ademicon Agro.\n\nPassando só para te avisar que nosso alinhamento está marcado para daqui a 2 horas (às ${reminderTimeInput}h), no formato ${reminderLocationInput}.\n\nJá separei as informações e simulações para a ${selectedContact.organization} sobre ${selectedContact.interestAsset || 'Tratores e Implementos'}. Se precisar antecipar ou remarcar alguns minutos, pode me avisar aqui mesmo.\n\nAté logo!`;

                return (
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#1B4D3E]">Prévia da Mensagem de Lembrete:</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(reminderMessage);
                          toast.success('Lembrete copiado!');
                        }}
                        className="text-[#1B4D3E] hover:underline font-semibold flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copiar Lembrete
                      </button>
                    </div>
                    <div className="bg-[#F5F2EB] p-3.5 rounded-xl border border-[#D1CCC1] text-xs text-[#1A3643] leading-relaxed whitespace-pre-wrap font-sans max-h-44 overflow-y-auto">
                      {reminderMessage}
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-[#D1CCC1]">
                      <Button variant="ghost" size="sm" onClick={() => setIsMeetingReminderModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                        onClick={() => {
                          // 1. Gravar interação no CRM
                          addInteractionMutation.mutate({
                            contactId: selectedContact.id,
                            channel: 'whatsapp',
                            direction: 'saida',
                            summary: `Lembrete de Reunião enviado (2h antes) para às ${reminderTimeInput}h`,
                            details: `Local: ${reminderLocationInput}. Notificação enviada via WhatsApp para garantir presença e pontualidade.`,
                            nextStep: `Executar reunião às ${reminderTimeInput}h`,
                          });

                          // 2. Abrir WhatsApp Web
                          const cleanPhone = selectedContact.phone.replace(/\D/g, '');
                          const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                          window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(reminderMessage)}`, '_blank');
                          toast.success('Lembrete de 2 horas antes enviado no WhatsApp e registrado no histórico!');
                          setIsMeetingReminderModalOpen(false);
                        }}
                      >
                        <MessageCircle className="w-4 h-4 mr-1" /> Disparar Lembrete no WhatsApp
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE BRIEFING PRÉ-REUNIÃO POR IA */}
      {isAiBriefingModalOpen && selectedContact && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-emerald-400">
            <div className="p-6 border-b border-[#D1CCC1] flex justify-between items-center bg-[#F5F2EB]">
              <div>
                <Badge className="bg-[#1B4D3E] text-[#88B04B] text-[10px] mb-1 font-bold flex items-center gap-1 w-fit">
                  <Sparkles className="w-3.5 h-3.5 text-[#88B04B]" /> Inteligência Comercial Ademicon Agro
                </Badge>
                <h3 className="text-xl font-bold text-[#1B4D3E]">
                  Briefing Pré-Reunião — {selectedContact.organization}
                </h3>
                <p className="text-xs text-[#5C727D]">
                  Síntese executiva automatizada com histórico de contatos, notas de voz, objeções e sugestão de abertura.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsAiBriefingModalOpen(false)}>
                Fechar
              </Button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-[#1A3643]">
              <div className="bg-[#F5F2EB] p-3.5 rounded-xl border border-[#D1CCC1] flex justify-between items-center">
                <div>
                  <span className="font-extrabold text-[#1B4D3E] block">{selectedContact.organization}</span>
                  <span className="text-[#5C727D] block">{selectedContact.city} - {selectedContact.state} • Ativo: {selectedContact.interestAsset || 'Tratores e Implementos'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-700 text-emerald-800 hover:bg-emerald-50 h-8 text-xs font-semibold flex items-center gap-1 shrink-0"
                    onClick={handleExportBriefingChecklistPDF}
                    title="Exportar documento PDF para consulta offline durante a visita em campo"
                  >
                    <FileDown className="w-3.5 h-3.5 text-rose-600" /> Exportar PDF Offline
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#1B4D3E] text-[#1B4D3E] h-8 text-xs font-semibold flex items-center gap-1"
                    onClick={() => {
                      if (aiBriefingContent) {
                        navigator.clipboard.writeText(aiBriefingContent);
                        toast.success('Briefing copiado para a área de transferência!');
                      }
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar Briefing
                  </Button>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#D1CCC1] shadow-xs text-xs leading-relaxed whitespace-pre-wrap font-sans space-y-2">
                {aiBriefingContent || 'Gerando briefing executivo com base em todos os dados do produtor...'}
              </div>

              {/* CHECKLIST INTERATIVO DA REUNIÃO COM O PRODUTOR */}
              <div className="bg-gradient-to-r from-emerald-50/60 to-[#F5F2EB] p-4 rounded-xl border border-emerald-300 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h4 className="font-extrabold text-[#1B4D3E] flex items-center gap-1.5 text-sm">
                      <CheckSquare className="w-4 h-4 text-emerald-700" /> Checklist Interativo de Alinhamento da Reunião
                    </h4>
                    <p className="text-[11px] text-[#5C727D]">
                      Marque em tempo real os tópicos comerciais abordados com o produtor rural durante a reunião.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={suggestChecklistTopicsMutation.isPending}
                    onClick={() => {
                      suggestChecklistTopicsMutation.mutate({ contactId: selectedContact.id });
                    }}
                    className="border-emerald-600 text-emerald-800 hover:bg-emerald-100 font-bold text-xs h-8 shrink-0 flex items-center gap-1.5"
                    title="Analisar histórico, transcrições e objeções deste produtor para sugerir pautas específicas"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${suggestChecklistTopicsMutation.isPending ? 'animate-spin' : ''}`} />
                    {suggestChecklistTopicsMutation.isPending ? 'Analisando histórico...' : 'Sugerir tópicos com IA'}
                  </Button>
                  {(() => {
                    const items = meetingChecklistQuery.data || [];
                    const total = items.length;
                    const completedCount = items.filter((i) => i.completed).length;
                    const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;
                    return (
                      <Badge className="bg-[#1B4D3E] text-[#88B04B] font-bold text-xs shrink-0">
                        {completedCount} de {total} itens abordados ({percent}%)
                      </Badge>
                    );
                  })()}
                </div>

                {suggestChecklistTopicsMutation.isPending && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-100/60 border border-emerald-200 text-xs text-emerald-900">
                    <Sparkles className="w-4 h-4 animate-pulse text-emerald-700" />
                    A IA está lendo o histórico, as transcrições e as objeções deste produtor para propor pautas específicas...
                  </div>
                )}

                {aiChecklistSuggestions.length > 0 && !suggestChecklistTopicsMutation.isPending && (
                  <div className="p-3 rounded-lg bg-white/90 border border-emerald-300 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-extrabold text-emerald-900 text-xs flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Sugestões personalizadas da IA
                        </span>
                        <span className="text-[10px] text-[#5C727D]">Revise e adicione somente as pautas que fizerem sentido para esta reunião.</span>
                      </div>
                      <Badge variant="outline" className="border-emerald-300 text-emerald-800 text-[9px] font-bold shrink-0">
                        Não adicionadas automaticamente
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {aiChecklistSuggestions.map((suggestion) => (
                        <div key={suggestion.title} className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-100">
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-[#1B4D3E]">{suggestion.title}</p>
                            <p className="text-[10px] text-[#5C727D] mt-0.5">{suggestion.rationale}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 bg-[#1B4D3E] hover:bg-[#163c31] text-white text-[10px] font-bold shrink-0"
                            disabled={addCustomChecklistItemMutation.isPending}
                            onClick={() => {
                              addCustomChecklistItemMutation.mutate({
                                contactId: selectedContact.id,
                                label: suggestion.title,
                              });
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Adicionar
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-white/80 rounded-lg border border-dashed border-emerald-300">
                  <div className="flex-1">
                    <label htmlFor="custom-checklist-topic" className="sr-only">Adicionar tópico personalizado</label>
                    <Input
                      id="custom-checklist-topic"
                      value={customChecklistItemInput}
                      onChange={(e) => setCustomChecklistItemInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customChecklistItemInput.trim().length >= 3 && !addCustomChecklistItemMutation.isPending) {
                          e.preventDefault();
                          addCustomChecklistItemMutation.mutate({
                            contactId: selectedContact.id,
                            label: customChecklistItemInput.trim(),
                          });
                        }
                      }}
                      placeholder="Adicionar tópico específico deste produtor (ex.: Validar sucessão familiar da fazenda)"
                      maxLength={255}
                      className="h-9 bg-white border-[#B7D9C8] text-xs focus-visible:ring-emerald-500"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={customChecklistItemInput.trim().length < 3 || addCustomChecklistItemMutation.isPending}
                    onClick={() => {
                      addCustomChecklistItemMutation.mutate({
                        contactId: selectedContact.id,
                        label: customChecklistItemInput.trim(),
                      });
                    }}
                    className="h-9 border-[#1B4D3E] text-[#1B4D3E] hover:bg-emerald-50 font-bold text-xs shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    {addCustomChecklistItemMutation.isPending ? 'Salvando...' : 'Adicionar Tópico'}
                  </Button>
                </div>

                <div className="space-y-2 pt-1">
                  {(meetingChecklistQuery.data || []).map((item, index) => (
                    <div
                      key={item.itemKey}
                      draggable={editingChecklistItemKey !== item.itemKey}
                      onDragStart={() => setDraggedChecklistIndex(index)}
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      onDrop={() => {
                        if (draggedChecklistIndex === null || draggedChecklistIndex === index) return;
                        const list = [...(meetingChecklistQuery.data || [])];
                        const [moved] = list.splice(draggedChecklistIndex, 1);
                        list.splice(index, 0, moved);
                        setDraggedChecklistIndex(null);
                        reorderChecklistMutation.mutate({
                          contactId: selectedContact.id,
                          orderedItemKeys: list.map((i) => i.itemKey),
                        });
                      }}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all select-none text-xs ${
                        draggedChecklistIndex === index ? 'opacity-50 border-emerald-500 border-dashed bg-emerald-50' : ''
                      } ${
                        item.completed
                          ? 'bg-emerald-100/70 border-emerald-400 text-emerald-950 font-medium'
                          : 'bg-white border-[#D1CCC1] text-[#1A3643] hover:border-emerald-300'
                        }`}
                    >
                      <div
                        className="mt-0.5 text-[#5C727D] hover:text-[#1B4D3E] cursor-grab active:cursor-grabbing p-0.5 shrink-0"
                        title="Arraste para priorizar este tópico da reunião"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>

                      <input
                        id={`meeting-checklist-${item.itemKey}`}
                        type="checkbox"
                        checked={item.completed}
                        onChange={(e) => {
                          toggleChecklistItemMutation.mutate({
                            contactId: selectedContact.id,
                            itemKey: item.itemKey,
                            label: item.label,
                            completed: e.target.checked,
                          });
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      {editingChecklistItemKey === item.itemKey ? (
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <Input
                            autoFocus
                            value={editingChecklistItemLabel}
                            onChange={(e) => setEditingChecklistItemLabel(e.target.value)}
                            maxLength={255}
                            className="h-8 bg-white border-amber-300 text-xs focus-visible:ring-amber-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && editingChecklistItemLabel.trim().length >= 3) {
                                updateCustomChecklistItemMutation.mutate({
                                  contactId: selectedContact.id,
                                  itemKey: item.itemKey,
                                  label: editingChecklistItemLabel.trim(),
                                });
                              }
                              if (e.key === 'Escape') {
                                setEditingChecklistItemKey(null);
                                setEditingChecklistItemLabel('');
                              }
                            }}
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={editingChecklistItemLabel.trim().length < 3 || updateCustomChecklistItemMutation.isPending}
                              onClick={() => {
                                updateCustomChecklistItemMutation.mutate({
                                  contactId: selectedContact.id,
                                  itemKey: item.itemKey,
                                  label: editingChecklistItemLabel.trim(),
                                });
                              }}
                              className="h-6 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Salvar
                            </Button>
                            <button
                              type="button"
                              className="text-[10px] text-[#5C727D] hover:underline font-semibold"
                              onClick={() => {
                                setEditingChecklistItemKey(null);
                                setEditingChecklistItemLabel('');
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label htmlFor={`meeting-checklist-${item.itemKey}`} className="flex-1 min-w-0 cursor-pointer">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={item.completed ? 'line-through text-emerald-900/80 font-semibold' : 'font-medium'}>
                              {item.label}
                            </span>
                            {item.isCustom && (
                              <Badge variant="outline" className="border-amber-400 text-amber-800 bg-amber-50 text-[9px] px-1.5 py-0 font-bold">
                                Personalizado
                              </Badge>
                            )}
                          </div>
                          {item.completed && item.completedAt && (
                            <span className="block text-[10px] text-emerald-800 mt-0.5 font-mono">
                              ✓ Concluído às {new Date(item.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </label>
                      )}

                      {item.isCustom && editingChecklistItemKey !== item.itemKey && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-amber-700 hover:bg-amber-100"
                            title="Editar tópico personalizado"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingChecklistItemKey(item.itemKey);
                              setEditingChecklistItemLabel(item.label);
                            }}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-rose-700 hover:bg-rose-100"
                            title="Excluir tópico personalizado"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (window.confirm(`Excluir o tópico personalizado "${item.label}"?`)) {
                                deleteCustomChecklistItemMutation.mutate({
                                  contactId: selectedContact.id,
                                  itemKey: item.itemKey,
                                });
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* REGISTRO DE ATA PÓS-REUNIÃO & CONVERSÃO AUTOMÁTICA DE TÓPICOS PENDENTES EM TAREFAS */}
              <div className="bg-white p-4 rounded-xl border border-[#D1CCC1] shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h4 className="font-extrabold text-[#1B4D3E] flex items-center gap-1.5 text-sm">
                      <ClipboardCheck className="w-4 h-4 text-emerald-700" /> Ata do Encontro & Desdobramentos Pós-Reunião
                    </h4>
                    <p className="text-[11px] text-[#5C727D]">
                      Registre as deliberações da reunião. Os tópicos da pauta que permanecerem não marcados serão transformados automaticamente em tarefas de follow-up.
                    </p>
                  </div>

                  {(() => {
                    const pendingItems = (meetingChecklistQuery.data || []).filter(i => !i.completed);
                    return (
                      <Badge variant="outline" className={`text-xs font-bold shrink-0 ${pendingItems.length > 0 ? 'border-amber-400 text-amber-900 bg-amber-50' : 'border-emerald-400 text-emerald-900 bg-emerald-50'}`}>
                        {pendingItems.length > 0 ? `${pendingItems.length} tópico(s) pendente(s) gerarão tarefas` : 'Todos os tópicos foram abordados'}
                      </Badge>
                    );
                  })()}
                </div>

                <div className="space-y-2">
                  <textarea
                    rows={3}
                    value={meetingMinutesText}
                    onChange={(e) => setMeetingMinutesText(e.target.value)}
                    placeholder="Resuma o desfecho da conversa com o produtor (ex.: Alinhada aquisição de colheitadeira para safra de soja, solicitado reenvio do balanço e validação de lance livre de 25%)..."
                    className="w-full p-2.5 rounded-lg border border-[#D1CCC1] text-xs bg-white text-[#1A3643] focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-sans"
                  />

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-1">
                    <div className="flex items-center gap-2 text-xs text-[#5C727D]">
                      <span>Prazo dos follow-ups automáticos:</span>
                      <select
                        value={meetingMinutesDueHours}
                        onChange={(e) => setMeetingMinutesDueHours(Number(e.target.value))}
                        className="h-7 text-xs rounded border border-[#D1CCC1] bg-white px-2 text-[#1A3643]"
                      >
                        <option value={24}>24 horas (Urgente)</option>
                        <option value={48}>48 horas (Padrão Comercial)</option>
                        <option value={72}>72 horas (3 dias)</option>
                        <option value={168}>7 dias (Semana seguinte)</option>
                      </select>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      disabled={meetingMinutesText.trim().length < 5 || saveMeetingMinutesMutation.isPending}
                      onClick={() => {
                        saveMeetingMinutesMutation.mutate({
                          contactId: selectedContact.id,
                          content: meetingMinutesText.trim(),
                          dueHours: meetingMinutesDueHours,
                        });
                      }}
                      className="bg-[#1B4D3E] hover:bg-[#163c31] text-white font-bold text-xs h-8 shrink-0 flex items-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#88B04B]" />
                      {saveMeetingMinutesMutation.isPending ? 'Gravando ata...' : 'Salvar Ata & Gerar Follow-ups'}
                    </Button>
                  </div>

                  {meetingMinutesQuery.data && (
                    <div className="p-3 rounded-lg bg-[#F5F2EB] border border-[#D1CCC1] text-[11px] text-[#5C727D] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <span>Última ata salva em <strong>{new Date(meetingMinutesQuery.data.updatedAt).toLocaleDateString('pt-BR')} às {new Date(meetingMinutesQuery.data.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#1B4D3E]">{meetingMinutesQuery.data.generatedTaskCount} tarefas geradas</span>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-7 px-2.5 flex items-center gap-1 shadow-2xs"
                          onClick={() => {
                            const minuteContent = meetingMinutesText.trim() || meetingMinutesQuery.data?.content || '';
                            const pendingItems = (meetingChecklistQuery.data || []).filter(i => !i.completed);
                          const doneItems = (meetingChecklistQuery.data || []).filter(i => i.completed);
                          const consultantName = meQuery.data?.name || (activeRep ? activeRep.name : 'Wesley Amancio');

                          let msg = `Olá, *${selectedContact.organization}*!\nAqui é ${consultantName}, da Ademicon Agro.\n\n` +
                              `Passando para formalizar o *resumo do nosso alinhamento comercial* realizado recentemente:\n\n` +
                              `📝 *Deliberações da Reunião:*\n${minuteContent}\n\n`;

                            if (doneItems.length > 0) {
                              msg += `✅ *Pontos Alinhados:*\n` + doneItems.map(i => `• ${i.label}`).join('\n') + `\n\n`;
                            }
                            if (pendingItems.length > 0) {
                              msg += `📌 *Próximos Passos & Acompanhamentos:*\n` + pendingItems.map(i => `• ${i.label}`).join('\n') + `\n\n`;
                            }

                            msg += `Seguimos à disposição para os próximos passos da sua safra e planejamento de aquisição. Qualquer dúvida, estou à disposição por aqui!`;

                            const cleanPhone = selectedContact.phone.replace(/\D/g, '');
                            const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                            window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                            toast.success('Resumo da ata e próximos passos preparados no WhatsApp!');
                          }}
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-white" /> Enviar Resumo no WhatsApp
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#D1CCC1] flex justify-end gap-2 bg-[#F5F2EB]/50">
              <Button variant="ghost" size="sm" onClick={() => setIsAiBriefingModalOpen(false)}>
                Fechar
              </Button>
              <Button
                size="sm"
                className="bg-[#1B4D3E] hover:bg-[#163c31] text-white font-bold text-xs flex items-center gap-1.5"
                onClick={() => {
                  setIsAiBriefingModalOpen(false);
                  setIsMeetingConfirmationModalOpen(true);
                }}
              >
                <Calendar className="w-4 h-4 mr-1 text-[#88B04B]" /> Confirmar Reunião no WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE COMPARAÇÃO & MESCLAGEM DE CONTATOS DUPLICADOS */}
      {mergeModalOpen && activeMergeCluster && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-[#D1CCC1] space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-3 border-b border-[#D1CCC1]">
              <div>
                <Badge className="bg-[#1B4D3E] text-[#88B04B] text-[10px] mb-1 font-bold">
                  Saneamento Seguro de Base
                </Badge>
                <h3 className="text-xl font-bold text-[#1B4D3E] flex items-center gap-2">
                  <GitMerge className="w-5 h-5 text-[#88B04B]" /> Comparar & Mesclar Contatos
                </h3>
                <p className="text-xs text-[#5C727D]">
                  Critério: <strong>{activeMergeCluster.reason}</strong> (Grau de similaridade: {activeMergeCluster.score}%). Escolha o registro que será mantido como principal.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setMergeModalOpen(false)}>
                Fechar
              </Button>
            </div>

            {/* Alerta de Preservação de Histórico */}
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">Nenhum histórico é deletado na mesclagem.</span>
                <p className="text-[11px] leading-relaxed">
                  Todas as tarefas de follow-up, notas de voz, interações e propostas dos contatos secundários serão reatribuídas para o contato principal selecionado. Os cadastros duplicados serão arquivados com marcação de rastreio de auditoria.
                </p>
              </div>
            </div>

            {/* Grade de Seleção do Contato Principal */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#1B4D3E] block">
                1. Selecione qual registro será mantido como principal (Master):
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeMergeCluster.contacts.map((c: any) => {
                  const isPrimary = primaryContactIdChoice === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setPrimaryContactIdChoice(c.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isPrimary
                          ? 'bg-emerald-50/70 border-emerald-600 ring-2 ring-emerald-600/30 shadow-sm'
                          : 'bg-white border-[#D1CCC1] hover:bg-[#F5F2EB]/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="primary_contact_choice"
                            checked={isPrimary}
                            onChange={() => setPrimaryContactIdChoice(c.id)}
                            className="accent-emerald-700 h-4 w-4"
                          />
                          <span className="font-bold text-sm text-[#1B4D3E]">{c.organization}</span>
                        </div>
                        <Badge variant={isPrimary ? 'default' : 'outline'} className={isPrimary ? 'bg-emerald-700 text-white text-[10px]' : 'text-[10px]'}>
                          {isPrimary ? 'Contato Principal' : `Secundário (#${c.id})`}
                        </Badge>
                      </div>

                      <div className="space-y-1 text-xs text-[#5C727D]">
                        <p>Localização: <strong className="text-[#1A3643]">{c.city} - {c.state}</strong></p>
                        <p>Segmento: <strong className="text-[#1A3643]">{c.segment}</strong></p>
                        <p>Telefone: <strong className="font-mono text-[#1A3643]">{c.phone}</strong></p>
                        {c.taxId && <p>Documento: <strong className="font-mono text-[#1A3643]">{c.taxId}</strong></p>}
                        <p>Carteira: <strong className="text-[#1B4D3E]">{c.assignedRepName || 'Sem consultor'}</strong></p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-[#D1CCC1]/60 flex items-center justify-between text-[11px] text-[#5C727D]">
                        <span>{c.interactionsCount} interações vinculadas</span>
                        <span>{c.tasksCount} tarefas pendentes</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Justificativa e Motivo */}
            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-[#1B4D3E] block">
                2. Motivo da mesclagem (registrado na trilha de auditoria):
              </label>
              <Input
                value={mergeReasonInput}
                onChange={(e) => setMergeReasonInput(e.target.value)}
                placeholder="Ex: Mesclagem manual após confirmação de mesmo CNPJ e telefone comercial"
                className="bg-[#F5F2EB]/50 border-[#D1CCC1] text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D1CCC1]">
              <Button variant="ghost" onClick={() => setMergeModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!primaryContactIdChoice || mergeContactsMutation.isPending}
                onClick={() => {
                  if (!primaryContactIdChoice) return;
                  const duplicateIds = activeMergeCluster.contacts
                    .map((c: any) => c.id)
                    .filter((id: number) => id !== primaryContactIdChoice);

                  mergeContactsMutation.mutate({
                    primaryContactId: primaryContactIdChoice,
                    duplicateContactIds: duplicateIds,
                    reason: mergeReasonInput.trim() || undefined,
                  });
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm"
              >
                <GitMerge className="w-4 h-4 mr-1.5" />
                {mergeContactsMutation.isPending ? 'Unificando históricos...' : 'Confirmar Mesclagem e Arquivar Duplicados'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { buildContactsCsv, downloadContactsCsv } from '@/lib/contactCsv';
