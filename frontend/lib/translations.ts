// TRANSLATION NOTE: English strings are complete and correct.
// Sinhala (si) and Tamil (ta) are best-effort drafts — pending review by a native speaker.

export type Lang = 'en' | 'si' | 'ta';

type Tr = { en: string; si: string; ta: string };

export const T: Record<string, Tr> = {
  // ── Page header ──────────────────────────────────────────────
  welcome:     { en: 'Hello,',             si: 'ආයුබෝවන්,',         ta: 'வணக்கம்,'             },
  tagline:     { en: 'Tea Price Guide',    si: 'තේ මිල මාර්ගෝපදේශය', ta: 'தேயிலை விலை வழிகாட்டி' },

  // ── Language switcher ─────────────────────────────────────────
  langEn: { en: 'English', si: 'English',  ta: 'English'  },
  langSi: { en: 'සිංහල',   si: 'සිංහල',   ta: 'සිංහල'   },
  langTa: { en: 'தமிழ்',   si: 'தமிழ்',   ta: 'தமிழ்'   },

  // ── Elevation picker ─────────────────────────────────────────
  whatTeaGrow: {
    en: 'What tea do you grow?',
    si: 'ඔබ වගා කරන තේ වර්ගය කුමක්ද?',
    ta: 'நீங்கள் என்ன தேயிலை வளர்க்கிறீர்கள்?',
  },
  highGrown:   { en: 'High-Grown',   si: 'ඉහළ කඳු',     ta: 'உயர் மலை'  },
  mediumGrown: { en: 'Medium-Grown', si: 'මැදි කඳු',     ta: 'நடு மலை'   },
  lowGrown:    { en: 'Low-Grown',    si: 'පහළ ඉඩම්',    ta: 'தாழ்நிலை'  },

  // ── Signal card question ──────────────────────────────────────
  shouldISell: {
    en: 'Should I sell or wait?',
    si: 'මම විකුණන්නද, රඳවා ගන්නද?',
    ta: 'நான் விற்கணுமா அல்லது காக்கணுமா?',
  },

  // ── Signal labels ─────────────────────────────────────────────
  signalSell:  { en: 'Sell Now',       si: 'දැන් විකුණන්න',          ta: 'இப்போது விற்கவும்'          },
  signalHold:  { en: 'Hold & Wait',    si: 'රඳවා ගෙන රැඳෙන්න',      ta: 'காத்திருங்கள்'              },
  signalWatch: { en: 'Keep Watching',  si: 'බලා ගෙන සිටින්න',       ta: 'கவனித்துக்கொண்டிருங்கள்'   },

  // ── Recommendation sentence building blocks ───────────────────
  // These compose a sentence: "[priceExpected] [dir] [nextMonth] [advice]"
  // Each language assembles differently using its own grammar.
  priceExpectedEn:  { en: 'Prices are expected to',     si: '',                          ta: ''                                    },
  dirRise:          { en: 'rise',                        si: 'ඉහළ යනු ඇත',              ta: 'உயரும்'                              },
  dirFall:          { en: 'fall',                        si: 'පහළ යනු ඇත',              ta: 'குறையும்'                            },
  dirStay:          { en: 'stay about the same',         si: 'සමාන ලෙස රැඳෙනු ඇත',    ta: 'ஒரே மாதிரி இருக்கும்'              },
  nextMonthEn:      { en: 'next month.',                 si: '',                          ta: ''                                    },
  adviceSell:       {
    en: 'Selling soon may get you a better price.',
    si: 'ඉක්මනින් විකිණීම වඩා හොඳ මිලක් ලබා ගැනීමට ඉඩ ඇත.',
    ta: 'விரைவில் விற்பது சிறந்த விலை தரலாம்.',
  },
  adviceHold:       {
    en: 'Waiting may get you a better price.',
    si: 'රැඳී සිටීම වඩා හොඳ මිලක් ලබා ගැනීමට ඉඩ ඇත.',
    ta: 'காத்திருப்பது சிறந்த விலை தரலாம்.',
  },
  adviceWatch:      {
    en: 'Prices are uncertain right now. Keep watching before deciding.',
    si: 'දැනට මිල අස්ථිර ය. තීරණය කිරීමට පෙර හොඳින් නිරීක්ෂණය කරන්න.',
    ta: 'விலை இப்போது நிச்சயமற்றது. முடிவெடுக்கும் முன் கவனமாக கவனியுங்கள்.',
  },

  // ── Price card ────────────────────────────────────────────────
  yourTeaPrice: {
    en: "Your tea's predicted price",
    si: 'ඔබේ තේ හි අනාවැකි කී මිල',
    ta: 'உங்கள் தேயிலையின் கணிக்கப்பட்ட விலை',
  },
  forMonth:     { en: 'For',                   si: 'මාසය:',                    ta: 'மாதம்:'                       },
  lastKnown:    { en: 'Last known price',       si: 'අවසාන දන්නා මිල',          ta: 'கடைசியாக அறிந்த விலை'        },
  priceUp:      { en: 'up',                     si: 'ඉහළ',                      ta: 'அதிகம்'                       },
  priceDown:    { en: 'down',                   si: 'පහළ',                      ta: 'குறைவு'                       },

  // ── Price disclaimer ──────────────────────────────────────────
  priceDisclaimer: {
    en: 'National average auction price. Your actual local price may vary.',
    si: 'ජාතික සාමාන්‍ය වෙන්දේසි මිලයි. ඔබේ ප්‍රාදේශීය මිල වෙනස් විය හැකිය.',
    ta: 'தேசிய சராசரி ஏல விலை. உங்கள் உள்ளூர் விலை மாறுபடலாம்.',
  },

  // ── Chart ─────────────────────────────────────────────────────
  chartTitle: {
    en: "How your tea's price has changed recently",
    si: 'ඔබේ තේ හි මිල මෑතකදී වෙනස් වූ ආකාරය',
    ta: 'உங்கள் தேயிலை விலை சமீபத்தில் மாறியது எப்படி',
  },
  chartCaption: {
    en: 'Colombo Tea Auction price per kg over the past 12 months.',
    si: 'පසුගිය මාස 12 තුළ කොළඹ තේ වෙන්දේසියේ කිලෝ ග්‍රෑමයකට මිල.',
    ta: 'கடந்த 12 மாதங்களில் கொழும்பு தேயிலை ஏலத்தில் கிலோவுக்கு விலை.',
  },
  priceRs:      { en: 'Rs / kg', si: 'රු / කිලෝ', ta: 'ரூ / கிலோ' },

  // ── What does this mean? ──────────────────────────────────────
  whatMeansTitle: {
    en: 'What does this mean?',
    si: 'මෙයින් කුමක් අදහස් කෙරේද?',
    ta: 'இது என்ன அர்த்தம்?',
  },
  whatMeansText: {
    en: 'This is the average auction price for your type of tea at the Colombo Tea Auction, per kilogram. It is a prediction for next month based on weather, global markets, and past prices.',
    si: 'මෙය ඉදිරි මාසය සඳහා කොළඹ තේ වෙන්දේසියේ ඔබේ තේ වර්ගය සඳහා කිලෝ ග්‍රෑමයකට ඇති සාමාන්‍ය වෙන්දේසි මිල පිළිබඳ අනාවැකියකි. කාලගුණය, ගෝලීය වෙළඳපොළ සහ අතීත මිල ගණන් මත පදනම් වේ.',
    ta: 'இது அடுத்த மாதத்திற்கான கொழும்பு தேயிலை ஏலத்தில் உங்கள் வகை தேயிலைக்கான சராசரி ஏல விலையின் கணிப்பு ஆகும். இது வானிலை, உலக சந்தைகள் மற்றும் கடந்த கால விலைகளின் அடிப்படையில் கணிக்கப்பட்டது.',
  },

  // ── Loading / error ───────────────────────────────────────────
  loading:    { en: 'Getting your price…',         si: 'ඔබේ මිල ලබා ගනිමු…',          ta: 'உங்கள் விலை பெறுகிறோம்…'         },
  errorTitle: { en: 'Could not load price',         si: 'මිල ලබා ගැනීමට නොහැකි විය',    ta: 'விலை ஏற்ற முடியவில்லை'          },
  errorText:  { en: 'Please try again in a moment.',si: 'කෙටි වේලාවකින් නැවත උත්සාහ කරන්න.',ta: 'சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.' },
  retry:      { en: 'Try again',                   si: 'නැවත උත්සාහ කරන්න',            ta: 'மீண்டும் முயற்சிக்கவும்'         },

  // ── Sidebar nav labels (farmer minimal nav) ───────────────────
  myDashboard: { en: 'My Dashboard', si: 'මගේ මුල් පිටුව',  ta: 'என் டாஷ்போர்டு'   },
  alerts:      { en: 'Alerts',       si: 'දැනුම්දීම්',       ta: 'எச்சரிக்கைகள்'     },
  reports:     { en: 'Reports',      si: 'වාර්තා',           ta: 'அறிக்கைகள்'        },
  myAccount:   { en: 'My Account',   si: 'මගේ ගිණුම',        ta: 'என் கணக்கு'        },
  signOut:     { en: 'Sign out',     si: 'ඉවත් වෙන්න',       ta: 'வெளியேறு'          },

  // ── Profile page ──────────────────────────────────────────────
  profileSubtitle: {
    en: 'Your profile and role settings',
    si: 'ඔබේ පැතිකඩ සහ භූමිකා සැකසුම්',
    ta: 'உங்கள் சுயவிவரம் மற்றும் பாத்திர அமைப்புகள்',
  },
  profileSection: { en: 'Profile',   si: 'පැතිකඩ',           ta: 'சுயவிவரம்'  },
  profileName:    { en: 'Name',      si: 'නම',               ta: 'பெயர்'       },
  profileEmail:   { en: 'Email',     si: 'විද්‍යුත් තැපෑල', ta: 'மின்னஞ்சல்'  },
  profileRole:    { en: 'Role',      si: 'භූමිකාව',          ta: 'பாத்திரம்'   },

  roleUpgradeTitle: {
    en: 'Request Role Upgrade',
    si: 'භූමිකා උසස්වීමක් ඉල්ලන්න',
    ta: 'பாத்திர தரவுயர்வு கோரவும்',
  },
  roleUpgradeDesc: {
    en: 'Farmer is the default role. Apply for a professional role to unlock advanced analytics. An administrator will review your request.',
    si: 'ගොවියා සාමාන්‍ය භූමිකාවයි. උසස් විශ්ලේෂණ ලබා ගැනීමට වෘත්තීය භූමිකාවක් ඉල්ලන්න. පරිපාලකයෙකු ඔබේ ඉල්ලීම සමාලෝචනය කරනු ඇත.',
    ta: 'விவசாயி என்பது இயல்புநிலை பாத்திரம். மேம்பட்ட பகுப்பாய்வுகளை அணுக ஒரு தொழில்முறை பாத்திரத்திற்கு விண்ணப்பிக்கவும். ஒரு நிர்வாகி உங்கள் கோரிக்கையை மதிப்பாய்வு செய்வார்.',
  },

  rolePendingTitle: {
    en: 'Request pending',
    si: 'ඉල්ලීම සලකා බලමින්',
    ta: 'கோரிக்கை நிலுவையில் உள்ளது',
  },
  rolePendingNote: {
    en: 'After approval, sign out and sign back in to activate your new role.',
    si: 'අනුමැතියෙන් පසු, නව භූමිකාව සක්‍රිය කිරීමට ඉවත් වී නැවත ඇතුළු වන්න.',
    ta: 'ஒப்புதலுக்குப் பிறகு, புதிய பாத்திரத்தை செயல்படுத்த வெளியேறி மீண்டும் உள்நுழையவும்.',
  },
  upgradePromptTitle: {
    en: 'Are you a tea professional?',
    si: 'ඔබ තේ වෘත්තිකයෙක්ද?',
    ta: 'நீங்கள் ஒரு தேயிலை நிபுணரா?',
  },
  upgradePromptDesc: {
    en: 'Brokers, exporters, buyers, and analysts can apply for a professional role to access advanced market analytics and reports.',
    si: 'තැරැව්කරුවන්, අපනයනකරුවන්, ගැනුම්කරුවන් සහ විශ්ලේෂකයන්ට උසස් වෙළඳ විශ්ලේෂණ සඳහා වෘත්තීය භූමිකාවක් ඉල්ලීමට හැකිය.',
    ta: 'தரகர்கள், ஏற்றுமதியாளர்கள், வாங்குபவர்கள் மற்றும் ஆய்வாளர்கள் மேம்பட்ட சந்தை பகுப்பாய்வுகளுக்கு தொழில்முறை பாத்திரத்திற்கு விண்ணப்பிக்கலாம்.',
  },
  upgradePromptBtn: {
    en: 'Apply for a role upgrade',
    si: 'භූමිකා උසස්වීමක් ඉල්ලන්න',
    ta: 'பாத்திர தரவுயர்வுக்கு விண்ணப்பிக்கவும்',
  },

  roleSelectPrompt: {
    en: 'Select a role above',
    si: 'ඉහත භූමිකාවක් තෝරන්න',
    ta: 'மேலே ஒரு பாத்திரம் தேர்ந்தெடுக்கவும்',
  },
  roleRequestAccess: {
    en: 'Request Access',
    si: 'ප්‍රවේශය ඉල්ලන්න',
    ta: 'அணுகல் கோரவும்',
  },

  roleBrokerLabel:   { en: 'Tea Broker',     si: 'තේ තැරැව්කරු',     ta: 'தேயிலை தரகர்'              },
  roleExporterLabel: { en: 'Tea Exporter',   si: 'තේ අපනයනකරු',     ta: 'தேயிலை ஏற்றுமதியாளர்'      },
  roleBuyerLabel:    { en: 'Buyer',          si: 'ගැනුම්කරු',         ta: 'வாங்குபவர்'                },
  roleAnalystLabel:  { en: 'Market Analyst', si: 'වෙළඳ විශ්ලේෂකයා',  ta: 'சந்தை ஆய்வாளர்'           },

  roleBrokerDesc: {
    en: 'Market signals, reports, and what-if analysis for auction decisions.',
    si: 'වෙන්දේසි තීරණ සඳහා වෙළඳ සංඥා, වාර්තා සහ what-if විශ්ලේෂණ.',
    ta: 'ஏல முடிவுகளுக்கான சந்தை சமிக்ஞைகள், அறிக்கைகள் மற்றும் பகுப்பாய்வு.',
  },
  roleExporterDesc: {
    en: 'Export-relevant analytics, price trends, and risk reports.',
    si: 'අපනයනය සඳහා විශ්ලේෂණ, මිල ප්‍රවණතා සහ අවදානම් වාර්තා.',
    ta: 'ஏற்றுமதி தொடர்பான பகுப்பாய்வுகள், விலை போக்குகள் மற்றும் அபாய அறிக்கைகள்.',
  },
  roleBuyerDesc: {
    en: 'Price forecasts and market intelligence for purchasing decisions.',
    si: 'ගැනුම් තීරණ සඳහා මිල අනාවැකි සහ වෙළඳ බුද්ධිය.',
    ta: 'கொள்முதல் முடிவுகளுக்கான விலை முன்கணிப்புகள் மற்றும் சந்தை நுண்ணறிவு.',
  },
  roleAnalystDesc: {
    en: 'Full access including model performance data and economic indicators.',
    si: 'ආකෘති කාර්ය සාධන දත්ත සහ ආර්ථික දර්ශක ඇතුළු සම්පූර්ණ ප්‍රවේශය.',
    ta: 'மாதிரி செயல்திறன் தரவு மற்றும் பொருளாதார குறிகாட்டிகள் உட்பட முழு அணுகல்.',
  },

  // ── Alerts page (farmer-specific) ──────────────────────────────
  alertsSubtitle: {
    en: 'Price signals for your tea',
    si: 'ඔබේ තේ සඳහා මිල සංඥා',
    ta: 'உங்கள் தேயிலைக்கான விலை சமிக்ஞைகள்',
  },
  alertRiskHTitle: {
    en: 'High Price Risk',
    si: 'ඉහළ මිල අවදානම',
    ta: 'அதிக விலை ஆபத்து',
  },
  alertRiskHBody: {
    en: 'Risk is currently high - prices may change more than usual this month. Be cautious about large commitments.',
    si: 'දැනට මිල අවදානම ඉහළයි - මෙම මාසයේ මිල සාමාන්‍යයට වඩා වෙනස් විය හැක. විශාල තීරණ ගැනීමේදී ප්‍රවේශමෙන් සිටින්න.',
    ta: 'தற்போது விலை ஆபத்து அதிகமாக உள்ளது - இந்த மாதம் விலைகள் வழக்கத்திற்கு மாறாக மாறலாம். பெரிய முடிவுகளில் கவனமாக இருங்கள்.',
  },
  alertRiskMTitle: {
    en: 'Moderate Price Uncertainty',
    si: 'මධ්‍යස්ථ මිල අවිනිශ්චිතතාව',
    ta: 'மிதமான விலை நிச்சயமின்மை',
  },
  alertRiskMBody: {
    en: 'Prices are somewhat uncertain this month. Consider your options carefully before deciding when to sell.',
    si: 'මෙම මාසයේ මිල යම් තරමකට අස්ථිර ය. විකිණීම ගැන තීරණය කිරීමට පෙර ඔබේ විකල්ප හොඳින් සලකා බලන්න.',
    ta: 'இந்த மாதம் விலைகள் ஓரளவு நிச்சயமற்றவை. எப்போது விற்க வேண்டும் என முடிவெடுக்கும் முன் உங்கள் விருப்பங்களை கவனமாக கவனியுங்கள்.',
  },
  alertSwingTitle: {
    en: 'Large Price Movement Expected',
    si: 'විශාල මිල වෙනසක් අපේක්ෂිතයි',
    ta: 'பெரிய விலை மாற்றம் எதிர்பார்க்கப்படுகிறது',
  },
  alertSwingUp: {
    en: 'Prices are expected to rise significantly next month. This could be a good opportunity to wait before selling.',
    si: 'ඊළඟ මාසයේ මිල සැලකිය යුතු ලෙස ඉහළ යනු ඇතැයි අපේක්ෂා කෙරේ. විකිණීමට පෙර රැඳී සිටීම හොඳ අවස්ථාවක් විය හැක.',
    ta: 'அடுத்த மாதம் விலைகள் கணிசமாக உயரும் என எதிர்பார்க்கப்படுகிறது. விற்பதற்கு முன் காத்திருப்பது நல்ல வாய்ப்பாக இருக்கலாம்.',
  },
  alertSwingDown: {
    en: 'Prices are expected to fall significantly next month. Consider selling sooner rather than waiting.',
    si: 'ඊළඟ මාසයේ මිල සැලකිය යුතු ලෙස පහළ යනු ඇතැයි අපේක්ෂා කෙරේ. රැඳී නොසිට ඉක්මනින් විකිණීම ගැන සිතන්න.',
    ta: 'அடுத்த மாதம் விலைகள் கணிசமாக குறையும் என எதிர்பார்க்கப்படுகிறது. காத்திராமல் விரைவில் விற்பதை கவனியுங்கள்.',
  },
  noAlerts: {
    en: 'No alerts at this time.',
    si: 'මේ මොහොතේ දැනුම්දීම් නොමැත.',
    ta: 'தற்போது எச்சரிக்கைகள் இல்லை.',
  },
};

