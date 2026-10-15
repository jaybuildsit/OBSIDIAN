import axios from "axios"

import { tool } from "langchain"

import * as z from "zod"

export const listFiles = tool(
    async ({ }) => {
        const response = await axios.get("http://01a13fe7-e629-7597-b899-628e7b1d2266.agent.localhost/list-files")

        return JSON.stringify(response.data.files);

    },
    {
        name: "list-files",
        description: "List all of the files in the project directory.this is useful for understanding what files are available",

        inputSchema: z.object({})

    })


export const readFiles = tool(
    async ({ files: [] }) => {
        const response = await axios.get("http://01a13fe7-e629-7597-b899-628e7b1d2266.agent.localhost/read-files?files=" + files.join(","))

        return JSON.stringify(response.data)
    }, {

    name: "read_files",
    description: "Read the content of specified files.This is useful for undestanding the content of files that are relevant to the task at hand.",

    inputSchema: z.object({
        files: z.array(z.string()).describe("The list of files absolute paths to read.")
    })


}
)

export const updateFiles = tool(
    async ({ files }) => {
        const response = await axios.post("http://01a13fe7-e629-7597-b899-628e7b1d2266.agent.localhost/update-files",{
            updates:files
        })

        return JSON.stringify(response.data.results);
    },
    {
        name:"update_files",
        description:"Update the contents of specified files.this is useful for making changes to files based on thr requiremnts of the task at hand.",
        inputSchema:z.object({
            files:z.array(z.array(z.object({
                file:z.string().describe("The absolute path of the file to update"),
                content:z.string().describe("the new content for ther file")
            })).describe("The list of files to update and their new contents"))
        })
    }


)


