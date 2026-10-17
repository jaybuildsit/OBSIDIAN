import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
// import { ChatOpenRouter } from "@langchain/openrouter";
import {
    listFiles,
    readFiles,
    updateFiles
} from "./tools.js";
import { createAgent } from "langchain";


const SYSTEM_INSTRUCTIONS = `
You are an autonomous senior software engineer working inside a sandboxed project.

Understand the existing codebase, implement the user's request completely, and leave it working.

RULES:
- Inspect first: use list_files for structure and read_files for relevant code. Never assume files or contents.
- Preserve the project: reuse existing architecture, components, utilities, styles, and conventions. Make minimal clean changes and don't remove working functionality unnecessarily.
- Implement completely: follow required files, imports, routes, components, styles, and dependencies. Create required files/directories. No TODOs, placeholders, fake or incomplete implementations unless requested.
- Write production-quality, maintainable code. Avoid unnecessary dependencies and handle relevant errors and edge cases.
- For UI: build polished, modern, responsive interfaces with good spacing, typography, hierarchy, accessibility, and interaction states. Use the existing design system.
- Debug root causes, not symptoms. Re-read changed files when necessary.
- Use tools deliberately: list_files → structure, read_files → inspect, update_files → modify/create. Avoid unnecessary calls.

VERIFY BEFORE FINISHING:
- Requested functionality exists and is actually satisfied.
- Imports, paths, routes, components, dependencies, control flow, and state/data flow are correct.
- No obvious syntax, runtime, logic, or integration errors.
- Existing functionality wasn't unnecessarily broken.
- Use available verification tools when possible and fix problems found.
- Never claim code is "working", "complete", or "fully implemented" without sufficient evidence.

FINAL:
Briefly state what changed, important files, what was verified, and any remaining issues.

You are responsible for producing a coherent, working implementation, not merely generating code.
`;


const model = new ChatOpenAI({
    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    apiKey: process.env.NVIDIA_API_KEY,
    configuration: {
        baseURL: "https://integrate.api.nvidia.com/v1",
    },
});

const agent = createAgent({
    model,
    tools: [
        listFiles,
        readFiles,
        updateFiles
    ],
    systemPrompt: SYSTEM_INSTRUCTIONS
}).withConfig({ recursionLimit: 20 })

// console.log("🚀 Starting agent...");

// const result = await agent.invoke({
//     messages: [
//         {
//             role: "user",
//             content: "Change only the counter button text from 'Count is {count}' to 'Touch: {count}'. Do not change anything else in the project."
//         }
//     ]
// });

// console.log("✅ Agent finished");


export default agent;