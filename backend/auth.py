"""JWT + bcrypt auth: seed admin, login, /me, admin-only user create."""

import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_MIN = 60 * 12  # 12 hours - internal tool


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_TTL_MIN),
        "type": "access",
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])


# --- Pydantic ---
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreateIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "member"


# --- Router factory (needs db) ---
def build_auth_router(db):
    router = APIRouter(prefix="/api/auth", tags=["auth"])

    async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Not authenticated")
        token = authorization.split(" ", 1)[1].strip()
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("password_hash", None)
        user.pop("_id", None)
        return user

    async def require_admin(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
        return user

    @router.post("/login", response_model=TokenOut)
    async def login(payload: LoginIn):
        email = payload.email.lower().strip()
        user = await db.users.find_one({"email": email})
        if not user or not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        token = create_access_token(user["id"], user["email"], user["role"])
        return TokenOut(
            access_token=token,
            user=UserOut(id=user["id"], email=user["email"], name=user["name"], role=user["role"]),
        )

    @router.get("/me", response_model=UserOut)
    async def me(user: dict = Depends(get_current_user)):
        return UserOut(id=user["id"], email=user["email"], name=user["name"], role=user["role"])

    @router.get("/users", response_model=list[UserOut])
    async def list_users(_: dict = Depends(require_admin)):
        users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
        return [UserOut(**u) for u in users]

    @router.post("/users", response_model=UserOut)
    async def create_user(payload: UserCreateIn, _: dict = Depends(require_admin)):
        import uuid
        email = payload.email.lower().strip()
        if await db.users.find_one({"email": email}):
            raise HTTPException(status_code=400, detail="Email already exists")
        doc = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": payload.name,
            "role": payload.role if payload.role in ("admin", "member") else "member",
            "password_hash": hash_password(payload.password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(doc)
        return UserOut(id=doc["id"], email=doc["email"], name=doc["name"], role=doc["role"])

    @router.delete("/users/{user_id}")
    async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
        if admin["id"] == user_id:
            raise HTTPException(status_code=400, detail="Cannot delete yourself")
        target = await db.users.find_one({"id": user_id})
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        if target["email"] == os.environ.get("ADMIN_EMAIL", "").lower():
            raise HTTPException(status_code=400, detail="Cannot delete seed admin")
        await db.users.delete_one({"id": user_id})
        return {"ok": True}

    router.get_current_user = get_current_user  # type: ignore
    router.require_admin = require_admin  # type: ignore
    return router


async def seed_admin(db):
    import uuid
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "Admin",
            "role": "admin",
            "password_hash": hash_password(admin_password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )
