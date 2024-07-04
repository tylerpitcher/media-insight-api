# media-insight-service
An API for generating vector embeddings and image descriptions.

## How to Run
1. Create a .env file in root directory
```
PORT=
MODEL_NAME=
JWT_AUDIENCE=
JWKS_ENDPOINT=
```

2. Pull docker images
```
docker pull node:latest
docker pull ollama/ollama
```

3. Build
```
docker-compose build
```

4. Run
```
docker-compose up
```