import express from "express";

import morgan from "morgan";
import fs from "fs";
import path from 'path'


const WORKING_DIR = "/workspace";

const app = express();
// app.use(morgan('combined'));

app.get('/', (req, res) => {
    res.status(200).json({ message: "Hello from sandbox agent", status: "success" });
})

app.get("/list-files", async (req, res) => {

    const listFiles = async (dir, baseDir) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        const files = [];

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(baseDir, fullPath);

            // Exclude certain directories
            if (entry.isDirectory() && ['node_modules', '.git', 'dist'].includes(entry.name)) {
                continue;
            }

            if (entry.isDirectory()) {
                files.push(...await listFiles(fullPath, baseDir));
            } else {
                files.push(relativePath);
            }
        }

        return files;
    }

    try {
        const files = await listFiles(WORKING_DIR, WORKING_DIR);
        res.status(200).json({
            message: 'Files listed successfully',
            files,
        });
    } catch (err) {
        res.status(500).json({
            message: `Error listing files: ${err.message}`,
            status: 'error',
        });
    }

})


app.get('/read-files', async (req, res) => {

    const files = req.query.files;

    if (!files) {
        return res.status(400).json({
            message: "No specific files in query parameter",
            status: 'error',
        })
    }

    const fileList = files.split(',');

    const results = await Promise.all(fileList.map(async (file) => {
        const filePath = `${WORKING_DIR}/${file}`;
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return {
                [filePath]: content,
            }
            // res.write(`Content of ${file}:\n${content}\n\n`);

        } catch (err) {

            return {
                [filePath]: `Error reading file:${err.message}`,
            }

            // res.write(`Error reading ${file}:${err.message}\n\n`);
        }


    }));

    res.status(200).json({
        message: 'File contents',
        files: results,
    })


    // const fileContents = {};

})

app.patch("/update-files", async (req, res) => {

    const updates = req.body.updates;

    if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({
            message: 'Invalid request body.Expected a JSON object with an "updates" property containing an array of file updates',
            status: 'error',
        });
    }

    const results = await Promise.all(updates.map(async (update) => {

        const { file, content } = update;

        const filePath = path.join(WORKING_DIR, file);

        try {
            await fs.promises.writeFile(filePath, content, 'utf-8');
            return {
                [filePath]: "File updated successfully",
            }
        } catch (err) {
            return {
                [filePath]: `Error updating file:${err.message}`,
            }
        }


    }));

    res.status(200).json({
        message: 'File updated Successfully',
        results,
    })


})

app.post('/create-files', async (req, res) => {
    const files = req.nody.files;

    if (!files || !Array.isArray(files)) {
        return res.status(400).json({
            message: 'Invalid request body. Expected a JSON object with  a "files" property containing',
            status: 'error',

        });
    }

    const results = await Promise.all(files.map(async (fileObj) => {
        const { file, content } = fileObj;
        const filePath = path.join(WORKING_DIR, file);

        try {
            await fs.promises.writeFile(filePath, content, 'utf-8');
            return {
                [filePath]: 'File created successfully',
            }
        } catch (err) {
            return {
                [filePath]: `Error creating file:${err.message}`,
            }
        }

    }))


})


export default app;