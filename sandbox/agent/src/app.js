import express from "express";

import morgan from "morgan";
import fs from "fs";


const WORKING_DIR = "/workspace";

const app = express();
// app.use(morgan('combined'));

app.get('/', (req, res) => {
    res.status(200).json({ message: "Hello from sandbox agent", status: "success" });
})

app.get('/list-files', async (req, res) => {
    const elements = await fs.promises.readdir(WORKING_DIR);

    res.status(200).json({ message: "Elements in working directory", elements, status: "success" });



});


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
        message:'File contents',
        files:results,
    })


    // const fileContents = {};

})



export default app;