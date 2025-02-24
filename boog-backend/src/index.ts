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
}

export default {
	async fetch(request, env, _ctx): Promise<Response> {
		// match the pathname to the appropriate durable object
		let id: DurableObjectId = env.BOOG_CHAT.idFromName(new URL(request.url).pathname);

		const boogchat = env.BOOG_CHAT.get(id);
		return boogchat.fetch(request);
	},
} satisfies ExportedHandler<Env>;
