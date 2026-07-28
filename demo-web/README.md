# VinUni Inner Compass — isolated demo

This folder is intentionally independent from the Lab 3 files. It contains a Next.js UI and an optional FastAPI adapter for the existing Python agent.

## Run the UI

```bash
cd demo-web/web
npm install
npm run dev
```

The UI works with deterministic mock responses when the API is unavailable. To use the Python adapter, set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `web/.env.local`.

## Run the API adapter

```bash
cd demo-web/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The demo is a non-clinical self-reflection experience. It does not diagnose, treat, authenticate users, or persist data on the backend. Browser data is stored only after consent and can be deleted from the UI.

The brand mark in `web/public/brand/` is a local demo asset inspired by VinUni's public visual language. Replace it with an approved official asset before public distribution.
