(function(){
'use strict';
window.__orderLoaded=true;
if(!window.BC){var __n=document.getElementById('notice');if(__n)__n.innerHTML='<div class="notice warn">shop.js did not load. Upload shop.js to the same folder as this page, then reload.</div>';return}
var BC=window.BC,$=function(s){return document.querySelector(s)},$$=function(s){return [].slice.call(document.querySelectorAll(s))};
var peso=BC.peso,esc=BC.esc,sb=BC.sb;
var STORE_KEY='sbc_order';
var settings=null,online=false,canOrder=false,step=1,info=null,orderType='pickup',payMethod='gcash',proofBlob=null,pollT=null,sel='all';
var ICON={
  plus:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  all:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>',
  gcash:'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16 15h2"/></svg>',
  maya:'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/></svg>',
  cash:'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="11" rx="2"/><circle cx="12" cy="12.5" r="2.5"/></svg>'
};
function notice(html,cls){$('#notice').innerHTML=html?'<div class="notice '+(cls||'ok')+'">'+html+'</div>':''}
window.addEventListener('error',function(e){notice('Script error: '+esc(e.message||'unknown'),'warn')});
function qtyOf(it){var n=0,c=BC.state.cart;Object.keys(c).forEach(function(id){if(c[id].k===it.key)n+=c[id].q});return n}
function initial(s){return esc(String(s||'?').trim().charAt(0).toUpperCase())}

/* ---------- steps ---------- */
function go(n){
  step=n;
  $$('.ostep').forEach(function(e){e.hidden=e.id!=='step'+n});
  $$('#steps li').forEach(function(li){var s=+li.dataset.s;li.classList.toggle('on',s===n);li.classList.toggle('past',s<n)});
  updateBar();window.scrollTo(0,0);
}
function updateBar(){
  var t=BC.totals();
  $('#cbCount').textContent=t.count+(t.count===1?' item':' items');
  $('#cbTotal').textContent=peso(t.total);
  $('#cartbar').hidden=!(step===1&&t.count>0&&canOrder);
}
BC.onCart=function(){updateBar();refreshCtl();if(step===2)renderReview()};

/* ---------- menu: category rail + photo cards ---------- */
function catThumb(m){var f=m.i.filter(function(i){return i.img})[0];return f?'<img src="'+esc(f.img)+'" alt="">':initial(m.c)}
function renderRail(){
  var menu=BC.state.menu;
  $('#rail').innerHTML='<button type="button" data-c="all" class="'+(sel==='all'?'on':'')+'"><span class="av">'+ICON.all+'</span>All</button>'+menu.map(function(m,k){return '<button type="button" data-c="'+k+'" class="'+(sel===k?'on':'')+'"><span class="av">'+catThumb(m)+'</span>'+esc(m.c)+'</button>'}).join('');
  $('#rail').style.display=menu.length<2?'none':'';
  $('.shop').classList.toggle('norail',menu.length<2);
}
function ctl(i){
  if(i.status==='soldout')return '<span class="sotag">Sold out</span>';
  if(!canOrder)return '';
  var q=qtyOf(i),multi=i.p.length>1,k=esc(i.key);
  if(!q)return '<button type="button" class="plus" data-a="add" data-k="'+k+'" aria-label="Add '+esc(i.n)+'">'+ICON.plus+'</button>';
  if(multi)return '<span class="badge">'+q+'</span><button type="button" class="plus" data-a="add" data-k="'+k+'" aria-label="Add more">'+ICON.plus+'</button>';
  return '<div class="qpill"><button type="button" data-a="dec" data-k="'+k+'" aria-label="Remove one">'+ICON.minus+'</button><b>'+q+'</b><button type="button" data-a="inc" data-k="'+k+'" aria-label="Add one">'+ICON.plus+'</button></div>';
}
function soldHtml(n,pill){
  if(!n)return '';
  var ico='<svg viewBox="0 0 24 24" width="'+(pill?15:13)+'" height="'+(pill?15:13)+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>';
  return '<div class="sold" title="'+n+' bought">'+ico+'<span><b>'+BC.fmtCount(n)+'</b> bought</span></div>';
}
function pcard(i){
  var from=Math.min.apply(null,i.p),multi=i.p.length>1;
  return '<div class="pc'+(i.status==='soldout'?' so':'')+'" data-card="'+esc(i.key)+'"><div class="ph'+(i.img?'':' noimg')+'">'+(i.img?'<img src="'+esc(i.img)+'" alt="'+esc(i.n)+'" loading="lazy">':'<span>'+initial(i.n)+'</span>')+'<div class="pctl">'+ctl(i)+'</div></div><div class="nm">'+esc(i.n)+'</div><div class="pr">'+(multi?'from ':'')+peso(from)+'</div>'+soldHtml(BC.soldOf(i.n))+'</div>';
}
function chead(name,n,m){return '<div class="chead"><span class="av">'+(m?catThumb(m):ICON.all)+'</span><div><b>'+esc(name)+'</b><span>'+n+(n===1?' item':' items')+'</span></div></div>'}
function renderMenu(){
  var menu=BC.state.menu,q=($('#q').value||'').trim().toLowerCase(),html='',root=$('#menuRoot');
  $('#banner').hidden=!!q;
  if(!menu.length){root.innerHTML='<p class="empty">Our menu is coming soon.</p>';$('#rail').style.display='none';return}
  if(q){
    var list=[];menu.forEach(function(m){m.i.forEach(function(i){if(i.n.toLowerCase().indexOf(q)>-1)list.push(i)})});
    html=list.length?chead('Results',list.length)+'<div class="pgrid">'+list.map(pcard).join('')+'</div>':'<p class="empty">No items match “'+esc(q)+'”.</p>';
  }else{
    menu.forEach(function(m,k){if(sel==='all'||sel===k)html+=chead(m.c,m.i.length,m)+'<div class="pgrid">'+m.i.map(pcard).join('')+'</div>'});
  }
  root.innerHTML=html;
}
function refreshCtl(){
  $$('#menuRoot [data-card]').forEach(function(c){var it=BC.state.idx[c.getAttribute('data-card')],b=c.querySelector('.pctl');if(it&&b)b.innerHTML=ctl(it)});
}
$('#rail').addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;
  sel=b.dataset.c==='all'?'all':+b.dataset.c;$('#q').value='';renderRail();renderMenu();
});
$('#q').addEventListener('input',renderMenu);
$('#menuRoot').addEventListener('click',function(e){
  var a=e.target.closest('[data-a]');
  if(a){
    var k=a.getAttribute('data-k'),it=BC.state.idx[k];if(!it)return;
    if(a.dataset.a==='add'){if(it.p.length>1)openSheet(k);else BC.qty(k+'#0',1)}
    else if(a.dataset.a==='inc')BC.qty(k+'#0',1);else if(a.dataset.a==='dec')BC.qty(k+'#0',-1);
    return;
  }
  var c=e.target.closest('[data-card]');if(c)openSheet(c.getAttribute('data-card'));
});

