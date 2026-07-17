import { NextRequest } from 'next/server';

// Dev-mode hot reload에서도 연결을 유지하기 위해 global 객체에 SSE 클라이언트 저장
const globalForSSE = global as unknown as { sseClients: Set<ReadableStreamDefaultController> };
const clients = globalForSSE.sseClients || new Set<ReadableStreamDefaultController>();
if (process.env.NODE_ENV !== 'production') globalForSSE.sseClients = clients;

export async function GET(req: NextRequest) {
  let controllerRef: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
      clients.add(controller);
      
      // 연결 유지 확인을 위한 초기 ping
      try {
        controller.enqueue(new TextEncoder().encode('data: {"type":"ping"}\n\n'));
      } catch (e) {
        clients.delete(controller);
      }
    },
    cancel() {
      clients.delete(controllerRef);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// 업무 상태 수정 시 클라이언트들에게 변경 알람 브로드캐스트
export function broadcastSSE(data: any) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(payload);
  
  clients.forEach((client) => {
    try {
      client.enqueue(encoded);
    } catch {
      clients.delete(client);
    }
  });
}
