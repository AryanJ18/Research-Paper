FROM node:20 AS frontend-build

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM python:3.11
WORKDIR /app
COPY backend/requirement.txt .
RUN pip install -r requirement.txt
COPY backend/ ./backend/
COPY artifacts/ ./artifacts/
COPY --from=frontend-build /frontend/dist ./static

EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]