/**
 * Naming the export file.
 *
 * On web the browser names the download; here the name is what the user sees
 * in whatever app they send it to, possibly months later, so it has to say
 * what it is and when it was taken without being opened.
 */

/**
 * `souschef-export-2026-09-18.json`, using the device's local date.
 *
 * Local, not UTC: someone exporting at 11pm on the 18th in BST should see the
 * 18th, and `toISOString().slice(0, 10)` would hand them the 19th — the same
 * trap the cook log's date field has.
 */
export function exportFileName(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `souschef-export-${year}-${month}-${day}.json`;
}
