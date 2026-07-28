"""Small dependency-light smoke tests for the isolated demo API."""

from main import ChatRequest, ExerciseRequest, ProfileRequest, app, chat, exercise, health, profile


def run() -> None:
    assert health() == {"status": "ok", "service": "inner-compass-demo"}
    assert profile(ProfileRequest(responses=[3] * 10))["disclaimer"]
    assert exercise(ExerciseRequest(emotionalState="căng thẳng", intensity=4))["exercise"]
    assert chat(ChatRequest(message="Tôi muốn tự hại"))["safetyTriggered"] is True
    print("demo-web API smoke tests passed")


if __name__ == "__main__":
    run()