/* ---------- item sheet ---------- */
var sk=null,ss=0,sq=1;
function openSheet(k){sk=k;ss=0;sq=1;paintSheet();$('#sheet').hidden=false;document.body.style.overflow='hidden'}
function closeSheet(){$('#sheet').hidden=true;document.body.style.overflow=''}
function paintSheet(){
  var it=BC.state.idx[sk];if(!it)return;
  var multi=it.p.length>1,so=it.status==='soldout',can=canOrder&&!so;
  var opts=multi?'<div class="opts">'+it.p.map(function(p,s){return '<button type="button" data-sz="'+s+'" class="'+(s===ss?'on':'')+'"><span>'+esc((it.z&&it.z[s])||(s?'22oz':'16oz'))+'</span><b>'+peso(p)+'</b></button>'}).join('')+'</div>':'';
  $('#sheetBox').innerHTML='<button class="sx" data-close="1" aria-label="Close">×</button>'+
    (it.img?'<img class="simg" src="'+esc(it.img)+'" alt="'+esc(it.n)+'">':'<div class="simg noimg"><span>'+initial(it.n)+'</span></div>')+
    '<div class="sbody"><h3>'+esc(it.n)+'</h3>'+soldHtml(BC.soldOf(it.n),true)+(it.d?'<p class="hint">'+esc(it.d)+'</p>':'')+opts+
    (can?'<div class="srow"><div class="qty big"><button type="button" data-sq="-1" aria-label="Less">'+ICON.minus+'</button><b>'+sq+'</b><button type="button" data-sq="1" aria-label="More">'+ICON.plus+'</button></div><button type="button" class="obtn" id="sAdd">Add to cart · '+peso(it.p[ss]*sq)+'</button></div>':'<p class="hint">'+(so?'This item is sold out right now.':'Ordering isn’t available right now.')+'</p>')+'</div>';
}
$('#sheet').addEventListener('click',function(e){
  if(e.target.closest('[data-close]')){closeSheet();return}
  var z=e.target.closest('[data-sz]');if(z){ss=+z.dataset.sz;paintSheet();return}
  var q=e.target.closest('[data-sq]');if(q){sq=Math.max(1,Math.min(20,sq+(+q.dataset.sq)));paintSheet();return}
  if(e.target.closest('#sAdd')){BC.qty(sk+'#'+ss,sq);closeSheet()}
});

