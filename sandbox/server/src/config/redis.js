import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URI);

const subscriber = new Redis(process.env.REDIS_URI);

export async function createSandboxKey(sandboxId) {
    await redis.set(
        `sandbox:${sandboxId}`,
        JSON.stringify({
            status: "active",
        }),
        "EX",
        120
    );
}

subscriber.config("SET", "notify-keyspace-events", "Ex");

subscriber.subscribe("__keyevent@0__:expired");

subscriber.on("message", (channel, key) => {
    console.log(`Key expired: ${key}`);

    const sandbox=key.split(':')[1];

});

export default { subscriber };