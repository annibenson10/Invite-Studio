/** Country calling codes for the WhatsApp number picker. Most-used countries first. */
export const featuredCountries: readonly (readonly [string, string])[] = [
  ["Nigeria", "+234"],
  ["Ghana", "+233"],
  ["Kenya", "+254"],
  ["South Africa", "+27"],
  ["United Kingdom", "+44"],
  ["United States / Canada", "+1"],
  ["United Arab Emirates", "+971"],
];

export const allCountries: readonly (readonly [string, string])[] = ([
  ["Afghanistan", "+93"], ["Albania", "+355"], ["Algeria", "+213"], ["Andorra", "+376"], ["Angola", "+244"],
  ["Antigua and Barbuda", "+1268"], ["Argentina", "+54"], ["Armenia", "+374"], ["Australia", "+61"], ["Austria", "+43"],
  ["Azerbaijan", "+994"], ["Bahamas", "+1242"], ["Bahrain", "+973"], ["Bangladesh", "+880"], ["Barbados", "+1246"],
  ["Belarus", "+375"], ["Belgium", "+32"], ["Belize", "+501"], ["Benin", "+229"], ["Bhutan", "+975"],
  ["Bolivia", "+591"], ["Bosnia and Herzegovina", "+387"], ["Botswana", "+267"], ["Brazil", "+55"], ["Brunei", "+673"],
  ["Bulgaria", "+359"], ["Burkina Faso", "+226"], ["Burundi", "+257"], ["Cabo Verde", "+238"], ["Cambodia", "+855"],
  ["Cameroon", "+237"], ["Central African Republic", "+236"], ["Chad", "+235"], ["Chile", "+56"], ["China", "+86"],
  ["Colombia", "+57"], ["Comoros", "+269"], ["Congo", "+242"], ["Congo (DRC)", "+243"], ["Costa Rica", "+506"],
  ["Côte d’Ivoire", "+225"], ["Croatia", "+385"], ["Cuba", "+53"], ["Cyprus", "+357"], ["Czechia", "+420"],
  ["Denmark", "+45"], ["Djibouti", "+253"], ["Dominica", "+1767"], ["Dominican Republic", "+1809"], ["Ecuador", "+593"],
  ["Egypt", "+20"], ["El Salvador", "+503"], ["Equatorial Guinea", "+240"], ["Eritrea", "+291"], ["Estonia", "+372"],
  ["Eswatini", "+268"], ["Ethiopia", "+251"], ["Fiji", "+679"], ["Finland", "+358"], ["France", "+33"],
  ["Gabon", "+241"], ["Gambia", "+220"], ["Georgia", "+995"], ["Germany", "+49"], ["Greece", "+30"],
  ["Grenada", "+1473"], ["Guatemala", "+502"], ["Guinea", "+224"], ["Guinea-Bissau", "+245"], ["Guyana", "+592"],
  ["Haiti", "+509"], ["Honduras", "+504"], ["Hong Kong", "+852"], ["Hungary", "+36"], ["Iceland", "+354"],
  ["India", "+91"], ["Indonesia", "+62"], ["Iran", "+98"], ["Iraq", "+964"], ["Ireland", "+353"],
  ["Israel", "+972"], ["Italy", "+39"], ["Jamaica", "+1876"], ["Japan", "+81"], ["Jordan", "+962"],
  ["Kazakhstan", "+7"], ["Kuwait", "+965"], ["Kyrgyzstan", "+996"], ["Laos", "+856"], ["Latvia", "+371"],
  ["Lebanon", "+961"], ["Lesotho", "+266"], ["Liberia", "+231"], ["Libya", "+218"], ["Liechtenstein", "+423"],
  ["Lithuania", "+370"], ["Luxembourg", "+352"], ["Madagascar", "+261"], ["Malawi", "+265"], ["Malaysia", "+60"],
  ["Maldives", "+960"], ["Mali", "+223"], ["Malta", "+356"], ["Mauritania", "+222"], ["Mauritius", "+230"],
  ["Mexico", "+52"], ["Moldova", "+373"], ["Monaco", "+377"], ["Mongolia", "+976"], ["Montenegro", "+382"],
  ["Morocco", "+212"], ["Mozambique", "+258"], ["Myanmar", "+95"], ["Namibia", "+264"], ["Nepal", "+977"],
  ["Netherlands", "+31"], ["New Zealand", "+64"], ["Nicaragua", "+505"], ["Niger", "+227"], ["North Macedonia", "+389"],
  ["Norway", "+47"], ["Oman", "+968"], ["Pakistan", "+92"], ["Palestine", "+970"], ["Panama", "+507"],
  ["Papua New Guinea", "+675"], ["Paraguay", "+595"], ["Peru", "+51"], ["Philippines", "+63"], ["Poland", "+48"],
  ["Portugal", "+351"], ["Qatar", "+974"], ["Romania", "+40"], ["Russia", "+7"], ["Rwanda", "+250"],
  ["Saint Lucia", "+1758"], ["Samoa", "+685"], ["São Tomé and Príncipe", "+239"], ["Saudi Arabia", "+966"], ["Senegal", "+221"],
  ["Serbia", "+381"], ["Seychelles", "+248"], ["Sierra Leone", "+232"], ["Singapore", "+65"], ["Slovakia", "+421"],
  ["Slovenia", "+386"], ["Somalia", "+252"], ["South Korea", "+82"], ["South Sudan", "+211"], ["Spain", "+34"],
  ["Sri Lanka", "+94"], ["Sudan", "+249"], ["Suriname", "+597"], ["Sweden", "+46"], ["Switzerland", "+41"],
  ["Syria", "+963"], ["Taiwan", "+886"], ["Tajikistan", "+992"], ["Tanzania", "+255"], ["Thailand", "+66"],
  ["Togo", "+228"], ["Trinidad and Tobago", "+1868"], ["Tunisia", "+216"], ["Türkiye", "+90"], ["Turkmenistan", "+993"],
  ["Uganda", "+256"], ["Ukraine", "+380"], ["Uruguay", "+598"], ["Uzbekistan", "+998"], ["Venezuela", "+58"],
  ["Vietnam", "+84"], ["Yemen", "+967"], ["Zambia", "+260"], ["Zimbabwe", "+263"],
  ["Kenya", "+254"], ["Nigeria", "+234"], ["Ghana", "+233"], ["South Africa", "+27"], ["United Kingdom", "+44"],
  ["United States / Canada", "+1"], ["United Arab Emirates", "+971"],
] as [string, string][]).sort((a, b) => a[0].localeCompare(b[0]));

