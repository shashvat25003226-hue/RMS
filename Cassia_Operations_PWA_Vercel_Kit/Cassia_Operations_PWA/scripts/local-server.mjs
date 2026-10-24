import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','public');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/api'){
  try{const mod=await import('../api/index.js');let raw='';for await(const part of req){raw+=part;if(raw.length>30000)break}req.body=raw;res.status=c=>{res.statusCode=c;return res};res.json=d=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(d));return res};await mod.default(req,res)}catch(e){res.statusCode=500;res.end(JSON.stringify({error:'Local server error'}));console.error(e.message)}return;
 }
 const rel=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1));const f=path.resolve(root,rel);
 if(!f.startsWith(root+path.sep)&&f!==path.resolve(root,'index.html')){res.statusCode=403;res.end('Forbidden');return}
 try{const data=await fs.readFile(f);res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');res.end(data)}catch(_){res.statusCode=404;res.end('Not found')}
});
const port=Number(process.env.PORT||3000);server.listen(port,()=>console.log(`Cassia app: http://localhost:${port}/?preview=1 (no credentials needed for sandbox)\nLogin requires MONGODB_URI and Resend configuration unless client demo OTP is enabled.`));
