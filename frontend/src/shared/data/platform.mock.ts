import type {
  CompanySummary,
  DemoNotification,
  DemoUser,
  Investment,
  Payment,
  Proposal,
  WalletTransaction,
} from '../types/platform.types'

export const demoUsers: DemoUser[] = [
  { id: 'usr-investor', name: 'Valeria Mendoza', email: 'investor@demo.com', role: 'INVESTOR', kycStatus: 'VERIFIED' },
  { id: 'usr-company', name: 'Diego Arce', email: 'company@demo.com', role: 'COMPANY', companyName: 'Altura Constructora SRL', kybStatus: 'VERIFIED' },
  { id: 'usr-admin', name: 'Mariana Rojas', email: 'admin@demo.com', role: 'ADMIN' },
]

export const initialInvestments: Investment[] = [
  {
    id: 'inv-001',
    opportunityId: 'residencial-mirador-valle',
    projectName: 'Residencial Mirador del Valle',
    companyName: 'ValleSur Desarrollos SRL',
    amount: 3500,
    investedAt: '2026-06-04',
    expectedApy: 8.9,
    durationMonths: 24,
    nextPayment: '2027-06-04',
    capitalRecovered: 0,
    earningsReceived: 0,
    projectProgress: 46,
    status: 'ACTIVE',
    transactionHash: '0x8b1a...42f9',
  },
  {
    id: 'inv-002',
    opportunityId: 'andes-solar-expansion',
    projectName: 'Expansión Solar Productiva',
    companyName: 'Andes Solar SRL',
    amount: 2000,
    investedAt: '2026-05-18',
    expectedApy: 12.4,
    durationMonths: 12,
    nextPayment: '2027-05-18',
    capitalRecovered: 0,
    earningsReceived: 0,
    projectProgress: 61,
    status: 'ACTIVE',
    transactionHash: '0x21c4...ab70',
  },
  {
    id: 'inv-003',
    opportunityId: 'altiplano-quinoa-exporta',
    projectName: 'Quinoa Bolivia Exporta',
    companyName: 'Altiplano Quinoa',
    amount: 1000,
    investedAt: '2025-08-10',
    expectedApy: 11.1,
    durationMonths: 12,
    nextPayment: '2026-08-10',
    capitalRecovered: 1000,
    earningsReceived: 111,
    projectProgress: 100,
    status: 'COMPLETED',
    transactionHash: '0xb834...90d1',
  },
]

export const initialProposals: Proposal[] = [
  {
    id: 'prop-mirador-norte',
    companyId: 'company-altura',
    companyName: 'Altura Constructora SRL',
    projectName: 'Torres Mirador Norte',
    category: 'Construcción',
    projectType: 'Edificio residencial',
    location: 'La Paz, Bolivia',
    description: 'Financiamiento para estructura y cerramientos de una torre residencial de 14 niveles.',
    fundingRequested: 720000,
    expectedApy: 10.6,
    durationMonths: 30,
    minimumInvestment: 250,
    status: 'UNDER_REVIEW',
    submittedAt: '2026-09-08',
    priority: 'Alta',
    fundUse: [
      { label: 'Materiales', percentage: 45 },
      { label: 'Personal', percentage: 30 },
      { label: 'Equipamiento', percentage: 15 },
      { label: 'Otros', percentage: 10 },
    ],
    guarantee: 'Bien inmueble + pagaré empresarial',
    reviewerNotes: ['Documentación financiera completa.', 'Pendiente confirmación final del seguro de obra.'],
  },
  {
    id: 'prop-parque-industrial',
    companyId: 'company-urbania',
    companyName: 'Urbania SRL',
    projectName: 'Parque Industrial Sur',
    category: 'Industria',
    projectType: 'Infraestructura industrial',
    location: 'Santa Cruz, Bolivia',
    description: 'Construcción de módulos logísticos y servicios comunes para pequeñas industrias.',
    fundingRequested: 950000,
    expectedApy: 11.2,
    durationMonths: 36,
    minimumInvestment: 500,
    status: 'CHANGES_REQUESTED',
    submittedAt: '2026-09-02',
    priority: 'Media',
    fundUse: [
      { label: 'Obra civil', percentage: 55 },
      { label: 'Servicios básicos', percentage: 25 },
      { label: 'Permisos', percentage: 10 },
      { label: 'Contingencias', percentage: 10 },
    ],
    guarantee: 'Hipoteca sobre terreno',
    reviewerNotes: ['Actualizar el cronograma de servicios eléctricos.', 'Adjuntar avalúo independiente vigente.'],
  },
]

