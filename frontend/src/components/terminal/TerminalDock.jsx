import { ChevronDown, ChevronRight, LoaderCircle, Sparkles, TerminalSquare } from 'lucide-react'

function TerminalDock({ isOpen, terminalStatus, activity, busy, terminalMount, onToggle }) {
  return <section className={`bottom-dock ${isOpen ? '' : 'collapsed'}`}>
    <div className="dock-tabs"><button className="dock-tab active" onClick={onToggle}><TerminalSquare size={14} /> TERMINAL <span className="terminal-state">{terminalStatus}</span></button><button className="dock-tab"><Sparkles size={14} /> AGENT ACTIVITY {busy && <LoaderCircle className="spin" size={13} />}</button><button className="dock-collapse" onClick={onToggle}>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></div>
    <div className="dock-content"><div className="terminal-wrap"><div ref={terminalMount} className="terminal-mount" /></div><div className="activity-wrap">{activity.length ? activity.map((item) => <div className={`activity-item ${item.tone}`} key={item.id}><span className="activity-icon">{item.tone === 'success' ? '✓' : item.tone === 'error' ? '!' : '→'}</span><div><strong>{item.label}</strong><small>{item.detail}</small></div></div>) : <div className="activity-empty">The agent’s work will appear here.</div>}</div></div>
  </section>
}

export default TerminalDock
