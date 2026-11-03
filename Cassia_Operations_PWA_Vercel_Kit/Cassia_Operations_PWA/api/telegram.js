// Telegram sends an Update object, not a Cassia action wrapper.
// Keep the bot secret server-side and forward only this explicitly designated webhook.
import handler from './index.js';
export default async function telegramWebhook(req,res){
 if(req.method!=='POST'){
  return res.status(405).setHeader('Allow','POST').json({error:'Method not allowed'});
 }
 const header=String(req.headers['x-telegram-bot-api-secret-token']||'');
 // If proxying to Render, verify there; otherwise verify in this Vercel function.
 if(!process.env.RENDER_API_ORIGIN&&(!process.env.TELEGRAM_WEBHOOK_SECRET||header!==process.env.TELEGRAM_WEBHOOK_SECRET)){
  return res.status(403).json({error:'Forbidden'});
 }
 let payload=req.body;
 if(typeof payload==='string'){try{payload=JSON.parse(payload)}catch{return res.status(400).json({error:'Invalid Telegram payload'})}}
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||!Number.isSafeInteger(payload.update_id)){
  return res.status(400).json({error:'Invalid Telegram update'});
 }
 req.body={...payload,action:'telegram.update'};
 return handler(req,res);
}
