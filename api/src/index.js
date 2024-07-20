require('dotenv').config();

const consumeMsgs = require('./queues');
const app = require('./routes');

// Subscribe to messages queue
consumeMsgs();

// Start the Express application on port 8000
app.listen(8000, () => console.log('Listening.'));
