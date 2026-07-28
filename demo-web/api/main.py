"""Isolated HTTP adapter for the existing Lab 3 agent; it never returns prompts."""
from __future__ import annotations

import os
import sys
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "src"))

from app import CRISIS_RESPONSE, check_safety, run_react_agent  # noqa: E402
from providers import get_llm_provider  # noqa: E402
from tools import get_wellbeing_exercise, get_psychological_archetype, score_personality_profile  # noqa: E402

app = FastAPI(title="VinUni Inner Compass Demo API", version="0.1.0")
origins = [item.strip() for item in os.getenv("DEMO_CORS_ORIGINS", "http://localhost:3000").split(",") if item.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["POST", "GET"], allow_headers=["Content-Type"])


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation: list[dict[str, str]] = Field(default_factory=list, max_length=20)


class ProfileRequest(BaseModel):
    responses: list[int] = Field(min_length=10, max_length=10)


class ExerciseRequest(BaseModel):
    emotionalState: str = Field(min_length=1, max_length=120)
    intensity: int = Field(ge=1, le=10)


def public_trace(trace: list[Any]) -> list[str]:
    """Keep only observable trace lines; never serialize prompts or provider objects."""
    allowed = ("Thought:", "Action:", "Observation:", "Final Answer:", "Safe Fallback:", "[Parse Error]")
    return [str(item) for item in trace if str(item).startswith(allowed)]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "inner-compass-demo"}


@app.post("/api/chat")
def chat(payload: ChatRequest) -> dict[str, Any]:
    if check_safety(payload.message):
        return {"answer": CRISIS_RESPONSE, "trace": ["Safety Gate: blocked before tools"], "safetyTriggered": True}
    trace: list[str] = []
    answer = run_react_agent(payload.message, get_llm_provider(), trace=trace)
    return {"answer": answer, "trace": public_trace(trace), "safetyTriggered": False}


@app.post("/api/profile")
def profile(payload: ProfileRequest) -> dict[str, Any]:
    if any(not isinstance(item, int) or item < 1 or item > 5 for item in payload.responses):
        return {"error": "Mỗi câu trả lời phải là số nguyên từ 1 đến 5."}
    raw = score_personality_profile(payload.responses)
    archetype = get_psychological_archetype("sáng tạo, sâu sắc")
    return {"profile": raw, "archetype": archetype, "disclaimer": "Kết quả chỉ để tự phản tư, không phải chẩn đoán."}


@app.post("/api/exercise")
def exercise(payload: ExerciseRequest) -> dict[str, str]:
    return {"exercise": get_wellbeing_exercise(payload.emotionalState, payload.intensity), "disclaimer": "Gợi ý phổ thông, không thay thế chuyên gia."}
