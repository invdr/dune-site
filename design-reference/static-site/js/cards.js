/* ============================================================
   DUNE — card rendering (shared: home + catalog)
   ============================================================ */
window.DUNE=window.DUNE||{};

window.DUNE.icons={
  pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
  arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  heart:'<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.6-9.3-9C1.2 8 2.6 4.6 6 4.6c2 0 3.3 1.2 4 2.4.7-1.2 2-2.4 4-2.4 3.4 0 4.8 3.4 3.3 6.4C19 15.4 12 20 12 20Z"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  wallet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 9h18M16 13h2"/></svg>'
};

window.DUNE.renderCard=function(p){
  var I=window.DUNE.icons;
  var sun=(p.dir==='dubai'||p.dir==='saudi')?' data-sun':'';
  var tags=(p.tags||[]).map(function(t){return '<span class="tag tag--'+t.t+'">'+t.l+'</span>';}).join('');
  var rooms=window.DUNE.roomsLabel(p.rooms);
  var metaThird=p.isNew&&p.delivery
    ? '<div><b>'+p.delivery+'</b><span>срок сдачи</span></div>'
    : '<div><b>'+rooms+'</b><span>комнат</span></div>';
  return ''+
  '<a class="card fade-up" href="property.html?id='+p.id+'">'+
    '<div class="card__media ph" data-ph="'+p.ph+'"'+(p.tone?' data-tone="'+p.tone+'"':'')+sun+'>'+
      '<div class="card__tags">'+tags+'</div>'+
      '<button class="card__fav" type="button" aria-label="В избранное" onclick="event.preventDefault();event.stopPropagation();this.classList.toggle(\'is-on\')">'+I.heart+'</button>'+
      '<div class="card__price-badge">'+p.priceText+'</div>'+
    '</div>'+
    '<div class="card__body">'+
      '<div class="card__title">'+p.title+'</div>'+
      '<div class="card__complex">'+p.complex+'</div>'+
      '<div class="card__loc">'+I.pin+'<span>'+p.district+', '+p.city+'</span></div>'+
      '<div class="card__meta">'+
        '<div><b>'+p.area+' м²</b><span>площадь</span></div>'+
        '<div><b>'+p.floor+'</b><span>этаж</span></div>'+
        metaThird+
      '</div>'+
    '</div>'+
  '</a>';
};
