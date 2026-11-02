import { useEffect, useState } from 'react'

export default function Messages({ api, currentUserId }) {
  const [conversations, setConversations] = useState([])
  const [contacts, setContacts] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [modal, setModal] = useState('')
  const [chosen, setChosen] = useState([])
  const [groupName, setGroupName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const [cs, people] = await Promise.all([api('/messages/conversations'), api('/messages/contacts')])
    setConversations(cs)
    setContacts(people)
  }

  async function open(id) {
    setSelected(id)
    setMessages(await api(`/messages/conversations/${id}/messages`))
    await api(`/messages/conversations/${id}/read`, 'POST')
    await load()
  }

  useEffect(() => { load().catch(e => setError(e.message)) }, [])
  useEffect(() => {
    if (!selected) return
    const timer = setInterval(() => {
      api(`/messages/conversations/${selected}/messages`).then(setMessages).catch(() => {})
      load().catch(() => {})
    }, 5000)
    return () => clearInterval(timer)
  }, [selected])

  const active = conversations.find(c => c.id === selected)
  const person = id => active?.members.find(m => m.id === id)?.name || 'Teammate'

  async function create(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const c = await api('/messages/conversations', 'POST', { user_ids: chosen, title: groupName })
      await load(); await open(c.id)
      setModal(''); setChosen([]); setGroupName('')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function send(e) {
    e.preventDefault()
    if (!draft.trim()) return
    setBusy(true); setError('')
    try {
      await api(`/messages/conversations/${selected}/messages`, 'POST', { body: draft.trim() })
      setDraft(''); await open(selected)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function add(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await api(`/messages/conversations/${selected}/members`, 'POST', { user_ids: chosen })
      await load(); setModal(''); setChosen([])
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function leave() {
    if (!window.confirm('Leave this group?')) return
    try {
      await api(`/messages/conversations/${selected}/leave`, 'POST')
      setSelected(null); setMessages([]); await load()
    } catch (e) { setError(e.message) }
  }

  return <div className="page-content forma-messages-page">
    <div className="page-heading"><div><div className="eyebrow">TEAM COMMUNICATION</div><h1>Messages</h1><p>Talk privately with teammates or create a group.</p></div><button className="btn primary" onClick={() => { setModal('new'); setChosen([]) }}>New conversation</button></div>
    {error && <div className="forma-message-error" role="alert">{error}</div>}
    <div className="forma-messaging-layout">
      <aside className="forma-conversations"><h2>Conversations</h2>
        {!conversations.length && <p className="forma-muted">No conversations yet. Start one with a teammate.</p>}
        {conversations.map(c => <button key={c.id} className={`forma-conversation ${selected === c.id ? 'selected' : ''}`} onClick={() => open(c.id).catch(e => setError(e.message))}>
          <span className="forma-conversation-icon">{c.is_group ? '👥' : '●'}</span><span className="forma-conversation-info"><strong>{c.title}</strong><small>{c.last_message?.body || (c.is_group ? `${c.members.length} members` : 'Say hello')}</small></span>{c.unread > 0 && <b className="forma-unread-count">{c.unread}</b>}
        </button>)}
      </aside>
      <section className="forma-chat">{active ? <>
        <header className="forma-chat-head"><div><h2>{active.title}</h2><p>{active.members.map(m => m.id === currentUserId ? 'You' : m.name).join(', ')}</p></div>
          {active.is_group && <div className="forma-chat-actions"><button className="btn secondary" onClick={() => { setModal('add'); setChosen([]) }}>Add people</button><button className="btn secondary" onClick={async () => { const title = window.prompt('Group name', active.title); if (title?.trim()) { try { await api(`/messages/conversations/${selected}`, 'PATCH', { title: title.trim() }); await load() } catch (e) { setError(e.message) } } }}>Rename</button><button className="btn secondary" onClick={leave}>Leave</button></div>}
        </header>
        <div className="forma-chat-messages" aria-live="polite">{!messages.length && <p className="forma-muted">No messages yet. Say hello!</p>}{messages.map(m => <div key={m.id} className={`forma-chat-bubble ${m.sender_id === currentUserId ? 'mine' : ''}`}><small>{m.sender_id === currentUserId ? 'You' : person(m.sender_id)} · {new Date(m.created_at).toLocaleString()}</small><p>{m.body}</p></div>)}</div>
        <form className="forma-chat-compose" onSubmit={send}><input value={draft} onChange={e => setDraft(e.target.value)} maxLength={5000} placeholder="Write a message…" aria-label="Message"/><button className="btn primary" disabled={!draft.trim() || busy}>Send</button></form>
      </> : <div className="forma-chat-placeholder"><h2>Keep the conversation moving</h2><p>Select a conversation or start a new one.</p></div>}</section>
    </div>
    {modal && <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModal('') }}><form className="forma-message-modal" onSubmit={modal === 'add' ? add : create}>
      <h2>{modal === 'add' ? 'Add people to group' : 'New conversation'}</h2><p>Choose one teammate for a direct message or several for a group.</p>
      {modal === 'new' && chosen.length > 1 && <label>Group name<input value={groupName} maxLength={120} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Design team"/></label>}
      <div className="forma-contact-list">{contacts.filter(p => modal !== 'add' || !active?.members.some(m => m.id === p.id)).map(p => <label key={p.id} className="forma-contact-option"><input type="checkbox" checked={chosen.includes(p.id)} onChange={e => setChosen(ids => e.target.checked ? [...ids, p.id] : ids.filter(id => id !== p.id))}/><span><strong>{p.name}</strong><small>{p.email}</small></span></label>)}</div>
      {!contacts.length && <p className="forma-muted">Add teammates to a team before messaging them.</p>}
      <div className="forma-modal-actions"><button type="button" className="btn secondary" onClick={() => setModal('')}>Cancel</button><button className="btn primary" disabled={!chosen.length || busy}>{modal === 'add' ? 'Add people' : chosen.length > 1 ? 'Create group' : 'Start conversation'}</button></div>
    </form></div>}
  </div>
}
