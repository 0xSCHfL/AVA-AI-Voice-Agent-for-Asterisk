import os
import json
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import JWTError, jwt
from settings import USERS_PATH

DEFAULT_DEV_SECRET = "dev-secret-key-change-in-prod"
PLACEHOLDER_SECRETS = {
    "",
    "change-me-please",
    "changeme",
    DEFAULT_DEV_SECRET,
}

_raw_secret = (os.getenv("JWT_SECRET", "") or "").strip()
SECRET_KEY = _raw_secret or DEFAULT_DEV_SECRET
USING_PLACEHOLDER_SECRET = SECRET_KEY in PLACEHOLDER_SECRETS
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

router = APIRouter()


class Token(BaseModel):
    access_token: str
    token_type: str
    must_change_password: bool = False


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


class UserRole(str):
    ADMIN = "admin"
    USER = "user"


class User(BaseModel):
    username: str
    email: Optional[str] = None
    role: str = UserRole.USER
    disabled: bool = False
    must_change_password: bool = False
    created_at: Optional[str] = None


class UserInDB(User):
    hashed_password: str


class UserCreate(BaseModel):
    username: str
    email: Optional[str] = None
    password: str
    role: str = UserRole.USER


class UserUpdate(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    disabled: Optional[bool] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class PasswordResetRequest(BaseModel):
    email: Optional[str] = None


class PasswordResetConfirm(BaseModel):
    reset_token: str
    new_password: str


def get_password_hash(password):
    return pwd_context.hash(password)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def load_users():
    if not os.path.exists(USERS_PATH):
        default_users = {
            "admin": {
                "username": "admin",
                "email": None,
                "role": UserRole.ADMIN,
                "hashed_password": get_password_hash("admin"),
                "disabled": False,
                "must_change_password": True,
                "created_at": datetime.utcnow().isoformat(),
            }
        }
        os.makedirs(os.path.dirname(USERS_PATH), exist_ok=True)
        with open(USERS_PATH, "w") as f:
            json.dump(default_users, f, indent=2)
        return default_users

    with open(USERS_PATH, "r") as f:
        return json.load(f)


def save_users(users):
    os.makedirs(os.path.dirname(USERS_PATH), exist_ok=True)
    with open(USERS_PATH, "w") as f:
        json.dump(users, f, indent=2)


def get_user(username: str):
    users = load_users()
    if username in users:
        user_dict = users[username]
        return UserInDB(**user_dict)
    return None


def get_user_by_email(email: str):
    users = load_users()
    for username, user_data in users.items():
        if user_data.get("email") == email:
            return UserInDB(**user_data)
    return None


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception

    user = get_user(token_data.username)
    if user is None:
        raise credentials_exception
    return user


async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return current_user


def load_password_resets():
    resets_path = USERS_PATH.replace("users.json", "password_resets.json")
    if not os.path.exists(resets_path):
        return {}
    with open(resets_path, "r") as f:
        return json.load(f)


def save_password_resets(resets):
    resets_path = USERS_PATH.replace("users.json", "password_resets.json")
    os.makedirs(os.path.dirname(resets_path), exist_ok=True)
    with open(resets_path, "w") as f:
        json.dump(resets, f, indent=2)


def cleanup_expired_resets():
    resets = load_password_resets()
    now = datetime.utcnow()
    expired_keys = []
    for token, data in resets.items():
        exp_str = data.get("expires_at")
        if exp_str:
            exp = datetime.fromisoformat(exp_str)
            if exp < now:
                expired_keys.append(token)
    for key in expired_keys:
        del resets[key]
    if expired_keys:
        save_password_resets(resets)


@router.post("/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user(form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.disabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )

    users = load_users()
    user_dict = users.get(user.username, {})
    must_change = user_dict.get("must_change_password", False)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role, "must_change_password": must_change},
        expires_delta=access_token_expires,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": must_change,
    }


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest, current_user: User = Depends(get_current_user)
):
    users = load_users()
    user_dict = users.get(current_user.username)

    if not user_dict:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(request.old_password, user_dict["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect old password")

    users[current_user.username]["hashed_password"] = get_password_hash(
        request.new_password
    )
    users[current_user.username]["must_change_password"] = False
    save_users(users)

    return {"status": "success", "message": "Password updated successfully"}


@router.post("/password/reset")
async def request_password_reset(request: PasswordResetRequest):
    cleanup_expired_resets()

    if not request.email:
        return {
            "status": "success",
            "message": "If the email exists, a reset link has been sent",
        }

    user_dict = get_user_by_email(request.email)
    if not user_dict:
        return {
            "status": "success",
            "message": "If the email exists, a reset link has been sent",
        }

    reset_token = secrets.token_urlsafe(32)
    hashed_token = hashlib.sha256(reset_token.encode()).hexdigest()

    expires_at = (datetime.utcnow() + timedelta(hours=1)).isoformat()

    resets = load_password_resets()
    resets[hashed_token] = {
        "username": user_dict.username,
        "email": request.email,
        "expires_at": expires_at,
    }
    save_password_resets(resets)

    return {
        "status": "success",
        "message": "Password reset token generated",
        "reset_token": reset_token,
        "expires_in": "1 hour",
    }


@router.post("/password/reset/confirm")
async def confirm_password_reset(request: PasswordResetConfirm):
    cleanup_expired_resets()

    hashed_token = hashlib.sha256(request.reset_token.encode()).hexdigest()
    resets = load_password_resets()

    if hashed_token not in resets:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    reset_data = resets[hashed_token]
    username = reset_data["username"]

    users = load_users()
    if username not in users:
        raise HTTPException(status_code=404, detail="User not found")

    users[username]["hashed_password"] = get_password_hash(request.new_password)
    users[username]["must_change_password"] = False
    save_users(users)

    del resets[hashed_token]
    save_password_resets(resets)

    return {"status": "success", "message": "Password has been reset successfully"}


@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


class UpdateProfileRequest(BaseModel):
    given_name: Optional[str] = None


@router.post("/update-profile")
async def update_profile(
    request: UpdateProfileRequest, current_user: User = Depends(get_current_user)
):
    """Update the current user's profile (e.g. display name)."""
    # Reserved for future use — email/username are not changeable via this endpoint.
    return {"status": "success", "message": "Profile updated"}


@router.get("/warning")
async def get_auth_warning():
    """Returns security warnings that should be surfaced in the admin UI."""
    return {
        "placeholder_secret": USING_PLACEHOLDER_SECRET,
        "message": "JWT secret is using a default dev value. Set JWT_SECRET in .env for production." if USING_PLACEHOLDER_SECRET else None,
    }


@router.get("/users", response_model=List[User])
async def list_users(current_user: User = Depends(get_admin_user)):
    users = load_users()
    return [
        User(
            username=data["username"],
            email=data.get("email"),
            role=data.get("role", UserRole.USER),
            disabled=data.get("disabled", False),
            must_change_password=data.get("must_change_password", False),
            created_at=data.get("created_at"),
        )
        for username, data in users.items()
    ]


@router.post("/register", response_model=User)
async def register_user(
    user_data: UserCreate, current_user: User = Depends(get_admin_user)
):
    users = load_users()

    if user_data.username in users:
        raise HTTPException(status_code=400, detail="Username already exists")

    if user_data.email:
        for username, data in users.items():
            if data.get("email") == user_data.email:
                raise HTTPException(status_code=400, detail="Email already registered")

    if user_data.role not in [UserRole.ADMIN, UserRole.USER]:
        raise HTTPException(status_code=400, detail="Invalid role")

    users[user_data.username] = {
        "username": user_data.username,
        "email": user_data.email,
        "role": user_data.role,
        "hashed_password": get_password_hash(user_data.password),
        "disabled": False,
        "must_change_password": True,
        "created_at": datetime.utcnow().isoformat(),
    }
    save_users(users)

    return User(
        username=user_data.username,
        email=user_data.email,
        role=user_data.role,
        disabled=False,
        must_change_password=True,
        created_at=users[user_data.username]["created_at"],
    )


@router.put("/users/{username}", response_model=User)
async def update_user(
    username: str, user_update: UserUpdate, current_user: User = Depends(get_admin_user)
):
    users = load_users()

    if username not in users:
        raise HTTPException(status_code=404, detail="User not found")

    if username == "admin" and user_update.role == UserRole.USER:
        raise HTTPException(status_code=400, detail="Cannot demote the primary admin")

    if user_update.role and user_update.role not in [UserRole.ADMIN, UserRole.USER]:
        raise HTTPException(status_code=400, detail="Invalid role")

    if user_update.email:
        for uname, data in users.items():
            if uname != username and data.get("email") == user_update.email:
                raise HTTPException(status_code=400, detail="Email already registered")

    if user_update.email is not None:
        users[username]["email"] = user_update.email
    if user_update.role is not None:
        users[username]["role"] = user_update.role
    if user_update.disabled is not None:
        users[username]["disabled"] = user_update.disabled

    save_users(users)

    return User(
        username=users[username]["username"],
        email=users[username].get("email"),
        role=users[username].get("role", UserRole.USER),
        disabled=users[username].get("disabled", False),
        must_change_password=users[username].get("must_change_password", False),
        created_at=users[username].get("created_at"),
    )


@router.delete("/users/{username}")
async def delete_user(username: str, current_user: User = Depends(get_admin_user)):
    users = load_users()

    if username not in users:
        raise HTTPException(status_code=404, detail="User not found")

    if username == "admin":
        raise HTTPException(
            status_code=400, detail="Cannot delete the primary admin account"
        )

    if username == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    del users[username]
    save_users(users)

    return {"status": "success", "message": f"User '{username}' deleted"}
