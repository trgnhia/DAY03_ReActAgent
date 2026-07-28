"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight, HeartHandshake, LockKeyhole, MessageCircle, RotateCcw, Send, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getExercise, mockChat, mockExercise, mockProfile, scoreProfile, sendChat, type ChatResult, type ProfileResult } from "@/lib/api";

type Screen = "home" | "quiz" | "insight" | "chat";
type Message = { role: "user" | "assistant"; content: string; trace?: string[] };
type SessionSnapshot = { savedAt: number; messages: Message[]; answers: number[]; profile?: ProfileResult };
const questions = [
  "Tôi thường tò mò về những ý tưởng và trải nghiệm mới.", "Tôi có thể kiên trì hoàn thành điều mình đã bắt đầu.",
  "Tôi cảm thấy được nạp năng lượng khi ở cùng mọi người.", "Tôi thường để ý và tôn trọng cảm xúc của người khác.",
  "Tôi nhận ra khá nhanh khi cảm xúc của mình thay đổi.", "Tôi thích nhìn một vấn đề từ nhiều góc độ khác nhau.",
  "Tôi thường lập kế hoạch trước khi bắt tay vào việc.", "Tôi dễ chủ động bắt chuyện trong một nhóm mới.",
  "Tôi có thể tìm điểm chung khi làm việc với người khác.", "Tôi thường cần một khoảng lặng để xử lý cảm xúc.",
];

