import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, execFileSync } from "node:child_process";

// A temporary trusted CA keeps TLS verification enabled for the isolated RPC fixture.
const directory = mkdtempSync(join(tmpdir(), "chog-browser-rpc-"));
const cert = join(directory, "cert.pem");
const key = join(directory, "key.pem");
try {
  const signer = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const signingKey = join(directory, "fixture-jwt.pem");
  const verificationKey = signer.publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  writeFileSync(
    signingKey,
    signer.privateKey.export({ type: "pkcs8", format: "pem" }),
    { mode: 0o600 },
  );
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      "1",
      "-subj",
      "/CN=127.0.0.1",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
    ],
    { stdio: "ignore" },
  );
  const child = spawn(
    process.execPath,
    [
      resolve("node_modules/@playwright/test/cli.js"),
      "test",
      ...process.argv.slice(2),
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_EXTRA_CA_CERTS: cert,
        CHOG_E2E_RPC_CERT: cert,
        CHOG_E2E_RPC_KEY: key,
        CHOG_E2E_JWT_KEY: signingKey,
        CHOG_E2E_APP_ID: "chog-character-fixture",
        CHOG_E2E_JWT_PUBLIC: verificationKey,
        CHOG_E2E_DB_PATH: join(directory, "browser.sqlite"),
      },
    },
  );
  const code = await new Promise((resolveExit) =>
    child.on("exit", resolveExit),
  );
  process.exitCode = code ?? 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
