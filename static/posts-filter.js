(() => {
  const containers = document.querySelectorAll(".js-posts-by-year");
  containers.forEach((container) => {
    const buttons = container.querySelectorAll("[data-filter]");
    const groups = container.querySelectorAll(".posts-year");

    const setActive = (activeButton) => {
      buttons.forEach((button) => {
        const isActive = button === activeButton;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    };

    const applyFilter = (filter) => {
      groups.forEach((group) => {
        const items = group.querySelectorAll("article");
        let visible = 0;
        items.forEach((item) => {
          const kind = item.dataset.kind || "";
          const show = filter === "all" || kind === filter;
          item.style.display = show ? "" : "none";
          if (show) visible += 1;
        });
        group.style.display = visible ? "" : "none";
      });
    };

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        setActive(button);
        applyFilter(button.dataset.filter);
      });
    });

    applyFilter("all");
  });
})();
