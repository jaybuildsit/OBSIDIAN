import Redis from "ioredis"

const redis = new Redis(process.env.REDIS_URI)

redis.on('connect', () => {
    console.log("Connected to Redis Successfully!!")
});

redis.on('error', (err) => {
    console.log('Redis connection error:', err)
});

export async function refreshTTL(sandboxId){
    await redis.expire(`sandbox:${sandboxId}`,120)
}