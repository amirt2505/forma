
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import AdvancedTask from './components/AdvancedTask.jsx'
import Insights from './components/Insights.jsx'
import Milestones from './components/Milestones.jsx'
import SendToInbox from './components/SendToInbox.jsx'
import Messages from './components/Messages.jsx'

const API = 'http://127.0.0.1:8000'
const statuses = [
  { id: 'todo', name: 'Todo', symbol: '○' },
  { id: 'in_progress', name: 'In progress', symbol: '◐' },
  { id: 'done', name: 'Done', symbol: '●' }
]
const priorities = ['urgent', 'high', 'medium', 'low']
const emptyTask = {
  title: '', description: '', project_id: '', priority: 'medium', estimate: '', milestone_id: '',
  due_date: '', assignee_id: '', labels: ''
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const niceDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
const initials = name => (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    inbox: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13h5l2 3h4l2-3h5"/></>,
    list: <><path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/></>,
    check: <><path d="m4 12 5 5L20 6"/></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9H3z"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    down: <path d="m6 9 6 6 6-6"/>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></>,
    panel: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></>,
    moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></>,
    logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 16l4-4-4-4M8 12h10"/></>,
    dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    activity: <path d="M3 12h4l3-8 4 16 3-8h4"/>,
    x: <path d="M5 5l14 14M19 5 5 19"/>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    filter: <><path d="M3 5h18M7 12h10M10 19h4"/></>,
    comment: <path d="M21 11a8 8 0 0 1-8 8H5l-2 3V11a9 9 0 1 1 18 0z"/>,
    bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7z"/>
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.grid}</svg>
}

function Avatar({ name, size = '' }) {
  return <span className={`avatar ${size}`} title={name || 'Unassigned'}>{initials(name)}</span>
}

function Priority({ value }) {
  return <span className={`priority priority-${value}`}>{value === 'urgent' ? '◆' : value === 'high' ? '▲' : value === 'medium' ? '◈' : '▽'} <span>{value}</span></span>
}

