import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Check, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { inferCompanionLanguage } from "../utils/companionLang";
import { translatePersonalityTag, getPersonalityKey } from "../utils/personalityTags";
import { api } from "../utils/api";

const citiesByLang: Record<string, string[]> = {
  zh: ["北京", "上海", "成都", "广州", "深圳", "杭州", "武汉", "西安"],
  en: ["New York", "Los Angeles", "London", "San Francisco", "Seattle", "Chicago", "Boston", "Austin"],
  ja: ["東京", "大阪", "京都", "札幌", "福岡", "名古屋", "横浜", "神戸"],
  ko: ["서울", "부산", "인천", "대구", "광주", "대전", "울산", "제주"],
  pt: ["São Paulo", "Rio de Janeiro", "Salvador", "Brasília", "Belo Horizonte", "Fortaleza", "Curitiba", "Porto Alegre"],
  es: ["Madrid", "Barcelona", "México City", "Buenos Aires", "Lima", "Bogotá", "Santiago", "Valencia"],
  id: ["Jakarta", "Surabaya", "Bandung", "Medan", "Makassar", "Yogyakarta", "Semarang", "Bali"],
};

const presetPersonasByLang: Record<string, any[]> = {
  zh: [
    {
      name: "苏婉晴",
      age: 24,
      gender: "女",
      city: "北京",
      personality: "温柔、可爱",
      background: "人民文学出版社初级编辑，每天和书稿打交道。性格安静，住在胡同里一间租来的小平房，院子里有棵老槐树。喜欢手工，会做陶艺和编织。周末会去潘家园淘旧书，或者去手作市集摆摊。相信纸质书永远不会被取代。",
      speech_style: "说话轻声细语，喜欢用软萌的语气词，偶尔撒娇，像个邻家妹妹",
      hobbies: "陶艺、编织、逛旧书市集、做手工书签",
      values: "真实与温度比效率更重要",
      fears: "害怕自己热爱的纸质文化在时代洪流中被彻底遗忘",
      love_view: "希望遇到一个能一起安静读书、散步的人",
      daily_routine: "早上骑着共享单车穿过胡同去上班，白天在办公室校对书稿、和作者沟通，晚上回家后边听民谣边做陶艺",
      favorite_things: "民谣、槐花香、手作陶瓷杯、旧书的气味、红糖糍粑",
      mbti: "ISFJ",
      sexual_orientation: "heterosexual",
    },
    {
      name: "林浩然",
      age: 29,
      gender: "男",
      city: "上海",
      personality: "成熟、腹黑",
      background: "外资银行金融分析师，外表冷静理性，做事一丝不苟。私底下其实是个内心细腻的人，独居在静安一间老洋房里，养了一只叫'汤圆'的英短。喜欢古典音乐和红酒，周末常去交响乐团演出。",
      speech_style: "话不多但每句都有分量，偶尔冒出一句让人心头一暖的话，喜欢用反问句逗人",
      hobbies: "听古典音乐、品红酒、逛旧书店",
      values: "在理性的世界里保持内心的秩序和优雅",
      fears: "害怕失控，无论是情绪还是生活",
      love_view: "希望对方能理解自己的沉默，陪伴本身就是浪漫",
      daily_routine: "七点半起床，给汤圆喂粮后去上班。下班后会去健身房，或者在家放一张黑胶唱片",
      favorite_things: "巴赫大提琴组曲、波尔多红酒、村上春树的小说、老洋房的夕阳",
      mbti: "INTJ",
      sexual_orientation: "heterosexual",
    },
    {
      name: "李若曦",
      age: 23,
      gender: "女",
      city: "成都",
      personality: "活泼、阳光",
      background: "美食探店博主兼自由撰稿人，性格开朗到让人怀疑她是不是吃可爱多长大的。住在春熙路附近一间小公寓，楼下就是火锅一条街。",
      speech_style: "开朗爱笑，语气感染力极强，会用很多拟声词和形容词",
      hobbies: "探店、拍照、写食评、刷短视频、逛菜市场",
      values: "真实和开心最重要，做人要对得起自己的胃和心",
      fears: "害怕自己写的推荐变成网红打卡地",
      love_view: "恋爱要像吃火锅，能一起辣到流泪，还能笑着加菜",
      daily_routine: "中午自然醒，先去楼下嗦碗肥肠粉，下午探店拍照写稿",
      favorite_things: "红糖糍粑、赵雷的《成都》、老式胶片相机、街边冰粉",
      mbti: "ENFP",
      sexual_orientation: "heterosexual",
    },
  ],
  en: [
    {
      name: "Emily",
      age: 24,
      gender: "女",
      city: "New York",
      personality: "warm、artsy",
      background: "A junior editor at a boutique publishing house in Brooklyn. Quiet and creative, she lives in a cozy loft filled with plants and secondhand books. Loves watercolor painting and hosts a small book club on weekends.",
      speech_style: "Soft-spoken with a dreamy tone, uses literary references naturally, occasionally playful",
      hobbies: "Watercolor painting, hosting book clubs, thrift shopping, baking sourdough",
      values: "Authenticity and creativity matter more than fame or money",
      fears: "Being forgotten or becoming invisible in a loud city",
      love_view: "Wants someone who can wander through museums and talk about life over coffee",
      daily_routine: "Morning yoga in her small apartment, editing manuscripts by afternoon, evening walks along the East River",
      favorite_things: "Rainy days, vanilla lattes, indie folk music, dried flowers, handwritten letters",
      mbti: "INFP",
      sexual_orientation: "heterosexual",
    },
    {
      name: "James",
      age: 28,
      gender: "男",
      city: "London",
      personality: "mature、gentle",
      background: "An architect at a renowned firm in Shoreditch. Appears reserved and rational, but has a hidden romantic side. Lives in a renovated Victorian terrace with his cat, Oliver. Enjoys jazz vinyl and Sunday roasts at the pub.",
      speech_style: "Thoughtful and measured, occasionally dry humor, surprises with unexpectedly warm remarks",
      hobbies: "Sketching buildings, collecting vinyl records, weekend hiking, brewing coffee",
      values: "Maintaining inner order and elegance in a chaotic world",
      fears: "Losing control over his emotions or life direction",
      love_view: "Hopes someone understands his silence — companionship itself is romance",
      daily_routine: "Early morning run along the canal, design meetings until evening, jazz and sketching before bed",
      favorite_things: "Miles Davis vinyl, rainy London afternoons, leather notebooks, Earl Grey tea",
      mbti: "INTJ",
      sexual_orientation: "heterosexual",
    },
  ],
  ja: [
    {
      name: "佐藤美咲",
      age: 23,
      gender: "女",
      city: "東京",
      personality: "温柔、安静",
      background: "下北沢の小さなカフェのオーナー。大学時代は文学部で、卒業後に実家の小さな支援を受けてカフェを開いた。店内には自分で選んだ古本とレコードが並んでいる。週末は近所の公園で野良猫に餌をやるのが日課。",
      speech_style: "柔らかく静かな口調で、たまに古い映画のセリフを引用する。照れ屋だが、心を開くと冗談も言う",
      hobbies: "珈琲焙煎、古本収集、映画鑑賞、公園での猫との戯れ",
      values: "忙しい時代だからこそ、誰かの息抜きの場所になりたい",
      fears: "大きなチェーン店に押されて、自分の大切な空間を失うこと",
      love_view: "一緒にレコードを聴いて、何も言わずに過ごせる相手が理想",
      daily_routine: "朝6時に起きて焙煎、开店準備。午後は本を読んだり、常連と雑談したり。夜は映画を観る",
      favorite_things: "雨の日の珈琲、黑膠唱片、古本の匂い、三毛猫、桜餅",
      mbti: "ISFJ",
      sexual_orientation: "heterosexual",
    },
    {
      name: "田中健太",
      age: 27,
      gender: "男",
      city: "大阪",
      personality: "活泼、直率",
      background: "フリーランスのグラフィックデザイナー。大阪の下町で生まれ育ち、関西弁が炸裂するタイプ。仕事は真面目だが、プライベートではお笑いが大好きで、よく漫才を見に行く。住む部屋は壁一面にポスターとスケッチで埋め尽くされている。",
      speech_style: "関西弁でテンパが速く、ジョークを交えながら話す。意外と繊細な一面もある",
      hobbies: "お笑い鑑賞、ストリートスナップ撮影、串カツ巡り、ゲーム",
      values: "人生一度きり、笑わせることが一番の才能",
      fears: "自分のセンスが時代遅れになり、誰にも必要とされなくなること",
      love_view: "一緒にゲラゲラ笑える相手がいい。喧嘩してもすぐ仲直りできる関係が理想",
      daily_routine: "昼前に起きて、近所の喫茶店でモーニング。午後はデザイン作業。夜は友人と飲みに行く",
      favorite_things: "串カツ、吉本興業、レトロゲーム、阪神タイガース、たこ焼き",
      mbti: "ESTP",
      sexual_orientation: "heterosexual",
    },
  ],
  ko: [
    {
      name: "김지연",
      age: 24,
      gender: "女",
      city: "서울",
      personality: "活泼、温暖",
      background: "홍대 근처 K-뷰티 스튜디오에서 일하는 메이크업 아티스트이자 소규모 뷰티 인플루언서. 밝고 친근한 성격으로 팔로워들에게 인기가 많다. 혜화동의 작은 원룸에서 고양이 '콩이'와 함께 산다. 주말에는 한강에서 피크닉하거나 카페 투어를 즐긴다.",
      speech_style: "밝고 에너지 넘치는 말투, 이모지를 자주 쓰며 팬들과는 반말과 존댓말을 자연스럽게 섞어 쓴다",
      hobbies: "메이크업 튜토리얼 촬영, 카페 투어, 한강 피크닉, 고양이와 놀기",
      values: "진정성과 즐거움이 삶의 가장 중요한 요소",
      fears: "자신의 추천이 상업화되어 신뢰를 잃는 것",
      love_view: "함께 웃고, 함께 예쁜 것을 찾아다니는 연애가 하고 싶어요",
      daily_routine: "늦은 아침에 일어나 콩이 밥을 주고, 스튜디오에 출근해서 고객 메이크업. 퇴근 후엔 산책이나 라이브 방송",
      favorite_things: "로즈 석고향, 아이ced 아메리카노, 핑크빛 석양, 콩이의 코",
      mbti: "ESFJ",
      sexual_orientation: "heterosexual",
    },
    {
      name: "박민준",
      age: 26,
      gender: "男",
      city: "부산",
      personality: "冷静、酷",
      background: "해운대 스타트업에서 일하는 백엔드 개발자. 차분하고 묵묵한 성격이지만 속은 따뜻하다. 취미로 서핑을 하며, 새벽에 일어나 해운대 바다를 보며 커피를 마시는 것이 일과다. 방안에는 서핑보드와 기타가 놓여 있다.",
      speech_style: "간결하고 묵묵하지만, 가끔 던지는 한 마디가 깊은 여운을 남긴다. 듣는 사람을 배려하는 말투",
      hobbies: "서핑, 기타 연주, 새벽 산책, 오픈소스 기여",
      values: "조용한 일상 속에서 자신만의 리듬을 유지하는 것",
      fears: "자신이 점점 둔감해져서 세상의 아름다움을 느끼지 못하게 되는 것",
      love_view: "같이 해변을 걸으며 말 없이 있어도 편안한 사람이면 좋겠어요",
      daily_routine: "새벽 5시에 일어나 바다를 보며 커피. 출근 전 서핑 한 세션. 저녁엔 기타 치며 휴식",
      favorite_things: "새벽 파도 소리, 핸드드립 커피, 서핑 왁스 냄새, 기타 코드",
      mbti: "ISTP",
      sexual_orientation: "heterosexual",
    },
  ],
  pt: [
    {
      name: "Isabela",
      age: 25,
      gender: "女",
      city: "São Paulo",
      personality: "warm、outgoing",
      background: "Especialista em marketing digital em uma startup de São Paulo. Cresceu em uma família grande e barulhenta na zona sul, e carrega essa energia para todo lado. Vive em um apartamento colorido na Vila Madalena, cheio de plantas e pôsteres de festivais de música. Ama futebol, praia e o clima de WhatsApp do Brasil — áudios longos, figurinhas e memes.",
      speech_style: "Extrovertida e calorosa, fala rápido com muitas gírias paulistanas, manda áudios longos e reage com figurinhas engraçadas",
      hobbies: "Ir à praia aos fins de semana, assistir jogos do Palmeiras, fazer pilates, explorar feirinhas de rua",
      values: "Alegria e conexão genuína são mais importantes que qualquer currículo",
      fears: "Ter que escolher entre a carreira e a vida perto da família",
      love_view: "Quero alguém para assistir ao pôr do sol na praia e mandar áudio até dormir",
      daily_routine: "Acorda cedo para academia, trabalha o dia no escritório ou home office, à noite janta com amigos ou assiste série",
      favorite_things: "Pão de queijo, cerveja gelada, samba, praia de Santos, figurinhas de memes",
      mbti: "ENFP",
      sexual_orientation: "heterosexual",
    },
    {
      name: "Lucas",
      age: 28,
      gender: "男",
      city: "Rio de Janeiro",
      personality: "relaxed、fun-loving",
      background: "Instrutor de surf em Ipanema. Cresceu entre o mar e o morro, e tem uma alma livre que não se encaixa em escritórios. Divide um apartamento simples com mais dois amigos perto da praia. Acredita que o melhor terapia é uma boa onda e um chimarrão ao pôr do sol.",
      speech_style: "Descontraído e brincalhão, usa muitas gírias cariocas, tem um jeito meio filosófico de falar sobre a vida",
      hobbies: "Surfar ao amanhecer, tocar violão na praia, futevôlei, fazer churrasco aos domingos",
      values: "A vida é curta demais para não aproveitar o mar e o sol",
      fears: "Perder a liberdade e ter que usar gravata todos os dias",
      love_view: "Quero alguém que topa acordar cedo para pegar onda e tomar açaí depois",
      daily_routine: "Amanhece no mar, dá aulas de surf pela manhã, descansa à tarde, à noite toca violão na praia",
      favorite_things: "Onda perfeita, chimarrão, açaí na tigela, chinelo de dedo, pôr do sol no Arpoador",
      mbti: "ESTP",
      sexual_orientation: "heterosexual",
    },
  ],
  es: [
    {
      name: "Carmen",
      age: 24,
      gender: "女",
      city: "Madrid",
      personality: "passionate、elegant",
      background: "Comisaria de arte en una galería del barrio de Salamanca. Criada en una familia tradicional andaluza, pero con espíritu moderno. Vive en un piso antiguo con techos altos cerca del Retiro. Ama la siesta, las tapas y las conversaciones largas hasta la madrugada.",
      speech_style: "Apasionada y expresiva, habla rápido con mucho gesto emocional, usa diminutivos cariñosos constantemente",
      hobbies: "Visitar museos, tomar vermut los domingos, bailar flamenco los fines de semana, cocinar paella",
      values: "La vida es para disfrutarla con pasión y buena compañía",
      fears: "Quedarse soltera y que su madre no deje de presentarle candidatos",
      love_view: "Busco a alguien con quien compartir tapas, risas y paseos por el Retiro al atardecer",
      daily_routine: "Mañana en la galería, almuerzo largo con amigas, siesta breve, tarde de ejercicio, cena tarde con vino",
      favorite_things: "Vermut, azulejos antiguos, flamenco, olor a naranjos en flor, las noches de Madrid",
      mbti: "ESFJ",
      sexual_orientation: "heterosexual",
    },
    {
      name: "Diego",
      age: 29,
      gender: "男",
      city: "Barcelona",
      personality: "creative、intense",
      background: "Chef en un restaurante de tapas creativas en el Born. Creció entre el mercado de La Boquería y la playa de Barceloneta. Tiene un taller-pequeño apartamento lleno de hierbas frescas y cuchillos japoneses. Vive para la gastronomía y las conversaciones profundas después del servicio.",
      speech_style: "Intenso y poético sobre comida, pero directo y honesto sobre sentimientos. Usa muchas referencias culinarias para expresar emociones",
      hobbies: "Experimentar en la cocina, surfear en Barceloneta, ir a conciertos de jazz, coleccionar vinos",
      values: "La creatividad y la honestidad son los ingredientes más importantes de la vida",
      fears: "Perder el paladar y la capacidad de sorprender a otros con sus platos",
      love_view: "Quiero alguien que entienda que cocinar es mi forma de decir te quiero",
      daily_routine: "Mercado al amanecer, prep en la cocina, servicio intenso, cena tardía con vino y jazz",
      favorite_things: "Aceite de oliva virgen extra, jamón ibérico, vistas de la Sagrada Familia, noches de verano",
      mbti: "INTJ",
      sexual_orientation: "heterosexual",
    },
  ],
  id: [
    {
      name: "Dewi",
      age: 23,
      gender: "女",
      city: "Jakarta",
      personality: "gentle、polite",
      background: "Guru TK di Jakarta Selatan. Tumbuh besar di keluarga Jawa yang menghargai sopan santun dan kebersamaan. Tinggal di rumah kontrakan sederhana dekat sekolah, dekorasinya penuh tanaman hias dan kerajinan tangan. Suka sekali jajanan kaki lima dan selalu punya rekomendasi tempat makan enak.",
      speech_style: "Lembut dan sopan, sering menggunakan kata-kata bahasa Jawa halus, suka bertanya dengan sungguh-sungguh tentang perasaan orang lain",
      hobbies: "Membuat kerajinan tangan, menjelajahi kuliner kaki lima, menanam tanaman hias, mengaji",
      values: "Kerendahan hati dan kehangatan keluarga adalah hal terpenting dalam hidup",
      fears: "Tidak bisa menikmati makanan favoritnya karena terlalu sibuk bekerja",
      love_view: "Mencari seseorang yang bisa diajak ngobrol sampai larut malam sambil makan martabak",
      daily_routine: "Bangun pagi untuk mengaji, mengajar anak-anak TK sampai siang, sore merawat tanaman, malam menjelajah kuliner",
      favorite_things: "Martabak manis, teh tarik, tanaman monstera, suara azan maghrib, kerajinan batik",
      mbti: "ISFJ",
      sexual_orientation: "heterosexual",
    },
    {
      name: "Budi",
      age: 27,
      gender: "男",
      city: "Yogyakarta",
      personality: "easy-going、warm",
      background: "Travel blogger freelance yang fokus pada hidden gems Indonesia. Lahir dan besar di Yogyakarta, memiliki jiwa petualang yang kuat. Tinggal di kos-kosan dekat Malioboro yang dindingnya penuh peta dan foto perjalanan. Suka ngobrol dengan orang asing dan selalu punya cerita menarik.",
      speech_style: "Santai dan ramah, bercampur logat Jawa yang khas, suka bercanda tapi bisa serius saat membicarakan impian",
      hobbies: "Backpacking ke desa-desa terpencil, fotografi, naik gunung, ngopi di angkringan",
      values: "Kebebasan untuk menjelajah dan berbagi cerita adalah harta terbesar",
      fears: "Terjebak dalam rutinitas monoton dan kehilangan rasa ingin tahu",
      love_view: "Ingin pasangan yang bisa diajak road trip spontan dan ngobrol sampai pagi di tepi pantai",
      daily_routine: "Bangun siang, nulis artikel atau edit foto di kafe, sore keliling kota, malam nongkrong di angkringan",
      favorite_things: "Kopi tubruk, nasi goreng angkringan, matahari terbit Borobudur, musik keroncong",
      mbti: "ENFP",
      sexual_orientation: "heterosexual",
    },
  ],
};

