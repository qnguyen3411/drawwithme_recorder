const { promisify } = require('util');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const redis = require("redis")
const { createCanvas, loadImage } = require('canvas')

const app = express();

app.use(bodyParser.json());
app.listen(9000);

const BATCH_SIZE = 100;

const redisClient = redis.createClient();
redisClient.on("error", function (err) {
  console.log("Error " + err);
});

const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);
const incrAsync = promisify(redisClient.incr).bind(redisClient);

let buffers = {};

app.post('/write/:roomId', async (req, res) => {
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
        initializeSnapshot(roomId)
      }
      buffers[roomId] = []
    }

    buffers[roomId].push(data);
    console.log(buffers[roomId].length)
    incrAsync(`${roomId}_strokeCount`);

  } catch (err) {
    console.error(err);
  }
})

app.post('/snapshot/:roomId', async (req, res) => {
  recordBuffer(roomId, buffers[roomId])
  res.status(200).send("")
})

app.post('/end/:roomId', async (req, res) => {
  recordBuffer(roomId, buffers[roomId])
  setAsync(`${roomId}_status`, 'inactive');

  if (buffers[roomId]) {
    delete buffers[roomId];
  }
  res.status(200).send("")

})


setInterval(unloadBuffers, 20000);

function unloadBuffers() {
  Object.entries(buffers).forEach(async ([roomId, buffer]) => {
    if (!buffer || buffer.length === 0) { return; }
    await recordBuffer(roomId, buffer);
    while (buffer.length !== 0) {
      buffer.pop()
    }
  })
}

async function recordBuffer(roomId, strokeBuffer) {
  try {
    const ctx = await getSnapshotCtx(roomId);
    let logStr = "";
    for (let i = 0; i < strokeBuffer.length; i++) {
      draw(ctx, strokeBuffer[i]);
      logStr += ',\n' + JSON.stringify(strokeBuffer[i])
    }

    snapShot(roomId, ctx.canvas);
    writeToLog(roomId, logStr)
  } catch (err) {
    console.log(err)
  }
}

async function getSnapshotCtx(roomId) {
  try {
    const image = await loadImage(getSnapshotUrl(roomId));
    const canvas = createCanvas(1820, 1024, 'png');
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    return ctx;
  } catch (err) {
    throw err
  }

}

async function writeToLog(roomId, logStr) {
  const strokeCount = await getAsync(`${roomId}_strokeCount`);
  const batchNum = Math.floor(strokeCount / BATCH_SIZE);

  const fileName = getFileName(roomId, batchNum);
  fs.writeFile(fileName, logStr, { flag: 'a', mode: 33279 }, (err) => {
    if (err) throw err;
    console.log("WRITE SUCCESSFUL")
  })
}


function getFileName(roomId, batchNum) {
  return __dirname + `/public/logs/${roomId}_${batchNum}.txt`
}

function draw(ctx, stroke) {
  const cssString = `rgba(${stroke.rgba.join(',')})`;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (stroke.x.length === 0) {
    ctx.lineWidth = 1;
    ctx.fillStyle = cssString;
    drawDot(ctx, stroke.x, stroke.y);
  } else {
    ctx.lineWidth = stroke.size
    ctx.strokeStyle = cssString;
    drawPath(ctx, stroke.x, stroke.y);
  }
}

function drawPath(ctx, x, y) {
  ctx.moveTo(x[0], x[0]);
  ctx.beginPath();
  const len = x.length;
  for (let i = 1; i < len; i++) {
    ctx.lineTo(x[i], y[i]);
  }
  ctx.stroke();
}

function drawDot(ctx, x, y) {
  ctx.beginPath();
  ctx.arc(x[0], y[0], size / 2, 0, 2 * Math.PI);
  ctx.fill();
}

function initializeLog(roomId) {
  return new Promise((resolve, reject) => {
    const initialStr = '[{"rgba":[1,1,1,1], "size": 1, "x": [], "y": []}';
    const fileName = getFileName(roomId, 0);
    fs.writeFile(fileName, initialStr, { flags: 'a', mode: 33279 }, (err) => {
      if (err) { reject(err); }
      resolve();
    })
  })
}

function getFileName(roomId, batchNum) {
  return __dirname + `/public/logs/${roomId}_${batchNum}.txt`
}

async function initializeSnapshot(roomId) {
  const canvas = createCanvas(1820, 1024, 'png');
  await snapShot(roomId, canvas)
}

function snapShot(roomId, canvas) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(
      getSnapshotUrl(roomId),
      { mode: 33279, flag: 'w' }
    )
    const stream = canvas.createPNGStream()
    stream.pipe(out)
    out.on('finish', () => resolve());
    out.on('error', (err) => reject(err));
  })
}

function getSnapshotUrl(roomId) {
  return __dirname + `/public/snapShots/${roomId}_snapshot.png`;
}