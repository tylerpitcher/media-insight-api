const { OllamaEmbeddings } = require('@langchain/community/embeddings/ollama');
const { Ollama } = require('@langchain/community/llms/ollama');
const jwkToPem = require('jwk-to-pem');
const jwt = require('jsonwebtoken');
const express = require('express');
const parser = require('body-parser');
const multer = require('multer');
const axios = require('axios');
require('dotenv').config();

const app = express();

const upload = multer({});

const params = {
  baseUrl: process.env.MODEL_ENDPOINT,
  model: process.env.MODEL_NAME,
};

const embedder = new OllamaEmbeddings(params);
const describer = new Ollama(params);

function getPublicKey(kid) {
  return axios.get(process.env.JWKS_ENDPOINT)
    .then((res) => {
      const keys = res.data.keys
      const key = keys.find((key) => key.kid === kid);
      return jwkToPem(key);
    }).catch(() => null);
}

async function isValidToken(token) {
  try {
    const kid = jwt.decode(token, { complete: true }).header.kid;
    const publicKey = await getPublicKey(kid);

    return Boolean(jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience: process.env.CLIENT_ID
    }).sub);
  } catch (err) {
    return false;
  }
}

async function authHandler(req, res, next) {
  const token = req?.headers?.authorization?.slice(7);
  const valid = await isValidToken(token);

  return valid ? next() : res.sendStatus(401);
}

app.use(parser.json());
app.use(authHandler);

app.post('/image', upload.single('file'), async (req, res) => {
  if (!req?.file?.buffer.length) return res.status(400).json({
    msg: 'Requires an image.'
  });

  if (req.file.mimetype != 'image/jpeg' && req.file.mimetype != 'image/png')
    return res.status(400).json({
      msg: 'Only jpeg & png files are supported.'
    });

  const data = req.file.buffer.toString('base64');

  const description = await describer.invoke('describe image', {
    images: [data]
  });

  const [nameVector, descVector] = await Promise.all([
    embedder.embedQuery(req.file.originalname),
    embedder.embedQuery(description)
  ]);

  return res.json({ nameVector, description, descVector });
});

app.post('/text', async (req, res) => {
  const text = req.body?.text;

  if (!text) return res.status(400).json({
    msg: 'Requires a text field in the body.'
  });

  const vector = await embedder.embedQuery(text);
  return res.json({ vector });
});

app.listen(8000, () => console.log('Listening.'));