import pytest

from app.services.math.parser import EquationParseError, parse_equation


def test_rejects_oversized_input():
    with pytest.raises(EquationParseError):
        parse_equation(f"{'x+' * 250}0 = 0")


def test_rejects_excessive_exponent():
    with pytest.raises(EquationParseError):
        parse_equation("x^99 + 1 = 0")


def test_rejects_unsupported_tokens():
    with pytest.raises(EquationParseError):
        parse_equation("__import__('os').system('echo bad') = 0")
