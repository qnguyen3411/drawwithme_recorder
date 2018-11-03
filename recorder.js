const { promisify } = require('util');
const fs = require('fs');
const redis = require("redis")
const ImageDataURI = require('image-data-uri');
const server = require('http').createServer();
server.listen(9000);


const BATCH_SIZE = 100;

const redisClient = redis.createClient();
redisClient.on("error", function (err) {
  console.log("Error " + err);
});

const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);
const incrAsync = promisify(redisClient.incr).bind(redisClient);

let writeStreams = {};





var io = require('socket.io')(server);
io.on('connection', function (client) {
  console.log("CONNECTED WITH SOCKET SERVER")
  client.on('write', async function ({ roomId, data }) {
    console.log(roomId);
    try {
      if (!writeStreams[roomId]) {
        await initializeWriteStream(roomId);
      }

      writeStreams[roomId].write(',\n' + JSON.stringify(data));
      const count = incrAsync(`${roomId}_strokeCount`);
      if (count % BATCH_SIZE === 0) {
        const batchNum = Math.round(count / BATCH_SIZE);

        writeStreams[roomId] = await createNewWriteStream(roomId, batchNum);
        client.emit('snapshotRequest');
      }
    } catch (err) {
      console.error(err);
    }

  });

  async function initializeWriteStream(roomId) {
    try {
      const status = await getAsync(`${roomId}_status`);

      if (status === null) {
        await initializeRoom(roomId)
        writeStreams[roomId] = await createNewWriteStream(roomId, 0);

      } else if (status === 'active') {
        const strokeCount = await getAsync(`${roomId}_strokeCount`);
        const batchNum = Math.floor(strokeCount / BATCH_SIZE);
        writeStreams[roomId] = await openWriteStream(roomId, batchNum);

      } else {
        throw new Error("Tried to write to an inactive room");
      }
    } catch (err) {
      throw err;
    }
  }

  async function initializeRoom(roomId) {
    try {
      setAsync(`${roomId}_status`, 'active');
      await setAsync(`${roomId}_strokeCount`, '0');
      return;
    } catch (err) {
      throw err;
    }
  }

  async function createNewWriteStream(roomId, batchNum) {
    try {
      const stream = await openWriteStream(roomId, batchNum);
      stream.write('[{"rgba":[1,1,1,1], "size": 1, "x": [], "y": []}"');
      return stream;
    } catch (err) {
      throw err;
    }
  }

  async function openWriteStream(roomId, batchNum) {
    return new Promise((resolve, reject) => {
      const strokeLogPath = getFileName(roomId, batchNum);
      try {
        const stream = fs.createWriteStream(strokeLogPath, { flags: 'a', mode: 33279 });
        stream.on('open', () => {
          while (!stream.writable) { /* Wait til stream is writable */ }
          resolve(stream);
        });
      } catch (err) {
        reject(err);
      };
    });
  }

  function getFileName(roomId, batchNum) {
    return __dirname + `/public/logs/${roomId}_${batchNum}.txt`
  }

  client.on('snapShot', async function ({ roomId, data }) {
    fs.writeFile(
      __dirname + `/public/snapShots/${roomId}_snapshot.txt`, 
      data,  
      { mode: 33279, flag: 'w'},
      (err) => {
        console.log(err)
      })
  });

  client.on('end', function ({ roomId }) {
    setAsync(`${roomId}_status`, 'inactive');
    if (writeStreams[roomId]) {
      writeStreams[roomId].close();
      delete writeStreams[roomId];
    }
  });

  client.on('disconnect', function () { });
});
