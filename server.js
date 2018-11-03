const fs = require('fs');
const { promisify } = require('util');

const express = require('express');
const compression = require('compression')
const redis = require("redis");

const BATCH_SIZE = 100;

const redisClient = redis.createClient();
redisClient.on("error", function (err) {
  console.log("Error " + err);
});
// const getAsync = promisify(redisClient.get).bind(redisClient);


const app = express();
app.use(compression());
app.use(express.static('public'))
app.listen(1337);


// app.get('/log/latest/:roomId', async (req, res) => {
  
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
//   res.setHeader('Access-Control-Allow-Origin', '*');

//   const { roomId } = req.params;
//   const strokeCount = await getAsync(`${roomId}_strokeCount`);
//   const maxBatchNum = Math.floor(strokeCount / BATCH_SIZE);
//   let s = fs.createReadStream(__dirname + `/../strokeLogs/${roomId}_${maxBatchNum}.txt`)
//     .pipe(res)
//     .on('error', function (err) {
//       console.log('Error while reading file.', err);
//       res.status(500).send('Server error');
//     })
//     .on('end', function () {
//       console.log('Read entire file.')
//     });

// })

// app.get('/log/:batchNum/:roomId', async (req, res) => {
//   const { roomId, batchNum } = req.params;
//   const strokeCount = getAsync(`${roomId}_strokeCount`);
//   const maxBatchNum = Math.floor(strokeCount / BATCH_SIZE);
//   if (batchNum > maxBatchNum) {
//     res.send("");
//   }
//   let s = fs.createReadStream(__dirname + `/../strokeLogs/${roomId}_${batchNum}.txt`)
//     .pipe(res)
//     .on('error', function (err) {
//       console.log('Error while reading file.', err);
//       res.status(500).send('Server error');

//     })
//     .on('end', function () {
//       console.log('Read entire file.')
//     });
// })

