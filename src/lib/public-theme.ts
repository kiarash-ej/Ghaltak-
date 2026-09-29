export const PUBLIC_THEME_KEY = "ghaltak-public-theme";

// Runs in the document head before public surfaces paint. Only the public-page
// styles consume this attribute; authenticated and checkout pages keep their UI.
export const PUBLIC_THEME_INIT = `(() => {
  let saved;
  try { saved = localStorage.getItem("${PUBLIC_THEME_KEY}"); } catch {}
  document.documentElement.dataset.publicTheme =
    saved === "dark" || saved === "light" ? saved :
    matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
})();`;
