import sys, glob, os, shutil
from PIL import Image, ImageDraw
lang=sys.argv[1]; pat=sys.argv[2] if len(sys.argv)>2 else '*'
src=f'/tmp/crawl/{lang}'; out=f'/tmp/sheets/{lang}'; shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
files=sorted(glob.glob(f'{src}/{pat}.png'))
W,H=390,844; s=0.5; cols=6; rows=2; per=cols*rows
for k in range(0,len(files),per):
    sheet=Image.new('RGB',(int(W*s)*cols,(int(H*s)+14)*rows),'white'); d=ImageDraw.Draw(sheet)
    for i,f in enumerate(files[k:k+per]):
        im=Image.open(f).convert('RGB').resize((int(W*s),int(H*s))); x=(i%cols)*int(W*s); y=(i//cols)*(int(H*s)+14)
        sheet.paste(im,(x,y+14)); d.text((x+2,y+1),os.path.basename(f)[:-4][:32],fill='black')
    sheet.save(f'{out}/{k//per:02d}.png')
print(len(files),'shots',(len(files)+per-1)//per,'sheets')
