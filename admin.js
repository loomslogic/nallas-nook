(function(){
'use strict';
window.__adminLoaded=true;
if(!window.BC){var __n=document.getElementById('notice');if(__n)__n.innerHTML='<div class="notice warn">shop.js did not load. Upload shop.js to the same folder as this page, then reload.</div>';return}

document.title='Staff · Lazy Cup';
var BC=window.BC,$=function(s){return document.querySelector(s)},$$=function(s){return [].slice.call(document.querySelectorAll(s))};
var peso=BC.peso,esc=BC.esc;
function notice(t,c){$('#notice').innerHTML=t?'<div class="notice '+(c||'ok')+'">'+t+'</div>':''}
window.addEventListener('error',function(e){notice('Script error: '+esc(e.message||'unknown'),'warn')});
if(!BC.hasCfg){notice('Add your Supabase Project URL and key to <b>config.js</b> (and make sure config.js is uploaded next to admin.html).','warn');return}
if(!BC.libOk){notice('The Supabase library did not load. Check your internet connection and reload.','warn');return}
if(!BC.sb){notice('Problem with the details in <b>config.js</b>: '+esc(BC.err)+'.','warn');return}
var sb=BC.sb;
var st=null,rows=[],ms={},orig={},orders=[],ofilter='active',timer=null;
var editKey=null,editImage='',newBlob=null,qrBusy=false;
function bool(v,d){return v===undefined||v===null?d:!!v}

/* ---------- login ---------- */
function show(session){
  clearInterval(timer);
  if(!session){$('#login').hidden=false;$('#panel').hidden=true;$('#signedIn').hidden=true;return}
  sb.rpc('am_i_staff').then(function(r){
    if(r.error||r.data!==true){notice('This account is not a staff account.','warn');sb.auth.signOut();return}
    notice('');$('#login').hidden=true;$('#panel').hidden=false;$('#signedIn').hidden=false;
    loadOrders();loadStore();loadMenu();
    timer=setInterval(function(){if(!document.hidden&&$('#t-orders').hidden===false)loadOrders()},15000);
  });
}
sb.auth.getSession().then(function(r){show(r.data.session)});
sb.auth.onAuthStateChange(function(ev){if(ev==='SIGNED_OUT')show(null)});
$('#doLogin').onclick=function(){
  var b=this;b.disabled=true;$('#loginErr').textContent='';
  sb.auth.signInWithPassword({email:$('#aEmail').value.trim(),password:$('#aPass').value}).then(function(r){
    b.disabled=false;
    if(r.error){var m=r.error.message||'';$('#loginErr').textContent=/confirm/i.test(m)?'This email is not confirmed yet. In Supabase open Authentication → Users, delete this user and add it again with “Auto Confirm User” ticked.':(/invalid login/i.test(m)?'Wrong email or password, or this user does not exist yet in Supabase (Authentication → Users).':'Could not sign in: '+m);return}
    $('#aPass').value='';show(r.data.session);
  });
};
$('#aPass').addEventListener('keydown',function(e){if(e.key==='Enter')$('#doLogin').click()});
$('#signOut').onclick=function(){sb.auth.signOut().then(function(){show(null)})};

/* ---------- tabs ---------- */
$('#tabs').addEventListener('click',function(e){
  var b=e.target.closest('.chip');if(!b)return;
  $$('#tabs .chip').forEach(function(x){x.classList.toggle('on',x===b)});
  $$('.atab').forEach(function(t){t.hidden=t.id!=='t-'+b.dataset.t});
  if(b.dataset.t==='orders')loadOrders();
});

/* ---------- orders ---------- */
var LABEL={awaiting_payment:'Waiting for payment',awaiting_verification:'Verify payment',pay_at_counter:'Pay at counter',paid:'Paid',preparing:'Preparing',ready:'Ready',done:'Done',cancelled:'Cancelled'};
var METHOD={gcash:'GCash',maya:'Maya',cash:'Pay at counter'};
function loadOrders(){
  /* first let the database cancel counter orders whose pay window has passed (ignored if the SQL isn't installed yet) */
  Promise.resolve(sb.rpc('expire_counter_orders')).catch(function(){}).then(function(){
    return sb.from('orders').select('*').order('id',{ascending:false}).limit(100);
  }).then(function(r){
    if(r.error){$('#orders').innerHTML='<p class="hint">Could not load orders.</p>';return}
    orders=r.data||[];renderOrders();
  });
}
function renderOrders(){
  var list=orders.filter(function(o){return ofilter==='all'||(o.status!=='done'&&o.status!=='cancelled')});
  /* unpaid counter orders float to the top so they are never missed */
  list=list.filter(function(o){return o.status==='pay_at_counter'}).concat(list.filter(function(o){return o.status!=='pay_at_counter'}));
  var pending=orders.filter(function(o){return o.status==='awaiting_verification'||o.status==='pay_at_counter'}).length;
  $('#badge').textContent=pending||'';
  if(!list.length){$('#orders').innerHTML='<p class="hint">No orders yet.</p>';return}
  $('#orders').innerHTML=list.map(function(o){
    var t=new Date(o.created_at).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    var items=(o.items||[]).map(function(i){return '<li>'+i.qty+' × '+esc(i.name)+(i.size?' ('+esc(i.size)+')':'')+' — '+peso(i.price*i.qty)+'</li>'}).join('');
    var btns=[];
    if(o.proof_path)btns.push('<button data-a="proof" data-p="'+esc(o.proof_path)+'">View screenshot</button>');
    var counter=o.status==='pay_at_counter';
    if(o.status==='awaiting_verification'||o.status==='awaiting_payment'||counter)btns.push('<button class="main" data-a="s" data-id="'+o.id+'" data-s="paid"'+(counter?' data-cash="'+Number(o.total)+'"':'')+'>'+(counter?'Cash received · mark paid':'Mark paid')+'</button>');
    if(o.status==='paid')btns.push('<button class="main" data-a="s" data-id="'+o.id+'" data-s="preparing">Start preparing</button>');
    if(o.status==='preparing')btns.push('<button class="main" data-a="s" data-id="'+o.id+'" data-s="ready">Mark ready</button>');
    if(o.status==='ready')btns.push('<button class="main" data-a="s" data-id="'+o.id+'" data-s="done">Mark done</button>');
    if(o.status!=='done'&&o.status!=='cancelled')btns.push('<button data-a="s" data-id="'+o.id+'" data-s="cancelled">Cancel</button>');
    var win=st?Number(st.counter_window_min)||0:0,end=counter&&win?new Date(o.created_at).getTime()+win*60000:0;
    var bar=counter?'<div class="unpaidbar"><b>UNPAID</b><span>Collect '+peso(o.total)+' cash before preparing</span>'+(end?'<span class="cd" data-end="'+end+'"></span>':'')+'</div>':'';
    var pill=(o.status==='cancelled'&&o.expired_at)?'Expired · not paid':(LABEL[o.status]||o.status);
    return '<div class="card ocard'+(counter?' unpaid':'')+'"><div class="ohead"><b>#'+esc(o.ref)+' · '+esc(o.customer_name)+'</b><span class="pill">'+esc(pill)+'</span></div>'+bar+
      '<div class="hint">'+t+' · <a href="tel:'+esc(o.mobile)+'">'+esc(o.mobile)+'</a> · '+(o.order_type==='dine_in'?'Dine in ('+(o.seats||'?')+' seats)':'Pickup')+(o.arrival?' · '+esc(o.arrival):'')+' · '+esc(METHOD[o.payment_method]||'GCash')+'</div>'+
      '<ul>'+items+'</ul>'+(o.instructions?'<div class="hint">Note: '+esc(o.instructions)+'</div>':'')+
      '<div class="rtotal"><span>Total</span><span>'+peso(o.total)+'</span></div><div class="btnrow">'+btns.join('')+'</div></div>';
  }).join('');
  tickCd();
}
function tickCd(){$$('#orders .cd').forEach(function(e){var left=+e.dataset.end-Date.now();e.textContent=left>0?Math.ceil(left/60000)+' min left':'expiring…';e.classList.toggle('low',left<180000)})}
setInterval(tickCd,10000);
$('#ofilter').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;ofilter=b.dataset.f;$$('#ofilter button').forEach(function(x){x.classList.toggle('on',x===b)});renderOrders()});
$('#orders').addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;
  if(b.dataset.a==='proof'){
    sb.storage.from('payment-proofs').createSignedUrl(b.dataset.p,120).then(function(r){if(r.data&&r.data.signedUrl)window.open(r.data.signedUrl,'_blank');else alert('Could not open the screenshot.')});
  }else if(b.dataset.a==='s'){
    if(b.dataset.s==='cancelled'&&!confirm('Cancel this order?'))return;
    if(b.dataset.cash&&!confirm('Did you receive '+peso(+b.dataset.cash)+' in cash for this order?'))return;
    b.disabled=true;
    sb.from('orders').update({status:b.dataset.s}).eq('id',+b.dataset.id).then(function(r){if(r.error)alert('Could not update the order.');loadOrders()});
  }
});

