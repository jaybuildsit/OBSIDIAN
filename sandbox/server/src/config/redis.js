import Redis from "ioredis";
import { deletePod } from "../kubernetes/pod.js";
import { deleteService } from "../kubernetes/service.js";

const redis = new Redis(process.env.REDIS_URI);
const subscriber = new Redis(process.env.REDIS_URI);

// The owner's user id is stored with the key. The router reads it to make sure
// only the user who created a sandbox can reach its terminal, files and preview.
export async function createSandboxKey(sandboxId, userId) {
    await redis.set(
        `sandbox:${sandboxId}`,
        JSON.stringify({
            status: "active",
            userId: String(userId),
        }),
        "EX",
        60 * 20
    );
}

subscriber.config("SET", "notify-keyspace-events", "Ex");

subscriber.subscribe("__keyevent@0__:expired");

subscriber.on("message", async (channel, key) => {
    try {
        console.log(`Key expired: ${key}`);

        const sandboxId = key.split(":")[1];

        // Delete pod
        try {
            await deletePod(sandboxId);
            console.log(`Pod deleted: ${sandboxId}`);
        } catch (error) {
            if (error?.code === 404) {
                console.log(`Pod already deleted: ${sandboxId}`);
            } else {
                throw error;
            }
        }

        // Delete service
        try {
            await deleteService(sandboxId);
            console.log(`Service deleted: ${sandboxId}`);
        } catch (error) {
            if (error?.code === 404) {
                console.log(`Service already deleted: ${sandboxId}`);
            } else {
                throw error;
            }
        }

    } catch (error) {
        console.error("Redis expiration cleanup failed:", error);
    }
});

export default { subscriber };