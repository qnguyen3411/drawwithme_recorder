const { promisify } = require('util');
const fs = require('fs');
const redis = require("redis")
const server = require('http').createServer();

const BATCH_SIZE = 100;

const redisClient = redis.createClient();
const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);
const incrAsync = promisify(redisClient.incr).bind(redisClient);

redisClient.on("error", function (err) {
  console.log("Error " + err);
});


let writeStreams = {};

var io = require('socket.io')(server);
io.on('connection', function (client) {
  console.log("CLIENT CONNECTED")

  client.on('write', async function ({ roomId, data }) {
    console.log(roomId);
    try {
      if (!writeStreams[roomId]) {
        // Check redis for room
        const status = await getAsync(`${roomId}_status`);
        if (status === null) {
          await initializeRoom(roomId)
          writeStreams[roomId] = await createNewWriteStream(roomId, 0);
        } else if (status === 'active') {
          const strokeCount = await getAsync(`${roomId}_strokeCount`);
          const batchNum = Math.floor(strokeCount / BATCH_SIZE);
          writeStreams[roomId] = await openWriteStream(roomId, batchNum);
        } else {
          throw new Error("ROOM IS INACTIVE");
        }
      }

      writeStreams[roomId].write(',\n' + JSON.stringify(data));
      const count = incrAsync(`${roomId}_strokeCount`);
      if (count % BATCH_SIZE === 0) {
        const batchNum = Math.round(count / BATCH_SIZE);
        writeStreams[roomId] = await createNewWriteStream(roomId, batchNum);
      }
    } catch (err) {
      console.error(err);
    }

  });

  async function initializeRoom(roomId) {
    try {
      await redisClient.set(`${roomId}_status`, 'active');
      await redisClient.set(`${roomId}_strokeCount`, '0');
      return;
    } catch (err) {
      throw err;
    }
  }

  async function createNewWriteStream(roomId, batchNum) {
    try {
      const stream = await openWriteStream(roomId, batchNum);
      stream.write("[{'rgba':[1,1,1,1], 'size': 1, x: [], y: []}");
      return stream;
    } catch (err) {
      throw err;
    }
  }

  async function openWriteStream(roomId, batchNum) {
    return new Promise((resolve, reject) => {
      const strokeLogPath = getFileName(roomId, batchNum);
      try {
        const stream = fs.createWriteStream(strokeLogPath, { flags: 'a', mode: 777 });
        stream.on('open', () => {
          fs.chmodSync(strokeLogPath, '755');
          while(!stream.writable) { /* Wait til stream is writable */ }
          resolve(stream);
        });
        

      } catch (err) {
        reject(err);
      };



    });
  }

  function getFileName(roomId, batchNum) {
    return __dirname + `/../strokeLogs/${roomId}_${batchNum}.txt`
  }

  client.on('snapshot', async function ({ roomId, data }) {

  });

  client.on('end', function ({ roomId }) {

  }),
    client.on('disconnect', function () { });
});
server.listen(9000);