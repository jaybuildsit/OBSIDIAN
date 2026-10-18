import axios from "axios";
import { tool } from "langchain";
import * as z from "zod";

export const listFiles = tool(
    async ({ }, config) => {

        const writer = config.writer;

        ("Listing files in project directory...\n")

        // console.log("TOOL CONFIG:", config);

        const SANDBOX_URL =
            `http://sandbox-service-${config.context.projectId}:3000`;

        // console.log("PROJECT ID:", config.context.projectId);
        // console.log("SANDBOX URL:", SANDBOX_URL);



        const response = await axios.get(
            `${SANDBOX_URL}/list-files`
        );

        writer("Files Listed Successfully.." + "Files:" + response.data.files.join(",") + "\n")

        return JSON.stringify(response.data.files);
    },
    {
        name: "list_files",
        description:
            "List all the files in the project directory.",
        schema: z.object({})
    }
);

export const readFiles = tool(
    async ({ files = [] }, config) => {

        const writer = config.writer;
        writer("Reading Files...\n" + files.join(",") + "\n")

        const SANDBOX_URL =
            `http://sandbox-service-${config.context.projectId}:3000`;

        // console.log("PROJECT ID:", config.context.projectId);
        // console.log("SANDBOX URL:", SANDBOX_URL);

        const response = await axios.get(
            `${SANDBOX_URL}/read-files?files=${files.join(",")}`
        );

        writer("Files read Successfully")

        return JSON.stringify(response.data);
    },
    {
        name: "read_files",
        description:
            "Read the contents of specified files. This is useful for understanding the content of files that are relevant to the task at hand.",
        schema: z.object({
            files: z
                .array(z.string())
                .describe("The list of absolute file paths to read.")
        })
    }
);

export const updateFiles = tool(
    async ({ files }, config) => {
        const writer = config.writer;

        console.log("=================================");
        console.log("UPDATE FILES TOOL CALLED");
        console.log("PROJECT ID:", config.context.projectId);
        console.log("NUMBER OF FILES:", files?.length);

        for (const update of files) {
            console.log("FILE:", update.file);
            console.log(
                "CONTENT LENGTH:",
                update.content?.length
            );
        }

        console.log("=================================");

        writer("Updating files..." + files.map(f => f.file).join(",") + "\n");

        const SANDBOX_URL =
            `http://sandbox-service-${config.context.projectId}:3000`;

        try {
            const response = await axios.patch(
                `${SANDBOX_URL}/update-files`,
                {
                    updates: files
                },
                {
                    timeout: 30000
                }
            );

            console.log("UPDATE FILES RESPONSE:");
            console.log(response.data);

            writer("Updated files successfully!!");

            return JSON.stringify(response.data.results);

        } catch (error) {
            console.error("=================================");
            console.error("UPDATE FILES FAILED");

            if (error.response) {
                console.error("STATUS:", error.response.status);
                console.error("DATA:", error.response.data);
            } else if (error.request) {
                console.error("NO RESPONSE FROM SANDBOX");
                console.error("REQUEST WAS SENT");
            } else {
                console.error("ERROR:", error.message);
            }

            console.error("=================================");

            writer("Failed to update files.");

            throw new Error(
                `Failed to update files: ${error.message}`
            );
        }
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
                                "The absolute path of the file to update or create"
                            ),

                        content: z
                            .string()
                            .describe(
                                "The complete new content for the file"
                            )
                    })
                )
                .describe(
                    "The list of files to update or create, with their complete new contents."
                )
        })
    }
);