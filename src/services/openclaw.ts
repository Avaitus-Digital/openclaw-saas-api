import WebSocket from "ws";

export interface ChatResponse {
  message: string;
}

export async function sendChatMessage(
  containerHost: string,
  message: string
): Promise<ChatResponse> {
  return new Promise((resolve, reject) => {
    const wsUrl = `ws://${containerHost}:42617/ws/chat`;
    const ws = new WebSocket(wsUrl);
    let fullResponse = "";
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        reject(new Error("Chat request timed out after 120 seconds"));
      }
    }, 120000);

    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "message", content: message }));
    });

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case "chunk":
            fullResponse += msg.content || "";
            break;
          case "done":
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              ws.close();
              resolve({
                message: msg.full_response || fullResponse || "No response",
              });
            }
            break;
          case "error":
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              ws.close();
              reject(new Error(msg.message || "ZeroClaw error"));
            }
            break;
        }
      } catch {
        // ignore parse errors for non-JSON messages
      }
    });

    ws.on("error", (err: Error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    ws.on("close", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (fullResponse) {
          resolve({ message: fullResponse });
        } else {
          reject(new Error("WebSocket closed before response"));
        }
      }
    });
  });
}

export async function checkContainerHealth(
  containerHost: string
): Promise<boolean> {
  try {
    const response = await fetch(`http://${containerHost}:42617/health`);
    return response.ok;
  } catch {
    return false;
  }
}
