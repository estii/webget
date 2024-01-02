import page from "webget";

page.set({ width: 1280, height: 720 });

page.restore({ id: "xoyvw6zpzf" });

page.goto({ url: "https://app.estii.com/estii/deals/iRi5Jpwl" });

page.set({ title: "Platform Overview" });

page.trimLeft({});

page.say({ text: "Today you will see how easy it is" });

page.say({
  text: "to scope, price and present a stunning commercial proposal in minutes.",
});

page.set({ title: null });

// overview

page.say({ text: "This is an example deal" });

page.hover({ selector: "[data-id='deal.tabs.overview']" });
page.say({ text: "The overview provides a high-level project breakdown" });

page
  .hover({
    selector: "[data-id='overview.tabs.estimates']",
    offsetX: -100,
    offsetY: 100,
  })
  .say({ text: "by budget," });

page
  .hover({
    selector: "[data-id='overview.tabs.phases']",
    offsetX: -100,
    offsetY: 100,
  })
  .say({ text: "phase, " });

page
  .hover({
    selector: "[data-id='deal.timeline']",
    placement: "right",
    offsetX: 50,
  })
  .say({ text: "timeline, " });

page
  .hover({
    selector: "[data-id='deal.milestones']",
    placement: "right",
    offsetX: 100,
  })
  .say({ text: "and payment milestones." });

// estimates

page.click({ selector: "[data-id='deal.tabs.estimate']" });

page
  .hover({ selector: "[data-id='deal.tabs.estimate']" })
  .say({ text: "Estimates are the starting point for each deal" });

page
  .hover({
    selector: "[data-id='estimate.tabs.features']",
    placement: "bottom-end",
    offset: -30,
  })
  .say({
    text: "Here you define your professional and managed services, overheads, products and other expenses.",
  });
