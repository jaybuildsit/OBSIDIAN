import { listFiles, readFiles, updateFiles } from "./tools.js";

console.log("\n========== TEST: LIST FILES ==========\n");

const files = await listFiles.invoke({});

console.log("LIST FILES RESULT:");
console.log(files);


console.log("\n========== TEST: READ FILES ==========\n");

const readResult = await readFiles.invoke({
    files: ["src/App.jsx"]
});

console.log("READ FILES RESULT:");
console.log(readResult);


// DO NOT execute updateFiles yet.
// We only want to verify that the tool is correctly defined.

console.log("\n========== UPDATE FILES TOOL ==========\n");

console.log("update_files tool loaded successfully.");
console.log("Tool name:", updateFiles.name);
console.log("Tool description:", updateFiles.description);

console.log("\n========== ALL TOOLS LOADED ==========\n");