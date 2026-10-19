const apiJson = async (response) => {
  const body = await response.text();

  try {
    return body ? JSON.parse(body) : {};
  } catch {
    return {};
  }
};

const requireSandboxId = (sandboxId) => {
  if (typeof sandboxId !== "string" || !sandboxId.trim()) {
    throw new Error("Sandbox ID is missing.");
  }

  return sandboxId.trim();
};

export const sandboxHost = (sandboxId) =>
  `http://${requireSandboxId(sandboxId)}.agent.localhost`;

const sandboxFetch = (sandboxId, path, options = {}) => {
  return fetch(`${sandboxHost(sandboxId)}${path}`, {
    ...options,
  });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Polls the agent until it answers 200. Right after /create the agent URL
// returns 504 for a few seconds (and the 504 has no CORS header, so the
// browser throws a TypeError). Both cases just mean "not ready yet".
export const waitForAgent = async (
  sandboxId,
  { timeoutMs = 60000, intervalMs = 500 } = {}
) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${sandboxHost(sandboxId)}/list-files`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) return;
    } catch {
      // Not ready yet, keep polling.
    }

    await sleep(intervalMs);
  }

  throw new Error("Sandbox agent did not become ready in time.");
};

export const createSandbox = async () => {
  const response = await fetch("/api/sandbox/create/", {
    method: "POST",
  });

  const payload = await apiJson(response);

  const { sandboxId, previewUrl } = payload;

  if (!response.ok || !sandboxId || !previewUrl) {
    throw new Error(payload.message || "Sandbox creation failed.");
  }

  await waitForAgent(sandboxId);

  return {
    sandboxId,
    previewUrl,
  };
};

export const listFiles = async (sandboxId) => {
  const response = await sandboxFetch(sandboxId, "/list-files");

  const payload = await apiJson(response);

  if (!response.ok) {
    throw new Error(payload.message || "Unable to load workspace files.");
  }

  return payload.files || [];
};

export const readFile = async (sandboxId, file) => {
  const response = await sandboxFetch(
    sandboxId,
    `/read-files?files=${encodeURIComponent(file)}`
  );

  const payload = await apiJson(response);

  // The agent returns files as an array of { "/path": "content" } objects.
  // Also accept a plain object keyed by path, and ignore leading "/" or "./".
  const normalize = (path) => String(path).replace(/^\.?\/+/, "");
  const target = normalize(file);

  const entries = Array.isArray(payload.files)
    ? payload.files.flatMap((item) => Object.entries(item))
    : Object.entries(payload.files || {});

  const match = entries.find(([path]) => normalize(path) === target);

  if (!response.ok || !match) {
    throw new Error(
      response.ok
        ? `Unable to read ${file}.`
        : payload.message || `Unable to read ${file}.`
    );
  }

  return match[1];
};

export const updateFile = async (sandboxId, file, content) => {
  const response = await sandboxFetch(sandboxId, "/update-files", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      updates: [
        {
          file,
          content,
        },
      ],
    }),
  });

  if (!response.ok) {
    const payload = await apiJson(response);

    throw new Error(payload.message || "Unable to save changes.");
  }
};