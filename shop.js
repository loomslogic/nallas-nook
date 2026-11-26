/* Shared helpers for the website, the ordering page and the admin page */
(function(){
'use strict';
var cfg=window.SB||{};
function clean(u){u=String(u||'').trim();try{return new URL(u).origin}catch(e){return u.replace(/\/+$/,'')}}
var hasCfg=!!(cfg.url&&String(cfg.url).indexOf('YOUR-')<0&&cfg.key&&String(cfg.key).indexOf('YOUR-')<0);
var libOk=!!window.supabase,sb=null,err='';
if(hasCfg&&libOk){try{sb=window.supabase.createClient(clean(cfg.url),String(cfg.key).trim())}catch(e){err=e.message}}
var BC={sb:sb,hasCfg:hasCfg,libOk:libOk,err:err};
BC.peso=function(n){return '₱'+Number(n).toLocaleString('en-PH')};
BC.esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
BC.uid=function(){return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2)};
BC.fmtWhen=function(iso){try{return new Date(iso).toLocaleString('en-PH',{weekday:'short',hour:'numeric',minute:'2-digit'})}catch(e){return ''}};
BC.isOpen=function(s){if(!s)return true;return !!(s.store_open||(s.store_reopen_at&&new Date()>=new Date(s.store_reopen_at)))};
BC.dineOpen=function(s){if(!s)return true;return !!(s.dine_in_available||(s.dine_in_reopen_at&&new Date()>=new Date(s.dine_in_reopen_at)))};

/* image shrinker: makes phone photos small before uploading */
BC.compress=function(file,max,cb){
  var img=new Image(),url=URL.createObjectURL(file);
  img.onload=function(){
    var sc=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');
    c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    c.toBlob(function(b){URL.revokeObjectURL(url);cb(b)},'image/jpeg',0.82);
  };
  img.onerror=function(){URL.revokeObjectURL(url);cb(null)};
  img.src=url;
};

/* ---- cart (kept in the browser so it travels from the menu to the order page) ---- */
BC.CART='sbc_cart';
BC.getCart=function(){try{return JSON.parse(localStorage.getItem(BC.CART)||'{}')||{}}catch(e){return {}}};
BC.setCart=function(c){try{localStorage.setItem(BC.CART,JSON.stringify(c))}catch(e){}};
BC.state={menu:[],idx:{},cart:BC.getCart(),canOrder:false};
BC.setMenu=function(menu,canOrder){
  var S=BC.state;S.menu=menu;S.canOrder=canOrder;S.idx={};
  menu.forEach(function(m){m.i.forEach(function(i){S.idx[i.key]=i})});
  var ch=false;
  Object.keys(S.cart).forEach(function(id){var p=id.lastIndexOf('#'),it=S.idx[id.slice(0,p)];if(!it||+id.slice(p+1)>=it.p.length||it.status==='soldout'){delete S.cart[id];ch=true}});
  if(ch)BC.setCart(S.cart);
};
BC.totals=function(){var S=BC.state,n=0,t=0;Object.keys(S.cart).forEach(function(id){var l=S.cart[id],it=S.idx[l.k];if(it){n+=l.q;t+=it.p[l.s]*l.q}});return {count:n,total:t}};
BC.qty=function(id,d){
  var S=BC.state;if(!S.canOrder)return;
  var p=id.lastIndexOf('#'),k=id.slice(0,p),s=+id.slice(p+1),it=S.idx[k];
  if(!it||it.status==='soldout')return;
  var q=((S.cart[id]&&S.cart[id].q)||0)+d;if(q>20)q=20;
  if(q<=0)delete S.cart[id];else S.cart[id]={k:k,s:s,q:q};
  BC.setCart(S.cart);
  [].forEach.call(document.querySelectorAll('[data-qty]'),function(e){if(e.getAttribute('data-qty')===id)e.textContent=(S.cart[id]&&S.cart[id].q)||0});
  if(BC.onCart)BC.onCart();
};
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-act="d"]');if(b)BC.qty(b.getAttribute('data-id'),+b.getAttribute('data-d'))});

/* ---- menu loading: from Supabase when set up, otherwise from menu.js ---- */
function staticMenu(){
  var M=(typeof MENU!=='undefined'&&MENU)||[];
  if(window.ORDER_ONLY_PHOTOS!==false)M=M.map(function(m){return {c:m.c,i:m.i.filter(function(i){return i.img})}}).filter(function(m){return m.i.length});
  return M.map(function(m){return {c:m.c,i:m.i.map(function(i){return {key:m.c+'|'+i.n,n:i.n,p:i.p,z:i.p.length>1?(i.z||['16oz','22oz']):[],d:i.d||'',img:i.img||'',status:'on'}})}});
}
BC.group=function(rows){
  rows=rows.slice().sort(function(a,b){return (a.sort||0)-(b.sort||0)});
  var cats=[],map={};
  rows.forEach(function(r){
    var m=map[r.category];if(!m){m=map[r.category]={c:r.category,i:[]};cats.push(m)}
    var multi=r.prices.length>1;
    m.i.push({key:r.key,n:r.name,p:r.prices,z:multi?((r.labels&&r.labels.length)?r.labels:['16oz','22oz']):[],d:r.description||'',img:r.image||'',status:r.status,sort:r.sort||0,custom:!!r.custom});
  });
  return cats;
};
BC.load=function(){
  return new Promise(function(resolve){
    if(!sb){resolve({menu:staticMenu(),settings:null,online:false});return}
    Promise.all([sb.from('menu_items').select('*').neq('status','removed').limit(1000),sb.from('settings').select('*').eq('id',1).maybeSingle()]).then(function(r){
      var rows=r[0].data,set=r[1].data;
      if(r[0].error||r[1].error||!rows||!rows.length||!set){resolve({menu:staticMenu(),settings:set||null,online:false,failed:!!(r[0].error||r[1].error)});return}
      resolve({menu:BC.group(rows),settings:set,online:true});
    }).catch(function(){resolve({menu:staticMenu(),settings:null,online:false,failed:true})});
  });
};

