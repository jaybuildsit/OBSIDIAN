import Redis from "ioredis"

const redis = new Redis(process.env.REDIS_URI)

redis.on('connect', () => {
    console.log("Connected to Redis Successfully!!")
});

redis.on('error', (err) => {
    console.log('Redis connection error:', err)
});

export async function refreshTTL(sandboxId){
    await redis.expire(`sandbox:${sandboxId}`,60 * 60)
}

// The sandbox API stores { status, userId } under sandbox:<id> when it creates a
// sandbox. Returns the owner's user id, or null if the sandbox is unknown,
// expired, or was created before owners were recorded.
export async function getSandboxOwner(sandboxId){
    const raw = await redis.get(`sandbox:${sandboxId}`)

    if (!raw) return null

    try {
        return JSON.parse(raw).userId ?? null
    } catch {
        return null
    }
}