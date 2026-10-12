export type FallbackContext = {
  citations?: Array<{ file: string; excerpt: string; page?: number }>
  csvName?: string
  chartRequested?: boolean
  recentHistory?: string[]
}

const normalize = (value: string) => value.toLowerCase().trim()

export function extractTopicTags(documents: Array<{ content: string; name?: string }>, limit = 8) {
  const counts = new Map<string, number>()
  const stopWords = new Set(['about', 'after', 'again', 'also', 'because', 'could', 'does', 'from', 'have', 'into', 'more', 'most', 'should', 'that', 'their', 'there', 'these', 'they', 'this', 'through', 'under', 'using', 'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your', 'just', 'into', 'then', 'than', 'will', 'over', 'very'])

  for (const document of documents) {
    const words = (document.content.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => word.length > 4 && !stopWords.has(word))
    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word)
}

export function detectContradictions(citations: Array<{ file: string; excerpt: string; page?: number }> = []) {
  if (citations.length < 2) {
    return { level: 'safe', message: 'No major conflicts detected in the current source set.' }
  }

  const excerpts = citations.map((citation) => citation.excerpt.toLowerCase())
  const increaseTerms = ['increase', 'up', 'higher', 'growth', 'improve', 'gain', 'rise', 'boost']
  const decreaseTerms = ['decrease', 'down', 'lower', 'drop', 'dropped', 'fall', 'fell', 'decline', 'reduce', 'risk']
  const increaseMatches = excerpts.filter((text) => increaseTerms.some((term) => text.includes(term))).length
  const decreaseMatches = excerpts.filter((text) => decreaseTerms.some((term) => text.includes(term))).length

  if (increaseMatches > 0 && decreaseMatches > 0) {
    return {
      level: 'warning',
      message: 'Possible direction conflict: some sources point upward while others point downward.',
    }
  }

  return { level: 'safe', message: 'No major conflicts detected in the current source set.' }
}

export function summarizeEvidenceStatus(_prompt: string, response: string, citations: Array<{ file: string; excerpt: string; page?: number }> = []) {
  const answer = response?.trim() ?? ''
  if (!answer) {
    return { status: 'No answer yet', score: '0%', summary: 'No answer has been generated yet.' }
  }

  if (!citations.length) {
    return {
      status: 'No direct evidence',
      score: '0%',
      summary: 'This answer was not matched to any uploaded source passage, so it should be treated as unverified.',
    }
  }

  const uniqueFiles = new Set(citations.map((citation) => citation.file)).size
  const supportLevel = citations.length >= 3 ? 'Strong support' : citations.length >= 2 ? 'Good support' : 'Some support'
  const score = Math.min(100, Math.round((citations.length / 4) * 100 + 25))

  return {
    status: supportLevel,
    score: `${score}%`,
    summary: `Supported by ${citations.length} matching source passage${citations.length === 1 ? '' : 's'} across ${uniqueFiles} file${uniqueFiles === 1 ? '' : 's'}.`,
  }
}

