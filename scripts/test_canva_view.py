import urllib.request,pathlib,traceback
urls=[
 ("share", "https://www.canva.com/d/M_ISDLNaghYRCqQ"),
 ("view", "https://www.canva.com/design/DAHaMTlm3xY/view?embed"),
 ("edit", "https://www.canva.com/design/DAHaMTlm3xY/edit")
]
out=[]
for name,url in urls:
 try:
  request=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0","Accept":"text/html"})
  with urllib.request.urlopen(request,timeout=25) as resp:
   raw=resp.read(1200000)
   out.append(f"{name}: status={resp.status} url={resp.url} bytes={len(raw)} type={resp.headers.get('content-type')}")
   out.append("snippet: "+raw[:1800].decode("utf-8","replace").replace("\n"," "))
 except Exception as error:
  out.append(f"{name} ERROR {error!r}")
print("\n".join(out))
pathlib.Path("canva-public-preview-status.txt").write_text("\n".join(out))
