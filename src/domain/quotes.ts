// Цитаты азербайджанских исторических личностей.
// Оригинал — дословно из az.wikiquote.org (в скобках — сборник, на который ссылается страница).
// Русский перевод — подстрочный, сделан для Xalça (кроме отмеченных: там устоявшийся перевод).

export type QuotePlace = 'today' | 'routines' | 'projects' | 'tasks' | 'profile' | 'rankup';

export interface Quote {
  az: string;
  ru: string;
  author: { az: string; ru: string };
  source: string;
  places: QuotePlace[];
}

const NIZAMI = { az: 'Nizami Gəncəvi', ru: 'Низами Гянджеви' };
const NASIMI = { az: 'İmadəddin Nəsimi', ru: 'Имадеддин Насими' };
const FUZULI = { az: 'Məhəmməd Füzuli', ru: 'Мухаммед Физули' };
const SABIR = { az: 'Mirzə Ələkbər Sabir', ru: 'Мирза Алекпер Сабир' };
const CAVID = { az: 'Hüseyn Cavid', ru: 'Гусейн Джавид' };
const VURGUN = { az: 'Səməd Vurğun', ru: 'Самед Вургун' };
const HACIBEYOV = { az: 'Üzeyir Hacıbəyov', ru: 'Узеир Гаджибеков' };

const WQ = 'az.wikiquote.org';

