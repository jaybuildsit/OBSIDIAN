import express from "express";
import morgan from "morgan";
import http from "http";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
app.use(morgan('combined'));

app.get('/api/status/healthz', (req, res) => {
    res.status(200).json({ message: "Server is healthy", status: "ok" });
})

app.get('/api/status/readyz', (req, res) => {
    res.status(200).json({ message: "Server is ready", status: "ok" });
})

const proxies = {}
const agentProxies = {}

function getProxy(sandboxId) {

    const target = `http://sandbox-service-${sandboxId}`;

    if (!proxies[sandboxId]) {
        proxies[sandboxId] = createProxyMiddleware({
            target,
            changeOrigin: true,
            ws: true,
        })
    }
    return proxies[sandboxId];
}

function getAgentProxy(sandboxId) {

    const target = `http://sandbox-service-${sandboxId}:3000`;

    if (!agentProxies[sandboxId]) {
        agentProxies[sandboxId] = createProxyMiddleware({
            target,
            changeOrigin: true,
            ws: true,
        })
    }
    return agentProxies[sandboxId];
}

// Shared host -> proxy lookup, used by both HTTP requests and WebSocket upgrades
function resolveProxy(hostHeader = "") {
    const host = hostHeader.split(':')[0];
    const sandboxId = host.split('.')[0];
    const type = host.split('.')[1];

    if (type === 'agent') return getAgentProxy(sandboxId);
    if (type === 'preview') return getProxy(sandboxId);
    return null;
}

app.use((req, res, next) => {
    const proxy = resolveProxy(req.headers.host);

    if (!proxy) {
        return res.status(404).send("Unknown host");
    }

    return proxy(req, res, next);
});

// Create the HTTP server explicitly so we can handle WebSocket upgrades.
// Upgrade requests never go through Express middleware.
const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
    // Prevent EPIPE / connection-reset errors from crashing the process
    socket.on('error', () => socket.destroy());

    const proxy = resolveProxy(req.headers.host);

    if (!proxy) {
        socket.destroy();
        return;
    }

    console.log(`WS upgrade request: ${req.headers.host} ${req.url}`);
    proxy.upgrade(req, socket, head);
});

export default server; // export server, not app