/* ---------- cart ---------- */
function thumb(it){return it.img?'<img class="cthumb" src="'+esc(it.img)+'" alt="">':'<span class="cthumb noimg">'+initial(it.n)+'</span>'}
function renderReview(){
  var S=BC.state,ids=Object.keys(S.cart).filter(function(id){return S.idx[S.cart[id].k]});
  if(!ids.length){$('#reviewList').innerHTML='<p class="hint">Your cart is empty. <a href="#" id="backToMenu">Browse the menu</a></p>';$('#toDetails').disabled=true;return}
  $('#toDetails').disabled=false;
  $('#reviewList').innerHTML=ids.map(function(id){
    var l=S.cart[id],it=S.idx[l.k],lab=it.p.length>1?((it.z&&it.z[l.s])||''):'';
    return '<div class="cl">'+thumb(it)+'<div class="clb"><b>'+esc(it.n)+'</b><span class="hint">'+(lab?esc(lab)+' · ':'')+peso(it.p[l.s])+' each</span><div class="qty"><button type="button" data-act="d" data-id="'+esc(id)+'" data-d="-1" aria-label="Less">'+ICON.minus+'</button><b>'+l.q+'</b><button type="button" data-act="d" data-id="'+esc(id)+'" data-d="1" aria-label="More">'+ICON.plus+'</button></div></div><span class="qp">'+peso(it.p[l.s]*l.q)+'</span></div>';
  }).join('')+'<div class="rtotal"><span>Total</span><span>'+peso(BC.totals().total)+'</span></div>';
}
$('#reviewList').addEventListener('click',function(e){if(e.target.id==='backToMenu'){e.preventDefault();go(1)}});
$('#cbGo').onclick=function(){renderReview();go(2)};
$('#bk2').onclick=function(){go(1)};
$('#bk3').onclick=function(){renderReview();go(2)};
$('#toDetails').onclick=function(){if(!canOrder||!BC.totals().count)return;prepDetails();go(3)};

/* ---------- checkout ---------- */
function methods(){
  var s=settings||{},m=[];
  if(s.pay_gcash!==false)m.push({id:'gcash',l:'GCash'});
  if(s.pay_maya)m.push({id:'maya',l:'Maya'});
  if(s.pay_cash!==false)m.push({id:'cash',l:'Pay at the counter'});
  return m.length?m:[{id:'gcash',l:'GCash'}];
}
/* Pay-at-the-counter rules (set in Staff > Store & payments; the database enforces them too) */
var cashLock=false; /* turns on if the server says this number can't use counter payment */
function counterRules(){var s=settings||{},mx=Number(s.counter_max_total);return {on:s.counter_window_min!=null,max:mx>0?mx:300,win:Number(s.counter_window_min)||20}}
function paintMethods(){
  var m=methods(),R=counterRules(),total=BC.totals().total,hasOther=m.some(function(x){return x.id!=='cash'}),lockMsg='';
  if(hasOther){if(cashLock)lockMsg='Not available';else if(total>R.max)lockMsg='Up to '+peso(R.max)}
  m.forEach(function(x){x.off=x.id==='cash'&&!!lockMsg;x.sub=x.off?lockMsg:''});
  if(!m.some(function(x){return x.id===payMethod&&!x.off})){var f=m.filter(function(x){return !x.off})[0];payMethod=(f||m[0]).id}
  $('#paym').innerHTML=m.map(function(x){return '<button type="button" data-m="'+x.id+'" class="'+(x.id===payMethod?'on':'')+'"'+(x.off?' disabled':'')+'>'+ICON[x.id]+'<span>'+esc(x.l)+'</span>'+(x.sub?'<small>'+esc(x.sub)+'</small>':'')+'</button>'}).join('');
  var note;
  if(payMethod==='cash'){
    note='You’ll pay at the counter first, then we prepare your order. '+(R.on?'Please pay within '+R.win+' minutes or the order is cancelled automatically. ':'')+'Counter payment is for orders up to '+peso(R.max)+'.';
  }else{
    note='You’ll get the payment details and a reference number on the next screen.';
    if(m.some(function(x){return x.id==='cash'})&&total>R.max&&!cashLock)note+=' Pay at the counter is only for orders up to '+peso(R.max)+'.';
    if(cashLock)note+=' Pay at the counter isn’t available for your number right now.';
  }
  $('#payNote').textContent=note;
  $('#toPay').textContent=payMethod==='cash'?'Place order':'Continue to payment →';
}
$('#paym').addEventListener('click',function(e){var b=e.target.closest('button');if(!b||b.disabled)return;payMethod=b.dataset.m;paintMethods()});
function paintSummary(){
  var S=BC.state,ids=Object.keys(S.cart).filter(function(id){return S.idx[S.cart[id].k]});
  $('#sumBox').innerHTML=ids.map(function(id){var l=S.cart[id],it=S.idx[l.k],lab=it.p.length>1?((it.z&&it.z[l.s])||''):'';return '<div class="qrow sline"><span>'+l.q+' × '+esc(it.n)+(lab?' <span class="hint">('+esc(lab)+')</span>':'')+'</span><b>'+peso(it.p[l.s]*l.q)+'</b></div>'}).join('')+'<div class="rtotal"><span>Total</span><span>'+peso(BC.totals().total)+'</span></div>';
}
function prepDetails(){
  var ok=BC.dineOpen(settings);
  $('[data-t="dine_in"]').disabled=!ok;
  $('#dineNote').textContent=ok?'':('Dine in isn’t available right now'+(settings&&settings.dine_in_reason?': '+settings.dine_in_reason:'')+(settings&&settings.dine_in_reopen_at?'. Back '+BC.fmtWhen(settings.dine_in_reopen_at):'')+'. Pickup is still open.');
  if(!ok&&orderType==='dine_in')setType('pickup');
  paintMethods();paintSummary();
}
function setType(t){orderType=t;$$('#typeSeg button').forEach(function(b){b.classList.toggle('on',b.dataset.t===t)});$('#seatsWrap').hidden=t!=='dine_in'}
$('#typeSeg').addEventListener('click',function(e){var b=e.target.closest('button');if(b&&!b.disabled)setType(b.dataset.t)});

