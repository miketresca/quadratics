from app.services.animation.text_normalization import normalize_with_index_map


def test_normalize_with_index_map_lowercases_punctuation_and_whitespace():
    normalized = normalize_with_index_map("Now,   x's value!")

    assert normalized.text == "now xs value"
    assert normalized.raw_indexes == [0, 1, 2, 4, 7, 9, 10, 11, 12, 13, 14, 15]
