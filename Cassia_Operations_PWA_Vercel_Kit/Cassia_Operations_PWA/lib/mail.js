export async function sendOtp(email,code){
 const {MAILJET_API_KEY,MAILJET_SECRET_KEY,MAILJET_FROM_EMAIL,MAILJET_FROM_NAME}=process.env;
 if(!MAILJET_API_KEY||!MAILJET_SECRET_KEY||!MAILJET_FROM_EMAIL)throw Error('Mailjet not configured');
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch('https://api.mailjet.com/v3.1/send',{
   method:'POST',headers:{'Content-Type':'application/json','Authorization':'Basic '+Buffer.from(MAILJET_API_KEY+':'+MAILJET_SECRET_KEY).toString('base64')},signal:controller.signal,
   body:JSON.stringify({Messages:[{From:{Email:MAILJET_FROM_EMAIL,Name:MAILJET_FROM_NAME||'Cassia Restaurant'},To:[{Email:email}],Subject:'Your Cassia sign-in code',TextPart:`Your Cassia sign-in code is ${code}. It expires in 10 minutes. Never share it with anyone. If you did not request this, ignore the message.`}]})
  });
  if(!response.ok)throw Error('Mailjet could not send OTP ('+response.status+')');
 } finally {clearTimeout(timeout)}
}