// ── Helpers ───────────────────────────────────────────────────────

const SI_MONTHS = ['ජන','පෙබ','මාර්','අප්‍ර','මැයි','ජූනි','ජූලි','අගෝ','සැප්','ඔක්','නොව','දෙස'];
const TA_MONTHS = ['ஜன','பிப்','மார்','ஏப்','மே','ஜூன்','ஜூலை','ஆக','செப்','அக்','நவ','டிச'];
const EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function formatMonth(ym: string, lang: Lang): string {
  const [year, mon] = ym.split('-');
  const idx = parseInt(mon, 10) - 1;
  const names = lang === 'si' ? SI_MONTHS : lang === 'ta' ? TA_MONTHS : EN_MONTHS;
  return `${names[idx]} ${year}`;
}

export function buildRecommendationSentence(
  signal: 'Sell' | 'Hold' | 'Monitor',
  changePct: number,
  lang: Lang,
): string {
  const goingUp   = changePct >  2;
  const goingDown = changePct < -2;

  const dir     = goingUp ? T.dirRise[lang] : goingDown ? T.dirFall[lang] : T.dirStay[lang];
  const advice  = signal === 'Sell'    ? T.adviceSell[lang]
                : signal === 'Hold'    ? T.adviceHold[lang]
                :                        T.adviceWatch[lang];

  if (lang === 'en') {
    return `Prices are expected to ${dir} next month. ${advice}`;
  }
  if (lang === 'si') {
    // Sinhala: "[dir] [next month implied]. [advice]"
    return `ඊළඟ මාසයේ මිල ${dir}. ${advice}`;
  }
  // Tamil: "விலை [dir] [next month implied]. [advice]"
  return `அடுத்த மாதம் விலை ${dir}. ${advice}`;
}
