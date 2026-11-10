import { once } from "events";
import type { AddressInfo } from "net";
import { WebSocket, WebSocketServer } from "ws";
import { startHeartbeat } from "./ws-heartbeat";

describe("startHeartbeat", () => {
  let wss: WebSocketServer;
  let url: string;
  const clients: WebSocket[] = [];

  beforeEach(async () => {
    wss = new WebSocketServer({ port: 0 });
    await once(wss, "listening");
    url = `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) client.terminate();
    await new Promise((resolve) => wss.close(resolve));
  });

  async function connect(options?: { autoPong: boolean }) {
    const client = new WebSocket(url, options);
    clients.push(client);
    await once(client, "open");
    return client;
  }

  it("terminates a connection that stops answering pings", async () => {
    startHeartbeat(wss, 40);
    // autoPong: false stands in for a peer that vanished without closing
    // (phone out of coverage): the TCP connection is still up, but nothing
    // on the other end ever replies.
    await connect({ autoPong: false });
    const [serverSocket] = [...wss.clients];
    const closed = once(serverSocket, "close");

    await closed;
    expect(wss.clients.size).toBe(0);
  });

  it("keeps a connection that answers pings", async () => {
    startHeartbeat(wss, 40);
    const client = await connect();

    // Several heartbeat rounds — a healthy peer must survive all of them.
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(wss.clients.size).toBe(1);
    expect(client.readyState).toBe(WebSocket.OPEN);
  });
});
