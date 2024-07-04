FROM ollama/ollama

ARG MODEL_NAME

RUN ollama serve & sleep 2 && ollama pull $MODEL_NAME

EXPOSE 11434

ENTRYPOINT ["ollama", "serve"]
