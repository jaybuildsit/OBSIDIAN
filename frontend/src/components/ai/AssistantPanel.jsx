import { Bot, Send, Sparkles } from 'lucide-react'

function AssistantPanel({ prompt, chat, busy, onPromptChange, onSubmit }) {
  const handleKeyDown = (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSubmit() } }
  return <section className="assistant-card panel-light">
    <div className="assistant-title"><span><Bot size={15} /> OBSIDIAN ASSISTANT</span><span className={busy ? 'working-pill' : 'ready-pill'}>{busy ? 'Working' : 'Ready'}</span></div>
    <div className="chat-history">{chat.length ? chat.slice(-3).map((item, index) => <div key={`${item.role}-${index}`} className={`chat-message ${item.role}`}><span>{item.role === 'user' ? 'YOU' : 'OBSIDIAN'}</span><p>{item.text}</p></div>) : <div className="assistant-empty"><Sparkles size={18} /><p>Tell OBSIDIAN what you’d like to change.</p><small>It will work directly with your live project.</small></div>}</div>
    <div className="prompt-box"><textarea value={prompt} onChange={(event) => onPromptChange(event.target.value)} onKeyDown={handleKeyDown} placeholder="Ask OBSIDIAN to change your project…" rows="2" disabled={busy} /><button className="send" onClick={onSubmit} disabled={!prompt.trim() || busy}><Send size={15} /></button><span>↵ send · ⇧↵ new line</span></div>
  </section>
}

export default AssistantPanel
