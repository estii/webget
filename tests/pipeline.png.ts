import page from "webget";

page.set({
  width: 1280,
  height: 720,
});

page.restore({ id: "xoyvw6zpzf" });

page.goto({
  url: "https://app.estii.com/estii/deals/iRi5Jpwl/scope/VyNS818z",
});

page.cropSelector({
  selector: "[data-id='scope.priority']",
  padding: 10,
});
