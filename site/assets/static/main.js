const boot = () => {
  const navElement = document.querySelector("nav");
  document.querySelector(".btn-menu").addEventListener("click", () => {
    navElement.style.display = "block";
  });
  document.querySelector(".btn-close").addEventListener("click", () => {
    navElement.style.display = "none";
  });
};

boot();
