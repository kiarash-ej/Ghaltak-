// A short Persian label for a device from its User-Agent, for «دستگاه‌های من»
// (A10), e.g. «کروم روی اندروید». Only for showing; never used for security.

const BROWSERS: [RegExp, string][] = [
  [/SamsungBrowser/i, "مرورگر سامسونگ"],
  [/Edg\//i, "اج"],
  [/OPR\/|Opera/i, "اپرا"],
  [/Firefox|FxiOS/i, "فایرفاکس"],
  [/Chrome|CriOS/i, "کروم"],
  [/Safari/i, "سافاری"],
];

const SYSTEMS: [RegExp, string][] = [
  [/Android/i, "اندروید"],
  [/iPhone|iPad|iPod/i, "آیفون"],
  [/Windows/i, "ویندوز"],
  [/Mac OS X|Macintosh/i, "مک"],
  [/Linux/i, "لینوکس"],
];

export function deviceLabel(userAgent: string | null | undefined): string {
  if (!userAgent) return "دستگاه ناشناخته";
  const browser = BROWSERS.find(([re]) => re.test(userAgent))?.[1];
  const system = SYSTEMS.find(([re]) => re.test(userAgent))?.[1];
  if (browser && system) return `${browser} روی ${system}`;
  return browser ?? system ?? "دستگاه ناشناخته";
}
