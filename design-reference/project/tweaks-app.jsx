/* ============================================================
   DUNE — Tweaks (hero variations)
   Applies to the vanilla DOM via a React panel.
   ============================================================ */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "heroVariant": "immersive",
  "accent": "#cbbba0",
  "heroBg": "grozny",
  "showShowcase": true
}/*EDITMODE-END*/;

function applyHeroTweaks(t){
  var hero=document.getElementById('hero');
  if(!hero) return;
  hero.dataset.hero=t.heroVariant;
  hero.style.setProperty('--accent', t.accent);

  var sc=document.getElementById('heroShowcase');
  if(sc) sc.style.display = (t.showShowcase ? '' : 'none');

  var bg=hero.querySelector('.hero__bg');
  if(bg && bg.getAttribute('data-kind')!==t.heroBg){
    bg.setAttribute('data-kind', t.heroBg);
    bg.innerHTML='<div class="ph" data-ph="'+t.heroBg+'" data-sun></div>';
    if(window.DUNE && window.DUNE.processPlaceholders) window.DUNE.processPlaceholders(bg);
  }
}

function App(){
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  React.useEffect(function(){ applyHeroTweaks(t); }, [t]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Hero-экран" />
      <TweakRadio label="Вариант" value={t.heroVariant}
        options={[{value:'immersive',label:'Полный'},{value:'split',label:'Сплит'},{value:'minimal',label:'Минимал'}]}
        onChange={(v)=>setTweak('heroVariant', v)} />
      <TweakRadio label="Фон" value={t.heroBg}
        options={[{value:'grozny',label:'Грозный'},{value:'dubai',label:'Дубай'},{value:'riyadh',label:'Эр-Рияд'}]}
        onChange={(v)=>setTweak('heroBg', v)} />
      <TweakColor label="Акцент" value={t.accent}
        options={['#cbbba0','#d8b885','#e6d8bf']}
        onChange={(v)=>setTweak('accent', v)} />
      <TweakToggle label="Карточка-объект" value={t.showShowcase}
        onChange={(v)=>setTweak('showShowcase', v)} />
    </TweaksPanel>
  );
}

(function mount(){
  var root=document.getElementById('tweaks-root');
  if(!root){root=document.createElement('div');root.id='tweaks-root';document.body.appendChild(root);}
  // apply persisted defaults immediately (before panel interaction)
  applyHeroTweaks(TWEAK_DEFAULTS);
  ReactDOM.createRoot(root).render(<App/>);
})();