/* ---------- store + payment settings ---------- */
function uploadMedia(blob,folder){
  var path=folder+'/'+BC.uid()+'.jpg';
  return sb.storage.from('shop-media').upload(path,blob,{contentType:'image/jpeg',upsert:false}).then(function(r){
    if(r.error)throw r.error;
    return sb.storage.from('shop-media').getPublicUrl(path).data.publicUrl;
  });
}
function loadStore(){
  sb.from('settings').select('*').eq('id',1).maybeSingle().then(function(r){
    if(r.error||!r.data){$('#storeMsg').textContent='Could not load settings.';return}
    st=r.data;paintStore();$('#storeMsg').textContent='Loaded from server';
  });
}
function when(iso){return iso?'Back '+new Date(iso).toLocaleString('en-PH',{weekday:'short',hour:'numeric',minute:'2-digit'}):'No time set'}
function seg(sel,val){$$(sel+' button').forEach(function(b){b.classList.toggle('on',(b.dataset.v==='1')===!!val)})}
function paintQr(id,btn,url){$(id).hidden=!url;if(url)$(id).src=url;$(btn).hidden=!url}
function paintStore(){
  seg('#openSeg',st.store_open);seg('#dineSeg',st.dine_in_available);
  seg('#pgSeg',bool(st.pay_gcash,true));seg('#pmSeg',bool(st.pay_maya,false));seg('#pcSeg',bool(st.pay_cash,true));
  $('#sMsg').value=st.store_message||'';$('#dReason').value=st.dine_in_reason||'';
  $('#gNumIn').value=st.gcash_number||'';$('#gNameIn').value=st.gcash_name||'';
  $('#mNumIn').value=st.maya_number||'';$('#mNameIn').value=st.maya_name||'';
  paintQr('#gQrImg','#gQrClear',st.gcash_qr);paintQr('#mQrImg','#mQrClear',st.maya_qr);
  var hasRules='counter_window_min' in st;
  ['#cMax','#cWin','#cBlock'].forEach(function(s){$(s).disabled=!hasRules});
  if(hasRules){$('#cMax').value=st.counter_max_total!=null?st.counter_max_total:300;$('#cWin').value=st.counter_window_min!=null?st.counter_window_min:20;$('#cBlock').value=st.counter_block_after!=null?st.counter_block_after:2;$('#cNote').textContent=''}
  else $('#cNote').textContent='These rules are switched off until you run supabase-counter-safety.sql in Supabase (SQL Editor).';
  $('#sWhen').textContent=when(st.store_reopen_at);$('#dWhen').textContent=when(st.dine_in_reopen_at);
}
$$('.quick').forEach(function(q){
  q.innerHTML=['+1 hr','+2 hrs','+4 hrs','Tomorrow 8am','Clear'].map(function(l){return '<button type="button">'+l+'</button>'}).join('');
  q.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b||!st)return;
    var d=new Date(),t=b.textContent,v=null;
    if(t==='+1 hr'){d.setHours(d.getHours()+1);v=d}else if(t==='+2 hrs'){d.setHours(d.getHours()+2);v=d}else if(t==='+4 hrs'){d.setHours(d.getHours()+4);v=d}else if(t==='Tomorrow 8am'){d.setDate(d.getDate()+1);d.setHours(8,0,0,0);v=d}
    var iso=v?v.toISOString():null;
    if(q.dataset.for==='store')st.store_reopen_at=iso;else st.dine_in_reopen_at=iso;
    paintStore();
  });
});
function bindSeg(sel,field){$(sel).addEventListener('click',function(e){var b=e.target.closest('button');if(!b||!st)return;st[field]=b.dataset.v==='1';paintStore()})}
bindSeg('#openSeg','store_open');bindSeg('#dineSeg','dine_in_available');bindSeg('#pgSeg','pay_gcash');bindSeg('#pmSeg','pay_maya');bindSeg('#pcSeg','pay_cash');
function bindQr(fileSel,clearSel,field){
  $(fileSel).addEventListener('change',function(){
    var f=this.files&&this.files[0];if(!f||!st)return;
    $('#storeMsg').textContent='Uploading QR…';
    BC.compress(f,800,function(b){
      if(!b){$('#storeMsg').textContent='That image could not be read.';return}
      uploadMedia(b,'qr').then(function(url){st[field]=url;paintStore();$('#storeMsg').textContent='QR uploaded. Tap Save changes to keep it.'})
      .catch(function(){$('#storeMsg').textContent='Upload failed. Run supabase-update-v2.sql first, then try again.'});
    });
  });
  $(clearSel).onclick=function(){if(st){st[field]='';paintStore()}};
}
bindQr('#gQrFile','#gQrClear','gcash_qr');bindQr('#mQrFile','#mQrClear','maya_qr');
$('#saveStore').onclick=function(){
  if(!st)return;var b=this;b.disabled=true;
  var row={store_open:st.store_open,store_message:$('#sMsg').value.trim(),store_reopen_at:st.store_reopen_at||null,dine_in_available:st.dine_in_available,dine_in_reason:$('#dReason').value.trim(),dine_in_reopen_at:st.dine_in_reopen_at||null,
    gcash_number:$('#gNumIn').value.trim(),gcash_name:$('#gNameIn').value.trim(),maya_number:$('#mNumIn').value.trim(),maya_name:$('#mNameIn').value.trim(),
    pay_gcash:bool(st.pay_gcash,true),pay_maya:bool(st.pay_maya,false),pay_cash:bool(st.pay_cash,true),gcash_qr:st.gcash_qr||'',maya_qr:st.maya_qr||''};
  if('counter_window_min' in st){
    var cm=parseFloat($('#cMax').value),cw=parseInt($('#cWin').value,10),cb=parseInt($('#cBlock').value,10);
    if(!(cm>=50)||!(cw>=5&&cw<=120)||!(cb>=0&&cb<=10)){b.disabled=false;$('#storeMsg').textContent='Counter rules: max amount must be at least 50, pay window 5–120 minutes, block 0–10.';return}
    row.counter_max_total=cm;row.counter_window_min=cw;row.counter_block_after=cb;
  }
  sb.from('settings').update(row).eq('id',1).select().then(function(r){
    b.disabled=false;
    if(r.error||!r.data||!r.data.length){$('#storeMsg').textContent='Could not save. Run supabase-update-v2.sql first, and make sure you are signed in as staff.';return}
    st=r.data[0];paintStore();$('#storeMsg').textContent='Saved ✓';
  });
};
$('#discardStore').onclick=loadStore;

