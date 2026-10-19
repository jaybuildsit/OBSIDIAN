import { Code2, Settings2, Wifi } from 'lucide-react'

function TopBar({ sandbox }) {
  return <header className="topbar"><div className="brand"><span className="brand-mark"><Code2 size={16} /></span><span>OBSIDIAN</span><span className="edition">WORKSPACE</span></div><div className="project-status">{sandbox ? <><span className="status-dot" /> {sandbox.sandboxId.slice(0, 8)} <span className="status-divider" /> Sandbox active</> : 'A thoughtful space for building'}</div><div className="top-actions"><span className="connection"><Wifi size={14} /> {sandbox ? 'Connected' : 'Ready'}</span><button className="icon-button" title="Settings"><Settings2 size={16} /></button><button className="avatar">JP</button></div></header>
}

export default TopBar
