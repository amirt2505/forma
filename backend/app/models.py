
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, ForeignKey, Date, Boolean, Text, DateTime, UniqueConstraint
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)

class Team(Base):
    __tablename__ = 'teams'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500))
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=False)

class TeamMember(Base):
    __tablename__ = 'team_members'
    __table_args__ = (UniqueConstraint('team_id', 'user_id', name='uq_team_member'),)
    id = Column(Integer, primary_key=True)
    team_id = Column(Integer, ForeignKey('teams.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    role = Column(String(20), nullable=False, default='member')

class Project(Base):
    __tablename__ = 'projects'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500))
    team_id = Column(Integer, ForeignKey('teams.id'), nullable=False)
    color = Column(String(20), nullable=False, default='#9b86f5')

class Task(Base):
    __tablename__ = 'tasks'
    id = Column(Integer, primary_key=True)
    title = Column(String(100), nullable=False)
    description = Column(String(500))
    status = Column(String(20), nullable=False, default='todo')
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=False)
    priority = Column(String(20), nullable=False, default='medium')
    due_date = Column(Date)
    assignee_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'))
    labels = Column(String(500), nullable=False, default='')
    position = Column(Integer, nullable=False, default=0)
    estimate = Column(Integer)
    milestone_id = Column(Integer, ForeignKey('milestones.id', ondelete='SET NULL'))

class Subtask(Base):
    __tablename__ = 'subtasks'
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False)
    title = Column(String(200), nullable=False)
    completed = Column(Boolean, nullable=False, default=False)

class Comment(Base):
    __tablename__ = 'comments'
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False)
    author_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class Activity(Base):
    __tablename__ = 'activities'
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'))
    actor_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    action = Column(String(300), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class Notification(Base):
    __tablename__ = 'notifications'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    message = Column(String(500), nullable=False)
    task_id = Column(Integer, ForeignKey('tasks.id', ondelete='SET NULL'))
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class Milestone(Base):
    __tablename__ = 'milestones'
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(120), nullable=False)
    due_date = Column(Date)
    completed = Column(Boolean, nullable=False, default=False)

class TaskDependency(Base):
    __tablename__ = 'task_dependencies'
    __table_args__ = (UniqueConstraint('task_id', 'depends_on_id', name='uq_task_dependency'),)
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False)
    depends_on_id = Column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False)

class TaskAssignee(Base):
    __tablename__ = 'task_assignees'
    __table_args__ = (UniqueConstraint('task_id', 'user_id', name='uq_task_assignee'),)
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)

class SavedView(Base):
    __tablename__ = 'saved_views'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(100), nullable=False)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete='CASCADE'))
    priority = Column(String(20), nullable=False, default='all')
    search = Column(String(200), nullable=False, default='')
    layout = Column(String(20), nullable=False, default='board')


class Conversation(Base):
    __tablename__ = 'conversations'
    id = Column(Integer, primary_key=True)
    title = Column(String(120))
    is_group = Column(Boolean, nullable=False, default=False)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class ConversationMember(Base):
    __tablename__ = 'conversation_members'
    __table_args__ = (UniqueConstraint('conversation_id', 'user_id', name='uq_conversation_member'),)
    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    last_read_message_id = Column(Integer, nullable=False, default=0)


class DirectMessage(Base):
    __tablename__ = 'direct_messages'
    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False)
    sender_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
