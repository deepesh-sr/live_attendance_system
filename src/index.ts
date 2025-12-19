import express from 'express'

const app = express();

app.use(express.json());
app.get('/health',(req,res)=>{
    console.log("Hello");
    res.send("Helloooooo")
})

app.listen(3000,()=>{
    console.log("App is listening of port 3000")
})