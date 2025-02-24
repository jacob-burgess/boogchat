import { DurableObject } from 'cloudflare:workers';

export class BoogChat extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async sayHello(name: string): Promise<string> {
		return `Hello, ${name}!`;
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		let id: DurableObjectId = env.BOOG_CHAT.idFromName(new URL(request.url).pathname);
		let stub = env.BOOG_CHAT.get(id);
		let greeting = await stub.sayHello('world');

		return new Response(greeting);
	},
} satisfies ExportedHandler<Env>;
