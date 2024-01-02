import page from "webget";

page.set({
  width: 800,
  height: 600,
  quality: 80,
});

page.goto({ url: "https://google.com" });
