import "dotenv/config";
import http from "node:http";
import { URL } from "node:url";
import { mkOauthClnt, xchgCode } from "./auth.js";

const PORT = 3000;

const srv = http.createServer(async (req, res) => {
  const url = new URL(req.url!, `http://localhost:${PORT}`);

  if (url.pathname === "/oauth/callback") {
    const code = url.searchParams.get("code");
    const err = url.searchParams.get("error");

    if (err) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`<h2>Auth failed: ${err}</h2><p>Close this tab.</p>`);
      console.log("Auth error: " + err);
      return;
    }

    if (!code) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end("<h2>No code in callback</h2><p>Close this tab.</p>");
      return;
    }

    try {
      const clnt = mkOauthClnt();
      await xchgCode(clnt, code);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h2>Auth successful!</h2><p>You can close this tab. Tokens saved.</p>");
      console.log("Auth complete. Tokens saved to data/tokens.json");
      setTimeout(() => process.exit(0), 1000);
    } catch (e: any) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`<h2>Token exchange failed</h2><pre>${e.message}</pre>`);
      console.log("Token exchange failed:", e.message);
    }
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

srv.listen(PORT, () => {
  console.log(`\nOAuth callback server running on http://localhost:${PORT}`);
  console.log("Waiting for Google redirect...\n");
});
