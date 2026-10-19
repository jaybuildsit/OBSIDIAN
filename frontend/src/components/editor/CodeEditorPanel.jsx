import Editor from '@monaco-editor/react'
import { Code2, FileText, LoaderCircle, Save, X } from 'lucide-react'

function CodeEditorPanel({ selectedFile, content, dirty, loading, saving, language, onChange, onSave, onClose }) {
  return <section className="editor-panel dark-panel">
    <div className="tabs"><div className="tab active"><FileText size={14} /><span>{selectedFile || 'No file selected'}</span>{dirty && <span className="dirty-dot" />}{selectedFile && <button onClick={onClose}><X size={13} /></button>}</div></div>
    <div className="editor-toolbar"><span>{selectedFile ? `${language} · workspace` : 'Select a file in the explorer'}</span><div>{dirty && <button className="save-button" onClick={onSave} disabled={saving}>{saving ? <LoaderCircle className="spin" size={13} /> : <Save size={13} />}{saving ? 'Saving' : 'Save'}</button>}</div></div>
    <div className="editor-canvas">{loading ? <div className="editor-empty"><LoaderCircle className="spin" size={20} /> Reading {selectedFile}…</div> : selectedFile ? <Editor height="100%" language={language} value={content} onChange={(value) => onChange(value || '')} theme="obsidian-warm" beforeMount={(monaco) => monaco.editor.defineTheme('obsidian-warm', { base: 'vs-dark', inherit: true, rules: [{ token: 'comment', foreground: '887d71' }, { token: 'keyword', foreground: 'd4a574' }, { token: 'string', foreground: 'b9c993' }, { token: 'number', foreground: 'd99275' }], colors: { 'editor.background': '#1d1916', 'editorGutter.background': '#1d1916', 'editorLineNumber.foreground': '#665d54', 'editorLineNumber.activeForeground': '#b6aa9b', 'editorCursor.foreground': '#df8b62', 'editor.selectionBackground': '#4b3b30' } })} options={{ minimap: { enabled: false }, fontSize: 13, fontFamily: 'DM Mono, Consolas, monospace', lineHeight: 22, padding: { top: 20 }, scrollBeyondLastLine: false, smoothScrolling: true, wordWrap: 'on', automaticLayout: true }} /> : <div className="editor-empty"><Code2 size={26} /><h2>Nothing open yet.</h2><p>Select a file from the explorer to begin editing.</p></div>}</div>
    <div className="editor-footer"><span>{dirty ? 'Unsaved changes' : selectedFile ? 'Saved to workspace' : 'Workspace ready'}</span><span>{selectedFile && `Ln 1, Col 1 · ${language}`}</span></div>
  </section>
}

export default CodeEditorPanel
