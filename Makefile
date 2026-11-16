.PHONY: help back-run front-install front-dev front-build migrate-build install

help:
	@echo "bollitas: back-run | front-install | front-dev | front-build | migrate-build | install"

back-run:
	cd back && uvicorn main:app --host 0.0.0.0 --port 8000 --reload

front-install:
	cd front && pnpm install

front-dev:
	cd front && pnpm install && pnpm run dev

front-build:
	cd front && pnpm install && pnpm run build

migrate-build: front-build
	python migrate_view.py

install:
	cd back && pip install -r requirements.txt
	cd front && pnpm install
