import index from "./src/index.html";

const isProd = process.env.NODE_ENV === "production";

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  routes: {
    "/*": index,
  },
  development: !isProd && { hmr: true, console: true },
});

console.log(`bunact running at ${server.url}`);
