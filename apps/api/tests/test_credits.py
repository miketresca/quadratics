from app.services.usage.credits import CreditLedger


def test_credit_ledger_derives_user_balance():
    ledger = CreditLedger()
    ledger.add_entry(user_id="user-1", amount=20, reason="initial_demo_credits")
    ledger.add_entry(user_id="user-1", amount=-1, reason="lesson_generation")
    ledger.add_entry(user_id="user-1", amount=10, reason="admin_adjustment")
    ledger.add_entry(user_id="user-2", amount=100, reason="other_user")

    assert ledger.balance_for_user("user-1") == 29


def test_credit_ledger_idempotency_key_prevents_duplicate_grant():
    ledger = CreditLedger()

    first = ledger.add_entry(
        user_id="user-1",
        amount=20,
        reason="initial_demo_credits",
        idempotency_key="initial_credit_grant:user-1",
    )
    second = ledger.add_entry(
        user_id="user-1",
        amount=20,
        reason="initial_demo_credits",
        idempotency_key="initial_credit_grant:user-1",
    )

    assert first is not None
    assert second is None
    assert ledger.balance_for_user("user-1") == 20
