import express from "express";
import morgan from "morgan";
import http from "http";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createProxyServer } from "httpxy";

const app = express();

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

// WebSocket proxy
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

// Shared host -> proxy lookup
function resolveProxy(hostHeader = "") {
    const host = hostHeader.split(":")[0];
    const sandboxId = host.split(".")[0];
    const type = host.split(".")[1];

    if (type === "agent") return getAgentProxy(sandboxId);
    if (type === "preview") return getProxy(sandboxId);

    return null;
}

// HTTP requests
app.use((req, res, next) => {
    const proxy = resolveProxy(req.headers.host);

    if (!proxy) {
        return res.status(404).send("Unknown host");
    }

    return proxy(req, res, next);
});

// HTTP server
const server = http.createServer(app);

// WebSocket upgrades
server.on("upgrade", (req, socket, head) => {
    socket.on("error", () => socket.destroy());

    const host = req.headers.host?.split(":")[0];
    const sandboxId = host?.split(".")[0];
    const type = host?.split(".")[1];

    console.log(`WS upgrade request: ${req.headers.host} ${req.url}`);

    if (type === "agent") {
        wsProxy.ws(
            req,
            socket,
            {
                target: `http://sandbox-service-${sandboxId}:3000`,
            },
            head
        );
    } else if (type === "preview") {
        wsProxy.ws(
            req,
            socket,
            {
                target: `http://sandbox-service-${sandboxId}`,
            },
            head
        );
    } else {
        socket.destroy();
    }
});

export default server;