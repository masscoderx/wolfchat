import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FileText, FileSpreadsheet, Upload, Send, Sparkles, ChartNoAxesCombined, Trash2, LoaderCircle, Plus, PanelLeftClose, Menu, Settings, X } from 'lucide-react'
import Papa from 'papaparse'
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { buildLocalFallbackAnswer, detectContradictions, extractTopicTags, summarizeEvidenceStatus } from './fallback'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type ChartRow = Record<string, string | number>
type SourceDocument = {
  id: string
  name: string
  kind: 'pdf' | 'text' | 'csv'
  content: string
  pages?: string[]
  rows?: ChartRow[]
  columns?: string[]
  numericColumns?: string[]
}
type Citation = { file: string; excerpt: string; page?: number }
type Message = { id: string; role: 'user' | 'assistant'; content: string; citations?: Citation[]; chart?: boolean }
type ChartMode = 'bar' | 'line'

const stopWords = new Set(['about', 'after', 'again', 'also', 'because', 'could', 'does', 'from', 'have', 'into', 'more', 'most', 'should', 'that', 'their', 'there', 'these', 'they', 'this', 'through', 'under', 'using', 'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your'])
const terms = (value: string) => value.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length > 2 && !stopWords.has(word)) ?? []
const sdgGoals = [
  { id: 1, label: 'No poverty', color: '#e85b4a', description: 'End poverty in all its forms everywhere and improve resilience for vulnerable communities.', progress: 68, actions: ['Expand cash support programs', 'Improve access to jobs and housing', 'Protect women and children from poverty shocks'] },
  { id: 2, label: 'Zero hunger', color: '#f1b622', description: 'End hunger, ensure food security, and promote sustainable agriculture for all.', progress: 72, actions: ['Support small farmers', 'Reduce food waste', 'Improve local food access'] },
  { id: 3, label: 'Good health', color: '#2db36b', description: 'Ensure healthy lives and promote well-being across the full life cycle.', progress: 81, actions: ['Improve primary care access', 'Expand preventive services', 'Strengthen health data systems'] },
  { id: 4, label: 'Quality education', color: '#c13d68', description: 'Ensure inclusive, equitable, and quality education for everyone.', progress: 76, actions: ['Improve teacher quality', 'Expand digital learning access', 'Reduce school dropout risk'] },
  { id: 5, label: 'Gender equality', color: '#ef7a2d', description: 'Achieve gender equality and empower women and girls in every sphere.', progress: 64, actions: ['Support girls’ education', 'Expand safety protections', 'Promote equal economic opportunities'] },
  { id: 6, label: 'Clean water', color: '#1c85c7', description: 'Guarantee sustainable water and sanitation for all communities.', progress: 70, actions: ['Upgrade infrastructure', 'Protect watersheds', 'Improve sanitation access'] },
  { id: 7, label: 'Affordable energy', color: '#f3a13d', description: 'Ensure affordable, reliable, sustainable, and modern energy access.', progress: 75, actions: ['Expand renewable power', 'Improve grid reliability', 'Lower energy costs for households'] },
  { id: 8, label: 'Decent work', color: '#e44a4c', description: 'Promote productive employment, decent work, and economic growth.', progress: 61, actions: ['Train job seekers', 'Support SMEs', 'Improve worker protection'] },
  { id: 9, label: 'Industry, innovation', color: '#9f56c2', description: 'Build resilient infrastructure and foster innovation and sustainable industrialization.', progress: 67, actions: ['Strengthen infrastructure', 'Back green technology', 'Support local R&D'] },
  { id: 10, label: 'Reduced inequalities', color: '#d95e48', description: 'Reduce inequality within and among countries through inclusive policy design.', progress: 58, actions: ['Target underserved regions', 'Expand social protection', 'Reduce exclusion in public services'] },
  { id: 11, label: 'Sustainable cities', color: '#f5ad4a', description: 'Make cities inclusive, safe, resilient, and sustainable for all residents.', progress: 73, actions: ['Improve public transit', 'Reduce urban waste', 'Expand affordable housing'] },
  { id: 12, label: 'Responsible consumption', color: '#5eb7a4', description: 'Ensure sustainable consumption and production patterns.', progress: 69, actions: ['Reduce waste', 'Promote circular systems', 'Encourage responsible sourcing'] },
  { id: 13, label: 'Climate action', color: '#2e8b74', description: 'Take urgent action to combat climate change and its impacts.', progress: 59, actions: ['Cut emissions', 'Expand climate adaptation', 'Protect natural ecosystems'] },
  { id: 14, label: 'Life below water', color: '#1b7cb9', description: 'Protect ocean ecosystems and prevent marine pollution and overfishing.', progress: 53, actions: ['Protect coastal habitats', 'Reduce plastic leakage', 'Support sustainable fisheries'] },
  { id: 15, label: 'Life on land', color: '#4aac4c', description: 'Protect terrestrial ecosystems and restore degraded land and biodiversity.', progress: 66, actions: ['Restore forests', 'Reduce land degradation', 'Protect biodiversity'] },
  { id: 16, label: 'Peace, justice', color: '#3f7cc2', description: 'Promote peaceful societies, access to justice, and strong institutions.', progress: 71, actions: ['Strengthen local institutions', 'Expand legal access', 'Reduce violence and corruption'] },
  { id: 17, label: 'Partnerships', color: '#d5d9d0', description: 'Strengthen the means of implementation and global partnerships for sustainable development.', progress: 77, actions: ['Align public-private action', 'Share technology and data', 'Coordinate financing and policy'] },
]
const readPreference = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function WolfGlyph() {
  const hostRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let frame = 0
    let renderer: import('three').WebGLRenderer | undefined
    let observer: ResizeObserver | undefined
    const geometries: import('three').BufferGeometry[] = []
    const materials: import('three').Material[] = []

    void import('three').then((THREE) => {
      if (disposed) return
      try {
        const width = host.clientWidth || 24
        const height = host.clientHeight || 22
        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(29, width / height, 0.1, 20)
        camera.position.z = 4.2
        scene.add(new THREE.HemisphereLight(0xe6fff3, 0x26362f, 2.2))
        const keyLight = new THREE.DirectionalLight(0xffffff, 3)
        keyLight.position.set(-2, 3, 4)
        scene.add(keyLight)
        const rimLight = new THREE.PointLight(0xe38a67, 8, 8)
        rimLight.position.set(2, -1, 2)
        scene.add(rimLight)

        const wolf = new THREE.Group()
        scene.add(wolf)
        const silhouette = new THREE.Shape()
        silhouette.moveTo(-0.62, 0.78)
        silhouette.lineTo(-0.18, 0.55)
        silhouette.lineTo(0, 0.63)
        silhouette.lineTo(0.18, 0.55)
        silhouette.lineTo(0.62, 0.78)
        silhouette.lineTo(0.53, 0.05)
        silhouette.lineTo(0.42, -0.37)
        silhouette.lineTo(0, -0.79)
        silhouette.lineTo(-0.42, -0.37)
        silhouette.lineTo(-0.53, 0.05)
        silhouette.closePath()
        const headGeometry = new THREE.ExtrudeGeometry(silhouette, { depth: 0.18, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.035, bevelThickness: 0.035 })
        headGeometry.center()
        geometries.push(headGeometry)
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0x527c69, metalness: 0.56, roughness: 0.28 })
        materials.push(headMaterial)
        wolf.add(new THREE.Mesh(headGeometry, headMaterial))

        const muzzleShape = new THREE.Shape()
        muzzleShape.moveTo(-0.2, -0.08)
        muzzleShape.lineTo(0.2, -0.08)
        muzzleShape.lineTo(0, -0.5)
        muzzleShape.closePath()
        const muzzleGeometry = new THREE.ExtrudeGeometry(muzzleShape, { depth: 0.035, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.018, bevelThickness: 0.02 })
        muzzleGeometry.translate(0, 0, 0.115)
        geometries.push(muzzleGeometry)
        const muzzleMaterial = new THREE.MeshStandardMaterial({ color: 0xb9cfbd, metalness: 0.36, roughness: 0.34 })
        materials.push(muzzleMaterial)
        wolf.add(new THREE.Mesh(muzzleGeometry, muzzleMaterial))

        const eyeGeometry = new THREE.SphereGeometry(0.055, 12, 8)
        const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xf4b187, emissive: 0xd96943, emissiveIntensity: 0.8, roughness: 0.24 })
        geometries.push(eyeGeometry)
        materials.push(eyeMaterial)
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(eyeGeometry, eyeMaterial)
          eye.position.set(side * 0.255, 0.12, 0.15)
          wolf.add(eye)
        }

        const noseGeometry = new THREE.OctahedronGeometry(0.07, 0)
        noseGeometry.scale(1, 0.7, 0.75)
        noseGeometry.translate(0, -0.25, 0.18)
        geometries.push(noseGeometry)
        const noseMaterial = new THREE.MeshStandardMaterial({ color: 0x263c32, metalness: 0.48, roughness: 0.24 })
        materials.push(noseMaterial)
        wolf.add(new THREE.Mesh(noseGeometry, noseMaterial))

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.setSize(width, height, false)
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.domElement.className = 'wolf-canvas'
        host.appendChild(renderer.domElement)
        host.classList.add('wolf-rendered')
        observer = new ResizeObserver((entries) => {
          const box = entries[0]?.contentRect
          if (!box || !renderer) return
          renderer.setSize(box.width, box.height, false)
          camera.aspect = box.width / box.height
          camera.updateProjectionMatrix()
        })
        observer.observe(host)

        let previousFrame = 0
        const animate = (time: number) => {
          frame = window.requestAnimationFrame(animate)
          if (time - previousFrame < 32) return
          previousFrame = time
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            wolf.rotation.y = Math.sin(time * 0.0008) * 0.26
            wolf.rotation.x = Math.sin(time * 0.0011) * 0.045
            wolf.position.y = Math.sin(time * 0.002) * 0.035
            eyeMaterial.emissiveIntensity = 0.55 + (Math.sin(time * 0.003) + 1) * 0.22
          }
          renderer?.render(scene, camera)
        }
        animate(0)
      } catch {
        host.classList.add('wolf-render-failed')
      }
    }).catch(() => host.classList.add('wolf-render-failed'))

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      geometries.forEach((geometry) => geometry.dispose())
      materials.forEach((material) => material.dispose())
      renderer?.dispose()
      renderer?.domElement.remove()
    }
  }, [])

  return <span className="wolf-live-mark" ref={hostRef} role="img" aria-label="Animated 3D wolf"><svg className="wolf-fallback" viewBox="0 0 32 32" aria-hidden="true"><path d="M6 4.5 12.5 8.5 16 6.5 19.5 8.5 26 4.5 24.5 14 27.5 19 24 25 16 29 8 25 4.5 19 7.5 14Z" /><path d="m8.5 13.5 5 2.5 2.5-1.5 2.5 1.5 5-2.5M12 20l4 2.5 4-2.5M14.2 17.7h.1m3.4 0h.1" /></svg></span>
}

