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
    if (toggle.dataset.navMoved === "true") return true;

    const postsItem = postsLink.closest("li") || postsLink.parentElement;
    if (!postsItem) {
      postsLink.after(toggle);
      toggle.dataset.navMoved = "true";
      return true;
    }

    const oldWrapper = toggle.closest("li");
    const newItem = document.createElement("li");
    newItem.className = postsItem.className || "";
    newItem.style.display = "flex";
    newItem.style.alignItems = "center";
    newItem.appendChild(toggle);
    postsItem.after(newItem);
    toggle.dataset.navMoved = "true";

    if (oldWrapper && oldWrapper !== newItem) {
      oldWrapper.remove();
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
