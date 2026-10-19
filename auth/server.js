import app from "./src/app.js"

import { connectDB } from "./src/config/db.js"

connectDB();

app.listen(3000, (req, res) => {
    console.log("Auth running Successfully on Port 3000")
})

