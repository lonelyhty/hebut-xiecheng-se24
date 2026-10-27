(() => {
  const out = {};
  const p = document.querySelector('ruffle-player');
  out.hasPlayer = !!p;
  if (p) {
    out.rect = p.getBoundingClientRect().toJSON();
    out.readyState = p.readyState;
    out.isPlaying = p.isPlaying;
    out.metadata = p.metadata ? { width: p.metadata.width, height: p.metadata.height, frameRate: p.metadata.frameRate, numFrames: p.metadata.numFrames, swfVersion: p.metadata.swfVersion } : null;
  }
  out.bootHidden = document.getElementById('boot') ? getComputedStyle(document.getElementById('boot')).display : null;
  out.msg = document.getElementById('msg') ? document.getElementById('msg').textContent : null;
  return JSON.stringify(out);
})()
