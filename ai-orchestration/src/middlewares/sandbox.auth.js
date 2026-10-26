import jwt from "jsonwebtoken";
import { getSandboxOwner, refreshTTL } from "../config/redis.js";

const JWT_SECRET = process.env.JWT_SECRET;

const SANDBOX_ID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (!JWT_SECRET) {
    console.error("JWT_SECRET is not set: every AI request will be rejected");
}

// Same JWT the auth service issues: the "token" cookie, or Authorization: Bearer.
function readToken(req) {
    const header = req.headers.authorization;

    if (header && header.startsWith("Bearer ")) {
        return header.slice(7);
    }

    for (const part of (req.headers.cookie || "").split(";")) {
        const index = part.indexOf("=");

        if (index === -1) continue;

        if (part.slice(0, index).trim() === "token") {
            try {
                return decodeURIComponent(part.slice(index + 1).trim());
            } catch {
                return null;
            }
        }
    }

    return null;
}

// Only a logged-in user may run the agent, and only on a sandbox they own.
export async function requireSandboxOwner(req, res, next) {
    try {
        if (!JWT_SECRET) {
            return res.status(500).json({ error: "Server auth is not configured" });
        }

        const token = readToken(req);

        if (!token) {
            return res.status(401).json({ error: "Authentication required" });
        }

        let user;

        try {
            user = jwt.verify(token, JWT_SECRET);
        } catch {
            return res.status(401).json({ error: "Invalid or expired token" });
        }

        if (!user?.id) {
            return res.status(401).json({ error: "Invalid token" });
        }

        const sandboxId = req.body?.sandboxId;

        if (typeof sandboxId !== "string" || !SANDBOX_ID_RE.test(sandboxId)) {
            return res.status(400).json({ error: "A valid sandboxId is required" });
        }

        const owner = await getSandboxOwner(sandboxId);

        if (!owner) {
            return res.status(404).json({ error: "Sandbox not found or expired" });
        }

        if (String(owner) !== String(user.id)) {
            return res
                .status(403)
                .json({ error: "This sandbox belongs to another user" });
        }

        req.user = { id: String(user.id) };

        // The agent talks to the sandbox inside the cluster and bypasses the router,
        // so extend the sandbox's life here while the agent is working.
        await refreshTTL(sandboxId).catch(() => {});

        return next();
    } catch (error) {
        console.error("Sandbox auth failed:", error);

        return res.status(503).json({ error: "Could not verify sandbox" });
    }
}