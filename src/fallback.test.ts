import { describe, expect, it } from 'vitest'
import { buildLocalFallbackAnswer, detectContradictions, extractTopicTags, summarizeEvidenceStatus } from './fallback'

describe('buildLocalFallbackAnswer', () => {
  it('creates a practical plan for planning prompts', () => {
    const answer = buildLocalFallbackAnswer('Help me plan a launch for my app')
    expect(answer.toLowerCase()).toContain('plan')
    expect(answer.toLowerCase()).toContain('launch')
  })

  it('answers explanation prompts clearly', () => {
    const answer = buildLocalFallbackAnswer('Explain what a local AI app is')
    expect(answer.toLowerCase()).toContain('local')
    expect(answer.toLowerCase()).toContain('ai')
  })

  it('answers simple fact questions directly', () => {
    const answer = buildLocalFallbackAnswer('Who is the PM of India?')
    expect(answer.toLowerCase()).toContain('narendra')
    expect(answer.toLowerCase()).toContain('modi')
  })

  it('answers common general-knowledge questions directly', () => {
    const answer = buildLocalFallbackAnswer('Who is the father of physics?')
    expect(answer.toLowerCase()).toContain('galileo')
  })
})

describe('summarizeEvidenceStatus', () => {
  it('marks supported answers when matching files exist', () => {
    const summary = summarizeEvidenceStatus('What was the budget?', 'The budget was $120,000 according to the report.', [{ file: 'budget.pdf', excerpt: 'The budget was $120,000.' }])
    expect(summary.status).toContain('support')
    expect(summary.summary.toLowerCase()).toContain('supported')
  })

  it('flags missing evidence when no citations are found', () => {
    const summary = summarizeEvidenceStatus('What was the budget?', 'The budget was $120,000.', [])
    expect(summary.status).toContain('No direct evidence')
  })
})

describe('topic and contradiction helpers', () => {
  it('extracts important document topics', () => {
    const tags = extractTopicTags([{ content: 'Growth strategy revenue forecast investment planning' }, { content: 'Revenue growth planning and investment plans' }], 6)
    expect(tags.some((tag) => tag.includes('growth') || tag.includes('revenue'))).toBe(true)
  })

  it('detects directional disagreement across sources', () => {
    const result = detectContradictions([
      { file: 'a.txt', excerpt: 'Revenue increased sharply this quarter.' },
      { file: 'b.txt', excerpt: 'Revenue fell after the pricing change.' },
    ])
    expect(result.level).toBe('warning')
  })
})
