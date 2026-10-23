import { Router } from "express";
import mongoose from "mongoose";
import { createPod } from "../kubernetes/pod.js";
import { createService } from "../kubernetes/service.js";
import { createSandboxKey } from "../config/redis.js";
import { v7 as uuidv4 } from "uuid";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import Project from "../models/project.model.js";

const router = Router();

// Base domain used for preview URLs. Change it by env var, not by editing code.
const SANDBOX_BASE_DOMAIN =
    process.env.SANDBOX_BASE_DOMAIN || "obsidian.devs.surf";

router.post("/project", authMiddleware, async (req, res) => {
    try {
        const title =
            typeof req.body?.title === "string" ? req.body.title.trim() : "";

        if (!title) {
            return res.status(400).json({ message: "Project title is required" });
        }

        const newProject = new Project({
            user: req.user.id,
            title,
        });

        await newProject.save();

        return res.status(201).json({
            message: "Project created successfully",
            project: newProject,
        });
    } catch (err) {
        console.error("Create project failed:", err);
        return res.status(500).json({ message: "Unable to create project" });
    }
});

router.post("/create", authMiddleware, async (req, res) => {
    try {
        const projectId = req.body?.projectId;

        if (!mongoose.isValidObjectId(projectId)) {
            return res.status(400).json({ message: "Invalid project ID" });
        }

        const project = await Project.findOne({
            _id: projectId,
            user: req.user.id,
        });

        if (!project) {
            return res.status(404).json({
                message: "Project not found or access denied",
            });
        }

        const sandboxId = uuidv4();

        // allSettled so one failure doesn't hide the state of the others.
        const results = await Promise.allSettled([
            createPod(sandboxId, project._id.toString()),
            createService(sandboxId),
            createSandboxKey(sandboxId),
        ]);

        const failed = results.filter((result) => result.status === "rejected");

        if (failed.length) {
            failed.forEach((result) =>
                console.error("Sandbox creation step failed:", result.reason),
            );

            // TODO: delete whichever of the pod / service / redis key succeeded.
            // I haven't seen the kubernetes modules, so cleanup isn't written here.
            return res.status(500).json({
                message: "Sandbox creation failed. Please try again.",
            });
        }

        return res.status(201).json({
            message: "Sandbox created successfully",
            sandboxId,
            previewUrl: `https://${sandboxId}.preview.${SANDBOX_BASE_DOMAIN}`,
        });
    } catch (err) {
        console.error("Create sandbox failed:", err);
        return res.status(500).json({ message: "Sandbox creation failed" });
    }
});

router.get("/project", authMiddleware, async (req, res) => {
    try {
        const projects = await Project.find({
            user: req.user.id,
        });

        return res.status(200).json({
            message: "Projects retrieved successfully",
            projects,
        });
    } catch (err) {
        console.error("List projects failed:", err);
        return res.status(500).json({ message: "Unable to load projects" });
    }
});

export default router;