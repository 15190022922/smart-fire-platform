const assert = require("node:assert/strict");

const AUTH_COOKIE_NAME = "smart-fire-auth";

const webBaseUrl = process.env.SMART_FIRE_WEB_BASE_URL || "http://127.0.0.1:3000";

function createSessionCookie(session) {
  const token = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${AUTH_COOKIE_NAME}=${token}`;
}

async function runCase(path, cookie) {
  const response = await fetch(`${webBaseUrl}${path}`, {
    headers: {
      Cookie: cookie,
    },
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes("<html"));
  assert.equal(html.includes("This page couldn’t load"), false);
  assert.equal(html.includes("A server error occurred"), false);
  console.log(`PASS page smoke ${path}`);
}

async function main() {
  const cookie = createSessionCookie({
    userId: "tenant-user-1",
    username: "hx_admin",
    displayName: "华星制造管理员",
    scope: "tenant",
    roleKey: "tenant_level_1",
    tenantId: "tenant-huaxing",
    tenantName: "华星制造",
    defaultView: "/",
  });

  const pages = ["/", "/alarm-center", "/devices", "/duty-center", "/inspection", "/notification-center", "/audit-log", "/system-health"];
  for (const path of pages) {
    await runCase(path, cookie);
  }

  console.log("PASS web smoke suite");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
