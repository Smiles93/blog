(() => {
  const tryFindToggle = () => {
    return (
      document.querySelector("[data-theme-toggle]") ||
      document.querySelector("button[aria-label*=\"theme\" i]") ||
      document.querySelector("button[aria-label*=\"dark\" i]") ||
      document.querySelector("button[aria-label*=\"light\" i]") ||
      document.querySelector("#theme-toggle")
    );
  };

  const tryFindPostsLink = () => {
    const links = Array.from(document.querySelectorAll("nav a"));
    return links.find((link) => link.textContent.trim() === "Posts");
  };

  const moveToggle = () => {
    const toggle = tryFindToggle();
    const postsLink = tryFindPostsLink();
    if (!toggle || !postsLink) return false;

    const postsItem = postsLink.closest("li") || postsLink.parentElement;
    const toggleItem = toggle.closest("li") || toggle.parentElement;
    if (!postsItem || !toggleItem) {
      postsLink.after(toggle);
      return true;
    }

    if (toggleItem === postsItem.nextSibling) return true;
    postsItem.after(toggleItem);
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
