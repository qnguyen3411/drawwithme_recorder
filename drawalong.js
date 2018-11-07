const { createCanvas } = require('canvas');

function makeCanvas() {
  console.log(process.memoryUsage());
  let canvas = createCanvas(10, 10, 'png');
  // console.log(canvas, ctx);
  let ctx = canvas.getContext('2d');
  canvas = null;
  ctx = null;
  // let x = 3;
  // x = null;
}
setInterval(makeCanvas, 1000);

// makeCanvas()