# Deployment (Ubuntu 24.04 LTS)

This guide targets running the `apps/somni` personal agent on Ubuntu 24.04 LTS.

## Hardware Guidance

Minimum (development/testing):
- 4 CPU cores
- 16 GB RAM
- 20 GB free disk

Recommended (daily personal use):
- 8+ CPU cores
- 32 GB RAM
- NVMe SSD

Note:
- Current default kernel path uses fixture-backed responses.
- Real model-backed kernel execution is planned, and will increase RAM/CPU requirements.

## OS Packages

```bash
sudo apt update
sudo apt install -y git curl build-essential python3 python3-venv sqlite3
```

Install Node.js 22 and pnpm (example):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
corepack enable
corepack prepare pnpm@10.8.1 --activate
```

Install `uv`:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Clone and Setup

```bash
git clone <your-fork-or-repo-url> somnicortex
cd somnicortex
bash apps/somni/setup.sh
```

This installs JS deps, builds runtime packages, generates Python IPC bindings, and creates `apps/somni/.agent`.

## Ollama Installation (Optional Today)

Install:

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
```

Verify:

```bash
ollama list
```

Notes:
- `apps/somni/setup.sh` pulls `mxbai-embed-large` if `ollama` is present.
- The current default kernel workflow in this repo is fixture-first; full model-backed kernel behavior is planned.

## Run as a systemd Service

Create service file:

```bash
sudo tee /etc/systemd/system/somni-runtime.service >/dev/null <<'EOF'
[Unit]
Description=SomniCortex Personal Runtime
After=network.target

[Service]
Type=simple
User=%i
WorkingDirectory=/home/%i/somnicortex
ExecStart=/usr/bin/node /home/%i/somnicortex/packages/runtime-ts/dist/src/cli/start-runtime.js --agent-dir /home/%i/somnicortex/apps/somni/.agent
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
```

Enable for user `ubuntu` (example):

```bash
cd /home/ubuntu/somnicortex
pnpm --filter @somnicortex/runtime build
sudo systemctl daemon-reload
sudo systemctl enable --now somni-runtime@ubuntu
sudo systemctl status somni-runtime@ubuntu
```

Operational checks:

```bash
cd /home/ubuntu/somnicortex
make status
tail -f apps/somni/.agent/runtime/runtime.log
```

## Intel N100 / E2 Mini PC Notes

Practical guidance for low-power mini PCs:
- keep one runtime instance per machine
- prefer SSD over SD cards for agent directory durability
- monitor thermal throttling during long test loops
- if memory is constrained, stop other background model servers
- keep swap enabled to avoid OOM kills, but expect slower throughput under pressure

For this repo's current fixture-default kernel mode, N100-class hardware is adequate for manual testing and personal experimentation.

## Manual Health Test

```bash
make create-agent
make start
npx tsx packages/runtime-ts/src/cli/send-task.ts --agent-dir apps/somni/.agent --task "health check" --urgency normal
make status
```

If task accepts and `audit/reports/cycle.log` updates, deployment is functional.
