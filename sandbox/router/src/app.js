import express from "express";
import morgan from "morgan";
import http from "http";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createProxyServer } from "httpxy";
import jwt from "jsonwebtoken";
import { refreshTTL, getSandboxOwner } from "./config/redis.js";

const app = express();

// Sandbox ids are UUIDs. Anything else is rejected, so a bad value can never
// turn into a bogus proxy target (that is what caused "TypeError: Invalid URL").
const SANDBOX_ID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Path mode: https://obsidian.devs.surf/api/agent/<sandboxId>/<anything>
// This travels over the existing /api/* path, so it needs no wildcard DNS.
const AGENT_PREFIX = /^\/api\/agent\/([^/?#]+)/;

// Preview path mode: https://obsidian.devs.surf/api/preview/<sandboxId>/...
// The sandbox's Vite dev server runs with --base /api/preview/<sandboxId>/, so
// the full path is forwarded unchanged (no prefix stripping, unlike the agent).
const PREVIEW_PREFIX = /^\/api\/preview\/([^/?#]+)/;

// "/api/agent/<id>/list-files?x=1" -> "/list-files?x=1"
const stripAgentPrefix = (path) => {
    const rest = path.replace(AGENT_PREFIX, "");

    return rest.startsWith("/") ? rest : `/${rest}`;
};

// ---------- Authentication ----------
// Same JWT the auth service issues: the "token" cookie, or Authorization: Bearer.
const JWT_SECRET = process.env.JWT_SECRET;

// Hostname mode (<id>.agent.<domain>) is off by default. Without this, anyone
// could reach a sandbox by sending a forged Host header to the load balancer.
// If you turn it on later, the login cookie must also be valid on those hosts.
const ALLOW_HOST_MODE = process.env.ALLOW_HOST_MODE === "true";

if (!JWT_SECRET) {
    console.error("JWT_SECRET is not set: every sandbox request will be rejected");
}

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

// Logged in AND the sandbox belongs to this user.
// Returns { ok: true } or { ok: false, status, message }.
async function authorizeSandbox(req, sandboxId) {
    if (!JWT_SECRET) {
        return { ok: false, status: 500, message: "Server auth is not configured" };
    }

    const token = readToken(req);

    if (!token) {
        return { ok: false, status: 401, message: "Authentication required" };
    }

    let user;

    try {
        user = jwt.verify(token, JWT_SECRET);
    } catch {
        return { ok: false, status: 401, message: "Invalid or expired token" };
    }

    if (!user?.id) {
        return { ok: false, status: 401, message: "Invalid token" };
    }

    let owner;

    try {
        owner = await getSandboxOwner(sandboxId);
    } catch (error) {
        console.error("Owner lookup failed:", error);

        return { ok: false, status: 503, message: "Could not verify sandbox" };
    }

    if (!owner) {
        return { ok: false, status: 404, message: "Sandbox not found or expired" };
    }

    if (String(owner) !== String(user.id)) {
        return { ok: false, status: 403, message: "This sandbox belongs to another user" };
    }

    return { ok: true };
}

async function touch(sandboxId, label = "") {
    try {
        await refreshTTL(sandboxId);

        console.log(`TTL refreshed for ${label}sandbox: ${sandboxId}`);
    } catch (error) {
        console.error(
            `Failed to refresh ${label}TTL for sandbox ${sandboxId}:`,
            error
        );
    }
}

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (
        origin === "http://localhost:5173" ||
        origin === "https://obsidian.devs.surf"
    ) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader(
            "Access-Control-Allow-Methods",
            "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        );
        res.setHeader(
            "Access-Control-Allow-Headers",
            req.headers["access-control-request-headers"] ||
                "Authorization, Content-Type, X-Requested-With"
        );
        res.vary("Origin");

        if (req.method === "OPTIONS") {
            return res.sendStatus(204);
        }
    }

    next();
});

app.use(morgan("combined"));


app.get("/api/status/healthz", (req, res) => {
    res.status(200).json({
        message: "Server is healthy",
        status: "ok",
    });
});


app.get("/api/status/readyz", (req, res) => {
    res.status(200).json({
        message: "Server is ready",
        status: "ok",
    });
});


const proxies = {};
const agentProxies = {};


const wsProxy = createProxyServer({
    changeOrigin: true,
});

wsProxy.on("error", (err, req, socket) => {
    socket?.destroy();
});


function getProxy(sandboxId) {
    const target = `http://sandbox-service-${sandboxId}`;

    if (!proxies[sandboxId]) {
        proxies[sandboxId] = createProxyMiddleware({
            target,
            changeOrigin: true,
        });
    }

    return proxies[sandboxId];
}


function getAgentProxy(sandboxId) {
    const target = `http://sandbox-service-${sandboxId}:3000`;

    if (!agentProxies[sandboxId]) {
        agentProxies[sandboxId] = createProxyMiddleware({
            target,
            changeOrigin: true,
        });
    }

    return agentProxies[sandboxId];
}


// One shared proxy for path mode. The target is chosen per request and the
// /api/agent/<id> prefix is removed before the request reaches the sandbox.
// (http-proxy-middleware restores req.url from req.originalUrl, so the prefix
// has to be removed with pathRewrite, not by editing req.url.)
const pathAgentProxy = createProxyMiddleware({
    changeOrigin: true,
    router: (req) => `http://sandbox-service-${req.sandboxId}:3000`,
    pathRewrite: stripAgentPrefix,
});

// Preview proxy: Vite listens on port 80 of the sandbox Service (-> 5173).
// No pathRewrite, because Vite itself serves under /api/preview/<id>/.
const pathPreviewProxy = createProxyMiddleware({
    changeOrigin: true,
    router: (req) => `http://sandbox-service-${req.sandboxId}`,
});


// 1) Path mode: /api/agent/<id>/...
app.use(async (req, res, next) => {
    const match = AGENT_PREFIX.exec(req.originalUrl || req.url);

    if (!match) {
        return next();
    }

    const sandboxId = match[1];

    if (!SANDBOX_ID_RE.test(sandboxId)) {
        return res.status(400).send("Invalid sandbox id");
    }

    req.sandboxId = sandboxId;

    const auth = await authorizeSandbox(req, sandboxId);

    if (!auth.ok) {
        return res.status(auth.status).send(auth.message);
    }

    await touch(sandboxId);

    return pathAgentProxy(req, res, next);
});


// 1b) Preview path mode: /api/preview/<id>/...
app.use(async (req, res, next) => {
    const match = PREVIEW_PREFIX.exec(req.originalUrl || req.url);

    if (!match) {
        return next();
    }

    const sandboxId = match[1];

    if (!SANDBOX_ID_RE.test(sandboxId)) {
        return res.status(400).send("Invalid sandbox id");
    }

    req.sandboxId = sandboxId;

    const auth = await authorizeSandbox(req, sandboxId);

    if (!auth.ok) {
        return res.status(auth.status).send(auth.message);
    }

    await touch(sandboxId);

    return pathPreviewProxy(req, res, next);
});


// 2) Host mode: <id>.agent.<domain> and <id>.preview.<domain>
//    (needs wildcard DNS; also what previews use)
app.use(async (req, res, next) => {
    const host = (req.headers.host || "").split(":")[0];

    const [sandboxId, type] = host.split(".");

    if (
        !SANDBOX_ID_RE.test(sandboxId || "") ||
        (type !== "agent" && type !== "preview")
    ) {
        return res.status(404).send("Unknown host");
    }

    if (!ALLOW_HOST_MODE) {
        return res.status(404).send("Unknown host");
    }

    const auth = await authorizeSandbox(req, sandboxId);

    if (!auth.ok) {
        return res.status(auth.status).send(auth.message);
    }

    const proxy =
        type === "agent" ? getAgentProxy(sandboxId) : getProxy(sandboxId);

    await touch(sandboxId);

    return proxy(req, res, next);
});


const server = http.createServer(app);


server.on("upgrade", async (req, socket, head) => {

    socket.on("error", () => socket.destroy());

    console.log(`WS upgrade request: ${req.headers.host} ${req.url}`);

    let sandboxId;
    let target;

    const pathMatch = AGENT_PREFIX.exec(req.url || "");

    if (pathMatch) {
        // Path mode, e.g. /api/agent/<id>/socket.io/?EIO=4&transport=websocket
        sandboxId = pathMatch[1];
        target = `http://sandbox-service-${sandboxId}:3000`;
        req.url = stripAgentPrefix(req.url);
    } else if (PREVIEW_PREFIX.test(req.url || "")) {
        // Vite hot-reload socket, e.g. /api/preview/<id>/?token=...
        // The path is forwarded unchanged because Vite runs with that base.
        sandboxId = PREVIEW_PREFIX.exec(req.url)[1];
        target = `http://sandbox-service-${sandboxId}`;
    } else {
        const host = (req.headers.host || "").split(":")[0];

        const [id, type] = host.split(".");

        sandboxId = id;

        if (!ALLOW_HOST_MODE) {
            return socket.destroy();
        }

        if (type === "agent") {
            target = `http://sandbox-service-${id}:3000`;
        } else if (type === "preview") {
            target = `http://sandbox-service-${id}`;
        }
    }

    if (!target || !SANDBOX_ID_RE.test(sandboxId || "")) {
        return socket.destroy();
    }

    const auth = await authorizeSandbox(req, sandboxId);

    if (!auth.ok) {
        socket.write(
            `HTTP/1.1 ${auth.status} ${auth.message}\r\nConnection: close\r\n\r\n`
        );

        return socket.destroy();
    }

    await touch(sandboxId, "WebSocket ");

    wsProxy.ws(req, socket, { target }, head);
});


export default server;