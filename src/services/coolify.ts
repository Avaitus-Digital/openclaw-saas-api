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

function generateZeroClawCompose(userId: number): string {
  return `
services:
  zeroclaw:
    image: ghcr.io/zeroclaw-labs/zeroclaw:debian
    restart: unless-stopped
    environment:
      - API_KEY=${config.openrouter.apiKey}
      - PROVIDER=openrouter
      - ZEROCLAW_MODEL=google/gemini-2.5-flash
      - ZEROCLAW_ALLOW_PUBLIC_BIND=true
      - ZEROCLAW_GATEWAY_PORT=42617
    volumes:
      - zeroclaw-data-${userId}:/zeroclaw-data
    healthcheck:
      test: ["CMD", "zeroclaw", "status", "--format=exit-code"]
      interval: 60s
      timeout: 10s
      retries: 3
      start_period: 15s
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 32M

volumes:
  zeroclaw-data-${userId}:
`.trim();
}

export interface CoolifyServiceResponse {
  uuid: string;
  domains?: string[];
}

export async function createZeroClawService(
  userId: number
): Promise<{ serviceUuid: string }> {
  const composeRaw = generateZeroClawCompose(userId);
  const composeBase64 = Buffer.from(composeRaw).toString("base64");

  const response = await coolifyApi.post<CoolifyServiceResponse>(
    "/api/v1/services",
    {
      project_uuid: config.coolify.projectUuid,
      environment_uuid: config.coolify.environmentUuid,
      server_uuid: config.coolify.serverUuid,
      docker_compose_raw: composeBase64,
      name: `zeroclaw-user-${userId}`,
      description: `ZeroClaw instance for user ${userId}`,
      instant_deploy: true,
    }
  );

  const serviceUuid = response.data.uuid;

  try {
    await coolifyApi.patch(`/api/v1/services/${serviceUuid}`, {
      connect_to_docker_network: true,
    });
    await coolifyApi.post(`/api/v1/services/${serviceUuid}/restart`);
    console.log(`Service ${serviceUuid}: network enabled and restarted`);
  } catch (err) {
    console.warn(`Failed to auto-configure network for ${serviceUuid}:`, err);
  }

  return { serviceUuid };
}

export async function deleteService(serviceUuid: string): Promise<void> {
  await coolifyApi.delete(`/api/v1/services/${serviceUuid}`);
}

export async function stopService(serviceUuid: string): Promise<void> {
  await coolifyApi.post(`/api/v1/services/${serviceUuid}/stop`);
}

export async function startService(serviceUuid: string): Promise<void> {
  await coolifyApi.post(`/api/v1/services/${serviceUuid}/start`);
}

export async function restartService(serviceUuid: string): Promise<void> {
  await coolifyApi.post(`/api/v1/services/${serviceUuid}/restart`);
}

export async function getServiceStatus(serviceUuid: string): Promise<string> {
  try {
    const response = await coolifyApi.get(`/api/v1/services/${serviceUuid}`);
    return response.data.status || "unknown";
  } catch {
    return "unknown";
  }
}

export function getContainerUrl(serviceUuid: string): string {
  return `zeroclaw-${serviceUuid}`;
}
