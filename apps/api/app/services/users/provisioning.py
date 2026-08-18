from __future__ import annotations

from dataclasses import dataclass
from threading import Lock

from app.core.security import AuthenticatedUser
from app.services.usage.credits import credit_ledger


@dataclass
class Profile:
    id: str
    email: str | None
    display_name: str | None = None


class ProfileStore:
    def __init__(self) -> None:
        self._profiles: dict[str, Profile] = {}
        self._lock = Lock()

    def ensure_profile(self, user: AuthenticatedUser, default_credits: int) -> Profile:
        with self._lock:
            profile = self._profiles.get(user.id)
            if profile is None:
                profile = Profile(id=user.id, email=user.email)
                self._profiles[user.id] = profile
        credit_ledger.add_entry(
            user_id=user.id,
            amount=default_credits,
            reason="initial_demo_credits",
            idempotency_key=f"initial_credit_grant:{user.id}",
        )
        return profile


profile_store = ProfileStore()
