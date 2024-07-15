const { ReceiveMessageCommand, SendMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { Mutex } = require('async-mutex');

const { embedder, describer, sqs } = require('./connections');

// Create a new mutex instance to manage concurrency
const mutex = new Mutex();

/**
 * @desc Extracts attributes, processes image and filename, sends results to another queue, and deletes the message.
 * @param {object} msg - The SQS message to handle
 * @param {object} msg.MessageAttributes - The message attributes
 * @param {string} msg.MessageAttributes.filename.StringValue - The filename of the image
 * @param {string} msg.MessageAttributes.image.StringValue - The base64 encoded image
 * @param {string} msg.Body - The body of the message
 * @param {string} msg.ReceiptHandle - The receipt handle for the message
 * @returns {Promise<void>} A promise that resolves when the message is handled
 */
async function handleMsg(msg) {
  // Extract the filename, image, and body from the message attributes
  const filename = msg.MessageAttributes.filename.StringValue;
  const image = msg.MessageAttributes.image.StringValue;
  const body = msg.Body;
  
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
    QueueUrl: process.env.C_SQS_ENDPOINT,
    MessageGroupId: 'default',
    MessageBody: body,
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
  if (response?.$metadata?.httpStatusCode != 200) return;

  // Delete processed message from the pending queue
  await sqs.send(new DeleteMessageCommand({
    QueueUrl: process.env.P_SQS_ENDPOINT,
    ReceiptHandle: msg.ReceiptHandle,
  }));
}

/**
 * @desc Poll for messages from the pending SQS queue and handle them.
 * @returns {Promise<void>} A promise that resolves when the polling is done
 */
async function pollMsgs() {
  // Stop if previous execution is still running
  if (mutex.isLocked()) return;
  
  // Acquire mutex lock
  const release = await mutex.acquire();

  // Create a new ReceiveMessageCommand to poll for messages from the pending queue
  const command = new ReceiveMessageCommand({
    QueueUrl: process.env.P_SQS_ENDPOINT,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20,
    MessageAttributeNames: ['All'],
    VisibilityTimeout: 600,
  });

  // Send the receive message command and collect messages
  const response = await sqs.send(command);
  const msgs = response.Messages;
  
  // Process each received message using the handleMsg function
  for (const msg of msgs) {
    await handleMsg(msg);
  }

  // Release the mutex lock after processing the messages
  release();
}

module.exports = pollMsgs;
