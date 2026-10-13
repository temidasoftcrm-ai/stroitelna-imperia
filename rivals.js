// rivals.js — конкурентни строителни фирми. Част от поръчките на таблото имат конкурент с краен срок:
// ако не приемеш поръчката до деня, той я взема, а на парцела след няколко дни никне неговата сграда.
// Записът е в S.rivals = { firms: { id: { won, lost } }, sites: [{ lot, firm, ready, type }] } (общ за фирмата).
// deps: S(), toast, fmt, onBuilt(lotId, type) — game.js поставя сградата, когато конкурентът е готов
export const FIRMS = [
  { id: 'glavbild', nm: '„Главболгарстрой“', ico: '🟥', power: 1.0 },
  { id: 'trakia', nm: '„Тракия Билд“', ico: '🟦', power: 0.8 },
  { id: 'vitosha', nm: '„Витоша Строй“', ico: '🟩', power: 0.9 },
  { id: 'dunav', nm: '„Дунав Инженеринг“', ico: '🟨', power: 0.7 },
];
// местни фирми в чужбина (по знамето на града); в България — FIRMS. Имената са измислени.
export const LOCAL_FIRMS = {
  '🇹🇷': [{ id: 'anadolu', nm: '„Анадолу Иншаат“', ico: '🟥', power: 1.0 }, { id: 'bogazici', nm: '„Боазичи Япъ“', ico: '🟦', power: 0.9 }, { id: 'marmara', nm: '„Мармара Билд“', ico: '🟩', power: 0.85 }, { id: 'kapadokya', nm: '„Кападокия Холдинг“', ico: '🟨', power: 0.75 }],
  '🇷🇴': [{ id: 'carpati', nm: '„Карпаци Констракт“', ico: '🟥', power: 0.9 }, { id: 'dunarea', nm: '„Дунъря Билд“', ico: '🟦', power: 0.8 }, { id: 'valahia', nm: '„Валахия Имо“', ico: '🟨', power: 0.75 }],
  '🇬🇷': [{ id: 'aigaio', nm: '„Егейска Техники“', ico: '🟦', power: 0.9 }, { id: 'olympos', nm: '„Олимп Строй“', ico: '🟥', power: 0.85 }, { id: 'akropoli', nm: '„Акропол Билд“', ico: '🟨', power: 0.75 }],
  '🇷🇸': [{ id: 'morava', nm: '„Морава Градня“', ico: '🟥', power: 0.85 }, { id: 'sava', nm: '„Сава Инженеринг“', ico: '🟦', power: 0.8 }],
  '🇲🇰': [{ id: 'vardar', nm: '„Вардар Градба“', ico: '🟥', power: 0.8 }, { id: 'ohrid', nm: '„Охрид Билд“', ico: '🟦', power: 0.7 }],
  '🇩🇪': [{ id: 'rheinbau', nm: '„Райнбау“', ico: '⬛', power: 1.0 }, { id: 'alpenhoch', nm: '„Алпенхох Бау“', ico: '🟥', power: 0.95 }],
  '🇫🇷': [{ id: 'seine', nm: '„Сен Конструксион“', ico: '🟦', power: 1.0 }, { id: 'loire', nm: '„Луара Бати“', ico: '🟥', power: 0.9 }],
  '🇬🇧': [{ id: 'thames', nm: '„Темза Билдърс“', ico: '🟥', power: 1.0 }, { id: 'albion', nm: '„Албион Констракшън“', ico: '🟦', power: 0.9 }],
  '🇮🇹': [{ id: 'tevere', nm: '„Тевере Костручони“', ico: '🟩', power: 0.95 }, { id: 'appennino', nm: '„Апенини Едиле“', ico: '🟥', power: 0.85 }],
  '🇪🇸': [{ id: 'iberia', nm: '„Иберия Конструкта“', ico: '🟨', power: 0.95 }, { id: 'tajo', nm: '„Тахо Обрас“', ico: '🟥', power: 0.85 }],
  '🇳🇱': [{ id: 'polder', nm: '„Полдер Бау“', ico: '🟧', power: 0.95 }, { id: 'delta', nm: '„Делта Бау“', ico: '🟦', power: 0.85 }],
  '🇺🇸': [{ id: 'liberty', nm: '„Либърти Билдърс“', ico: '🟦', power: 1.0 }, { id: 'goldengate', nm: '„Голдън Гейт Констракшън“', ico: '🟥', power: 0.95 }, { id: 'hudson', nm: '„Хъдсън Тауърс“', ico: '⬛', power: 0.9 }],
  '🇨🇳': [{ id: 'longcheng', nm: '„Лунчен Строй“', ico: '🟥', power: 1.0 }, { id: 'huanghe', nm: '„Хуанхъ Билд“', ico: '🟨', power: 0.95 }],
  '🇪🇬': [{ id: 'nile', nm: '„Нил Контрактинг“', ico: '🟨', power: 0.95 }, { id: 'pharaon', nm: '„Фараон Билд“', ico: '🟥', power: 0.85 }],
  '🇿🇦': [{ id: 'table', nm: '„Тейбъл Маунтин Констракшън“', ico: '🟩', power: 0.95 }, { id: 'springbok', nm: '„Спрингбок Билд“', ico: '🟨', power: 0.85 }],
  '🇲🇦': [{ id: 'atlas', nm: '„Атлас Бати“', ico: '🟥', power: 0.85 }, { id: 'medina', nm: '„Медина Констрюксион“', ico: '🟩', power: 0.75 }],
  '🇩🇿': [{ id: 'sahara', nm: '„Сахара Траво“', ico: '🟨', power: 0.85 }, { id: 'kasbah', nm: '„Казба Билд“', ico: '🟩', power: 0.75 }],
  '🇹🇳': [{ id: 'carthage', nm: '„Картаген Констрюксион“', ico: '🟥', power: 0.8 }, { id: 'jasmin', nm: '„Жасмин Бати“', ico: '⬜', power: 0.7 }],
  '🇸🇳': [{ id: 'baobab', nm: '„Баобаб Констрюксион“', ico: '🟩', power: 0.75 }, { id: 'teranga', nm: '„Теранга Билд“', ico: '🟨', power: 0.7 }],
  '🇬🇭': [{ id: 'goldcoast', nm: '„Голд Коуст Билдърс“', ico: '🟨', power: 0.8 }, { id: 'ashanti', nm: '„Ашанти Констракшън“', ico: '🟥', power: 0.75 }],
  '🇳🇬': [{ id: 'niger', nm: '„Нигер Делта Констракшън“', ico: '🟩', power: 0.9 }, { id: 'eko', nm: '„Еко Тауърс“', ico: '⬜', power: 0.85 }, { id: 'zuma', nm: '„Зума Рок Билд“', ico: '🟥', power: 0.8 }],
  '🇪🇹': [{ id: 'abay', nm: '„Абай Констракшън“', ico: '🟩', power: 0.8 }, { id: 'lalibela', nm: '„Лалибела Билд“', ico: '🟨', power: 0.7 }],
  '🇰🇪': [{ id: 'savanna', nm: '„Савана Билдърс“', ico: '🟨', power: 0.85 }, { id: 'kilima', nm: '„Килима Констракшън“', ico: '🟥', power: 0.75 }],
  '🇹🇿': [{ id: 'serengeti', nm: '„Серенгети Билд“', ico: '🟩', power: 0.8 }, { id: 'swahili', nm: '„Суахили Констракшън“', ico: '🟦', power: 0.7 }],
  '🇦🇴': [{ id: 'kwanza', nm: '„Кванза Конструсойнш“', ico: '🟥', power: 0.8 }, { id: 'atlantico', nm: '„Атлантико Обраш“', ico: '🟦', power: 0.7 }],
  '🇨🇩': [{ id: 'congo', nm: '„Конго Ривър Билд“', ico: '🟦', power: 0.8 }, { id: 'katanga', nm: '„Катанга Констрюксион“', ico: '🟨', power: 0.75 }],
  '🇨🇦': [{ id: 'maple', nm: '„Мейпъл Лийф Констракшън“', ico: '🟥', power: 0.95 }, { id: 'yukon', nm: '„Юкон Билдърс“', ico: '⬜', power: 0.85 }],
  '🇲🇽': [{ id: 'azteca', nm: '„Ацтека Конструкторес“', ico: '🟩', power: 0.9 }, { id: 'sierra', nm: '„Сиера Мадре Обрас“', ico: '🟥', power: 0.8 }],
  '🇬🇹': [{ id: 'quetzal', nm: '„Кецал Конструксионес“', ico: '🟩', power: 0.75 }, { id: 'tikal', nm: '„Тикал Билд“', ico: '🟦', power: 0.7 }],
  '🇨🇷': [{ id: 'puravida', nm: '„Пура Вида Обрас“', ico: '🟩', power: 0.75 }, { id: 'arenal', nm: '„Аренал Констракшън“', ico: '🟥', power: 0.7 }],
  '🇵🇦': [{ id: 'canal', nm: '„Канал Конструксионес“', ico: '🟦', power: 0.85 }, { id: 'istmo', nm: '„Истмо Билд“', ico: '🟥', power: 0.75 }],
  '🇨🇺': [{ id: 'caribe', nm: '„Карибе Конструксионес“', ico: '🟥', power: 0.75 }, { id: 'malecon', nm: '„Малекон Обрас“', ico: '🟦', power: 0.7 }],
  '🇩🇴': [{ id: 'hispaniola', nm: '„Испаньола Билд“', ico: '🟦', power: 0.75 }, { id: 'ozama', nm: '„Осама Конструксионес“', ico: '🟥', power: 0.7 }],
  '🇷🇺': [{ id: 'kreml', nm: '„Кремъл Строй“', ico: '🟥', power: 1.0 }, { id: 'volga', nm: '„Волга Строй“', ico: '🟦', power: 0.9 }, { id: 'neva', nm: '„Нева Инжиниринг“', ico: '⬜', power: 0.85 }],
  '🇺🇦': [{ id: 'dniprobud', nm: '„Днипро Буд“', ico: '🟦', power: 0.9 }, { id: 'karpaty', nm: '„Карпати Инжиниринг“', ico: '🟨', power: 0.8 }, { id: 'kozak', nm: '„Козак Билд“', ico: '🟩', power: 0.75 }],
  '🇧🇷': [{ id: 'amazonia', nm: '„Амазония Конструсойнш“', ico: '🟩', power: 1.0 }, { id: 'corcovado', nm: '„Корковадо Обраш“', ico: '🟨', power: 0.9 }],
  '🇦🇷': [{ id: 'pampa', nm: '„Пампа Конструксионес“', ico: '🟦', power: 0.9 }, { id: 'tango', nm: '„Танго Билд“', ico: '⬜', power: 0.8 }],
  '🇨🇴': [{ id: 'andina', nm: '„Андина Конструксионес“', ico: '🟨', power: 0.85 }, { id: 'cafetero', nm: '„Кафетеро Обрас“', ico: '🟥', power: 0.75 }],
  '🇻🇪': [{ id: 'orinoco', nm: '„Ориноко Конструксионес“', ico: '🟥', power: 0.8 }, { id: 'avila', nm: '„Авила Билд“', ico: '🟦', power: 0.7 }],
  '🇪🇨': [{ id: 'chimborazo', nm: '„Чимборасо Обрас“', ico: '🟨', power: 0.75 }, { id: 'galapagos', nm: '„Галапагос Билд“', ico: '🟩', power: 0.7 }],
  '🇵🇪': [{ id: 'inca', nm: '„Инка Конструксионес“', ico: '🟥', power: 0.85 }, { id: 'machu', nm: '„Мачу Пикчу Обрас“', ico: '⬜', power: 0.75 }],
  '🇨🇱': [{ id: 'cordillera', nm: '„Кордилера Конструксионес“', ico: '🟦', power: 0.9 }, { id: 'atacama', nm: '„Атакама Билд“', ico: '🟥', power: 0.8 }],
  '🇹🇭': [{ id: 'siam', nm: '„Сиам Конструкшън“', ico: '🟨', power: 0.85 }, { id: 'chao', nm: '„Чао Прая Билд“', ico: '🟦', power: 0.75 }],
  '🇻🇳': [{ id: 'mekong', nm: '„Меконг Конструкшън“', ico: '🟥', power: 0.85 }, { id: 'halong', nm: '„Халонг Билд“', ico: '🟨', power: 0.75 }],
  '🇲🇾': [{ id: 'petronas', nm: '„Близнаци Билдърс“', ico: '🟦', power: 0.9 }, { id: 'borneo', nm: '„Борнео Конструкшън“', ico: '🟩', power: 0.75 }],
  '🇮🇩': [{ id: 'nusantara', nm: '„Нусантара Конструкси“', ico: '🟥', power: 0.85 }, { id: 'garuda', nm: '„Гаруда Билд“', ico: '🟨', power: 0.8 }],
  '🇵🇭': [{ id: 'luzon', nm: '„Лусон Билдърс“', ico: '🟦', power: 0.8 }, { id: 'visayas', nm: '„Висаяс Конструкшън“', ico: '🟥', power: 0.7 }],
  '🇸🇦': [{ id: 'nejd', nm: '„Неджд Контрактинг“', ico: '🟩', power: 1.0 }, { id: 'hijaz', nm: '„Хиджаз Билд“', ico: '⬜', power: 0.9 }],
  '🇦🇪': [{ id: 'emirates', nm: '„Емирейтс Тауърс“', ico: '🟨', power: 1.0 }, { id: 'falcon', nm: '„Фалкън Билд“', ico: '🟥', power: 0.9 }],
  '🇮🇳': [{ id: 'ganga', nm: '„Ганга Инфра“', ico: '🟧', power: 0.95 }, { id: 'deccan', nm: '„Декан Конструкшън“', ico: '🟩', power: 0.85 }],
  '🇰🇷': [{ id: 'hangang', nm: '„Хан Ривър Е&С“', ico: '🟦', power: 1.0 }, { id: 'jeju', nm: '„Чеджу Билд“', ico: '🟥', power: 0.85 }],
  '🇦🇺': [{ id: 'outback', nm: '„Аутбек Билдърс“', ico: '🟧', power: 0.95 }, { id: 'harbour', nm: '„Харбър Бридж Констракшън“', ico: '🟦', power: 0.9 }],
  '🇳🇿': [{ id: 'kiwi', nm: '„Киуи Констракшън“', ico: '⬛', power: 0.85 }, { id: 'aoraki', nm: '„Аораки Билд“', ico: '⬜', power: 0.75 }],
  '🇯🇵': [{ id: 'sakura', nm: '„Сакура Кенсецу“', ico: '🟥', power: 1.0 }, { id: 'fuji', nm: '„Фуджи Билд“', ico: '⬜', power: 0.9 }],
};
// още фирми — по 3–4 в държава (и в държавите, които нямаха); имената са измислени
const F = (id, nm, ico, power) => ({ id, nm, ico, power });
const MORE_FIRMS = {
  '🇷🇴': [F('bucuresti', '„Букурещ Глобал Констракт“', '🟩', 0.85)],
  '🇬🇷': [F('pireas', '„Пирея Конструкшънс“', '🟩', 0.8)],
  '🇷🇸': [F('beograd', '„Београд Градня“', '🟨', 0.8), F('fruska', '„Фрушка Гора Билд“', '🟩', 0.7)],
  '🇲🇰': [F('skopje', '„Скопие Инженеринг“', '🟨', 0.75)],
  '🇩🇪': [F('hanse', '„Ханзе Бау“', '🟨', 0.9), F('schwarzwald', '„Шварцвалд Холцбау“', '🟩', 0.85)],
  '🇫🇷': [F('alpes', '„Алп Траво“', '⬜', 0.85), F('provence', '„Прованс Бати“', '🟨', 0.8)],
  '🇬🇧': [F('windsor', '„Уиндзор Билдинг Груп“', '🟨', 0.85), F('highland', '„Хайленд Констракшън“', '🟩', 0.8)],
  '🇮🇹': [F('colosseo', '„Колизео Костручони“', '🟨', 0.9), F('dolomiti', '„Доломити Едиле“', '⬜', 0.8)],
  '🇪🇸': [F('sagrada', '„Саграда Обрас“', '🟦', 0.9), F('andalucia', '„Андалусия Конструкта“', '🟩', 0.8)],
  '🇳🇱': [F('tulip', '„Тюлип Бау“', '🟥', 0.85), F('windmolen', '„Виндмолен Груп“', '⬜', 0.75)],
  '🇧🇪': [F('atomium', '„Атомиум Констрюксион“', '⬜', 0.9), F('flandre', '„Фландрия Бау“', '🟨', 0.8), F('ardennes', '„Арден Бати“', '🟩', 0.75)],
  '🇱🇺': [F('lux', '„Люкс Констрюксион“', '🟦', 0.85), F('moselle', '„Мозел Бау“', '🟥', 0.75), F('grandduc', '„Гранд Дюк Билд“', '🟨', 0.7)],
  '🇨🇿': [F('vltava', '„Вълтава Стави“', '🟦', 0.9), F('bohemia', '„Бохемия Строй“', '🟥', 0.85), F('morava2', '„Моравия Бау“', '🟨', 0.75)],
  '🇦🇹': [F('donau', '„Донау Бау“', '🟥', 0.95), F('tirol', '„Тирол Бау“', '⬜', 0.85), F('wienerberg', '„Винерберг Хох“', '🟦', 0.8)],
  '🇭🇺': [F('duna', '„Дуна Епитьо“', '🟩', 0.85), F('balaton', '„Балатон Билд“', '🟦', 0.8), F('puszta', '„Пуста Строй“', '🟥', 0.7)],
  '🇵🇱': [F('wisla', '„Висла Будова“', '🟥', 0.9), F('tatry', '„Татри Конструкция“', '⬜', 0.85), F('baltyk', '„Балтик Будова“', '🟦', 0.8)],
  '🇨🇭': [F('matterhorn', '„Матерхорн Бау“', '🟥', 0.95), F('lemanic', '„Леман Констрюксион“', '🟦', 0.9), F('gotthard', '„Готард Тунелбау“', '⬜', 0.85)],
  '🇷🇺': [F('ural', '„Урал Строй“', '🟨', 0.8)],
  '🇺🇦': [F('kyivbud', '„Київ Буд“', '🟨', 0.8)],
  '🇺🇸': [F('empire', '„Емпайър Стейт Билдърс“', '🟨', 0.95)],
  '🇨🇦': [F('niagara', '„Ниагара Констракшън“', '🟦', 0.85)],
  '🇲🇽': [F('maya', '„Мая Конструксионес“', '🟨', 0.8)],
  '🇧🇷': [F('ipanema', '„Ипанема Обраш“', '🟦', 0.85)],
  '🇦🇷': [F('andesar', '„Андес Конструксионес“', '🟥', 0.8)],
  '🇨🇳': [F('greatwall', '„Великата стена Строй“', '🟥', 0.95), F('yangtze', '„Яндзъ Билд“', '🟦', 0.9)],
  '🇯🇵': [F('shinkansen', '„Шинкансен Кенсецу“', '🟦', 0.95), F('osakab', '„Осака Билд“', '🟨', 0.85)],
  '🇰🇷': [F('hanok', '„Ханок Е&С“', '🟨', 0.85)],
  '🇮🇳': [F('himalaya', '„Хималая Инфра“', '🟦', 0.85)],
  '🇦🇪': [F('desert', '„Дезърт Роуз Девелъпмънт“', '🟦', 0.9)],
  '🇸🇬': [F('lion', '„Лайън Сити Билдърс“', '🟥', 1.0), F('marina', '„Марина Бей Констракшън“', '🟦', 0.95), F('sentosa', '„Сентоза Девелъпмънт“', '🟩', 0.85)],
  '🇦🇺': [F('koala', '„Коала Констракшън“', '⬜', 0.8)],
  '🇳🇿': [F('tasman', '„Тасман Билд“', '🟦', 0.75)],
  '🇪🇬': [F('pyramid', '„Пирамида Контрактинг“', '🟧', 0.85)],
  '🇿🇦': [F('kruger', '„Крюгер Констракшън“', '🟥', 0.8)],
  '🇳🇬': [F('lagosb', '„Лагос Скайлайн“', '🟨', 0.85)],
  '🇹🇳': [F('medjerda', '„Меджерда Бати“', '🟦', 0.65)], '🇸🇳': [F('goree', '„Горе Констрюксион“', '🟥', 0.65)], '🇬🇭': [F('volta', '„Волта Билдърс“', '🟦', 0.7)],
  '🇪🇹': [F('simien', '„Симиен Констракшън“', '🟥', 0.65)], '🇹🇿': [F('kilimanjaro', '„Килиманджаро Билд“', '🟨', 0.7)], '🇦🇴': [F('cuanza', '„Куанза Обраш“', '🟨', 0.65)],
  '🇨🇩': [F('ituri', '„Итури Конструксион“', '🟩', 0.65)], '🇬🇹': [F('atitlan', '„Атитлан Обрас“', '🟨', 0.65)], '🇨🇷': [F('tortuguero', '„Тортугеро Билд“', '🟦', 0.65)],
  '🇵🇦': [F('balboa', '„Балбоа Конструксионес“', '🟨', 0.7)], '🇨🇺': [F('habana', '„Хабана Вьеха Обрас“', '🟨', 0.65)], '🇩🇴': [F('cibao', '„Сибао Конструксионес“', '🟩', 0.65)],
  '🇨🇴': [F('magdalena', '„Магдалена Обрас“', '🟦', 0.7)], '🇻🇪': [F('angel', '„Салто Анхел Билд“', '🟩', 0.65)], '🇪🇨': [F('cotopaxi', '„Котопакси Конструксионес“', '🟥', 0.65)],
  '🇵🇪': [F('titicaca', '„Титикака Обрас“', '🟦', 0.7)], '🇨🇱': [F('patagonia', '„Патагония Конструксионес“', '🟩', 0.75)], '🇻🇳': [F('saigon', '„Сайгон Девелъпмънт“', '🟦', 0.75)],
  '🇲🇾': [F('genting', '„Гентинг Билдърс“', '🟥', 0.75)], '🇮🇩': [F('borobudur', '„Боробудур Билд“', '🟩', 0.75)], '🇵🇭': [F('mayon', '„Майон Констракшън“', '🟩', 0.7)],
  '🇲🇦': [F('rif', '„Риф Констрюксион“', '🟨', 0.7)], '🇩🇿': [F('tassili', '„Тасили Бати“', '🟥', 0.7)],
  '🇰🇪': [F('rift', '„Рифт Вали Билдърс“', '🟩', 0.7)], '🇹🇭': [F('krung', '„Крунг Тхеп Девелъпмънт“', '🟥', 0.8)], '🇸🇦': [F('rub', '„Руб ал-Хали Контрактинг“', '🟨', 0.85)],
};
for (const [cc, list] of Object.entries(MORE_FIRMS)) LOCAL_FIRMS[cc] = [...(LOCAL_FIRMS[cc] || []), ...list];
export const ALL_FIRMS = [...FIRMS, ...Object.values(LOCAL_FIRMS).flat()];
// фирмите, които се борят за поръчки в даден град (по знамето на града; без местни — българските)
export const firmsFor = cc => (cc && LOCAL_FIRMS[cc]) || FIRMS;
const firmById = id => ALL_FIRMS.find(f => f.id === id) || FIRMS[0];

