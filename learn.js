/* C.F.B. Learn answers. Every fact here comes from the linked page, read on the date in CHECKED.
   Change a fact only after rereading its source; update CHECKED when you do. */
(function () {
  "use strict";
  const CHECKED = "10 Nov 2026";
  const LB_FAQ = { t: "Leaping Bunny: FAQ", u: "https://www.leapingbunny.org/Web/content/faq.aspx?hkey=03da4c1e-eb16-412a-a308-223519502ea0" };
  const LB_STD = { t: "Leaping Bunny: The Standard", u: "https://www.leapingbunny.org/Web/content/standard.aspx?hkey=627d3716-9716-46a2-86c0-1e30fd1dfa82" };
  const PETA_FAQ = { t: "PETA: Cruelty-free FAQ", u: "https://crueltyfree.peta.org/faq/" };
  const PETA_LIST = { t: "PETA: Join the Ultimate Cruelty-Free List", u: "https://www.peta.org/about-peta/learn-about-peta/info-businesses/join-petas-ultimate-cruelty-free-list/" };
  const PETA_VEGAN = { t: "PETA: Vegan companies that don't test", u: "https://crueltyfree.peta.org/vegan-companies/" };

  const ANSWERS = [
    {
      q: "Cruelty-free or vegan: what's the difference?",
      a: [
        "Cruelty-free is about testing: the product and its ingredients weren't tested on animals by the company or its suppliers. Vegan is about ingredients: nothing in it comes from an animal.",
        "A product can be one without the other. Leaping Bunny certifies testing only and says ingredient lists, which the law requires on the label, tell you whether a product is vegan. PETA keeps a separate list of vegan companies that don't test.",
        "C.F.B. shows the two separately on every brand."
      ],
      src: [LB_FAQ, PETA_VEGAN]
    },
    {
      q: "PETA or Leaping Bunny: aren't they the same?",
      a: [
        "No. They're two programs with different checks, so C.F.B. never treats one as the other.",
        "Leaping Bunny: the company picks a fixed cut-off date and promises no new animal testing after it, by itself or its suppliers. It keeps written declarations from each supplier (its supplier monitoring system), recommits every year, and must be open to an independent audit.",
        "PETA's Ultimate Cruelty-Free List, running since 1987, lists companies that verify that they and their suppliers never test on animals, now or in the future. Since 2018 it also lists individual brands that meet its rules across their whole product line."
      ],
      src: [LB_STD, LB_FAQ, PETA_LIST, PETA_FAQ]
    },
    {
      q: "What about brands owned by a company that tests?",
      a: [
        "Some cruelty-free brands belong to parent companies that do test on animals.",
        "Leaping Bunny keeps a brand like that on its list only if it runs as a stand-alone company with its own supply chain and still meets the Standard. Leaping Bunny also says many shoppers would rather not give money to a parent company that hasn't committed to ending animal testing.",
        "C.F.B. names the parent company on every brand page. Turn on Strict and brands whose parent tests are hidden."
      ],
      src: [LB_FAQ, PETA_FAQ]
    },
    {
      q: "Does selling in China mean a brand tests on animals?",
      a: [
        "Not automatically, any more. Leaping Bunny says brands importing to sell in mainland China used to have to test, but recent changes to China's rules make it possible, in specific cases, to sell there and stay Leaping Bunny certified. It runs a China program with regulatory experts that checks the paperwork and keeps watching after sales start.",
        "Leaping Bunny says it sees no animal testing for products sold to China online (cross-border e-commerce), and that China's policies change often.",
        "PETA asks companies that do business in China extra questions, because products sold there are likely to be tested.",
        "C.F.B. lets you decide: Strict hides brands sold in mainland China stores."
      ],
      src: [LB_FAQ, PETA_FAQ]
    },
    {
      q: "My brand isn't listed. Does that mean it tests?",
      a: [
        "No. PETA says a company may be missing because it won't answer PETA's questions about its full policy, or because it doesn't sell in the regions PETA covers (the U.S., Canada, India and Germany).",
        "C.F.B. shows \"unknown\" when we can't find proof either way, and never treats a missing listing as a yes or a no."
      ],
      src: [PETA_LIST]
    }
  ];

  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const list = document.getElementById("learn-list");
  if (!list) return;
  list.innerHTML = ANSWERS.map(x => `
    <details>
      <summary>${esc(x.q)}<svg class="chev" aria-hidden="true"><use href="#i-chev"/></svg></summary>
      <div class="body">
        ${x.a.map(p => `<p>${esc(p)}</p>`).join("")}
        <div class="sources">Sources, checked ${CHECKED}:
          <ul>${x.src.map(s => `<li><a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a></li>`).join("")}</ul>
        </div>
      </div>
    </details>`).join("");
})();
