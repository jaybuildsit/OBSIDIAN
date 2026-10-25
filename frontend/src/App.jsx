import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleAlert, X } from 'lucide-react'
import '@xterm/xterm/css/xterm.css'
import './App.css'
import AssistantPanel from './components/ai/AssistantPanel'
import CodeEditorPanel from './components/editor/CodeEditorPanel'
import FileExplorer from './components/explorer/FileExplorer'
import TopBar from './components/layout/TopBar'
import Welcome from './components/layout/Welcome'
import LivePreview from './components/preview/LivePreview'
import TerminalDock from './components/terminal/TerminalDock'
import { useTerminal } from './hooks/useTerminal'
import { streamAgent } from './services/aiApi'
import { createProject as requestProject, createSandbox as requestSandbox, listFiles, listProjects, readFile, updateFile } from './services/sandboxApi'

const languageFor = (file = '') => file.endsWith('.jsx') || file.endsWith('.js') ? 'javascript' : file.endsWith('.css') ? 'css' : file.endsWith('.html') ? 'html' : file.endsWith('.json') ? 'json' : file.endsWith('.md') ? 'markdown' : 'plaintext'
function appMessage(text) {
  const copy = String(text || '').replace(/^data:\s*/gm, '').trim()
  if (/connected/i.test(copy)) return { tone: 'success', label: 'Connected', detail: copy }
  if (/updat.*(success|complete)/i.test(copy)) return { tone: 'success', label: 'Changes applied', detail: copy }
  if (/updating/i.test(copy)) return { tone: 'working', label: 'Updating project', detail: copy }
  if (/read.*success/i.test(copy)) return { tone: 'success', label: 'Files read', detail: copy }
  if (/reading/i.test(copy)) return { tone: 'working', label: 'Reading files', detail: copy }
  if (/list.*success/i.test(copy)) return { tone: 'success', label: 'Project inspected', detail: copy }
  if (/closed/i.test(copy)) return { tone: 'muted', label: 'Agent finished', detail: copy }
  if (/error|failed/i.test(copy)) return { tone: 'error', label: 'Agent needs attention', detail: copy }
  return { tone: 'working', label: copy || 'Working', detail: copy }
}

// The open workspace is remembered in the browser so a page refresh reopens it
// instead of dropping back to the project list.
const SANDBOX_KEY = 'obsidian.activeSandbox'
const readSavedSandbox = () => {
  try {
    const raw = localStorage.getItem(SANDBOX_KEY)
    const value = raw ? JSON.parse(raw) : null
    return value?.sandboxId ? value : null
  } catch {
    return null
  }
}
const writeSavedSandbox = (value) => {
  try {
    if (value) localStorage.setItem(SANDBOX_KEY, JSON.stringify(value))
    else localStorage.removeItem(SANDBOX_KEY)
  } catch { /* storage unavailable (private mode, blocked) - the app still works */ }
}