async function readDocument(file: File): Promise<SourceDocument> {
  const id = `${file.name}-${file.size}-${file.lastModified}`
  if (file.name.toLowerCase().endsWith('.pdf')) {
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const text = await page.getTextContent()
      pages.push(text.items.map((item) => ('str' in item ? item.str : '')).join(' '))
    }
    return { id, name: file.name, kind: 'pdf', content: pages.join('\n'), pages }
  }
  if (file.name.toLowerCase().endsWith('.csv')) {
    const parsed = Papa.parse<ChartRow>(await file.text(), { header: true, skipEmptyLines: true, dynamicTyping: true })
    if (parsed.errors.length && parsed.data.length === 0) throw new Error(parsed.errors[0].message)
    const rows = parsed.data
    const columns = parsed.meta.fields ?? []
    const numericColumns = columns.filter((column) => rows.some((row) => typeof row[column] === 'number' && Number.isFinite(row[column])))
    const content = [columns.join(' | '), ...rows.map((row) => columns.map((column) => `${column}: ${row[column] ?? ''}`).join(' | '))].join('\n')
    return { id, name: file.name, kind: 'csv', content, rows, columns, numericColumns }
  }
  return { id, name: file.name, kind: 'text', content: await file.text() }
}

function findEvidence(query: string, documents: SourceDocument[]): Citation[] {
  const queryTerms = [...new Set(terms(query))]
  const candidates: Array<Citation & { score: number }> = []
  for (const document of documents) {
    const chunks: Array<{ text: string; page?: number }> = document.kind === 'pdf'
      ? (document.pages ?? []).flatMap((page, index) => page.match(/[^.!?]+[.!?]*/g)?.map((text) => ({ text: text.trim(), page: index + 1 })) ?? [])
      : document.content.split(/\n|(?<=[.!?])\s+/).map((text) => ({ text: text.trim() }))
    for (const chunk of chunks) {
      if (!chunk.text) continue
      const chunkTerms = terms(chunk.text)
      const overlap = queryTerms.filter((word) => chunkTerms.includes(word)).length
      const score = queryTerms.length ? overlap / queryTerms.length : 0
      if (score > 0) candidates.push({ file: document.name, excerpt: chunk.text.slice(0, 360), page: chunk.page, score })
    }
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 4).map(({ score: _score, ...citation }) => citation)
}

