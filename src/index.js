import dotenv from "dotenv"
import connectDB from "./db/index.js"
import { app } from "./app.js"

dotenv.config({
    path: "../.env"
})
console.log("index entry point")
connectDB()
// console.log("db")
.then(() => {
    app.listen(process.env.PORT || 4000, () => {
        console.log(` Server is running at PORT: ${process.env.PORT || 4000}`)
    })
})
.catch((err) => {
    console.log("Mongo DB connection failed !!!",err)
})