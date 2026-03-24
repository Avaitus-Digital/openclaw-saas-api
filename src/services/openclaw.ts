import axios from "axios";

export interface ChatResponse {
  message: string;
}

export async function sendChatMessage(
  containerHost: string,
  message: string
): Promise<ChatResponse> {
  const response = await axios.post(
    `http://${containerHost}:42617/webhook`,
    { message },
    { timeout: 120000 }
  );

  const reply =
    response.data?.response ||
    response.data?.message ||
    response.data?.content ||
    (typeof response.data === "string" ? response.data : JSON.stringify(response.data));

  return { message: reply };
}

export async function checkContainerHealth(
  containerHost: string
): Promise<boolean> {
  try {
    const response = await axios.get(`http://${containerHost}:42617/health`, {
      timeout: 5000,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}