/* ---------- menu items ---------- */
function loadMenu(){
  sb.from('menu_items').select('*').limit(1000).then(function(r){
    if(r.error){$('#menuMsg').textContent='Could not load the menu. Run supabase-update-v2.sql first.';return}
    rows=r.data||[];ms={};orig={};rows.forEach(function(x){ms[x.key]=x.status;orig[x.key]=x.status});
    var cats=BC.group(rows).map(function(m){return m.c}),sel=$('#mCat'),cur=sel.value||'all';
    sel.innerHTML='<option value="all">All categories</option>'+cats.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>'}).join('');
    sel.value=cats.indexOf(cur)>-1?cur:'all';
    $('#catList').innerHTML=cats.map(function(c){return '<option value="'+esc(c)+'">'}).join('');
    paintMenu();$('#menuMsg').textContent='Loaded from server';
  });
}
function paintMenu(){
  var c=$('#mCat').value,groups=BC.group(rows);
  $('#mList').innerHTML=groups.map(function(m){
    if(c!=='all'&&m.c!==c)return '';
    return '<h3 class="cathead">'+esc(m.c)+'</h3>'+m.i.map(function(i){
      var s=ms[i.key]||'on',pr=i.p.length>1?peso(i.p[0])+' / '+peso(i.p[1]):peso(i.p[0]);
      return '<div class="card arow"><div class="ainfo">'+(i.img?'<img class="thumb sm" src="'+esc(i.img)+'" alt="">':'<span class="thumb sm empty"></span>')+'<div><b>'+esc(i.n)+'</b><div class="hint">'+pr+(i.custom?' · added by you':'')+'</div></div></div>'+
        '<div class="arow-r"><div class="seg" data-key="'+esc(i.key)+'">'+['on:On','soldout:Sold out','removed:Remove'].map(function(o){var p=o.split(':');return '<button data-v="'+p[0]+'" class="'+(s===p[0]?'on':'')+'">'+p[1]+'</button>'}).join('')+'</div><button class="editbtn" data-edit="'+esc(i.key)+'">Edit</button></div></div>';
    }).join('');
  }).join('');
}
$('#mCat').onchange=paintMenu;
$('#mList').addEventListener('click',function(e){
  var ed=e.target.closest('[data-edit]');
  if(ed){openForm(ed.getAttribute('data-edit'));return}
  var b=e.target.closest('.seg button'),sg=e.target.closest('.seg');if(!b||!sg)return;
  ms[sg.dataset.key]=b.dataset.v;[].forEach.call(sg.children,function(x){x.classList.toggle('on',x===b)});
});
$('#saveMenu').onclick=function(){
  var b=this,keys=Object.keys(ms).filter(function(k){return ms[k]!==orig[k]});
  if(!keys.length){$('#menuMsg').textContent='No changes to save.';return}
  b.disabled=true;
  Promise.all(keys.map(function(k){return sb.from('menu_items').update({status:ms[k],updated_at:new Date().toISOString()}).eq('key',k)})).then(function(res){
    b.disabled=false;
    var bad=res.some(function(r){return r.error});
    $('#menuMsg').textContent=bad?'Some changes could not be saved. Check that you are signed in as staff.':'Saved ✓';
    if(!bad)loadMenu();
  });
};
$('#discardMenu').onclick=loadMenu;

