const cron = require('node-cron');
require('dotenv').config();

const app = require('./routes');
const pollMsgs = require('./queues');

// Schedule pollMsgs for 5 minute intervals
cron.schedule('*/5 * * * *', pollMsgs);

// Start the Express application on port 8000
app.listen(8000, () => console.log('Listening.'));
