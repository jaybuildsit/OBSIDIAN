import "dotenv/config";
import { ChatOpenRouter } from "@langchain/openrouter";

const model = new ChatOpenRouter({
    model: "nvidia/nemotron-3.5-super-vl:free",
    apiKey: process.env.OPENROUTER_API_KEY,
    temperature: 0.7,
});

const response = await model.invoke(
    "Reply with exactly: OBSIDIAN MODEL WORKING"
);

console.log(response.content);