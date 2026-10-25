import express from "express";
import morgan from "morgan";
import http from "http";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createProxyServer } from "httpxy";
import { refreshTTL } from "./config/redis.js";

const app = express();

// Sandbox ids are UUIDs. Anything else is rejected, so a bad value can never
// turn into a bogus proxy target (that is what caused "TypeError: Invalid URL").
const SANDBOX_ID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Path mode: https://obsidian.devs.surf/api/agent/<sandboxId>/<anything>
// This travels over the existing /api/* path, so it needs no wildcard DNS.
const AGENT_PREFIX = /^\/api\/agent\/([^/?#]+)/;

// "/api/agent/<id>/list-files?x=1" -> "/list-files?x=1"
const stripAgentPrefix = (path) => {
    const rest = path.replace(AGENT_PREFIX, "");

    return rest.startsWith("/") ? rest : `/${rest}`;
};

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

    await touch(sandboxId);

    return pathAgentProxy(req, res, next);
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
    } else {
        const host = (req.headers.host || "").split(":")[0];

        const [id, type] = host.split(".");

        sandboxId = id;

        if (type === "agent") {
            target = `http://sandbox-service-${id}:3000`;
        } else if (type === "preview") {
            target = `http://sandbox-service-${id}`;
        }
    }

    if (!target || !SANDBOX_ID_RE.test(sandboxId || "")) {
        return socket.destroy();
    }

    await touch(sandboxId, "WebSocket ");

    wsProxy.ws(req, socket, { target }, head);
});


export default server;