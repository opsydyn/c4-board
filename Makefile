SHELL := /bin/bash
BUN ?= bun
BUNX ?= bunx

.PHONY: help dev start build preview astro tauri tauri-dev knip test test-run test-watch test-ui test-coverage astro-upgrade bun-update

help:
	@echo "Available targets:"
	@echo "  make dev            # bun run dev"
	@echo "  make start          # bun run start"
	@echo "  make build          # bun run build"
	@echo "  make preview        # bun run preview"
	@echo "  make astro          # bun run astro"
	@echo "  make tauri          # bun run tauri"
	@echo "  make tauri-dev      # bun tauri dev"
	@echo "  make knip           # bun run knip"
	@echo "  make test           # bun run test"
	@echo "  make test-run       # bun run test:run"
	@echo "  make test-watch     # bun run test:watch"
	@echo "  make test-ui        # bun run test:ui"
	@echo "  make test-coverage  # bun run test:coverage"
	@echo "  make astro-upgrade  # bunx @astrojs/upgrade"
	@echo "  make bun-update     # bun update --interactive"

# Direct mappings to package.json scripts
# (multi-target rule; $@ is the requested target name)
dev start build preview astro tauri knip test:
	$(BUN) run $@

# Script names with colons get friendly aliases above
# while still invoking the original script names through Bun.
test-run:
	$(BUN) run test:run

test-watch:
	$(BUN) run test:watch

test-ui:
	$(BUN) run test:ui

test-coverage:
	$(BUN) run test:coverage

tauri-dev:
	$(BUN) tauri dev

# Maintenance helpers that are not in package.json scripts
astro-upgrade:
	$(BUNX) @astrojs/upgrade

bun-update:
	$(BUN) update --interactive
