import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;
const original978 = process.env.FENCHAIN_RPC_URL;
const original521 = process.env.FENCHAIN_N521_RPC_URL;

const handler = (await import("../api/chain-progress.js")).default;

function responseRecorder() {
  const headers = new Map();
  return {
    headers,
    statusCode: null,
    body: null,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function callHandler({ method = "GET", url = "/api/chain-progress" } = {}) {
  const response = responseRecorder();
  await handler({ method, url }, response);
  return response;
}

function rpcResponse(result) {
  return {
    ok: true,
    async json() {
      return { result };
    },
  };
}

function head(number, timestamp = Math.floor(Date.now() / 1_000)) {
  return { number: `0x${number.toString(16)}`, timestamp: `0x${timestamp.toString(16)}` };
}

function assertSanitized(snapshot) {
  const forbidden = ["endpoint", "host", "envKey", "latencyMs", "probeId", "error", "blockTimestamp"];
  for (const chain of snapshot.chains) {
    for (const key of forbidden) {
      assert.ok(!Object.hasOwn(chain, key), `Public chain payload must not include ${key}.`);
    }
  }
}

try {
  process.env.FENCHAIN_RPC_URL = "https://chain-978.example.test";
  process.env.FENCHAIN_N521_RPC_URL = "https://chain-521.example.test";

  globalThis.fetch = async (endpoint, options) => {
    const method = JSON.parse(options.body).method;
    const chainId = new URL(endpoint).hostname.includes("978") ? 978 : 521;
    if (method === "eth_chainId") return rpcResponse(`0x${chainId.toString(16)}`);
    if (method === "eth_getBlockByNumber") return rpcResponse(head(chainId === 978 ? 100 : 200));
    throw new Error("Unexpected RPC method");
  };

  const healthy = await callHandler();
  assert.equal(healthy.statusCode, 200);
  assert.match(healthy.headers.get("cache-control"), /s-maxage=10/);
  assert.match(healthy.headers.get("cache-control"), /stale-while-revalidate=20/);
  assert.match(healthy.headers.get("cache-control"), /stale-if-error=60/);
  assert.equal(healthy.body.chains.length, 2);
  assert.ok(healthy.body.chains.every((chain) => chain.status === "live"));
  assertSanitized(healthy.body);

  let queryFetches = 0;
  globalThis.fetch = async () => {
    queryFetches += 1;
    throw new Error("Query request must not reach an upstream.");
  };
  const query = await callHandler({ url: "/api/chain-progress?cache-bust=1" });
  assert.equal(query.statusCode, 400);
  assert.equal(queryFetches, 0);

  globalThis.fetch = async () => {
    throw new Error("Upstream unavailable");
  };
  const unavailable = await callHandler();
  assert.equal(unavailable.statusCode, 503);
  assert.ok(unavailable.body.chains.every((chain) => chain.status === "unavailable"));
  assertSanitized(unavailable.body);

  globalThis.fetch = async (endpoint, options) => {
    const method = JSON.parse(options.body).method;
    const expectedChainId = new URL(endpoint).hostname.includes("978") ? 978 : 521;
    if (method === "eth_chainId") return rpcResponse("0x1");
    return rpcResponse(head(expectedChainId === 978 ? 300 : 400));
  };
  const mismatch = await callHandler();
  assert.equal(mismatch.statusCode, 200);
  assert.ok(mismatch.body.chains.every((chain) => chain.status === "wrong-chain"));

  console.log(
    JSON.stringify({
      status: "ok",
      scope: "chain-progress-public-feed",
      cases: 4,
      rpcEndpointExposed: false,
    })
  );
} finally {
  globalThis.fetch = originalFetch;
  if (original978 === undefined) delete process.env.FENCHAIN_RPC_URL;
  else process.env.FENCHAIN_RPC_URL = original978;
  if (original521 === undefined) delete process.env.FENCHAIN_N521_RPC_URL;
  else process.env.FENCHAIN_N521_RPC_URL = original521;
}