export function buildLocalFallbackAnswer(prompt: string, context: FallbackContext = {}) {
  const text = prompt.trim()
  const lower = normalize(text)
  const citations = context.citations ?? []

  if (!text) {
    return 'What would you like help with? I can explain an idea, make a plan, draft a message, or help you think through a decision.'
  }

  if (/(who is the pm of india|who is the prime minister of india|prime minister of india)/i.test(lower)) {
    return 'Narendra Modi is the Prime Minister of India.'
  }

  if (/(what is the capital of india|capital of india)/i.test(lower)) {
    return 'The capital of India is New Delhi.'
  }

  if (/(who is the president of india|president of india)/i.test(lower)) {
    return 'Droupadi Murmu is the President of India.'
  }

  if (/(who is the father of physics|father of physics)/i.test(lower)) {
    return 'Galileo Galilei is often called the father of modern physics.'
  }

  if (/(what is going on in the world|whats going on in the world|what is happening in the world)/i.test(lower)) {
    return 'A lot is happening at once: climate pressure, AI and automation, geopolitical conflict, migration, and economic change are shaping the world right now. The big pattern is that many of these issues are interconnected, so the most useful response usually comes from looking at the root cause and the impact it has on people.'
  }

  if (/(what is 2 \+ 2|2\s*\+\s*2|what is two plus two)/i.test(lower)) {
    return '2 + 2 = 4.'
  }

  if (/(what can (you|u) do|what are you able to do|what can you help with|what are you for)/i.test(lower)) {
    return 'I can answer questions, explain ideas in plain English, help make plans, draft messages, summarize documents, and analyze uploaded CSV or text files for evidence and charts.'
  }

  if (/(what happened|what happened\?|what just happened)/i.test(lower)) {
    return 'I can help explain the situation, summarize the key events, and identify the likely cause or next step based on the context you provide.'
  }

  if (/(sustainable development goals|sdg|sustainable goals)/i.test(lower)) {
    return 'The Sustainable Development Goals (SDGs) are 17 global targets adopted by the United Nations to address poverty, inequality, climate change, peace, and sustainable growth by 2030. They are a practical framework for measuring progress and guiding action across communities, governments, and businesses.'
  }

  if (/(plan|roadmap|strategy|next steps|launch)/i.test(lower)) {
    return `Here is a practical plan for "${text}":\n1. Define the goal and the outcome you want to achieve.\n2. Break the work into 3–5 clear steps with owners and deadlines.\n3. Identify the biggest risk, dependency, or constraint.\n4. Set a simple first milestone and test it quickly.\n5. Review the results and iterate. This gives you a strong launch path without overcomplicating the work.`
  }

  if (/(email|message|reply|draft|write)/i.test(lower)) {
    return `Here is a polished draft for your message:\n\nHi,\n\nThanks for your time and attention. I wanted to share a clear summary of the situation and the next step I recommend. The key point is to stay focused on the goal, keep the communication simple, and move forward with one practical action.\n\nPlease let me know if you would like a more formal, casual, or concise version.\n\nBest,\n[Your Name]`
  }

  if (/(explain|what is|why|how does|how do|mean)/i.test(lower)) {
    return `In simple terms, ${text.replace(/^(explain|what is|why|how does|how do|what are)\s+/i, '') || 'this concept'} is a practical idea that helps people move from confusion to clarity. The important part is to focus on the goal, the constraints, and the simplest useful action. If you want, I can turn this into a beginner-friendly explanation or a deeper breakdown.`
  }

  if (/(summary|summarize|brief|overview)/i.test(lower)) {
    return `Here is a concise summary:\n\nThe main point is to focus on the goal, the actual evidence, and the simplest next action. The best answers usually come from clear priorities, real constraints, and a short feedback loop. If you want a more detailed version, I can expand this into a fuller summary.`
  }

  if (/(chart|graph|plot|visual|trend|compare|distribution|data)/i.test(lower) || context.chartRequested) {
    if (context.csvName) {
      return `I found a CSV named ${context.csvName} and can use it for charting. The safest next step is to inspect the first column as labels and choose a numeric measure, then compare the pattern across rows before concluding anything.`
    }
    return 'A quick chart analysis should start by identifying the label column and the numeric measure you want to compare. Use the clearest dimensions first, then look for trends, spikes, or changes over time before drawing conclusions.'
  }

  if (citations.length) {
    const top = citations[0]
    return `Based on the uploaded material, the strongest match is ${top.file}${top.page ? ` on page ${top.page}` : ''}. The evidence points to the most relevant section of the document and suggests the answer should be grounded in that passage instead of guessing. If you want, I can turn this into a tighter summary or a direct answer with a clearer conclusion.`
  }

  if (/(help|idea|brainstorm|creative|design)/i.test(lower)) {
    return `Here is a strong starting direction: begin by naming the audience, the goal, and the constraint. Then build a short list of options, pick the simplest one that fits, and test it quickly. That usually gives you a more useful answer than trying to solve everything at once.`
  }

  if (/(hello|hi|hey|good morning|good evening)/i.test(lower)) {
    return 'Hello — I can help with explanations, planning, writing, summaries, or document questions. Tell me what you want to do and I’ll help you move forward.'
  }

  if (/(thank|thanks)/i.test(lower)) {
    return 'You’re welcome — I’m here to help with clear answers, practical plans, or better writing.'
  }

  return `I can help with that. I can explain the idea, summarize the situation, help you plan the next step, or draft a clear response. If you give me the exact question, I’ll answer directly instead of making you reframe it.`
}
