import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Mail, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getRoleHome, useAuth } from '../../../features/auth/model/AuthContext'
import { useToast } from '../../../features/toast/model/ToastContext'
import { brand } from '../../../shared/config/brand'
import { Button } from '../../../shared/ui/button/Button'
import './AuthPages.css'

const demos = [
  { role: 'INVESTOR', label: 'Inversionista', email: 'investor@demo.com' },
  { role: 'COMPANY', label: 'Empresa', email: 'company@demo.com' },
] as const

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
    <AuthShell eyebrow="BIENVENIDO DE NUEVO" title="Inicia sesión" description="Accede a tu espacio de inversionista o empresa.">
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

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  return <AuthShell eyebrow="RECUPERAR ACCESO" title={sent ? 'Revisa tu correo' : 'Recupera tu contraseña'} description={sent ? 'En una integración real recibirías un enlace seguro para continuar.' : 'Ingresa el correo asociado a tu cuenta.'}>{sent ? <div className="auth-success"><CheckCircle2 /><p>La instrucción mock fue enviada correctamente.</p><Button to="/auth/login">Volver al login</Button></div> : <form className="auth-form" onSubmit={(event) => { event.preventDefault(); setSent(true) }}><label className="field"><span>Correo electrónico</span><input type="email" required /></label><Button type="submit"><Mail size={18} /> Enviar instrucciones</Button></form>}</AuthShell>
}

export function VerifyEmailPage() {
  const [verified, setVerified] = useState(false)
  return <AuthShell eyebrow="VERIFICACIÓN" title={verified ? 'Correo verificado' : 'Verifica tu correo'} description="Este paso está simulado para completar la experiencia de registro."><div className="auth-success">{verified ? <CheckCircle2 /> : <Mail />}<p>{verified ? 'Tu dirección fue confirmada en esta sesión demo.' : 'Presiona el botón para simular la confirmación del correo electrónico.'}</p>{verified ? <Button to="/auth/login">Ir al login</Button> : <Button onClick={() => setVerified(true)}>Verificar correo</Button>}</div></AuthShell>
}
