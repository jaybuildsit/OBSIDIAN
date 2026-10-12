import { k8sCoreV1Api } from "./config.js"

export async function createPod(sandboxId) {

    const podManifest = {
        metadata: {
            name: `sandbox-pod-${sandboxId}`,
            labels: {
                app: 'sandbox',
                sandboxId: sandboxId
            }
        },
        spec: {
            containers: [
                {
                    image: "template",
                    imagePullPolicy: "IfnotPresent",
                    name: 'sandbox-container',
                    ports: [{ containerPort: 5173, name: "http" }],
                    resources:{
                        limits:{
                            cpu:"500m",
                            memory:"IGI"
                        },
                        requests:{
                            cpu:"250m",
                            memory:"500Mi"
                        }
                    }
                }
            ]
        }
    }

}