import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  FileCheck2,
  HandCoins,
  Landmark,
  LockKeyhole,
  SearchCheck,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { appAssets } from '../../../assets/assets'
import { OpportunityCard } from '../../../entities/opportunity/ui/OpportunityCard'
import { opportunities } from '../../../shared/data/opportunities.mock'
import { Button } from '../../../shared/ui/button/Button'
import { PageHeader, SectionCard } from '../../../shared/ui/platform/PlatformUI'
import './PublicPages.css'

const processSteps = [
  { icon: Building2, title: 'La empresa presenta', text: 'Comparte el proyecto, sus números, cronograma, documentos y garantías.' },
  { icon: SearchCheck, title: 'La plataforma revisa', text: 'El equipo analiza empresa, condiciones, riesgos y documentación antes de publicar.' },
  { icon: HandCoins, title: 'Los inversionistas participan', text: 'Cada persona compara oportunidades y decide cuánto capital asignar.' },
  { icon: Blocks, title: 'La operación se registra', text: 'El vault y el registro blockchain aportan trazabilidad a la operación.' },
]

export function LandingPage() {
  return (
    <main id="main-content" className="landing">
      <section className="landing-hero page-shell">
        <div className="landing-hero__copy">
          <p className="landing-eyebrow">FINANCIAMIENTO QUE CONSTRUYE FUTURO</p>
          <h1>Invierte en proyectos empresariales con información clara.</h1>
          <p>Conectamos capital con empresas verificadas, empezando por proyectos inmobiliarios y de construcción en Bolivia.</p>
          <div className="landing-hero__actions">
            <Button to="/opportunities">Explorar oportunidades <ArrowRight size={20} /></Button>
            <Button to="/auth/register?role=company" variant="secondary">Buscar financiamiento</Button>
          </div>
          <div className="landing-hero__trust">
            <span><BadgeCheck size={18} /> Verificación documental</span>
            <span><ShieldCheck size={18} /> Riesgos visibles</span>
            <span><Blocks size={18} /> Trazabilidad mock</span>
          </div>
        </div>
        <div className="landing-hero__visual" aria-hidden="true">
          <img src={appAssets.illustrations.marketplaceHero} alt="" />
          <div className="landing-float landing-float--one"><Building2 /><span><strong>8 proyectos</strong> disponibles</span></div>
          <div className="landing-float landing-float--two"><LockKeyhole /><span><strong>Fondos protegidos</strong> en vault</span></div>
        </div>
      </section>

      <section className="landing-stats" aria-label="Indicadores de demostración">
        <div className="page-shell">
          <p><strong>2.7M USDT</strong><span>capital solicitado</span></p>
          <p><strong>1.5M USDT</strong><span>financiación registrada</span></p>
          <p><strong>807</strong><span>inversionistas mock</span></p>
          <p><strong>8</strong><span>proyectos publicados</span></p>
        </div>
      </section>

      <section className="landing-section page-shell" id="how">
        <div className="landing-section__heading"><p className="landing-eyebrow">UN PROCESO COMPRENSIBLE</p><h2>Cómo funciona Seed 2 Deed</h2><p>La tecnología acompaña el proceso; las decisiones siguen basadas en información, condiciones y riesgo.</p></div>
        <div className="process-grid">
          {processSteps.map((step, index) => <article key={step.title}><span className="process-grid__number">0{index + 1}</span><span className="process-grid__icon"><step.icon size={24} /></span><h3>{step.title}</h3><p>{step.text}</p></article>)}
        </div>
      </section>

      <section className="landing-section landing-section--wide">
        <div className="page-shell">
          <div className="landing-section__heading landing-section__heading--row"><div><p className="landing-eyebrow">PROYECTOS DESTACADOS</p><h2>Oportunidades que construyen progreso</h2></div><Button to="/opportunities" variant="secondary">Ver todas <ArrowRight size={19} /></Button></div>
          <div className="landing-opportunities">{opportunities.slice(0, 3).map((opportunity) => <OpportunityCard key={opportunity.id} opportunity={opportunity} />)}</div>
        </div>
      </section>

      <section className="landing-section page-shell">
        <div className="audience-grid">
          <article className="audience-card audience-card--investor"><span><WalletCards size={29} /></span><p className="landing-eyebrow">PARA INVERSIONISTAS</p><h2>Decide con contexto, no con promesas.</h2><ul><li>Compara retorno estimado, plazo y riesgo.</li><li>Consulta documentos, garantías y uso de fondos.</li><li>Sigue avances, pagos y movimientos registrados.</li></ul><Button to="/auth/register?role=investor">Quiero invertir <ArrowRight size={19} /></Button></article>
          <article className="audience-card audience-card--company"><span><BriefcaseBusiness size={29} /></span><p className="landing-eyebrow">PARA EMPRESAS</p><h2>Convierte un proyecto sólido en una propuesta financiable.</h2><ul><li>Presenta información en un proceso guiado.</li><li>Recibe observaciones claras del equipo revisor.</li><li>Reporta avances y gestiona obligaciones.</li></ul><Button to="/auth/register?role=company" variant="secondary">Buscar financiamiento <ArrowRight size={19} /></Button></article>
        </div>
      </section>

      <section className="landing-section security-band">
        <div className="page-shell security-band__inner">
          <div><p className="landing-eyebrow">CONFIANZA POR DISEÑO</p><h2>Verificación, garantías y trazabilidad.</h2><p>Mostramos lo que se revisó, los riesgos identificados y el estado del vault con lenguaje entendible.</p><Button to="/security" variant="secondary">Conocer la seguridad</Button></div>
          <div className="security-list"><p><FileCheck2 /> Documentación del proyecto</p><p><Landmark /> Garantías declaradas y estado</p><p><LockKeyhole /> Fondos y condiciones del vault</p><p><Blocks /> Transacciones visibles en la demo</p></div>
        </div>
      </section>

      <section className="landing-section page-shell landing-faq">
        <div className="landing-section__heading"><p className="landing-eyebrow">PREGUNTAS FRECUENTES</p><h2>Antes de comenzar</h2></div>
        <div className="faq-list">
          <details><summary>¿El retorno está garantizado?</summary><p>No. Todo retorno mostrado es una estimación y cada inversión implica riesgos que deben evaluarse.</p></details>
          <details><summary>¿Las empresas están verificadas?</summary><p>La interfaz muestra el estado de revisión de cada empresa, documento y garantía con datos mock para esta demo.</p></details>
          <details><summary>¿Necesito entender blockchain?</summary><p>No. Se presenta como una capa de trazabilidad y confianza, acompañada de explicaciones sencillas.</p></details>
        </div>
        <Link className="landing-faq__link" to="/faq">Ver todas las preguntas <ArrowRight size={18} /></Link>
      </section>

      <section className="landing-cta page-shell"><div><span><Users size={34} /></span><div><p className="landing-eyebrow">CAPITAL + PROYECTOS REALES</p><h2>Elige cómo quieres comenzar.</h2><p>Explora oportunidades o presenta una propuesta de financiamiento.</p></div><div><Button to="/opportunities">Explorar oportunidades</Button><Button to="/auth/register?role=company" variant="secondary">Soy una empresa</Button></div></div></section>
    </main>
  )
}