const spring = { type: "spring" as const, stiffness: 280, damping: 24 };

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [consentOpen, setConsentOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [answers, setAnswers] = useState<number[]>(Array(10).fill(0));
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<ProfileResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "Chào bạn, mình là Inner Compass. Bạn muốn bắt đầu từ một cảm xúc, một thói quen, hay điều đang khiến bạn tò mò về chính mình?" }]);
  const [draft, setDraft] = useState("");
  const [traceOpen, setTraceOpen] = useState(false);
  const [exercise, setExercise] = useState<{ exercise: string; disclaimer: string }>();

  useEffect(() => {
    const raw = window.localStorage.getItem("inner-compass-consent");
    const session = window.localStorage.getItem("inner-compass-session");
    let sessionAllowed = false;
    if (raw) {
      try {
        const consentRecord = JSON.parse(raw) as { accepted: boolean; savedAt: number };
        if (consentRecord.accepted && Date.now() - consentRecord.savedAt < 24 * 60 * 60 * 1000) { setConsent(true); sessionAllowed = true; }
        else window.localStorage.removeItem("inner-compass-consent");
      } catch { window.localStorage.removeItem("inner-compass-consent"); }
    }
    if (session && sessionAllowed) {
      try {
        const snapshot = JSON.parse(session) as SessionSnapshot;
        if (Date.now() - snapshot.savedAt < 24 * 60 * 60 * 1000) {
          setMessages(snapshot.messages); setAnswers(snapshot.answers); setProfile(snapshot.profile);
        } else window.localStorage.removeItem("inner-compass-session");
      } catch { window.localStorage.removeItem("inner-compass-session"); }
    } else if (session) window.localStorage.removeItem("inner-compass-session");
  }, []);

  useEffect(() => {
    if (!consent) return;
    const snapshot: SessionSnapshot = { savedAt: Date.now(), messages, answers, profile };
    window.localStorage.setItem("inner-compass-session", JSON.stringify(snapshot));
  }, [consent, messages, answers, profile]);

  const progress = Math.round(((step + 1) / questions.length) * 100);
  const answered = useMemo(() => answers.filter(Boolean).length, [answers]);

  function begin() { setConsentOpen(true); }
  function acceptConsent(accepted: boolean) {
    setConsent(accepted); setConsentOpen(false); setScreen("quiz");
    if (accepted) window.localStorage.setItem("inner-compass-consent", JSON.stringify({ accepted: true, savedAt: Date.now() }));
  }
  function setAnswer(value: number) {
    setAnswers((current) => current.map((item, index) => index === step ? value : item));
  }
  async function finishQuiz() {
    setLoading(true); setError("");
    try { setProfile(await scoreProfile(answers)); }
    catch { setProfile(mockProfile()); setError("API đang ở chế độ demo offline — mình hiển thị một kết quả mô phỏng an toàn."); }
    setLoading(false); setScreen("insight");
  }
  function clearData() {
    window.localStorage.removeItem("inner-compass-consent"); window.localStorage.removeItem("inner-compass-session");
    setConsent(false); setAnswers(Array(10).fill(0)); setProfile(undefined); setExercise(undefined); setMessages([{ role: "assistant", content: "Dữ liệu phiên đã được xóa. Khi bạn sẵn sàng, chúng ta có thể bắt đầu lại." }]); setScreen("home");
  }
  async function submitChat(event: FormEvent) {
    event.preventDefault(); const text = draft.trim(); if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }]; setMessages(next); setDraft(""); setLoading(true); setError("");
    try { const result: ChatResult = await sendChat(text, next); setMessages([...next, { role: "assistant", content: result.answer, trace: result.trace }]); if (result.safetyTriggered) setError("Mình ưu tiên an toàn của bạn. Hãy tìm một người thật để đồng hành ngay lúc này."); }
    catch { const result = mockChat(text); setMessages([...next, { role: "assistant", content: result.answer, trace: result.trace }]); setError("Đang dùng chế độ demo offline."); }
    setLoading(false);
  }

  return <main className="grain min-h-screen overflow-hidden">
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <button onClick={() => setScreen("home")} className="focus-ring rounded-xl" aria-label="Về trang chủ"><img src="/brand/vinuni-demo-mark.svg" alt="VinUni Inner Compass" className="h-12 w-auto" /></button>
      <div className="flex items-center gap-2"><span className="hidden rounded-full bg-white/70 px-3 py-2 text-xs font-semibold text-slate-500 sm:inline">PHIÊN TỰ PHẢN TƯ</span><button onClick={clearData} className="focus-ring rounded-full border border-slate-200 bg-white/75 p-2.5 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600" title="Xóa dữ liệu phiên"><Trash2 size={16} /></button></div>
    </nav>
    <AnimatePresence mode="wait">
      {screen === "home" && <HomeScreen begin={begin} goChat={() => setScreen("chat")} />}
      {screen === "quiz" && <QuizScreen step={step} setStep={setStep} progress={progress} question={questions[step]} answer={answers[step]} setAnswer={setAnswer} back={() => setScreen("home")} next={step === questions.length - 1 ? finishQuiz : () => setStep(step + 1)} answered={answered} loading={loading} />}
      {screen === "insight" && <InsightScreen profile={profile ?? mockProfile()} exercise={exercise} error={error} goChat={() => setScreen("chat")} loadExercise={async () => { setLoading(true); try { setExercise(await getExercise("căng thẳng", 4)); } catch { setExercise(mockExercise()); } finally { setLoading(false); } }} restart={() => { setStep(0); setAnswers(Array(10).fill(0)); setExercise(undefined); setScreen("quiz"); }} />}
      {screen === "chat" && <ChatScreen messages={messages} draft={draft} setDraft={setDraft} submit={submitChat} loading={loading} error={error} traceOpen={traceOpen} setTraceOpen={setTraceOpen} back={() => setScreen("home")} />}
    </AnimatePresence>
    <AnimatePresence>{consentOpen && <ConsentModal accept={acceptConsent} close={() => setConsentOpen(false)} />}</AnimatePresence>
  </main>;
}

