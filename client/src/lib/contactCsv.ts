export type ContactCsvRecord = {
  id: number;
  leadBatch?: string | null;
  state: string;
  city: string;
  organization: string;
  leadType?: string | null;
  segment?: string | null;
  activity: string;
  formattedPhone: string;
  interestAsset?: string | null;
  pipelineStage: string;
  assignedRepId?: number | null;
  sourceUrl?: string | null;
  interestTag?: string | null;
  observation?: string | null;
  observationSummary?: string | null;
};

export type ContactCsvRep = {
  id: number;
  name: string;
};

const escapeCsvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export function buildContactsCsv(
  contacts: ContactCsvRecord[],
  reps: ContactCsvRep[],
  stageLabels: Record<string, string>,
  metadata: { exportedBy: string; exportedAt: string },
) {
  const headers = [
    'ID',
    'Lote_Origem',
    'Estado',
    'Municipio',
    'Organizacao',
    'Tipo_Lead',
    'Atividade',
    'Telefone',
    'Ativo_Consorcio',
    'Etapa',
    'Consultor_Atribuido',
    'Tag_Classificacao_Interesse',
    'Observacao_Completa',
    'Resumo_IA',
    'Fonte_Oficial',
  ];

  const rows = contacts.map((contact) => {
    const rep = reps.find((item) => item.id === contact.assignedRepId);
    return [
      contact.id,
      contact.leadBatch || 'Base existente',
      contact.state,
      contact.city,
      contact.organization,
      contact.leadType || contact.segment || '',
      contact.activity,
      contact.formattedPhone,
      contact.interestAsset || '',
      stageLabels[contact.pipelineStage] || contact.pipelineStage,
      rep?.name || 'Nenhum',
      contact.interestTag || '',
      contact.observation || '',
      contact.observationSummary || '',
      contact.sourceUrl || '',
    ].map(escapeCsvCell).join(';');
  });

  const watermarkLines = [
    '# DOCUMENTO CONFIDENCIAL — ADEMICON AGRO CRM',
    `# EXPORTADO POR: ${metadata.exportedBy} EM ${metadata.exportedAt}`,
    `# REGISTROS: ${contacts.length} | OBSERVAÇÕES E RESUMOS DE IA INCLUÍDOS | USO ESTRITAMENTE INTERNO E RASTREADO`,
    '# A REPRODUÇÃO OU COMPARTILHAMENTO NÃO AUTORIZADO É MONITORADO POR AUDITORIA',
    '',
  ];

  return '\uFEFF' + [...watermarkLines, headers.map(escapeCsvCell).join(';'), ...rows].join('\r\n');
}

export function downloadContactsCsv(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export { escapeCsvCell };

// A exportação preserva quebras de linha e aspas em observações sem quebrar o CSV:
// o Excel interpreta cada célula delimitada por aspas conforme o padrão RFC 4180.
