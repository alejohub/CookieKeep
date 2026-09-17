import {deflateSync} from 'node:zlib';

export function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

// Geometry is authored for toolbar sizes; supersampling gives a clean transparent edge.
function sample(x, y, size) {
  const dx = x - .5, dy = y - .5;
  const angle = Math.atan2(dy, dx), distance = Math.hypot(dx, dy);
  const radius = .438 + .010 * Math.sin(7 * angle) + .006 * Math.cos(11 * angle);
  if (distance > radius) return [0, 0, 0, 0];
  if (distance > radius - .044) return [158, 88, 38, 255];
  const chips = [[.31,.29,.065],[.65,.30,.070],[.47,.49,.065],[.27,.64,.060],[.65,.67,.078]];
  for (const [cx,cy,r] of chips) {
    const chipDistance = Math.hypot((x-cx)*1.03, (y-cy)*.95);
    if (chipDistance < r) return chipDistance < r * .60 && y < cy ? [103,61,38,255] : [72,41,27,255];
  }
  if (size >= 32 && [[.45,.23],[.74,.48],[.45,.75],[.21,.44]].some(([cx,cy])=>Math.hypot(x-cx,y-cy)<.014)) return [192,128,58,255];
  const light = Math.max(0, (.6-y)*16);
  return [Math.min(255,233+light), Math.min(255,177+light), Math.min(255,94+light),255];
}

export function renderIcon(size) {
  const raw = Buffer.alloc(size*(size*4+1)), scale = 8;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sums = [0,0,0,0];
    for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
      const color = sample((x+(sx+.5)/scale)/size, (y+(sy+.5)/scale)/size,size);
      for (let i = 0; i < 3; i++) sums[i] += color[i]*color[3]/255;
      sums[3] += color[3];
    }
    const offset = y*(size*4+1)+1+x*4, coverage = sums[3]/(scale*scale);
    for (let i = 0; i < 3; i++) raw[offset+i] = coverage ? Math.round(sums[i]/(sums[3]/255)) : 0;
    raw[offset+3] = Math.round(coverage);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size,0); header.writeUInt32BE(size,4); header[8]=8; header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR',header), chunk('IDAT',deflateSync(raw)), chunk('IEND',Buffer.alloc(0))]);
}
