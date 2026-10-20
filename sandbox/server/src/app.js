import express from "express";
import morgan from "morgan";
import { createPod } from "./kubernetes/pod.js";
import { createService } from "./kubernetes/service.js";
import { v7 as uuidv4 } from "uuid";
import { createSandboxKey } from './config/redis.js'


const app = express();
app.use(morgan('dev'));
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.get("/api/sandbox/health", (req, res) => {
  res.status(200).json({ message: "Server is healthy", status: "ok" });
});

app.post("/api/sandbox/create/", async (req, res) => {
  const sandboxId = uuidv4();

  await Promise.all([
    createPod(sandboxId),
    createService(sandboxId),
    createSandboxKey(sandboxId)
  ]);

  res.status(201).json({
    message: "Sandbox created successfully",
    sandboxId,
    previewUrl: `http://${sandboxId}.preview.localhost`
  });



})

export default app;