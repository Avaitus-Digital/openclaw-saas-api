import axios from "axios";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function sendChatMessage(
  containerUrl: string,
  gatewayToken: string,
  messages: ChatMessage[]
): Promise<ChatCompletionResponse> {
  const response = await axios.post<ChatCompletionResponse>(
    `${containerUrl}/v1/chat/completions`,
    {
      model: "openclaw",
      messages,
    },
    {
      headers: {
        Authorization: `Bearer ${gatewayToken}`,
        "Content-Type": "application/json",
      },
      timeout: 120000,
    }
  );

  return response.data;
}

export async function checkContainerHealth(
  containerUrl: string
): Promise<boolean> {
  try {
    const response = await axios.get(`${containerUrl}/healthz`, {
      timeout: 5000,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}