function Status({ value }) {
  const s = statuses.find(x => x.id === value) || statuses[0]
  return <span className={`status status-${value}`}>{s.symbol} <span>{s.name}</span></span>
}

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('forma_token') || '')
  const [user, setUser] = useState(null)
  const [auth, setAuth] = useState({ name: '', email: '', password: '' })
  const [signup, setSignup] = useState(false)
  const [teams, setTeams] = useState([])
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState({})
  const [notifications, setNotifications] = useState([])
  const [savedViews, setSavedViews] = useState([])
  const [page, setPage] = useState('overview')
  const [inboxFilter, setInboxFilter] = useState('unread')
  const [projectTab, setProjectTab] = useState('overview')
  const [projectId, setProjectId] = useState('all')
  const [view, setView] = useState('board')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('forma_theme') || 'dark')
  const [command, setCommand] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyTask)
  const [nameForm, setNameForm] = useState({ name: '', description: '', team_id: '' })
  const [memberForm, setMemberForm] = useState({ email: '', role: 'member' })
  const [detail, setDetail] = useState(null)
  const [comment, setComment] = useState('')
  const [subtask, setSubtask] = useState('')
  const [month, setMonth] = useState(new Date())
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(Boolean(token))
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')

  async function api(path, method = 'GET', body = null, t = token) {
    const response = await fetch(API + path, {
      method,
      headers: {
        ...(body !== null ? { 'Content-Type': 'application/json' } : {}),
        ...(t ? { Authorization: `Bearer ${t}` } : {})
      },
      ...(body !== null ? { body: JSON.stringify(body) } : {})
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : `Request failed: ${response.status}`)
    return result
  }

  async function refresh(t = token) {
    const [u, a, b, c, d] = await Promise.all([
      api('/me', 'GET', null, t),
      api('/teams', 'GET', null, t),
      api('/projects', 'GET', null, t),
      api('/tasks', 'GET', null, t),
      api('/notifications', 'GET', null, t)
    ])
    setUser(u); setTeams(a); setProjects(b); setTasks(c); setNotifications(d)
    setSavedViews(await api('/saved-views', 'GET', null, t))
    const allMembers = await Promise.all(a.map(async team => [team.id, await api(`/teams/${team.id}/members`, 'GET', null, t)]))
    setMembers(Object.fromEntries(allMembers))
    setLoading(false)
  }

  useEffect(() => {
    if (token) refresh(token).catch(e => {
      setLoading(false)
      setError(e.message)
      if (/expired|invalid token|401/i.test(e.message)) logout()
    })
  }, [token])

  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setCommand(v => !v)
      }
      if (e.key === 'Escape') {
        setCommand(false); setModal(null); setDetail(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('forma_theme', theme)
  }, [theme])

  async function run(action) {
    setBusy(true); setError('')
    try { await action() } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  function logout() {
    sessionStorage.removeItem('forma_token')
    setToken(''); setUser(null); setDetail(null); setTeams([]); setProjects([]); setTasks([]); setMembers({}); setNotifications([]); setSavedViews([]); setLoading(false)
  }

  async function signIn(e) {
    e.preventDefault()
    await run(async () => {
      if (signup) await api('/register', 'POST', auth, '')
      const result = await api('/login', 'POST', { email: auth.email, password: auth.password }, '')
      sessionStorage.setItem('forma_token', result.access_token)
      setToken(result.access_token)
    })
  }

  const teamName = id => teams.find(x => x.id === id)?.name || 'Workspace'
  const projectName = id => projects.find(x => x.id === id)?.name || 'Unknown project'
  const person = id => Object.values(members).flat().find(x => x.id === id)?.name || (id === user?.id ? user.name : 'Unassigned')
  const writable = teamId => {
    const team = teams.find(x => x.id === teamId)
    return team?.owner_id === user?.id || (members[teamId] || []).some(m => m.id === user?.id && m.role !== 'viewer')
  }
  const canEditTask = t => writable(projects.find(p => p.id === t.project_id)?.team_id)
  const unread = notifications.filter(n => !n.is_read).length
  const done = tasks.filter(t => t.status === 'done').length
  const overdue = tasks.filter(t => t.due_date && t.due_date < today() && t.status !== 'done').length
  const myTasks = tasks.filter(t => t.assignee_id === user?.id && t.status !== 'done')
  const completion = tasks.length ? Math.round(done / tasks.length * 100) : 0

  const visible = useMemo(() => tasks.filter(t => {
    if (page === 'mytasks' && t.assignee_id !== user?.id) return false
    if (page === 'issues' && projectId !== 'all' && t.project_id !== Number(projectId)) return false
    if (filter !== 'all' && t.priority !== filter) return false
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    return `${t.title} ${t.description || ''} ${t.labels || ''} ${projects.find(p => p.id === t.project_id)?.name || ''}`.toLowerCase().includes(query.toLowerCase())
  }).sort((a, b) => {
    if (sort === 'priority') return priorities.indexOf(a.priority) - priorities.indexOf(b.priority)
    if (sort === 'due') return (a.due_date || '9999').localeCompare(b.due_date || '9999')
    return b.id - a.id
  }), [tasks, page, projectId, filter, statusFilter, query, sort, projects, user])

  function go(next, id = null) {
    if (next === 'issues' && id !== null && id !== 'all' && String(id) !== projectId) setProjectTab('overview')
    if (next === 'issues' && id === 'all') setProjectTab('issues')
    if (next === 'issues' && id === null) setProjectId('all')
    setPage(next)
    if (id !== null) setProjectId(String(id))
    setCommand(false)
  }

  function newTask(pid = '') {
    const contextId = page === 'issues' && projectId !== 'all' ? projectId : ''
    const requested = String(pid || contextId)
    const available = projects.filter(p => writable(p.team_id))
    setForm({ ...emptyTask, project_id: available.some(p => String(p.id) === requested) ? requested : available.length === 1 ? String(available[0].id) : '' })
    setModal({ type: 'task', id: null })
  }

  function editTask(t) {
    setForm({ ...t, due_date: t.due_date || '', assignee_id: t.assignee_id || '', labels: t.labels || '', estimate: t.estimate ?? '', milestone_id: t.milestone_id || '' })
    setModal({ type: 'task', id: t.id })
  }

  function named(type, item = null) {
    setNameForm({ name: item?.name || '', description: item?.description || '', team_id: String(item?.team_id || '') })
    setModal({ type, id: item?.id || null })
  }

  async function saveTask(e) {
    e.preventDefault()
    await run(async () => {
      const body = {
        title: form.title.trim(), description: form.description,
        priority: form.priority, due_date: form.due_date || null,
        assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
        labels: form.labels, estimate: form.estimate === '' ? null : Number(form.estimate),
        milestone_id: form.milestone_id ? Number(form.milestone_id) : null
      }
      if (!modal.id) body.project_id = Number(form.project_id)
      const saved = await api(`/tasks${modal.id ? '/' + modal.id : ''}`, modal.id ? 'PATCH' : 'POST', body)
      const edited = modal.id
      setModal(null); await refresh()
      if (detail && edited === detail.task.id) await openTask(edited)
      else if (!edited && saved?.id) await openTask(saved.id)
    })
  }

  async function saveNamed(e) {
    e.preventDefault()
    await run(async () => {
      const path = modal.type === 'team' ? 'teams' : 'projects'
      const body = { name: nameForm.name.trim(), description: nameForm.description }
      if (modal.type === 'project' && !modal.id) body.team_id = Number(nameForm.team_id)
      await api(`/${path}${modal.id ? '/' + modal.id : ''}`, modal.id ? 'PATCH' : 'POST', body)
      setModal(null); await refresh()
    })
  }

  async function remove(type, id) {
    if (!window.confirm(`Permanently delete this ${type.slice(0, -1)}${type === 'teams' || type === 'projects' ? ' and all its related work' : ''}?`)) return
    await run(async () => {
      await api(`/${type}/${id}`, 'DELETE')
      if (type === 'tasks') setDetail(null)
      if (type === 'projects' && String(id) === projectId) go('projects')
      await refresh()
    })
  }

  async function statusChange(id, status) {
    await run(async () => {
      await api(`/tasks/${id}/status`, 'PATCH', { status })
      await refresh()
      if (detail?.task.id === id) await openTask(id)
    })
  }

  async function openTask(id) {
    try { setDetail(await api(`/tasks/${id}/details`)) }
    catch (e) { setError(e.message) }
  }

  async function addSubtask(e) {
    e.preventDefault()
    await run(async () => {
      await api(`/tasks/${detail.task.id}/subtasks`, 'POST', { title: subtask })
      setSubtask(''); await openTask(detail.task.id)
    })
  }

  async function toggleSubtask(s) {
    await run(async () => {
      await api(`/tasks/${detail.task.id}/subtasks/${s.id}`, 'PATCH', { completed: !s.completed })
      await openTask(detail.task.id)
    })
  }

  async function addComment(e) {
    e.preventDefault()
    await run(async () => {
      await api(`/tasks/${detail.task.id}/comments`, 'POST', { body: comment })
      setComment(''); await openTask(detail.task.id); await refresh()
    })
  }

  async function addMember(e) {
    e.preventDefault()
    await run(async () => {
      await api(`/teams/${modal.id}/members`, 'POST', memberForm)
      setMemberForm({ email: '', role: 'member' })
      await refresh()
    })
  }

  async function roleChange(teamId, memberId, role) {
    await run(async () => {
      await api(`/teams/${teamId}/members/${memberId}`, 'PATCH', { role })
      await refresh()
    })
  }

  async function removeMember(teamId, memberId) {
    if (!window.confirm('Remove this member?')) return
    await run(async () => {
      await api(`/teams/${teamId}/members/${memberId}`, 'DELETE')
      await refresh()
    })
  }

  async function readNotification(n) {
    await run(async () => {
      await api(`/notifications/${n.id}/read`, 'PATCH')
      await refresh()
      if (n.task_id) await openTask(n.task_id)
    })
  }

  function IssueRow({ task }) {
    return <button className="issue-row" onClick={() => openTask(task.id)}>
      <span className="issue-number">FOR-{task.id}</span>
      <Status value={task.status}/>
      <span className="issue-title">{task.title}</span>
      <span className="issue-project">{projectName(task.project_id)}</span>
      <Priority value={task.priority}/>
      <Avatar name={task.assignee_id ? person(task.assignee_id) : '?' } size="small"/>
      <span className="issue-date">{niceDate(task.due_date)}</span>
    </button>
  }

  function TaskCard({ task }) {
    return <div className="task-card" role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTask(task.id) } }} draggable={canEditTask(task)}
      onDragStart={e => e.dataTransfer.setData('text/plain', String(task.id))}
      onClick={() => openTask(task.id)}>
      <div className="task-card-top"><span>FOR-{task.id}</span><Priority value={task.priority}/></div>
      <h3>{task.title}</h3>
      {task.description && <p>{task.description}</p>}
      <div className="task-card-footer">
        <span className="project-chip">{projectName(task.project_id)}</span>
        <span className={task.due_date && task.due_date < today() && task.status !== 'done' ? 'late' : ''}>{niceDate(task.due_date)}</span>
        <Avatar name={task.assignee_id ? person(task.assignee_id) : '?'} size="small"/>
      </div>
      {task.labels && <div className="task-labels">{task.labels.split(',').filter(Boolean).map((l, i) => <span key={i}>{l.trim()}</span>)}</div>}
    </div>
  }

  const nav = [
    { id: 'overview', label: 'Home', icon: 'grid' },
    { id: 'mytasks', label: 'My Work', icon: 'check' },
    { id: 'issues', label: 'All Issues', icon: 'list' },
    { id: 'inbox', label: 'Inbox', icon: 'inbox', count: unread },
    { id: 'messages', label: 'Messages', icon: 'comment' },
    { id: 'insights', label: 'Insights', icon: 'activity' }
  ]

  const monthYear = month.getFullYear()
  const monthIndex = month.getMonth()
  const offset = (new Date(monthYear, monthIndex, 1).getDay() + 6) % 7
  const totalDays = new Date(monthYear, monthIndex + 1, 0).getDate()
  const calendarCells = [...Array(offset).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)]
  while (calendarCells.length % 7) calendarCells.push(null)

  if (!token) return <div className="auth-screen">
    <div className="auth-art"><div className="auth-logo">◈ <span>forma</span></div><div className="auth-art-content"><div className="eyebrow">THE WORKSPACE FOR FOCUSED TEAMS</div><h1>Make space for<br/><em>great work.</em></h1><p>Plan projects, organize issues, and bring your team's ideas to life.</p><div className="auth-preview"><div className="preview-bar"/><div className="preview-lines"><span/><span/><span/></div></div></div><small>FORMA © 2026</small></div>
    <div className="auth-right"><div className="auth-box"><div className="mobile-brand">◈ forma</div><h2>{signup ? 'Create your account' : 'Welcome back'}</h2><p>{signup ? 'Get started with your workspace.' : 'Sign in to continue to your workspace.'}</p><form onSubmit={signIn} className="form-stack">{signup && <label>Full name<input required value={auth.name} onChange={e => setAuth({ ...auth, name: e.target.value })}/></label>}<label>Email<input type="email" required value={auth.email} onChange={e => setAuth({ ...auth, email: e.target.value })}/></label><label>Password<input type="password" minLength={8} required value={auth.password} onChange={e => setAuth({ ...auth, password: e.target.value })}/></label><button className="btn primary wide" disabled={busy}>{signup ? 'Create account' : 'Continue'} <Icon name="arrow" size={16}/></button></form><button className="auth-toggle" onClick={() => { setSignup(!signup); setError('') }}>{signup ? 'Already have an account? Sign in' : "New to Forma? Create an account"}</button>{error && <div className="error">{error}</div>}</div></div>
  </div>

  if (loading) return <div className="auth-screen"><div className="auth-right"><div className="auth-box"><h2>Loading Forma…</h2><p>Getting your workspace ready.</p></div></div></div>

  return <div className={`shell ${collapsed ? 'collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="workspace-head"><div className="workspace-logo">◈</div><div className="workspace-name"><strong>Forma</strong><small>Workspace</small></div><button className="icon-button collapse-button" title="Collapse sidebar" onClick={() => setCollapsed(!collapsed)}><Icon name="panel"/></button></div>
      <button className="sidebar-search" onClick={() => setCommand(true)}><Icon name="search"/><span>Search anything</span><kbd>Ctrl K</kbd></button>
      <div className="nav-group">{nav.map(n => <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} title={n.label} onClick={() => go(n.id)}><Icon name={n.icon}/><span>{n.label}</span>{n.count > 0 && <b>{n.count}</b>}</button>)}</div>
      <div className="nav-label"><span>WORKSPACE</span><button title="New team" onClick={() => named('team')}><Icon name="plus" size={15}/></button></div>
      <div className="nav-group"><button className={`nav-item ${page === 'projects' ? 'active' : ''}`} onClick={() => go('projects')}><Icon name="folder"/><span>Projects</span></button><button className={`nav-item ${page === 'teams' ? 'active' : ''}`} onClick={() => go('teams')}><Icon name="users"/><span>Teams</span></button></div>
      <div className="nav-label"><span>YOUR PROJECTS</span><button title="New project" onClick={() => named('project')}><Icon name="plus" size={15}/></button></div>
      <div className="project-nav">{projects.map((p, i) => <button key={p.id} title={p.name} className={`nav-item ${page === 'issues' && projectId === String(p.id) ? 'active' : ''}`} onClick={() => go('issues', p.id)}><span className={`project-marker marker-${i % 5}`}/><span>{p.name}</span></button>)}</div>
      <div className="nav-label"><span>SAVED VIEWS</span><button title="Save current issue view" onClick={() => run(async () => { const name = window.prompt('Name this view'); if (!name?.trim()) return; await api('/saved-views', 'POST', { name: name.trim(), project_id: projectId === 'all' ? null : Number(projectId), priority: filter, search: query, layout: view }); await refresh() })}><Icon name="plus" size={15}/></button></div>
      <div className="project-nav">{savedViews.map(v => <div className="saved-view-row" key={v.id}><button className="nav-item" onClick={() => { go('issues', v.project_id ? String(v.project_id) : 'all'); setProjectTab('issues'); setFilter(v.priority || 'all'); setStatusFilter('all'); setQuery(v.search || ''); setView(v.layout || 'board') }}><Icon name="filter" size={15}/><span>{v.name}</span></button><button className="icon-button" title="Delete view" onClick={() => run(async () => { await api(`/saved-views/${v.id}`, 'DELETE'); await refresh() })}><Icon name="x" size={13}/></button></div>)}</div>
      <div className="sidebar-footer"><button className="nav-item" title="Switch theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'}/><span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button><button className="nav-item" title="Sign out" onClick={logout}><Icon name="logout"/><span>Sign out</span></button><div className="user-profile"><Avatar name={user?.name}/><div><strong>{user?.name || 'Loading...'}</strong><small>{user?.email}</small></div></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><button onClick={() => go('overview')}>Workspace</button><Icon name="chevron" size={14}/><strong>{page === 'overview' ? 'Home' : page === 'mytasks' ? 'My Work' : page === 'issues' ? (projectId === 'all' ? 'All issues' : projectName(Number(projectId))) : page === 'inbox' ? 'Inbox' : page === 'messages' ? 'Messages' : page === 'insights' ? 'Insights' : page === 'milestones' ? 'Milestones' : page === 'projects' ? 'Projects' : 'Teams'}</strong></div><div className="header-actions"><button className="icon-button" title="Search" onClick={() => setCommand(true)}><Icon name="search"/></button><button className="icon-button" title="Inbox" onClick={() => go('inbox')}><Icon name="inbox"/>{unread > 0 && <i className="unread-dot"/>}</button><button className="btn primary" disabled={!projects.some(p => writable(p.team_id))} onClick={() => newTask()}><Icon name="plus" size={16}/> New issue</button><Avatar name={user?.name} size="small"/></div></header>
      {error && <div className="error-banner">{error}<button onClick={() => setError('')}><Icon name="x" size={16}/></button></div>}

      {page === 'overview' && <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">YOUR DAILY BRIEFING</div><h1>Good to see you, {user?.name?.split(' ')[0]}.</h1><p>Start with what needs your attention, then get back to building.</p></div><span className="date-pill"><Icon name="calendar" size={15}/>{new Date().toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric'})}</span></div>
        <div className="stat-grid">
          <button className="stat-card forma-action-stat" onClick={() => go('mytasks')}><div className="stat-top"><span>My open work</span><Icon name="check"/></div><strong>{myTasks.length}</strong><small>Open your personal plan →</small></button>
          <button className="stat-card forma-action-stat" onClick={() => go('mytasks')}><div className="stat-top"><span>My overdue issues</span><Icon name="clock"/></div><strong className={myTasks.some(t=>t.due_date && t.due_date<today())?'danger-text':''}>{myTasks.filter(t=>t.due_date && t.due_date<today()).length}</strong><small>Review deadlines →</small></button>
          <button className="stat-card forma-action-stat" onClick={() => go('inbox')}><div className="stat-top"><span>Unread updates</span><Icon name="inbox"/></div><strong>{unread}</strong><small>Process your inbox →</small></button>
          <button className="stat-card forma-action-stat" onClick={() => go('projects')}><div className="stat-top"><span>Active projects</span><Icon name="folder"/></div><strong>{projects.length}</strong><small>Open project workspaces →</small></button>
        </div>
        <section className="surface-card recent-section"><div className="section-heading"><div><h2>Needs attention</h2><p>Your overdue and upcoming issues, ordered by due date</p></div><button className="text-button" onClick={() => go('mytasks')}>Plan my work <Icon name="arrow" size={14}/></button></div><div className="issue-table">{myTasks.filter(t=>t.due_date).slice().sort((a,b)=>a.due_date.localeCompare(b.due_date)).slice(0,8).map(t=><IssueRow key={t.id} task={t}/>)}</div>{!myTasks.some(t=>t.due_date) && <div className="empty-state">No dated issues need your attention. Open My Work to review everything assigned to you.</div>}</section>
        <section className="surface-card recent-section"><div className="section-heading"><div><h2>What to do next</h2><p>Pick a clear next action</p></div></div><div className="forma-next-actions"><button className="btn secondary" onClick={()=>go('mytasks')}>Review my assignments</button><button className="btn secondary" onClick={()=>go('inbox')}>Check updates {unread>0?`(${unread})`:''}</button><button className="btn secondary" onClick={()=>go('projects')}>Open a project</button><button className="btn primary" disabled={!projects.some(p=>writable(p.team_id))} onClick={()=>newTask()}>Create issue</button></div></section>
      </div>}

      {page === 'mytasks' && <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">PERSONAL PLANNER</div><h1>My Work</h1><p>Your commitments, organized by when they need to happen.</p></div><button className="btn primary" onClick={()=>newTask()} disabled={!projects.some(p=>writable(p.team_id))}><Icon name="plus" size={16}/> New issue</button></div>
        <div className="forma-personal-summary"><span>{myTasks.length} open</span><span>{myTasks.filter(t=>t.due_date && t.due_date<today()).length} overdue</span><span>{myTasks.filter(t=>t.due_date===today()).length} due today</span></div>
        {[
          {label:'Overdue',hint:'Past their due date',items:myTasks.filter(t=>t.due_date && t.due_date<today())},
          {label:'Today',hint:'Due today',items:myTasks.filter(t=>t.due_date===today())},
          {label:'Upcoming',hint:'Scheduled for later',items:myTasks.filter(t=>t.due_date && t.due_date>today()).sort((a,b)=>a.due_date.localeCompare(b.due_date))},
          {label:'Unscheduled',hint:'No due date yet',items:myTasks.filter(t=>!t.due_date)},
          {label:'Recently completed',hint:'Finished issues assigned to you',items:tasks.filter(t=>t.assignee_id===user?.id && t.status==='done').sort((a,b)=>b.id-a.id).slice(0,10)}
        ].map(group=><section className="surface-card forma-work-group" key={group.label}><div className="section-heading"><div><h2>{group.label} <span className="count-pill">{group.items.length}</span></h2><p>{group.hint}</p></div></div>{group.items.length?<div className="issue-table">{group.items.map(t=><IssueRow key={t.id} task={t}/>)}</div>:<div className="forma-group-empty">Nothing here right now.</div>}</section>)}
      </div>}

      {page === 'issues' && projectId !== 'all' && <div className="page-content project-workspace">
        <div className="eyebrow">PROJECT WORKSPACE · {teamName(projects.find(p => String(p.id) === projectId)?.team_id)}</div>
        <div className="page-heading"><div><h1>{projectName(Number(projectId))}</h1><p>{projects.find(p => String(p.id) === projectId)?.description || 'Everything for this project, in one place.'}</p></div><button className="btn primary" disabled={!writable(projects.find(p => String(p.id) === projectId)?.team_id)} onClick={() => newTask(projectId)}><Icon name="plus" size={16}/> New issue</button></div>
        <div className="project-workspace-tabs">
          {['overview','issues','milestones','activity'].map(tab => <button key={tab} className={projectTab === tab ? 'active' : ''} onClick={() => setProjectTab(tab)}>{tab.charAt(0).toUpperCase()+tab.slice(1)}</button>)}
        </div>
        {projectTab === 'overview' && (() => { const pt=tasks.filter(t=>String(t.project_id)===projectId); const finished=pt.filter(t=>t.status==='done').length; const active=pt.filter(t=>t.status==='in_progress').length; const late=pt.filter(t=>t.due_date && t.due_date<today() && t.status!=='done').length; return <>
          <div className="stat-grid"><div className="stat-card"><div className="stat-top">Total issues</div><strong>{pt.length}</strong></div><div className="stat-card"><div className="stat-top">In progress</div><strong>{active}</strong></div><div className="stat-card"><div className="stat-top">Completed</div><strong>{finished}</strong></div><div className="stat-card"><div className="stat-top">Overdue</div><strong className={late?'danger-text':''}>{late}</strong></div></div>
          <section className="surface-card recent-section"><div className="section-heading"><div><h2>Open issues</h2><p>Keep the most important work moving</p></div><button className="text-button" onClick={()=>setProjectTab('issues')}>View issues <Icon name="arrow" size={14}/></button></div><div className="issue-table">{pt.filter(t=>t.status!=='done').sort((a,b)=>priorities.indexOf(a.priority)-priorities.indexOf(b.priority)).slice(0,8).map(t=><IssueRow key={t.id} task={t}/>)}</div>{!pt.some(t=>t.status!=='done') && <div className="empty-state">No open issues. Add one to get started.</div>}</section>
        </> })()}
        {projectTab === 'activity' && <section className="surface-card"><div className="section-heading"><div><h2>Issue history</h2><p>Choose an issue to see its recorded changes and comments</p></div></div><div className="issue-table">{tasks.filter(t=>String(t.project_id)===projectId).sort((a,b)=>b.id-a.id).slice(0,15).map(t=><IssueRow key={t.id} task={t}/>)}</div><p className="muted activity-hint">Open an issue to see its complete activity history and comments.</p></section>}
      </div>}
      {page === 'issues' && projectId !== 'all' && projectTab === 'milestones' &&
        <Milestones key={projectId} api={api} projects={projects.filter(p => String(p.id) === projectId)} writable={writable} selectedProjectId={projectId} />}
      {page === 'issues' && (projectId === 'all' || projectTab === 'issues') && <div className="page-content issues-page">
        {(page === 'mytasks' || projectId === 'all') && <div className="page-heading"><div><div className="eyebrow">WORKSPACE TRIAGE</div><h1>All issues</h1><p>{visible.length} matching issues across your workspace. Search, filter and update work here.</p></div><button className="btn primary" onClick={() => newTask()} disabled={!projects.some(p => writable(p.team_id))}><Icon name="plus" size={16}/> Create issue</button></div>}
        <div className="issue-toolbar"><div className="view-tabs">{[{ id: 'board', name: 'Board', icon: 'grid' }, { id: 'list', name: 'List', icon: 'list' }, { id: 'calendar', name: 'Calendar', icon: 'calendar' }].map(v => <button key={v.id} className={view === v.id ? 'active' : ''} onClick={() => setView(v.id)}><Icon name={v.icon} size={15}/>{v.name}</button>)}</div><div className="toolbar-controls"><div className="search-field"><Icon name="search" size={15}/><input placeholder="Search issues" value={query} onChange={e => setQuery(e.target.value)}/></div><select aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">All statuses</option>{statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All priorities</option>{priorities.map(p => <option key={p} value={p}>{p}</option>)}</select><select value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest</option><option value="priority">Priority</option><option value="due">Due date</option></select></div></div>
        {page === 'issues' && <div className="project-filter"><select value={projectId} onChange={e => { setProjectId(e.target.value); if (e.target.value !== 'all') setProjectTab('overview') }}><option value="all">All projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
        {view === 'board' && <div className="kanban">{statuses.map(s => <div key={s.id} className="kanban-column" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const id = Number(e.dataTransfer.getData('text/plain')); if (id && tasks.some(t => t.id === id && canEditTask(t))) statusChange(id, s.id) }}><div className="kanban-heading"><Status value={s.id}/><span className="count-pill">{visible.filter(t => t.status === s.id).length}</span><button className="icon-button" title={`Create ${s.name.toLowerCase()} issue`} onClick={() => newTask(page === 'issues' && projectId !== 'all' ? projectId : '')}><Icon name="plus" size={16}/></button></div><div className="kanban-cards">{visible.filter(t => t.status === s.id).map(t => <TaskCard key={t.id} task={t}/>)}{!visible.some(t => t.status === s.id) && <div className="drop-hint">Drop issues here</div>}</div></div>)}</div>}
        {view === 'list' && <div className="surface-card issue-list"><div className="table-heading"><span>Issue</span><span>Status</span><span>Title</span><span>Project</span><span>Priority</span><span>Owner</span><span>Due</span></div>{visible.map(t => <IssueRow key={t.id} task={t}/>)}{!visible.length && <div className="empty-state">No matching issues.</div>}</div>}
        {view === 'calendar' && <div className="surface-card calendar"><div className="calendar-heading"><button className="icon-button" onClick={() => setMonth(new Date(monthYear, monthIndex - 1, 1))}>‹</button><h2>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2><button className="icon-button" onClick={() => setMonth(new Date(monthYear, monthIndex + 1, 1))}>›</button></div><div className="calendar-grid">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div className="weekday" key={d}>{d}</div>)}{calendarCells.map((day, i) => <div className="calendar-cell" key={i}>{day && <><span>{day}</span>{visible.filter(t => t.due_date === `${monthYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`).map(t => <button key={t.id} onClick={() => openTask(t.id)}>{t.title}</button>)}</>}</div>)}</div></div>}
      </div>}

      {page === 'projects' && <div className="page-content"><div className="page-heading"><div><div className="eyebrow">ORGANIZE YOUR WORK</div><h1>Projects</h1><p>Track every initiative in one place.</p></div><button className="btn primary" onClick={() => named('project')}><Icon name="plus" size={16}/> New project</button></div><div className="entity-grid">{projects.map((p, i) => { const pt = tasks.filter(t => t.project_id === p.id); const value = pt.length ? Math.round(pt.filter(t => t.status === 'done').length / pt.length * 100) : 0; return <div className="entity-card" key={p.id}><div className="entity-top"><span className={`entity-icon marker-${i % 5}`}><Icon name="folder"/></span><span className="entity-menu"><button onClick={() => named('project', p)} disabled={!writable(p.team_id)}>Edit</button></span></div><h2>{p.name}</h2><p>{p.description || 'No description added.'}</p><small>{teamName(p.team_id)}</small><div className="entity-progress"><div><span>{pt.length} issues</span><span>{value}% complete</span></div><div className="progress-track"><div style={{ width: `${value}%` }}/></div></div><div className="entity-actions"><button onClick={() => go('issues', p.id)}>Open project <Icon name="arrow" size={14}/></button>{writable(p.team_id) && <button className="danger-link" onClick={() => remove('projects', p.id)}>Delete</button>}</div></div> })}</div>{!projects.length && <div className="empty-state">Create a team, then create your first project.</div>}</div>}

      {page === 'teams' && <div className="page-content"><div className="page-heading"><div><div className="eyebrow">COLLABORATION</div><h1>Teams</h1><p>Bring the right people together.</p></div><button className="btn primary" onClick={() => named('team')}><Icon name="plus" size={16}/> New team</button></div><div className="entity-grid">{teams.map((t, i) => <div className="entity-card" key={t.id}><div className="entity-top"><span className={`entity-icon marker-${i % 5}`}><Icon name="users"/></span><span className="role-badge">{t.owner_id === user?.id ? 'Owner' : 'Member'}</span></div><h2>{t.name}</h2><p>{t.description || 'No description added.'}</p><small>{(members[t.id] || []).length} members · {projects.filter(p => p.team_id === t.id).length} projects</small><div className="avatar-stack">{(members[t.id] || []).slice(0, 6).map(m => <Avatar key={m.id} name={m.name} size="small"/>)}</div><div className="entity-actions"><button onClick={() => setModal({ type: 'members', id: t.id })}>Manage members <Icon name="arrow" size={14}/></button>{t.owner_id === user?.id && <><button onClick={() => named('team', t)}>Edit</button><button className="danger-link" onClick={() => remove('teams', t.id)}>Delete</button></>}</div></div>)}</div>{!teams.length && <div className="empty-state">Create your first team to get started.</div>}</div>}

      {page === 'messages' && <Messages api={api} currentUserId={user?.id}/>}
      {page === 'inbox' && <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">ACTION CENTER</div><h1>Inbox</h1><p>{unread ? `${unread} unread notifications` : "You're all caught up."}</p></div></div>
        <div className="view-tabs inbox-tabs">
          <button className={inboxFilter === 'unread' ? 'active' : ''} onClick={() => setInboxFilter('unread')}>Unread ({unread})</button>
          <button className={inboxFilter === 'all' ? 'active' : ''} onClick={() => setInboxFilter('all')}>All activity ({notifications.length})</button>
        </div>
        <div className="surface-card inbox-list">
          {notifications.filter(n => inboxFilter === 'all' || !n.is_read).map(n =>
            <button className={`inbox-item ${n.is_read ? '' : 'unread'}`} key={n.id} onClick={() => readNotification(n)}>
              <span className="inbox-symbol"><Icon name="bolt"/></span>
              <div><strong>{n.message}</strong><small>{new Date(n.created_at).toLocaleString()} · {n.task_id ? `Open issue FOR-${n.task_id}` : 'Mark as read'}</small></div>
              {!n.is_read && <span className="inbox-unread"/>}
            </button>)}
          {!notifications.some(n => inboxFilter === 'all' || !n.is_read) && <div className="empty-state">{inboxFilter === 'unread' ? 'All caught up. No unread notifications.' : 'No notifications yet.'}</div>}
        </div>
      </div>}
      {page === 'insights' && <Insights tasks={tasks} projects={projects} members={members} onOpenTask={openTask} onOpenProject={id => go('issues', id)}/>}
    </main>

    {command && <div className="overlay command-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setCommand(false) }}><div className="command-box"><div className="command-input"><Icon name="search"/><input autoFocus placeholder="Search pages, projects, and issues..." value={commandQuery} onChange={e => setCommandQuery(e.target.value)}/><kbd>ESC</kbd></div><div className="command-results"><div className="command-label">NAVIGATE</div>{nav.filter(n => n.label.toLowerCase().includes(commandQuery.toLowerCase())).map(n => <button key={n.id} onClick={() => go(n.id)}><Icon name={n.icon}/>{n.label}<Icon name="arrow" size={14}/></button>)}<div className="command-label">PROJECTS</div>{projects.filter(p => p.name.toLowerCase().includes(commandQuery.toLowerCase())).slice(0, 6).map(p => <button key={p.id} onClick={() => go('issues', p.id)}><Icon name="folder"/>{p.name}<Icon name="arrow" size={14}/></button>)}<div className="command-label">ISSUES</div>{tasks.filter(t => t.title.toLowerCase().includes(commandQuery.toLowerCase())).slice(0, 8).map(t => <button key={t.id} onClick={() => { setCommand(false); openTask(t.id) }}><Icon name="list"/>FOR-{t.id} · {t.title}<Icon name="arrow" size={14}/></button>)}</div><div className="command-footer">Tip: Press Ctrl+K to open search anywhere</div></div></div>}

    {modal && <div className="overlay modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModal(null) }}><div className="modal-box"><div className="modal-heading"><div><span className="eyebrow">FORMA WORKSPACE</span><h2>{modal.type === 'members' ? 'Team members' : `${modal.id ? 'Edit' : 'Create'} ${modal.type === 'task' ? 'issue' : modal.type}`}</h2></div><button className="icon-button" onClick={() => setModal(null)}><Icon name="x"/></button></div>
      {modal.type === 'task' && <form className="form-stack" onSubmit={saveTask}><label>Issue title<input required maxLength={100} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?"/></label><label>Description<textarea rows="4" maxLength={500} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Add details about this issue..."/></label>{!modal.id && <label>Project<select required value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value, assignee_id: '' })}><option value="">Select project</option>{projects.filter(p => writable(p.team_id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}<div className="form-columns"><label>Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{priorities.map(p => <option key={p}>{p}</option>)}</select></label><label>Due date<input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}/></label></div><label>Assignee<select value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })}><option value="">Unassigned</option>{(members[projects.find(p => p.id === Number(form.project_id))?.team_id] || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Effort estimate (points)<input type="number" min="0" max="1000" value={form.estimate ?? ''} onChange={e => setForm({ ...form, estimate: e.target.value })}/></label><label>Labels<input maxLength={500} placeholder="frontend, bug, design" value={form.labels} onChange={e => setForm({ ...form, labels: e.target.value })}/></label><div className="form-actions"><button type="button" className="btn secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn primary" disabled={busy || (!modal.id && !form.project_id)}>Save issue</button></div></form>}
      {(modal.type === 'team' || modal.type === 'project') && <form className="form-stack" onSubmit={saveNamed}><label>Name<input required maxLength={100} value={nameForm.name} onChange={e => setNameForm({ ...nameForm, name: e.target.value })}/></label><label>Description<textarea maxLength={500} rows="3" value={nameForm.description} onChange={e => setNameForm({ ...nameForm, description: e.target.value })}/></label>{modal.type === 'project' && !modal.id && <label>Team<select required value={nameForm.team_id} onChange={e => setNameForm({ ...nameForm, team_id: e.target.value })}><option value="">Select team</option>{teams.filter(t => writable(t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}<div className="form-actions"><button type="button" className="btn secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn primary" disabled={busy}>Save</button></div></form>}
      {modal.type === 'members' && <div className="members-panel"><p className="muted">{teamName(modal.id)}</p>{(members[modal.id] || []).map(m => <div className="member-row" key={m.id}><Avatar name={m.name}/><div><strong>{m.name}</strong><small>{m.email}</small></div>{m.role === 'owner' || teams.find(t => t.id === modal.id)?.owner_id !== user?.id ? <span className="role-badge">{m.role}</span> : <><select value={m.role} onChange={e => roleChange(modal.id, m.id, e.target.value)}><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option></select><button className="danger-link" onClick={() => removeMember(modal.id, m.id)}>Remove</button></>}</div>)}{teams.find(t => t.id === modal.id)?.owner_id === user?.id && <form className="form-stack member-add" onSubmit={addMember}><label>Add registered user<input type="email" required placeholder="person@example.com" value={memberForm.email} onChange={e => setMemberForm({ ...memberForm, email: e.target.value })}/></label><select value={memberForm.role} onChange={e => setMemberForm({ ...memberForm, role: e.target.value })}><option value="member">Member</option><option value="admin">Admin</option><option value="viewer">Viewer</option></select><button className="btn primary" disabled={busy}>Add member</button></form>}</div>}
    </div></div>}

    {detail && <div className="overlay drawer-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setDetail(null) }}><div className="task-drawer"><div className="drawer-heading"><div className="breadcrumbs"><span>{projectName(detail.task.project_id)}</span><Icon name="chevron" size={14}/><strong>FOR-{detail.task.id}</strong></div><button className="icon-button" onClick={() => setDetail(null)}><Icon name="x"/></button></div><div className="drawer-body"><div className="drawer-main"><div className="drawer-title"><Status value={detail.task.status}/><h1>{detail.task.title}</h1></div><p className="task-description">{detail.task.description || 'No description provided.'}</p>{canEditTask(detail.task) && <div className="drawer-actions"><button className="btn secondary" onClick={() => editTask(detail.task)}>Edit issue</button><button className="btn danger-button" onClick={() => remove('tasks', detail.task.id)}>Delete</button></div>}<section className="drawer-section"><div className="section-heading"><h2>Subtasks</h2><span className="count-pill">{detail.subtasks.filter(s => s.completed).length}/{detail.subtasks.length}</span></div>{detail.subtasks.map(s => <div className="subtask-row" key={s.id}><input type="checkbox" checked={s.completed} disabled={!canEditTask(detail.task)} onChange={() => toggleSubtask(s)}/><span className={s.completed ? 'completed-text' : ''}>{s.title}</span>{canEditTask(detail.task) && <button className="icon-button" onClick={() => run(async () => { await api(`/tasks/${detail.task.id}/subtasks/${s.id}`, 'DELETE'); await openTask(detail.task.id) })}><Icon name="x" size={14}/></button>}</div>)}{canEditTask(detail.task) && <form className="inline-form" onSubmit={addSubtask}><input required placeholder="Add a subtask..." value={subtask} onChange={e => setSubtask(e.target.value)}/><button className="btn secondary"><Icon name="plus" size={16}/></button></form>}</section><section className="drawer-section"><div className="section-heading"><h2>Comments</h2><Icon name="comment" size={17}/></div>{detail.comments.map(c => <div className="comment-item" key={c.id}><Avatar name={person(c.author_id)} size="small"/><div><div className="comment-meta"><strong>{person(c.author_id)}</strong><small>{new Date(c.created_at).toLocaleString()}</small></div><p>{c.body}</p>{(c.author_id === user?.id || teams.find(t => t.id === projects.find(p => p.id === detail.task.project_id)?.team_id)?.owner_id === user?.id) && <button className="danger-link" onClick={() => run(async () => { await api(`/tasks/${detail.task.id}/comments/${c.id}`, 'DELETE'); await openTask(detail.task.id) })}>Delete</button>}</div></div>)}{canEditTask(detail.task) && <form className="form-stack" onSubmit={addComment}><textarea required rows="3" placeholder="Leave a comment..." value={comment} onChange={e => setComment(e.target.value)}/><button className="btn primary" disabled={busy}>Post comment</button></form>}</section>{canEditTask(detail.task) && <SendToInbox key={`share-${detail.task.id}`} task={detail.task} api={api} projects={projects} members={members} currentUserId={user?.id} onSent={async () => { await refresh(); await openTask(detail.task.id) }}/>}<AdvancedTask key={detail.task.id} task={detail.task} api={api} projects={projects} tasks={tasks} members={members} editable={canEditTask(detail.task)} onChange={async () => { await openTask(detail.task.id); await refresh() }}/><section className="drawer-section"><h2>Activity</h2>{detail.activities.map(a => <div className="activity-row" key={a.id}><span className="activity-dot"/><div><strong>{person(a.actor_id)}</strong> {a.action}<small>{new Date(a.created_at).toLocaleString()}</small></div></div>)}</section></div><aside className="drawer-properties"><h3>Properties</h3><label>Status<select disabled={!canEditTask(detail.task)} value={detail.task.status} onChange={e => statusChange(detail.task.id, e.target.value)}>{statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><div className="property-line"><span>Priority</span><Priority value={detail.task.priority}/></div><div className="property-line"><span>Assignee</span>
  <select aria-label="Assign issue" disabled={!canEditTask(detail.task)} value={detail.task.assignee_id || ''}
    onChange={e => run(async () => {
      const task = detail.task
      await api(`/tasks/${task.id}`, 'PATCH', {
        title: task.title, description: task.description, priority: task.priority,
        due_date: task.due_date, assignee_id: e.target.value ? Number(e.target.value) : null,
        labels: task.labels, estimate: task.estimate, milestone_id: task.milestone_id
      })
      await refresh()
      await openTask(task.id)
    })}>
    <option value="">Unassigned</option>
    {(members[projects.find(p => p.id === detail.task.project_id)?.team_id] || []).map(m =>
      <option key={m.id} value={m.id}>{m.name}</option>)}
  </select>
</div><div className="property-line"><span>Due date</span><strong>{niceDate(detail.task.due_date)}</strong></div><div className="property-line"><span>Labels</span><strong>{detail.task.labels || 'None'}</strong></div></aside></div></div></div>}
  </div>
}
