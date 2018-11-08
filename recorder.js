const express = require('express');
const bodyParser = require('body-parser');
const redis = require("redis");
// const morgan = require('morgan');
const dataUriToBuffer = require('data-uri-to-buffer');

const { promisify } = require('util');
const sharp = require('sharp');
const fs = require('fs');

const app = express();

app.use(bodyParser.json({limit:'50mb'}));
app.listen(9000, () => {
  console.log("LISTENING")
});

const BATCH_SIZE = 100;

const redisClient = redis.createClient();
redisClient.on("error", function (err) {
  console.log("Error " + err);
});

const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);
const incrAsync = promisify(redisClient.incr).bind(redisClient);

let buffers = {};

app.post('/write/:roomId', async function (req, res) {
  const { data } = req.body;
  const { roomId } = req.params;

  res.status(200).send("")
  try {
    if (buffers[roomId] === undefined) {
      const status = await getAsync(`${roomId}_status`);
      if (status === 'inactive') { return; }
      if (status === null) { // If brand new room
        await setAsync(`${roomId}_strokeCount`, '0');
        setAsync(`${roomId}_status`, 'active');
        initializeLog(roomId);
      }
      buffers[roomId] = []
    }
    buffers[roomId].push(data);
    incrAsync(`${roomId}_strokeCount`);

  } catch (err) {
    console.error(err);
  }
})

app.post('/snapshot/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const buffer = dataUriToBuffer(req.body.data);

  const thumbOut = fs.createWriteStream(getThumbUrl(roomId), { mode: 33279, flag: 'w' });
  const thumbTransform = sharp(buffer).resize(320, 180);
  thumbTransform.pipe(thumbOut);
  fs.writeFile(getSnapshotUrl(roomId), buffer, { mode: 33279, flag: 'w' },(err) => {
    if (err) { console.log(err) };
  });

  res.status(200).send("")
})

app.post('/end/:roomId', async (req, res) => {
  const { roomId } = req.params;

  if (buffers[roomId]) {
    recordBuffer(roomId, buffers[roomId])
  }
  setAsync(`${roomId}_status`, 'inactive');

  if (buffers[roomId]) {
    delete buffers[roomId];
  }
  res.status(200).send("");
})

// INITIALIZE TIMER
setInterval(unloadBuffers, 20000);


function unloadBuffers() {
  Object.entries(buffers).forEach(async ([roomId, buffer]) => {
    if (buffer.length === 0) { return; }
    await recordBuffer(roomId, buffer);
    buffers[roomId] = [];
  })
}

async function recordBuffer(roomId, strokeBuffer) {
  try {
    const writeStream = await getLogWriteStream(roomId);
    for (let i = 0; i < strokeBuffer.length; i++) {
      writeStream.write(',\n' + JSON.stringify(strokeBuffer[i]))
    }
    writeStream.close();
  } catch (err) {
    console.log(err)
  }
}

async function getLogWriteStream(roomId) {
  const strokeCount = await getAsync(`${roomId}_strokeCount`);
  const batchNum = Math.floor(strokeCount / BATCH_SIZE);
  const fileName = getLogFileName(roomId, batchNum);
  const stream = fs.createWriteStream(fileName, { flags: 'a', mode: 33279 })
  while (!stream.writable) { }
  return stream;
}

function getLogFileName(roomId, batchNum) {
  return __dirname + `/public/logs/${roomId}_${batchNum}.txt`
}

function initializeLog(roomId) {
  return new Promise((resolve, reject) => {
    const initialStr = '[{"rgba":[1,1,1,1], "size": 1, "x": [], "y": []}';
    const fileName = getLogFileName(roomId, 0);
    fs.writeFile(fileName, initialStr, { flags: 'a', mode: 33279 }, (err) => {
      if (err) { reject(err); }
      resolve();
    })
  })
}

function getLogFileName(roomId, batchNum) {
  return __dirname + `/public/logs/${roomId}_${batchNum}.txt`
}


function getSnapshotUrl(roomId) {
  return __dirname + `/public/snapshots/${roomId}_snapshot.png`;
}

function getThumbUrl(roomId) {
  return __dirname + `/public/thumbs/${roomId}_snapshot.png`;
}