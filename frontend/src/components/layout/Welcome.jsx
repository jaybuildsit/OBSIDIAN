import { LoaderCircle, Plus, Sparkles } from 'lucide-react'

function Welcome({ creating, onCreate }) {
  return <section className="welcome"><div className="welcome-card"><div className="eyebrow"><Sparkles size={14} /> Your development environment</div><h1>Build with a clearer <em>point of view.</em></h1><p>OBSIDIAN pairs your live project environment with an attentive AI collaborator—without getting in the way of your craft.</p><button className="primary-button" onClick={onCreate} disabled={creating}>{creating ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}{creating ? 'Creating sandbox…' : 'Create a sandbox'}</button><span className="welcome-note">A live preview, project files, terminal, and agent are ready when you are.</span></div><div className="welcome-grid"><span>01 — Work in context</span><span>02 — Make precise changes</span><span>03 — See it instantly</span></div></section>
}

export default Welcome
