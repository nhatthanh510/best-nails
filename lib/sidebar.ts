/** Where the admin remembers a collapsed sidebar (localStorage), and the event that says it changed. */
export const SIDEBAR_KEY = "bn-nav-collapsed";
export const SIDEBAR_EVENT = "bn-nav-collapsed";

/**
 * Before the page paints: put the sidebar back the way the owner left it, so it doesn't open wide
 * and then snap shut. An inline script at the top of the admin layout (a server component, so it
 * lives here rather than in the client toggle).
 */
export const RESTORE_SIDEBAR = `try{localStorage.getItem("${SIDEBAR_KEY}")==="1"&&document.documentElement.setAttribute("data-nav-collapsed","")}catch(e){}`;
