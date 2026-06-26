export const CATEGORIES = [
  { name: 'Tanakh', slug: 'tanakh', description: 'Torah, Prophets, and Writings — the Hebrew Bible and its teachings.' },
  { name: 'Talmud', slug: 'talmud', description: 'The Babylonian and Jerusalem Talmud — Oral Torah discussions and rulings.' },
  { name: 'Mishnah', slug: 'mishnah', description: 'The foundational code of Jewish oral law compiled by Rabbi Yehudah HaNasi.' },
  { name: 'Midrash', slug: 'midrash', description: 'Rabbinic homiletical and interpretive literature on the Torah and Tanakh.' },
  { name: 'Halakhah', slug: 'halakhah', description: 'Jewish law — codes, responsa, and practical rulings for daily life.' },
  { name: 'Liturgy', slug: 'liturgy', description: 'Jewish prayer, blessings, and the structure of the siddur.' },
  { name: 'Kabbalah', slug: 'kabbalah', description: 'Jewish mystical tradition — Zohar, sefirot, and esoteric teachings.' },
  { name: 'Chasidut', slug: 'chasidut', description: 'Chasidic philosophy — Tanya, Likutey Moharan, and the masters\' teachings.' },
  { name: 'Jewish Thought', slug: 'jewish-thought', description: 'Jewish philosophy, theology, and intellectual tradition.' },
  { name: 'Musar', slug: 'musar', description: 'Ethics and character development in the Jewish tradition.' },
  { name: 'Tosefta', slug: 'tosefta', description: 'Supplementary teachings to the Mishnah from the Tannaitic period.' },
  { name: 'Tanakh Commentary', slug: 'tanakh-commentary', description: 'Classical and modern commentaries on the Hebrew Bible.' },
  { name: 'Talmud Commentary', slug: 'talmud-commentary', description: 'Commentaries on the Talmud — Rashi, Tosafot, and later authorities.' },
  { name: 'Mishnah Commentary', slug: 'mishnah-commentary', description: 'Commentaries on the Mishnah — Rambam, Bartenura, and others.' },
  { name: 'Targum', slug: 'targum', description: 'Aramaic translations and paraphrases of the Hebrew Bible.' },
  { name: 'Reference', slug: 'reference', description: 'Encyclopedias, dictionaries, and reference works on Jewish topics.' },
  { name: 'Second Temple', slug: 'second-temple', description: 'Literature and history from the Second Temple period.' },
] as const

export type CategoryName = (typeof CATEGORIES)[number]['name']

export function getCategoryBySlug(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug) ?? null
}

export function getCategoryByName(name: string) {
  return CATEGORIES.find((c) => c.name === name) ?? null
}

export function categoryNameToSlug(name: string): string {
  return CATEGORIES.find((c) => c.name === name)?.slug ?? name.toLowerCase().replace(/\s+/g, '-')
}

export function categorySlugToName(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? slug
}
