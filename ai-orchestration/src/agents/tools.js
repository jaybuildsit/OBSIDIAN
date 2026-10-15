import axios from "axios"

import { tool } from "langchain"

import * as z from "zod"

export const listFiles = tool(
    async ({ }) => {
        const response = await axios.get("http://01a13fe7-e629-7597-b899-628e7b1d2266.agent.localhost/list-files")
    }, {
    name: "list-files",
    description: "List all of the files in the project directory.this is useful for understanding what files are available"
}
)