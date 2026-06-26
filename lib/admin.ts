import { auth } from './auth'

export async function isAdmin(): Promise<{ authorized: boolean; email?: string }> {
  const session = await auth()
  if (!session?.user?.email) return { authorized: false }

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return { authorized: false }

  return {
    authorized: session.user.email === adminEmail,
    email: session.user.email,
  }
}

export interface AiScoreBreakdown {
  answerLength: number
  sourceCount: number
  specificity: number
  uniqueness: number
  categoryCoverage: number
}

export function computeAiScore(
  answerMarkdown: string,
  sourceRefs: string[],
  question: string,
  categories: string[] | null,
  existingPublishedCount: number,
  categoryPublishedCounts: Record<string, number>,
): { score: number; reasons: AiScoreBreakdown } {
  const len = answerMarkdown.length
  const answerLength = len < 200 ? 0 : len < 500 ? 10 : len < 1000 ? 15 : 20

  const srcCount = sourceRefs.length
  const sourceCount = srcCount === 0 ? 0 : srcCount === 1 ? 10 : srcCount <= 3 ? 18 : 25

  const hasRef = /\d+[ab]|\d+:\d+/.test(question)
  const hasSpecificTopic = question.split(/\s+/).length >= 4
  const specificity = hasRef ? 20 : hasSpecificTopic ? 15 : 5

  const uniqueness = existingPublishedCount === 0 ? 20 : existingPublishedCount <= 2 ? 10 : 0

  const cats = categories ?? []
  const avgPerCategory = Object.values(categoryPublishedCounts)
  const avg = avgPerCategory.length > 0
    ? avgPerCategory.reduce((a, b) => a + b, 0) / avgPerCategory.length
    : 0
  const thisCount = cats.reduce((sum, c) => sum + (categoryPublishedCounts[c] ?? 0), 0) / Math.max(cats.length, 1)
  const categoryCoverage = thisCount < avg * 0.5 ? 15 : thisCount < avg ? 10 : 5

  const score = answerLength + sourceCount + specificity + uniqueness + categoryCoverage

  return {
    score,
    reasons: { answerLength, sourceCount, specificity, uniqueness, categoryCoverage },
  }
}
