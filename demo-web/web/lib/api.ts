const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json() as Promise<T>;
}

export type ProfileResult = { profile: string; archetype: string; disclaimer: string };
export type ChatResult = { answer: string; trace: string[]; safetyTriggered: boolean };

export async function scoreProfile(responses: number[]): Promise<ProfileResult> {
  return request<ProfileResult>("/api/profile", { responses });
}

export async function sendChat(message: string, conversation: { role: string; content: string }[]): Promise<ChatResult> {
  return request<ChatResult>("/api/chat", { message, conversation });
}

export async function getExercise(emotionalState: string, intensity: number): Promise<{ exercise: string; disclaimer: string }> {
  return request<{ exercise: string; disclaimer: string }>("/api/exercise", { emotionalState, intensity });
}

export function mockProfile(): ProfileResult {
  return {
    profile: "Kết quả tham khảo: Cởi mở 4.5/5 · Tận tâm 4.0/5 · Hướng ngoại 2.5/5 · Hợp tác 4.0/5 · Nhạy cảm cảm xúc 3.5/5.",
    archetype: "🎭 KHÍA CẠNH ẨN: NGƯỜI QUAN SÁT SẮC SẢO\nBạn có thể lặng lẽ nhìn thấy những điều người khác bỏ qua. Sự sâu sắc này là một thế mạnh khi được cân bằng với việc chia sẻ nhu cầu của chính mình.",
    disclaimer: "Kết quả chỉ để tự phản tư, không phải chẩn đoán.",
  };
}

export function mockChat(message: string): ChatResult {
  return { answer: `Mình nghe thấy điều bạn chia sẻ: “${message}”. Hãy thử gọi tên cảm xúc đang có mặt, rồi chọn một bước nhỏ bạn kiểm soát được hôm nay. Đây là gợi ý tự phản tư, không thay thế chuyên gia.`, trace: ["Thought: Nhận diện chủ đề cảm xúc từ câu hỏi.", "Action: get_wellbeing_exercise[\"tự phản tư\", 3]", "Observation: Gợi ý grounding và viết ra một bước nhỏ.", "Final Answer: Đã đưa ra gợi ý hỗ trợ phi lâm sàng."], safetyTriggered: false };
}

export function mockExercise(): { exercise: string; disclaimer: string } {
  return { exercise: "Grounding 5–4–3–2–1\n\nNhìn quanh và gọi tên 5 điều bạn thấy, 4 điều bạn chạm được, 3 âm thanh, 2 mùi hương và 1 vị đang có mặt. Thực hiện chậm trong khoảng 5 phút.", disclaimer: "Gợi ý hỗ trợ phổ thông, không thay thế chuyên gia." };
}
