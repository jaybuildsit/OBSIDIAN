import express from "express";
import morgan from "morgan";
import http from "http";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createProxyServer } from "httpxy";
import { refreshTTL } from "./config/redis.js";

const app = express();

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



function resolveProxy(hostHeader = "") {
    const host = hostHeader.split(":")[0];

    const sandboxId = host.split(".")[0];
    const type = host.split(".")[1];

    if (type === "agent") {
        return getAgentProxy(sandboxId);
    }

    if (type === "preview") {
        return getProxy(sandboxId);
    }

    return null;
}




app.use(async (req, res, next) => {

    const proxy = resolveProxy(req.headers.host);

    if (!proxy) {
        return res.status(404).send("Unknown host");
    }

    const host = req.headers.host?.split(":")[0];

    const sandboxId = host?.split(".")[0];

    try {

        await refreshTTL(sandboxId);

        console.log(`♻️ TTL refreshed for sandbox: ${sandboxId}`);

    } catch (error) {

        console.error(
            `❌ Failed to refresh TTL for sandbox ${sandboxId}:`,
            error
        );

    }

    return proxy(req, res, next);
});



const server = http.createServer(app);



server.on("upgrade", async (req, socket, head) => {

    socket.on("error", () => socket.destroy());

    const host = req.headers.host?.split(":")[0];

    const sandboxId = host?.split(".")[0];

    const type = host?.split(".")[1];

    console.log(
        `WS upgrade request: ${req.headers.host} ${req.url}`
    );



    try {

        await refreshTTL(sandboxId);

        console.log(
            `♻️ TTL refreshed for WebSocket sandbox: ${sandboxId}`
        );

    } catch (error) {

        console.error(
            `❌ Failed to refresh WebSocket TTL for sandbox ${sandboxId}:`,
            error
        );

    }

    if (type === "agent") {

        wsProxy.ws(
            req,
            socket,
            {
                target: `http://sandbox-service-${sandboxId}:3000`,
            },
            head
        );

    }


    else if (type === "preview") {

        wsProxy.ws(
            req,
            socket,
            {
                target: `http://sandbox-service-${sandboxId}`,
            },
            head
        );

    }

    else {

        socket.destroy();

    }
});


export default server;