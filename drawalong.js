const { createCanvas, loadImage } = require('canvas')


const canvas = createCanvas(1000, 1000, 'png');
const ctx = canvas.getContext('2d');

console.log(canvas, ctx);