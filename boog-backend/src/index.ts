import { DurableObject } from 'cloudflare:workers';

export class BoogChat extends DurableObject<Env> {
	private sessions: Map<WebSocket, any>;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		this.sessions = new Map();
		this.ctx.getWebSockets().forEach((ws) => {
			this.sessions.set(ws, { ...ws.deserializeAttachment() });
		});
	}

	async fetch(_request: Request): Promise<Response> {
		const pair = new WebSocketPair();
		this.ctx.acceptWebSocket(pair[1]);
		this.sessions.set(pair[1], {});
		return new Response(null, { status: 101, webSocket: pair[0] });
	}

	webSocketMessage(ws: WebSocket, message: string) {
		const session = this.sessions.get(ws);
		if (!session || !session.id) {
			session.id = crypto.randomUUID();
			ws.serializeAttachment({ ...ws.deserializeAttachment(), id: session.id });
			ws.send(JSON.stringify({ ready: true, id: session.id }));
		}
		this.broadcast(ws, message);
	}

	broadcast(sender: WebSocket, message: string | object) {
		const senderId = this.sessions.get(sender)?.id;

		for (let [ws] of this.sessions) {
			if (ws === sender) continue;

			switch (typeof message) {
				case 'string':
					ws.send(JSON.stringify({ ...JSON.parse(message), id: senderId }));
					break;
				default:
					ws.send(JSON.stringify({ ...message, id: senderId }));
					break;
			}
		}
	}

	webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void> {
		this.close(ws);
	}

	webSocketError(ws: WebSocket, error: unknown): void | Promise<void> {
		this.close(ws);
	}

	close(ws: WebSocket) {
		const session = this.sessions.get(ws);
		if (!session?.id) return;

		this.broadcast(ws, { type: 'close' });
		this.sessions.delete(ws);
	}
}

export default {
	async fetch(request, env, _ctx): Promise<Response> {
		// ensure the request is a websocket upgrade request
		const upgrade = request.headers.get('Upgrade');
		if (!upgrade || upgrade !== 'websocket') {
			return new Response('Expected Upgrade: websocket', { status: 426 });
		}

		// match the pathname to the appropriate durable object
		let id: DurableObjectId = env.BOOG_CHAT.idFromName(new URL(request.url).pathname);

		const boogchat = env.BOOG_CHAT.get(id);
		return boogchat.fetch(request);
	},
} satisfies ExportedHandler<Env>;