export function createRivals(deps) {
  const st = () => { const S = deps.S(); S.rivals = S.rivals || { firms: {}, sites: [] }; return S.rivals; };
  // при нова оферта: с някакъв шанс конкурент също я иска (по-често за по-големите и при по-висока репутация на пазара)
  function attach(o) {
    const S = deps.S(), big = { house: 0.25, shop: 0.4, office: 0.5, tower: 0.6 }[o.type] ?? 0.3;
    if (Math.random() > big * (0.6 + 0.1 * Math.min(4, S.day / 60))) return o;
    const list = firmsFor(deps.cc && deps.cc()).filter(x => !(deps.acquired && deps.acquired(x.id))), f = list[(Math.random() * list.length) | 0];   // изкупените (corp.js) вече не се борят
    if (!f) return o;
    o.rival = { firm: f.id, nm: f.nm, ico: f.ico, day: S.day + 1 + ((Math.random() * 2) | 0), bid: Math.round(o.reward * (0.88 + Math.random() * 0.08) / 500) * 500 };
    return o;
  }
  // всеки ден: конкурентите вземат офертите, чийто срок е изтекъл; връща взетите (game.js ги маха от таблото)
  function dailyTick(offers) {
    const S = deps.S(), s = st(), taken = [];
    for (const o of offers) {
      if (!o.rival || S.day < o.rival.day) continue;
      taken.push(o);
      const f = firmById(o.rival.firm);
      s.firms[f.id] = s.firms[f.id] || { won: 0 }; s.firms[f.id].won++;
      s.sites.push({ city: S.cityId, lot: o.lot, firm: f.id, type: o.type, ready: S.day + Math.round({ house: 6, shop: 9, office: 14, tower: 22 }[o.type] / f.power) });
      deps.toast(`${f.ico} ${f.nm} взе поръчката „${o.client}“ (${deps.fmt(o.rival.bid)} €) — изпревари те!`, 'bad');
    }
    for (const site of [...s.sites]) if (S.day >= site.ready && (site.city || S.cityId) === S.cityId) { s.sites.splice(s.sites.indexOf(site), 1); deps.onBuilt(site.lot, site.type, firmById(site.firm)); }
    return taken;
  }
  const busyLots = () => st().sites.filter(x => (x.city || deps.S().cityId) === deps.S().cityId).map(x => x.lot);
  // делът на пазара (за таба „Поръчки“)
  function marketHtml() {
    const s = st(), mine = deps.S().done || 0;
    const rows = firmsFor(deps.cc && deps.cc()).map(f => ({ f, n: (s.firms[f.id] || {}).won || 0 })).filter(r => r.n);
    if (!rows.length) return '';
    const total = mine + rows.reduce((a, r) => a + r.n, 0) || 1;
    return `<div class="card" style="padding:9px 11px"><b>🏁 Конкуренция</b><div class="meta">Твоят дял: <b style="color:var(--ok)">${Math.round(mine / total * 100)}%</b> · ${rows.map(r => `${r.f.ico} ${r.f.nm} ${Math.round(r.n / total * 100)}%`).join(' · ')}</div></div>`;
  }
  // ред в картичката на офертата
  function offerLine(o) {
    if (!o.rival) return '';
    const left = o.rival.day - deps.S().day;
    return `<div class="meta" style="color:#ffb46b">${o.rival.ico} ${o.rival.nm} също иска тази поръчка — ще я вземе ${left <= 0 ? 'днес' : left === 1 ? 'утре' : `след ${left} дни`}, ако не я приемеш.</div>`;
  }
  // твоят дял от пазара (0..1) — за „Завърши града“
  function share() {
    const s = st(), own = f => deps.acquired && deps.acquired(f.id), L = firmsFor(deps.cc && deps.cc()), mine = (deps.S().done || 0) + L.filter(own).reduce((a, f) => a + ((s.firms[f.id] || {}).won || 0), 0), theirs = L.filter(f => !own(f)).reduce((a, f) => a + ((s.firms[f.id] || {}).won || 0), 0);   // сградите на изкупените фирми са вече твои
    return mine + theirs ? mine / (mine + theirs) : 1;
  }
  return { attach, dailyTick, busyLots, marketHtml, offerLine, share, firms: FIRMS };
}
