import { useMemo } from 'react'

export default function Insights({ tasks = [], projects = [], members = {}, onOpenTask, onOpenProject }) {
  const today = new Date().toISOString().slice(0, 10)
  const open = useMemo(() => tasks.filter(t => t.status !== 'done'), [tasks])
  const overdue = open.filter(t => t.due_date && t.due_date < today)
  const unassigned = open.filter(t => !t.assignee_id)
  const stalled = open.filter(t => t.status === 'todo' && t.priority === 'urgent')
  const owners = Object.values(members).flat().filter((m, i, a) => a.findIndex(x => x.id === m.id) === i)
  const groups = projects.map(p => {
    const all = tasks.filter(t => t.project_id === p.id)
    return { ...p, total: all.length, done: all.filter(t => t.status === 'done').length,
      overdue: all.filter(t => t.status !== 'done' && t.due_date && t.due_date < today).length }
  }).sort((a,b) => b.overdue-a.overdue)
  return <div className="page-content insights-page">
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE HEALTH</div><h1>Insights</h1><p>Find bottlenecks and understand where work needs attention.</p></div></div>
    <div className="stat-grid">
      {[['Open issues',open.length],['Overdue',overdue.length],['Unassigned',unassigned.length],['Urgent backlog',stalled.length]].map(([label,value]) => <div className="stat-card" key={label}><div className="stat-top"><span>{label}</span></div><strong>{value}</strong></div>)}
    </div>
    <div className="dashboard-grid">
      <section className="surface-card"><div className="section-heading"><div><h2>Project health</h2><p>Completion and overdue work</p></div></div>
        {groups.map(p => <button key={p.id} className="insight-project" onClick={() => onOpenProject?.(p.id)}><div><strong>{p.name}</strong><span>{p.done}/{p.total} done · {p.overdue} overdue</span></div><div className="progress-track"><div style={{width:`${p.total ? 100*p.done/p.total : 0}%`}}/></div></button>)}
        {!groups.length && <p className="empty-state">No projects yet.</p>}
      </section>
      <section className="surface-card"><div className="section-heading"><div><h2>Team workload</h2><p>Open issues by assignee</p></div></div>
        {owners.map(m => {const count=open.filter(t=>t.assignee_id===m.id).length; return <div className="insight-person" key={m.id}><strong>{m.name}</strong><span>{count} open</span><div className="progress-track"><div style={{width:`${open.length ? count/open.length*100 : 0}%`}}/></div></div>})}
        <div className="insight-person"><strong>Unassigned</strong><span>{unassigned.length} open</span><div className="progress-track"><div style={{width:`${open.length ? unassigned.length/open.length*100 : 0}%`}}/></div></div>
      </section>
    </div>
    <section className="surface-card recent-section"><div className="section-heading"><div><h2>Needs attention</h2><p>Overdue issues first, then urgent work</p></div></div>
      {[...open].sort((a,b) => Number(Boolean(b.due_date && b.due_date<today))-Number(Boolean(a.due_date && a.due_date<today)) || (a.due_date||'9999').localeCompare(b.due_date||'9999')).slice(0,12).map(t => <button key={t.id} className="insight-task" onClick={() => onOpenTask?.(t.id)}><span>FOR-{t.id}</span><strong>{t.title}</strong><span>{projects.find(p=>p.id===t.project_id)?.name||'Project'}</span><span className={t.due_date && t.due_date<today ? 'danger-text' : ''}>{t.due_date||'No due date'}</span></button>)}
      {!open.length && <p className="empty-state">No open issues. Everything is up to date.</p>}
    </section>
  </div>
}