const infoContent = {
  'how-it-works': { eyebrow: 'EL MODELO', title: 'Cómo funciona', description: 'Una operación ordenada desde la propuesta empresarial hasta la devolución de capital.', sections: processSteps.map((item) => ({ title: item.title, text: item.text })) },
  security: { eyebrow: 'SEGURIDAD Y CONFIANZA', title: 'Transparencia para tomar decisiones', description: 'La seguridad se construye con revisión, garantías, información visible y seguimiento.', sections: [
    { title: 'Verificación de empresas', text: 'La revisión mock contempla identidad empresarial, representación legal, estados financieros y documentación societaria.' },
    { title: 'Garantías visibles', text: 'Cada oportunidad identifica el tipo de garantía, su valor declarado y su estado de validación.' },
    { title: 'Riesgos sin ocultar', text: 'Se presentan factores financieros, legales, de ejecución, mercado y retraso para evitar falsas promesas.' },
    { title: 'Vault y blockchain', text: 'El vault mock muestra fondos protegidos, red, contrato y transacciones sin exigir conocimientos técnicos.' },
  ] },
  about: { eyebrow: 'LA PLATAFORMA', title: 'Capital para construir progreso real', description: 'Seed 2 Deed conecta empresas que buscan financiamiento con inversionistas que valoran información clara.', sections: [
    { title: 'Propósito', text: 'Facilitar que proyectos empresariales sólidos, inicialmente de vivienda y construcción, presenten su caso de forma comparable.' },
    { title: 'Para inversionistas', text: 'Ofrecer contexto suficiente para evaluar oportunidades, retornos estimados, plazos, garantías y riesgos.' },
    { title: 'Para empresas', text: 'Guiar la creación de propuestas completas y transparentes, con seguimiento posterior a la financiación.' },
    { title: 'Alcance de la demo', text: 'Esta versión es exclusivamente frontend. La información, operaciones, revisiones y transacciones son ficticias.' },
  ] },
} as const

export function InfoPage({ page }: { page: keyof typeof infoContent }) {
  const content = infoContent[page]
  return <main className="public-info app-page page-shell" id="main-content"><PageHeader eyebrow={content.eyebrow} title={content.title} description={content.description} /><div className="public-info__grid">{content.sections.map((section, index) => <SectionCard key={section.title}><span className="public-info__number">0{index + 1}</span><h2>{section.title}</h2><p>{section.text}</p></SectionCard>)}</div><div className="public-info__cta"><CheckCircle2 /><div><h2>¿Listo para continuar?</h2><p>Conoce los proyectos disponibles y revisa toda la información antes de tomar una decisión.</p></div><Button to="/opportunities">Explorar oportunidades <ArrowRight size={19} /></Button></div></main>
}

export function FaqPage() {
  const questions = [
    ['¿Qué es Seed 2 Deed?', 'Una plataforma frontend de demostración que conecta inversionistas con empresas que buscan financiamiento.'],
    ['¿El retorno mostrado está garantizado?', 'No. Se trata de un retorno estimado y toda inversión implica riesgo.'],
    ['¿Qué significa empresa verificada?', 'Que la demo muestra completada una revisión documental y empresarial dentro del flujo simulado.'],
    ['¿Cómo se usan los fondos?', 'Cada oportunidad detalla una distribución porcentual, cronograma y avances reportados.'],
    ['¿Qué es el vault?', 'Es la representación del contenedor contractual donde se registran fondos y condiciones; en esta versión es mock.'],
    ['¿Puedo invertir dinero real?', 'No. Esta aplicación no procesa pagos ni inversiones reales.'],
    ['¿Cómo presenta un proyecto una empresa?', 'Creando una cuenta de empresa y completando el wizard de propuesta.'],
    ['¿Cómo se muestran los riesgos?', 'Cada proyecto expone un nivel general y factores financieros, legales, de ejecución y mercado.'],
  ]
  return <main className="public-info app-page page-shell" id="main-content"><PageHeader eyebrow="AYUDA" title="Preguntas frecuentes" description="Respuestas claras sobre la experiencia, los riesgos y el alcance de esta demostración." /><div className="faq-list faq-list--page">{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></main>
}
