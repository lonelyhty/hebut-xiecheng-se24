import sys, struct, zlib, collections
p = r"C:\Users\bujiaoxiaogui\Documents\deepseek-harness\default-workspace\naruto_flash\13.swf"
b = open(p,'rb').read()
body = zlib.decompress(b[8:]) if b[:3]==b'CWS' else b[8:]
# rect
nbits = body[0] >> 3
rect_bits = 5 + nbits*4
rect_len = (rect_bits + 7)//8
i = rect_len
frame_rate = struct.unpack('<H', body[i:i+2])[0]/256.0
frame_count = struct.unpack('<H', body[i+2:i+4])[0]
print(f"rect_len={rect_len} frame_rate={frame_rate} frame_count={frame_count}")
i += 4
tags = collections.Counter()
abc_total = 0
doaction_total = 0
while i < len(body):
    if i+2 > len(body): break
    th = struct.unpack('<H', body[i:i+2])[0]
    code = th >> 6
    ln = th & 0x3f
    i += 2
    if ln == 0x3f:
        ln = struct.unpack('<I', body[i:i+4])[0]; i += 4
    tags[code] += 1
    if code == 72: abc_total += ln
    if code == 12: doaction_total += ln
    if code == 0:
        print("End tag at", i)
        break
    i += ln
names = {0:'End',1:'ShowFrame',9:'SetBackgroundColor',12:'DoAction',20:'DefineBitsLossless',21:'DefineBitsJPEG2',26:'PlaceObject2',36:'DefineBitsLossless2',39:'DefineSprite',43:'FrameLabel',59:'DoInitAction',69:'FileAttributes',70:'PlaceObject3',72:'DoABC',76:'SymbolClass',77:'Metadata',82:'DoABC2',56:'ExportAssets',57:'ImportAssets',86:'DefineSceneAndFrameLabelData',73:'DefineFontAlignZones',75:'DefineFont3',88:'DefineFontName',90:'DefineBitsJPEG4',71:'ImportAssets2',13:'DefineFontInfo',87:'DefineBinaryData',48:'DefineFont2',37:'DefineEditText',35:'DefineBitsJPEG3'}
print("total tags:", sum(tags.values()))
for c,n in tags.most_common(40):
    print(f"  {c:3d} {names.get(c,'?'):28s} x{n}")
print("DoABC bytes total:", abc_total, " DoAction bytes total:", doaction_total)