function App() {
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [chartMode, setChartMode] = useState<ChartMode>('bar')
  const [chartColumn, setChartColumn] = useState('')
  const [selectedGoalId, setSelectedGoalId] = useState(1)
  const [goalChecklist, setGoalChecklist] = useState<Record<string, boolean>>({ '1:Expand cash support programs': true, '3:Improve primary care access': true, '13:Cut emissions': false, '15:Restore forests': true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [evidenceSummary, setEvidenceSummary] = useState<{ status: string; score: string; summary: string }>({ status: 'Waiting for evidence', score: '0%', summary: 'No answer has been checked against source material yet.' })
  const [topicTags, setTopicTags] = useState<string[]>([])
  const [chatMode, setChatMode] = useState<'general' | 'files'>('general')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ollamaUrl, setOllamaUrl] = useState(() => readPreference('wolfchat.ollamaUrl', readPreference('fieldnote.ollamaUrl', 'http://localhost:11434')))
  const [modelName, setModelName] = useState(() => readPreference('wolfchat.modelName', readPreference('fieldnote.modelName', 'qwen2.5:3b')))
  const [modelReady, setModelReady] = useState(false)
  const [checkingModel, setCheckingModel] = useState(false)
  const [modelStatus, setModelStatus] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const activeDocument = documents.find((document) => document.id === selectedId) ?? documents.find((document) => document.kind === 'csv')
  const activeNumericColumns = activeDocument?.numericColumns ?? []
  const activeColumn = activeNumericColumns.includes(chartColumn) ? chartColumn : activeNumericColumns[0]
  const chartRows = (activeDocument?.rows ?? []).slice(0, 80).filter((row) => typeof row[activeColumn] === 'number')
  const selectedGoal = sdgGoals.find((goal) => goal.id === selectedGoalId) ?? sdgGoals[0]
  const averageGoalProgress = Math.round(sdgGoals.reduce((total, goal) => total + goal.progress, 0) / sdgGoals.length)
  const completedGoalCount = new Set(Object.keys(goalChecklist).map((key) => Number(key.split(':')[0]))).size
  const goalActionKey = (goalId: number, action: string) => `${goalId}:${action}`

  async function addFiles(files: FileList | File[]) {
    setError('')
    const allowed = Array.from(files).filter((file) => /\.(pdf|txt|md|csv)$/i.test(file.name))
    if (!allowed.length) {
      setError('Choose a PDF, CSV, TXT, or Markdown file.')
      return
    }
    setBusy(true)
    const results = await Promise.all(allowed.map(async (file) => {
      try {
        return await readDocument(file)
      } catch (reason) {
        setError(`${file.name}: ${reason instanceof Error ? reason.message : 'Could not read this file.'}`)
        return null
      }
    }))
    const added = results.filter((document): document is SourceDocument => document !== null)
    setDocuments((current) => [...current.filter((document) => !added.some((item) => item.id === document.id)), ...added])
    if (added.length) {
      setSelectedId(added.find((document) => document.kind === 'csv')?.id ?? added[0].id)
      const mergedDocuments = [...documents, ...added]
      setTopicTags(extractTopicTags(mergedDocuments, 8))
      setMessages((current) => current.length ? current : [{ id: crypto.randomUUID(), role: 'assistant', content: `I’ve indexed ${added.length} ${added.length === 1 ? 'file' : 'files'} in this browser session. Ask a question to find matching passages, or open a CSV to explore its numeric columns.` }])
    }
    setBusy(false)
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) await addFiles(event.target.files)
    event.target.value = ''
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setDragging(false)
    void addFiles(event.dataTransfer.files)
  }

  function removeDocument(id: string) {
    setDocuments((current) => current.filter((document) => document.id !== id))
    if (selectedId === id) setSelectedId('')
  }

  async function checkModel() {
    setCheckingModel(true)
    setModelReady(false)
    setModelStatus('Checking local model…')
    try {
      const endpoint = ollamaUrl.trim().replace(/\/+$/, '')
      const response = await fetch(`${endpoint}/api/tags`)
      if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`)
      const data = await response.json() as { models?: Array<{ name: string }> }
      const installed = data.models?.some((model) => model.name === modelName.trim() || model.name.startsWith(`${modelName.trim()}:`)) ?? false
      setModelReady(installed)
      setModelStatus(installed ? `Connected. ${modelName.trim()} is ready.` : `Ollama is running, but ${modelName.trim()} is not installed.`)
    } catch {
      setModelReady(false)
      setModelStatus('Local fallback is active. The model is not connected yet, but chat still works with the built-in answer engine.')
    } finally {
      setCheckingModel(false)
    }
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const prompt = question.trim()
    if (!prompt || !canSubmit || busy) return
    setQuestion('')
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: prompt }])
    setBusy(true)
    const recentHistory = messages.slice(-10).map((message) => ({ role: message.role, content: message.content }))
    const searchContext = [...messages.filter((message) => message.role === 'user').slice(-2).map((message) => message.content), prompt].join(' ')
    const citations = chatMode === 'files' ? findEvidence(searchContext, documents) : []
    const asksForChart = /chart|graph|plot|visual|trend|compare|distribution/i.test(prompt)
    const csv = documents.find((document) => document.kind === 'csv' && document.rows?.length)
    let response: string
    if (asksForChart && csv?.numericColumns?.length) {
      setSelectedId(csv.id)
      setChartColumn(csv.numericColumns[0])
      response = `I found ${csv.rows?.length ?? 0} data rows in **${csv.name}** and opened a chart using **${csv.numericColumns[0]}**. Use the chart controls to switch the measure or view.`
    } else if (chatMode === 'general') {
      response = ''
    } else if (citations.length) {
      response = `I found ${citations.length} relevant passage${citations.length === 1 ? '' : 's'} in your uploaded material. The excerpts below are the evidence I matched; this local mode does not infer facts that are not present in the files.`
    } else {
      response = 'I could not find a matching passage in the uploaded files. Try using terms that appear in the document, or upload a file that contains the answer.'
    }
    if (modelReady) {
      const evidence = citations.map((citation, index) => `[S${index + 1}] ${citation.file}${citation.page ? `, page ${citation.page}` : ''}: ${citation.excerpt}`).join('\n')
      const tableSample = asksForChart && csv ? `\nCSV sample from ${csv.name}: ${JSON.stringify(csv.rows?.slice(0, 30))}` : ''
      const systemPrompt = chatMode === 'general' && asksForChart && csv?.numericColumns?.length
        ? 'You are a helpful assistant. The app has already rendered the requested chart. Use the supplied CSV sample to give a brief, accurate takeaway about the chart; do not provide plotting code, library instructions, or pretend to render another chart. Be honest about uncertainty.'
        : chatMode === 'general'
          ? 'You are a helpful, capable general-purpose assistant. Answer questions directly, explain clearly, and ask a brief follow-up only when essential. Be honest about uncertainty and do not claim to have live internet access.'
        : 'Answer using only the supplied evidence. Compare the question against every evidence item. If any passage directly states the requested fact, answer with that exact fact; carefully preserve numbers, names, and dates, and cite it (for example, [S1]). Do not say the answer is missing when a passage states it. If none of the passages answer the question, say that clearly. Be concise and do not invent facts.'
      try {
        const endpoint = ollamaUrl.trim().replace(/\/+$/, '')
        const result = await fetch(`${endpoint}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName.trim(),
            stream: false,
            options: { temperature: 0, seed: 42 },
            messages: [
              { role: 'system', content: systemPrompt },
              ...recentHistory,
              { role: 'user', content: chatMode === 'general' ? `${prompt}${tableSample}` : `Question: ${prompt}\n\nEvidence:\n${evidence || 'No matching passages were found.'}${tableSample}` },
            ],
          }),
        })
        if (!result.ok) throw new Error(`Ollama returned HTTP ${result.status}.`)
        const data = await result.json() as { message?: { content?: string } }
        const generated = data.message?.content?.trim()
        if (!generated) throw new Error('The model returned an empty answer.')
        response = `${asksForChart && csv?.numericColumns?.length ? `A chart of ${csv.numericColumns[0]} is open in the analysis panel.\n\n` : ''}${generated}`
      } catch {
        setModelReady(false)
        setModelStatus('Local fallback is active. The model is not connected yet, but chat still works with the built-in answer engine.')
        response = chatMode === 'general'
          ? buildLocalFallbackAnswer(prompt, { citations, csvName: csv?.name, chartRequested: asksForChart && Boolean(csv?.numericColumns?.length), recentHistory: recentHistory.map((item) => item.content) })
          : `${response}\n\nThe local model could not answer this time, so this is the evidence-only result.`
      }
    } else if (chatMode === 'general') {
      response = buildLocalFallbackAnswer(prompt, { citations, csvName: csv?.name, chartRequested: asksForChart && Boolean(csv?.numericColumns?.length), recentHistory: recentHistory.map((item) => item.content) })
    }
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: response, citations, chart: asksForChart && Boolean(csv?.numericColumns?.length) }])
    setEvidenceSummary(summarizeEvidenceStatus(prompt, response, citations))
    setBusy(false)
  }

  useEffect(() => {
    void checkModel()
  }, [])

  const totalWords = documents.reduce((total, document) => total + terms(document.content).length, 0)
  const canSubmit = chatMode === 'general' ? true : documents.length > 0
  const latestAssistantCitations = [...messages].reverse().find((message) => message.role === 'assistant' && message.citations)?.citations ?? []
  const topicSummary = topicTags.length ? topicTags : extractTopicTags(documents, 8)
  const contradictionSummary = detectContradictions(latestAssistantCitations)
  useEffect(() => {
    setTopicTags(extractTopicTags(documents, 8))
  }, [documents])

  return (
    <main className="app-shell" onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false) }} onDrop={onDrop}>
      <header className="topbar">
        <button className="icon-button sidebar-toggle" title="Toggle file panel" onClick={() => setSidebarOpen((open) => !open)}><PanelLeftClose size={18} /></button>
        <div className="brand-mark"><span className="brand-icon"><svg className="wolf-logo" viewBox="0 0 32 32" role="img" aria-label="Wolfchat wolf logo"><path d="M6 4.5 12.5 8.5 16 6.5 19.5 8.5 26 4.5 24.5 14 27.5 19 24 25 16 29 8 25 4.5 19 7.5 14Z" /><path d="m8.5 13.5 5 2.5 2.5-1.5 2.5 1.5 5-2.5M12 20l4 2.5 4-2.5M14.2 17.7h.1m3.4 0h.1" /></svg></span><span>wolfchat<span className="brand-period">.</span></span></div>
        <button className="topbar-status" title="Configure a local Ollama model" onClick={() => setSettingsOpen(true)}><span className={`status-dot ${modelReady ? 'status-connected' : ''}`} />{modelReady ? modelName : 'Local fallback active'}<Settings size={13} /></button>
        <button className="icon-button mobile-menu" title="Toggle file panel" onClick={() => setSidebarOpen((open) => !open)}><Menu size={19} /></button>
      </header>

      <div className={`workspace ${sidebarOpen ? '' : 'workspace-wide'}`}>
        {sidebarOpen && <aside className="file-rail">
          <div className="rail-heading"><span>YOUR MATERIAL</span><span className="file-count">{documents.length.toString().padStart(2, '0')}</span></div>
          <button className="upload-button" onClick={() => fileInput.current?.click()}><Plus size={16} /> Add files</button>
          <input ref={fileInput} type="file" accept=".pdf,.csv,.txt,.md" multiple hidden onChange={onFileChange} />
          <div className="file-list">
            {documents.map((document) => <button key={document.id} className={`file-entry ${selectedId === document.id ? 'file-active' : ''}`} onClick={() => setSelectedId(document.id)}>
              <span className={`file-icon ${document.kind === 'csv' ? 'spreadsheet' : ''}`}>{document.kind === 'csv' ? <FileSpreadsheet size={16} /> : <FileText size={16} />}</span>
              <span className="file-meta"><span className="file-name">{document.name}</span><span className="file-type">{document.kind === 'csv' ? `${document.rows?.length ?? 0} rows · CSV` : document.kind === 'pdf' ? `${document.pages?.length ?? 0} pages · PDF` : 'Text document'}</span></span>
              <span className="remove-file" title="Remove file" onClick={(event) => { event.stopPropagation(); removeDocument(document.id) }}><Trash2 size={14} /></span>
            </button>)}
          </div>
          {!documents.length && <div className="empty-rail"><span className="empty-symbol"><Upload size={18} /></span><p>Nothing here yet.</p><span>Add a report, notes, or a data file to begin.</span></div>}
          <div className="rail-foot"><span className="privacy-mark" /><div><strong>Private by design</strong><span>Files stay in this browser session.</span></div></div>
        </aside>}

        <section className={`main-column ${dragging ? 'drop-active' : ''}`}>
          {dragging && <div className="drop-overlay"><Upload size={23} /><strong>Drop to add material</strong><span>PDF, CSV, TXT, Markdown</span></div>}
          <div className="conversation-head"><div><div className="eyebrow">{chatMode === 'general' ? 'GENERAL CHAT' : 'DOCUMENT INTELLIGENCE'}</div><h1>{chatMode === 'general' ? <>Ask anything<span>.</span></> : <>Ask your material<span>.</span></>}</h1><p>{chatMode === 'general' ? 'A private, conversational assistant powered by your local model.' : 'Find cited evidence, then turn the numbers into a picture.'}</p></div><div className="mode-switch" role="group" aria-label="Conversation mode"><button className={chatMode === 'general' ? 'mode-active' : ''} onClick={() => setChatMode('general')}><Sparkles size={13} /> Chat</button><button className={chatMode === 'files' ? 'mode-active' : ''} onClick={() => setChatMode('files')}><FileText size={13} /> My files</button></div></div>

          {!documents.length && !messages.length ? <div className="welcome-panel">
            <div className="welcome-art"><div className="art-sheet sheet-back" /><div className="art-sheet sheet-mid" /><div className="art-sheet sheet-front"><div className="sheet-line line-long" /><div className="sheet-line" /><div className="sheet-chart"><i /><i /><i /><i /><i /></div><div className="sheet-line line-short" /></div><span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✦</span></div>
            <div className="welcome-copy"><span className="eyebrow">{chatMode === 'general' ? 'YOUR LOCAL THOUGHT PARTNER' : 'A CLEARER READ'}</span><h2>{chatMode === 'general' ? <>A little help<br />goes a long way.</> : <>Good questions<br />start with good sources.</>}</h2><p>{chatMode === 'general' ? 'Ask for explanations, ideas, plans, drafts, or help thinking something through.' : 'Bring in a document or dataset. Wolfchat finds relevant passages and can chart numeric data when you ask for a visual.'}</p>{chatMode === 'general' ? <div className="prompt-starters"><button onClick={() => setQuestion('Explain a difficult idea in simple terms')}>Explain an idea</button><button onClick={() => setQuestion('Help me make a practical plan for a project')}>Plan a project</button><button onClick={() => setQuestion('Help me draft a clear, friendly email')}>Draft an email</button></div> : <><button className="primary-button" onClick={() => fileInput.current?.click()}><Upload size={16} /> Upload material</button><span className="format-note">PDF · CSV · TXT · MD</span></>}</div>
          </div> : <div className="chat-area">
            {messages.map((message) => <article key={message.id} className={`message message-${message.role}`}>
              {message.role === 'assistant' && <div className="assistant-avatar"><Sparkles size={15} /></div>}
              <div className="message-body"><div className="message-label">{message.role === 'user' ? 'YOU' : 'WOLFCHAT'}</div><p>{message.content.split(/(\*\*.*?\*\*)/g).map((part, index) => part.startsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part)}</p>
                {!!message.citations?.length && <div className="citations"><div className="citation-label">MATCHED EVIDENCE <span>{message.citations.length}</span></div>{message.citations.map((citation, index) => <div className="citation" key={`${citation.file}-${index}`}><div className="citation-source"><FileText size={13} /><strong>{citation.file}</strong>{citation.page && <span>page {citation.page}</span>}</div><blockquote>{citation.excerpt}</blockquote></div>)}</div>}
                {message.chart && <div className="chart-note"><ChartNoAxesCombined size={14} /> Chart updated in the analysis panel</div>}
              </div>
            </article>)}
            {busy && <div className="loading-row"><LoaderCircle size={16} className="spin" /> {chatMode === 'general' ? 'Thinking…' : 'Searching your files…'}</div>}
          </div>}

          {!!error && <div className="error-banner" role="alert">{error}</div>}
          <div className={`composer-wrap ${!canSubmit ? 'composer-disabled' : ''}`}>
            <form className="composer" onSubmit={submitQuestion}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} placeholder={chatMode === 'general' ? 'Ask anything…' : (documents.length ? 'Ask a question about your files…' : 'Add files to start asking')} disabled={!canSubmit || busy} rows={1} /><button type="submit" className="send-button" title="Send question" disabled={!canSubmit || busy || !question.trim()}><Send size={16} /></button></form>
            <div className="composer-foot"><span><WolfGlyph />{chatMode === 'general' ? 'Local chat · recent turns stay in context' : 'Answers link back to matching excerpts'}</span><span>{chatMode === 'files' ? `${totalWords.toLocaleString()} indexed words` : (modelReady ? modelName : 'Local fallback active')}</span></div>
          </div>
        </section>

        <aside className="analysis-panel">
          <div className="analysis-heading"><div><span className="eyebrow">VISUAL ANALYSIS</span><h2>Data lens</h2></div><span className="chart-badge"><ChartNoAxesCombined size={15} /></span></div>
          {activeDocument?.kind === 'csv' && activeNumericColumns.length ? <>
            <div className="chart-context"><span className="context-dot" /><span>{activeDocument.name}</span></div>
            <div className="chart-controls"><label htmlFor="chart-column">MEASURE</label><select id="chart-column" value={activeColumn} onChange={(event) => setChartColumn(event.target.value)}>{activeNumericColumns.map((column) => <option key={column} value={column}>{column}</option>)}</select><div className="chart-tabs" role="group" aria-label="Chart type"><button className={chartMode === 'bar' ? 'tab-active' : ''} onClick={() => setChartMode('bar')}>Bars</button><button className={chartMode === 'line' ? 'tab-active' : ''} onClick={() => setChartMode('line')}>Trend</button></div></div>
            <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%">{chartMode === 'bar' ? <BarChart data={chartRows} margin={{ top: 12, right: 4, left: -18, bottom: 25 }}><CartesianGrid vertical={false} stroke="#e9e9e2" /><XAxis dataKey={activeDocument.columns?.[0]} tick={{ fontSize: 10, fill: '#888b83' }} angle={-24} textAnchor="end" interval="preserveStartEnd" axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: '#888b83' }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ border: '1px solid #e7e7df', borderRadius: 5, fontSize: 12 }} /><Bar dataKey={activeColumn} fill="#df7756" radius={[3, 3, 0, 0]} maxBarSize={30} /></BarChart> : <LineChart data={chartRows} margin={{ top: 12, right: 5, left: -18, bottom: 25 }}><CartesianGrid vertical={false} stroke="#e9e9e2" /><XAxis dataKey={activeDocument.columns?.[0]} tick={{ fontSize: 10, fill: '#888b83' }} angle={-24} textAnchor="end" interval="preserveStartEnd" axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: '#888b83' }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ border: '1px solid #e7e7df', borderRadius: 5, fontSize: 12 }} /><Line dataKey={activeColumn} stroke="#408b74" strokeWidth={2} dot={{ r: 2, fill: '#408b74' }} activeDot={{ r: 4 }} /></LineChart>}</ResponsiveContainer></div>
            <div className="chart-foot"><span>{chartRows.length} plotted rows</span><span>{activeColumn}</span></div>
          </> : <div className="chart-empty"><div className="empty-chart-icon"><ChartNoAxesCombined size={21} /></div><h3>No chart yet</h3><p>Add a CSV with numeric columns, then ask for a chart or select the file to explore it here.</p><button className="text-button" onClick={() => fileInput.current?.click()}><Plus size={14} /> Add a dataset</button></div>}
          <div className="evidence-panel">
            <div className="analysis-heading small-heading"><div><span className="eyebrow">CLAIM VS SOURCE</span><h3>Evidence status</h3></div><span className="score-pill">{evidenceSummary.score}</span></div>
            <div className="evidence-status"><strong>{evidenceSummary.status}</strong><p>{evidenceSummary.summary}</p></div>
            {latestAssistantCitations.length > 0 && <div className="citations compact-citations">{latestAssistantCitations.slice(0, 2).map((citation, index) => <div className="citation" key={`${citation.file}-${index}`}><div className="citation-source"><FileText size={12} /><strong>{citation.file}</strong>{citation.page ? <span>page {citation.page}</span> : null}</div><blockquote>{citation.excerpt}</blockquote></div>)}</div>}
          </div>
          <div className="topic-panel">
            <div className="analysis-heading small-heading"><div><span className="eyebrow">KNOWLEDGE MAP</span><h3>Topics</h3></div></div>
            <div className="topic-chip-list">
              {topicSummary.length ? topicSummary.map((tag) => <span key={tag} className="topic-chip">{tag}</span>) : <span className="topic-empty">Upload files to generate topic tags.</span>}
            </div>
          </div>
          <div className="sdg-panel">
            <div className="analysis-heading small-heading"><div><span className="eyebrow">SUSTAINABLE GOALS</span><h3>Priority goals</h3></div></div>
            <div className="sdg-summary-grid">
              <div className="sdg-summary-card"><span>Goals</span><strong>{sdgGoals.length}</strong></div>
              <div className="sdg-summary-card"><span>Avg</span><strong>{averageGoalProgress}%</strong></div>
              <div className="sdg-summary-card"><span>Tracked</span><strong>{completedGoalCount}</strong></div>
            </div>
            <div className="sdg-grid">
              {sdgGoals.map((goal) => (
                <button key={goal.id} type="button" className={`sdg-goal ${selectedGoalId === goal.id ? 'selected' : ''}`} style={{ background: goal.color }} onClick={() => setSelectedGoalId(goal.id)}>
                  <span>{goal.id}</span>
                  <strong>{goal.label}</strong>
                </button>
              ))}
            </div>
            <div className="sdg-focused" style={{ borderColor: `${selectedGoal.color}55` }}>
              <div className="sdg-focused-header">
                <span className="sdg-focus-badge">Goal {selectedGoal.id}</span>
                <strong>{selectedGoal.label}</strong>
              </div>
              <p>{selectedGoal.description}</p>
              <div className="sdg-progress">
                <label>Progress</label>
                <div className="sdg-progress-bar"><span style={{ width: `${selectedGoal.progress}%`, background: selectedGoal.color }} /></div>
                <small>{selectedGoal.progress}% aligned</small>
              </div>
              <div className="sdg-checklist">
                <label>Action tracker</label>
                {selectedGoal.actions.map((action) => (
                  <label key={action} className="check-item">
                    <input type="checkbox" checked={Boolean(goalChecklist[goalActionKey(selectedGoal.id, action)])} onChange={() => setGoalChecklist((current) => ({ ...current, [goalActionKey(selectedGoal.id, action)]: !current[goalActionKey(selectedGoal.id, action)] }))} />
                    <span>{action}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className={`alert-box ${contradictionSummary.level}`}>
            <strong>{contradictionSummary.level === 'warning' ? 'Contradiction watch' : 'Source check'}</strong>
            <p>{contradictionSummary.message}</p>
          </div>
          <div className="analysis-divider" />
          <div className="analysis-note"><span className="note-mark">i</span><p>Charts use the first column as labels and plot up to 80 rows. Check the source data before drawing conclusions.</p></div>
          <div className="analysis-bottom"><div className="bottom-rule" /><span>ANALYSIS, WITH RECEIPTS</span><div className="bottom-rule" /></div>
        </aside>
      </div>
      {settingsOpen && <div className="dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false) }}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="dialog-heading"><div><span className="eyebrow">OPTIONAL LOCAL AI</span><h2 id="settings-title">Model connection</h2></div><button className="icon-button" title="Close settings" onClick={() => setSettingsOpen(false)}><X size={18} /></button></div><p className="dialog-intro">Connect an Ollama model running on this computer. Your documents and questions are sent only to that local service.</p><label className="settings-label" htmlFor="ollama-url">OLLAMA ADDRESS</label><input id="ollama-url" className="settings-input" value={ollamaUrl} onChange={(event) => { setOllamaUrl(event.target.value); localStorage.setItem('wolfchat.ollamaUrl', event.target.value); setModelReady(false) }} placeholder="http://localhost:11434" /><label className="settings-label" htmlFor="model-name">MODEL NAME</label><input id="model-name" className="settings-input" value={modelName} onChange={(event) => { setModelName(event.target.value); localStorage.setItem('wolfchat.modelName', event.target.value); setModelReady(false) }} placeholder="qwen2.5:3b" /><div className="model-help">Install Ollama and pull a model before connecting. For example: <code>ollama pull qwen2.5:3b</code></div>{!!modelStatus && <div className={`model-status ${modelReady ? 'model-status-good' : ''}`} role="status">{modelStatus}</div>}<div className="dialog-actions"><button className="secondary-button" onClick={() => void checkModel()} disabled={checkingModel || !ollamaUrl.trim() || !modelName.trim()}>{checkingModel && <LoaderCircle size={14} className="spin" />}{checkingModel ? 'Checking…' : 'Test connection'}</button><button className="primary-button" onClick={() => setSettingsOpen(false)}>Done</button></div></section></div>}
      <footer className="page-footer"><span>WOLFCHAT <span className="footer-dot">●</span> LOCAL AI ASSISTANT</span><span>Nothing leaves this browser</span></footer>
    </main>
  )
}

export default App