/* ---- how many of each item have been bought ----
   Reads totals from the item_sales() function in Supabase (see supabase-sales.sql).
   It returns only item names and counts, never customer details.
   If the function isn't set up yet, nothing is shown and the page works as before. */
BC.sales={};
BC.loadSales=function(){
  if(!sb)return Promise.resolve(false);
  return Promise.resolve(sb.rpc('item_sales')).then(function(r){
    if(!r||r.error||!r.data)return false;
    var m={},list=[];
    r.data.forEach(function(x){var n=Number(x.sold)||0;if(x.name&&n>0){m[String(x.name).trim().toLowerCase()]=n;list.push({name:String(x.name).trim(),sold:n})}});
    list.sort(function(a,b){return b.sold-a.sold});
    BC.sales=m;BC.salesList=list;return list.length>0;
  }).catch(function(){return false});
};
BC.soldOf=function(name){return BC.sales[String(name||'').trim().toLowerCase()]||0};
BC.fmtCount=function(n){return n>=1000?(Math.round(n/100)/10)+'k':String(n)};

/* ---- menu cards (same look on the website and on the order page) ---- */
function qtyHtml(id){
  var q=(BC.state.cart[id]&&BC.state.cart[id].q)||0;
  return '<div class="qty"><button type="button" data-act="d" data-id="'+BC.esc(id)+'" data-d="-1" aria-label="Remove one">−</button><b data-qty="'+BC.esc(id)+'">'+q+'</b><button type="button" data-act="d" data-id="'+BC.esc(id)+'" data-d="1" aria-label="Add one">+</button></div>';
}
BC.card=function(i){
  var so=i.status==='soldout',multi=i.p.length>1,canOrder=BC.state.canOrder;
  var rows=i.p.map(function(p,s){
    var lab=multi?'<em>'+BC.esc((i.z&&i.z[s])||(s?'22oz':'16oz'))+'</em> ':'';
    var ctl=so?'<span class="soldtag">Sold out</span>':(canOrder?qtyHtml(i.key+'#'+s):'');
    return '<div class="qrow"><span class="qp">'+lab+BC.peso(p)+'</span>'+ctl+'</div>';
  }).join('');
  return '<div class="card reveal pcard'+(so?' soldout':'')+'">'+(i.img?'<img class="pimg" src="'+BC.esc(i.img)+'" alt="'+BC.esc(i.n)+'" loading="lazy">':'')+'<span class="pname">'+BC.esc(i.n)+'</span>'+(i.d?'<span class="pdesc">'+BC.esc(i.d)+'</span>':'')+rows+'</div>';
};
BC.groups=function(menu){
  return menu.map(function(m,k){return '<div class="group" data-c="'+k+'"><h3>'+BC.esc(m.c)+'</h3><div class="grid">'+m.i.map(BC.card).join('')+'</div></div>'}).join('');
};
BC.chips=function(menu,el,root){
  el.innerHTML='<button class="chip on" data-c="all">All</button>'+menu.map(function(m,k){return '<button class="chip" data-c="'+k+'">'+BC.esc(m.c)+'</button>'}).join('');
  el.style.display=menu.length<2?'none':'';
  el.onclick=function(e){
    var b=e.target.closest('.chip');if(!b)return;
    [].forEach.call(el.children,function(x){x.classList.toggle('on',x===b)});
    [].forEach.call(root.querySelectorAll('.group'),function(g){g.style.display=(b.dataset.c==='all'||g.dataset.c===b.dataset.c)?'':'none'});
    [].forEach.call(root.querySelectorAll('.reveal'),function(x){x.classList.add('in')});
  };
};

/* ---- scroll-in animation ---- */
var io=null;
BC.observe=function(){
  var els=[].slice.call(document.querySelectorAll('.reveal:not([data-o])'));
  if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in')});return}
  if(!io)io=new IntersectionObserver(function(es){es.forEach(function(en){
    if(en.isIntersecting){
      var i=[].indexOf.call(en.target.parentNode.children,en.target);
      en.target.style.transitionDelay=(i%4)*90+'ms';en.target.classList.add('in');
      setTimeout(function(t){t.style.transitionDelay='0ms'},900,en.target);io.unobserve(en.target);
    }})},{threshold:.12});
  els.forEach(function(e){e.setAttribute('data-o','1');io.observe(e)});
};
window.BC=BC;
})();
