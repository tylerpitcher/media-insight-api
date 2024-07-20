const jwkToPem = require('jwk-to-pem');
const jwt = require('jsonwebtoken');
const express = require('express');
const parser = require('body-parser');
const multer = require('multer');
const axios = require('axios');

const { handleImage, handleText } = require('./controllers');

/**
 * @desc Retrieves the public key corresponding to the given key ID (kid) from the JWKS endpoint.
 * @param {string} kid - The key ID to find the corresponding public key.
 * @returns {Promise<string|null>} The public key in PEM format or null if an error occurs.
*/
function getPublicKey(kid) {
  // Get public key with passed key ID
  return axios.get(process.env.JWKS_ENDPOINT)
    .then((res) => {
      const keys = res.data.keys
      const key = keys.find((key) => key.kid === kid);
      return jwkToPem(key);
    }).catch(() => null);
}

/**
 * @desc Verifies if the given JWT token is valid.
 * @param {string} token - The JWT token to validate.
 * @returns {Promise<boolean>} A boolean indicating whether the token is valid or not.
*/
async function isValidToken(token) {
  try {
    // Get public key based on passed key ID
    const kid = jwt.decode(token, { complete: true }).header.kid;
    const publicKey = await getPublicKey(kid);

    // Return true if audience matches or false otherwise
    return Boolean(jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience: process.env.CLIENT_ID
    }).sub);
  } catch (err) {
    return false;
  }
}

/**
 * @desc Middleware to handle authentication for incoming requests.
 * @param {object} req - The HTTP request object.
 * @param {object} res - The HTTP response object.
 * @param {function} next - The next function.
 * @returns {Promise<void>} A promise that resolves when the request is authenticated or rejected.
*/
async function authHandler(req, res, next) {
  // Get passed token and valid it
  const token = req?.headers?.authorization?.slice(7);
  const valid = await isValidToken(token);

  // Continue if valid else return 401 error
  return valid ? next() : res.sendStatus(401);
}

// Initialize ExpressJS application
const app = express();
const upload = multer({});

// Setup middleware
app.use(parser.json());
// app.use(authHandler);

// Define routes for image and text handling
app.post('/image', upload.single('file'), handleImage);
app.post('/text', handleText);

module.exports = app;
