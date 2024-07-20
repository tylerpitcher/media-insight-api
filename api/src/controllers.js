const { rabbitMQConnection, embedder } = require('./connections');

/**
 * @desc Handles an image upload request.
 * @param {object} req - The HTTP request object.
 * @param {object} res - The HTTP response object.
 * @returns {object} The HTTP response with appropriate status code and message.
*/
async function handleImage(req, res) {
  // Check if the request contains a file buffer and an ID in the body
  if (!req?.file?.buffer.length || !req.body?.id) return res.status(400).json({
    msg: 'Requires an image.'
  });

  // Validate the file mimetype to be either JPEG or PNG
  if (req.file.mimetype != 'image/jpeg' && req.file.mimetype != 'image/png')
    return res.status(400).json({
      msg: 'Only jpeg & png files are supported.'
    });

  // Prepare the message attributes for SQS
  const attributes = {
    id: req.body.id,
    filename: req.file.originalname,
    image: req.file.buffer.toString('base64')
  };

  // Open connection to rabbit queue
  const { rabbit, channel } = await rabbitMQConnection();

  // Send image to be processed and await confirmation
  const success = channel.sendToQueue('images', Buffer.from(JSON.stringify(attributes)));
  await channel.waitForConfirms();
  await rabbit.close();

  // Return the status code from the SQS response or 500 if undefined
  return res.sendStatus(success ? 200 : 500);
}

/**
 * @desc Handles a text request by embedding the text.
 * @param {object} req - The HTTP request object.
 * @param {object} res - The HTTP response object.
 * @returns {object} The HTTP response with the embedded text vector.
*/
async function handleText(req, res) {
  // Retrieve the text from the request body
  const text = req.body?.text;

  // Check if the text field is present in the request body
  if (!text) return res.status(400).json({
    msg: 'Requires a text field in the body.'
  });

  // Embed the text using the embedder instance
  const vector = await embedder.embedQuery(text);

  // Return the embedded text vector
  return res.json(vector);
}

module.exports = {
  handleImage,
  handleText,
};
