import "dotenv/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
    listFiles,
    readFiles,
    updateFiles
} from "./tools.js";
import { createAgent } from "langchain";

const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.6-flash",
    apiKey: process.env.GEMINI_API_KEY,
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
            content: "List the files in the project."
        }
    ]
});

console.log("✅ Agent finished");
console.log(result);