import express from "express";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import { Server } from "socket.io";
import http from "http";
import pty from "node-pty";
import os from "os";
import cors from "cors";

const WORKING_DIR = "/workspace";

// Comma-separated list. Override in the pod with ALLOWED_ORIGINS if needed.
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:5173,https://obsidian.devs.surf"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Resolves a user-supplied relative path inside /workspace and rejects
// anything that escapes it (for example ../../etc/passwd).
const safePath = (file) => {
  if (typeof file !== "string" || !file.trim()) {
    throw new Error("Invalid path");
  }

  let relative = file.trim();

  // Accept "/workspace/src/App.jsx", "/src/App.jsx" and "src/App.jsx" alike.
  if (relative === WORKING_DIR || relative.startsWith(WORKING_DIR + "/")) {
    relative = relative.slice(WORKING_DIR.length);
  }
  relative = relative.replace(/^[/\\]+/, "");

  const full = path.resolve(WORKING_DIR, relative);

  if (full !== WORKING_DIR && !full.startsWith(WORKING_DIR + path.sep)) {
    throw new Error("Invalid path");
  }

  return full;
};

const app = express();

/* =========================
   CORS
========================= */

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

/* =========================
   HTTP SERVER
========================= */

const httpServer = http.createServer(app);

/* =========================
   MIDDLEWARE
========================= */

app.use(morgan("dev"));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================
   SOCKET.IO
========================= */

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

/* =========================
   TERMINAL
========================= */

const shell = os.platform() === "win32" ? "powershell.exe" : "bash";

io.on("connection", (socket) => {
  console.log("Client Connected:", socket.id);

  const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 30,
    cwd: WORKING_DIR,
    env: {
      ...process.env,
      TERM: "xterm-256color",
    },
  });

  // PTY -> Browser
  ptyProcess.onData((data) => {
    socket.emit("terminal-output", data);
  });

  // Browser -> PTY
  socket.on("terminal-input", (data) => {
    ptyProcess.write(data);
  });

  // Terminal resize
  socket.on("terminal-resize", ({ cols, rows } = {}) => {
    if (!cols || !rows) return;

    ptyProcess.resize(Math.max(1, cols), Math.max(1, rows));
  });

  // Browser disconnected
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    try {
      ptyProcess.kill();
    } catch (err) {
      console.error("Failed to kill PTY:", err.message);
    }
  });

  // PTY exited
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(
      `[PTY ${socket.id}] exited - Code: ${exitCode}, Signal: ${signal}`,
    );

    socket.emit("terminal-exit", {
      exitCode,
      signal,
    });
  });
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Hello from sandbox agent",
    status: "success",
  });
});

/* =========================
   LIST FILES
========================= */

app.get("/list-files", async (req, res) => {
  const listFiles = async (dir, baseDir) => {
    const entries = await fs.promises.readdir(dir, {
      withFileTypes: true,
    });

    const files = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      // Exclude certain directories
      if (
        entry.isDirectory() &&
        ["node_modules", ".git", "dist"].includes(entry.name)
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        files.push(...(await listFiles(fullPath, baseDir)));
      } else {
        files.push(relativePath);
      }
    }

    return files;
  };

  try {
    const files = await listFiles(WORKING_DIR, WORKING_DIR);

    res.status(200).json({
      message: "Files listed successfully",
      files,
    });
  } catch (err) {
    res.status(500).json({
      message: `Error listing files: ${err.message}`,
      status: "error",
    });
  }
});

/* =========================
   READ FILES
========================= */

app.get("/read-files", async (req, res) => {
  const files = req.query.files;

  if (!files || typeof files !== "string") {
    return res.status(400).json({
      message: "No specific files in query parameter",
      status: "error",
    });
  }

  const fileList = files.split(",");

  const results = await Promise.all(
    fileList.map(async (file) => {
      // safePath must be inside the try so a bad path becomes a per-file error.
      try {
        const filePath = safePath(file);
        const content = await fs.promises.readFile(filePath, "utf-8");

        return {
          [filePath.replace(WORKING_DIR, "")]: content,
        };
      } catch (err) {
        return {
          [`/${file}`]: `Error reading file: ${err.message}`,
        };
      }
    }),
  );

  res.status(200).json({
    message: "File contents",
    files: results,
  });
});

/* =========================
   UPDATE FILES
========================= */

app.patch("/update-files", async (req, res) => {
  const updates = req.body.updates;

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({
      message:
        'Invalid request body. Expected a JSON object with an "updates" property containing an array of file updates',
      status: "error",
    });
  }

  const results = await Promise.all(
    updates.map(async (update) => {
      const { file, content } = update || {};

      try {
        const filePath = safePath(file);

        await fs.promises.writeFile(filePath, content, "utf-8");

        return {
          [filePath]: "File updated successfully",
        };
      } catch (err) {
        return {
          [`${WORKING_DIR}/${file}`]: `Error updating file: ${err.message}`,
        };
      }
    }),
  );

  res.status(200).json({
    message: "File updated Successfully",
    results,
  });
});

/* =========================
   CREATE FILES
========================= */

app.post("/create-files", async (req, res) => {
  const files = req.body.files;

  if (!files || !Array.isArray(files)) {
    return res.status(400).json({
      message:
        'Invalid request body. Expected a JSON object with a "files" property containing an array of files',
      status: "error",
    });
  }

  const results = await Promise.all(
    files.map(async (fileObj) => {
      const { file, content } = fileObj || {};

      try {
        const filePath = safePath(file);

        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, content, "utf-8");

        return {
          [filePath]: "File created successfully",
        };
      } catch (err) {
        return {
          [`${WORKING_DIR}/${file}`]: `Error creating file: ${err.message}`,
        };
      }
    }),
  );

  res.status(200).json({
    message: "File Created Successfully",
    results,
  });
});

export default httpServer;