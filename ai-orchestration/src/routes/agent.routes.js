import { Router } from "express";
import agent from "../agents/ai.agents.js";
import { requireSandboxOwner } from "../middlewares/sandbox.auth.js";

const agentRouter = Router();

// CloudFront closes a connection that is silent for ~30 seconds. A model call that
// writes a whole file can easily be silent that long, so send a heartbeat comment.
const KEEP_ALIVE_MS = 10000;

agentRouter.post("/invoke", requireSandboxOwner, async (req, res) => {
    let keepAlive;

    try {
        const { message, projectId, sandboxId } = req.body;

        if (!message || !projectId || !sandboxId) {
            return res.status(400).json({
                error: "message, projectId and sandboxId are required",
            });
        }

        console.log("=================================");
        console.log("AI INVOKE");
        console.log("PROJECT ID:", projectId);
        console.log("SANDBOX ID:", sandboxId);
        console.log("MESSAGE:", message);
        console.log("=================================");

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        });

        // Stop the agent if the browser disconnects or the user presses Stop.
        // (res "close" is used on purpose: req "close" fires as soon as the
        // request body has been read on current Node versions.)
        const controller = new AbortController();

        res.on("close", () => {
            clearInterval(keepAlive);
            controller.abort();
        });

        const writer = (value) => {
            if (res.writableEnded || res.destroyed) return;

            const text = (typeof value === "string" ? value : JSON.stringify(value))
                .replace(/[\r\n]+$/, "");

            if (!text) return;

            // One "data:" line per line of text, so multi-line text stays valid SSE.
            res.write(
                text.split(/\r?\n/).map((line) => `data:${line}`).join("\n") + "\n\n"
            );
        };

        keepAlive = setInterval(() => {
            if (!res.writableEnded && !res.destroyed) {
                res.write(": ping\n\n");
            }
        }, KEEP_ALIVE_MS);

        writer("Agent started");

        const response = await agent.stream(
            {
                messages: [
                    {
                        role: "user",
                        content: message,
                    },
                ],
            },
            {
                context: {
                    projectId,
                    sandboxId,
                    writer,
                },
                streamMode: "custom",
                signal: controller.signal,
            }
        );

        for await (const chunk of response) {
            console.log("AGENT CHUNK:", chunk);
            writer(chunk);
        }

        writer("Agent closed");

        clearInterval(keepAlive);
        res.end();

    } catch (error) {
        clearInterval(keepAlive);

        console.error("Error invoking agent:", error);

        if (res.headersSent) {
            if (!res.writableEnded && !res.destroyed) {
                res.write(`data:Error: ${error.message || "Agent failed"}\n\n`);
                res.end();
            }
        } else {
            res.status(500).json({
                error: "Failed to invoke agent",
            });
        }
    }
});

export default agentRouter;