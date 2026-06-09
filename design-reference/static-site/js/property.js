/* ============================================================
   DUNE — property detail page
   ============================================================ */
(function(){
  var D=window.DUNE, I=D.icons;
  var $=function(s){return document.querySelector(s);};

  function getId(){return new URLSearchParams(location.search).get('id');}
  var p=D.properties.find(function(x){return x.id===getId();})||D.properties[0];

  var DIR_LABEL=D.dirLabel(p.dir);
  var AGENTS={new:'Адам Висаитов',resale:'Лиза Эльдарова',dubai:'Руслан Кадыров',saudi:'Амир Аль-Рашид'};

  function fmtRub(n){return Math.round(n).toLocaleString('ru-RU')+' ₽';}

  // ----- breadcrumbs -----
  $('#cr-dir').textContent=DIR_LABEL;
  $('#cr-dir').href='catalog.html?dir='+p.dir;
  $('#cr-title').textContent=p.title;
  document.title=p.title+' — DUNE Real Estate';

  // ----- gallery -----
  var sun=(p.dir==='dubai'||p.dir==='saudi');
  var galleryKinds=[p.ph,(p.dir==='dubai'?'dubai':p.dir==='saudi'?'riyadh':'city'),'villa',p.ph];
  var tones=[p.tone,p.tone,'sand','ink'];
  var g=$('#gallery');
  var cells=galleryKinds.map(function(k,i){
    var t=tones[i]?(' data-tone="'+tones[i]+'"'):'';
    var s=sun&&i===0?' data-sun':'';
    var overlay='';
    if(i===0){
      var tags=(p.tags||[]).map(function(x){return '<span class="tag tag--'+x.t+'">'+x.l+'</span>';}).join('');
      overlay='<div class="card__tags" style="left:18px;top:18px">'+tags+'</div>';
    }
    if(i===3){
      overlay='<button class="btn btn--light btn--sm gallery__more" type="button">'+
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'+
        'Все фото — 24</button>';
    }
    return '<div class="ph" data-ph="'+k+'"'+t+s+'>'+overlay+'</div>';
  });
  // main image + thumbnails wrapper. On desktop the wrapper is display:contents
  // (grid sees all 4 cells, unchanged); on mobile it becomes a horizontal strip.
  g.innerHTML=cells[0]+'<div class="gallery__thumbs">'+cells.slice(1).join('')+'</div>';

  // ----- tags -----
  $('#pdpTags').innerHTML=(p.tags||[]).map(function(x){return '<span class="tag tag--'+x.t+'">'+x.l+'</span>';}).join('');

  // ----- title / loc -----
  $('#pdpTitle').textContent=p.title;
  $('#pdpLoc').innerHTML=I.pin+'<span>'+p.complex+', '+p.district+', '+p.city+'</span>';

  // ----- key facts -----
  var rooms=D.roomsLabel(p.rooms);
  var facts=[
    {b:p.area+' м²',s:'площадь'},
    {b:rooms,s:'комнатность'},
    {b:p.floor,s:'этаж'},
    p.isNew&&p.delivery?{b:p.delivery,s:'срок сдачи'}:{b:(p.dir==='resale'?'Вторичка':'Новостройка'),s:'тип'}
  ];
  $('#pdpFacts').innerHTML=facts.map(function(f){
    return '<div class="kf"><b>'+f.b+'</b><span>'+f.s+'</span></div>';
  }).join('');

  // ----- description -----
  var intro={
    new:'Современная квартира в одном из самых востребованных жилых комплексов Грозного. Дом сдан с чистовой отделкой, развитой внутренней инфраструктурой и закрытой территорией.',
    resale:'Готовая к проживанию недвижимость с честной историей и полным пакетом документов. Юридическая проверка и сопровождение сделки — на стороне DUNE.',
    dubai:'Инвестиционный объект в премиальной локации Дубая с привлекательной доходностью и планом оплаты от застройщика. Подходит для сдачи в аренду и получения резиденции инвестора.',
    saudi:'Объект на быстрорастущем рынке Саудовской Аравии в рамках государственной программы Vision 2030. Перспективная локация для долгосрочных инвестиций.'
  };
  $('#pdpDesc').textContent=intro[p.dir]+' '+rooms.toLowerCase()+' планировка площадью '+p.area+' м² — рациональная и продуманная до мелочей.';

  // ----- amenities -----
  $('#pdpAmen').innerHTML=(p.features||[]).map(function(f){
    return '<li>'+I.check+'<span>'+f+'</span></li>';
  }).join('');

  // ----- price -----
  $('#pdpPrice').textContent=p.priceText;
  var perM=fmtRub(p.price/p.area)+'/м²';
  $('#pdpPerM').textContent=(p.dir==='dubai'||p.dir==='saudi'?'≈ '+perM+' (эквивалент)':perM);
  if(p.installment){
    $('#pdpInst').hidden=false;
    var monthly=fmtRub((p.price*0.8)/24);
    $('#pdpInstSum').textContent='Рассрочка 0%, от '+monthly+'/мес';
  }

  // ----- map -----
  $('#pdpAddr').textContent=p.district+', '+p.city+'. Точный адрес сообщит менеджер.';
  // Yandex map widget (iframe — no API key needed). Centred on the property's
  // city, defaulting to Грозный. Marker = the city centre.
  var CITY_COORDS={
    'Грозный':[45.6892,43.3169],'Дубай':[55.2708,25.2048],
    'Эр-Рияд':[46.6753,24.7136],'Джидда':[39.1925,21.4858]
  };
  var c=CITY_COORDS[p.city]||CITY_COORDS['Грозный'];
  var mapEl=$('#pdpMap');
  if(mapEl){
    var ll=c[0]+','+c[1];
    var ifr=document.createElement('iframe');
    ifr.src='https://yandex.ru/map-widget/v1/?ll='+encodeURIComponent(ll)+'&z=12&pt='+ll+',pm2rdm';
    ifr.loading='lazy';
    ifr.title='Карта: '+p.city;
    ifr.setAttribute('allowfullscreen','');
    mapEl.appendChild(ifr);
  }

  // ----- agent -----
  var name=AGENTS[p.dir]||'Менеджер DUNE';
  $('#agentName').textContent=name;
  $('#agentInit').textContent=name.split(' ').map(function(w){return w[0];}).join('').slice(0,2);

  // ----- similar -----
  var sim=D.properties.filter(function(x){return x.dir===p.dir&&x.id!==p.id;}).slice(0,3);
  if(sim.length<3){
    D.properties.forEach(function(x){if(sim.length<3&&x.id!==p.id&&sim.indexOf(x)<0) sim.push(x);});
  }
  var grid=$('#similarGrid');
  grid.innerHTML=sim.map(D.renderCard).join('');
  $('#moreLink').href='catalog.html?dir='+p.dir;

  // process placeholders for everything we injected
  document.addEventListener('DOMContentLoaded',function(){
    D.processPlaceholders(document);
    [].slice.call(document.querySelectorAll('.fade-up')).forEach(function(e){e.classList.add('in');});
    window.scrollTo(0,0);
  });
})();
