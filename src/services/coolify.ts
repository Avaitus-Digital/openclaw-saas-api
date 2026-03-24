import axios, { AxiosInstance } from "axios";
import { config } from "../config";

const coolifyApi: AxiosInstance = axios.create({
  baseURL: config.coolify.url,
  headers: {
    Authorization: `Bearer ${config.coolify.apiToken}`,
    "Content-Type": "application/json",
  },
  timeout: 120000,
});

function generateOpenClawCompose(
  userId: number,
  gatewayToken: string
): string {
  return `
services:
  openclaw:
    image: openclaw-saas:latest
    pull_policy: never
    environment:
      - OPENROUTER_API_KEY=${config.openrouter.apiKey}
      - OPENCLAW_GATEWAY_TOKEN=${gatewayToken}
      - OPENCLAW_PRIMARY_MODEL=openrouter/google/gemini-2.5-flash
      - PORT=8080
      - OPENCLAW_GATEWAY_PORT=18789
      - OPENCLAW_GATEWAY_BIND=lan
      - OPENCLAW_STATE_DIR=/data/.openclaw
      - OPENCLAW_WORKSPACE_DIR=/data/workspace
    volumes:
      - openclaw-data-${userId}:/data
    depends_on:
      browser:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://127.0.0.1:8080/healthz"]
      interval: 10s
      timeout: 10s
      retries: 5
  browser:
    image: coollabsio/openclaw-browser:latest
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Etc/UTC
      - CHROME_CLI=--remote-debugging-port=9222
    volumes:
      - browser-data-${userId}:/config
    healthcheck:
      test: ["CMD-SHELL", "bash -c ':> /dev/tcp/127.0.0.1/9222' || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  openclaw-data-${userId}:
  browser-data-${userId}:
`.trim();
}

function generateGatewayToken(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export interface CoolifyServiceResponse {
  uuid: string;
  domains?: string[];
}

export async function createOpenClawService(
  userId: number
): Promise<{ serviceUuid: string; gatewayToken: string }> {
  const gatewayToken = generateGatewayToken();
  const composeRaw = generateOpenClawCompose(userId, gatewayToken);
  const composeBase64 = Buffer.from(composeRaw).toString("base64");

  const response = await coolifyApi.post<CoolifyServiceResponse>(
    "/api/v1/services",
    {
      project_uuid: config.coolify.projectUuid,
      environment_uuid: config.coolify.environmentUuid,
      server_uuid: config.coolify.serverUuid,
      docker_compose_raw: composeBase64,
      name: `openclaw-user-${userId}`,
      description: `OpenClaw instance for user ${userId}`,
      instant_deploy: true,
    }
  );

  const serviceUuid = response.data.uuid;

  // Enable predefined network so backend can reach the container
  try {
    await coolifyApi.patch(`/api/v1/services/${serviceUuid}`, {
      connect_to_docker_network: true,
    });
    // Restart to apply network change
    await coolifyApi.post(`/api/v1/services/${serviceUuid}/restart`);
    console.log(`Service ${serviceUuid}: network enabled and restarted`);
  } catch (err) {
    console.warn(`Failed to auto-configure network for ${serviceUuid}:`, err);
  }

  return { serviceUuid, gatewayToken };
}

export async function deleteOpenClawService(
  serviceUuid: string
): Promise<void> {
  await coolifyApi.delete(`/api/v1/services/${serviceUuid}`);
}

export async function stopOpenClawService(serviceUuid: string): Promise<void> {
  await coolifyApi.post(`/api/v1/services/${serviceUuid}/stop`);
}

export async function startOpenClawService(
  serviceUuid: string
): Promise<void> {
  await coolifyApi.post(`/api/v1/services/${serviceUuid}/start`);
}

export async function restartOpenClawService(
  serviceUuid: string
): Promise<void> {
  await coolifyApi.post(`/api/v1/services/${serviceUuid}/restart`);
}

export async function getServiceStatus(
  serviceUuid: string
): Promise<string> {
  try {
    const response = await coolifyApi.get(`/api/v1/services/${serviceUuid}`);
    return response.data.status || "unknown";
  } catch {
    return "unknown";
  }
}

export function getContainerUrl(serviceUuid: string): string {
  return `http://openclaw-${serviceUuid}:18789`;
}
