const STORAGE_KEY = "trading-ai-knowledge-v1";

export function loadAiKnowledgeFromStorage(): string {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return typeof raw === "string" ? raw : "";
}

export function saveAiKnowledgeToStorage(text: string): void {
  window.localStorage.setItem(STORAGE_KEY, text);
}