const personalities = [
  "温柔",
  "傲娇",
  "病娇",
  "阳光",
  "御姐",
  "腹黑",
  "可爱",
  "成熟",
  "活泼",
  "冷淡",
];

export function CreateCompanion() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [age, setAge] = useState(22);
  const [gender, setGender] = useState<"male" | "female">("female");
  const [city, setCity] = useState("");
  const [selectedPersonalities, setSelectedPersonalities] = useState<string[]>(
    []
  );
  const [background, setBackground] = useState("");
  const [speakingStyle, setSpeakingStyle] = useState("");
  const [hobbies, setHobbies] = useState("");
  const [values, setValues] = useState("");
  const [fears, setFears] = useState("");
  const [loveView, setLoveView] = useState("");
  const [dailyRoutine, setDailyRoutine] = useState("");
  const [favoriteThings, setFavoriteThings] = useState("");
  const [mbti, setMbti] = useState("");
  const [sexualOrientation, setSexualOrientation] = useState("heterosexual");
  const [lifeStory, setLifeStory] = useState("");
  const [culturalValues, setCulturalValues] = useState("");
  const [genderPerspective, setGenderPerspective] = useState("");
  const [chatHistoryRaw, setChatHistoryRaw] = useState("");
  const [chatHistoryCount, setChatHistoryCount] = useState(0);
  const [dynamicCities, setDynamicCities] = useState<Record<string, string[]>>(citiesByLang);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 动态获取城市列表
  useEffect(() => {
    const lang = i18n.language || "zh";
    apiFetch(`/api/culture/cities?lang=${lang}`)
      .then((data: any) => {
        if (data?.cities?.length) {
          setDynamicCities((prev) => ({ ...prev, [lang]: data.cities }));
        }
      })
      .catch(() => {});
  }, [i18n.language]);

  // 克隆模式：从 localStorage 读取预填充数据
  useEffect(() => {
    if (searchParams.get("clone") !== "1") return;
    const raw = localStorage.getItem("clone_companion_data");
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.name) setName(data.name);
      if (data.age) setAge(data.age);
      if (data.gender) setGender(data.gender);
      if (data.city) setCity(data.city);
      if (data.personality) {
        const parts = data.personality.split(/[、,，]/).filter(Boolean);
        setSelectedPersonalities(parts.map((p: string) => p.trim()));
      }
      if (data.background) setBackground(data.background);
      if (data.speech_style) setSpeakingStyle(data.speech_style);
      if (data.hobbies) setHobbies(data.hobbies);
      if (data.values) setValues(data.values);
      if (data.fears) setFears(data.fears);
      if (data.love_view) setLoveView(data.love_view);
      if (data.daily_routine) setDailyRoutine(data.daily_routine);
      if (data.favorite_things) setFavoriteThings(data.favorite_things);
      if (data.mbti) setMbti(data.mbti);
      if (data.sexual_orientation) setSexualOrientation(data.sexual_orientation);
      if (data.life_story) setLifeStory(data.life_story);
      if (data.cultural_values) setCulturalValues(data.cultural_values);
      if (data.gender_perspective) setGenderPerspective(data.gender_perspective);
      localStorage.removeItem("clone_companion_data");
    } catch {
      // 忽略解析错误
    }
  }, [searchParams]);

  const togglePersonality = (personality: string) => {
    if (selectedPersonalities.includes(personality)) {
      setSelectedPersonalities(
        selectedPersonalities.filter((p) => p !== personality)
      );
    } else {
      setSelectedPersonalities([...selectedPersonalities, personality]);
    }
  };

  const handleAutoFill = async () => {
    const lang = i18n.language || "zh";
    const list = presetPersonasByLang[lang] || presetPersonasByLang["zh"];
    const persona = list[Math.floor(Math.random() * list.length)];

    // 尝试从 API 获取一个随机姓名替换
    const apiGender = persona.gender === "男" ? "male" : "female";
    try {
      const data = await apiFetch(`/api/culture/names?lang=${lang}&gender=${apiGender}&count=8`);
      if (data.names?.length) {
        const randomName = data.names[Math.floor(Math.random() * data.names.length)];
        setName(randomName);
      } else {
        setName(persona.name);
      }
    } catch {
      setName(persona.name);
    }

    setAge(persona.age);
    setGender(persona.gender === "男" ? "male" : "female");
    setSexualOrientation((persona as any).sexual_orientation || "heterosexual");
    setCity(persona.city);
    setSelectedPersonalities(persona.personality.split("、"));
    setBackground(persona.background);
    setSpeakingStyle(persona.speech_style);
    setHobbies(persona.hobbies);
    setValues(persona.values);
    setFears(persona.fears);
    setLoveView(persona.love_view);
    setDailyRoutine(persona.daily_routine);
    setFavoriteThings(persona.favorite_things);
    setMbti(persona.mbti);
    setLifeStory((persona as any).life_story || "");
    setCulturalValues((persona as any).cultural_values || "");
    setGenderPerspective((persona as any).gender_perspective || "");
  };

  const parseChatHistory = (raw: string): { role: string; content: string }[] => {
    if (!raw.trim()) return [];
    // 尝试 JSON 解析
    if (raw.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(raw.trim());
        if (Array.isArray(parsed)) {
          return parsed
            .filter((m: any) => m.role && m.content)
            .map((m: any) => ({ role: m.role, content: String(m.content) }));
        }
      } catch {
        // 不是 JSON，继续按文本解析
      }
    }
    // 文本格式解析
    const lines = raw.split("\n").filter((l) => l.trim());
    const result: { role: string; content: string }[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^(用户|我|user)[\s:：]/.test(trimmed)) {
        result.push({
          role: "user",
          content: trimmed.replace(/^(用户|我|user)[\s:：]/, "").trim(),
        });
      } else if (/^(AI|智能体|assistant|对方|ta|TA)[\s:：]/.test(trimmed)) {
        result.push({
          role: "assistant",
          content: trimmed.replace(/^(AI|智能体|assistant|对方|ta|TA)[\s:：]/, "").trim(),
        });
      } else if (result.length > 0) {
        // 没有前缀，追加到上一条消息
        result[result.length - 1].content += "\n" + trimmed;
      }
    }
    return result;
  };

  // 必填字段check
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const personalityStr = selectedPersonalities.join("、");

    if (!name.trim()) newErrors.name = "姓名不能为空，请填写内容";
    if (!age) newErrors.age = "年龄不能为空，请填写内容";
    if (!gender) newErrors.gender = "性别不能为空，请填写内容";
    if (!city.trim()) newErrors.city = "城市不能为空，请填写内容";
    if (!personalityStr.trim()) newErrors.personality = "性格不能为空，请填写内容";
    if (selectedPersonalities.length < 2) newErrors.personality = "性格标签至少选择两个";
    if (!mbti.trim()) newErrors.mbti = "MBTI不能为空，请填写内容";
    if (!sexualOrientation.trim()) newErrors.sexualOrientation = "性取向不能为空，请填写内容";
    if (!background.trim()) newErrors.background = "背景故事不能为空，请填写内容";
    else if (background.trim().length < 5) newErrors.background = "背景故事内容至少填写5个字符，请补充完整描述";
    if (!speakingStyle.trim()) newErrors.speakingStyle = "说话风格不能为空，请填写内容";
    else if (speakingStyle.trim().length < 5) newErrors.speakingStyle = "说话风格内容至少填写5个字符，请补充完整描述";

    setErrors(newErrors);
    
    const errorList = Object.values(newErrors);
    if (errorList.length > 0) {
      alert(errorList.join("\n"));
    }
    
    return errorList.length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const payload = {
      name,
      age,
      gender: gender === "male" ? "男" : "女",
      city,
      personality: selectedPersonalities.join("、"),
      mbti,
      sexual_orientation: sexualOrientation,
      avatar_url: "__GENERATING__",
      background,
      speech_style: speakingStyle,
    };

    try {
      await api.post("/companions", payload);
      navigate("/messages");
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error("创建智能体失败:", err);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2" data-analytics-button="create-companion-back" data-analytics-name="创建伴侣页返回">
              <ArrowLeft className="w-6 h-6 text-foreground" />
            </button>
            <h1 className="text-lg text-foreground">{t('createCompanion.title')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoFill}
              data-analytics-button="create-companion-autofill"
              data-analytics-name="创建伴侣页自动填充"
              className="flex items-center gap-1 text-sm text-pink-500 px-3 py-1.5 rounded-full border border-pink-500/30 hover:bg-pink-500/10 transition-colors"
            >
              <Wand2 className="w-4 h-4" />
              {t('createCompanion.autoFill')}
            </button>

          </div>
        </div>
      </div>

      <form onSubmit={handleCreate} className="px-4 py-6 pb-24 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-foreground text-sm mb-2 block">
              {t('createCompanion.name')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('createCompanion.namePlaceholder')}
              className={`w-full bg-input-background border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${
                errors.name ? 'border-red-500' : 'border-border'
              }`}
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="text-foreground text-sm mb-2 block">
              {t('createCompanion.ageLabel', { age } as any) as string}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="range"
              min="18"
              max="35"
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="w-full accent-pink-500"
            />
            <div className="flex justify-between text-muted-foreground text-xs mt-1">
              <span>18</span>
              <span>35</span>
            </div>
            {errors.age && (
              <p className="text-red-500 text-xs mt-1">{errors.age}</p>
            )}
          </div>

          <div>
            <label className="text-foreground text-sm mb-2 block">
              {t('createCompanion.gender')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setGender("male")}
                className={`flex-1 py-3 rounded-xl transition-all ${
                  gender === "male"
                    ? "bg-gradient-to-r from-blue-500 to-cyan-600 text-white"
                    : "bg-secondary text-secondary-foreground border border-border"
                }`}
              >
                {t('register.male')}
              </button>
              <button
                type="button"
                onClick={() => setGender("female")}
                className={`flex-1 py-3 rounded-xl transition-all ${
                  gender === "female"
                    ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                    : "bg-secondary text-secondary-foreground border border-border"
                }`}
              >
                {t('register.female')}
              </button>
            </div>
            {errors.gender && (
              <p className="text-red-500 text-xs mt-1">{errors.gender}</p>
            )}
          </div>

          <div>
            <label className="text-foreground text-sm mb-2 block">
              {t('createCompanion.sexualOrientation')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              value={sexualOrientation}
              onChange={(e) => setSexualOrientation(e.target.value)}
              className={`w-full bg-input-background border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none transition-colors ${
                errors.sexualOrientation ? 'border-red-500' : 'border-border'
              }`}
            >
              <option value="heterosexual">{t('register.heterosexual')}</option>
              <option value="homosexual">{t('register.homosexual')}</option>
              <option value="bisexual">{t('register.bisexual')}</option>
              <option value="pansexual">{t('register.pansexual')}</option>
              <option value="asexual">{t('register.asexual')}</option>
              <option value="secret">{t('register.secret')}</option>
            </select>
            {errors.sexualOrientation && (
              <p className="text-red-500 text-xs mt-1">{errors.sexualOrientation}</p>
            )}
          </div>

          <div>
            <label className="text-foreground text-sm mb-2 block">
              {t('createCompanion.city')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={`w-full bg-input-background border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${
                errors.city ? 'border-red-500' : 'border-border'
              }`}
            >
              <option value="">{t('createCompanion.cityPlaceholder')}</option>
              {(dynamicCities[i18n.language || "zh"] || dynamicCities["zh"] || []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.city && (
              <p className="text-red-500 text-xs mt-1">{errors.city}</p>
            )}
          </div>

          <div>
            <label className="text-foreground text-sm mb-2 block">
              {t('createCompanion.mbti')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <select
              value={mbti}
              onChange={(e) => setMbti(e.target.value)}
              className={`w-full bg-input-background border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none transition-colors ${
                errors.mbti ? 'border-red-500' : 'border-border'
              }`}
            >
              <option value="">{t('createCompanion.mbtiPlaceholder')}</option>
              <option value="INTJ">INTJ - 建筑师</option>
              <option value="INTP">INTP - 逻辑学家</option>
              <option value="ENTJ">ENTJ - 指挥官</option>
              <option value="ENTP">ENTP - 辩论家</option>
              <option value="INFJ">INFJ - 提倡者</option>
              <option value="INFP">INFP - 调停者</option>
              <option value="ENFJ">ENFJ - 主人公</option>
              <option value="ENFP">ENFP - 竞选者</option>
              <option value="ISTJ">ISTJ - 物流师</option>
              <option value="ISFJ">ISFJ - 守护者</option>
              <option value="ESTJ">ESTJ - 总经理</option>
              <option value="ESFJ">ESFJ - 执政官</option>
              <option value="ISTP">ISTP - 鉴赏家</option>
              <option value="ISFP">ISFP - 探险家</option>
              <option value="ESTP">ESTP - 企业家</option>
              <option value="ESFP">ESFP - 表演者</option>
            </select>
            {errors.mbti && (
              <p className="text-red-500 text-xs mt-1">{errors.mbti}</p>
            )}
          </div>

          <div>
            <label className="text-foreground text-sm mb-3 block">
              {t('createCompanion.personalityLabel')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {personalities.map((personality) => (
                <button
                  key={personality}
                  type="button"
                  onClick={() => togglePersonality(personality)}
                  className={`px-4 py-2 rounded-full text-sm transition-all ${
                    selectedPersonalities.includes(personality)
                      ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                      : "bg-secondary text-secondary-foreground border border-border"
                  }`}
                >
                  {personality}
                  {selectedPersonalities.includes(personality) && (
                    <Check className="inline w-4 h-4 ml-1" />
                  )}
                </button>
              ))}
            </div>
            {errors.personality && (
              <p className="text-red-500 text-xs mt-1">{errors.personality}</p>
            )}
          </div>

          <div>
            <label className="text-foreground text-sm mb-2 block">
              {t('createCompanion.background')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder={t('createCompanion.backgroundPlaceholder')}
              className={`w-full bg-input-background border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-24 resize-none transition-colors ${
                errors.background ? 'border-red-500' : 'border-border'
              }`}
            />
            {errors.background && (
              <p className="text-red-500 text-xs mt-1">{errors.background}</p>
            )}
          </div>

          <div>
            <label className="text-foreground text-sm mb-2 block">
              {t('createCompanion.speechStyle')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              value={speakingStyle}
              onChange={(e) => setSpeakingStyle(e.target.value)}
              placeholder={t('createCompanion.speechStylePlaceholder')}
              className={`w-full bg-input-background border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-24 resize-none transition-colors ${
                errors.speakingStyle ? 'border-red-500' : 'border-border'
              }`}
            />
            {errors.speakingStyle && (
              <p className="text-red-500 text-xs mt-1">{errors.speakingStyle}</p>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-muted-foreground text-xs mb-3">{t('createCompanion.importChatHistory')}</p>
            <div className="space-y-2">
              <textarea
                value={chatHistoryRaw}
                onChange={(e) => {
                  setChatHistoryRaw(e.target.value);
                  setChatHistoryCount(parseChatHistory(e.target.value).length);
                }}
                placeholder={t('createCompanion.chatHistoryPlaceholder')}
                className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-40 resize-none text-sm"
              />
              {chatHistoryCount > 0 && (
                <p className="text-muted-foreground text-xs">
                  {t('createCompanion.recognizedMessages', { count: chatHistoryCount } as any) as string}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-muted-foreground text-xs mb-3">{t('createCompanion.personalityDetails')}</p>
            <div className="space-y-4">
              <div>
                <label className="text-foreground text-sm mb-2 block">{t('createCompanion.hobbies')}</label>
                <textarea
                  value={hobbies}
                  onChange={(e) => setHobbies(e.target.value)}
                  placeholder={t('createCompanion.hobbiesPlaceholder')}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-20 resize-none"
                />
              </div>
              <div>
                <label className="text-foreground text-sm mb-2 block">{t('createCompanion.values')}</label>
                <textarea
                  value={values}
                  onChange={(e) => setValues(e.target.value)}
                  placeholder={t('createCompanion.valuesPlaceholder')}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-20 resize-none"
                />
              </div>
              <div>
                <label className="text-foreground text-sm mb-2 block">{t('createCompanion.fears')}</label>
                <textarea
                  value={fears}
                  onChange={(e) => setFears(e.target.value)}
                  placeholder={t('createCompanion.fearsPlaceholder')}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-20 resize-none"
                />
              </div>
              <div>
                <label className="text-foreground text-sm mb-2 block">{t('createCompanion.loveView')}</label>
                <textarea
                  value={loveView}
                  onChange={(e) => setLoveView(e.target.value)}
                  placeholder={t('createCompanion.loveViewPlaceholder')}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-20 resize-none"
                />
              </div>
              <div>
                <label className="text-foreground text-sm mb-2 block">{t('createCompanion.dailyRoutine')}</label>
                <textarea
                  value={dailyRoutine}
                  onChange={(e) => setDailyRoutine(e.target.value)}
                  placeholder={t('createCompanion.dailyRoutinePlaceholder')}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-20 resize-none"
                />
              </div>
              <div>
                <label className="text-foreground text-sm mb-2 block">{t('createCompanion.favoriteThings')}</label>
                <textarea
                  value={favoriteThings}
                  onChange={(e) => setFavoriteThings(e.target.value)}
                  placeholder={t('createCompanion.favoriteThingsPlaceholder')}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-20 resize-none"
                />
              </div>
              <div>
                <label className="text-foreground text-sm mb-2 block">{t('createCompanion.lifeStory')}</label>
                <textarea
                  value={lifeStory}
                  onChange={(e) => setLifeStory(e.target.value)}
                  placeholder={t('createCompanion.lifeStoryPlaceholder')}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-32 resize-none"
                />
              </div>
              <div>
                <label className="text-foreground text-sm mb-2 block">{t('createCompanion.culturalValues')}</label>
                <textarea
                  value={culturalValues}
                  onChange={(e) => setCulturalValues(e.target.value)}
                  placeholder={t('createCompanion.culturalValuesPlaceholder')}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-32 resize-none"
                />
              </div>
              <div>
                <label className="text-foreground text-sm mb-2 block">{t('createCompanion.genderPerspective')}</label>
                <textarea
                  value={genderPerspective}
                  onChange={(e) => setGenderPerspective(e.target.value)}
                  placeholder={t('createCompanion.genderPerspectivePlaceholder')}
                  className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-32 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="text-foreground mb-4 text-sm">{t('createCompanion.preview')}</h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center text-3xl flex-shrink-0">
              {gender === "female" ? "👩" : "👨"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground mb-1">
                {name || t('createCompanion.unnamed')}
              </p>
              <p className="text-muted-foreground text-sm">
                {age}{t('companionProfile.ageUnit')} · {city || t('createCompanion.unknownCity')}
              </p>
              {mbti && (
                <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded-full mt-1 inline-block">
                  {mbti}
                </span>
              )}
              {selectedPersonalities.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {selectedPersonalities.slice(0, 3).map((p) => (
                    <span
                      key={p}
                      className="text-xs bg-pink-500/10 text-pink-500 px-2 py-1 rounded-full"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          type="submit"
          data-analytics-button="create-companion-submit"
          data-analytics-name="创建伴侣页确认创建"
          className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-xl transition-all active:scale-95"
        >
          {t('createCompanion.createBtn')}
        </button>
      </form>
    </div>
  );
}
