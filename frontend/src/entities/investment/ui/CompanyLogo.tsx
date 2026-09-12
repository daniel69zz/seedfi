import { useId, useRef } from 'react'
import './CompanyLogo.css'

type CompanyLogoProps = {
  company: { id: string; name: string; logo?: string }
}

export function CompanyLogo({ company }: CompanyLogoProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  return (
    <>
      <button
        type="button"
        className="company-logo"
        aria-label={`Ver empresa: ${company.name}`}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        {company.logo ? <img src={company.logo} alt={company.name} /> : <span>{company.name}</span>}
      </button>
      <dialog ref={dialog} className="company-preview" aria-labelledby={titleId} onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close()
      }}>
        <div className="company-preview__content">
          <form method="dialog"><button type="submit" className="company-preview__close" aria-label="Cerrar información de la empresa">×</button></form>
          {company.logo && <img src={company.logo} alt="" className="company-preview__logo" />}
          <p className="company-preview__eyebrow">Empresa del proyecto</p>
          <h2 id={titleId}>{company.name}</h2>
        </div>
      </dialog>
    </>
  )
}
