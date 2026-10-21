import "dotenv/config"
import chokidar from "chokidar"
import {
    DeleteObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client
} from "@aws-sdk/client-s3"
import { createReadStream } from "node:fs"
import { mkdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"

const projectId = process.env.PROJECT_ID
const bucketName = "obsidian-project-bucket"
const localDirectory = "/workspace"
const region = process.env.AWS_REGION

if (!projectId) {
    throw new Error("PROJECT_ID must be set")
}

if (!region) {
    throw new Error("AWS_REGION must be set")
}

const s3Client = new S3Client({
    region
})

const pendingOperations = new Map()

function getObjectKey(filePath) {
    const absolutePath = path.resolve(filePath)
    const relativePath = path.relative(localDirectory, absolutePath)

    if (
        !relativePath ||
        relativePath === ".." ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
    ) {
        throw new Error(`File is outside the workspace: ${filePath}`)
    }

    return `${projectId}/${relativePath.split(path.sep).join("/")}`
}

function getLocalFilePath(s3Key) {
    const prefix = `${projectId}/`

    if (!s3Key.startsWith(prefix)) {
        throw new Error(`S3 object is outside project prefix: ${s3Key}`)
    }

    const relativePath = s3Key.slice(prefix.length)

    if (!relativePath) {
        throw new Error(`Invalid S3 object key: ${s3Key}`)
    }

    const localPath = path.resolve(localDirectory, relativePath)
    const workspacePath = path.resolve(localDirectory)

    if (
        localPath !== workspacePath &&
        !localPath.startsWith(`${workspacePath}${path.sep}`)
    ) {
        throw new Error(`S3 object escapes workspace: ${s3Key}`)
    }

    return localPath
}

function shouldIgnore(filePath) {
    const normalizedPath = filePath.split(path.sep).join("/")

    return (
        normalizedPath.includes("/node_modules/") ||
        normalizedPath.includes("/.git/") ||
        normalizedPath.endsWith("/.env") ||
        normalizedPath.includes("/.env.")
    )
}

function enqueueOperation(key, operation) {
    const previousOperation =
        pendingOperations.get(key) || Promise.resolve()

    const currentOperation = previousOperation
        .catch(() => {})
        .then(operation)

    pendingOperations.set(key, currentOperation)

    void currentOperation
        .catch((error) => {
            console.error(
                `Failed to sync s3://${bucketName}/${key}:`,
                error
            )
        })
        .finally(() => {
            if (pendingOperations.get(key) === currentOperation) {
                pendingOperations.delete(key)
            }
        })
}

async function uploadFile(filePath) {
    if (shouldIgnore(filePath)) {
        return
    }

    const key = getObjectKey(filePath)

    enqueueOperation(key, async () => {
        const fileStats = await stat(filePath)

        if (!fileStats.isFile()) {
            return
        }

        await s3Client.send(
            new PutObjectCommand({
                Bucket: bucketName,
                Key: key,
                Body: createReadStream(filePath),
                ContentLength: fileStats.size
            })
        )

        console.log(
            `Uploaded ${filePath} → s3://${bucketName}/${key}`
        )
    })
}

async function deleteFile(filePath) {
    if (shouldIgnore(filePath)) {
        return
    }

    const key = getObjectKey(filePath)

    enqueueOperation(key, async () => {
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: bucketName,
                Key: key
            })
        )

        console.log(
            `Deleted s3://${bucketName}/${key}`
        )
    })
}

async function getS3Files() {
    console.log(
        `Checking S3 for existing files: ${projectId}/`
    )

    const objects = []

    let continuationToken

    do {
        const response = await s3Client.send(
            new ListObjectsV2Command({
                Bucket: bucketName,
                Prefix: `${projectId}/`,
                ContinuationToken: continuationToken
            })
        )

        if (response.Contents) {
            objects.push(...response.Contents)
        }

        continuationToken = response.NextContinuationToken
    } while (continuationToken)

    return objects.filter(
        (object) =>
            object.Key &&
            !object.Key.endsWith("/")
    )
}

async function downloadFileFromS3(s3Key) {
    if (
        s3Key.includes("/node_modules/") ||
        s3Key.includes("/.git/") ||
        s3Key.endsWith("/.env") ||
        s3Key.includes("/.env.")
    ) {
        return
    }

    const localFilePath = getLocalFilePath(s3Key)

    const response = await s3Client.send(
        new GetObjectCommand({
            Bucket: bucketName,
            Key: s3Key
        })
    )

    if (!response.Body) {
        throw new Error(`Empty S3 response for ${s3Key}`)
    }

    const body = await response.Body.transformToByteArray()

    await mkdir(path.dirname(localFilePath), {
        recursive: true
    })

    await writeFile(localFilePath, body)

    console.log(
        `Downloaded s3://${bucketName}/${s3Key} → ${localFilePath}`
    )
}

async function restoreProjectFromS3() {
    const s3Objects = await getS3Files()

    if (s3Objects.length === 0) {
        console.log(
            `No existing files found for project ${projectId}`
        )

        return false
    }

    console.log(
        `Found ${s3Objects.length} existing files for project ${projectId}`
    )

    for (const object of s3Objects) {
        await downloadFileFromS3(object.Key)
    }

    console.log("S3 → workspace restore completed")

    return true
}

async function startWatcher() {
    console.log(
        `Starting Chokidar watcher on ${localDirectory}`
    )

    const watcher = chokidar.watch(localDirectory, {
        ignored: [
            /(^|[\/\\])\../,
            /node_modules/,
            /\/\.git\//,
            /\.env/
        ],

        ignoreInitial: false,

        awaitWriteFinish: {
            stabilityThreshold: 300,
            pollInterval: 100
        }
    })

    watcher
        .on("add", uploadFile)
        .on("change", uploadFile)
        .on("unlink", deleteFile)

        .on("error", (error) => {
            console.error(
                "Workspace watcher error:",
                error
            )
        })

    return watcher
}

let watcher
let shutdownPromise

async function init() {
    try {
        await restoreProjectFromS3()

        watcher = await startWatcher()

        console.log("🚀 Sync agent started")
        console.log(`Project: ${projectId}`)
        console.log(`Workspace: ${localDirectory}`)
        console.log(`Bucket: ${bucketName}`)
    } catch (error) {
        console.error(
            "Failed to initialize sync agent:",
            error
        )

        process.exitCode = 1
    }
}

function shutdown() {
    if (!shutdownPromise) {
        shutdownPromise = (async () => {
            if (watcher) {
                await watcher.close()
            }

            await Promise.allSettled(
                pendingOperations.values()
            )

            s3Client.destroy()

            console.log("Sync agent shut down")
        })()
    }

    return shutdownPromise
}

process.once("SIGINT", () => {
    void shutdown().catch((error) => {
        console.error(
            "Failed to shut down sync agent:",
            error
        )

        process.exitCode = 1
    })
})

process.once("SIGTERM", () => {
    void shutdown().catch((error) => {
        console.error(
            "Failed to shut down sync agent:",
            error
        )

        process.exitCode = 1
    })
})

init()