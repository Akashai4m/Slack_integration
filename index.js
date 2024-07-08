 const {slackSigningSecretkey ,tokenkey ,sourceChannelkey ,targetChannelkey} = require('./constants')
const { WebClient } = require('@slack/web-api');
const { createEventAdapter } = require('@slack/events-api');
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

 const slackSigningSecret = slackSigningSecretkey;
 const token = tokenkey;
const web = new WebClient(token);

const slackEvents = createEventAdapter(slackSigningSecret);

const app = express();

// Middleware to parse JSON
app.use(bodyParser.json());

app.post('/slack/events', (req, res) => {
    console.log('Incoming request:', req.body);  // Log incoming requests

    // Handle Slack URL verification
    if (req.body.type === 'url_verification') {
        console.log('Challenge request:', req.body.challenge);
        return res.status(200).send(req.body.challenge);  // Respond with the challenge as plain text
    }

    const slackSignature = req.headers['x-slack-signature'];
    const requestBody = JSON.stringify(req.body);
    const timestamp = req.headers['x-slack-request-timestamp'];
    const time = Math.floor(new Date().getTime() / 1000);

    // Check if the request is too old
    if (Math.abs(time - timestamp) > 300) {
        console.log('Request too old');
        return res.status(400).send('Ignore this request.');
    }

    // Create the basestring
    const sigBasestring = 'v0:' + timestamp + ':' + requestBody;

    // HMAC SHA256
    const mySignature = 'v0=' +
        crypto.createHmac('sha256', slackSigningSecret)
            .update(sigBasestring, 'utf8')
            .digest('hex');

    // Check that the request signature matches expected value
    if (!crypto.timingSafeEqual(Buffer.from(mySignature, 'utf8'), Buffer.from(slackSignature, 'utf8'))) {
        console.log('Verification failed');
        return res.status(400).send('Verification failed');
    }

    // Pass the request to the Slack event adapter
    slackEvents.requestListener()(req, res);
});

// Slack events
slackEvents.on('message', async (event) => {
    try {
        if (event.subtype && event.subtype === 'bot_message') {
            // Ignore bot messages
            return;
        }

         const sourceChannel = sourceChannelkey; // Replace with the source channel ID tech-products
            const targetChannel = targetChannelkey;// Replace with the target channel ID

        if (event.channel === sourceChannel) {
            const messageText = event.text;

            await web.chat.postMessage({
                channel: targetChannel,
                text: messageText
            });

            console.log(`Message sent to ${targetChannel}: ${messageText}`);
        }
    } catch (error) {
        console.error(`Error posting message: ${error}`);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
