import { spawnSync } from "node:child_process";

const run = (command, args, input) => {
  const result = spawnSync(command, args, { encoding: "utf8", input });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `${command} exited with status ${result.status}.`);
  }

  return result.stdout.trim();
};

const imageId = run("docker", ["image", "inspect", "agent:latest", "--format", "{{.Id}}"]);

if (!/^sha256:[a-f0-9]{64}$/i.test(imageId)) {
  throw new Error(`Unexpected agent image ID: ${imageId}`);
}

const agentImage = `agent:${imageId.slice("sha256:".length)}`;
const taggedImageId = run("docker", ["image", "inspect", agentImage, "--format", "{{.Id}}"]);

if (taggedImageId !== imageId) {
  throw new Error(`The Skaffold image tag ${agentImage} does not match agent:latest.`);
}

const context = process.env.SKAFFOLD_KUBE_CONTEXT;
const contextArgs = context ? ["--context", context] : [];
const deployment = "deployment/sandbox-deployment";
const phase = process.argv[2];

if (phase === "before") {
  const configMap = run("kubectl", [
    ...contextArgs,
    "create",
    "configmap",
    "sandbox-agent-image",
    `--from-literal=AGENT_IMAGE=${agentImage}`,
    "--dry-run=client",
    "-o",
    "yaml",
  ]);
  run("kubectl", [...contextArgs, "apply", "-f", "-"], configMap);
} else if (phase === "after") {
  run("kubectl", [...contextArgs, "rollout", "restart", deployment]);
  run("kubectl", [...contextArgs, "rollout", "status", deployment, "--timeout=180s"]);
} else {
  throw new Error('Specify the Skaffold hook phase as "before" or "after".');
}

console.log(`Sandbox manager agent image ${agentImage} configured for ${phase} deploy.`);
