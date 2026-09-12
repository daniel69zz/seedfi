import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Eye, EyeOff, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getRoleHome, useAuth } from '../../../features/auth/model/AuthContext'
import { useToast } from '../../../features/toast/model/ToastContext'
import { brand } from '../../../shared/config/brand'
import type { UserRole } from '../../../shared/types/platform.types'
import { Button } from '../../../shared/ui/button/Button'
import './AuthPages.css'

const demos: Array<{ role: UserRole; label: string; email: string }> = [
  { role: 'INVESTOR', label: 'Inversionista', email: 'investor@demo.com' },
  { role: 'COMPANY', label: 'Empresa', email: 'company@demo.com' },
  { role: 'ADMIN', label: 'Administrador', email: 'admin@demo.com' },
]

function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="auth-page" id="main-content">
      <section className="auth-panel">
        <Link className="auth-panel__back" to="/"><ArrowLeft size={18} /> Volver al inicio</Link>
        <Link className="auth-brand" to="/"><img src={brand.logo} alt="" /><strong>{brand.name}</strong></Link>
        <p className="auth-panel__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="auth-panel__description">{description}</p>
        {children}
      </section>
      <aside className="auth-aside" aria-label="Información de la demostración">
        <div><ShieldCheck size={34} /><p>DEMO FRONTEND</p><h2>Explora cada rol de la plataforma.</h2><span>La sesión, inversiones y propuestas se simulan localmente. No se procesan fondos ni documentos reales.</span></div>
      </aside>
    </main>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('investor@demo.com')
  const [password, setPassword] = useState('demo123')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const user = login(email)
    if (!user) {
      setError('Usa una de las cuentas demo indicadas abajo.')
      return
    }
    notify(`Sesión iniciada como ${user.name}`)
    const next = searchParams.get('next')
    navigate(next || getRoleHome(user.role), { replace: true })
  }

  return (
    <AuthShell eyebrow="BIENVENIDO DE NUEVO" title="Inicia sesión" description="Accede a tu espacio de inversionista, empresa o administración.">
      <form className="auth-form" onSubmit={submit}>
        <label className="field"><span>Correo electrónico</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
        <label className="field"><span>Contraseña</span><span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /><button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((current) => !current)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
        <div className="auth-form__meta"><label className="check-row"><input type="checkbox" defaultChecked /> Recordar sesión</label><Link to="/auth/forgot-password">¿Olvidaste tu contraseña?</Link></div>
        {error && <p className="auth-form__error" role="alert">{error}</p>}
        <Button type="submit">Ingresar <ArrowRight size={19} /></Button>
      </form>
      <div className="demo-accounts"><p>Accesos de demostración · contraseña: <strong>demo123</strong></p>{demos.map((demo) => <button key={demo.role} type="button" onClick={() => { setEmail(demo.email); setPassword('demo123'); setError('') }}><span>{demo.label}</span><strong>{demo.email}</strong></button>)}</div>
      <p className="auth-switch">¿Aún no tienes una cuenta? <Link to="/auth/register">Crear cuenta</Link></p>
    </AuthShell>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialRole = searchParams.get('role') === 'company' ? 'COMPANY' : 'INVESTOR'
  const [role, setRole] = useState<'INVESTOR' | 'COMPANY'>(initialRole)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [accepted, setAccepted] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!accepted) return
    register({ name, email, role, companyName: role === 'COMPANY' ? companyName : undefined })
    navigate(role === 'INVESTOR' ? '/investor/kyc' : '/company/dashboard')
  }

  return (
    <AuthShell eyebrow="CREA TU CUENTA" title="¿Cómo quieres participar?" description="Selecciona el perfil que mejor representa lo que quieres hacer.">
      <div className="role-choice" role="radiogroup" aria-label="Tipo de cuenta">
        <button type="button" role="radio" aria-checked={role === 'INVESTOR'} className={role === 'INVESTOR' ? 'role-choice__item role-choice__item--active' : 'role-choice__item'} onClick={() => setRole('INVESTOR')}><UserRound /><span><strong>Quiero invertir</strong><small>Explorar y seguir oportunidades.</small></span></button>
        <button type="button" role="radio" aria-checked={role === 'COMPANY'} className={role === 'COMPANY' ? 'role-choice__item role-choice__item--active' : 'role-choice__item'} onClick={() => setRole('COMPANY')}><Building2 /><span><strong>Busco financiamiento</strong><small>Presentar proyectos empresariales.</small></span></button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <div className="form-grid"><label className="field"><span>Nombre</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="field"><span>Apellido</span><input required /></label></div>
        {role === 'COMPANY' && <label className="field"><span>Nombre de la empresa</span><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} required /></label>}
        <label className="field"><span>Correo electrónico</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label className="field"><span>Contraseña</span><input type="password" minLength={6} required /></label>
        <label className="check-row"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /> Entiendo que esta es una demostración frontend con operaciones simuladas.</label>
        <Button type="submit" disabled={!accepted}>Continuar <ArrowRight size={19} /></Button>
      </form>
      <p className="auth-switch">¿Ya tienes una cuenta? <Link to="/auth/login">Iniciar sesión</Link></p>
    </AuthShell>
  )
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  return <AuthShell eyebrow="RECUPERAR ACCESO" title={sent ? 'Revisa tu correo' : 'Recupera tu contraseña'} description={sent ? 'En una integración real recibirías un enlace seguro para continuar.' : 'Ingresa el correo asociado a tu cuenta.'}>{sent ? <div className="auth-success"><CheckCircle2 /><p>La instrucción mock fue enviada correctamente.</p><Button to="/auth/login">Volver al login</Button></div> : <form className="auth-form" onSubmit={(event) => { event.preventDefault(); setSent(true) }}><label className="field"><span>Correo electrónico</span><input type="email" required /></label><Button type="submit"><Mail size={18} /> Enviar instrucciones</Button></form>}</AuthShell>
}

export function VerifyEmailPage() {
  const [verified, setVerified] = useState(false)
  return <AuthShell eyebrow="VERIFICACIÓN" title={verified ? 'Correo verificado' : 'Verifica tu correo'} description="Este paso está simulado para completar la experiencia de registro."><div className="auth-success">{verified ? <CheckCircle2 /> : <Mail />}<p>{verified ? 'Tu dirección fue confirmada en esta sesión demo.' : 'Presiona el botón para simular la confirmación del correo electrónico.'}</p>{verified ? <Button to="/auth/login">Ir al login</Button> : <Button onClick={() => setVerified(true)}>Verificar correo</Button>}</div></AuthShell>
}
