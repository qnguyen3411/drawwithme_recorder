const { createCanvas, loadImage } = require('canvas')

// const fs = require('fs');
const canvas = createCanvas(1000, 1000, 'png');
const ctx = canvas.getContext('2d');

console.log(canvas, ctx);
// fs.writeFile("test.txt", "hhey", { flag: 'a', mode: 33279 }, (err) => {
//   if (err) { console.log(err); }
// })


// for(let i = 0; i < 10000; i++) {
//   fs.writeFile("test.txt", i+ "\n", { flag: 'a', mode: 33279 }, function (err) {
//       if (err) console.log(err);
//   })
// }
