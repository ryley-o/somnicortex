.PHONY: setup run create-agent

setup:
	bash apps/somni/setup.sh

create-agent:
	node apps/somni/scripts/create-default-agent.mjs

run:
	pnpm --filter somni-app run run:mcp
