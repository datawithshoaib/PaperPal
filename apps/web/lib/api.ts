import { getAccessToken, handleUnauthorized } from "@/lib/auth-store";
import type {
  AuthConfig,
  ChatMessage,
  Citation,
  Conversation,
  ConversationSummary,
  ExplanationLevel,
  GraphData,
  Job,
  Paper,
  RelatedPaper,
  Section,
} from "@/lib/types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function authHeaders(init?: HeadersInit): Promise<Headers> {
  const headers = new Headers(init);
  const token = await getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

async function errorFrom(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null);
  const detail = body?.detail;
  const message =
    typeof detail === "string"
      ? detail
      : Array.isArray(detail)
        ? detail.map((d: { msg: string }) => d.msg).join("; ")
        : `Request failed (${response.status})`;
  return new ApiError(message, response.status);
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeaders(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError("Can't reach the PaperPal API. Is the backend running?", 0);
  }
  if (response.status === 401) handleUnauthorized();
  if (!response.ok) throw await errorFrom(response);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  authConfig: () => request<AuthConfig>("/auth/config"),
  demoLogin: (credentials?: { email: string; password: string }) =>
    request<{ access_token: string; expires_at: string }>("/auth/demo", {
      method: "POST",
      body: credentials ? json(credentials) : undefined,
    }),

  papers: () => request<{ items: Paper[] }>("/papers").then((r) => r.items),
  paper: (id: string) => request<Paper>(`/papers/${id}`),
  sections: (id: string) => request<Section[]>(`/papers/${id}/sections`),
  uploadPaper: (file: File) => {
    const form = new FormData();
    form.set("file", file);
    return request<{ paper: Paper; job_id: string }>("/papers", { method: "POST", body: form });
  },
  addArxiv: (arxiv_url: string) =>
    request<{ paper: Paper; job_id: string | null }>("/papers/arxiv", { method: "POST", body: json({ arxiv_url }) }),
  deletePaper: (id: string) => request<void>(`/papers/${id}`, { method: "DELETE" }),
  reanalyze: (id: string) => request<Paper>(`/papers/${id}/analyze`, { method: "POST" }),
  job: (id: string) => request<Job>(`/jobs/${id}`),
  retryJob: (id: string) => request<Job>(`/jobs/${id}/retry`, { method: "POST" }),
  pdfBlobUrl: async (id: string) => {
    const response = await fetch(`${API_URL}/papers/${id}/pdf`, { headers: await authHeaders() });
    if (!response.ok) throw await errorFrom(response);
    return URL.createObjectURL(await response.blob());
  },

  conversations: (paperId: string) => request<ConversationSummary[]>(`/papers/${paperId}/conversations`),
  conversation: (id: string) => request<Conversation>(`/conversations/${id}`),
  deleteConversation: (id: string) => request<void>(`/conversations/${id}`, { method: "DELETE" }),
  feedback: (message_id: string, rating: "helpful" | "unhelpful") =>
    request<{ id: string }>("/feedback", { method: "POST", body: json({ message_id, rating }) }),

  related: (id: string) => request<{ items: RelatedPaper[]; notice: string }>(`/papers/${id}/related`),
  graph: (id: string) => request<GraphData>(`/papers/${id}/graph`),
};

// ---------------------------------------------------------------- chat streaming

export interface StreamHandlers {
  onStatus?: (stage: string) => void;
  onRoute?: (task: string) => void;
  onEvidence?: (citations: Citation[]) => void;
  onToken?: (text: string) => void;
  onFinal?: (result: {
    answer: string;
    citations: Citation[];
    task: string;
    insufficient_evidence: boolean;
    conversation_id: string;
    message_id: string;
  }) => void;
}

/** Streams a chat turn over SSE. Resolves when the stream ends; rejects on transport or server errors. */
export async function streamChat(
  paperId: string,
  body: { question: string; explanation_level: ExplanationLevel; conversation_id?: string | null },
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const headers = await authHeaders({ "Content-Type": "application/json" });
  let response: Response;
  try {
    response = await fetch(`${API_URL}/papers/${paperId}/chat/stream`, {
      method: "POST",
      headers,
      body: json(body),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError("Can't reach the PaperPal API. Is the backend running?", 0);
  }
  if (response.status === 401) handleUnauthorized();
  if (!response.ok || !response.body) throw await errorFrom(response);

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = /^event: (.+)$/m.exec(frame)?.[1];
      const data = /^data: (.+)$/m.exec(frame)?.[1];
      if (!event || !data) continue;
      const payload = JSON.parse(data);
      if (event === "status") handlers.onStatus?.(payload.stage);
      else if (event === "route") handlers.onRoute?.(payload.task);
      else if (event === "evidence") handlers.onEvidence?.(payload.citations);
      else if (event === "token") handlers.onToken?.(payload.text);
      else if (event === "final") {
        finished = true;
        handlers.onFinal?.(payload);
      } else if (event === "error") throw new ApiError(payload.detail, 500);
    }
  }
  if (!finished) throw new ApiError("The response was interrupted. Please try again.", 0);
}

export function toChatMessages(conversation: Conversation): ChatMessage[] {
  return conversation.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    citations: m.citations,
    task: m.task,
    insufficient_evidence: m.insufficient_evidence,
  }));
}
