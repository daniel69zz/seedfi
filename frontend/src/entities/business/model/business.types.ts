export type BusinessImageType = 'logo' | 'photo' | 'icon'

export interface Business {
  id: string
  name: string
  image: string
  imageType: BusinessImageType
}
