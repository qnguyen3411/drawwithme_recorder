const { createCanvas } = require('canvas');
const canvas = createCanvas(10, 10, 'png');
const ctx = canvas.getContext('2d');
console.log(canvas, ctx);