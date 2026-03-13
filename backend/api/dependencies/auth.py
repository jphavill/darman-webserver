import os
import secrets

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


bearer_scheme = HTTPBearer(auto_error=False)


def require_write_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> None:
    admin_api_token = os.getenv("ADMIN_API_TOKEN")
    if not admin_api_token:
        raise HTTPException(status_code=503, detail="Write token is not configured")

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing bearer token")

    if not secrets.compare_digest(credentials.credentials, admin_api_token):
        raise HTTPException(status_code=401, detail="Invalid bearer token")
