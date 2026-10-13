import {createServer, IncomingMessage} from "http";
import {readFileSync} from "fs";
import path from "path";
import {Projects} from "./projects";
import {suggestProject} from "./discovery";

async function body(request: IncomingMessage): Promise<any> {
    const parts: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > 1024 * 1024) throw new Error("Request is too large.");
        parts.push(chunk);
    }
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
}

export async function startWebServer(options: {dataDir: string; port?: number}) {
    const projects = new Projects(path.resolve(options.dataDir));
    let origin = "";
    const server = createServer(async (request, response) => {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        try {
            if (request.headers.host !== new URL(origin).host || (request.headers.origin && request.headers.origin !== origin))
                throw new Error("Only same-origin local requests are accepted.");
            const url = new URL(request.url || "/", origin), method = request.method;
            const send = (value: unknown) => {response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(value));};
            if (method === "GET" && url.pathname === "/api/projects") {send(projects.list()); return;}
            if (method === "POST" && url.pathname === "/api/projects") {send(projects.save(await body(request))); return;}
            if (method === "POST" && url.pathname === "/api/suggest") {send(suggestProject((await body(request)).root)); return;}
            const route = url.pathname.match(/^\/api\/projects\/([\w-]+)(?:\/(analyze|display|results)(?:\/([\w-]+)(?:\/(view|html))?)?)?$/);
            if (route) {
                const [, id, action, resultId, format] = route;
                if (method === "POST" && action === "analyze") {send(projects.analyze(id)); return;}
                if (method === "POST" && action === "display") {send(projects.display(id, (await body(request)).resultId)); return;}
                if (method === "GET" && !action) {send(projects.get(id)); return;}
                if (method === "GET" && action === "results" && resultId) {
                    if (format) {
                        response.setHeader("Content-Type", "text/html; charset=utf-8");
                        let html = projects.html(id, resultId);
                        if (format === "view") html = html.replace("</html>", '<link rel="stylesheet" href="/map.css"><script src="/map.js"></script><script src="/insights.js"></script><script src="/evidence.js"></script></html>');
                        response.end(html);
                    } else send(projects.model(id, resultId));
                    return;
                }
            }
            const assets: Record<string, [string, string]> = {"/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/style.css": ["style.css", "text/css"],
                "/map.js": ["map.js", "text/javascript"], "/map.css": ["map.css", "text/css"], "/insights.js": ["insights.js", "text/javascript"], "/evidence.js": ["evidence.js", "text/javascript"]};
            const asset = assets[url.pathname];
            if (method === "GET" && asset) {
                response.setHeader("Content-Type", asset[1] + "; charset=utf-8");
                response.end(readFileSync(path.resolve(__dirname, "../../resources/web", asset[0]))); return;
            }
            response.statusCode = 404; send({error: "Not found."});
        } catch (error) {
            response.statusCode = 400;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({error: error instanceof Error ? error.message : String(error)}));
        }
    });
    await new Promise<void>((resolve, reject) => {server.once("error", reject); server.listen(options.port ?? 0, "127.0.0.1", resolve);});
    origin = `http://127.0.0.1:${(server.address() as {port: number}).port}`;
    return {url: origin, async close() {await projects.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));}};
}
