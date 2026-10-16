const base = process.env.DOKPLOY_URL;
const key = process.env.DOKPLOY_API_KEY;
const composeId = process.env.DOKPLOY_COMPOSE_ID;
if (!base || !key || !composeId) throw new Error("Dokploy deployment configuration is missing");

const headers = { "content-type": "application/json", "x-api-key": key };
async function request(path, options = {}) {
  const response = await fetch(new URL(`/api/${path}`, base), { ...options, headers });
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new Error(`Dokploy ${path} failed (${response.status}): ${body.message || body.error || "unknown error"}`);
  }
  return body.data ?? body;
}

const path = `deployment.allByCompose?composeId=${encodeURIComponent(composeId)}`;
const before = new Set((await request(path)).map((item) => item.deploymentId));
await request("compose.deploy", {
  method: "POST",
  body: JSON.stringify({ composeId, title: `Deploy ${process.env.GITHUB_SHA?.slice(0, 7) || "main"}` }),
});

const deadline = Date.now() + 30 * 60 * 1000;
let deploymentId;
while (Date.now() < deadline) {
  const deployments = await request(path);
  const deployment = deploymentId
    ? deployments.find((item) => item.deploymentId === deploymentId)
    : deployments.find((item) => !before.has(item.deploymentId));
  if (deployment) {
    deploymentId = deployment.deploymentId;
    console.log(`Dokploy deployment ${deploymentId}: ${deployment.status}`);
    if (deployment.status === "done") break;
    if (["error", "cancelled", "canceled"].includes(deployment.status)) {
      throw new Error(`Dokploy deployment failed: ${deployment.errorMessage || deployment.status}`);
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 10000));
}
if (!deploymentId) throw new Error("Dokploy did not create a deployment record");
if (Date.now() >= deadline) throw new Error(`Dokploy deployment ${deploymentId} timed out`);

const service = await request(`compose.one?composeId=${encodeURIComponent(composeId)}`);
if (service.composeStatus !== "done") throw new Error(`Compose status is ${service.composeStatus}`);
console.log("Dokploy Compose deployment completed");
