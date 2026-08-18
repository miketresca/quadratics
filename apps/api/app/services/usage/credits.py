from __future__ import annotations

from dataclasses import dataclass, field
from threading import Lock
from uuid import uuid4


@dataclass(frozen=True)
class CreditEntry:
    id: str
    user_id: str
    amount: int
    reason: str
    generation_job_id: str | None = None
    idempotency_key: str | None = None
    metadata: dict[str, object] = field(default_factory=dict)


class CreditLedger:
    def __init__(self) -> None:
        self._entries: list[CreditEntry] = []
        self._idempotency_keys: set[str] = set()
        self._lock = Lock()

    def add_entry(
        self,
        *,
        user_id: str,
        amount: int,
        reason: str,
        generation_job_id: str | None = None,
        idempotency_key: str | None = None,
        metadata: dict[str, object] | None = None,
    ) -> CreditEntry | None:
        with self._lock:
            if idempotency_key and idempotency_key in self._idempotency_keys:
                return None
            entry = CreditEntry(
                id=str(uuid4()),
                user_id=user_id,
                amount=amount,
                reason=reason,
                generation_job_id=generation_job_id,
                idempotency_key=idempotency_key,
                metadata=metadata or {},
            )
            self._entries.append(entry)
            if idempotency_key:
                self._idempotency_keys.add(idempotency_key)
            return entry

    def balance_for_user(self, user_id: str) -> int:
        with self._lock:
            return sum(entry.amount for entry in self._entries if entry.user_id == user_id)


credit_ledger = CreditLedger()