function App() {
  const [sandbox, setSandbox] = useState(null), [files, setFiles] = useState([]), [selectedFile, setSelectedFile] = useState(''), [content, setContent] = useState(''), [original, setOriginal] = useState('')
  const [projects, setProjects] = useState([]), [projectsLoading, setProjectsLoading] = useState(true), [creatingProject, setCreatingProject] = useState(false), [launchingProjectId, setLaunchingProjectId] = useState('')
  const [loadingFile, setLoadingFile] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(''), [previewKey, setPreviewKey] = useState(0), [previewLoading, setPreviewLoading] = useState(false)
  const [prompt, setPrompt] = useState(''), [chat, setChat] = useState([]), [activity, setActivity] = useState([]), [agentBusy, setAgentBusy] = useState(false), [terminalOpen, setTerminalOpen] = useState(true), [terminalStatus, setTerminalStatus] = useState('Waiting for workspace')
  const [liveSteps, setLiveSteps] = useState([]), [turnStartedAt, setTurnStartedAt] = useState(0), [dockHeight, setDockHeight] = useState(260), [resizing, setResizing] = useState(false)
  const [restoring, setRestoring] = useState(() => Boolean(readSavedSandbox()))
  const projectsRequestRef = useRef(null), creatingProjectRef = useRef(false), launchingProjectRef = useRef(false), abortRef = useRef(null)
  const terminalMount = useTerminal(sandbox?.sandboxId, setTerminalStatus)
  const dirty = selectedFile && content !== original
  const addActivity = useCallback((value) => { const event = appMessage(value); setActivity((current) => [...current.slice(-11), { id: `${Date.now()}-${Math.random()}`, ...event }]) }, [])
  const loadFiles = useCallback(async (sandboxId) => { setFiles(await listFiles(sandboxId)) }, [])
  const loadProjects = useCallback(() => {
    if (projectsRequestRef.current) return projectsRequestRef.current

    setProjectsLoading(true)
    setError('')
    const request = listProjects()
      .then((nextProjects) => {
        setProjects(nextProjects)
        return nextProjects
      })
      .catch((cause) => {
        setError(cause.message || 'Unable to load your projects.')
        return null
      })
      .finally(() => {
        projectsRequestRef.current = null
        setProjectsLoading(false)
      })
    projectsRequestRef.current = request
    return request
  }, [])
  useEffect(() => { loadProjects() }, [loadProjects])

  // On page load: if a workspace was open, check it is still alive and reopen it.
  // If it has expired (sandboxes are deleted after a while) go to the project list.
  useEffect(() => {
    const saved = readSavedSandbox()
    if (!saved) { setRestoring(false); return undefined }
    let cancelled = false
      ; (async () => {
        try {
          const savedFiles = await listFiles(saved.sandboxId)
          if (cancelled) return
          setSandbox(saved)
          setFiles(savedFiles)
          setPreviewLoading(true)
          setTerminalStatus('Connecting')
          addActivity('Connected to workspace')
          addActivity('Files Listed Successfully')
        } catch {
          writeSavedSandbox(null)
        } finally {
          if (!cancelled) setRestoring(false)
        }
      })()
    return () => { cancelled = true }
  }, [addActivity])

  const createProject = async (title) => {
    if (creatingProjectRef.current || !title.trim()) return null
    creatingProjectRef.current = true
    setCreatingProject(true)
    setError('')
    try {
      const project = await requestProject(title)
      setProjects((current) => [project, ...current.filter((item) => item._id !== project._id)])
      return project
    } catch (cause) {
      setError(cause.message || 'Unable to create your project.')
      return null
    } finally {
      creatingProjectRef.current = false
      setCreatingProject(false)
    }
  }
  const launchProject = async (project) => {
    if (launchingProjectRef.current || !project?._id) return
    launchingProjectRef.current = true
    setLaunchingProjectId(project._id)
    setError(''); setFiles([]); setSelectedFile(''); setContent(''); setOriginal(''); setActivity([])
    try {
      const { sandboxId, previewUrl } = await requestSandbox(project._id)
      const nextSandbox = { projectId: project._id, projectTitle: project.title, sandboxId, previewUrl }
      setSandbox(nextSandbox)
      writeSavedSandbox(nextSandbox)
      setPreviewLoading(true)
      setTerminalStatus('Connecting')
      addActivity('Connected to workspace')
      await loadFiles(nextSandbox.sandboxId)
      addActivity('Files Listed Successfully')
    } catch (cause) { setError(cause.message || 'Sandbox creation failed. Please try again.'); setSandbox(null); writeSavedSandbox(null) } finally {
      launchingProjectRef.current = false
      setLaunchingProjectId('')
    }
  }
  const selectFile = async (file) => {
    if (!sandbox || !file.includes('.')) return
    setSelectedFile(file); setLoadingFile(true); setError('')
    try { const fileContent = await readFile(sandbox.sandboxId, file); setContent(fileContent); setOriginal(fileContent) } catch (cause) { setError(cause.message || 'Unable to read file.') } finally { setLoadingFile(false) }
  }
  const saveFile = useCallback(async () => {
    if (!sandbox || !selectedFile || !dirty) return
    setSaving(true); setError('')
    try { await updateFile(sandbox.sandboxId, selectedFile, content); setOriginal(content); setPreviewKey((key) => key + 1); addActivity(`Updated ${selectedFile} successfully`) } catch (cause) { setError(cause.message || 'Unable to save changes.') } finally { setSaving(false) }
  }, [sandbox, selectedFile, dirty, content, addActivity])
  useEffect(() => { const handler = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveFile() } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler) }, [saveFile])

  const invokeAgent = async () => {
    const message = prompt.trim()
    if (!message || !sandbox || agentBusy) return

    const startedAt = Date.now()
    const steps = []
    const controller = new AbortController()
    abortRef.current = controller

    // Abort if no event arrives for 2 minutes (timer resets on every event)
    let idleTimer
    const armIdle = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => controller.abort(), 120000)
    }

    setPrompt('')
    setAgentBusy(true)
    setError('')
    setLiveSteps([])
    setTurnStartedAt(startedAt)
    setChat((c) => [...c, { role: 'user', text: message }])

    const onEvent = (value) => {
      armIdle()
      addActivity(value)
      steps.push(appMessage(value))
      setLiveSteps([...steps])
    }

    try {
      armIdle()
      await streamAgent(
        message,
        sandbox.projectId,
        sandbox.sandboxId,
        onEvent,
        controller.signal
      )
      setChat((c) => [
        ...c,
        { role: 'agent', text: 'Finished. The preview has been refreshed.', steps: [...steps], duration: Date.now() - startedAt },
      ])
      setPreviewKey((key) => key + 1)
      await loadFiles(sandbox.sandboxId)
    } catch (cause) {
      const text = controller.signal.aborted
        ? 'The agent stopped responding (no events for 2 minutes), or you stopped it.'
        : cause.message || 'AI agent failed.'
      setError(text)
      onEvent(`Error: ${text}`)
      setChat((c) => [
        ...c,
        { role: 'agent', text: `Something went wrong: ${text}`, steps: [...steps], duration: Date.now() - startedAt, failed: true },
      ])
    } finally {
      clearTimeout(idleTimer)
      abortRef.current = null
      setAgentBusy(false)
      setLiveSteps([])
    }
  }

  const startDockResize = (event) => {
    event.preventDefault()
    const startY = event.clientY, startHeight = dockHeight, target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    setResizing(true)
    const onMove = (e) => setDockHeight(Math.min(Math.max(startHeight + startY - e.clientY, 120), Math.round(window.innerHeight * 0.7)))
    const onUp = () => {
      setResizing(false)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }
  return <main className={`app-shell${resizing ? ' dragging' : ''}`} style={{ '--dock-h': `${dockHeight}px` }}>
    <TopBar sandbox={sandbox} />
    {error && <div className="notice error-notice"><CircleAlert size={16} /><span>{error}</span><button onClick={() => setError('')}><X size={15} /></button></div>}
    {!sandbox ? (restoring ? <div className="notice"><span>Reopening your workspace…</span></div> : <Welcome projects={projects} projectsLoading={projectsLoading} creatingProject={creatingProject} launchingProjectId={launchingProjectId} onCreateProject={createProject} onLaunchProject={launchProject} onReloadProjects={loadProjects} />) : <>
      <section className="workspace"><FileExplorer projectTitle={sandbox.projectTitle} files={files} selectedFile={selectedFile} dirty={dirty} onSelect={selectFile} onRefresh={() => loadFiles(sandbox.sandboxId)} />
        <CodeEditorPanel selectedFile={selectedFile} content={content} dirty={dirty} loading={loadingFile} saving={saving} language={languageFor(selectedFile)} onChange={setContent} onSave={saveFile} onClose={() => { setSelectedFile(''); setContent(''); setOriginal('') }} />
        <aside className="right-rail"><LivePreview previewUrl={sandbox.previewUrl} loading={previewLoading} previewKey={previewKey} onRefresh={() => { setPreviewLoading(true); setPreviewKey((key) => key + 1) }} onLoad={() => setPreviewLoading(false)} /><AssistantPanel prompt={prompt} chat={chat} busy={agentBusy} liveSteps={liveSteps} turnStartedAt={turnStartedAt} onPromptChange={setPrompt} onSubmit={invokeAgent} onStop={() => abortRef.current?.abort()} /></aside></section>
      {terminalOpen && <div className="dock-resizer" onPointerDown={startDockResize} role="separator" aria-orientation="horizontal" />}
      <TerminalDock isOpen={terminalOpen} terminalStatus={terminalStatus} activity={[...activity].reverse()} busy={agentBusy} terminalMount={terminalMount} onToggle={() => setTerminalOpen((open) => !open)} />
    </>}</main>
}
export default App