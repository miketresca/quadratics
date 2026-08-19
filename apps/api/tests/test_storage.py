from app.services.storage.media_store import InMemoryMediaStore


def test_in_memory_media_store_records_private_object_metadata():
    store = InMemoryMediaStore(bucket="generated-media")

    stored = store.put(
        path="user-1/generation-1/narration/artifact-1/script-factor.mp3",
        content=b"fake-mp3",
        content_type="audio/mpeg",
        metadata={"scriptSegmentId": "script_factor"},
    )

    assert stored.bucket == "generated-media"
    assert stored.path.endswith("script-factor.mp3")
    assert stored.size_bytes == len(b"fake-mp3")
    assert stored.checksum_sha256 is not None
    assert store.get(stored.path) == b"fake-mp3"
