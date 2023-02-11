# 项目初始化

## 1. 初始化基本配置

## 1.1 创建 .gitignore 配置文件
```bash
cat > ./.gitignore << EOF
node_modules
bin
EOF
```

## 1.2 创建 .editorconfig 配置文件
```bash
cat > ./.editorconfig << EOF
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 4
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
EOF
```

### 1.3 初始化项目目结构
```bash
mkdir -p ./src

tree -a -C -L 3 -I ".git"
# .
# ├── .editorconfig
# ├── .gitignore
# ├── INITIAL.md
# ├── README.md
# └── src
```

## 2. 初始化工程配置

### 2.1 初始化 NPM
```bash
pnpm init
```

### 2.2 安装依赖
```bash
# isomorphic-fetch 用户修复 chatgpt 报错提示 `Error: Invalid environment: global fetch not defined`
pnpm add chatgpt@4.2.0 isomorphic-fetch@3.0.0 await-to-js@3.0.0 \
&& pnpm add cli-color@2.0.3 cross-port-killer@1.4.0 \
&& pnpm add koa@2.14.1 koa-bodyparser@4.3.0 koa2-cors@2.0.6 koa-router@12.0.0 \
&& pnpm add -D concurrently@7.6.0 rimraf@4.1.2 \
&& pnpm add -D @swc/core@1.3.35 @swc/cli@0.1.61 \
&& pnpm add -D @types/node@18.13.0 @types/cli-color@2.0.2 \
&& pnpm add -D @types/koa@2.13.5 @types/koa-bodyparser@4.3.10 @types/koa2-cors@2.0.2 @types/koa-router@7.4.4 \
&& pnpm add -D chokidar@3.5.3 chokidar-cli@3.0.0
```

## 2.3 创建 .swcrc 配置文件
```bash
cat > ./.swcrc << EOF
{
    "\$schema": "https://json.schemastore.org/swcrc",
    "module": {
        "type": "commonjs",
        "strict": false,
        "strictMode": true,
        "lazy": false,
        "noInterop": false,
        "ignoreDynamic": true
    },
    "jsc": {
        "parser": {
            "syntax": "typescript",
            "tsx": false,
            "decorators": false,
            "dynamicImport": false
        },
        "baseUrl": "./src",
        "paths": {
            "@*": ["./*"]
        }
    }
}
EOF
```

## 2.4 创建 tsconfig.json 配置文件
```bash
cat > ./tsconfig.json << EOF
{
    "compilerOptions": {
        "target": "es5",
        "module": "commonjs",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "types": ["node"],
        "forceConsistentCasingInFileNames": true,
        "baseUrl": "./src",
        "paths": {
            "@*": ["./*"]
        }
    },
    "exclude": ["./node_modules"],
    "include": [
        "./src/**/*.ts",
        "./src/**/*.d.ts"
    ]
}
EOF
```

## 2.5. 创建 index.ts 文件
```bash
cat > ./src/index.ts << EOF
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
const SERVER_URL = \`\${PROTOCOL}://localhost:\${SERVER_PORT}\`;
const USAGE_EXAMPLE = \`\${SERVER_URL}/chat?q=xxx\`;
const OPENAI_SECRET_KEY = process.env.SECRET || "";

const SECRET_KEY_ERROR = "Please set SECRET in environment! Example: SECRET=xxx pnpm dev or SECRET=xxx pnpm bootstrap";
if (!OPENAI_SECRET_KEY) throw new Error(color.red(SECRET_KEY_ERROR));

const createResponse = (title?: string, tips?: string, content?: string) => {
    const htmls: string[] = [];
    if (title) htmls.push(\`<h1>\${title}</h1>\`);
    if (tips) htmls.push(\`<h2>\${tips}</h2>\`);
    if (content) htmls.push(\`<p>\${content}</p>\`);
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
        ctx.body = createResponse(\`You: \${question}\`, \`ChatGPT: \${result.text}\`);
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
    const message = \`Server is running in \${SERVER_URL}.\`;
    console.log(color.green(message));
});
EOF
```


## 2.6. 在 package.json 添加 `dev` 脚本命令
```bash
node -e '
    const fs = require("fs");
    const pkg = require("./package.json");
    pkg.scripts = Object.assign({}, pkg.scripts);
    pkg.scripts["dev"] = "npm run watch";
    pkg.scripts["watch"] = "npx concurrently --names \"Watcher,Watcher\" -c \"green,green\" \"npm run watch:src\" \"npm run watch:bin\"";
    pkg.scripts["watch:src"] = "npx rimraf ./bin && npx swc ./src -d ./bin --copy-files -w --log-watch-compilation";
    pkg.scripts["watch:bin"] = "npx chokidar \"./bin/**/*.js\" -c \"node ./bin/index.js\"";
    pkg.scripts["build"] = "npx rimraf ./bin && npx swc ./src -d ./bin --copy-files";
    pkg.scripts["bootstrap"] = "npm run build && node ./bin/index.js";
    fs.writeFileSync("./package.json", JSON.stringify(pkg, null, 4));
'
```
