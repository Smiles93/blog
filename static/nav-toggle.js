(() => {
  const tryFindToggle = () => {
    return document.querySelector("footer .theme-toggle");
  };

  const tryFindPostsLink = () => {
    const links = Array.from(document.querySelectorAll("nav a"));
    return links.find((link) => link.textContent.trim() === "Posts");
  };

  const moveToggle = () => {
    const toggle = tryFindToggle();
    const postsLink = tryFindPostsLink();
    if (!toggle || !postsLink) return false;
    if (toggle.dataset.navMoved === "true") return true;

    const nav = postsLink.closest("nav");
    if (!nav) return false;

    const oldParent = toggle.parentElement;
    toggle.classList.remove("hx-h-7", "hx-text-xs", "hx-text-left", "hx-px-2");
    toggle.classList.add(
      "hx-text-sm",
      "hx-whitespace-nowrap",
      "hx-p-2",
      "hx-items-center",
      "md:hx-inline-flex",
      "hx-hidden"
    );

    toggle.dataset.navMoved = "true";
    postsLink.after(toggle);

    if (oldParent && oldParent.children.length === 0) {
      oldParent.remove();
    }

    return true;
  };

  const attempt = () => {
    if (moveToggle()) return;
    setTimeout(() => moveToggle(), 250);
    setTimeout(() => moveToggle(), 750);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attempt);
  } else {
    attempt();
  }
})();
