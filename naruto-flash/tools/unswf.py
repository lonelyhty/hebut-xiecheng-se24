import sys, zlib, struct, re, os
p = sys.argv[1]
b = open(p,'rb').read()
print("magic:", b[:3], "version:", b[3], "declared_len:", struct.unpack('<I', b[4:8])[0], "file_len:", len(b))
if b[:3]==b'CWS':
    body = zlib.decompress(b[8:])
    print("decompressed body:", len(body))
    out = b'FWS'+b[3:4]+struct.pack('<I', len(body)+8)+body
    open(p+'.decompressed.swf','wb').write(out)
    src = body
elif b[:3]==b'ZWS':
    print("LZMA compressed, need lzma")
    import lzma
    # ZWS: 8-byte header then 4-byte compressed len, then 5-byte lzma props, then data
    clen = struct.unpack('<I', b[8:12])[0]
    props = b[12:17]
    data = b[17:12+clen]
    filt = lzma._decode_filter_properties(lzma.FILTER_LZMA1, props)
    src = lzma.decompress(data, format=lzma.FORMAT_RAW, filters=[filt])
    print("lzma body:", len(src))
    open(p+'.decompressed.swf','wb').write(b'FWS'+b[3:4]+struct.pack('<I', len(src)+8)+src)
else:
    src = b[8:]
    print("uncompressed body:", len(src))
s = src.decode('latin-1')
strs = re.findall(r'[ -~]{5,}', s)
seen=set(); out=[]
for t in strs:
    if t in seen: continue
    seen.add(t); out.append(t)
print("unique ascii strings:", len(out))
open(p+'.strings.txt','w',encoding='utf-8').write('\n'.join(out))
