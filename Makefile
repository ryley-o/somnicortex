.PHONY: setup run create-agent start stop status propose-identity

setup:
	bash apps/somni/setup.sh

create-agent:
	node apps/somni/scripts/create-default-agent.mjs

start:
	@mkdir -p "apps/somni/.agent/runtime"
	@pnpm --filter @somnicortex/runtime build >/dev/null
	@if [ -f "apps/somni/.agent/runtime/runtime.pid" ] && kill -0 "$$(cat apps/somni/.agent/runtime/runtime.pid)" 2>/dev/null; then \
		echo "Runtime already running (pid $$(cat apps/somni/.agent/runtime/runtime.pid))"; \
	else \
		nohup node packages/runtime-ts/dist/src/cli/start-runtime.js --agent-dir apps/somni/.agent > "apps/somni/.agent/runtime/runtime.log" 2>&1 & echo $$! > "apps/somni/.agent/runtime/runtime.pid"; \
		sleep 1; \
		echo "Started runtime (pid $$(cat apps/somni/.agent/runtime/runtime.pid)). Logs: apps/somni/.agent/runtime/runtime.log"; \
	fi

stop:
	@if [ -f "apps/somni/.agent/runtime/runtime.pid" ] && kill -0 "$$(cat apps/somni/.agent/runtime/runtime.pid)" 2>/dev/null; then \
		kill "$$(cat apps/somni/.agent/runtime/runtime.pid)"; \
		rm -f "apps/somni/.agent/runtime/runtime.pid"; \
		echo "Stopped runtime."; \
	else \
		rm -f "apps/somni/.agent/runtime/runtime.pid"; \
		echo "Runtime is not running."; \
	fi

status:
	@if [ -f "apps/somni/.agent/runtime/runtime.pid" ] && kill -0 "$$(cat apps/somni/.agent/runtime/runtime.pid)" 2>/dev/null; then \
		echo "Runtime is running (pid $$(cat apps/somni/.agent/runtime/runtime.pid))"; \
	else \
		echo "Runtime is not running."; \
	fi
	@if [ -f "apps/somni/.agent/agent.yaml" ]; then \
		echo "Agent sleep_state: $$(awk '/^sleep_state:/ {print $$2}' apps/somni/.agent/agent.yaml)"; \
	fi

propose-identity:
	@if [ -z "$(SCOPE)" ]; then echo "Missing SCOPE=personality|identity_metadata"; exit 1; fi
	@if [ -z "$(CHANGE)" ]; then echo "Missing CHANGE='{\"communication_style\":\"verbose\"}'"; exit 1; fi
	npx tsx packages/runtime-ts/src/cli/identity-change.ts --agent-dir apps/somni/.agent --scope "$(SCOPE)" --change '$(CHANGE)'

run:
	pnpm --filter somni-app run run:mcp
