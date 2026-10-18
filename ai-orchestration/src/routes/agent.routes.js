import { Router } from "express";
import agent from "../agents/ai.agents.js";

const agentRouter = Router();

agentRouter.post("/invoke", async (req, res) => {
    try {
        const { message, projectId } = req.body;

        const response = await agent.invoke({
            messages: [
                {
                    role: "user",
                    content: message
                }
            ]
        }, {
            context: {
                projectId
            }
        });

        res.json({ response });

    } catch (error) {
        console.error("Error invoking agent:", error);
        res.status(500).json({
            error: "Failed to invoke agent"
        });
    }
});

export default agentRouter;