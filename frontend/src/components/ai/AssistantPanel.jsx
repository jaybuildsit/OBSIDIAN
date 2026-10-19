import { useEffect, useRef, useState } from 'react'
import { Bot, Check, ChevronRight, CircleAlert, Loader2, Send, Sparkles } from 'lucide-react'

const SUGGESTIONS = ['Change the theme to light mode', 'Add a responsive navbar', 'Explain this project']

// The agent often repeats the same event ("Reading files"), so collapse consecutive duplicates.
const dedupe = (steps) => steps.filter((step, i) => i === 0 || step.label !== steps[i - 1].label)
const formatSeconds = (ms) => `${Math.max(1, Math.round(ms / 1000))}s`

function useElapsed(startedAt) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}

function StepList({ steps, running }) {
  return (
    <ul className="ai-steps">
      {steps.map((step, i) => {
        const active = running && i === steps.length - 1 && step.tone === 'working'
        const tone = step.tone === 'working' && !active ? 'success' : step.tone
        return (
          <li key={`${i}-${step.label}`} className={`ai-step ${tone}${active ? ' active' : ''}`}>
            <span className="ai-step-icon">
              {active ? <Loader2 size={10} className="spin" /> : step.tone === 'error' ? <CircleAlert size={10} /> : <Check size={10} />}
            </span>
            <span>{step.label}</span>
          </li>
        )
      })}
    </ul>
  )
}

// Shown while the agent is running: animated header, live timer, steps appearing as events arrive.
function WorkingTurn({ steps, startedAt }) {
  const elapsed = useElapsed(startedAt)
  const list = dedupe(steps)
  return (
    <div className="chat-message agent">
      <span>OBSIDIAN</span>
      <div className="ai-turn-head">
        <span className="ai-orb"><Sparkles size={11} /></span>
        <span className="ai-shimmer">Working</span>
        <span className="ai-dots"><i /><i /><i /></span>
        <span className="ai-elapsed">{elapsed}s</span>
      </div>
      {list.length > 0 && <StepList steps={list} running />}
    </div>
  )
}

// A finished agent reply: steps collapse into a one-line summary that expands on click.
function AgentMessage({ message }) {
  const [open, setOpen] = useState(false)
  const steps = dedupe(message.steps || [])
  return (
    <div className="chat-message agent">
      <span>OBSIDIAN</span>
      {steps.length > 0 && (
        <button type="button" className="ai-summary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {message.failed ? <CircleAlert size={12} /> : <Check size={12} />}
          <span>{message.failed ? 'Stopped after' : 'Worked for'} {formatSeconds(message.duration || 0)} · {steps.length} step{steps.length === 1 ? '' : 's'}</span>
          <ChevronRight size={12} className={`ai-chevron${open ? ' open' : ''}`} />
        </button>
      )}
      {open && <StepList steps={steps} running={false} />}
      <p>{message.text}</p>
    </div>
  )
}

export default function AssistantPanel({ prompt, chat, busy, onPromptChange, onSubmit, liveSteps = [], turnStartedAt = 0 }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chat, liveSteps, busy])

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSubmit()
    }
  }

  const empty = chat.length === 0 && !busy

  return (
    <section className="assistant-card panel-light">
      <header className="assistant-title">
        <span><Bot size={15} /> OBSIDIAN ASSISTANT</span>
        <span className={busy ? 'working-pill' : 'ready-pill'}>{busy ? 'Working' : 'Ready'}</span>
      </header>

      <div className="chat-history">
        {empty ? (
          <div className="assistant-empty">
            <Sparkles size={18} />
            <p>Tell OBSIDIAN what you’d like to change.</p>
            <small>It will work directly with your live project.</small>
            <div className="ai-chips">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => onPromptChange(suggestion)}>{suggestion}</button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {chat.map((message, i) =>
              message.role === 'user' ? (
                <div key={i} className="chat-message user"><span>YOU</span><p>{message.text}</p></div>
              ) : (
                <AgentMessage key={i} message={message} />
              )
            )}
            {busy && <WorkingTurn steps={liveSteps} startedAt={turnStartedAt} />}
          </>
        )}
        <div ref={endRef} />
      </div>

      <div className="prompt-box">
        <textarea
          rows={2}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={busy ? 'OBSIDIAN is working…' : 'Ask OBSIDIAN to change your project…'}
        />
        <button type="button" className="send" onClick={onSubmit} disabled={busy || !prompt.trim()} aria-label="Send">
          {busy ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
        </button>
        <span>↵ send · ⇧↵ new line</span>
      </div>
    </section>
  )
}