/* Home page menu with add to cart.
   This file loads anything it needs by itself (Supabase library, config.js, shop.js),
   so the menu still appears even if index.html is an older copy. */
(function(){
  function $(id){return document.getElementById(id)}
  function need(src,have,next){
    if(have()){next();return}
    var s=document.createElement('script');s.src=src;s.onload=next;s.onerror=next;document.head.appendChild(s);
  }
  function ensureEls(){
    if(!$('menuNotice')&&$('chips')){var n=document.createElement('div');n.id='menuNotice';$('chips').parentNode.insertBefore(n,$('chips'))}
    if(!$('cartbar')){
      var d=document.createElement('div');d.className='cartbar';d.id='cartbar';d.hidden=true;
      d.innerHTML='<div class="cartin"><div><b id="cbCount"></b><span id="cbTotal"></span></div><a class="obtn" href="order.html?step=review">Review order →</a></div>';
      document.body.appendChild(d);
    }
  }
  function boot(){
    var root=$('menuRoot'),chips=$('chips');
    try{
      var BC=window.BC;
      if(!BC)throw new Error('shop.js did not load. Upload shop.js to the same folder as index.html.');
      ensureEls();
      var bar=$('cartbar'),note=$('menuNotice');
      var updateBar=function(){
        var t=BC.totals();
        var c=$('cbCount'),p=$('cbTotal');
        if(c)c.textContent=t.count+(t.count===1?' item':' items');
        if(p)p.textContent=BC.peso(t.total);
        bar.hidden=!(BC.state.canOrder&&t.count>0);
      };
      BC.onCart=updateBar;
      BC.observe();
      BC.load().then(function(res){
        var canOrder=!!(res.online&&BC.isOpen(res.settings));
        BC.setMenu(res.menu,canOrder);
        if(res.online&&!BC.isOpen(res.settings)){
          var s=res.settings;
          note.innerHTML='<div class="notice warn"><b>We’re closed for online orders right now.</b>'+(s.store_message?'<br>'+BC.esc(s.store_message):'')+(s.store_reopen_at?'<br>Back '+BC.esc(BC.fmtWhen(s.store_reopen_at))+'.':'')+'</div>';
        }
        if(!res.menu.length){root.innerHTML='<p class="empty">Our menu is coming soon.</p>';chips.style.display='none';return}
        root.innerHTML=BC.groups(res.menu);
        BC.chips(res.menu,chips,root);
        updateBar();BC.observe();
      }).catch(function(e){root.innerHTML='<p class="empty">Sorry, the menu could not load ('+(e&&e.message||'error')+').</p>'});
    }catch(e){
      root.innerHTML='<p class="empty">Sorry, the menu could not load. '+(e&&e.message||'')+'</p>';
    }
  }
  /* safety net: never leave sections invisible */
  setTimeout(function(){[].forEach.call(document.querySelectorAll('.reveal'),function(e){e.classList.add('in')})},4000);
  need('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.109.0/dist/umd/supabase.min.js',function(){return !!window.supabase},function(){
    need('config.js',function(){return !!window.SB},function(){
      need('shop.js',function(){return !!window.BC},boot);
    });
  });
})();
