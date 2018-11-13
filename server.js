const express = require('express');
const compression = require('compression')
const redis = require("redis");

const redisClient = redis.createClient();
redisClient.on("error", function (err) {
  console.log("Error " + err);
});
console.log(process.pid)
const cors = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next()
}

const app = express();
app.use(compression());
app.use(cors, express.static('public'))
app.listen(1337);





