.PHONY: help up down logs rebuild migrate test deploy cache-prune _sync-backend-deps _sync-backend-image _test-backend _test-frontend

COMPOSE_FILE ?= docker-compose.local.yml
DOCKER_COMPOSE := docker compose -f $(COMPOSE_FILE)

SERVICE ?= all
BACKEND_MODE ?= container
FRONTEND_MODE ?= local

NPM_CACHE_DIR ?= .cache/npm
FRONTEND_DEPS_CACHE_ROOT ?= .cache/frontend-node_modules
NPM_CACHE_TTL_DAYS ?= 21
FRONTEND_TEST_CACHE_TTL_DAYS ?= 21
FRONTEND_NODE_IMAGE ?= node:22-alpine
FRONTEND_CACHE_KEY ?=

export DOCKER_BUILDKIT ?= 1
export COMPOSE_DOCKER_CLI_BUILD ?= 1

help:
	@printf 'Common targets:\n'
	@printf '  make up                           # start local stack\n'
	@printf '  make down                         # stop local stack\n'
	@printf '  make logs                         # follow logs\n'
	@printf '  make rebuild [SERVICE=all|backend|frontend]\n'
	@printf '  make migrate                      # run alembic in backend container\n'
	@printf '  make test [SERVICE=all|backend|frontend]\n'
	@printf '            [BACKEND_MODE=container|host]\n'
	@printf '            [FRONTEND_MODE=local|cached]\n'
	@printf '  make cache-prune                  # prune frontend test caches\n'
	@printf '  make deploy                       # production deploy helper script\n'

up:
	$(DOCKER_COMPOSE) up -d

down:
	$(DOCKER_COMPOSE) down

logs:
	$(DOCKER_COMPOSE) logs -f

rebuild:
	@case "$(SERVICE)" in \
		all) \
			$(MAKE) cache-prune; \
			$(DOCKER_COMPOSE) up -d --build; \
			;; \
		backend) \
			$(DOCKER_COMPOSE) up -d --build backend; \
			;; \
		frontend) \
			$(MAKE) cache-prune; \
			$(DOCKER_COMPOSE) up -d --build frontend; \
			;; \
		*) \
			echo "Invalid SERVICE='$(SERVICE)'. Use all, backend, or frontend."; \
			exit 1; \
			;; \
	esac

cache-prune:
	NPM_CACHE_DIR="$(NPM_CACHE_DIR)" \
	FRONTEND_DEPS_CACHE_ROOT="$(FRONTEND_DEPS_CACHE_ROOT)" \
	NPM_CACHE_TTL_DAYS="$(NPM_CACHE_TTL_DAYS)" \
	FRONTEND_TEST_CACHE_TTL_DAYS="$(FRONTEND_TEST_CACHE_TTL_DAYS)" \
	bash scripts/prune-frontend-test-cache.sh

migrate:
	$(DOCKER_COMPOSE) exec backend alembic -c alembic.ini upgrade head

_sync-backend-deps:
	@test -f .venv/bin/activate || (echo "Missing .venv. Create it at repo root first." && exit 1)
	@req_hash="$$(shasum -a 256 backend/requirements.txt | cut -d ' ' -f 1)"; \
	stored_hash="$$(cat .venv/.backend_requirements.sha256 2>/dev/null || true)"; \
	if [ "$$req_hash" != "$$stored_hash" ]; then \
		echo "Syncing backend dependencies (.venv)..."; \
		. .venv/bin/activate && python -m pip install -r backend/requirements.txt; \
		printf '%s\n' "$$req_hash" > .venv/.backend_requirements.sha256; \
	else \
		echo "Backend dependencies unchanged; skipping pip install."; \
	fi

_sync-backend-image:
	@req_hash="$$(shasum -a 256 backend/requirements.txt | cut -d ' ' -f 1)"; \
	stored_hash="$$(cat .backend_image_requirements.sha256 2>/dev/null || true)"; \
	image_id="$$( $(DOCKER_COMPOSE) images -q backend 2>/dev/null || true)"; \
	if [ "$$req_hash" != "$$stored_hash" ] || [ -z "$$image_id" ]; then \
		echo "Building backend image (requirements changed or image missing)..."; \
		$(DOCKER_COMPOSE) build backend; \
		printf '%s\n' "$$req_hash" > .backend_image_requirements.sha256; \
	else \
		echo "Backend image dependencies unchanged; skipping backend rebuild."; \
	fi

_test-backend:
	@case "$(BACKEND_MODE)" in \
		host) \
			$(MAKE) _sync-backend-deps; \
			$(DOCKER_COMPOSE) up -d postgres; \
			. .venv/bin/activate && cd backend && pytest $(PYTEST_ARGS); \
			;; \
		container) \
			$(MAKE) _sync-backend-image; \
			$(DOCKER_COMPOSE) up -d postgres; \
			$(DOCKER_COMPOSE) run --rm -e TEST_BOOTSTRAP_POSTGRES=0 -e TEST_POSTGRES_HOST=postgres backend pytest $(PYTEST_ARGS); \
			;; \
		*) \
			echo "Invalid BACKEND_MODE='$(BACKEND_MODE)'. Use container or host."; \
			exit 1; \
			;; \
	esac

_test-frontend:
	@case "$(FRONTEND_MODE)" in \
		local) \
			cd frontend && npm test; \
			;; \
		cached) \
			$(MAKE) cache-prune; \
			NPM_CACHE_DIR="$(NPM_CACHE_DIR)" \
			FRONTEND_DEPS_CACHE_ROOT="$(FRONTEND_DEPS_CACHE_ROOT)" \
			FRONTEND_NODE_IMAGE="$(FRONTEND_NODE_IMAGE)" \
			FRONTEND_CACHE_KEY="$(FRONTEND_CACHE_KEY)" \
			bash scripts/run-frontend-tests-cached.sh; \
			;; \
		*) \
			echo "Invalid FRONTEND_MODE='$(FRONTEND_MODE)'. Use local or cached."; \
			exit 1; \
			;; \
	esac

test:
	@case "$(SERVICE)" in \
		all) \
			$(MAKE) _test-backend BACKEND_MODE=$(BACKEND_MODE); \
			$(MAKE) _test-frontend FRONTEND_MODE=$(FRONTEND_MODE); \
			;; \
		backend) \
			$(MAKE) _test-backend BACKEND_MODE=$(BACKEND_MODE); \
			;; \
		frontend) \
			$(MAKE) _test-frontend FRONTEND_MODE=$(FRONTEND_MODE); \
			;; \
		*) \
			echo "Invalid SERVICE='$(SERVICE)'. Use all, backend, or frontend."; \
			exit 1; \
			;; \
	esac

deploy:
	bash scripts/deploy-prod.sh
