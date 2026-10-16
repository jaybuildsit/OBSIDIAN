import express from "express"
import morgan from "morgan"

const app = express();

app.use(morgan('dev'));
app.use(express.json());

app.get("/api/status/healthz", (req, res) => {
    res.status(200).json({ status: 'Working Good' });


})

// app.get('/api/ai/healthz', (eq, res) => {
//     res.status(200).json({ status: 'ok' });
// })



export default app;