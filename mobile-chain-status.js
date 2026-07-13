(() => {
  if (!document.querySelector("[data-chain-card]")) return;
  if (document.querySelector('script[src="/kernel-status.js"]')) return;
  const script = document.createElement("script");
  script.src = "/kernel-status.js";
  script.async = false;
  document.head.append(script);
})();