var ERR={STORE_CLOSED:'Sorry, the store just closed. Please try again later.',DINE_IN_UNAVAILABLE:'Dine in just became unavailable. Please choose Pickup.',ITEM_UNAVAILABLE:'An item in your order is no longer available. Please go back and review your cart.',BAD_NAME:'Please enter your full name.',BAD_MOBILE:'Please enter a valid mobile number (09XXXXXXXXX).',BAD_QTY:'Please check the quantities in your cart.',BAD_ITEMS:'Your cart is empty.',BAD_SIZE:'Please review your cart.',BAD_METHOD:'That payment method isn’t available right now. Please choose another.'};
function errText(e){var m=(e&&e.message)||'';
  if(m.indexOf('COUNTER_LIMIT')>-1)return 'Pay at the counter is only for orders up to '+peso(counterRules().max)+'. Please choose GCash or Maya for this order.';
  if(m.indexOf('COUNTER_UNPAID')>-1)return 'You already have an unpaid counter order. Please pay for it at the counter first, or choose GCash or Maya for this one.';
  if(m.indexOf('COUNTER_BLOCKED')>-1)return 'Pay at the counter isn’t available for this number right now because earlier counter orders weren’t paid. Please choose GCash or Maya.';
  for(var k in ERR){if(m.indexOf(k)>-1)return ERR[k]}if(/place_order/.test(m)&&/function|schema cache/i.test(m))return 'The ordering system needs its database update (supabase-update-v2.sql). Please tell the shop.';return 'Something went wrong. Please check your connection and try again.'}

