const requiredNode = "v24.18.0";
const requiredNpm = "11.18.0";
const npmVersion = process.env.npm_config_user_agent?.match(/^npm\/([^ ]+)/)?.[1] ?? null;

if (process.version !== requiredNode) {
  console.error(`Node ${requiredNode.slice(1)} required. Current runtime: ${process.version}`);
  process.exit(1);
}

if (npmVersion && npmVersion !== requiredNpm) {
  console.error(`npm ${requiredNpm} required. Current runtime: ${npmVersion}`);
  process.exit(1);
}

console.log(`Release runtime OK: Node ${process.version}${npmVersion ? ` · npm ${npmVersion}` : ""}`);
