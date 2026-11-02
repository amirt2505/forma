import { useEffect, useState } from 'react'

export default function Milestones({ api, projects = [], writable, selectedProjectId }) {
  const [projectId, setProjectId] = useState(String(selectedProjectId || projects[0]?.id || ''))
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const project = projects.find(p => String(p.id) === projectId)
  const editable = Boolean(project && writable(project.team_id))

  useEffect(() => {
    if (selectedProjectId) setProjectId(String(selectedProjectId))
    else if (!projects.some(p => String(p.id) === projectId)) setProjectId(String(projects[0]?.id || ''))
  }, [selectedProjectId, projects, projectId])

  async function load(id = projectId) {
    if (!id) { setItems([]); return }
    setItems(await api(`/projects/${id}/milestones`))
  }

  useEffect(() => {
    let active = true
    if (!projectId) { setItems([]); return }
    api(`/projects/${projectId}/milestones`).then(data => {
      if (active) { setItems(data); setError('') }
    }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [projectId])

  async function action(fn) {
    if (busy) return
    setBusy(true)
    setError('')
    try { await fn(); await load() }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return <div className="page-content milestones-page">
    <div className="page-heading"><div><div className="eyebrow">PROJECT PLANNING</div><h1>Milestones</h1><p>Group your work into meaningful goals and deadlines.</p></div></div>
    {error && <p role="alert" className="error">{error}</p>}
    {!projects.length ? <div className="surface-card empty-state">Create a project before adding milestones.</div> :
      <div className="surface-card">
        {!selectedProjectId && <label className="form-stack">Project
          <select value={projectId} onChange={e => setProjectId(e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>}
        <div className="milestone-summary">{items.filter(m => m.completed).length} of {items.length} milestones complete</div>
        {items.map(m => <div className="milestone-row" key={m.id}>
          <input aria-label={`Complete ${m.name}`} type="checkbox" checked={m.completed} disabled={!editable || busy} onChange={() => action(() => api(`/milestones/${m.id}`, 'PATCH', { name: m.name, due_date: m.due_date, completed: !m.completed }))}/>
          <strong style={{ textDecoration: m.completed ? 'line-through' : 'none' }}>{m.name}</strong>
          <span>{m.due_date || 'No deadline'}</span>
          {editable && <button type="button" className="danger-link" disabled={busy} onClick={() => { if (window.confirm(`Delete milestone “${m.name}”? Tasks will keep their other details.`)) action(() => api(`/milestones/${m.id}`, 'DELETE')) }}>Delete</button>}
        </div>)}
        {!items.length && <p className="empty-state">No milestones yet. Add the first goal for this project.</p>}
        {editable && <form className="milestone-form" onSubmit={e => { e.preventDefault(); if (!name.trim()) return; action(async () => { await api(`/projects/${projectId}/milestones`, 'POST', { name: name.trim(), due_date: dueDate || null, completed: false }); setName(''); setDueDate('') }) }}>
          <input required maxLength={120} placeholder="What are you working toward?" value={name} onChange={e => setName(e.target.value)}/>
          <input aria-label="Milestone due date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/>
          <button className="btn primary" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Add milestone'}</button>
        </form>}
      </div>}
  </div>
}
