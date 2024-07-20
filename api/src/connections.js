const { OllamaEmbeddings } = require('@langchain/community/embeddings/ollama');
const { Ollama } = require('@langchain/community/llms/ollama');
const { SQSClient } = require('@aws-sdk/client-sqs');
const { connect } = require('amqplib');

/**
 * @desc Establishes a connection to RabbitMQ and sets up a channel.
 * @returns {Promise<Object>} An object containing the RabbitMQ connection and channel.
 * @throws Will throw an error and retry the connection after 2 seconds if the initial connection fails.
*/
async function rabbitMQConnection() {
  try {
    // Attempt to establish a connection
    const rabbit = await connect(process.env.RABBIT_ENDPOINT);

    // Create a confirmation channel
    const channel = await rabbit.createConfirmChannel();
    
    // Create images queue if it does not exist
    await channel.assertQueue('images', { durable: false });

    return { rabbit, channel };
  } catch {
    console.error('Rabbit connection failed. Trying again after 5 seconds.');

    // Return a promise that resolves after a 2-second delay, retrying the connection
    return new Promise((resolve) => setTimeout(async () => {
      resolve(await rabbitMQConnection());
    }, 5_000));
  }
};


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
  rabbitMQConnection,
  embedder,
  describer,
  sqs,
};
