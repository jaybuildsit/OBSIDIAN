import { spawnSync } from "node:child_process";

const REGISTRY =
  "205382053412.dkr.ecr.ap-southeast-2.amazonaws.com";

const AGENT_REPOSITORY = `${REGISTRY}/agent`;

const run = (command, args, input) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() ||
        `${command} exited with status ${result.status}.`
    );
  }

  return result.stdout.trim();
};

const phase = process.argv[2];

if (phase !== "before" && phase !== "after") {
  throw new Error(
    'Specify the Skaffold hook phase as "before" or "after".'
  );
}

const context = process.env.SKAFFOLD_KUBE_CONTEXT;
const contextArgs = context
  ? ["--context", context]
  : [];

const deployment = "deployment/sandbox-deployment";

/*
 * Skaffold builds the agent image using the ECR repository
 * and its sha256 tag.
 *
 * Find the locally tagged ECR agent image.
 */
const images = run("docker", [
  "images",
  AGENT_REPOSITORY,
  "--format",
  "{{.Repository}}:{{.Tag}}",
]);

const agentImages = images
  .split(/\r?\n/)
  .map((image) => image.trim())
  .filter(Boolean)
  .filter((image) => {
    const tag = image.slice(image.lastIndexOf(":") + 1);

    return /^[a-f0-9]{64}$/i.test(tag);
  });

if (agentImages.length === 0) {
  throw new Error(
    `Could not find a Skaffold-tagged agent image in ${AGENT_REPOSITORY}.`
  );
}

/*
 * Use the most recently created matching image.
 */
const imageWithCreatedTime = agentImages
  .map((image) => {
    const created = run("docker", [
      "image",
      "inspect",
      image,
      "--format",
      "{{.Created}}",
    ]);

    return {
      image,
      created,
    };
  })
  .sort(
    (a, b) =>
      new Date(b.created).getTime() -
      new Date(a.created).getTime()
  );

const agentImage = imageWithCreatedTime[0].image;

if (!agentImage.startsWith(`${AGENT_REPOSITORY}:`)) {
  throw new Error(
    `Unexpected agent image: ${agentImage}`
  );
}

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

  run(
    "kubectl",
    [...contextArgs, "apply", "-f", "-"],
    configMap
  );
}

if (phase === "after") {
  run("kubectl", [
    ...contextArgs,
    "rollout",
    "restart",
    deployment,
  ]);

  run("kubectl", [
    ...contextArgs,
    "rollout",
    "status",
    deployment,
    "--timeout=180s",
  ]);
}

console.log(
  `Sandbox manager agent image ${agentImage} configured for ${phase} deploy.`
);