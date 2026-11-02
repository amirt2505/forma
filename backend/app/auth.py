
import os
from datetime import datetime, timedelta, timezone
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

load_dotenv()

SECRET_KEY = os.getenv('SECRET_KEY')

if not SECRET_KEY:
    raise RuntimeError('SECRET_KEY is missing from backend/.env')

security = HTTPBearer()

def create_token(user_id):
    return jwt.encode(
        {
            'sub': str(user_id),
            'exp': datetime.now(timezone.utc) + timedelta(hours=24)
        },
        SECRET_KEY,
        algorithm='HS256'
    )

def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        return int(
            jwt.decode(
                credentials.credentials,
                SECRET_KEY,
                algorithms=['HS256']
            )['sub']
        )
    except (jwt.InvalidTokenError, ValueError, KeyError, TypeError):
        raise HTTPException(
            status_code=401,
            detail='Invalid or expired token'
        )
