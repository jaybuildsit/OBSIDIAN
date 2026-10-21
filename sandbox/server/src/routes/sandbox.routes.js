import { Router } from "express"
import { createPod } from "../kubernetes/pod.js";
import { createService } from "../kubernetes/service.js";
import { createSandboxKey } from '../config/redis.js'
import { v7 as uuidv4 } from "uuid";
import { authMiddleware } from "../middlewares/auth.middleware.js"
import Project from "../models/project.model.js"

const router = Router();

router.post('/project', authMiddleware, async (req, res) => {
    const { title } = req.body;

    const newProject = new Project({
        user: req.user.id,
        title
    });

    await newProject.save();

    return res.status(201).json({
        message: 'Project created successfully',
        project: newProject
    });
})


router.post("/create", authMiddleware, async (req, res) => {

    const projectId = req.body.projectId;

    const project = await Project.findOne({ _id: projectId, user: req.user.id });

    if (!project) {
        return res.status(404).json({ message: 'Project not found or access denied' })
    }

    const sandboxId = uuidv4();

    await Promise.all([
        createPod(sandboxId, project._id.toString()),
        createService(sandboxId),
        createSandboxKey(sandboxId)
    ]);

    res.status(201).json({
        message: "Sandbox created successfully",
        sandboxId,
        previewUrl: `http://${sandboxId}.preview.localhost`
    });



})

router.get("/project", authMiddleware, async (req, res) => {
    const projects = await Project.find({ user: req.user.id });

    return res.status(200).json({
        message: 'Projects retrieved successfully',
        projects
    })
})


export default router;