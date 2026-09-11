import type { Opportunity } from '../../entities/opportunity/model/opportunity.types'
import andesSolar from '../../assets/businesses/logos/andes-solar.png'
import altiplanoQuinoa from '../../assets/businesses/logos/altiplano-quinoa.png'
import vallesurDesarrollos from '../../assets/businesses/photos/vallesur-desarrollos.jpg'
import rutasDelOriente from '../../assets/businesses/photos/rutas-del-oriente.jpg'
import clinicaSumasalud from '../../assets/businesses/photos/clinica-sumasalud.jpg'
import andesoft from '../../assets/businesses/logos/andesoft.png'

export const opportunities: Opportunity[] = [
  {
    id: 'andes-solar',
    business: {
      id: 'andes-solar',
      name: 'Andes Solar SRL',
      image: andesSolar,
      imageType: 'logo',
    },
    category: 'Clean Energy',
    description: 'Energía solar para un Bolivia más limpio y productivo.',
    fundingRequested: 250000,
    expectedApy: 12.4,
    durationMonths: 12,
    verified: true,
    risk: 'low',
  },
  {
    id: 'altiplano-quinoa',
    business: {
      id: 'altiplano-quinoa',
      name: 'Altiplano Quinoa',
      image: altiplanoQuinoa,
      imageType: 'logo',
    },
    category: 'Agriculture',
    description: 'Quinoa orgánica de nuestras comunidades para el mundo.',
    fundingRequested: 175000,
    expectedApy: 11.1,
    durationMonths: 12,
    verified: false,
    risk: 'low',
  },
  {
    id: 'vallesur-desarrollos',
    business: {
      id: 'vallesur-desarrollos',
      name: 'ValleSur Desarrollos',
      image: vallesurDesarrollos,
      imageType: 'photo',
    },
    category: 'Real Estate',
    description: 'Viviendas sostenibles para familias bolivianas.',
    fundingRequested: 500000,
    expectedApy: 8.9,
    durationMonths: 24,
    verified: true,
    risk: 'low',
  },
  {
    id: 'rutas-del-oriente',
    business: {
      id: 'rutas-del-oriente',
      name: 'Rutas del Oriente',
      image: rutasDelOriente,
      imageType: 'photo',
    },
    category: 'Logistics',
    description: 'Conectando La Paz, Cochabamba y Santa Cruz para un mejor Bolivia.',
    fundingRequested: 300000,
    expectedApy: 10.2,
    durationMonths: 18,
    verified: false,
    risk: 'medium',
  },
  {
    id: 'clinica-sumasalud',
    business: {
      id: 'clinica-sumasalud',
      name: 'Clínica SumaSalud',
      image: clinicaSumasalud,
      imageType: 'photo',
    },
    category: 'Healthcare',
    description: 'Salud de calidad y accesible para más familias bolivianas.',
    fundingRequested: 200000,
    expectedApy: 9.5,
    durationMonths: 12,
    verified: true,
    risk: 'low',
  },
  {
    id: 'andesoft',
    business: {
      id: 'andesoft',
      name: 'AndeSoft',
      image: andesoft,
      imageType: 'logo',
    },
    category: 'Technology',
    description: 'Software boliviano para negocios que crecen.',
    fundingRequested: 150000,
    expectedApy: 11.8,
    durationMonths: 12,
    verified: false,
    risk: 'low',
  },
]
