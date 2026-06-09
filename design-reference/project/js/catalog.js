/* ============================================================
   DUNE — catalog filtering
   ============================================================ */
(function(){
  var D=window.DUNE, ALL=D.properties;
  var $=function(s,r){return (r||document).querySelector(s);};
  var $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s));};

  var state={dir:new Set(),rooms:new Set(),pmin:null,pmax:null,amin:null,amax:null,
             inst:false,prem:false,newOnly:false,sort:'rel'};

  var DIR_LABEL={new:'Новостройки',resale:'Вторичка',dubai:'Дубай',saudi:'Саудовская Аравия'};

  // ---------- read URL ----------
  function readURL(){
    var q=new URLSearchParams(location.search);
    if(q.get('dir')) state.dir.add(q.get('dir'));
    if(q.get('rooms')!==null&&q.get('rooms')!=='') state.rooms.add(q.get('rooms'));
    if(q.get('pmin')) state.pmin=+q.get('pmin');
    if(q.get('pmax')&&+q.get('pmax')<900000000) state.pmax=+q.get('pmax');
    if(q.get('inst')==='1') state.inst=true;
  }

  // ---------- page head ----------
  function updateHead(){
    var dirs=[...state.dir];
    var titleEl=$('#pageTitle'), subEl=$('#pageSub'), crumb=$('#crumbDir');
    if(dirs.length===1){
      var k=dirs[0];
      titleEl.innerHTML=DIR_LABEL[k].replace(/(\S+)$/, '<b>$1</b>');
      crumb.textContent=DIR_LABEL[k];
      var subs={new:'Квартиры от застройщиков Грозного с рассрочкой 0% от застройщика.',
        resale:'Проверенные квартиры и дома с юридическим сопровождением сделки.',
        dubai:'Инвестиционные апартаменты и виллы в ОАЭ с планом оплаты и доходностью.',
        saudi:'Недвижимость в Эр-Рияде и Джидде на фоне программы Vision 2030.'};
      subEl.textContent=subs[k];
    }else{
      titleEl.innerHTML='Каталог <b>недвижимости</b>';
      crumb.textContent='Все объекты';
      subEl.textContent='Новостройки, вторичка и зарубежные инвестиции — в одной базе DUNE.';
    }
    // active nav
    $$('[data-nav]').forEach(function(a){a.classList.toggle('is-active',state.dir.has(a.getAttribute('data-nav')));});
  }

  // ---------- sync controls from state ----------
  function syncControls(){
    $$('#dirChips .chip').forEach(function(c){c.classList.toggle('is-on',state.dir.has(c.dataset.dir));});
    $$('#roomChips .chip').forEach(function(c){c.classList.toggle('is-on',state.rooms.has(c.dataset.rooms));});
    $('#pmin').value=state.pmin||'';
    $('#pmax').value=state.pmax||'';
    $('#amin').value=state.amin||'';
    $('#amax').value=state.amax||'';
    $('#instToggle').checked=state.inst;
    $('#premToggle').checked=state.prem;
    $('#newToggle').checked=state.newOnly;
    $('#sortSel').value=state.sort;
  }

  // ---------- filtering ----------
  function match(p){
    if(state.dir.size&&!state.dir.has(p.dir)) return false;
    if(state.rooms.size){
      var ok=false;
      state.rooms.forEach(function(r){
        if(r==='4'){ if(p.rooms>=4) ok=true; }
        else if(+r===p.rooms) ok=true;
      });
      if(!ok) return false;
    }
    if(state.pmin!=null&&p.price<state.pmin) return false;
    if(state.pmax!=null&&p.price>state.pmax) return false;
    if(state.amin!=null&&p.area<state.amin) return false;
    if(state.amax!=null&&p.area>state.amax) return false;
    if(state.inst&&!p.installment) return false;
    if(state.prem&&!p.premium) return false;
    if(state.newOnly&&!p.isNew) return false;
    return true;
  }

  function sortList(list){
    var s=state.sort;
    var c={pa:function(a,b){return a.price-b.price;},
           pd:function(a,b){return b.price-a.price;},
           aa:function(a,b){return a.area-b.area;},
           ad:function(a,b){return b.area-a.area;}};
    if(c[s]) list.sort(c[s]);
    return list;
  }

  // ---------- active pills ----------
  function renderPills(){
    var host=$('#activePills'); host.innerHTML='';
    var pills=[];
    state.dir.forEach(function(d){pills.push({t:'dir:'+d,l:DIR_LABEL[d]});});
    state.rooms.forEach(function(r){pills.push({t:'rooms:'+r,l:r==='0'?'Студия':r==='4'?'4+ комн.':r+' комн.'});});
    if(state.pmin!=null) pills.push({t:'pmin',l:'от '+state.pmin.toLocaleString('ru-RU')+' ₽'});
    if(state.pmax!=null) pills.push({t:'pmax',l:'до '+state.pmax.toLocaleString('ru-RU')+' ₽'});
    if(state.amin!=null) pills.push({t:'amin',l:'от '+state.amin+' м²'});
    if(state.amax!=null) pills.push({t:'amax',l:'до '+state.amax+' м²'});
    if(state.inst) pills.push({t:'inst',l:'Рассрочка'});
    if(state.prem) pills.push({t:'prem',l:'Премиум'});
    if(state.newOnly) pills.push({t:'newOnly',l:'Новостройки'});
    pills.forEach(function(p){
      var b=document.createElement('button');
      b.className='chip is-on';b.type='button';b.dataset.pill=p.t;
      b.innerHTML=p.l+' <span style="margin-left:4px;font-weight:700">×</span>';
      host.appendChild(b);
    });
    host.style.display=pills.length?'flex':'none';
  }

  function removePill(t){
    if(t.indexOf('dir:')===0) state.dir.delete(t.slice(4));
    else if(t.indexOf('rooms:')===0) state.rooms.delete(t.slice(6));
    else if(t==='pmin') state.pmin=null;
    else if(t==='pmax') state.pmax=null;
    else if(t==='amin') state.amin=null;
    else if(t==='amax') state.amax=null;
    else if(t==='inst') state.inst=false;
    else if(t==='prem') state.prem=false;
    else if(t==='newOnly') state.newOnly=false;
  }

  // ---------- render ----------
  var grid=$('#catalogGrid'), empty=$('#emptyState');
  function render(){
    var list=ALL.filter(match);
    sortList(list);
    $('#resultCount').textContent=list.length;
    var apc=$('#applyCount'); if(apc) apc.textContent='('+list.length+')';
    if(list.length){
      empty.hidden=true; grid.style.display='';
      grid.innerHTML=list.map(D.renderCard).join('');
      D.processPlaceholders(grid);
      // reveal immediately (already in view region)
      $$('.fade-up',grid).forEach(function(e){e.classList.add('in');});
    }else{
      grid.style.display='none'; grid.innerHTML=''; empty.hidden=false;
    }
    renderPills();
    updateHead();
  }

  // ---------- events ----------
  function bind(){
    $('#dirChips').addEventListener('click',function(e){
      var c=e.target.closest('.chip'); if(!c) return;
      var d=c.dataset.dir; state.dir.has(d)?state.dir.delete(d):state.dir.add(d);
      syncControls(); render();
    });
    $('#roomChips').addEventListener('click',function(e){
      var c=e.target.closest('.chip'); if(!c) return;
      var r=c.dataset.rooms; state.rooms.has(r)?state.rooms.delete(r):state.rooms.add(r);
      syncControls(); render();
    });
    function numEvt(id,key){
      $(id).addEventListener('input',function(){var v=this.value===''?null:+this.value;state[key]=v;render();});
    }
    numEvt('#pmin','pmin');numEvt('#pmax','pmax');numEvt('#amin','amin');numEvt('#amax','amax');
    $('#instToggle').addEventListener('change',function(){state.inst=this.checked;render();});
    $('#premToggle').addEventListener('change',function(){state.prem=this.checked;render();});
    $('#newToggle').addEventListener('change',function(){state.newOnly=this.checked;render();});
    $('#sortSel').addEventListener('change',function(){state.sort=this.value;render();});

    $('#activePills').addEventListener('click',function(e){
      var b=e.target.closest('[data-pill]'); if(!b) return;
      removePill(b.dataset.pill); syncControls(); render();
    });

    function reset(){
      state={dir:new Set(),rooms:new Set(),pmin:null,pmax:null,amin:null,amax:null,
             inst:false,prem:false,newOnly:false,sort:'rel'};
      syncControls(); render();
    }
    $('#resetBtn').addEventListener('click',reset);
    var r2=$('#resetBtn2'); if(r2) r2.addEventListener('click',reset);

    // mobile filter drawer
    var filters=$('#filters');
    $('#openFilters').addEventListener('click',function(){filters.classList.add('is-open');document.body.style.overflow='hidden';});
    $$('[data-filters-close]').forEach(function(b){b.addEventListener('click',function(){
      filters.classList.remove('is-open');document.body.style.overflow='';});});
  }

  document.addEventListener('DOMContentLoaded',function(){
    readURL(); syncControls(); bind(); render();
  });
})();
