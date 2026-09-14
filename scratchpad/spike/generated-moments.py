import json, os, sys, urllib.request, base64, concurrent.futures, time
S=os.path.dirname(os.path.abspath(__file__))
env={}
for line in open('apps/api/.env'):
    line=line.strip()
    if line and not line.startswith('#') and '=' in line:
        k,v=line.split('=',1); env[k]=v.strip().strip('"')
KEY=env['NOVITA_API_KEY']
H='https://api-production-2b77.up.railway.app/art'
STYLE="Korean manhwa ink illustration, not a photograph: confident black linework, hatching in the shadows, loose sketchy hair strands, mostly monochrome grey wash with one accent colour, matte. Warm living skin, the face is the brightest thing in the frame, both eyes with a catchlight. Same man as the reference image: same face, same hair, same glasses if any. One person. Portrait 3:4, no text."
MEN={
 'ash': ('ash-hero.jpg', 'Ash, twenty-nine, ash-white hair, round glasses he looks over, oversized dark hoodie, headphones around his neck'),
 'rafe': ('rafe-hero.jpg', 'Rafe, twenty-seven, ash-blond hair tied back with strands escaping, silver rings, white dress shirt open at the collar'),
 'jun': ('jun-hero.jpg', 'Jun, thirty-four, black hair, thin glasses, black shirt, long dark coat'),
}
SCENES=[
 ('ash','01-window','at the window of his one-room flat at four in the morning, rain on the glass, city lights behind, glasses pushed up into his hair, looking at the viewer over his shoulder'),
 ('ash','02-stairs','on a dim stairwell landing, one hand on the rail, looking up at the viewer who is two steps above, amused'),
 ('ash','03-coat','holding out a coat that is not his toward the viewer on a windy rooftop at night, hair blown across the glasses'),
 ('ash','04-noodles','at the counter of a shut noodle place at three in the morning, chin on his hand, glasses off on the counter, looking straight at the viewer'),
 ('rafe','05-lift','in a private lift lobby in full daylight, leaning on the wall by the lift doors, sleeves rolled, rings on, smiling like it costs him something'),
 ('rafe','06-couch','asleep on a couch on the forty-second floor at dawn, shirt open, one arm over his eyes, the city pale through the glass behind'),
 ('rafe','07-rain','on a pavement in the rain at night under a shop awning, hair down and wet, laughing at the viewer'),
 ('jun','08-car','in the back seat of a black car at night, city going by the window, looking at the viewer without his glasses, coat open'),
 ('jun','09-cafe','sitting in a small ordinary cafe in daylight, out of place in his dark coat, a cup he has not touched, watching the viewer across the table'),
 ('jun','10-roof','on the top floor of an unfinished tower at night, wind in his coat, one work lamp, holding his coat open for the viewer to step into'),
]
def gen(item):
    man,name,scene=item
    hero,desc=MEN[man]
    prompt=f"{STYLE} CHARACTER: {desc}. SCENE: {scene}."
    body=json.dumps({"prompt":prompt,"images":[f"{H}/{hero}"],"size":"1536x2048","watermark":False}).encode()
    req=urllib.request.Request('https://api.novita.ai/v3/seedream-4.0',data=body,headers={'authorization':'Bearer '+KEY,'content-type':'application/json'})
    t=time.time()
    try:
        r=json.load(urllib.request.urlopen(req,timeout=240))
    except urllib.error.HTTPError as e:
        return (name,'HTTP %s %s'%(e.code,e.read()[:200]),0)
    dt=time.time()-t
    imgs=r.get('images') or r.get('data') or []
    if not imgs: return (name,'no image: '+json.dumps(r)[:300],dt)
    im=imgs[0]
    if isinstance(im,str):
        data=urllib.request.urlopen(im,timeout=120).read() if im.startswith('http') else base64.b64decode(im.split(',')[-1])
    else:
        url=im.get('image_url') or im.get('url')
        data=urllib.request.urlopen(url,timeout=120).read() if url else base64.b64decode(im.get('image_file') or im.get('b64_json'))
    open(f'{S}/{name}.png','wb').write(data)
    return (name,'ok %dKB'%(len(data)//1024),dt)
with concurrent.futures.ThreadPoolExecutor(10) as ex:
    for name,status,dt in ex.map(gen,SCENES):
        print(f'{name}: {status} ({dt:.0f}s)')
