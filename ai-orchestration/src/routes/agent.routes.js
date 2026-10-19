import { Router } from "express";
import agent from "../agents/ai.agents.js";

const agentRouter = Router();

agentRouter.post("/invoke", async (req, res) => {
    try {
        const { message, projectId } = req.body;

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        });

        console.log("PROJECT ID FROM REQUEST:", projectId);

        const writer = (text) => {
            res.write(`data:${text}\n\n`);
        };

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
                    writer,
                },
                streamMode: "custom",
            }
        );

        for await (const chunk of response) {
            console.log(chunk);
            writer(chunk);
        }

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