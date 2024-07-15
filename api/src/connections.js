const { OllamaEmbeddings } = require('@langchain/community/embeddings/ollama');
const { Ollama } = require('@langchain/community/llms/ollama');
const { SQSClient } = require('@aws-sdk/client-sqs');

// Define the parameters for initializing Ollama
const ollamaParams = {
  baseUrl: process.env.MODEL_ENDPOINT,
  model: process.env.MODEL_NAME,
};

// Create instances for OllamaEmbeddings and Ollama
const embedder = new OllamaEmbeddings(ollamaParams);
const describer = new Ollama(ollamaParams);

// Create SQS client based on environment variables
const sqs = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_KEY_ID,
    secretAccessKey: process.env.AWS_ACCESS_KEY,
  }
});

module.exports = {
  embedder,
  describer,
  sqs,
};
