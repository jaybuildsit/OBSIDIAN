import { useCallback, useEffect, useState } from 'react'
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
import { createSandbox as requestSandbox, listFiles, readFile, updateFile } from './services/sandboxApi'

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

function App() {
  const [sandbox, setSandbox] = useState(null), [files, setFiles] = useState([]), [selectedFile, setSelectedFile] = useState(''), [content, setContent] = useState(''), [original, setOriginal] = useState('')
  const [creating, setCreating] = useState(false), [loadingFile, setLoadingFile] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(''), [previewKey, setPreviewKey] = useState(0), [previewLoading, setPreviewLoading] = useState(false)
  const [prompt, setPrompt] = useState(''), [chat, setChat] = useState([]), [activity, setActivity] = useState([]), [agentBusy, setAgentBusy] = useState(false), [terminalOpen, setTerminalOpen] = useState(true), [terminalStatus, setTerminalStatus] = useState('Waiting for workspace')
  const terminalMount = useTerminal(sandbox?.sandboxId, setTerminalStatus)
  const dirty = selectedFile && content !== original
  const addActivity = useCallback((value) => { const event = appMessage(value); setActivity((current) => [...current.slice(-11), { id: `${Date.now()}-${Math.random()}`, ...event }]) }, [])
  const loadFiles = useCallback(async (sandboxId) => { setFiles(await listFiles(sandboxId)) }, [])
  const createSandbox = async () => {
    setCreating(true); setError(''); setFiles([]); setSelectedFile(''); setContent(''); setOriginal(''); setActivity([])
    try { const payload = await requestSandbox(); setSandbox(payload); setPreviewLoading(true); addActivity('Connected to workspace'); await loadFiles(payload.sandboxId); addActivity('Files Listed Successfully') } catch (cause) { setError(cause.message || 'Sandbox creation failed. Please try again.'); setSandbox(null) } finally { setCreating(false) }
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
    const message = prompt.trim(); if (!message || !sandbox || agentBusy) return
    setPrompt(''); setAgentBusy(true); setError(''); setChat((c) => [...c, { role: 'user', text: message }]); addActivity('Reading Files...')
    try { await streamAgent(message, sandbox.sandboxId, addActivity); setChat((c) => [...c, { role: 'agent', text: 'I’ve completed the requested pass. Review the activity log for the files I touched.' }]); setPreviewKey((key) => key + 1); await loadFiles(sandbox.sandboxId) } catch (cause) { setError(cause.message || 'AI agent failed.'); addActivity(`Error: ${cause.message}`) } finally { setAgentBusy(false) }
  }
  return <main className="app-shell">
    <TopBar sandbox={sandbox} />
    {error && <div className="notice error-notice"><CircleAlert size={16} /><span>{error}</span><button onClick={() => setError('')}><X size={15} /></button></div>}
    {!sandbox ? <Welcome creating={creating} onCreate={createSandbox} /> : <>
      <section className="workspace"><FileExplorer files={files} selectedFile={selectedFile} dirty={dirty} onSelect={selectFile} onRefresh={() => loadFiles(sandbox.sandboxId)} />
      <CodeEditorPanel selectedFile={selectedFile} content={content} dirty={dirty} loading={loadingFile} saving={saving} language={languageFor(selectedFile)} onChange={setContent} onSave={saveFile} onClose={() => { setSelectedFile(''); setContent(''); setOriginal('') }} />
      <aside className="right-rail"><LivePreview previewUrl={sandbox.previewUrl} loading={previewLoading} previewKey={previewKey} onRefresh={() => { setPreviewLoading(true); setPreviewKey((key) => key + 1) }} onLoad={() => setPreviewLoading(false)} /><AssistantPanel prompt={prompt} chat={chat} busy={agentBusy} onPromptChange={setPrompt} onSubmit={invokeAgent} /></aside></section>
      <TerminalDock isOpen={terminalOpen} terminalStatus={terminalStatus} activity={activity} busy={agentBusy} terminalMount={terminalMount} onToggle={() => setTerminalOpen((open) => !open)} />
    </>}</main>
}
export default App
