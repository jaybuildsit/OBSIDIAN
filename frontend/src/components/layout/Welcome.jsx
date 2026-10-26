import { useMemo, useState } from 'react'
import { ArrowRight, Plus, RefreshCw, Search, Sparkles } from 'lucide-react'
import './Welcome.css'

// A MongoDB id starts with the creation time (4 bytes, in seconds), so the
// projects list can show real "created" times without any backend change.
const createdAt = (id = '') => {
  const seconds = parseInt(String(id).slice(0, 8), 16)
  return Number.isFinite(seconds) ? seconds * 1000 : 0
}

const ago = (time) => {
  if (!time) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const initials = (title = '') => {
  const words = String(title).trim().split(/[\s_-]+/).filter(Boolean)
  if (!words.length) return 'p'
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)
  return letters.toLowerCase()
}

export default function Welcome({
  projects = [],
  projectsLoading,
  creatingProject,
  launchingProjectId,
  onCreateProject,
  onLaunchProject,
  onReloadProjects,
}) {
  const [title, setTitle] = useState('')
  const [query, setQuery] = useState('')

  // Newest first (the list from the API comes back oldest first).
  const sorted = useMemo(
    () => [...projects].sort((a, b) => String(b._id).localeCompare(String(a._id))),
    [projects],
  )
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? sorted.filter((project) => (project.title || '').toLowerCase().includes(needle)) : sorted
  }, [sorted, query])
  const launching = Boolean(launchingProjectId)

  const submit = async (event) => {
    event.preventDefault()
    if (creatingProject || !title.trim()) return
    const project = await onCreateProject(title)
    if (project) setTitle('')
  }

  return (
    <section className="wc-page">
      <div className="wc-halo" aria-hidden="true" />

      <div className="wc-hero">
        <span className="wc-eyebrow"><Sparkles size={12} /> Your development environment</span>
        <h1>Build with a clearer <em>point of view.</em></h1>
        <p className="wc-lede">
          OBSIDIAN pairs your live project environment with an attentive AI collaborator—without getting in the way of your craft.
        </p>

        <form className="wc-create" onSubmit={submit}>
          <Plus size={15} className="wc-create-icon" aria-hidden="true" />
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Name your project"
            aria-label="Project name"
            maxLength={60}
            disabled={creatingProject}
          />
          <span className="wc-stack">React + Vite</span>
          <button type="submit" className="wc-create-button" disabled={creatingProject || !title.trim()}>
            {creatingProject ? <RefreshCw size={14} className="spin" /> : <Plus size={14} />}
            {creatingProject ? 'Creating…' : 'Create project'}
          </button>
        </form>
        <p className="wc-note">Create a project, then launch its sandbox to start building.</p>
      </div>

      <div className="wc-projects">
        <div className="wc-projects-head">
          <span className="wc-projects-title">Your projects <b>{projects.length}</b></span>
          {projects.length > 4 && (
            <label className="wc-search">
              <Search size={12} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter projects"
                aria-label="Filter projects"
              />
            </label>
          )}
          <button
            type="button"
            className="wc-icon-button"
            onClick={onReloadProjects}
            disabled={projectsLoading}
            aria-label="Reload projects"
          >
            <RefreshCw size={13} className={projectsLoading ? 'spin' : ''} />
          </button>
        </div>

        <div className="wc-list">
          {projectsLoading && !projects.length ? (
            <div className="wc-feedback"><RefreshCw size={13} className="spin" /> Loading your projects…</div>
          ) : !projects.length ? (
            <div className="wc-feedback">No projects yet. Name one above to get started.</div>
          ) : !visible.length ? (
            <div className="wc-feedback">No projects match “{query}”.</div>
          ) : (
            visible.map((project) => {
              const busy = launchingProjectId === project._id
              const created = ago(createdAt(project._id))

              return (
                <article className="wc-row" key={project._id}>
                  <span className="wc-chip" aria-hidden="true">{initials(project.title)}</span>
                  <div className="wc-row-main">
                    <strong>{project.title || 'Untitled project'}</strong>
                    <span className="wc-row-meta">
                      {created && <span>Created {created}</span>}
                      <span className="wc-tag">React + Vite</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`wc-launch${busy ? ' busy' : ''}`}
                    disabled={launching}
                    onClick={() => onLaunchProject(project)}
                  >
                    {busy ? (
                      <><RefreshCw size={12} className="spin" /> Launching…</>
                    ) : (
                      <>Launch <ArrowRight size={12} /></>
                    )}
                  </button>
                </article>
              )
            })
          )}
        </div>
      </div>

      <footer className="wc-foot">
        <span>01 — Work in context</span>
        <span>02 — Make precise changes</span>
        <span>03 — See it instantly</span>
      </footer>
    </section>
  )
}