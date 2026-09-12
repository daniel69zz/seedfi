import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
  UserRound,
  Wallet,
} from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getRoleHome, useAuth } from '../../../features/auth/model/AuthContext'
import { brand } from '../../../shared/config/brand'
import { Button } from '../../../shared/ui/button/Button'
import './RegisterPage.css'

type AccountType = 'INVESTOR' | 'COMPANY'
type RegistrationStep = 1 | 2 | 3
type SubmissionState = 'idle' | 'loading' | 'success'

interface RegistrationData {
  displayName: string
  email: string
  password: string
  confirmPassword: string
  country: string
  documentType: string
  documentNumber: string
  companyName: string
  taxId: string
}

const initialData: RegistrationData = {
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
  country: 'Bolivia',
  documentType: 'Cédula de identidad',
  documentNumber: '',
  companyName: '',
  taxId: '',
}

const steps = ['Tipo de cuenta', 'Datos', 'Verificación'] as const
const countries = ['Bolivia', 'Argentina', 'Brasil', 'Chile', 'Perú', 'Otro'] as const
const documentTypes = ['Cédula de identidad', 'Pasaporte', 'DNI'] as const

function roleFromQuery(value: string | null): AccountType | null {
  if (value === 'company') return 'COMPANY'
  if (value === 'investor') return 'INVESTOR'
  return null
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState<RegistrationStep>(1)
  const [role, setRole] = useState<AccountType | null>(() => roleFromQuery(searchParams.get('role')))
  const [data, setData] = useState<RegistrationData>(initialData)
  const [accepted, setAccepted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submission, setSubmission] = useState<SubmissionState>('idle')

  const accountLabel = role === 'COMPANY' ? 'Empresa' : 'Inversionista'
  const verificationLabel = role === 'COMPANY' ? 'Verificación de empresa' : 'Verificación de identidad'
  const verificationCode = role === 'COMPANY' ? 'KYB' : 'KYC'

  function update<K extends keyof RegistrationData>(field: K, value: RegistrationData[K]) {
    setData((current) => ({ ...current, [field]: value }))
    if (error) setError('')
  }

  function selectRole(nextRole: AccountType) {
    setRole(nextRole)
    setError('')
  }

  function validateData(): string | null {
    if (!data.displayName.trim() || !data.email.trim()) return 'Completa tu nombre y correo electrónico.'
    if (data.password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
    if (data.password !== data.confirmPassword) return 'Las contraseñas no coinciden.'
    if (!data.country) return 'Selecciona tu país.'
    if (role === 'INVESTOR' && (!data.documentType || !data.documentNumber.trim())) {
      return 'Completa el tipo y número de documento.'
    }
    if (role === 'COMPANY' && (!data.companyName.trim() || !data.taxId.trim())) {
      return 'Completa el nombre de la empresa y su identificación fiscal.'
    }
    return null
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (step === 1) {
      if (!role) {
        setError('Selecciona cómo quieres utilizar SeedFi.')
        return
      }
      setStep(2)
      setError('')
      return
    }

    if (step === 2) {
      const validationError = validateData()
      if (validationError) {
        setError(validationError)
        return
      }
      setStep(3)
      setError('')
      return
    }

    if (!role || !accepted) return

    setSubmission('loading')
    await new Promise((resolve) => window.setTimeout(resolve, 650))
    register({
      name: data.displayName.trim(),
      email: data.email.trim(),
      role,
      companyName: role === 'COMPANY' ? data.companyName.trim() : undefined,
    })
    setSubmission('success')
    await new Promise((resolve) => window.setTimeout(resolve, 900))
    navigate(getRoleHome(role), { replace: true })
  }

  function goBack() {
    setError('')
    if (step === 3) setStep(2)
    else if (step === 2) setStep(1)
  }

  if (submission === 'success') {
    return (
      <main className="register-page" id="main-content">
        <section className="register-card register-card--success" aria-live="polite">
          <Link className="register-brand" to="/" aria-label={`${brand.name} — inicio`}>
            <img src={brand.logo} alt="" />
            <strong>{brand.name}</strong>
          </Link>
          <span className="register-success__icon"><CheckCircle2 /></span>
          <h1>Cuenta creada</h1>
          <p>Tu espacio de {accountLabel.toLowerCase()} está listo. Te estamos redirigiendo.</p>
          <div className="register-success__status"><LoaderCircle className="register-spin" /> Preparando tu cuenta</div>
        </section>
      </main>
    )
  }

  return (
    <main className="register-page" id="main-content">
      <section className="register-card" aria-labelledby="register-title">
        {step === 1
          ? <Link className="register-back" to="/"><ArrowLeft /> Volver al inicio</Link>
          : <button className="register-back" type="button" onClick={goBack}><ArrowLeft /> Volver</button>}

        <Link className="register-brand" to="/" aria-label={`${brand.name} — inicio`}>
          <img src={brand.logo} alt="" />
          <strong>{brand.name}</strong>
        </Link>

        <header className="register-heading">
          <h1 id="register-title">Crear cuenta</h1>
          <p>{step === 1 ? 'Elige cómo quieres utilizar SeedFi.' : `${accountLabel} · completa solo los datos necesarios.`}</p>
        </header>

        <ol className="register-progress" aria-label="Progreso del registro">
          {steps.map((label, index) => {
            const itemStep = (index + 1) as RegistrationStep
            const isComplete = step > itemStep
            return (
              <li key={label} className={step === itemStep ? 'is-current' : isComplete ? 'is-complete' : ''} aria-current={step === itemStep ? 'step' : undefined}>
                <span>{isComplete ? <Check /> : itemStep}</span>
                <small>{label}</small>
              </li>
            )
          })}
        </ol>

        <form className="registration-form" onSubmit={submit} noValidate={step !== 2}>
          {step === 1 && (
            <div className="account-choice" role="radiogroup" aria-label="Tipo de cuenta">
              <button type="button" role="radio" aria-checked={role === 'INVESTOR'} className={role === 'INVESTOR' ? 'account-choice__card is-selected' : 'account-choice__card'} onClick={() => selectRole('INVESTOR')}>
                <span className="account-choice__icon"><UserRound /></span>
                <span><strong>Inversionista</strong><small>Quiero invertir en proyectos.</small></span>
                <i aria-hidden="true">{role === 'INVESTOR' && <Check />}</i>
              </button>
              <button type="button" role="radio" aria-checked={role === 'COMPANY'} className={role === 'COMPANY' ? 'account-choice__card is-selected' : 'account-choice__card'} onClick={() => selectRole('COMPANY')}>
                <span className="account-choice__icon"><Building2 /></span>
                <span><strong>Empresa</strong><small>Quiero obtener financiamiento para proyectos.</small></span>
                <i aria-hidden="true">{role === 'COMPANY' && <Check />}</i>
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="registration-fields">
              <div className="registration-section-heading"><span>Cuenta</span><p>Información básica para crear tu acceso.</p></div>
              <label className="field field--full">
                <span>{role === 'COMPANY' ? 'Nombre del representante' : 'Nombre completo'}</span>
                <input value={data.displayName} onChange={(event) => update('displayName', event.target.value)} autoComplete="name" required autoFocus />
              </label>
              <label className="field field--full">
                <span>Correo electrónico</span>
                <input type="email" value={data.email} onChange={(event) => update('email', event.target.value)} autoComplete="email" required />
              </label>
              <label className="field">
                <span>Contraseña</span>
                <span className="password-field">
                  <input type={showPassword ? 'text' : 'password'} value={data.password} onChange={(event) => update('password', event.target.value)} minLength={8} autoComplete="new-password" required />
                  <button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((current) => !current)}>{showPassword ? <EyeOff /> : <Eye />}</button>
                </span>
              </label>
              <label className="field">
                <span>Confirmar contraseña</span>
                <input type={showPassword ? 'text' : 'password'} value={data.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} minLength={8} autoComplete="new-password" required />
              </label>

              <div className="registration-section-heading field--full"><span>{role === 'COMPANY' ? 'Empresa' : 'Identidad'}</span><p>{role === 'COMPANY' ? 'Datos mínimos para iniciar el KYB.' : 'Datos mínimos para iniciar el KYC.'}</p></div>

              {role === 'COMPANY' ? (
                <>
                  <label className="field field--full"><span>Nombre de la empresa</span><input value={data.companyName} onChange={(event) => update('companyName', event.target.value)} autoComplete="organization" required /></label>
                  <label className="field"><span>NIT / identificación fiscal</span><input value={data.taxId} onChange={(event) => update('taxId', event.target.value)} required /></label>
                  <CountryField value={data.country} onChange={(value) => update('country', value)} />
                </>
              ) : (
                <>
                  <CountryField value={data.country} onChange={(value) => update('country', value)} />
                  <label className="field"><span>Tipo de documento</span><select value={data.documentType} onChange={(event) => update('documentType', event.target.value)} required>{documentTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
                  <label className="field field--full"><span>N.º de documento</span><input value={data.documentNumber} onChange={(event) => update('documentNumber', event.target.value)} required /></label>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="registration-review">
              <div className="registration-summary">
                <span className="account-choice__icon">{role === 'COMPANY' ? <Building2 /> : <UserRound />}</span>
                <div><small>CUENTA {accountLabel.toUpperCase()}</small><strong>{data.displayName}</strong><p>{data.email}</p></div>
              </div>

              <div className="verification-card">
                <span><ShieldCheck /></span>
                <div><strong>{verificationLabel}</strong><p>Podrás completar el proceso después de crear tu cuenta.</p></div>
                <b>{verificationCode}: Pendiente</b>
              </div>

              <div className="wallet-card">
                <span><Wallet /></span>
                <div><strong>Wallet no conectada</strong><p>La conectarás después desde tu perfil.</p></div>
                <b>Opcional</b>
              </div>

              <label className="registration-terms">
                <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required />
                <span>Acepto los Términos y la Política de Privacidad.</span>
              </label>
            </div>
          )}

          {error && <p className="registration-error" role="alert">{error}</p>}

          <div className="registration-actions">
            {step > 1 && <Button type="button" variant="ghost" onClick={goBack} disabled={submission === 'loading'}><ArrowLeft /> Atrás</Button>}
            <Button type="submit" disabled={(step === 1 && !role) || (step === 3 && (!accepted || submission === 'loading'))}>
              {submission === 'loading' ? <><LoaderCircle className="register-spin" /> Creando cuenta...</> : step === 3 ? <>Crear cuenta <ArrowRight /></> : <>Continuar <ArrowRight /></>}
            </Button>
          </div>
        </form>

        <p className="register-login">¿Ya tienes una cuenta? <Link to="/auth/login">Iniciar sesión</Link></p>
      </section>
    </main>
  )
}

function CountryField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>País</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} required>{countries.map((country) => <option key={country}>{country}</option>)}</select>
    </label>
  )
}
