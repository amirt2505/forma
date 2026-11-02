import { useState } from 'react'

export default function SendToInbox({ task, api, projects, members, currentUserId, onSent }) {
  const [recipientId, setRecipientId] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const project = projects.find(p => p.id === task.project_id)
  const recipients = (members[project?.team_id] || []).filter(m => m.id !== currentUserId)

  async function send(e) {
    e.preventDefault()
    if (!recipientId || sending) return
    setSending(true)
    setFeedback('')
    try {
      await api(`/tasks/${task.id}/send-to-inbox`, 'POST', {
        recipient_id: Number(recipientId), message: message.trim()
      })
      setMessage('')
      setRecipientId('')
      setFeedback('Sent to their inbox.')
      if (onSent) await onSent()
    } catch (err) {
      setFeedback(err.message || 'Could not send the notification.')
    } finally {
      setSending(false)
    }
  }

  return <section className="drawer-section send-to-inbox">
    <h2>Send to Inbox</h2>
    <p className="muted">Share this issue with a teammate who can access this project.</p>
    {recipients.length === 0 ? <p className="muted">Add another registered member to this team to share tasks.</p> :
      <form className="form-stack" onSubmit={send}>
        <label>Recipient
          <select required value={recipientId} onChange={e => setRecipientId(e.target.value)}>
            <option value="">Choose a team member</option>
            {recipients.map(m => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
          </select>
        </label>
        <label>Message (optional)
          <textarea rows="3" maxLength={500} placeholder="Could you review this issue?" value={message} onChange={e => setMessage(e.target.value)} />
        </label>
        <button className="btn primary" disabled={!recipientId || sending} type="submit">{sending ? 'Sending...' : 'Send to Inbox'}</button>
      </form>}
    {feedback && <p role="status" className="send-feedback">{feedback}</p>}
  </section>
}
