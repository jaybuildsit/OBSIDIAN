import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

console.log("NVIDIA key loaded:", !!process.env.NVIDIA_API_KEY);

const client = new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: process.env.NVIDIA_API_KEY,
});

const response = await client.chat.completions.create({
    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    messages: [
        {
            role: "user",
            content: "Explain Kubernetes in exactly 3 concise bullet points.",
        },
    ],
    max_tokens: 300,
});

console.log("\n===== NVIDIA RESPONSE =====\n");
console.log(response.choices[0].message.content);