export const QUOTES: Quote[] = [
  {
    az: 'Gecəni, gündüzü çox vermə bada,\nYaxşı ad uğrunda çalış dünyada.',
    ru: 'Не пускай на ветер ни ночей, ни дней —\nтрудись в этом мире ради доброго имени.',
    author: NIZAMI, source: WQ, places: ['today', 'tasks'],
  },
  {
    az: 'Səbr etməklə kişi zindandan çıxar,\nSəbr ilə açılar bağlı qapılar.',
    ru: 'Терпением человек выходит из темницы,\nтерпением отворяются запертые двери.',
    author: NIZAMI, source: WQ, places: ['routines', 'today'],
  },
  {
    az: 'Bilik öyrənməyi ar bilən hər kəs,\nDünyada mərifət qazana bilməz.',
    ru: 'Кто стыдится учиться,\nтот не обретёт в мире мудрости.',
    author: NIZAMI, source: WQ, places: ['projects', 'tasks'],
  },
  {
    az: 'Qüvvət elmdədir, başqa cür heç kəs,\nHeç kəsə üstünlük eyləyə bilməz.',
    ru: 'Сила — в знании; иначе никто\nни над кем не возьмёт верх.',
    author: NIZAMI, source: WQ, places: ['profile', 'projects'],
  },
  {
    az: 'Çalış öz xalqının işinə yara,\nGeysin əməlindən dünya zərxara.',
    ru: 'Старайся быть полезным делу своего народа,\nчтобы от твоих дел мир облёкся в парчу.',
    author: NIZAMI, source: WQ, places: ['projects', 'rankup'],
  },
  {
    az: 'Sükut çox yaxşıdır pis danışmaqdan,\nSükutdan olmayıb heç kəs peşiman.',
    ru: 'Молчание куда лучше дурных речей:\nо молчании ещё никто не пожалел.',
    author: NIZAMI, source: WQ, places: ['tasks'],
  },
  {
    az: 'Dünyaya fateh olmaz zülmkarlıq, rəzalət,\nYer üzünün fatehi ədalətdir, ədalət!',
    ru: 'Не покорить мир тиранством и подлостью —\nпокоритель земли — справедливость, справедливость!',
    author: NIZAMI, source: WQ, places: ['rankup', 'profile'],
  },
  {
    az: 'Məndə sığar iki cahan, mən bu cahanə sığmazam.',
    ru: 'Во мне вместятся оба мира, но в этот мир я не вмещусь.',
    author: NASIMI, source: `${WQ}; рус. — устоявшийся перевод`, places: ['profile', 'rankup'],
  },
  {
    az: 'Dünya duracaq yer deyil, ey can, səfər eylə.',
    ru: 'Мир — не место, чтобы стоять на месте; о душа, пускайся в путь.',
    author: NASIMI, source: WQ, places: ['today', 'projects'],
  },
  {
    az: 'Eşq rəsmin aşiq öyrənmək gərək pərvanədən,\nKim, göyər gördükdə şəm’in atəşi-suzaninə.',
    ru: 'У мотылька влюблённый пусть учится любви, —\nведь мотылька лишь пламя смертельное влечёт.',
    author: FUZULI, source: '«Лейли и Меджнун»; рус. — ru.wikiquote.org', places: ['routines'],
  },
  {
    az: 'Söz mənadan asılıdır, məna sözdən hər zaman,\nBir-birindən asılıdır, necə ki cism ilə can.',
    ru: 'Слово зависит от смысла, а смысл — от слова всегда:\nони связаны, как тело и душа.',
    author: FUZULI, source: `${WQ} («Ağıla və qəlbə işıq saçan sözlər», 2014)`, places: ['tasks'],
  },
  {
    az: 'Açılmamış dəfinədir hər bir canın xəzinəsi,\nİnci saçan dilindədir hər insanın xəzinəsi.',
    ru: 'Сокровище каждой души — нераскрытый клад;\nсокровище человека — в его речи, что рассыпает жемчуг.',
    author: FUZULI, source: `${WQ} («Ağıla və qəlbə işıq saçan sözlər», 2014)`, places: ['profile'],
  },
  {
    az: 'Aləm sədəfində insandan qiymətli bir gövhər görmədim.',
    ru: 'В раковине мироздания я не видел жемчужины дороже человека.',
    author: FUZULI, source: `${WQ} («Ağıla və qəlbə işıq saçan sözlər», 2014)`, places: ['rankup'],
  },
  {
    az: 'Qədrin bil elmi fəzlin,\nElmin yolunda can ver.',
    ru: 'Цени знание и достоинство,\nна пути знания не жалей души.',
    author: SABIR, source: WQ, places: ['projects', 'profile'],
  },
  {
    az: 'Kim ki, insanı sevir, aşiqi-hürriyyət olur,\nBəli, hürriyyət olan yerdə də insanlıq olur.',
    ru: 'Кто любит человека, тот влюблён в свободу;\nда, где свобода — там и человечность.',
    author: SABIR, source: `${WQ} (Z. Məhərrəmov, «Bir bahar küləyi», 2012)`, places: ['profile'],
  },
  {
    az: 'Kitab — sənin ilk dostundur.',
    ru: 'Книга — твой первый друг.',
    author: SABIR, source: WQ, places: ['tasks', 'today'],
  },
  {
    az: 'Bəxtiyarsan, əgər çəkdiyin əmək,\nCahan süfrəsinə versə bir çiçək.',
    ru: 'Ты счастлив, если твой труд\nподарит столу мира хоть один цветок.',
    author: CAVID, source: WQ, places: ['projects', 'today'],
  },
  {
    az: 'Hər qaranlıqda çırpınır bir nur,\nHər həqiqətdə bir xəyal uyuyur.',
    ru: 'В каждой тьме трепещет свет,\nв каждой истине дремлет мечта.',
    author: CAVID, source: WQ, places: ['routines', 'today'],
  },
  {
    az: 'Lazımdırsa cəhalətlə güləşmək,\nBir çarə var, o da yeniləşmək!',
    ru: 'Если нужно бороться с невежеством —\nсредство одно: обновляться!',
    author: CAVID, source: WQ, places: ['routines', 'projects'],
  },
  {
    az: 'Dünyanın ölməyən bir qanunu var,\nBir yandan boşalar, bir yandan dolar.',
    ru: 'У мира есть бессмертный закон:\nс одной стороны пустеет, с другой — наполняется.',
    author: VURGUN, source: `${WQ} (Z. Məhərrəmov, «Bir bahar küləyi», 2012)`, places: ['routines', 'tasks'],
  },
  {
    az: 'Günəşi örtsə də qara buludlar,\nYenə günəş adlı bir qüdrəti var.',
    ru: 'Пусть чёрные тучи закроют солнце —\nу солнца всё равно остаётся его сила.',
    author: VURGUN, source: WQ, places: ['today', 'routines'],
  },
  {
    az: 'Unutmaz tarixin böyük günləri\nDünyaya mərd gəlib, mərd gedənləri.',
    ru: 'Великие дни истории не забывают\nтех, кто достойно пришёл в мир и достойно ушёл.',
    author: VURGUN, source: `${WQ} (Z. Məhərrəmov, «Bir bahar küləyi», 2012)`, places: ['rankup'],
  },
  {
    az: 'Lovğalıq tərəqqinin düşmənidir.',
    ru: 'Хвастовство — враг прогресса.',
    author: HACIBEYOV, source: WQ, places: ['rankup', 'profile'],
  },
  {
    az: 'Müvəffəqiyyət — əldə edilmiş kamillikdir, kamillik isə asanlıqla qazanılmır.',
    ru: 'Успех — это достигнутое совершенство, а совершенство легко не даётся.',
    author: HACIBEYOV, source: WQ, places: ['profile', 'projects'],
  },
];

/** Цитата дня для раздела: меняется раз в сутки, в разных разделах — разные. */
export function quoteFor(place: QuotePlace, day: string, salt = 0): Quote {
  const list = QUOTES.filter((q) => q.places.includes(place));
  let h = salt;
  for (const c of day + place) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return list[Math.abs(h) % list.length];
}
