/* ============================================================
   DUNE — demo property dataset
   ============================================================ */
window.DUNE=window.DUNE||{};

window.DUNE.directions=[
  {key:'new',   label:'Новостройки',        sub:'Грозный и Чеченская Республика', ph:'grozny', tone:''},
  {key:'resale',label:'Вторичка',           sub:'Проверенные квартиры и дома',    ph:'city',   tone:'ink'},
  {key:'dubai', label:'Дубай',              sub:'ОАЭ, доход и резиденция',         ph:'dubai',  tone:''},
  {key:'saudi', label:'Саудовская Аравия',  sub:'Эр-Рияд, Джидда, инвестиции',     ph:'riyadh', tone:'sand'}
];

window.DUNE.dirLabel=function(k){
  var d=window.DUNE.directions.find(function(x){return x.key===k;});return d?d.label:k;
};

function rooms(n){return n===0?'Студия':n+'-комн.';}

window.DUNE.properties=[
  // ---------- Новостройки (Грозный) ----------
  {id:'gz-01',dir:'new',title:'2-комн. квартира, 64 м²',rooms:2,area:64,floor:'7 / 16',
   complex:'ЖК «Грозный Сити»',city:'Грозный',district:'Ленинский р-н',
   price:7680000,priceText:'7 680 000 ₽',ph:'grozny',tone:'',installment:true,isNew:true,premium:true,
   delivery:'Сдан',tags:[{l:'Новостройка',t:'bordo'},{l:'Рассрочка 0%',t:'sand'}],
   features:['Панорамные окна','Чистовая отделка','Подземный паркинг','Видеонаблюдение']},

  {id:'gz-02',dir:'new',title:'Студия, 32 м²',rooms:0,area:32,floor:'4 / 12',
   complex:'ЖК «Беркат»',city:'Грозный',district:'Октябрьский р-н',
   price:3990000,priceText:'3 990 000 ₽',ph:'grozny',tone:'',installment:true,isNew:true,premium:false,
   delivery:'IV кв. 2026',tags:[{l:'Новостройка',t:'bordo'},{l:'Рассрочка',t:'sand'}],
   features:['Свободная планировка','Газоблок','Двор без машин']},

  {id:'gz-03',dir:'new',title:'3-комн. квартира, 92 м²',rooms:3,area:92,floor:'11 / 18',
   complex:'ЖК «Ахмат Тауэр Резиденс»',city:'Грозный',district:'Центр',
   price:13340000,priceText:'13 340 000 ₽',ph:'grozny',tone:'',installment:true,isNew:true,premium:true,
   delivery:'Сдан',tags:[{l:'Премиум',t:'bordo'},{l:'Рассрочка 0%',t:'sand'}],
   features:['Вид на проспект','Дизайнерский холл','2 санузла','Консьерж 24/7']},

  {id:'gz-04',dir:'new',title:'1-комн. квартира, 44 м²',rooms:1,area:44,floor:'6 / 14',
   complex:'ЖК «Феникс»',city:'Грозный',district:'Заводской р-н',
   price:5280000,priceText:'5 280 000 ₽',ph:'grozny',tone:'',installment:true,isNew:true,premium:false,
   delivery:'II кв. 2027',tags:[{l:'Новостройка',t:'bordo'},{l:'Рассрочка',t:'sand'}],
   features:['Кладовая','Кухня-гостиная','Закрытый двор']},

  // ---------- Вторичка ----------
  {id:'rs-01',dir:'resale',title:'3-комн. квартира, 78 м²',rooms:3,area:78,floor:'5 / 9',
   complex:'ул. Маяковского',city:'Грозный',district:'Ленинский р-н',
   price:8900000,priceText:'8 900 000 ₽',ph:'city',tone:'ink',installment:false,isNew:false,premium:false,
   tags:[{l:'Вторичка',t:'ghost'}],
   features:['Свежий ремонт','Раздельный санузел','Развитая инфраструктура']},

  {id:'rs-02',dir:'resale',title:'Дом, 180 м², участок 6 сот.',rooms:4,area:180,floor:'2 этажа',
   complex:'пос. Гикало',city:'Грозный',district:'Грозненский р-н',
   price:11500000,priceText:'11 500 000 ₽',ph:'villa',tone:'sand',installment:false,isNew:false,premium:true,
   tags:[{l:'Дом',t:'ghost'},{l:'Премиум',t:'sand'}],
   features:['Гараж на 2 авто','Газ, скважина','Сад и зона барбекю']},

  {id:'rs-03',dir:'resale',title:'2-комн. квартира, 58 м²',rooms:2,area:58,floor:'3 / 5',
   complex:'пр. Кадырова',city:'Грозный',district:'Центр',
   price:6450000,priceText:'6 450 000 ₽',ph:'city',tone:'ink',installment:false,isNew:false,premium:false,
   tags:[{l:'Вторичка',t:'ghost'}],
   features:['Окна во двор','Мебель остаётся','Рядом школа и парк']},

  {id:'rs-04',dir:'resale',title:'1-комн. квартира, 41 м²',rooms:1,area:41,floor:'8 / 10',
   complex:'ул. Дьякова',city:'Грозный',district:'Октябрьский р-н',
   price:4700000,priceText:'4 700 000 ₽',ph:'city',tone:'ink',installment:false,isNew:false,premium:false,
   tags:[{l:'Вторичка',t:'ghost'}],
   features:['Высокий этаж','Тёплый пол','Лоджия 6 м²']},

  // ---------- Дубай ----------
  {id:'db-01',dir:'dubai',title:'Apartment 1BR, 71 м²',rooms:1,area:71,floor:'24 / 52',
   complex:'Downtown, Burj Royale',city:'Дубай',district:'Downtown Dubai',
   price:62000000,priceText:'$ 680 000',ph:'dubai',tone:'',installment:true,isNew:true,premium:true,
   delivery:'Сдан',tags:[{l:'Дубай',t:'bordo'},{l:'ROI 8%',t:'sand'}],
   features:['Вид на Бурдж-Халифа','Резиденция инвестора','Бассейн на крыше','Меблировано']},

  {id:'db-02',dir:'dubai',title:'Apartment Studio, 38 м²',rooms:0,area:38,floor:'12 / 40',
   complex:'JVC, Binghatti',city:'Дубай',district:'Jumeirah Village Circle',
   price:21000000,priceText:'$ 230 000',ph:'dubai',tone:'',installment:true,isNew:true,premium:false,
   delivery:'I кв. 2027',tags:[{l:'Дубай',t:'bordo'},{l:'Рассрочка',t:'sand'}],
   features:['Старт инвестиций','План оплаты 40/60','Гарантия аренды']},

  {id:'db-03',dir:'dubai',title:'Apartment 2BR, 118 м²',rooms:2,area:118,floor:'31 / 60',
   complex:'Dubai Marina, Vida',city:'Дубай',district:'Dubai Marina',
   price:118000000,priceText:'$ 1 290 000',ph:'dubai',tone:'',installment:true,isNew:true,premium:true,
   delivery:'Сдан',tags:[{l:'Премиум',t:'bordo'},{l:'Вид на марину',t:'sand'}],
   features:['Панорама на залив','2 парковочных места','Smart-home','Консьерж']},

  {id:'db-04',dir:'dubai',title:'Villa 4BR, 340 м²',rooms:4,area:340,floor:'2 этажа',
   complex:'Palm Jumeirah, Signature',city:'Дубай',district:'Palm Jumeirah',
   price:520000000,priceText:'$ 5 700 000',ph:'villa',tone:'sand',installment:false,isNew:true,premium:true,
   delivery:'Сдан',tags:[{l:'Вилла',t:'bordo'},{l:'Премиум',t:'sand'}],
   features:['Собственный пляж','Бассейн infinity','Лифт','Гараж на 3 авто']},

  // ---------- Саудовская Аравия ----------
  {id:'sa-01',dir:'saudi',title:'Apartment 2BR, 96 м²',rooms:2,area:96,floor:'18 / 35',
   complex:'ROSHN Sedra, Riyadh',city:'Эр-Рияд',district:'North Riyadh',
   price:38000000,priceText:'$ 420 000',ph:'riyadh',tone:'sand',installment:true,isNew:true,premium:true,
   delivery:'II кв. 2027',tags:[{l:'Эр-Рияд',t:'bordo'},{l:'Рассрочка',t:'sand'}],
   features:['Программа Vision 2030','Закрытое комьюнити','Мечеть и парк рядом']},

  {id:'sa-02',dir:'saudi',title:'Apartment 1BR, 64 м²',rooms:1,area:64,floor:'9 / 22',
   complex:'Jeddah Corniche',city:'Джидда',district:'Al Shati',
   price:26000000,priceText:'$ 285 000',ph:'riyadh',tone:'sand',installment:true,isNew:true,premium:false,
   delivery:'Сдан',tags:[{l:'Джидда',t:'bordo'},{l:'У моря',t:'sand'}],
   features:['Вид на Красное море','Набережная','Гарантия дохода']},

  {id:'sa-03',dir:'saudi',title:'Villa 5BR, 420 м²',rooms:4,area:420,floor:'2 этажа',
   complex:'Diriyah Gate, Riyadh',city:'Эр-Рияд',district:'Diriyah',
   price:190000000,priceText:'$ 2 100 000',ph:'villa',tone:'sand',installment:false,isNew:true,premium:true,
   delivery:'III кв. 2027',tags:[{l:'Вилла',t:'bordo'},{l:'Премиум',t:'sand'}],
   features:['Историческ. район ЮНЕСКО','Частный сад','Мажлис','Премиум-отделка']},

  {id:'sa-04',dir:'saudi',title:'Apartment 2BR, 88 м²',rooms:2,area:88,floor:'14 / 28',
   complex:'King Salman Park, Riyadh',city:'Эр-Рияд',district:'Central Riyadh',
   price:45000000,priceText:'$ 495 000',ph:'riyadh',tone:'sand',installment:true,isNew:true,premium:true,
   delivery:'I кв. 2028',tags:[{l:'Эр-Рияд',t:'bordo'},{l:'Рассрочка',t:'sand'}],
   features:['Крупнейший парк мира','Инвест-локация','Premium-инфраструктура']},
];

window.DUNE.roomsLabel=rooms;
