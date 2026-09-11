import { useState } from 'react'
import type { Business } from '../../../entities/business/model/business.types'
import { appAssets } from '../../../assets/assets'
import './BusinessImage.css'

interface BusinessImageProps {
  business: Business
  size?: 'card' | 'detail'
}

export function BusinessImage({ business, size = 'card' }: BusinessImageProps) {
  const [hasError, setHasError] = useState(false)

  return (
    <div className={`business-image business-image--${business.imageType} business-image--${size}`}>
      <img
        src={hasError ? appAssets.businesses.fallback : business.image}
        alt={`${business.name} — ${business.imageType === 'photo' ? 'imagen del negocio' : 'identidad visual'}`}
        onError={() => setHasError(true)}
      />
    </div>
  )
}
