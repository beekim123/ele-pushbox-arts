/* Workbench appearance (light / dark / system). Independent of game scene themes.
 * Runs in <head> so the page never flashes the wrong colours. */
(function () {
  "use strict";
  var KEY = "pb.wb.appearance";
  function read() { try { return localStorage.getItem(KEY) || "system"; } catch (e) { return "system"; } }
  function apply(mode) {
    var root = document.documentElement;
    if (mode === "light" || mode === "dark") root.setAttribute("data-theme", mode);
    else root.removeAttribute("data-theme");
  }
  apply(read());
  window.PBAppearance = {
    get: read,
    set: function (mode) { try { localStorage.setItem(KEY, mode); } catch (e) { /* storage unavailable */ } apply(mode); },
  };
})();
