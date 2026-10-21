import { Router } from "express";
import agent from "../agents/ai.agents.js";

const agentRouter = Router();

agentRouter.post("/invoke", async (req, res) => {
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

        const writer = (text) => {
            if (res.writableEnded) return;
            res.write(`data:${text}\n\n`);
        };

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
            }
        );

        for await (const chunk of response) {
            console.log("AGENT CHUNK:", chunk);
            writer(chunk);
        }

        writer("Agent closed");

        res.end();

    } catch (error) {
        console.error("Error invoking agent:", error);

        if (res.headersSent) {
            res.end();
        } else {
            res.status(500).json({
                error: "Failed to invoke agent",
            });
        }
    }
});

export default agentRouter;