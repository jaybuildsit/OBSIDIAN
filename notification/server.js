import "dotenv/config";
import app from "./src/app.js";

app.listen(4000,()=>{
    console.log("Notification Server running on Port 4000")
})