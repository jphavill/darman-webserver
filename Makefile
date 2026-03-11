.PHONY: up down logs rebuild rebuild-backend rebuild-frontend

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
