/* ============================================================
   DUNE — shared interactions
   ============================================================ */
(function(){
  // ---------- mobile drawer ----------
  function initDrawer(){
    var burger=document.querySelector('[data-burger]');
    var drawer=document.querySelector('[data-drawer]');
    if(!burger||!drawer) return;
    var open=function(){drawer.classList.add('is-open');document.body.style.overflow='hidden';};
    var close=function(){drawer.classList.remove('is-open');document.body.style.overflow='';};
    burger.addEventListener('click',open);
    drawer.addEventListener('click',function(e){
      if(e.target.matches('[data-drawer-close],.drawer__scrim')) close();
    });
    drawer.querySelectorAll('a').forEach(function(a){a.addEventListener('click',close);});
  }

  // ---------- header shadow on scroll ----------
  function initHeader(){
    var h=document.querySelector('.site-header');
    if(!h) return;
    var on=function(){h.style.boxShadow=window.scrollY>10?'0 10px 30px -16px rgba(0,0,0,.5)':'none';};
    on();window.addEventListener('scroll',on,{passive:true});
  }

  // ---------- scroll reveal (rect-based, bulletproof) ----------
  var revealEls=[];
  function checkReveal(){
    var vh=window.innerHeight||document.documentElement.clientHeight;
    for(var i=revealEls.length-1;i>=0;i--){
      var el=revealEls[i];
      var r=el.getBoundingClientRect();
      if(r.top < vh*0.92 && r.bottom > 0){
        el.classList.add('in');
        revealEls.splice(i,1);
      }
    }
  }
  function initReveal(){
    var els=[].slice.call(document.querySelectorAll('.fade-up:not(.in)'));
    if(!els.length) return;
    els.forEach(function(e){if(revealEls.indexOf(e)<0) revealEls.push(e);});
    checkReveal();
    // safety: reveal everything shortly after, in case scroll never fires
    clearTimeout(initReveal._t);
    initReveal._t=setTimeout(function(){
      revealEls.forEach(function(e){e.classList.add('in');});
      revealEls.length=0;
    },2600);
  }

  // ---------- skyline silhouettes ----------
  var SKYLINES={
    grozny:'<path d="M0 120V70c0-2 2-4 4-4h26v-8h6v-18l5-7 5 7v18h6v54H0Zm70 0V40c0-3 2-5 5-5h2l5-22 5 22h2c3 0 5 2 5 5v80H70Zm60 0V58h-7l13-20 13 20h-7v62h-5Zm45 0V72c0-2 2-4 4-4h22v-9h7V41l5-8 5 8v18h7v9h22c2 0 4 2 4 4v48H175Z" fill="currentColor"/>',
    dubai:'<path d="M0 120v-30h18v30H0Zm26 0V70h22v50H26Zm30 0V52h16v68H56Zm95 0V18l8-18 8 18v102h-16Zm-60 0V40l6-10 6 10v80H86Zm38 0V62h14v58h-14Zm60 0V46h16v74h-16Zm26 0V78h20v42h-20Z" fill="currentColor"/>',
    riyadh:'<path d="M0 120V84h16v36H0Zm26 0V64h18v56H26Zm120 0V40c0-8 6-14 14-14s14 6 14 14v18h-9v-9a5 5 0 0 0-10 0v71h-23Zm-66 0V52h18v68H80Zm30 0V72h16v48h-16Zm84 0V70h22v50h-22Z" fill="currentColor"/>',
    city:'<path d="M0 120V80h20v40H0Zm28 0V60h24v60H28Zm32 0V42h20v78H60Zm28 0V70h16v50H88Zm60 0V50h22v70h-22Zm30 0V66h18v54h-18Zm26 0V84h20v36h-20Zm-90 0V58h22v62h-22Z" fill="currentColor"/>',
    villa:'<path d="M0 120V92h40V70l40-26 40 26h44v50H0Zm150-50 36-22 46 30v42h-82V70Z" fill="currentColor"/>'
  };

  // ---------- real photography (progressive enhancement) ----------
  // Open-source photos (Unsplash License). Layered ABOVE the branded
  // silhouette: if a photo fails to load it is removed and the on-brand
  // placeholder shows through — so a broken/blocked image is never visible.
  // Swap any URL here (or pass data-img="..." on an element) for your own shots.
  // Unsplash photo IDs (verified, free under the Unsplash License). The
  // /download endpoint 302-redirects to the CDN image, which an <img> renders.
  function uns(id){return 'https://unsplash.com/photos/'+id+'/download?force=true&w=1100';}
  var PHOTOS={
    grozny:['BSNZ09dqKwk','4ZeTJcaspAk','c53YmDnln3I'].map(uns), // modern residential buildings
    city:  ['E8fqapcvz2Y','Qvhf8iFhu9c','ZMeYdUGeQO0'].map(uns), // apartment blocks (resale)
    dubai: ['QGRe9cmc5tE','bVblbt3tGxM','lMo2HjtoUpM'].map(uns), // Dubai skyline / Burj Khalifa
    riyadh:['_UxsPARhtOg','vAkHAP27QMk'].map(uns),               // Riyadh / Kingdom Tower
    villa: ['rHoMQ87hvIY','GZezxeKOznc'].map(uns)                // luxury villas with pool
  };
  var phCount={};
  function photoFor(el,kind){
    if(el.hasAttribute('data-img')) return el.getAttribute('data-img');
    var pool=PHOTOS[kind]; if(!pool||!pool.length) return null;
    var i=(phCount[kind]=(phCount[kind]||0)+1)-1;
    return pool[i%pool.length];
  }

  function processPlaceholders(root){
    (root||document).querySelectorAll('[data-ph]:not(.ph-done)').forEach(function(el){
      // preserve overlay markup placed inside (e.g. tags, captions)
      var overlay=el.innerHTML.trim();
      var kind=el.getAttribute('data-ph')||'city';
      var tone=el.getAttribute('data-tone')||'';
      var sky=SKYLINES[kind]||SKYLINES.city;
      var hasSun=el.hasAttribute('data-sun');
      var src=photoFor(el,kind);
      // above-the-fold elements (e.g. the hero) opt into priority loading so
      // the LCP image isn't deferred; everything else stays lazy.
      var eager=el.hasAttribute('data-eager');
      var photo=src
        ? '<img class="ph__photo" src="'+src+'" alt="" decoding="async"'+
          (eager?' loading="eager" fetchpriority="high"':' loading="lazy"')+
          ' onload="this.classList.add(\'is-loaded\')" onerror="this.remove()">'
        : '';
      el.classList.add('ph','ph-done');
      if(tone) el.classList.add('ph--'+tone);
      el.innerHTML=
        '<div class="ph__sky"></div>'+
        (hasSun?'<div class="sun"></div>':'')+
        '<svg class="silhouette" viewBox="0 0 232 120" preserveAspectRatio="xMidYMax meet" width="232" height="120">'+sky+'</svg>'+
        photo+
        '<div class="ph__tint"></div>'+
        '<div class="ph__grain"></div>'+
        '<div class="ph__overlay">'+overlay+'</div>';
    });
  }
  function initPlaceholders(){processPlaceholders(document);}

  // ---------- lead form + inline validation ----------
  function initForms(){
    var uid=0;
    document.querySelectorAll('form[data-lead]').forEach(function(f){
      f.setAttribute('novalidate','');   // we handle validation ourselves

      function setError(field,input,msg){
        var err=field.querySelector('.field__err');
        if(msg){
          if(!err){
            err=document.createElement('div');
            err.className='field__err';
            err.id='err-'+(++uid);
            err.setAttribute('role','alert');
            field.appendChild(err);
          }
          err.textContent=msg;
          field.classList.add('field--error');
          input.setAttribute('aria-invalid','true');
          input.setAttribute('aria-describedby',err.id);
        }else{
          field.classList.remove('field--error');
          input.removeAttribute('aria-invalid');
          input.removeAttribute('aria-describedby');
          if(err) err.remove();
        }
      }

      function validate(input){
        var field=input.closest('.field'); if(!field) return true;
        var v=(input.value||'').trim();
        if(input.hasAttribute('required')&&!v){
          setError(field,input,'Пожалуйста, заполните это поле'); return false;
        }
        if(input.type==='tel'&&v&&v.replace(/\D/g,'').length<10){
          setError(field,input,'Введите корректный номер телефона'); return false;
        }
        setError(field,input,''); return true;
      }

      // live-clear an error once the user fixes the field
      f.querySelectorAll('input,select,textarea').forEach(function(el){
        var ev=el.tagName==='SELECT'?'change':'input';
        el.addEventListener(ev,function(){
          var fl=el.closest('.field');
          if(fl&&fl.classList.contains('field--error')) validate(el);
        });
        el.addEventListener('blur',function(){ if((el.value||'').trim()||el.hasAttribute('required')) validate(el); });
      });

      f.addEventListener('submit',function(e){
        e.preventDefault();
        var inputs=[].slice.call(f.querySelectorAll('input,select,textarea'));
        var firstBad=null;
        inputs.forEach(function(el){ if(!validate(el)&&!firstBad) firstBad=el; });
        if(firstBad){ firstBad.focus(); return; }

        // success
        f.querySelectorAll('input,select,textarea,button').forEach(function(el){el.disabled=true;});
        var card=f.closest('[data-lead-card]')||f;
        card.classList.add('is-sent');
      });
    });
  }

  document.addEventListener('DOMContentLoaded',function(){
    document.documentElement.classList.add('js');
    initPlaceholders();
    initDrawer();
    initHeader();
    initReveal();
    initForms();
    window.addEventListener('scroll',checkReveal,{passive:true});
    window.addEventListener('resize',checkReveal,{passive:true});
  });

  window.DUNE=window.DUNE||{};
  window.DUNE.skylines=SKYLINES;
  window.DUNE.processPlaceholders=processPlaceholders;
  window.DUNE.initReveal=initReveal;
})();