export const companies: CompanySummary[] = [
  { id: 'company-altura', name: 'Altura Constructora SRL', city: 'La Paz', representative: 'Diego Arce', nit: '486201029', sector: 'Construcción', kybStatus: 'VERIFIED', registeredAt: '2026-02-14' },
  { id: 'company-vallesur', name: 'ValleSur Desarrollos SRL', city: 'Cochabamba', representative: 'Gabriela Torrico', nit: '387492018', sector: 'Bienes raíces', kybStatus: 'VERIFIED', registeredAt: '2026-01-28' },
  { id: 'company-urbania', name: 'Urbania SRL', city: 'Santa Cruz', representative: 'Mateo Salvatierra', nit: '759204168', sector: 'Infraestructura', kybStatus: 'UNDER_REVIEW', registeredAt: '2026-08-19' },
  { id: 'company-novacasa', name: 'NovaCasa Bolivia', city: 'Sucre', representative: 'Adriana Quiroga', nit: '621483079', sector: 'Vivienda', kybStatus: 'ACTION_REQUIRED', registeredAt: '2026-08-27' },
]

export const payments: Payment[] = [
  { id: 'pay-001', companyName: 'ValleSur Desarrollos SRL', projectName: 'Residencial Mirador del Valle', amount: 28750, expectedAt: '2026-09-25', status: 'PENDING' },
  { id: 'pay-002', companyName: 'Andes Solar SRL', projectName: 'Expansión Solar Productiva', amount: 22100, expectedAt: '2026-09-05', receivedAt: '2026-09-05', status: 'DISTRIBUTED' },
  { id: 'pay-003', companyName: 'Urbania SRL', projectName: 'Centro Empresarial Andino', amount: 34900, expectedAt: '2026-08-30', status: 'LATE' },
  { id: 'pay-004', companyName: 'Altiplano Quinoa', projectName: 'Quinoa Bolivia Exporta', amount: 19425, expectedAt: '2026-08-10', receivedAt: '2026-08-10', status: 'DISTRIBUTED' },
]

export const notifications: DemoNotification[] = [
  { id: 'not-1', title: 'Nueva actualización del proyecto', description: 'Mirador del Valle publicó el avance de fundaciones.', createdAt: 'Hace 2 horas', read: false, audience: 'INVESTOR' },
  { id: 'not-2', title: 'Pago recibido', description: 'El pago de Andes Solar fue registrado y distribuido.', createdAt: 'Ayer', read: false, audience: 'INVESTOR' },
  { id: 'not-3', title: 'Proyecto en revisión', description: 'Torres Mirador Norte fue asignado al equipo de análisis.', createdAt: 'Hace 3 horas', read: false, audience: 'COMPANY' },
  { id: 'not-4', title: 'Cambios solicitados', description: 'Revisa las observaciones de Parque Industrial Sur.', createdAt: 'Ayer', read: true, audience: 'COMPANY' },
  { id: 'not-5', title: 'KYB pendiente', description: 'Urbania SRL requiere revisión documental.', createdAt: 'Hace 35 minutos', read: false, audience: 'ADMIN' },
  { id: 'not-6', title: 'Pago vencido', description: 'Centro Empresarial Andino presenta un pago pendiente.', createdAt: 'Hace 1 hora', read: false, audience: 'ADMIN' },
]

export const walletTransactions: WalletTransaction[] = [
  { id: 'tx-01', type: 'Depósito', amount: 10000, date: '2026-08-28', status: 'Confirmada', hash: '0x419a...c802' },
  { id: 'tx-02', type: 'Inversión', amount: -3500, date: '2026-06-04', status: 'Confirmada', hash: '0x8b1a...42f9' },
  { id: 'tx-03', type: 'Pago recibido', amount: 248, date: '2026-05-20', status: 'Confirmada', hash: '0x77d2...1ae8' },
  { id: 'tx-04', type: 'Inversión', amount: -2000, date: '2026-05-18', status: 'Confirmada', hash: '0x21c4...ab70' },
  { id: 'tx-05', type: 'Reembolso', amount: 750, date: '2026-04-02', status: 'Confirmada', hash: '0x9f12...8b11' },
]
