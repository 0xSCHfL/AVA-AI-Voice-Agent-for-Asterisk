import os
import json
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
from settings import USERS_PATH

# Configuration
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
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Password hashing
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


class User(BaseModel):
    username: str
    role: Optional[str] = "user"
    disabled: Optional[bool] = None
    must_change_password: Optional[bool] = False


class UserInDB(User):
    hashed_password: str
    must_change_password: Optional[bool] = False


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


# --- Helper Functions ---


def get_password_hash(password):
    return pwd_context.hash(password)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def load_users():
    if not os.path.exists(USERS_PATH):
        # Create default admin user with must_change_password flag
        default_users = {
            "admin": {
                "username": "admin",
                "hashed_password": get_password_hash("admin"),
                "disabled": False,
                "must_change_password": True,  # Force password change on first login
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
        role: str = payload.get("role", "user")
        print(f"DEBUG get_current_user: username={username}, role={role}")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user(username)
    if user is None:
        raise credentials_exception

    # Return user with role from token
    return User(
        username=user.username,
        role=role,
        disabled=user.disabled,
        must_change_password=user.must_change_password,
    )


def get_admin_user(current_user: User = Depends(get_current_user)):
    print(
        f"DEBUG get_admin_user: user={current_user.username}, role={current_user.role}"
    )
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return current_user


# --- Admin User Management Endpoints ---


def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return current_user


@router.get("/users", dependencies=[Depends(get_admin_user)])
async def list_users():
    users = load_users()
    return [
        {
            "username": u,
            "role": users[u].get("role", "user"),
            "disabled": users[u].get("disabled", False),
        }
        for u in users
    ]


@router.post("/users", dependencies=[Depends(get_admin_user)])
async def create_user(username: str, password: str, role: str = "user"):
    users = load_users()
    if username in users:
        raise HTTPException(status_code=400, detail="User already exists")
    users[username] = {
        "username": username,
        "hashed_password": get_password_hash(password),
        "role": role,
        "disabled": False,
        "must_change_password": False,
        "created_at": datetime.utcnow().isoformat(),
    }
    save_users(users)
    return {"status": "success", "message": f"User '{username}' created"}


class UserUpdateRequest(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    disabled: Optional[bool] = None
    new_password: Optional[str] = None


class UserCreateRequest(BaseModel):
    username: str
    email: Optional[str] = None
    password: str
    role: str = "user"


@router.put("/users/{username}", dependencies=[Depends(get_admin_user)])
async def update_user(username: str, update: UserUpdateRequest):
    users = load_users()
    if username not in users:
        raise HTTPException(status_code=404, detail="User not found")
    if update.email is not None:
        users[username]["email"] = update.email
    if update.role is not None:
        users[username]["role"] = update.role
    if update.disabled is not None:
        users[username]["disabled"] = update.disabled
    if update.new_password:
        users[username]["hashed_password"] = get_password_hash(update.new_password)
        users[username]["must_change_password"] = False
    save_users(users)
    return {"status": "success", "message": f"User '{username}' updated"}


@router.post("/register", dependencies=[Depends(get_admin_user)])
async def register_user(create: UserCreateRequest):
    users = load_users()
    if create.username in users:
        raise HTTPException(status_code=400, detail="User already exists")
    users[create.username] = {
        "username": create.username,
        "email": create.email,
        "hashed_password": get_password_hash(create.password),
        "role": create.role,
        "disabled": False,
        "must_change_password": False,
        "created_at": datetime.utcnow().isoformat(),
    }
    save_users(users)
    return {"status": "success", "message": f"User '{create.username}' created"}
