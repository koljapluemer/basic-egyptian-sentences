export interface IndexCardRow {
  type: 'text' | 'divider'
  text?: string
  size?: 'small' | 'auto'
  rtl?: boolean
  highlight?: boolean
}

export interface Sentence {
  arz: string
  transliteration: string
  translations: string[]
}
