export interface SefariaTextVersion {
  versionTitle: string
  language: string
  text: string | string[] | string[][]
  direction?: string
}

export interface SefariaTextResponse {
  ref: string
  heRef: string
  versions: SefariaTextVersion[]
  available_versions: { versionTitle: string; language: string }[]
  sections: (string | number)[]
  toSections: (string | number)[]
  categories: string[]
  textDepth: number
  sectionNames: string[]
  next?: string
  prev?: string
}

export interface SefariaSearchHit {
  _score: number
  _source: {
    ref: string
    heRef: string
    exact: string
    naive_lemmatizer: string
    path: string
    categories: string[]
    comp_date?: number
    pagesheetrank?: number
    index_title: string
    he_index_title: string
    version?: string
  }
  highlight?: {
    exact?: string[]
    naive_lemmatizer?: string[]
  }
}

export interface SefariaSearchResponse {
  hits: {
    total: { value: number }
    hits: SefariaSearchHit[]
  }
  aggregations?: Record<string, unknown>
}

export interface SefariaLink {
  ref: string
  heRef: string
  anchorRef: string
  anchorRefExpanded: string[]
  type: string
  category: string
  collectiveTitle?: { en: string; he: string }
  sourceRef: string
  sourceHeRef: string
  text?: string | string[]
  he?: string | string[]
  compDate?: number
}

export interface SefariaTopic {
  slug: string
  titles: { text: string; lang: string; primary?: boolean }[]
  description?: { en?: string; he?: string }
  numSources?: number
  displayOrder?: number
  refs?: { ref: string; order?: { tfidf?: number; pr?: number } }[]
  links?: SefariaTopicLink[]
}

export interface SefariaTopicLink {
  topic: string
  linkType: string
  class: string
  order?: { tfidf?: number }
  title?: { en: string; he: string }
}

export interface SefariaRelatedResponse {
  links: SefariaLink[]
  topics: { slug: string; title: { en: string; he: string }; order?: Record<string, number> }[]
  sheets?: unknown[]
}

export interface SefariaNameMatch {
  completions: string[]
  completion_objects: {
    title: string
    key: string
    type: string
    is_primary?: boolean
  }[]
}

export interface SefariaCalendarItem {
  title: { en: string; he: string }
  displayValue: { en: string; he: string }
  url: string
  ref: string
  category: string
  order: number
}

export interface RetrievedSource {
  ref: string
  heRef: string
  text_en: string
  text_he: string
  category: string
  categories: string[]
  score: number
  source_type: 'direct' | 'search' | 'topic' | 'link' | 'calendar'
  link_type?: string
  topic_slug?: string
}
