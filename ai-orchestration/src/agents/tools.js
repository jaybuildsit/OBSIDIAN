import axios from "axios";
import { tool } from "langchain";
import * as z from "zod";

const SANDBOX_URL =
    "http://sandbox-service-01a14a84-59a4-7616-bde0-b3106e32f407:3000";




export const listFiles = tool(
    async ({}) => {
        console.log("=======================");
        console.log("Using ListFiles tool");
        console.log("=======================");

        const response = await axios.get(
            `${SANDBOX_URL}/list-files`
        );

        console.log("=======================");
        console.log("Response from ListFiles tool", response.data);
        console.log("=======================");

        return JSON.stringify(response.data.files);
    },
    {
        name: "list_files",
        description:
            "List all the files in the project directory. This is useful for understanding what files are available to work with.",
        schema: z.object({}),
    }
);

export const readFiles = tool(
    async ({ files = [] }) => {
        console.log("=======================");
        console.log("Using ReadFiles tool");
        console.log("=======================");

        const response = await axios.get(
            `${SANDBOX_URL}/read-files?files=${files.join(",")}`
        );

        console.log("=======================");
        console.log("Response from ReadFiles tool", response.data);
        console.log("=======================");

        return JSON.stringify(response.data);
    },
    {
        name: "read_files",
        description:
            "Read the contents of specified files. This is useful for understanding the content of files that are relevant to the task at hand.",
        schema: z.object({
            files: z
                .array(z.string())
                .describe(
                    "The list of absolute file paths to read."
                ),
        }),
    }
);

export const updateFiles = tool(
    async ({ files }) => {
        console.log("=======================");
        console.log("Using UpdateFiles tool");
        console.log("=======================");

        const response = await axios.patch(
            `${SANDBOX_URL}/update-files`,
            {
                updates: files,
            }
        );

        console.log("=======================");
        console.log("Response from UpdateFiles tool", response.data);
        console.log("=======================");

        return JSON.stringify(response.data.results);
    },
    {
        name: "update_files",
        description:
            "Update the contents of specified files. This can also create new files by providing a new file name in the file field and the content to be added in the content field.",
        schema: z.object({
            files: z
                .array(
                    z.object({
                        file: z
                            .string()
                            .describe(
                                "The absolute path of the file to update"
                            ),
                        content: z
                            .string()
                            .describe(
                                "The new content for the file"
                            ),
                    })
                )
                .describe(
                    "The list of files to update and their new contents."
                ),
        }),
    }
);