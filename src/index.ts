import Koa from "koa";
import Router from "koa-router";
import cors from "koa2-cors";
import body from "koa-bodyparser";
import color from "cli-color";
import kill from "cross-port-killer";
import to from "await-to-js";
import "isomorphic-fetch";

const PROTOCOL = "http";
const SERVER_PORT = 8473;
const SERVER_URL = `${PROTOCOL}://localhost:${SERVER_PORT}`;
const USAGE_EXAMPLE = `${SERVER_URL}/chat?q=xxx`;
const OPENAI_SECRET_KEY = process.env.SECRET || "";

const SECRET_KEY_ERROR = "Please set SECRET in environment! Example: SECRET=xxx pnpm dev or SECRET=xxx pnpm bootstrap";
if (!OPENAI_SECRET_KEY) throw new Error(color.red(SECRET_KEY_ERROR));

const createResponse = (title?: string, tips?: string, content?: string) => {
    const htmls: string[] = [];
    if (title) htmls.push(`<h1>${title}</h1>`);
    if (tips) htmls.push(`<h2>${tips}</h2>`);
    if (content) htmls.push(`<p>${content}</p>`);
    const result = htmls.join("");
    return result;
};

const useRootRoute = async (router: Router) => {
    return router.get("/", async (ctx: Koa.ParameterizedContext) => {
        ctx.body = createResponse("Hello ChatGPT!", "Usage:", USAGE_EXAMPLE);
    });
};

const useChatRoute = async (router: Router) => {
    // chatgpt 作为 ES Module 只能通过 import() 动态导入
    const { ChatGPTAPI } = await import("chatgpt");
    const api = new ChatGPTAPI({ apiKey: OPENAI_SECRET_KEY });
    return router.get("/chat", async (ctx: Koa.ParameterizedContext) => {
        const question = ctx.query.q as string;
        if (!ctx.query.q) return ctx.body = createResponse("Please input you question.", "Example:", USAGE_EXAMPLE);
        const [error, result] = await to(api.sendMessage(question));
        if (error) return ctx.body = createResponse("ChatGPT Error:", error.message);
        ctx.body = createResponse(`You: ${question}`, `ChatGPT: ${result.text}`);
    });
};

// kill 两次保证 kill 成功
kill(SERVER_PORT).then(async () => {
    await kill(SERVER_PORT);

    const app = new Koa();
    const router = new Router();
    useRootRoute(router);
    useChatRoute(router);

    app.use(cors());
    app.use(body());
    app.use(router.routes());

    app.listen(SERVER_PORT);
    const message = `Server is running in ${SERVER_URL}.`;
    console.log(color.green(message));
});
