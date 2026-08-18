import ast
from pathlib import Path


def test_math_and_lesson_services_do_not_import_provider_modules():
    roots = [Path("app/services/math"), Path("app/services/lessons")]
    forbidden = {"elevenlabs", "heygen"}

    for root in roots:
        for path in root.rglob("*.py"):
            tree = ast.parse(path.read_text())
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    imported = {alias.name.split(".")[0] for alias in node.names}
                    assert forbidden.isdisjoint(imported)
                if isinstance(node, ast.ImportFrom) and node.module:
                    assert node.module.split(".")[0] not in forbidden
