import "dotenv/config";
import { ChatOpenRouter } from "@langchain/openrouter";
import {
    listFiles,
    readFiles,
    updateFiles
} from "./tools.js";
import { createAgent } from "langchain";

const model = new ChatOpenRouter({
    model: "nvidia/nemotron-3.5-super-vl:free",
    apiKey: process.env.OPENROUTER_API_KEY,
    temperature: 0.7,
});

const agent = createAgent({
    model,
    tools: [
        listFiles,
        readFiles,
        updateFiles
    ],
});

console.log("🚀 Starting agent...");

const result = await agent.invoke({
    messages: [
        {
            role: "user",
            content: "Change only the counter button text from 'Count is {count}' to 'Touch: {count}'. Do not change anything else in the project."
        }
    ]
});

console.log("✅ Agent finished");