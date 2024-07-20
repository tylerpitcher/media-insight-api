const { SendMessageCommand } = require('@aws-sdk/client-sqs');
const { Mutex } = require('async-mutex');

const { rabbitMQConnection, embedder, describer, sqs } = require('./connections');

// Create a new mutex instance to manage concurrency
const mutex = new Mutex();

/**
 * @desc Extracts attributes, processes the image and filename, and sends data to SQS
 * @param {object} msg - The message received from the RabbitMQ queue.
 * @param {object} channel - The RabbitMQ channel.
 * @returns {Promise<void>} A promise that resolves when the message is handled and acknowledged.
*/
async function handleMsg(msg, channel) {
  // Get msg contents
  const { id, filename, image } = JSON.parse(msg.content.toString());

  // Acquire mutex lock
  const release = await mutex.acquire();

  // Generate a description for the image
  const description = (await describer.invoke('caption', { images: [image] }))
    .replace(/\"/g, '"')
    .replace(/\n/g,' ');
  
  // Embed the filename and description
  const [nameVector, descVector] = await Promise.all([
    embedder.embedQuery(filename),
    embedder.embedQuery(description)
  ]);

  // Create a new SendMessageCommand to send the processed message to the completed queue
  const command = new SendMessageCommand({
    QueueUrl: process.env.SQS_ENDPOINT,
    MessageGroupId: 'default',
    MessageBody: id,
    MessageAttributes: {
      description: {
        DataType: 'String',
        StringValue: description,
      },
      nameVector: {
        DataType: 'String',
        StringValue: JSON.stringify(nameVector),
      },
      descVector: {
        DataType: 'String',
        StringValue: JSON.stringify(descVector),
      },
    },
  });

  // Send the message to the completed queue
  const response = await sqs.send(command);

  // Stop if the message was unsuccessfully
  if (response?.$metadata?.httpStatusCode != 200) return release();

  // Delete processed message from the pending queue
  channel.ack(msg);

  // Release the mutex lock after processing the image
  release();
}

/**
 * @desc Opens a connection to the RabbitMQ and subscribes to the images queue
 * @returns {Promise<void>} A promise that resolves when the message consumption setup is complete.
*/
async function consumeMsgs() {
  // Open connection to rabbit queue
  const { channel } = await rabbitMQConnection();

  // Subscribe to messages from images channel
  channel.consume('images', (msg) => handleMsg(msg, channel));
}

module.exports = consumeMsgs;
