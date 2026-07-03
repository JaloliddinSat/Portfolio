const year = document.querySelector("#year");

if (year) {
  year.textContent = new Date().getFullYear();
}

const cards = document.querySelectorAll(".project-card, .hero-card");

cards.forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    card.style.backgroundImage = `radial-gradient(circle at ${x}% ${y}%, rgba(141, 216, 255, 0.18), transparent 28%), linear-gradient(145deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.04))`;
  });

  card.addEventListener("pointerleave", () => {
    card.style.backgroundImage = "";
  });
});
