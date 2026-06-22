"""Convenience entry point: `python run.py` starts the web service."""

from __future__ import annotations

import uvicorn

if __name__ == "__main__":
    uvicorn.run("pddapp.main:app", host="0.0.0.0", port=8000, reload=False)
