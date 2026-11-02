"""Private 1:1 and group messaging. All routes require JWT authentication."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.auth import get_current_user_id
from app.database import SessionLocal
from app.models import (
    User, Team, TeamMember, Conversation, ConversationMember, DirectMessage
)

router = APIRouter(prefix="/messages", tags=["Messages"])


def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def auth_user(user_id: int = Depends(get_current_user_id), db: Session = Depends(db_session)):
    if not db.get(User, user_id):
        raise HTTPException(401, "Account not found")
    return user_id


def member(db, conversation_id, user_id):
    row = db.query(ConversationMember).filter_by(
        conversation_id=conversation_id, user_id=user_id
    ).first()
    if not row:
        raise HTTPException(404, "Conversation not found")
    return row


def contacts(db, user_id):
    team_ids = {t.id for t in db.query(Team).filter_by(owner_id=user_id).all()}
    team_ids.update(m.team_id for m in db.query(TeamMember).filter_by(user_id=user_id).all())
    ids = set()
    if team_ids:
        ids.update(t.owner_id for t in db.query(Team).filter(Team.id.in_(team_ids)).all())
        ids.update(m.user_id for m in db.query(TeamMember).filter(TeamMember.team_id.in_(team_ids)).all())
    ids.discard(user_id)
    return ids


def serialize(db, conversation, user_id):
    rows = db.query(ConversationMember).filter_by(conversation_id=conversation.id).all()
    users = []
    for row in rows:
        u = db.get(User, row.user_id)
        if u:
            users.append({"id": u.id, "name": u.name, "email": u.email})
    last = db.query(DirectMessage).filter_by(conversation_id=conversation.id).order_by(DirectMessage.id.desc()).first()
    mine = next((m for m in rows if m.user_id == user_id), None)
    title = conversation.title if conversation.is_group else next((u["name"] for u in users if u["id"] != user_id), "Direct message")
    return {
        "id": conversation.id, "title": title, "is_group": conversation.is_group,
        "created_by": conversation.created_by, "members": users,
        "last_message": {"body": last.body, "sender_id": last.sender_id, "created_at": last.created_at.isoformat()} if last else None,
        "unread": db.query(DirectMessage).filter(
            DirectMessage.conversation_id == conversation.id,
            DirectMessage.id > (mine.last_read_message_id if mine else 0),
            DirectMessage.sender_id != user_id
        ).count()
    }


class CreateConversation(BaseModel):
    user_ids: list[int] = Field(min_length=1, max_length=30)
    title: str = Field(default="", max_length=120)


class SendMessage(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class AddMembers(BaseModel):
    user_ids: list[int] = Field(min_length=1, max_length=30)


@router.get("/contacts")
def list_contacts(user_id: int = Depends(auth_user), db: Session = Depends(db_session)):
    return [{"id": u.id, "name": u.name, "email": u.email} for u in db.query(User).filter(User.id.in_(contacts(db, user_id))).order_by(User.name).all()]


@router.get("/conversations")
def list_conversations(user_id: int = Depends(auth_user), db: Session = Depends(db_session)):
    ids = [m.conversation_id for m in db.query(ConversationMember).filter_by(user_id=user_id).all()]
    conversations = db.query(Conversation).filter(Conversation.id.in_(ids)).all() if ids else []
    return sorted([serialize(db, c, user_id) for c in conversations], key=lambda c: c["last_message"]["created_at"] if c["last_message"] else "", reverse=True)


@router.post("/conversations", status_code=201)
def create_conversation(data: CreateConversation, user_id: int = Depends(auth_user), db: Session = Depends(db_session)):
    selected = set(data.user_ids)
    selected.discard(user_id)
    if not selected:
        raise HTTPException(400, "Choose at least one other teammate")
    if not selected.issubset(contacts(db, user_id)):
        raise HTTPException(403, "You can only message teammates who share a team with you")
    participants = selected | {user_id}
    group = len(participants) > 2
    if not group:
        existing = db.query(Conversation).filter_by(is_group=False).all()
        for c in existing:
            ids = {m.user_id for m in db.query(ConversationMember).filter_by(conversation_id=c.id).all()}
            if ids == participants:
                return serialize(db, c, user_id)
    c = Conversation(title=(data.title.strip() or "Group conversation") if group else None,
                     is_group=group, created_by=user_id)
    db.add(c)
    db.flush()
    for uid in participants:
        db.add(ConversationMember(conversation_id=c.id, user_id=uid))
    db.commit()
    return serialize(db, c, user_id)


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: int, user_id: int = Depends(auth_user), db: Session = Depends(db_session)):
    member(db, conversation_id, user_id)
    return serialize(db, db.get(Conversation, conversation_id), user_id)


@router.get("/conversations/{conversation_id}/messages")
def list_messages(conversation_id: int, before: int | None = None, user_id: int = Depends(auth_user), db: Session = Depends(db_session)):
    member(db, conversation_id, user_id)
    q = db.query(DirectMessage).filter_by(conversation_id=conversation_id)
    if before:
        q = q.filter(DirectMessage.id < before)
    rows = list(reversed(q.order_by(DirectMessage.id.desc()).limit(100).all()))
    return [{"id": m.id, "sender_id": m.sender_id, "body": m.body, "created_at": m.created_at.isoformat()} for m in rows]


@router.post("/conversations/{conversation_id}/messages", status_code=201)
def send_message(conversation_id: int, data: SendMessage, user_id: int = Depends(auth_user), db: Session = Depends(db_session)):
    member(db, conversation_id, user_id)
    body = data.body.strip()
    if not body:
        raise HTTPException(400, "Message cannot be empty")
    msg = DirectMessage(conversation_id=conversation_id, sender_id=user_id, body=body)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"id": msg.id, "sender_id": user_id, "body": msg.body, "created_at": msg.created_at.isoformat()}


@router.post("/conversations/{conversation_id}/read")
def mark_read(conversation_id: int, user_id: int = Depends(auth_user), db: Session = Depends(db_session)):
    m = member(db, conversation_id, user_id)
    latest = db.query(DirectMessage.id).filter_by(conversation_id=conversation_id).order_by(DirectMessage.id.desc()).first()
    m.last_read_message_id = latest[0] if latest else 0
    db.commit()
    return {"ok": True}


@router.post("/conversations/{conversation_id}/members")
def add_members(conversation_id: int, data: AddMembers, user_id: int = Depends(auth_user), db: Session = Depends(db_session)):
    member(db, conversation_id, user_id)
    c = db.get(Conversation, conversation_id)
    if not c.is_group:
        raise HTTPException(400, "Start a group conversation to message multiple people")
    existing = {m.user_id for m in db.query(ConversationMember).filter_by(conversation_id=conversation_id).all()}
    requested = set(data.user_ids) - existing
    if not requested.issubset(contacts(db, user_id)):
        raise HTTPException(403, "You can only add teammates who share a team with you")
    if len(existing | requested) > 31:
        raise HTTPException(400, "Group is full")
    for uid in requested:
        db.add(ConversationMember(conversation_id=conversation_id, user_id=uid))
    db.commit()
    return serialize(db, c, user_id)


@router.patch("/conversations/{conversation_id}")
def rename_group(conversation_id: int, data: dict, user_id: int = Depends(auth_user), db: Session = Depends(db_session)):
    member(db, conversation_id, user_id)
    c = db.get(Conversation, conversation_id)
    if not c.is_group:
        raise HTTPException(400, "Direct messages cannot be renamed")
    title = str(data.get("title", "")).strip()
    if not title or len(title) > 120:
        raise HTTPException(400, "Group name must be 1–120 characters")
    c.title = title
    db.commit()
    return serialize(db, c, user_id)


@router.post("/conversations/{conversation_id}/leave")
def leave_group(conversation_id: int, user_id: int = Depends(auth_user), db: Session = Depends(db_session)):
    m = member(db, conversation_id, user_id)
    c = db.get(Conversation, conversation_id)
    if not c.is_group:
        raise HTTPException(400, "Cannot leave a direct message")
    db.delete(m)
    db.commit()
    return {"ok": True}
