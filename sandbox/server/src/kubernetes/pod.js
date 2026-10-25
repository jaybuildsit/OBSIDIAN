import { k8sCoreV1Api } from "./config.js"

const REGISTRY = "205382053412.dkr.ecr.ap-southeast-2.amazonaws.com"

// "path": the Vite dev server runs under /api/preview/<sandboxId>/ so the preview
//        can be served from the main domain (no wildcard DNS needed).
// "host": Vite runs at the root, for https://<id>.preview.<domain> (needs wildcard DNS).
const PREVIEW_PATH_MODE = (process.env.PREVIEW_MODE || "path") === "path"

// Requests are what the scheduler reserves on a node. Limits are the hard cap.
// The old values reserved 1500Mi per sandbox, more than a t3.small node can
// ever offer (about 1.4Gi), so sandbox pods stayed Pending forever.
// Raise a LIMIT if a container gets OOMKilled; keep requests small.
const resources = {
    sandbox: {
        requests: { cpu: "100m", memory: "192Mi" },
        limits: { cpu: "500m", memory: "640Mi" }
    },
    agent: {
        requests: { cpu: "25m", memory: "64Mi" },
        limits: { cpu: "300m", memory: "256Mi" }
    },
    syncAgent: {
        requests: { cpu: "25m", memory: "64Mi" },
        limits: { cpu: "200m", memory: "192Mi" }
    }
}

export async function createPod(sandboxId, projectId) {

    const podManifest = {
        metadata: {
            name: `sandbox-pod-${sandboxId}`,
            labels: {
                sandboxId: sandboxId
            }
        },

        spec: {

            volumes: [
                {
                    name: "workspace-volume",
                    emptyDir: {}
                }
            ],

            initContainers: [
                {
                    name: "init-container",
                    image: `${REGISTRY}/template`,
                    imagePullPolicy: "IfNotPresent",
                    command: ["sh", "-c", "cp -r /workspace/* /seed/"],
                    volumeMounts: [
                        {
                            name: "workspace-volume",
                            mountPath: "/seed"
                        }
                    ]
                }
            ],

            containers: [
                {
                    image: `${REGISTRY}/template`,
                    imagePullPolicy: "IfNotPresent",
                    name: "sandbox-container",
                    // Replaces the image's CMD ("npm run dev") to set Vite's base path.
                    ...(PREVIEW_PATH_MODE
                        ? { args: ["npm", "run", "dev", "--", "--base", `/api/preview/${sandboxId}/`] }
                        : {}),
                    ports: [
                        {
                            containerPort: 5173,
                            name: "http"
                        }
                    ],
                    resources: resources.sandbox,
                    volumeMounts: [
                        {
                            name: "workspace-volume",
                            mountPath: "/workspace"
                        }
                    ]
                },

                {
                    image: `${REGISTRY}/agent`,
                    imagePullPolicy: "IfNotPresent",
                    name: "agent-container",
                    ports: [
                        {
                            containerPort: 3000,
                            name: "http"
                        }
                    ],
                    resources: resources.agent,
                    volumeMounts: [
                        {
                            name: "workspace-volume",
                            mountPath: "/workspace"
                        }
                    ]
                },

                {
                    image: `${REGISTRY}/sync-agent`,
                    imagePullPolicy: "IfNotPresent",
                    name: "sync-agent-container",

                    ports: [
                        {
                            containerPort: 4000,
                            name: "http"
                        }
                    ],

                    resources: resources.syncAgent,

                    volumeMounts: [
                        {
                            name: "workspace-volume",
                            mountPath: "/workspace"
                        }
                    ],

                    env: [
                        {
                            name: "PROJECT_ID",
                            value: projectId
                        },
                        {
                            name: "AWS_ACCESS_KEY_ID",
                            valueFrom: {
                                secretKeyRef: {
                                    name: "aws",
                                    key: "AWS_ACCESS_KEY_ID"
                                }
                            }
                        },
                        {
                            name: "AWS_SECRET_ACCESS_KEY",
                            valueFrom: {
                                secretKeyRef: {
                                    name: "aws",
                                    key: "AWS_SECRET_ACCESS_KEY"
                                }
                            }
                        },
                        {
                            name: "AWS_REGION",
                            valueFrom: {
                                secretKeyRef: {
                                    name: "aws",
                                    key: "AWS_REGION"
                                }
                            }
                        }
                    ]
                }
            ]
        }
    }

    const response = await k8sCoreV1Api.createNamespacedPod({
        namespace: "default",
        body: podManifest
    })

    return response
}

export async function deletePod(sandboxId) {

    // With the object-style client API, gracePeriodSeconds belongs in the
    // request object. The old second argument is a client config override, so
    // the grace period was most likely being ignored (default is 30 seconds).
    const response = await k8sCoreV1Api.deleteNamespacedPod({
        namespace: "default",
        name: `sandbox-pod-${sandboxId}`,
        gracePeriodSeconds: 0
    })

    return response
}