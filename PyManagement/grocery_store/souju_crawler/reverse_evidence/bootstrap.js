(function bootstrapAiMoviePage() {
  try {
    var stored = window.localStorage.getItem("movie-search:theme-preset");
    var preset =
      stored === "movie-light" || stored === "movie-dark" ? stored : "movie-dark";
    document.documentElement.dataset.theme = preset;
    document.documentElement.classList.toggle("dark", preset === "movie-dark");
  } catch (_) {
    document.documentElement.dataset.theme = "movie-dark";
    document.documentElement.classList.add("dark");
  }

})();
