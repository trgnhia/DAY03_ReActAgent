"""Isolated HTTP adapter for the existing Lab 3 agent; it never returns prompts."""
from __future__ import annotations

import json
import os
import re
import sys
import time
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
# The lab's .env remains outside demo-web and is never copied or returned by this API.
load_dotenv(os.path.join(ROOT, ".env"), override=False)
sys.path.insert(0, os.path.join(ROOT, "src"))

from app import (  # noqa: E402
    CRISIS_RESPONSE,
    MAX_ITERATIONS,
    build_react_prompt,
    check_safety,
    execute_tool,
    is_provider_error,
    parse_agent_output,
    run_react_agent,
)
from providers import get_llm_provider  # noqa: E402
from tools import get_wellbeing_exercise, get_psychological_archetype, score_personality_profile  # noqa: E402

app = FastAPI(title="VinUni Inner Compass Demo API", version="0.1.0")
origins = [item.strip() for item in os.getenv("DEMO_CORS_ORIGINS", "http://localhost:3000").split(",") if item.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["POST", "GET"], allow_headers=["Content-Type"])


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation: list[dict[str, str]] = Field(default_factory=list, max_length=20)
    profileContext: dict[str, float] | None = None


class ProfileRequest(BaseModel):
    responses: list[int] = Field(min_length=10, max_length=10)


class ExerciseRequest(BaseModel):
    emotionalState: str = Field(min_length=1, max_length=120)
    intensity: int = Field(ge=1, le=10)


def public_trace(trace: list[Any]) -> list[str]:
    """Keep only observable trace lines; never serialize prompts or provider objects."""
    allowed = ("Thought:", "Action:", "Observation:", "Final Answer:", "Safe Fallback:", "[Parse Error]")
    visible: list[str] = []
    for item in trace:
        # src/app.py stores the trace as a Markdown block. Extract only the
        # observable lines and discard headings/fences/question text.
        for line in str(item).splitlines():
            line = line.strip()
            if line.startswith(allowed):
                visible.append(line)
    return visible


def sse(event: str, payload: dict[str, Any]) -> str:
    """Encode one Server-Sent Event without exposing prompt/provider internals."""
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def text_chunks(text: str, size: int = 12):
    for index in range(0, len(text), size):
        yield text[index : index + size]


TRAIT_LABELS = {
    "openness": "Cởi mở (Openness)",
    "conscientiousness": "Tận tụy / Cầu toàn (Conscientiousness)",
    "extraversion": "Hướng ngoại (Extraversion)",
    "agreeableness": "Hòa đồng (Agreeableness)",
    "emotional_sensitivity": "Độ nhạy cảm cảm xúc (Emotional Sensitivity)",
}


def profile_context_text(scores: dict[str, float] | None) -> str:
    """Add browser-owned self-check data as explicit, non-clinical chat context."""
    if not scores:
        return ""
    safe_scores = []
    for key, label in TRAIT_LABELS.items():
        value = scores.get(key)
        if isinstance(value, (int, float)) and 1 <= float(value) <= 5:
            safe_scores.append(f"- {label}: {float(value):.1f}/5.0")
    if not safe_scores:
        return ""
    return (
        "\nHồ sơ self-check của sinh viên trong phiên trình duyệt này (dữ liệu do người dùng cung cấp; "
        "chỉ để tự phản tư, không phải chẩn đoán):\n"
        + "\n".join(safe_scores)
        + "\nHãy dùng bối cảnh này khi phù hợp, không khẳng định nó là sự thật tuyệt đối.\n"
    )


