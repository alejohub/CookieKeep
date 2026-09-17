import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {renderIcon} from '../scripts/icon.mjs';
for(const size of [16,32,48,128])test(`icono ${size}px: PNG RGBA transparente, bordes suavizados y chips reconocibles`,()=>{
  const png=renderIcon(size);assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);assert.equal(png[25],6);
  let offset=8,idats=[];while(offset<png.length){const length=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8);if(type==='IDAT')idats.push(png.subarray(offset+8,offset+8+length));offset+=12+length;}
  const raw=inflateSync(Buffer.concat(idats));const pixel=(x,y)=>raw.subarray(y*(size*4+1)+1+x*4,y*(size*4+1)+5+x*4);
  for(const [x,y] of [[0,0],[size-1,0],[0,size-1],[size-1,size-1]])assert.equal(pixel(x,y)[3],0);
  let dark=0,transparent=0,antialias=0;for(let y=0;y<size;y++)for(let x=0;x<size;x++){const [r,g,b,a]=pixel(x,y);if(!a)transparent++;if(a>0&&a<255)antialias++;if(a===255&&r<120&&g<100&&b<70)dark++;if(a===255)assert.ok(r>=g,'sin fondo verde');}
  assert.ok(dark>0);assert.ok(transparent>size*size*.20);assert.ok(antialias>0);
});
