// Marks the page as running JavaScript before anything paints, so count-ups
// can wait for their animation instead of flashing (globals.css, `.js`).
// Rendered once near the top of the dashboard layout.
export function JsMarker() {
  return (
    <script
      // A fixed string, no user data.
      dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }}
    />
  );
}
