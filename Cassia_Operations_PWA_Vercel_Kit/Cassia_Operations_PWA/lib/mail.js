/** Server-only transactional OTP delivery through Resend. */
export async function sendOtp(email,code){
 const {RESEND_API_KEY,EMAIL_FROM}=process.env;
 if(!RESEND_API_KEY||!EMAIL_FROM)throw Error('Resend sender is not configured');
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:EMAIL_FROM,to:[email],subject:'Cassia login verification',text:'Your six-digit Cassia sign-in code is '+code+'. Expires in ten minutes.'}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Resend delivery request failed');
 const result=await response.json();if(!result.id)throw Error('Resend did not confirm request');
 return result.id;
}
