import "dotenv/config"
import app from './src/app.js'

app.listen(3000,(req,res)=>{
    console.log("Ai-Orchestration running on Port 3000")
})