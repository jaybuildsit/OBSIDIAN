export const streamAgent = async (
  message,
  projectId,
  sandboxId,
  onEvent,
  signal
) => {
  const response = await fetch("/api/ai/invoke", {
    method: "POST",
    credentials: "include",
    signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      message,
      projectId,
      sandboxId,
    }),
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");

    throw new Error(
      `AI agent failed to start (${response.status}) ${text.slice(0, 200)}`.trim()
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let received = 0;

  const emit = (entry) => {
    const event =
      entry
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n") || entry.trim();

    if (event && event !== "[DONE]") {
      received++;
      onEvent(event);
    }
  };

  while (true) {
    const { value, done } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const entries = buffer.split(/\r?\n\r?\n/);

    buffer = entries.pop() || "";

    entries.forEach(emit);
  }

  if (buffer.trim()) {
    emit(buffer);
  }

  if (received === 0) {
    throw new Error(
      "The agent finished without sending any events."
    );
  }
};