/** All distinct dialling codes, longest first, for splitting a stored number back into code + local part. */
const codesLongestFirst = Array.from(new Set(allCountries.map(([, code]) => code))).sort((a, b) => b.length - a.length);

/**
 * Turns user input into an international number like "+2348035550147".
 * `countryCode` is used when the number has no code of its own.
 * Returns "" for empty input and null when the number is not plausible.
 */
export function normalisePhone(input: string, countryCode: string): string | null {
  const raw = input.trim();
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) {
    // already international
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else {
    const local = digits.replace(/^0+/, "");
    if (local.length < 6) return null;
    digits = countryCode.replace(/\D/g, "") + local;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Splits "+2348035550147" into ["+234", "8035550147"]. */
export function splitPhone(phone: string): [string, string] {
  if (!phone.startsWith("+")) return ["+234", phone];
  const code = codesLongestFirst.find((candidate) => phone.startsWith(candidate));
  return code ? [code, phone.slice(code.length)] : ["", phone];
}

/** "+2348035550147" → "+234 803 555 0147" for display. */
export function formatPhone(phone: string) {
  if (!phone) return "";
  const [code, local] = splitPhone(phone);
  const spaced = local.length > 6 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : local;
  return `${code} ${spaced}`.trim();
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const GUEST_CATEGORIES = ["Guest", "VIP", "Media", "Staff", "Speaker", "Partner"] as const;
