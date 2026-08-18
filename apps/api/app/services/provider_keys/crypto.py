from cryptography.fernet import Fernet, InvalidToken


class ProviderKeyCryptoError(ValueError):
    pass


class ProviderKeyCipher:
    def __init__(self, encryption_key: str) -> None:
        if not encryption_key:
            raise ProviderKeyCryptoError("Provider key encryption is not configured")
        try:
            self._fernet = Fernet(encryption_key.encode("utf-8"))
        except ValueError as exc:
            raise ProviderKeyCryptoError("Provider key encryption key is invalid") from exc

    def encrypt(self, api_key: str) -> str:
        return self._fernet.encrypt(api_key.encode("utf-8")).decode("utf-8")

    def decrypt(self, encrypted_api_key: str) -> str:
        try:
            return self._fernet.decrypt(encrypted_api_key.encode("utf-8")).decode("utf-8")
        except InvalidToken as exc:
            raise ProviderKeyCryptoError("Provider key could not be decrypted") from exc


def key_hint(api_key: str) -> str:
    stripped = api_key.strip()
    if len(stripped) <= 4:
        return "••••"
    prefix = stripped[:3] if len(stripped) >= 8 else ""
    return f"{prefix}...{stripped[-4:]}" if prefix else f"••••{stripped[-4:]}"
