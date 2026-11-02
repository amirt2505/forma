
from datetime import date, datetime
from typing import Literal
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from pwdlib import PasswordHash

from app.database import engine, SessionLocal
from app.models import (
    Base, User, Team, TeamMember, Project, Task,
    Subtask, Comment, Activity, Notification, Milestone, TaskDependency, TaskAssignee, SavedView
)
from app.auth import create_token, get_current_user_id
from app.messaging import router as messaging_router
from app import messaging as messaging_models  # Registers message models before create_all

app = FastAPI(title='Forma 5.1 API')
app.include_router(messaging_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Run the SQL migration on existing databases first.
Base.metadata.create_all(bind=engine)

hasher = PasswordHash.recommended()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def uid(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    if not db.get(User, user_id):
        raise HTTPException(401, 'Account not found')
    return user_id


def info(user):
    return {
        'id': user.id,
        'name': user.name,
        'email': user.email
    }


def team_info(t):
    return {
        'id': t.id,
        'name': t.name,
        'description': t.description or '',
        'owner_id': t.owner_id
    }


def project_info(p):
    return {
        'id': p.id,
        'name': p.name,
        'description': p.description or '',
        'team_id': p.team_id,
        'color': p.color
    }


def task_info(t):
    return {
        'id': t.id,
        'title': t.title,
        'description': t.description or '',
        'status': t.status,
        'project_id': t.project_id,
        'priority': t.priority,
        'due_date': t.due_date,
        'assignee_id': t.assignee_id,
        'labels': t.labels or '',
        'position': t.position,
        'estimate': t.estimate,
        'milestone_id': t.milestone_id
    }


def allowed_team(db, team_id, user_id, write=False, owner=False):
    t = db.get(Team, team_id)

    if not t:
        raise HTTPException(404, 'Team not found')

    if t.owner_id == user_id:
        return t

    m = db.query(TeamMember).filter_by(
        team_id=team_id,
        user_id=user_id
    ).first()

    if not m:
        raise HTTPException(404, 'Team not found')

    if owner or (write and m.role not in ('admin', 'member')):
        raise HTTPException(403, 'Not permitted')

    return t


def allowed_project(db, project_id, user_id, write=False):
    p = db.get(Project, project_id)

    if not p:
        raise HTTPException(404, 'Project not found')

    allowed_team(db, p.team_id, user_id, write=write)
    return p


def allowed_task(db, task_id, user_id, write=False):
    t = db.get(Task, task_id)

    if not t:
        raise HTTPException(404, 'Task not found')

    allowed_project(db, t.project_id, user_id, write=write)
    return t


def accessible_ids(db, user_id):
    owned = [
        t.id for t in db.query(Team).filter_by(
            owner_id=user_id
        ).all()
    ]

    joined = [
        m.team_id for m in db.query(TeamMember).filter_by(
            user_id=user_id
        ).all()
    ]

    return list(set(owned + joined))


def log(db, actor, task_id, action):
    db.add(Activity(
        actor_id=actor,
        task_id=task_id,
        action=action
    ))


def notify(db, recipient, message, task_id=None):
    if recipient:
        db.add(Notification(
            user_id=recipient,
            message=message,
            task_id=task_id
        ))


class Register(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class Login(BaseModel):
    email: EmailStr
    password: str


class Named(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default='', max_length=500)


class NewProject(Named):
    team_id: int
    color: str = Field(default='#9b86f5', pattern=r'^#[0-9a-fA-F]{6}$')


class MemberInput(BaseModel):
    email: EmailStr
    role: Literal['admin', 'member', 'viewer'] = 'member'


class RoleInput(BaseModel):
    role: Literal['admin', 'member', 'viewer']


class NewTask(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(default='', max_length=500)
    project_id: int
    priority: Literal['urgent', 'high', 'medium', 'low'] = 'medium'
    due_date: date | None = None
    assignee_id: int | None = None
    labels: str = Field(default='', max_length=500)
    estimate: int | None = Field(default=None, ge=0, le=1000)
    milestone_id: int | None = None


class TaskEdit(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(default='', max_length=500)
    priority: Literal['urgent', 'high', 'medium', 'low'] = 'medium'
    due_date: date | None = None
    assignee_id: int | None = None
    labels: str = Field(default='', max_length=500)
    estimate: int | None = Field(default=None, ge=0, le=1000)
    milestone_id: int | None = None


class StatusInput(BaseModel):
    status: Literal['todo', 'in_progress', 'done']


class TextInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class CommentInput(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class SubtaskUpdate(BaseModel):
    completed: bool


def validate_assignee(db, project_id, assignee_id):
    if assignee_id is None:
        return

    p = db.get(Project, project_id)
    t = db.get(Team, p.team_id)

    member = db.query(TeamMember).filter_by(
        team_id=t.id,
        user_id=assignee_id
    ).first()

    if assignee_id != t.owner_id and not member:
        raise HTTPException(
            400,
            'Assignee must belong to this team'
        )


@app.get('/')
def root():
    return {'message': 'Forma 4.0 API is running'}


@app.post('/register', status_code=201)
def register(data: Register, db: Session = Depends(get_db)):
    email = str(data.email).lower()

    if not data.name.strip():
        raise HTTPException(400, 'Name required')

    if db.query(User).filter_by(email=email).first():
        raise HTTPException(400, 'Email already registered')

    u = User(
        name=data.name.strip(),
        email=email,
        password_hash=hasher.hash(data.password)
    )

    db.add(u)
    db.commit()
    db.refresh(u)
    return info(u)


@app.post('/login')
def login(data: Login, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(
        email=str(data.email).lower()
    ).first()

    if not u or not hasher.verify(data.password, u.password_hash):
        raise HTTPException(401, 'Incorrect email or password')

    return {
        'access_token': create_token(u.id),
        'token_type': 'bearer'
    }


@app.get('/me')
def me(
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    return info(db.get(User, user_id))


@app.get('/teams')
def teams(
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    ids = accessible_ids(db, user_id)

    if not ids:
        return []

    return [
        team_info(t)
        for t in db.query(Team).filter(
            Team.id.in_(ids)
        ).order_by(Team.id).all()
    ]


@app.post('/teams', status_code=201)
def create_team(
    data: Named,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    t = Team(
        name=data.name.strip(),
        description=data.description,
        owner_id=user_id
    )

    db.add(t)
    db.commit()
    db.refresh(t)
    return team_info(t)


@app.patch('/teams/{team_id}')
def edit_team(
    team_id: int,
    data: Named,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    t = allowed_team(db, team_id, user_id, owner=True)
    t.name = data.name.strip()
    t.description = data.description

    db.commit()
    db.refresh(t)
    return team_info(t)


def delete_task_records(db, task_id):
    db.query(TaskDependency).filter((TaskDependency.task_id == task_id) | (TaskDependency.depends_on_id == task_id)).delete(synchronize_session=False)
    db.query(TaskAssignee).filter_by(task_id=task_id).delete()
    db.query(Subtask).filter_by(task_id=task_id).delete()
    db.query(Comment).filter_by(task_id=task_id).delete()
    db.query(Activity).filter_by(task_id=task_id).delete()
    db.query(Notification).filter_by(
        task_id=task_id
    ).update({'task_id': None})


@app.delete('/teams/{team_id}')
def delete_team(
    team_id: int,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    t = allowed_team(db, team_id, user_id, owner=True)

    for p in db.query(Project).filter_by(team_id=team_id).all():
        for task in db.query(Task).filter_by(
            project_id=p.id
        ).all():
            delete_task_records(db, task.id)
            db.delete(task)

        db.query(Milestone).filter_by(project_id=p.id).delete()
        db.query(SavedView).filter_by(project_id=p.id).delete()
        db.delete(p)

    db.query(TeamMember).filter_by(team_id=team_id).delete()
    db.delete(t)
    db.commit()

    return {'message': 'Team deleted'}


@app.get('/teams/{team_id}/members')
def members(
    team_id: int,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    t = allowed_team(db, team_id, user_id)

    result = [{
        **info(db.get(User, t.owner_id)),
        'role': 'owner'
    }]

    for m in db.query(TeamMember).filter_by(
        team_id=team_id
    ).all():
        u = db.get(User, m.user_id)

        if u and u.id != t.owner_id:
            result.append({
                **info(u),
                'role': m.role
            })

    return result


@app.post('/teams/{team_id}/members', status_code=201)
def add_member(
    team_id: int,
    data: MemberInput,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    t = allowed_team(db, team_id, user_id, owner=True)

    u = db.query(User).filter_by(
        email=str(data.email).lower()
    ).first()

    if not u:
        raise HTTPException(404, 'User must register first')

    existing = db.query(TeamMember).filter_by(
        team_id=team_id,
        user_id=u.id
    ).first()

    if u.id == t.owner_id or existing:
        raise HTTPException(400, 'Already in team')

    db.add(TeamMember(
        team_id=team_id,
        user_id=u.id,
        role=data.role
    ))

    notify(db, u.id, f'You were added to {t.name}')
    db.commit()

    return {
        **info(u),
        'role': data.role
    }


@app.patch('/teams/{team_id}/members/{member_id}')
def change_role(
    team_id: int,
    member_id: int,
    data: RoleInput,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    allowed_team(db, team_id, user_id, owner=True)

    m = db.query(TeamMember).filter_by(
        team_id=team_id,
        user_id=member_id
    ).first()

    if not m:
        raise HTTPException(404, 'Member not found')

    m.role = data.role
    db.commit()

    return {'message': 'Role updated'}


@app.delete('/teams/{team_id}/members/{member_id}')
def remove_member(
    team_id: int,
    member_id: int,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    allowed_team(db, team_id, user_id, owner=True)

    m = db.query(TeamMember).filter_by(
        team_id=team_id,
        user_id=member_id
    ).first()

    if not m:
        raise HTTPException(404, 'Member not found')

    db.delete(m)
    db.commit()
    return {'message': 'Member removed'}


@app.get('/projects')
def projects(
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    ids = accessible_ids(db, user_id)

    if not ids:
        return []

    return [
        project_info(p)
        for p in db.query(Project).filter(
            Project.team_id.in_(ids)
        ).order_by(Project.id).all()
    ]


@app.post('/projects', status_code=201)
def create_project(
    data: NewProject,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    allowed_team(db, data.team_id, user_id, write=True)

    p = Project(
        name=data.name.strip(),
        description=data.description,
        team_id=data.team_id,
        color=data.color
    )

    db.add(p)
    db.commit()
    db.refresh(p)
    return project_info(p)


@app.patch('/projects/{project_id}')
def edit_project(
    project_id: int,
    data: Named,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    p = allowed_project(
        db, project_id, user_id, write=True
    )

    p.name = data.name.strip()
    p.description = data.description

    db.commit()
    db.refresh(p)
    return project_info(p)


@app.delete('/projects/{project_id}')
def delete_project(
    project_id: int,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    p = allowed_project(
        db, project_id, user_id, write=True
    )

    for t in db.query(Task).filter_by(
        project_id=project_id
    ).all():
        delete_task_records(db, t.id)
        db.delete(t)

    db.query(Milestone).filter_by(project_id=p.id).delete()
    db.query(SavedView).filter_by(project_id=p.id).delete()
    db.delete(p)
    db.commit()

    return {'message': 'Project deleted'}


@app.get('/tasks')
def tasks(
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    ids = accessible_ids(db, user_id)

    if not ids:
        return []

    result = db.query(Task).join(Project).filter(
        Project.team_id.in_(ids)
    ).order_by(Task.position, Task.id).all()

    return [task_info(t) for t in result]


@app.post('/tasks', status_code=201)
def create_task(
    data: NewTask,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    allowed_project(
        db, data.project_id, user_id, write=True
    )
    validate_assignee(
        db, data.project_id, data.assignee_id
    )
    validate_milestone(db, data.project_id, data.milestone_id)

    t = Task(
        title=data.title.strip(),
        description=data.description,
        project_id=data.project_id,
        priority=data.priority,
        due_date=data.due_date,
        assignee_id=data.assignee_id,
        labels=data.labels,
        estimate=data.estimate,
        milestone_id=data.milestone_id
    )

    db.add(t)
    db.flush()

    log(db, user_id, t.id, 'created this task')

    if data.assignee_id and data.assignee_id != user_id:
        notify(
            db,
            data.assignee_id,
            f'You were assigned: {t.title}',
            t.id
        )

    db.commit()
    db.refresh(t)
    return task_info(t)


@app.patch('/tasks/{task_id}')
def edit_task(
    task_id: int,
    data: TaskEdit,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    t = allowed_task(db, task_id, user_id, write=True)

    validate_assignee(
        db, t.project_id, data.assignee_id
    )
    validate_milestone(db, t.project_id, data.milestone_id)

    old_assignee = t.assignee_id

    t.title = data.title.strip()
    t.description = data.description
    t.priority = data.priority
    t.due_date = data.due_date
    t.assignee_id = data.assignee_id
    t.labels = data.labels
    t.estimate = data.estimate
    t.milestone_id = data.milestone_id

    log(db, user_id, t.id, 'updated task details')

    if (
        data.assignee_id
        and data.assignee_id != old_assignee
        and data.assignee_id != user_id
    ):
        notify(
            db,
            data.assignee_id,
            f'You were assigned: {t.title}',
            t.id
        )

    db.commit()
    db.refresh(t)
    return task_info(t)


@app.patch('/tasks/{task_id}/status')
def change_status(
    task_id: int,
    data: StatusInput,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    t = allowed_task(db, task_id, user_id, write=True)
    t.status = data.status

    log(
        db,
        user_id,
        t.id,
        f'moved task to {data.status.replace("_", " ")}'
    )

    db.commit()
    db.refresh(t)
    return task_info(t)


@app.delete('/tasks/{task_id}')
def delete_task(
    task_id: int,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    t = allowed_task(db, task_id, user_id, write=True)

    delete_task_records(db, task_id)
    db.delete(t)
    db.commit()

    return {'message': 'Task deleted'}


@app.get('/tasks/{task_id}/details')
def task_details(
    task_id: int,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    t = allowed_task(db, task_id, user_id)

    subtasks = db.query(Subtask).filter_by(
        task_id=task_id
    ).order_by(Subtask.id).all()

    comments = db.query(Comment).filter_by(
        task_id=task_id
    ).order_by(Comment.id).all()

    activities = db.query(Activity).filter_by(
        task_id=task_id
    ).order_by(Activity.id.desc()).limit(30).all()

    return {
        'task': task_info(t),
        'subtasks': [
            {
                'id': s.id,
                'title': s.title,
                'completed': s.completed
            }
            for s in subtasks
        ],
        'comments': [
            {
                'id': c.id,
                'body': c.body,
                'author_id': c.author_id,
                'created_at': c.created_at
            }
            for c in comments
        ],
        'activities': [
            {
                'id': a.id,
                'actor_id': a.actor_id,
                'action': a.action,
                'created_at': a.created_at
            }
            for a in activities
        ]
    }


@app.post('/tasks/{task_id}/subtasks', status_code=201)
def add_subtask(
    task_id: int,
    data: TextInput,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    allowed_task(db, task_id, user_id, write=True)

    s = Subtask(
        task_id=task_id,
        title=data.title.strip()
    )

    db.add(s)
    log(db, user_id, task_id, 'added a subtask')
    db.commit()
    db.refresh(s)

    return {
        'id': s.id,
        'title': s.title,
        'completed': s.completed
    }


@app.patch('/tasks/{task_id}/subtasks/{subtask_id}')
def update_subtask(
    task_id: int,
    subtask_id: int,
    data: SubtaskUpdate,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    allowed_task(db, task_id, user_id, write=True)

    s = db.query(Subtask).filter_by(
        id=subtask_id,
        task_id=task_id
    ).first()

    if not s:
        raise HTTPException(404, 'Subtask not found')

    s.completed = data.completed
    db.commit()

    return {
        'id': s.id,
        'title': s.title,
        'completed': s.completed
    }


@app.delete('/tasks/{task_id}/subtasks/{subtask_id}')
def delete_subtask(
    task_id: int,
    subtask_id: int,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    allowed_task(db, task_id, user_id, write=True)

    s = db.query(Subtask).filter_by(
        id=subtask_id,
        task_id=task_id
    ).first()

    if not s:
        raise HTTPException(404, 'Subtask not found')

    db.delete(s)
    db.commit()
    return {'message': 'Subtask deleted'}


@app.post('/tasks/{task_id}/comments', status_code=201)
def add_comment(
    task_id: int,
    data: CommentInput,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    t = allowed_task(db, task_id, user_id, write=True)

    c = Comment(
        task_id=task_id,
        author_id=user_id,
        body=data.body.strip()
    )

    db.add(c)
    log(db, user_id, task_id, 'commented on task')

    if t.assignee_id and t.assignee_id != user_id:
        notify(
            db,
            t.assignee_id,
            f'New comment on {t.title}',
            task_id
        )

    db.commit()
    db.refresh(c)

    return {
        'id': c.id,
        'body': c.body,
        'author_id': c.author_id,
        'created_at': c.created_at
    }


@app.delete('/tasks/{task_id}/comments/{comment_id}')
def delete_comment(
    task_id: int,
    comment_id: int,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    t = allowed_task(db, task_id, user_id)

    c = db.query(Comment).filter_by(
        id=comment_id,
        task_id=task_id
    ).first()

    if not c:
        raise HTTPException(404, 'Comment not found')

    team = db.get(
        Team,
        db.get(Project, t.project_id).team_id
    )

    if c.author_id != user_id and team.owner_id != user_id:
        raise HTTPException(403, 'Not permitted')

    db.delete(c)
    db.commit()
    return {'message': 'Comment deleted'}


@app.get('/notifications')
def notifications(
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    result = db.query(Notification).filter_by(
        user_id=user_id
    ).order_by(Notification.id.desc()).limit(100).all()

    return [
        {
            'id': n.id,
            'message': n.message,
            'task_id': n.task_id,
            'is_read': n.is_read,
            'created_at': n.created_at
        }
        for n in result
    ]


@app.patch('/notifications/{notification_id}/read')
def read_notification(
    notification_id: int,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    n = db.query(Notification).filter_by(
        id=notification_id,
        user_id=user_id
    ).first()

    if not n:
        raise HTTPException(404, 'Notification not found')

    n.is_read = True
    db.commit()

    return {'message': 'Read'}


# Forma 4.0 features
class MilestoneInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    due_date: date | None = None
    completed: bool = False

class DependencyInput(BaseModel):
    depends_on_id: int

class AssigneesInput(BaseModel):
    user_ids: list[int] = Field(default_factory=list, max_length=30)

class ViewInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    project_id: int | None = None
    priority: Literal['all', 'urgent', 'high', 'medium', 'low'] = 'all'
    search: str = Field(default='', max_length=200)
    layout: Literal['board', 'list', 'calendar'] = 'board'


def validate_milestone(db, project_id, milestone_id):
    if milestone_id is None:
        return
    milestone = db.get(Milestone, milestone_id)
    if not milestone or milestone.project_id != project_id:
        raise HTTPException(400, 'Milestone must belong to this project')


def milestone_info(m):
    return {'id': m.id, 'project_id': m.project_id, 'name': m.name,
            'due_date': m.due_date, 'completed': m.completed}


@app.get('/projects/{project_id}/milestones')
def list_milestones(project_id: int, user_id: int = Depends(uid), db: Session = Depends(get_db)):
    allowed_project(db, project_id, user_id)
    return [milestone_info(m) for m in db.query(Milestone).filter_by(project_id=project_id).order_by(Milestone.id).all()]


@app.post('/projects/{project_id}/milestones', status_code=201)
def create_milestone(project_id: int, data: MilestoneInput, user_id: int = Depends(uid), db: Session = Depends(get_db)):
    allowed_project(db, project_id, user_id, write=True)
    m = Milestone(project_id=project_id, name=data.name.strip(), due_date=data.due_date, completed=data.completed)
    db.add(m)
    db.commit()
    db.refresh(m)
    return milestone_info(m)


@app.patch('/milestones/{milestone_id}')
def update_milestone(milestone_id: int, data: MilestoneInput, user_id: int = Depends(uid), db: Session = Depends(get_db)):
    m = db.get(Milestone, milestone_id)
    if not m:
        raise HTTPException(404, 'Milestone not found')
    allowed_project(db, m.project_id, user_id, write=True)
    m.name, m.due_date, m.completed = data.name.strip(), data.due_date, data.completed
    db.commit()
    return milestone_info(m)


@app.delete('/milestones/{milestone_id}')
def delete_milestone(milestone_id: int, user_id: int = Depends(uid), db: Session = Depends(get_db)):
    m = db.get(Milestone, milestone_id)
    if not m:
        raise HTTPException(404, 'Milestone not found')
    allowed_project(db, m.project_id, user_id, write=True)
    db.query(Task).filter_by(milestone_id=m.id).update({'milestone_id': None})
    db.delete(m)
    db.commit()
    return {'message': 'Milestone deleted'}


@app.get('/tasks/{task_id}/dependencies')
def list_dependencies(task_id: int, user_id: int = Depends(uid), db: Session = Depends(get_db)):
    allowed_task(db, task_id, user_id)
    return [{'id': d.id, 'task_id': d.task_id, 'depends_on_id': d.depends_on_id}
            for d in db.query(TaskDependency).filter_by(task_id=task_id).all()]


@app.post('/tasks/{task_id}/dependencies', status_code=201)
def add_dependency(task_id: int, data: DependencyInput, user_id: int = Depends(uid), db: Session = Depends(get_db)):
    task = allowed_task(db, task_id, user_id, write=True)
    other = allowed_task(db, data.depends_on_id, user_id)
    if task.id == other.id or task.project_id != other.project_id:
        raise HTTPException(400, 'Dependency must be another task in the same project')
    if db.query(TaskDependency).filter_by(task_id=task_id, depends_on_id=other.id).first():
        raise HTTPException(400, 'Dependency already exists')
    # Prevent dependency cycles by walking the graph from the requested prerequisite.
    visited, stack = set(), [other.id]
    while stack:
        current = stack.pop()
        if current == task_id:
            raise HTTPException(400, 'Dependency would create a cycle')
        if current in visited:
            continue
        visited.add(current)
        stack.extend(d.depends_on_id for d in db.query(TaskDependency).filter_by(task_id=current).all())
    d = TaskDependency(task_id=task_id, depends_on_id=other.id)
    db.add(d)
    db.commit()
    db.refresh(d)
    return {'id': d.id, 'task_id': d.task_id, 'depends_on_id': d.depends_on_id}


@app.delete('/tasks/{task_id}/dependencies/{dependency_id}')
def remove_dependency(task_id: int, dependency_id: int, user_id: int = Depends(uid), db: Session = Depends(get_db)):
    allowed_task(db, task_id, user_id, write=True)
    d = db.query(TaskDependency).filter_by(id=dependency_id, task_id=task_id).first()
    if not d:
        raise HTTPException(404, 'Dependency not found')
    db.delete(d)
    db.commit()
    return {'message': 'Dependency removed'}


@app.get('/tasks/{task_id}/assignees')
def list_assignees(task_id: int, user_id: int = Depends(uid), db: Session = Depends(get_db)):
    allowed_task(db, task_id, user_id)
    return [a.user_id for a in db.query(TaskAssignee).filter_by(task_id=task_id).all()]


@app.put('/tasks/{task_id}/assignees')
def set_assignees(task_id: int, data: AssigneesInput, user_id: int = Depends(uid), db: Session = Depends(get_db)):
    task = allowed_task(db, task_id, user_id, write=True)
    ids = list(dict.fromkeys(data.user_ids))
    for assignee_id in ids:
        validate_assignee(db, task.project_id, assignee_id)
    db.query(TaskAssignee).filter_by(task_id=task_id).delete()
    for assignee_id in ids:
        db.add(TaskAssignee(task_id=task_id, user_id=assignee_id))
    db.commit()
    return ids


def view_info(v):
    return {'id': v.id, 'name': v.name, 'project_id': v.project_id,
            'priority': v.priority, 'search': v.search, 'layout': v.layout}


@app.get('/saved-views')
def list_saved_views(user_id: int = Depends(uid), db: Session = Depends(get_db)):
    return [view_info(v) for v in db.query(SavedView).filter_by(user_id=user_id).order_by(SavedView.id).all()]


@app.post('/saved-views', status_code=201)
def create_saved_view(data: ViewInput, user_id: int = Depends(uid), db: Session = Depends(get_db)):
    if data.project_id is not None:
        allowed_project(db, data.project_id, user_id)
    v = SavedView(user_id=user_id, name=data.name.strip(), project_id=data.project_id,
                  priority=data.priority, search=data.search, layout=data.layout)
    db.add(v)
    db.commit()
    db.refresh(v)
    return view_info(v)


@app.delete('/saved-views/{view_id}')
def delete_saved_view(view_id: int, user_id: int = Depends(uid), db: Session = Depends(get_db)):
    v = db.query(SavedView).filter_by(id=view_id, user_id=user_id).first()
    if not v:
        raise HTTPException(404, 'Saved view not found')
    db.delete(v)
    db.commit()
    return {'message': 'Saved view deleted'}


@app.get('/analytics')
def analytics(user_id: int = Depends(uid), db: Session = Depends(get_db)):
    ids = accessible_ids(db, user_id)
    if not ids:
        return {'total': 0, 'overdue': 0,
                'by_status': {'todo': 0, 'in_progress': 0, 'done': 0},
                'by_priority': {'urgent': 0, 'high': 0, 'medium': 0, 'low': 0},
                'by_project': []}
    projects = db.query(Project).filter(Project.team_id.in_(ids)).all()
    tasks = db.query(Task).join(Project).filter(Project.team_id.in_(ids)).all()
    by_status = {k: 0 for k in ('todo', 'in_progress', 'done')}
    by_priority = {k: 0 for k in ('urgent', 'high', 'medium', 'low')}
    by_project = {p.id: {'project_id': p.id, 'name': p.name, 'total': 0, 'done': 0} for p in projects}
    overdue = 0
    for task in tasks:
        by_status[task.status] = by_status.get(task.status, 0) + 1
        by_priority[task.priority] = by_priority.get(task.priority, 0) + 1
        by_project[task.project_id]['total'] += 1
        if task.status == 'done':
            by_project[task.project_id]['done'] += 1
        if task.due_date and task.due_date < date.today() and task.status != 'done':
            overdue += 1
    return {'total': len(tasks), 'overdue': overdue, 'by_status': by_status,
            'by_priority': by_priority, 'by_project': list(by_project.values())}
from pydantic import BaseModel, Field


class SendToInboxInput(BaseModel):
    recipient_id: int
    message: str = Field(default='', max_length=500)


@app.post('/tasks/{task_id}/send-to-inbox', status_code=201)
def send_task_to_inbox(
    task_id: int,
    data: SendToInboxInput,
    user_id: int = Depends(uid),
    db: Session = Depends(get_db)
):
    task = allowed_task(
        db,
        task_id,
        user_id,
        write=True
    )

    project = db.get(Project, task.project_id)

    recipient = db.get(User, data.recipient_id)

    if not recipient:
        raise HTTPException(
            status_code=404,
            detail='Recipient not found'
        )

    if data.recipient_id == user_id:
        raise HTTPException(
            status_code=400,
            detail='Choose another team member'
        )

    allowed_team(
        db,
        project.team_id,
        data.recipient_id
    )

    sender = db.get(User, user_id)

    message = (
        f'{sender.name} shared '
        f'FOR-{task.id}: {task.title}'
    )

    note = data.message.strip()

    if note:
        message += f' — {note}'

    notify(
        db,
        data.recipient_id,
        message,
        task.id
    )

    log(
        db,
        user_id,
        task.id,
        f'shared issue with {recipient.name}'
    )

    db.commit()

    return {
        'message': 'Sent to inbox',
        'recipient_id': recipient.id,
        'task_id': task.id
    }
