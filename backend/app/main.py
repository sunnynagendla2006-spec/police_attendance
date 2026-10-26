"""
PoliceHQ GeoAttend - App Module ASGI Re-export
Allows both `uvicorn main:app` and `uvicorn app.main:app` to function seamlessly.
"""
import sys
import os

# Ensure backend root is on sys.path
backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from main import app

__all__ = ["app"]
