import { useState } from 'react'
import { LoaderCircle, Plus, RefreshCw, Sparkles } from 'lucide-react'

function Welcome({ projects, projectsLoading, creatingProject, launchingProjectId, onCreateProject, onLaunchProject, onReloadProjects }) {
  const [title, setTitle] = useState('')
  const submitProject = async (event) => {
    event.preventDefault()
    if (!title.trim()) return
    const project = await onCreateProject(title)
    if (project) setTitle('')
  }

  return <section className="welcome">
    <div className="welcome-card">
      <div className="eyebrow"><Sparkles size={14} /> Your development environment</div>
      <h1>Build with a clearer <em>point of view.</em></h1>
      <p>OBSIDIAN pairs your live project environment with an attentive AI collaborator—without getting in the way of your craft.</p>
      <form className="project-form" onSubmit={submitProject}>
        <input aria-label="Project name" placeholder="Name your project" value={title} onChange={(event) => setTitle(event.target.value)} disabled={projectsLoading || creatingProject} />
        <button className="primary-button" type="submit" disabled={projectsLoading || creatingProject || !title.trim()}>
          {creatingProject ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}
          {creatingProject ? 'Creating project…' : 'Create project'}
        </button>
      </form>
      <span className="welcome-note">Create a project, then launch its sandbox to start building.</span>
      <div className="project-dashboard">
        <div className="project-dashboard-heading"><span>YOUR PROJECTS</span><button type="button" className="bare-button" onClick={onReloadProjects} disabled={projectsLoading} title="Reload projects"><RefreshCw size={14} className={projectsLoading ? 'spin' : ''} /></button></div>
        {projectsLoading ? <div className="project-feedback"><LoaderCircle className="spin" size={15} /> Loading your projects…</div> : projects.length === 0 ? <div className="project-feedback">No projects yet. Create one to get started.</div> : <div className="project-list">
          {projects.map((project) => <div className="project-card" key={project._id}>
            <span className="project-card-title">{project.title}</span>
            <button className="launch-button" type="button" onClick={() => onLaunchProject(project)} disabled={Boolean(launchingProjectId)}>{launchingProjectId === project._id ? <><LoaderCircle className="spin" size={14} /> Launching…</> : 'Launch'}</button>
          </div>)}
        </div>}
      </div>
    </div>
    <div className="welcome-grid"><span>01 — Work in context</span><span>02 — Make precise changes</span><span>03 — See it instantly</span></div>
  </section>
}

export default Welcome
