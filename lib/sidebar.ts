/** Where the admin remembers a collapsed sidebar (localStorage), and the event that says it changed. */
export const SIDEBAR_KEY = "bn-nav-collapsed";
export const SIDEBAR_EVENT = "bn-nav-collapsed";

/**
 * Before the page paints: put the sidebar back the way the owner left it, so it doesn't open wide
 * and then snap shut. An inline script in the root layout's <head> (app/layout.tsx), so it runs on
 * the first page load whichever page that is; in the admin layout it wouldn't run after a link
 * from the kiosk. It only sets an attribute the admin's `rail:` styles read.
 */
export const RESTORE_SIDEBAR = `try{localStorage.getItem("${SIDEBAR_KEY}")==="1"&&document.documentElement.setAttribute("data-nav-collapsed","")}catch(e){}`;