function HomeScreen({ begin, goChat }: { begin: () => void; goChat: () => void }) {
  return <motion.section key="home" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-8 sm:pt-20">
    <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_.9fr]">
      <div><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-100 bg-white/80 px-3 py-2 text-xs font-bold uppercase tracking-[.18em] text-[#c41230]"><Sparkles size={14} /> một góc nhỏ để trở về</div><h1 className="max-w-3xl text-5xl font-black leading-[.98] tracking-[-.06em] text-[#071c35] sm:text-7xl">Có một phiên bản<br /><span className="text-[#c41230]">chưa được gọi tên</span><span className="text-[#f6b333]">.</span></h1><p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">Inner Compass giúp bạn lắng nghe cảm xúc, nhận ra những thế mạnh thầm lặng và chọn một bước nhỏ dễ thực hiện hôm nay.</p><div className="mt-9 flex flex-wrap gap-3"><button onClick={begin} className="focus-ring group inline-flex items-center gap-3 rounded-full bg-[#c41230] px-6 py-3.5 font-bold text-white shadow-[0_12px_30px_-12px_#c41230] transition hover:-translate-y-1 hover:bg-[#a60f29]">Bắt đầu khám phá <ArrowRight size={18} className="transition group-hover:translate-x-1" /></button><button onClick={goChat} className="focus-ring inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-6 py-3.5 font-bold text-[#071c35] transition hover:-translate-y-1 hover:border-[#f6b333] hover:shadow-lg"><MessageCircle size={18} /> Trò chuyện ngay</button></div><p className="mt-5 flex items-center gap-2 text-xs text-slate-500"><LockKeyhole size={14} /> Dữ liệu chỉ ở trong phiên trình duyệt khi bạn đồng ý.</p></div>
      <div className="relative mx-auto w-full max-w-md"><div className="absolute -inset-5 rounded-[3rem] bg-[#f6b333]/20 blur-3xl" /><motion.div initial={{ rotate: 4, y: 16 }} animate={{ rotate: -2, y: 0 }} transition={{ ...spring, delay: .15 }} className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-[#071c35] p-6 text-white shadow-2xl"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[.2em] text-slate-300">Today’s check-in</span><span className="rounded-full bg-white/10 px-3 py-1 text-xs text-[#f6b333]">01 / 05</span></div><div className="mt-16"><div className="mb-5 flex gap-2"><span className="h-2 w-2 rounded-full bg-[#c41230]" /><span className="h-2 w-2 rounded-full bg-[#f6b333]" /><span className="h-2 w-2 rounded-full bg-white/30" /></div><p className="text-3xl font-bold leading-tight">Bạn thường<br /><span className="text-[#f6b333]">nạp lại năng lượng</span><br />bằng cách nào?</p><div className="mt-8 space-y-3"><div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm transition hover:bg-white/20">Ở một mình với những điều mình thích</div><div className="rounded-2xl border border-[#f6b333] bg-[#f6b333]/10 p-4 text-sm">Ở cạnh một người khiến mình thấy an toàn</div></div></div></motion.div><div className="absolute -bottom-7 -left-8 rounded-2xl border border-slate-100 bg-white p-4 shadow-xl"><div className="flex items-center gap-3"><div className="rounded-xl bg-red-50 p-2 text-[#c41230]"><HeartHandshake size={20} /></div><div><p className="text-xs text-slate-500">Gợi ý hôm nay</p><p className="font-bold text-[#071c35]">Chậm lại cũng là tiến lên.</p></div></div></div></div>
    </div><div className="mt-24 grid gap-4 border-t border-slate-200/80 pt-8 sm:grid-cols-3"><Feature icon={<ShieldCheck />} title="Phi lâm sàng" text="Một không gian tự phản tư, không phán xét." /><Feature icon={<Sparkles />} title="Có căn cứ" text="Insight đến từ câu trả lời của chính bạn." /><Feature icon={<LockKeyhole />} title="Riêng tư" text="Bạn luôn kiểm soát dữ liệu của mình." /></div>
  </motion.section>;
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="rounded-2xl p-4 transition hover:bg-white hover:shadow-lg"><div className="mb-3 w-fit rounded-xl bg-[#071c35] p-2.5 text-[#f6b333]">{icon}</div><p className="font-bold text-[#071c35]">{title}</p><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></div>; }

function QuizScreen({ step, setStep, progress, question, answer, setAnswer, back, next, answered, loading }: { step: number; setStep: (n: number) => void; progress: number; question: string; answer: number; setAnswer: (n: number) => void; back: () => void; next: () => void; answered: number; loading: boolean }) {
  return <motion.section key="quiz" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:px-8 sm:pt-20"><button onClick={back} className="focus-ring mb-10 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#c41230]"><ChevronLeft size={18} /> Thoát phiên</button><div className="mb-12 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#c41230]">Self-check · {String(step + 1).padStart(2, "0")} / 10</p><h2 className="mt-3 text-4xl font-black tracking-[-.04em] text-[#071c35] sm:text-5xl">Lắng nghe điều<br />đang có mặt.</h2></div><p className="text-3xl font-black text-[#f6b333]">{progress}%</p></div><div className="h-2 overflow-hidden rounded-full bg-slate-200"><motion.div className="h-full rounded-full bg-[#c41230]" animate={{ width: `${progress}%` }} /></div><div className="mt-12 rounded-[2rem] border border-white bg-white p-6 shadow-xl sm:p-10"><p className="text-xl font-bold leading-9 text-[#071c35] sm:text-2xl">{question}</p><div className="mt-9 grid gap-3 sm:grid-cols-5">{[1, 2, 3, 4, 5].map((value) => <button key={value} onClick={() => setAnswer(value)} className={`focus-ring rounded-2xl border p-4 text-center transition hover:-translate-y-1 hover:border-[#f6b333] hover:shadow-md ${answer === value ? "border-[#c41230] bg-red-50 text-[#c41230]" : "border-slate-200 bg-slate-50 text-slate-600"}`}><span className="block text-2xl font-black">{value}</span><span className="mt-1 block text-[11px] font-semibold">{value === 1 ? "Không đúng" : value === 5 ? "Rất đúng" : ""}</span></button>)}</div><div className="mt-10 flex items-center justify-between"><p className="text-xs text-slate-400">Đã trả lời {answered}/10</p><button disabled={!answer || loading} onClick={next} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#071c35] px-5 py-3 font-bold text-white transition hover:-translate-y-1 hover:bg-[#102f55] disabled:cursor-not-allowed disabled:opacity-40">{loading ? "Đang soi chiếu…" : step === 9 ? "Xem insight" : "Tiếp tục"} {step === 9 ? <Sparkles size={17} /> : <ChevronRight size={17} />}</button></div></div></motion.section>;
}

function InsightScreen({ profile, exercise, error, goChat, loadExercise, restart }: { profile: ProfileResult; exercise?: { exercise: string; disclaimer: string }; error: string; goChat: () => void; loadExercise: () => void; restart: () => void }) {
  return <motion.section key="insight" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-8 sm:pt-20"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#c41230]">Your inner compass</p><h2 className="mt-3 text-5xl font-black tracking-[-.06em] text-[#071c35]">Một góc nhìn<br /><span className="text-[#c41230]">dịu dàng hơn.</span></h2></div><button onClick={restart} className="focus-ring inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold transition hover:border-[#f6b333]"><RotateCcw size={16} /> Làm lại</button></div>{error && <div className="mt-6 rounded-2xl border border-[#f6b333]/40 bg-[#fff8e8] p-4 text-sm text-[#8b5e00]">{error}</div>}<div className="mt-10 grid gap-5 lg:grid-cols-[1fr_1.1fr]"><div className="rounded-[2rem] bg-[#071c35] p-7 text-white shadow-xl sm:p-10"><div className="flex items-center gap-2 text-[#f6b333]"><Sparkles size={18} /><span className="text-xs font-bold uppercase tracking-[.18em]">Khía cạnh ẩn</span></div><p className="mt-8 whitespace-pre-line text-xl font-semibold leading-9 text-slate-100">{profile.archetype}</p><div className="mt-10 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm leading-6 text-slate-300">Không có một nhãn nào có thể kể hết câu chuyện của bạn. Hãy xem đây là lời mời để quan sát, không phải phán quyết.</div></div><div className="rounded-[2rem] border border-white bg-white p-7 shadow-xl sm:p-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Các xu hướng nổi bật</p><p className="mt-6 whitespace-pre-line text-base leading-8 text-slate-700">{profile.profile}</p><div className="mt-8 flex flex-wrap gap-3"><button onClick={goChat} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#c41230] px-5 py-3 font-bold text-white transition hover:-translate-y-1 hover:bg-[#a60f29]">Hỏi Inner Compass <MessageCircle size={17} /></button><button onClick={loadExercise} className="focus-ring rounded-full border border-slate-200 px-5 py-3 font-bold text-[#071c35] transition hover:border-[#f6b333]">{exercise ? "Làm mới bài tập" : "Gợi ý thực hành"}</button></div>{exercise && <div className="mt-7 rounded-2xl border border-[#f6b333]/40 bg-[#fffaf0] p-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#8b5e00]">Một bước nhỏ cho hôm nay</p><p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{exercise.exercise}</p><p className="mt-3 text-xs text-slate-500">{exercise.disclaimer}</p></div>}</div></div><p className="mt-7 text-center text-xs text-slate-400">{profile.disclaimer} Nếu bạn đang gặp khó khăn kéo dài, hãy tìm người bạn tin cậy hoặc chuyên gia.</p></motion.section>;
}

function ChatScreen({ messages, draft, setDraft, submit, loading, error, traceOpen, setTraceOpen, back }: { messages: Message[]; draft: string; setDraft: (s: string) => void; submit: (e: FormEvent) => void; loading: boolean; error: string; traceOpen: boolean; setTraceOpen: (v: boolean) => void; back: () => void }) {
  const lastTrace = [...messages].reverse().find((message) => message.trace)?.trace;
  return <motion.section key="chat" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} className="mx-auto max-w-5xl px-5 pb-20 pt-8 sm:px-8 sm:pt-14"><button onClick={back} className="focus-ring mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#c41230]"><ChevronLeft size={18} /> Về trang khám phá</button><div className="overflow-hidden rounded-[2rem] border border-white bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 bg-[#071c35] px-5 py-5 text-white sm:px-8"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#c41230] p-2.5"><HeartHandshake size={20} /></div><div><p className="font-bold">Inner Compass</p><p className="text-xs text-slate-300">Không gian lắng nghe phi lâm sàng</p></div></div><span className="flex items-center gap-1.5 text-xs text-[#f6b333]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#f6b333]" /> sẵn sàng</span></div><div className="min-h-[420px] space-y-5 bg-[#f7f9fc] p-5 sm:p-8">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-3xl px-5 py-4 text-sm leading-7 shadow-sm ${message.role === "user" ? "rounded-br-md bg-[#071c35] text-white" : "rounded-bl-md border border-slate-100 bg-white text-slate-700"}`}>{message.content}{message.trace && <button onClick={() => setTraceOpen(!traceOpen)} className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#c41230]">{traceOpen ? "Ẩn trace" : "Xem ReAct trace"}<ChevronRight size={14} /></button>}</div></div>)}{loading && <div className="flex"><div className="rounded-3xl rounded-bl-md bg-white px-5 py-4 text-sm text-slate-400">Inner Compass đang lắng nghe…</div></div>}{traceOpen && lastTrace && <div className="rounded-2xl border border-[#f6b333]/40 bg-[#fffaf0] p-4 font-mono text-xs leading-6 text-slate-600">{lastTrace.map((line, index) => <p key={index}>{line}</p>)}</div>}{error && <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">{error}</div>}</div><form onSubmit={submit} className="flex gap-3 border-t border-slate-100 bg-white p-4 sm:p-6"><input value={draft} onChange={(event) => setDraft(event.target.value)} className="focus-ring min-w-0 flex-1 rounded-2xl bg-slate-100 px-5 py-3.5 text-sm outline-none transition focus:bg-white" placeholder="Điều gì đang ở trong tâm trí bạn?" aria-label="Tin nhắn" maxLength={4000} /><button disabled={!draft.trim() || loading} className="focus-ring rounded-2xl bg-[#c41230] px-4 text-white transition hover:bg-[#a60f29] disabled:opacity-40" aria-label="Gửi tin nhắn"><Send size={18} /></button></form></div><p className="mt-5 text-center text-xs text-slate-400">Nếu bạn đang ở trong nguy hiểm tức thời, hãy liên hệ dịch vụ khẩn cấp hoặc một người bạn tin cậy.</p></motion.section>;
}

function ConsentModal({ accept, close }: { accept: (value: boolean) => void; close: () => void }) {
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-[#071c35]/60 p-5 backdrop-blur-sm"><motion.div initial={{ y: 20, scale: .96 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-2xl"><div className="flex items-start justify-between"><div className="rounded-xl bg-red-50 p-3 text-[#c41230]"><LockKeyhole /></div><button onClick={close} className="focus-ring rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label="Đóng"><X size={18} /></button></div><h3 className="mt-6 text-2xl font-black text-[#071c35]">Một phiên riêng tư</h3><p className="mt-3 text-sm leading-7 text-slate-600">Bạn đồng ý để demo lưu tiến trình self-check và cuộc trò chuyện trong trình duyệt của thiết bị này trong 24 giờ? Không gửi lên backend và bạn có thể xóa bất cứ lúc nào.</p><div className="mt-7 flex gap-3"><button onClick={() => accept(false)} className="focus-ring flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:border-[#f6b333]">Không lưu</button><button onClick={() => accept(true)} className="focus-ring flex-1 rounded-full bg-[#c41230] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#a60f29]">Đồng ý</button></div></motion.div></motion.div>;
}
