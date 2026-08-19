from pathlib import Path


def test_math_and_lesson_services_do_not_import_openai_provider():
    service_files = [
        *Path("app/services/math").glob("*.py"),
        *Path("app/services/lessons").glob("*.py"),
    ]

    for path in service_files:
        content = path.read_text()
        assert "providers.openai" not in content
        assert "from openai" not in content
        assert "import openai" not in content


def test_animation_core_does_not_import_openai_provider():
    service_files = [
        path
        for path in Path("app/services/animation").glob("*.py")
        if path.name != "base.py"
    ]

    for path in service_files:
        content = path.read_text()
        assert "providers.openai" not in content
        assert "from openai" not in content
        assert "import openai" not in content