def stream_react(payload: ChatRequest):
    """Streaming presentation adapter; ReAct policy/parser/tools remain from src/app.py."""
    if check_safety(payload.message):
        yield sse("stage", {"type": "guardrail", "content": "Safety Gate: phát hiện nội dung khủng hoảng; không gọi LLM hoặc tool."})
        yield sse("final_start", {})
        for chunk in text_chunks(CRISIS_RESPONSE):
            yield sse("final_delta", {"content": chunk})
            time.sleep(0.012)
        yield sse("final_end", {"safetyTriggered": True})
        return

    provider = get_llm_provider()
    transcript = f"Question: {payload.message}\n" + profile_context_text(payload.profileContext)
    seen_actions: dict[tuple[str, tuple[str, ...]], int] = {}
    final_answer: str | None = None
    provider_failed = False

    for step in range(1, MAX_ITERATIONS + 1):
        yield sse("stage", {"type": "status", "step": step, "content": f"Bước {step}/{MAX_ITERATIONS}: đang gọi model…"})
        raw = provider.generate(transcript, system_prompt=build_react_prompt())

        if is_provider_error(raw):
            provider_failed = True
            yield sse("stage", {"type": "guardrail", "step": step, "content": "Provider không phản hồi hợp lệ; agent dừng an toàn."})
            break

        parsed = parse_agent_output(raw)
        if parsed["thought"]:
            yield sse("stage", {"type": "thought", "step": step, "content": parsed["thought"]})

        if parsed["type"] == "final":
            final_answer = parsed["answer"]
            break

        if parsed["type"] == "error":
            observation = parsed["message"]
            yield sse("stage", {"type": "guardrail", "step": step, "content": observation})
            transcript += f"{raw.strip()}\nObservation: {observation}\n"
            continue

        tool, args = parsed["tool"], parsed["args"]
        action = f"{tool}[{', '.join(args)}]"
        yield sse("stage", {"type": "action", "step": step, "content": action})
        key = (tool, tuple(args))
        seen_actions[key] = seen_actions.get(key, 0) + 1
        if seen_actions[key] > 1:
            observation = f"LỖI LẶP: Action {action} đã được gọi; hãy đổi hướng hoặc trả lời dựa trên dữ liệu hiện có."
        else:
            observation = execute_tool(tool, args)
        yield sse("stage", {"type": "observation", "step": step, "content": observation})
        transcript += f"Thought: {parsed['thought']}\nAction: {action}\nObservation: {observation}\n"

    if final_answer is None:
        final_answer = (
            "Hệ thống chưa kết nối được tới LLM Provider. Agent đã dừng an toàn, không bịa câu trả lời."
            if provider_failed
            else f"Agent đã đạt giới hạn {MAX_ITERATIONS} bước nhưng chưa có đủ dữ liệu đáng tin cậy để trả lời an toàn."
        )
        yield sse("stage", {"type": "guardrail", "content": "Safe fallback được kích hoạt."})

    yield sse("final_start", {})
    for chunk in text_chunks(final_answer):
        yield sse("final_delta", {"content": chunk})
        time.sleep(0.012)
    yield sse("final_end", {"safetyTriggered": False})


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


@app.post("/api/chat/stream")
def chat_stream(payload: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        stream_react(payload),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/profile")
def profile(payload: ProfileRequest) -> dict[str, Any]:
    if any(not isinstance(item, int) or item < 1 or item > 5 for item in payload.responses):
        return {"error": "Mỗi câu trả lời phải là số nguyên từ 1 đến 5."}
    raw = score_personality_profile(payload.responses)
    match = re.search(r"Kết quả điểm số hồ sơ tính cách:\s*(\{[^\n]+\})", raw)
    if not match:
        return {"error": raw}
    scores = json.loads(match.group(1))
    archetype = get_psychological_archetype("sáng tạo, sâu sắc")
    return {
        "profile": raw,
        "scores": scores,
        "traits": [{"key": key, "label": label, "value": scores[key]} for key, label in TRAIT_LABELS.items()],
        "archetype": archetype,
        "disclaimer": "Kết quả chỉ để tự phản tư, không phải chẩn đoán.",
    }


@app.post("/api/exercise")
def exercise(payload: ExerciseRequest) -> dict[str, Any]:
    raw = get_wellbeing_exercise(payload.emotionalState, payload.intensity)
    steps = [re.sub(r"^\d+\.\s*", "", line).strip() for line in raw.splitlines() if re.match(r"^\d+\.\s*", line)]
    title = raw.splitlines()[0].replace("🧘", "").replace("🌿", "").replace("🌱", "").strip()
    return {
        "exercise": raw,
        "title": title,
        "state": payload.emotionalState,
        "intensity": payload.intensity,
        "steps": steps,
        "disclaimer": "Gợi ý hỗ trợ phổ thông, không thay thế chuyên gia.",
    }
