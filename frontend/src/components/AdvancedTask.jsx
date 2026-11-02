
import { useEffect, useState } from 'react'

export default function AdvancedTask({ task, api, tasks, projects, members, editable, onChange }) {
  const [dependencies, setDependencies] = useState([])
  const [assignees, setAssignees] = useState([])
  const [milestones, setMilestones] = useState([])
  const [depId, setDepId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const project = projects.find(p => p.id === task.project_id)

  async function load() {
    const [d, a, m] = await Promise.all([
      api(`/tasks/${task.id}/dependencies`),
      api(`/tasks/${task.id}/assignees`),
      api(`/projects/${task.project_id}/milestones`)
    ])

    setDependencies(d)
    setAssignees(a)
    setMilestones(m)
  }

  useEffect(() => {
    load().catch(e => setError(e.message))
  }, [task.id])

  async function change(action) {
    try {
      setError('')
      setBusy(true)
      await action()
      await load()
      await onChange()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const options = tasks.filter(t =>
    t.project_id === task.project_id &&
    t.id !== task.id &&
    !dependencies.some(d => d.depends_on_id === t.id)
  )

  const teamMembers = members[project?.team_id] || []
  const assigneeIds = assignees.map(Number)
  const dependencyName = id => tasks.find(t => t.id === id)?.title || `Issue FOR-${id}`

  const assigneeName = id =>
    teamMembers.find(m => Number(m.id) === Number(id))?.name || `User ${id}`

  return (
    <section className="drawer-section advanced-task">
      <h2>Planning & collaboration</h2>

      {error && <p className="error">{error}</p>}

      <div className="advanced-block">
        <h3>Milestone</h3>

        <select
          disabled={!editable || busy}
          value={task.milestone_id || ''}
          onChange={e => change(() =>
            api(`/tasks/${task.id}`, 'PATCH', {
              title: task.title,
              description: task.description,
              priority: task.priority,
              due_date: task.due_date,
              assignee_id: task.assignee_id,
              labels: task.labels,
              estimate: task.estimate,
              milestone_id: e.target.value
                ? Number(e.target.value)
                : null
            })
          )}
        >
          <option value="">No milestone</option>
          {milestones.map(m => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <small>
          Effort estimate: {task.estimate ?? 'Not set'} points
        </small>
      </div>

      <div className="advanced-block">
        <h3>Blocked by</h3>

        {dependencies.map(d => (
          <div className="advanced-line" key={d.id}>
            <span>
              FOR-{d.depends_on_id} · {dependencyName(d.depends_on_id)}
            </span>

            {editable && (
              <button
                type="button"
                onClick={() => change(() =>
                  api(
                    `/tasks/${task.id}/dependencies/${d.id}`,
                    'DELETE'
                  )
                )}
              >
                Remove
              </button>
            )}
          </div>
        ))}

        {editable && (
          <div className="inline-form">
            <select
              value={depId}
              onChange={e => setDepId(e.target.value)}
            >
              <option value="">Select dependency</option>

              {options.map(t => (
                <option key={t.id} value={t.id}>
                  FOR-{t.id} · {t.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn secondary"
              disabled={!depId || busy}
              onClick={() => change(async () => {
                await api(
                  `/tasks/${task.id}/dependencies`,
                  'POST',
                  { depends_on_id: Number(depId) }
                )
                setDepId('')
              })}
            >
              Add
            </button>
          </div>
        )}
      </div>

      <div className="advanced-block">
        <h3>Additional assignees</h3>
        <p className="muted">The primary assignee appears in Properties. Add collaborators here without replacing the owner.</p>

        {assigneeIds.map(id => (
          <div className="advanced-line" key={id}>
            <span>{assigneeName(id)}</span>

            {editable && (
              <button
                type="button"
                onClick={() => change(() =>
                  api(
                    `/tasks/${task.id}/assignees`,
                    'PUT',
                    {
                      user_ids: assigneeIds.filter(x => x !== id)
                    }
                  )
                )}
              >
                Remove
              </button>
            )}
          </div>
        ))}

        {editable && (
          <div className="inline-form">
            <select
              aria-label="Additional assignee"
              value={memberId}
              onChange={e => setMemberId(e.target.value)}
            >
              <option value="">Select team member</option>

              {teamMembers
                .filter(m => !assigneeIds.includes(Number(m.id)))
                .map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>

            <button
              type="button"
              className="btn secondary"
              disabled={!memberId || busy}
              onClick={() => change(async () => {
                await api(
                  `/tasks/${task.id}/assignees`,
                  'PUT',
                  {
                    user_ids: [
                      ...assigneeIds,
                      Number(memberId)
                    ]
                  }
                )
                setMemberId('')
              })}
            >
              Assign
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
