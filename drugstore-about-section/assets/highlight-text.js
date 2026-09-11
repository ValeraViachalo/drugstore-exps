// Highlight Text on Scroll — Osmo Supply.
// The text is split into characters and each one is tweened from a low opacity up to full,
// scrubbed by the scroll. No pseudo elements, no duplicated text, no masks.
//
// Knobs, all read off the heading :
//   [data-highlight-text]         marks a heading as a target
//   [data-highlight-scroll-start] when the highlight starts. Default "top 90%"
//   [data-highlight-scroll-end]   when it finishes. Default "center 40%"
//   [data-highlight-fade]         opacity of a letter before it is lit. Default 0.2
//   [data-highlight-stagger]      gap between letters. 1 lights them strictly one by one,
//                                 lower is smoother. Default 0.1
//   [data-highlight-trigger]      ADDED HERE : the ancestor whose scroll drives the highlight.
//                                 Our heading is sticky, so it never moves in the viewport and
//                                 cannot measure its own scroll — it hands the job to the 500vh
//                                 track above it. Leave the attribute off and the resource
//                                 behaves exactly as documented, triggering on the heading.

gsap.registerPlugin(ScrollTrigger, SplitText)

function initHighlightText(){

  let splitHeadingTargets = document.querySelectorAll("[data-highlight-text]")
  splitHeadingTargets.forEach((heading) => {

    const triggerSelector = heading.getAttribute("data-highlight-trigger")
    const trigger = (triggerSelector && heading.closest(triggerSelector)) || heading

    const scrollStart = heading.getAttribute("data-highlight-scroll-start") || "top 90%"
    const scrollEnd = heading.getAttribute("data-highlight-scroll-end") || "center 40%"
    const fadedValue = heading.getAttribute("data-highlight-fade") || 0.2 // Opacity of letter
    const staggerValue =  heading.getAttribute("data-highlight-stagger") || 0.1 // Smoother reveal

    new SplitText(heading, {
      type: "words, chars",
      autoSplit: true,
      onSplit(self) {
        let ctx = gsap.context(() => {
          let tl = gsap.timeline({
            scrollTrigger: {
              scrub: true,
              trigger: trigger,
              start: scrollStart,
              end: scrollEnd,
            }
          })
          tl.from(self.chars,{
            autoAlpha: fadedValue,
            stagger: staggerValue,
            ease: "linear"
          })
        });
        return ctx; // return our animations so GSAP can clean them up when onSplit fires
      }
    });
  });
}

// Initialize Highlight Text on Scroll
document.addEventListener("DOMContentLoaded", () =>{
  initHighlightText();
});
