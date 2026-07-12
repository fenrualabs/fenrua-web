const refreshMs = 15_000;

const chainTargets = [
  {
    id: "fenchain-978",
    title: "Chain 978",
    label: "FENc978",
    expectedChainId: 978,
    role: "FEN protocol support chain",
    rpcUrl: "https://rpc.fenchain.info",
    explorerUrl: "https://fenchain.info",
  },
  {
    id: "fenchain-n521",
    title: "Chain N521",
    label: "FENn521",
    expectedChainId: 521,
    role: "N / P-521 research chain",
    rpcUrl: "https://rpc.fenchain521.info",
    explorerUrl: "https://fenchain521.info",
  },
];

function hexToNumber(value) {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) return null;
  const parsed = Number.parseInt(value, 16);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function rpcCall(rpcUrl, method) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params: [] }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`RPC HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (payload.error) {
      throw new Error(payload.error.message || "RPC error");
    }

    return payload.result;
  } finally {
    clearTimeout(timeout);
  }
}

async function probeChain(chain) {
  const startedAt = Date.now();

  try {
    const [chainIdHex, blockNumberHex] = await Promise.all([
      rpcCall(chain.rpcUrl, "eth_chainId"),
      rpcCall(chain.rpcUrl, "eth_blockNumber"),
    ]);
    const chainId = hexToNumber(chainIdHex);
    const blockNumber = hexToNumber(blockNumberHex);
    const online = chainId === chain.expectedChainId && blockNumber !== null;

    return {
      id: chain.id,
      title: chain.title,
      label: chain.label,
      role: chain.role,
      expectedChainId: chain.expectedChainId,
      chainId,
      blockNumber,
      status: online ? "online" : "wrong-chain",
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      explorerUrl: chain.explorerUrl,
    };
  } catch {
    return {
      id: chain.id,
      title: chain.title,
      label: chain.label,
      role: chain.role,
      expectedChainId: chain.expectedChainId,
      chainId: null,
      blockNumber: null,
      status: "offline",
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      explorerUrl: chain.explorerUrl,
    };
  }
}

export default async function handler(request, response) {
  response.setHeader("cache-control", "no-store");

  if (request.method !== "GET") {
    response.setHeader("allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const chains = await Promise.all(chainTargets.map(probeChain));

  response.status(200).json({
    generatedAt: new Date().toISOString(),
    refreshMs,
    chains,
  });
}
