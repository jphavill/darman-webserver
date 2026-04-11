.PHONY: up down logs rebuild rebuild-backend rebuild-frontend migrate sync-backend-deps sync-backend-image test-backend-host test-backend test-frontend test deploy

COMPOSE_FILE ?= docker-compose.local.yml

up:
	docker compose -f docker-compose.local.yml up -d

down:
	docker compose -f docker-compose.local.yml down

logs:
	docker compose -f docker-compose.local.yml logs -f

rebuild:
	docker compose -f docker-compose.local.yml up -d --build

rebuild-backend:
	docker compose -f docker-compose.local.yml up -d --build backend

rebuild-frontend:
	docker compose -f docker-compose.local.yml up -d --build frontend

migrate:
	docker compose -f docker-compose.local.yml exec backend alembic -c alembic.ini upgrade head

sync-backend-deps:
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

sync-backend-image:
	@req_hash="$$(shasum -a 256 backend/requirements.txt | cut -d ' ' -f 1)"; \
	stored_hash="$$(cat .backend_image_requirements.sha256 2>/dev/null || true)"; \
	image_id="$$(docker compose -f $(COMPOSE_FILE) images -q backend 2>/dev/null || true)"; \
	if [ "$$req_hash" != "$$stored_hash" ] || [ -z "$$image_id" ]; then \
		echo "Building backend image (requirements changed or image missing)..."; \
		docker compose -f $(COMPOSE_FILE) build backend; \
		printf '%s\n' "$$req_hash" > .backend_image_requirements.sha256; \
	else \
		echo "Backend image dependencies unchanged; skipping backend rebuild."; \
	fi

test-backend-host: sync-backend-deps
	docker compose -f $(COMPOSE_FILE) up -d postgres
	. .venv/bin/activate && cd backend && pytest $(PYTEST_ARGS)

test-backend: sync-backend-image
	docker compose -f $(COMPOSE_FILE) up -d postgres
	docker compose -f $(COMPOSE_FILE) run --rm -e TEST_BOOTSTRAP_POSTGRES=0 -e TEST_POSTGRES_HOST=postgres backend pytest $(PYTEST_ARGS)

test-frontend:
	cd frontend && npm test

test: test-backend test-frontend

deploy:
	bash scripts/deploy-prod.sh
