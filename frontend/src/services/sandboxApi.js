const apiJson = async (response) => {
  const body = await response.text();

  try {
    return body ? JSON.parse(body) : {};
  } catch {
    return {};
  }
};

const requireProjectId = (projectId) => {
  if (typeof projectId !== "string" || !projectId.trim()) {
    throw new Error("Project ID is missing.");
  }

  return projectId.trim();
};

const requireSandboxId = (sandboxId) => {
  if (typeof sandboxId !== "string" || !sandboxId.trim()) {
    throw new Error("Sandbox ID is missing.");
  }

  return sandboxId.trim();
};

/* =========================
   SANDBOX ROUTING
   VITE_SANDBOX_ROUTING = "path" (default) | "host"

   path: https://app.obsidian.devs.surf/agent/<id>/list-files
         (needs no wildcard DNS; the router must handle /agent/<id>/*)
   host: https://<id>.agent.obsidian.devs.surf/list-files
         (needs wildcard DNS for *.agent.obsidian.devs.surf)

   Switch back to host mode later by setting VITE_SANDBOX_ROUTING=host
   and rebuilding. No code change needed.
========================= */

const ROUTING = import.meta.env.VITE_SANDBOX_ROUTING || "path";
const PATH_ORIGIN =
  import.meta.env.VITE_SANDBOX_ORIGIN || "https://app.obsidian.devs.surf";
const HOST_DOMAIN =
  import.meta.env.VITE_SANDBOX_AGENT_DOMAIN || "agent.obsidian.devs.surf";

// Origin only, e.g. https://app.obsidian.devs.surf
export const sandboxOrigin = (sandboxId) =>
  ROUTING === "host"
    ? `https://${requireSandboxId(sandboxId)}.${HOST_DOMAIN}`
    : PATH_ORIGIN;

// Path prefix only, e.g. /agent/<id>  (empty in host mode)
export const sandboxPrefix = (sandboxId) =>
  ROUTING === "host" ? "" : `/agent/${requireSandboxId(sandboxId)}`;

// Origin + prefix, used for plain fetch calls.
export const sandboxHost = (sandboxId) =>
  `${sandboxOrigin(sandboxId)}${sandboxPrefix(sandboxId)}`;

const sandboxFetch = (sandboxId, path, options = {}) => {
  return fetch(`${sandboxHost(sandboxId)}${path}`, {
    ...options,
  });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Polls the agent until it answers 200. Right after /create the agent URL
// returns 504 for a few seconds (and the 504 has no CORS header, so the
// browser throws a TypeError). Both cases just mean "not ready yet".
// The wait between attempts grows from intervalMs up to maxIntervalMs so a
// broken route does not get hammered.
export const waitForAgent = async (
  sandboxId,
  { timeoutMs = 60000, intervalMs = 500, maxIntervalMs = 3000 } = {}
) => {
  const deadline = Date.now() + timeoutMs;
  let delay = intervalMs;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${sandboxHost(sandboxId)}/list-files`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) return;

      lastError = `HTTP ${response.status}`;
    } catch (cause) {
      // Not ready yet, or unreachable (DNS, CORS, network). Keep polling.
      lastError = cause?.message || "network error";
    }

    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.5), maxIntervalMs);
  }

  throw new Error(
    `Sandbox agent did not become ready in time (${lastError || "no response"}). ` +
      "Check that the sandbox address resolves and the router is reachable."
  );
};

export const listProjects = async () => {
  const response = await fetch("/api/sandbox/project", {
    credentials: "include",
  });
  const payload = await apiJson(response);

  if (!response.ok || !Array.isArray(payload.projects)) {
    throw new Error(payload.message || "Unable to load your projects.");
  }

  return payload.projects;
};

export const createProject = async (title) => {
  const projectTitle = typeof title === "string" ? title.trim() : "";

  if (!projectTitle) {
    throw new Error("Enter a project name.");
  }

  const response = await fetch("/api/sandbox/project", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: projectTitle }),
  });
  const payload = await apiJson(response);

  if (!response.ok || !payload.project?._id) {
    throw new Error(payload.message || "Unable to create your project.");
  }

  return payload.project;
};

export const createSandbox = async (projectId) => {
  const response = await fetch("/api/sandbox/create", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ projectId: requireProjectId(projectId) }),
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