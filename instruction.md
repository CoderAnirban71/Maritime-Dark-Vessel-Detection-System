# Samudra Netra — Run commands

Run these sections in order after starting the computer.

## 1. Start PostgreSQL

```bash
sudo systemctl start docker
docker start samudra-pg
pg_isready -h 127.0.0.1 -p 5432 -U samudra
```

Continue when the final command reports `accepting connections`.

## 2. Start the backend — Terminal 1

```bash
cd "/run/media/tejas/CODE DRIVE/SIH_FINAL_2/backend/layer_2_new"
source "/home/tejas/.venvs/sih-layer2/bin/activate"
python -m uvicorn query_api:app --host 0.0.0.0 --port 8000
```

Leave this terminal open. The API runs at <http://localhost:8000>.

## 3. Start the frontend — Terminal 2

```bash
mkdir -p "/home/tejas/.local/share/samudra-netra/frontend-runtime"
rsync -a --delete --exclude node_modules "/run/media/tejas/CODE DRIVE/SIH_FINAL_2/frontend/" "/home/tejas/.local/share/samudra-netra/frontend-runtime/"
cd "/home/tejas/.local/share/samudra-netra/frontend-runtime"
npm install
VITE_DATA_SOURCE=demo VITE_DEMO_API_URL=http://127.0.0.1:8000 npm run dev -- --host 0.0.0.0
```

Leave this terminal open, then open <http://localhost:5173>.

## Stop

Press `Ctrl+C` in the frontend and backend terminals. Optionally stop PostgreSQL:

```bash
docker stop samudra-pg
```
