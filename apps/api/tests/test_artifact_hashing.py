from app.services.artifacts.hashing import artifact_input_hash


def test_artifact_input_hash_is_stable_for_key_order():
    left = artifact_input_hash({"voice": "a", "settings": {"stability": 0.5, "speed": 1}})
    right = artifact_input_hash({"settings": {"speed": 1, "stability": 0.5}, "voice": "a"})

    assert left == right
    assert left.startswith("sha256:")


def test_artifact_input_hash_changes_for_material_inputs():
    first = artifact_input_hash({"speechText": "x squared plus five x", "voice": "a"})
    second = artifact_input_hash({"speechText": "x squared plus five x", "voice": "b"})

    assert first != second
