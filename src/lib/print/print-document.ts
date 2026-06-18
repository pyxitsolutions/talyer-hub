/**
 * Opens the browser print dialog with minimal header/footer noise.
 * Clears document.title during print (Chrome shows title in header).
 * Pair with @page { margin: 0 } in globals.css to suppress URL/date footers.
 */
export function printDocument(titleWhilePrinting = " ") {
  const previousTitle = document.title;
  document.title = titleWhilePrinting;

  const restoreTitle = () => {
    document.title = previousTitle;
    window.removeEventListener("afterprint", restoreTitle);
  };

  window.addEventListener("afterprint", restoreTitle);
  window.print();
}
