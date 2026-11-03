/* Umbra bookmark toolbar — folder support via Places.
   Call bookmarkFolders() from M3 chrome loader to build toolbar from
   services/Places. Each folder -> collapsible group; count drives width.
*/
function bookmarkFolders() {
  const toolbar = document.getElementById("umbra-bookmarks");
  if (!toolbar) return;
  toolbar.innerHTML = "";
  // Placeholder: M3 port will inject real Places data here.
  // Width = number of leaf bookmarks * 72px + gap; folders wrap at ~16 items.
  const leaves = []; // Filled by Places.query from browser/components/places/PlacesUtils
  for (const bm of leaves) {
    const el = document.createElement("a");
    el.className = "bookmark";
    el.textContent = bm.title || bm.url;
    el.href = bm.url;
    el.title = bm.url;
    toolbar.appendChild(el);
  }
  toolbar.style.width = Math.min(leaves.length * 72 + 32, window.innerWidth - 40) + "px";
}
