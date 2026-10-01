"""Redact CI credentials before publishing retained Playwright evidence."""
import base64
import io
import os
from pathlib import Path
import urllib.parse
import zipfile


def redact(data, secrets):
    if data.startswith(b"PK\x03\x04"):
        output = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(data)) as source:
            with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as target:
                for entry in source.infolist():
                    target.writestr(entry, redact(source.read(entry), secrets))
        return output.getvalue()
    for secret in secrets:
        data = data.replace(secret, b"[REDACTED-CI-CREDENTIAL]")
    return data


if __name__ == "__main__":
    values = [os.environ.get(name, "") for name in (
        "ANTHROPIC_API_KEY", "PLASMO_PUBLIC_ANTHROPIC_API_KEY",
        "PLASMO_PUBLIC_ABSMARTLY_API_KEY", "PLASMO_PUBLIC_ANTHROPIC_ENDPOINT",
    )]
    secrets = set()
    for value in values:
        if value:
            secrets.update((value.encode(), urllib.parse.quote(value, safe="").encode(),
                            base64.b64encode(value.encode())))
    for file in Path("test-results").rglob("*"):
        if file.is_file():
            data = file.read_bytes()
            sanitized = redact(data, secrets)
            if data != sanitized:
                file.write_bytes(sanitized)
