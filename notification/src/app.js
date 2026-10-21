import express from "express"
import morgan from "morgan"
import { sendEmail } from "./email.js"
import channel from './mq.js'


const app = express();

app.use(morgan('dev'));


app.get('/', (req, res) => {
    res.send('Hello fromNotification Service')
});

channel.consume('auth_notification_queue', async (msg) => {

    if (msg !== null) {
        const messageContent = msg.content.toString();
        console.log('Received message from queue:', messageContent);

        try {
            const { to, subject, text, html } = JSON.parse(messageContent);


            await sendEmail(email, subject, text, html);

            channel.ack(msg);
        } catch (error) {
            console.error('Error processing message:', error);
        }
    } else {
        console.log('Received null message');
    }
})


export default app;