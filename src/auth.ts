import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const __filename = fileURLToPath(import.meta.url);
const TK_PATH = path.resolve("./data/tokens.json");

const cfg = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost",
  scopes: ["https://www.googleapis.com/auth/drive.file"],
  tokenPath: "./data/tokens.json",
  dbFolderName: "LeonardoDB",
  dbFileName: "artifacts.json",
};

export { cfg };

type Credentials = { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null; token_type?: string | null; scope?: string };

export function mkOauthClnt() {
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
}

export function authUrl(clnt: ReturnType<typeof mkOauthClnt>) {
  return clnt.generateAuthUrl({ access_type: "offline", scope: cfg.scopes, prompt: "consent" });
}

export async function xchgCode(clnt: ReturnType<typeof mkOauthClnt>, code: string) {
  const { tokens } = await clnt.getToken(code);
  clnt.setCredentials(tokens);
  saveTkn(tokens);
}

export function saveTkn(tkn: Credentials) {
  const dir = path.dirname(TK_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TK_PATH, JSON.stringify(tkn, null, 2));
}

export function loadTkn(): Credentials | null {
  if (!fs.existsSync(TK_PATH)) return null;
  return JSON.parse(fs.readFileSync(TK_PATH, "utf-8"));
}

export function hasTkn() {
  return fs.existsSync(TK_PATH);
}

export async function getAuthClnt() {
  const clnt = mkOauthClnt();
  const tkn = loadTkn();
  if (!tkn) throw new Error("No stored tokens. Run `npm run auth` first.");
  clnt.setCredentials(tkn);
  if (tkn.expiry_date && tkn.expiry_date < Date.now()) {
    const { credentials } = await clnt.refreshAccessToken();
    clnt.setCredentials(credentials);
    saveTkn(credentials as Credentials);
  }
  return clnt;
}

// CLI: run directly to go through OAuth flow
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const clnt = mkOauthClnt();
  const url = authUrl(clnt);

  console.log("\nOpen this URL in your browser to authorize:\n");
  console.log(url);
  console.log("\nPaste the code from the URL here:\n");

  process.stdin.setEncoding("utf-8");
  process.stdin.once("data", async (data) => {
    const code = (data as string).trim();
    try {
      await xchgCode(clnt, code);
      console.log("\nTokens saved.");
      console.log("File: " + TK_PATH);

      const drive = google.drive({ version: "v3", auth: clnt });
      const res = await drive.files.list({ pageSize: 5, fields: "files(id,name)" });
      console.log("\nYour Drive files (first 5):");
      res.data.files?.forEach((f) => console.log("  " + f.name + " (" + f.id + ")"));
    } catch (err) {
      console.error("\nAuth failed:", err);
    }
    process.exit(0);
  });
}
