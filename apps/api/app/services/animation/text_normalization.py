from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class NormalizedText:
    text: str
    raw_indexes: list[int]


def normalize_with_index_map(value: str) -> NormalizedText:
    chars: list[str] = []
    raw_indexes: list[int] = []
    previous_was_space = False
    pending_separator_index: int | None = None
    pending_separator_is_punctuation = False

    for index, char in enumerate(value.lower()):
        if char.isalnum():
            if pending_separator_index is not None and chars and not previous_was_space:
                chars.append(" ")
                raw_indexes.append(pending_separator_index)
                previous_was_space = True
            chars.append(char)
            raw_indexes.append(index)
            previous_was_space = False
            pending_separator_index = None
            pending_separator_is_punctuation = False
            continue
        if char.isspace():
            if chars and not previous_was_space and (
                pending_separator_index is None or pending_separator_is_punctuation
            ):
                pending_separator_index = index
                pending_separator_is_punctuation = False
            continue
        if char == "'":
            continue
        if chars and not previous_was_space and pending_separator_index is None:
            pending_separator_index = index
            pending_separator_is_punctuation = True

    while chars and chars[-1] == " ":
        chars.pop()
        raw_indexes.pop()

    return NormalizedText(text="".join(chars), raw_indexes=raw_indexes)
