const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json() as Promise<T>;
}

export type TraitScore = { key: string; label: string; value: number };
export type ProfileResult = { profile: string; scores: Record<string, number>; traits: TraitScore[]; archetype: string; disclaimer: string };
export type ExerciseResult = { exercise: string; title: string; state: string; intensity: number; steps: string[]; disclaimer: string };
export type ChatResult = { answer: string; trace: string[]; safetyTriggered: boolean };
export type AgentStage = "status" | "thought" | "action" | "observation" | "guardrail";
export type StreamEvent =
  | { kind: "stage"; type: AgentStage; content: string; step?: number }
  | { kind: "final_start" }
  | { kind: "final_delta"; content: string }
  | { kind: "final_end"; safetyTriggered: boolean };

export async function scoreProfile(responses: number[]): Promise<ProfileResult> {
  return request<ProfileResult>("/api/profile", { responses });
}

export async function sendChat(message: string, conversation: { role: string; content: string }[]): Promise<ChatResult> {
  return request<ChatResult>("/api/chat", { message, conversation });
}

export async function sendChatStream(
  message: string,
  conversation: { role: string; content: string }[],
  profileContext: Record<string, number> | undefined,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ message, conversation, profileContext }),
  });
  if (!response.ok || !response.body) throw new Error(`Streaming API ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const eventName = frame.match(/^event: (.+)$/m)?.[1];
      const rawData = frame.match(/^data: (.+)$/m)?.[1];
      if (!eventName || !rawData) continue;
      const data = JSON.parse(rawData) as Record<string, unknown>;
      if (eventName === "stage") onEvent({ kind: "stage", type: data.type as AgentStage, content: String(data.content ?? ""), step: typeof data.step === "number" ? data.step : undefined });
      if (eventName === "final_start") onEvent({ kind: "final_start" });
      if (eventName === "final_delta") onEvent({ kind: "final_delta", content: String(data.content ?? "") });
      if (eventName === "final_end") onEvent({ kind: "final_end", safetyTriggered: Boolean(data.safetyTriggered) });
    }
    if (done) break;
  }
}

export async function getExercise(emotionalState: string, intensity: number): Promise<ExerciseResult> {
  return request<ExerciseResult>("/api/exercise", { emotionalState, intensity });
}

export function mockProfile(): ProfileResult {
  return {
    profile: "Kết quả tham khảo: Cởi mở 4.5/5 · Tận tâm 4.0/5 · Hướng ngoại 2.5/5 · Hợp tác 4.0/5 · Nhạy cảm cảm xúc 3.5/5.",
    scores: { openness: 4.5, conscientiousness: 4, extraversion: 2.5, agreeableness: 4, emotional_sensitivity: 3.5 },
    traits: [
      { key: "openness", label: "Cởi mở (Openness)", value: 4.5 },
      { key: "conscientiousness", label: "Tận tụy / Cầu toàn", value: 4 },
      { key: "extraversion", label: "Hướng ngoại (Extraversion)", value: 2.5 },
      { key: "agreeableness", label: "Hòa đồng (Agreeableness)", value: 4 },
      { key: "emotional_sensitivity", label: "Độ nhạy cảm cảm xúc", value: 3.5 },
    ],
    archetype: "🎭 KHÍA CẠNH ẨN: NGƯỜI QUAN SÁT SẮC SẢO\nBạn có thể lặng lẽ nhìn thấy những điều người khác bỏ qua. Sự sâu sắc này là một thế mạnh khi được cân bằng với việc chia sẻ nhu cầu của chính mình.",
    disclaimer: "Kết quả chỉ để tự phản tư, không phải chẩn đoán.",
  };
}

export function mockChat(message: string): ChatResult {
  return { answer: `Mình nghe thấy điều bạn chia sẻ: “${message}”. Hãy thử gọi tên cảm xúc đang có mặt, rồi chọn một bước nhỏ bạn kiểm soát được hôm nay. Đây là gợi ý tự phản tư, không thay thế chuyên gia.`, trace: ["Thought: Nhận diện chủ đề cảm xúc từ câu hỏi.", "Action: get_wellbeing_exercise[\"tự phản tư\", 3]", "Observation: Gợi ý grounding và viết ra một bước nhỏ.", "Final Answer: Đã đưa ra gợi ý hỗ trợ phi lâm sàng."], safetyTriggered: false };
}

export function mockExercise(): ExerciseResult {
  return { title: "Grounding 5–4–3–2–1", state: "căng thẳng", intensity: 4, steps: ["Nhìn quanh và gọi tên 5 điều bạn thấy.", "Gọi tên 4 điều bạn chạm được, 3 âm thanh, 2 mùi hương và 1 vị.", "Thực hiện chậm trong khoảng 5 phút."], exercise: "Grounding 5–4–3–2–1", disclaimer: "Gợi ý hỗ trợ phổ thông, không thay thế chuyên gia." };
}