$('#detailsForm').addEventListener('submit',function(e){
  e.preventDefault();
  var name=$('#fName').value.trim(),mobile=$('#fMobile').value.replace(/\s|-/g,''),err=$('#formErr');err.textContent='';
  if(name.length<2){err.textContent='Please enter your full name.';return}
  if(!/^09\d{9}$/.test(mobile)){err.textContent='Please enter a valid mobile number (09XXXXXXXXX).';return}
  var seats=parseInt($('#fSeats').value,10);
  if(orderType==='dine_in'&&!(seats>=1&&seats<=20)){err.textContent='Please enter how many seats you need (1–20).';return}
  if(!$('#fConsent').checked){err.textContent='Please tick the box to continue.';return}
  var btn=$('#toPay');btn.disabled=true;btn.textContent='Please wait…';
  var S=BC.state,items=Object.keys(S.cart).map(function(id){var l=S.cart[id];return {k:l.k,s:l.s,q:l.q}});
  sb.rpc('place_order',{p_name:name,p_mobile:mobile,p_instructions:$('#fNote').value.trim(),p_type:orderType,p_seats:orderType==='dine_in'?seats:null,p_arrival:$('#fArrive').value,p_items:items,p_method:payMethod}).then(function(r){
    btn.disabled=false;paintMethods();
    if(r.error||!r.data||!r.data.length){
      err.textContent=errText(r.error);
      if(r.error&&/COUNTER_(UNPAID|BLOCKED)/.test(r.error.message||'')){cashLock=true;paintMethods()}
      return;
    }
    var row=r.data[0];
    info={ref:row.order_ref,total:Number(row.order_total),mobile:mobile,method:payMethod,created:Date.now()};
    try{localStorage.setItem(STORE_KEY,JSON.stringify(info))}catch(x){}
    S.cart={};BC.setCart({});updateBar();refreshCtl();
    if(payMethod==='cash'){showDone('pay_at_counter')}else{showPayment()}
  });
});

