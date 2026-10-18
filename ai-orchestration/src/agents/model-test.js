import "dotenv/config";

const BASE = "https://integrate.api.nvidia.com/v1";
const KEY = process.env.NVIDIA_API_KEY;
const TIMEOUT_MS = 60_000;

const MODELS = [
    "nvidia/nemotron-3.5-lightning-30b-a3b",
    "poolside/laguna-xs-2.1",
    "z-ai/glm-5-3-flash",
    "deepseek-ai/deepseek-v4.1-flash",
    "meta/muse-glimmer-30b",
    "meta/llama-3.1-8b-instruct", // control: small and historically fast, may not be listed anymore
];

const sec = (t0) => ((performance.now() - t0) / 1000).toFixed(1) + "s";

// 0. Is the network path to NVIDIA fine? (no inference, should answer in about a second)
{
    const t0 = performance.now();
    try {
        const res = await fetch(`${BASE}/models`, {
            headers: { Authorization: `Bearer ${KEY}` },
            signal: AbortSignal.timeout(15_000),
        });
        console.log(`GET /models -> HTTP ${res.status} in ${sec(t0)}`);
    } catch (e) {
        console.log(`GET /models FAILED after ${sec(t0)}: ${e.name} ${e.message}`);
    }
    console.log("API key present:", Boolean(KEY), "\n");
}

// 1. Time each model with a tiny streamed request.
for (const model of MODELS) {
    const t0 = performance.now();
    let firstChunk = null;
    try {
        const res = await fetch(`${BASE}/chat/completions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                messages: [{ role: "user", content: "Reply with one word: hi" }],
                max_tokens: 32,
                temperature: 0,
                stream: true,
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!res.ok) {
            const body = (await res.text()).slice(0, 200).replace(/\s+/g, " ");
            console.log(`${model.padEnd(42)} HTTP ${res.status} after ${sec(t0)}  ${body}`);
            continue;
        }

        for await (const _chunk of res.body) {
            if (firstChunk === null) firstChunk = sec(t0);
        }
        console.log(`${model.padEnd(42)} OK   first token: ${firstChunk}   total: ${sec(t0)}`);
    } catch (e) {
        console.log(`${model.padEnd(42)} FAIL ${e.name} after ${sec(t0)}  (first token: ${firstChunk ?? "never"})`);
    }
}