/* Readback happens only on a stationary frame, never during the spinning transition. */
export function measureGlassVisibility(pixels,width,height) {
  if(width<8 || height<8 || pixels.length!==width*height*4)return {visible:false,contrastRatio:0,darkRatio:0};
  const corners=[[],[],[]],edge=Math.max(1,Math.min(4,Math.floor(Math.min(width,height)/12)));
  for(const [ox,oy] of [[0,0],[width-edge,0],[0,height-edge],[width-edge,height-edge]]) {
    for(let y=oy;y<oy+edge;y++)for(let x=ox;x<ox+edge;x++) {
      const p=(y*width+x)*4;for(let c=0;c<3;c++)corners[c].push(pixels[p+c]);
    }
  }
  const bg=corners.map(values=>{values.sort((a,b)=>a-b);return values[Math.floor(values.length/2)];});
  const bgLuma=.2126*bg[0]+.7152*bg[1]+.0722*bg[2];
  let contrast=0,dark=0;
  for(let p=0;p<pixels.length;p+=4) {
    if(Math.max(Math.abs(pixels[p]-bg[0]),Math.abs(pixels[p+1]-bg[1]),Math.abs(pixels[p+2]-bg[2]))>=24)contrast++;
    if(bgLuma-(.2126*pixels[p]+.7152*pixels[p+1]+.0722*pixels[p+2])>=20)dark++;
  }
  const contrastRatio=contrast/(width*height),darkRatio=dark/(width*height);
  return {visible:contrastRatio>=.06 && darkRatio>=.04 && bgLuma>210,contrastRatio,darkRatio};
}