/* ---------- payment (GCash / Maya) ---------- */
function showPayment(){
  var s=settings||{},m=info.method||'gcash',label=m==='maya'?'Maya':'GCash';
  $('#payTitle').textContent='Pay via '+label;$('#proofLbl').textContent=label;
  $('#payHow').textContent='Open '+label+' → Send Money → enter the number above → exact amount → type your reference number in the note → Send.';
  $('#gNum').textContent=(m==='maya'?s.maya_number:s.gcash_number)||'';
  $('#gName').textContent=(m==='maya'?s.maya_name:s.gcash_name)||'';
  var qr=(m==='maya'?s.maya_qr:s.gcash_qr)||'';$('#payQr').hidden=!qr;if(qr)$('#payQr').src=qr;
  $('#gAmt').textContent=peso(info.total);$('#refNo').textContent=info.ref;
  $('#payErr').textContent='';$('#proof').value='';proofBlob=null;$('#proofPrev').hidden=true;$('#paid').disabled=true;
  go(4);
}
$('#proof').addEventListener('change',function(){
  var f=this.files&&this.files[0];proofBlob=null;$('#paid').disabled=true;$('#proofPrev').hidden=true;
  if(!f)return;
  if(!/^image\//.test(f.type)||f.size>25*1024*1024){$('#payErr').textContent='Please choose an image (screenshot) under 25 MB.';return}
  $('#payErr').textContent='';
  BC.compress(f,1400,function(b){
    if(!b){$('#payErr').textContent='That image could not be read. Please try another one.';return}
    proofBlob=b;$('#proofPrev').src=URL.createObjectURL(b);$('#proofPrev').hidden=false;$('#paid').disabled=false;
  });
});
$('#paid').onclick=function(){
  if(!proofBlob||!info)return;
  var btn=this;btn.disabled=true;btn.textContent='Sending…';$('#payErr').textContent='';
  var path=info.ref+'/'+BC.uid()+'.jpg';
  sb.storage.from('payment-proofs').upload(path,proofBlob,{contentType:'image/jpeg',upsert:false}).then(function(u){
    if(u.error)throw u.error;
    return sb.rpc('attach_proof',{p_ref:info.ref,p_mobile:info.mobile,p_path:path});
  }).then(function(r){
    if(r.error||r.data!==true)throw (r.error||new Error('attach'));
    btn.textContent='✓ I’ve sent the payment';showDone('awaiting_verification');
  }).catch(function(){
    btn.disabled=false;btn.textContent='✓ I’ve sent the payment';
    $('#payErr').textContent='We couldn’t send your screenshot. Please check your connection and try again.';
  });
};

/* ---------- done ---------- */
var LABEL={awaiting_payment:'Waiting for payment',awaiting_verification:'Payment under review',pay_at_counter:'Pay at the counter',paid:'Payment confirmed',preparing:'Being prepared',ready:'Ready!',done:'Completed',cancelled:'Cancelled'};
var MSG={awaiting_payment:'Please complete your payment and attach your screenshot.',awaiting_verification:'Thanks! We’re checking your payment. Keep this reference number.',pay_at_counter:'Please go to the counter, show this reference number and pay. We start preparing your order once payment is received.',paid:'Your payment is confirmed. We’ll start on your order shortly.',preparing:'Your order is being prepared.',ready:'Your order is ready. We’ll call your name!',done:'Thank you for ordering from Nalla’s Nook!',cancelled:'This order was cancelled. Please contact the shop if you have questions.'};
function showDone(s){$('#doneRef').textContent=info.ref;setStatus(s);go(5);clearInterval(pollT);pollT=setInterval(poll,12000);if(s==='pay_at_counter')startCd()}
function setStatus(s){
  if(s!=='pay_at_counter')stopCd();
  var msg=MSG[s]||'';
  if(s==='cancelled'&&info&&info.method==='cash')msg='This order was cancelled because it wasn’t paid at the counter in time. You’re welcome to place a new order.';
  $('#doneStatus').textContent=LABEL[s]||s;$('#doneMsg').textContent=msg;
}
/* countdown for pay-at-the-counter orders */
var cdT=null;
function stopCd(){clearInterval(cdT);cdT=null;var e=$('#doneTimer');if(e)e.hidden=true}
function startCd(){
  stopCd();var R=counterRules(),e=$('#doneTimer');
  if(!e||!R.on||!info||info.method!=='cash'||!info.created)return;
  var end=info.created+R.win*60000;
  function tick(){
    var left=end-Date.now();
    if(left<=0){stopCd();expireNow();return}
    var m=Math.floor(left/60000),s=Math.floor(left%60000/1000);
    e.hidden=false;e.classList.toggle('low',left<120000);
    e.innerHTML='<span>Please pay within</span><b>'+m+':'+(s<10?'0':'')+s+'</b>';
  }
  tick();cdT=setInterval(tick,1000);
}
function expireNow(){
  if(!info||!sb)return;
  Promise.resolve(sb.rpc('expire_counter_orders')).catch(function(){}).then(function(){
    return sb.rpc('order_status',{p_ref:info.ref,p_mobile:info.mobile});
  }).then(function(r){if(r&&!r.error&&r.data)setStatus(r.data)});
}
function poll(){if(!info||step!==5)return;sb.rpc('order_status',{p_ref:info.ref,p_mobile:info.mobile}).then(function(r){if(!r.error&&r.data)setStatus(r.data)})}
$('#newOrder').onclick=function(){clearInterval(pollT);stopCd();try{localStorage.removeItem(STORE_KEY)}catch(e){};info=null;go(1)};

/* ---------- start ---------- */
function resume(){
  var saved=null;try{saved=JSON.parse(localStorage.getItem(STORE_KEY)||'null')}catch(e){}
  if(!saved||!saved.ref||!sb)return Promise.resolve(false);
  /* if this was a counter order, let the database cancel it first if its pay window has passed */
  var pre=saved.method==='cash'?Promise.resolve(sb.rpc('expire_counter_orders')).catch(function(){}):Promise.resolve();
  return pre.then(function(){return sb.rpc('order_status',{p_ref:saved.ref,p_mobile:saved.mobile})}).then(function(r){
    if(r.error)return false;
    if(!r.data){try{localStorage.removeItem(STORE_KEY)}catch(e){}return false}
    info=saved;
    if(r.data==='awaiting_payment'&&info.method!=='cash'){showPayment()}else{showDone(r.data)}
    return true;
  });
}
function paint(menu){
  BC.setMenu(menu,canOrder);renderRail();renderMenu();updateBar();
  /* fetch purchase counts after the menu is already on screen, then repaint once */
  BC.loadSales().then(function(has){if(has&&step===1)renderMenu()});
}
function start(){
  go(1);
  if(!BC.hasCfg||!BC.libOk||!sb){
    notice('Online ordering isn’t switched on yet. You can browse the menu below.','warn');
    BC.load().then(function(res){canOrder=false;paint(res.menu)});return;
  }
  BC.load().then(function(res){
    settings=res.settings;online=res.online;
    if(!online){
      canOrder=false;
      notice(res.failed?'We can’t reach the ordering service right now. Please try again in a moment.':'Online ordering isn’t switched on yet. You can browse the menu below.','warn');
      paint(res.menu);return;
    }
    canOrder=BC.isOpen(settings);
    if(!canOrder){notice('<b>We’re closed for online orders right now.</b>'+(settings.store_message?'<br>'+esc(settings.store_message):'')+(settings.store_reopen_at?'<br>Back '+esc(BC.fmtWhen(settings.store_reopen_at))+'.':''),'warn')}
    paint(res.menu);
    resume().then(function(resumed){
      if(!resumed&&canOrder&&/step=review/.test(location.search)&&BC.totals().count){renderReview();go(2)}
    });
  });
}
start();
})();