/* add / edit item form */
function openForm(key){
  editKey=key;newBlob=null;$('#iErr').textContent='';$('#iFile').value='';
  var r=key?rows.filter(function(x){return x.key===key})[0]:null;
  $('#formTitle').textContent=r?'Edit item':'Add item';
  $('#iName').value=r?r.name:'';$('#iCat').value=r?r.category:($('#mCat').value!=='all'?$('#mCat').value:'');
  var p=r?r.prices:[],l=r?(r.labels||[]):[];
  $('#iP1').value=p[0]||'';$('#iP2').value=p[1]||'';$('#iL1').value=l[0]||'';$('#iL2').value=l[1]||'';
  $('#iDesc').value=r?(r.description||''):'';
  editImage=r?(r.image||''):'';paintImg();
  $('#deleteItem').hidden=!(r&&r.custom);
  $('#itemForm').hidden=false;$('#itemForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function paintImg(){var u=newBlob?URL.createObjectURL(newBlob):editImage;$('#iImg').hidden=!u;if(u)$('#iImg').src=u;$('#iImgClear').hidden=!u}
$('#addItem').onclick=function(){openForm(null)};
$('#cancelItem').onclick=function(){$('#itemForm').hidden=true};
$('#iFile').addEventListener('change',function(){
  var f=this.files&&this.files[0];if(!f)return;
  BC.compress(f,1000,function(b){if(!b){$('#iErr').textContent='That image could not be read. Try another photo.';return}newBlob=b;paintImg()});
});
$('#iImgClear').onclick=function(){newBlob=null;editImage='';$('#iFile').value='';paintImg()};
$('#saveItem').onclick=function(){
  var name=$('#iName').value.trim(),cat=$('#iCat').value.trim(),p1=parseFloat($('#iP1').value),p2=parseFloat($('#iP2').value),err=$('#iErr');err.textContent='';
  if(!name){err.textContent='Please enter the item name.';return}
  if(!cat){err.textContent='Please enter a category.';return}
  if(!(p1>0)){err.textContent='Please enter a price.';return}
  var two=p2>0,prices=two?[p1,p2]:[p1],labels=two?[$('#iL1').value.trim()||'16oz',$('#iL2').value.trim()||'22oz']:[];
  var key=editKey||(cat+'|'+name);
  if(!editKey&&rows.some(function(x){return x.key===key})){err.textContent='An item with this name already exists in that category.';return}
  var b=this;b.disabled=true;b.textContent='Saving…';
  var imgP=newBlob?uploadMedia(newBlob,'menu'):Promise.resolve(editImage);
  imgP.then(function(url){
    var base={category:cat,name:name,prices:prices,labels:labels,description:$('#iDesc').value.trim(),image:url||'',updated_at:new Date().toISOString()};
    if(editKey)return sb.from('menu_items').update(base).eq('key',editKey);
    var max=rows.reduce(function(m,x){return Math.max(m,x.sort||0)},0);
    base.key=key;base.status='on';base.sort=max+1;base.custom=true;
    return sb.from('menu_items').insert(base);
  }).then(function(r){
    b.disabled=false;b.textContent='Save item';
    if(r.error){err.textContent='Could not save: '+r.error.message;return}
    $('#itemForm').hidden=true;loadMenu();$('#menuMsg').textContent='Item saved ✓';
  }).catch(function(e){b.disabled=false;b.textContent='Save item';err.textContent='Photo upload failed. Run supabase-update-v2.sql first, then try again.'});
};
$('#deleteItem').onclick=function(){
  if(!editKey||!confirm('Delete this item for good?'))return;
  sb.from('menu_items').delete().eq('key',editKey).then(function(r){
    if(r.error){$('#iErr').textContent='Could not delete.';return}
    $('#itemForm').hidden=true;loadMenu();
  });
};

/* ---------- password ---------- */
$('#updPass').onclick=function(){
  var a=$('#pNew').value,c=$('#pNew2').value,err=$('#pErr');err.textContent='';err.style.color='';
  if(a.length<8){err.textContent='Use at least 8 characters.';return}
  if(a!==c){err.textContent='The two passwords don’t match.';return}
  sb.auth.updateUser({password:a}).then(function(r){
    if(r.error){err.textContent='Could not update the password. Please sign in again and retry.';return}
    $('#pNew').value='';$('#pNew2').value='';err.style.color='var(--accent)';err.textContent='Password updated ✓';
  });
};
})();
