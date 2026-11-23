# Skill: Gemara & Mishnah (Talmud Bavli, Yerushalmi, Mishnah)

## When this applies
Questions about a sugya, daf, or mishnah; what the Talmud says about a topic; explanations of Talmudic arguments; and translation of Talmud passages. Users often ask in Russian or French and want faithful translations: "translate Shabbat 97b into Russian", "explain Berakhot 5:5 in the Yerushalmi", "the 7 clouds of glory".

## Research path
1. **Read the passage.** get_text with exact refs:
   - Bavli: `Berakhot 26b` (amud). Narrow to a segment if long: `Berakhot 26b:3-5`.
   - Mishnah: `Mishnah Berakhot 5:5`.
   - Yerushalmi: `Jerusalem Talmud Berakhot 5:5`.
   - Tosefta: `Tosefta Berakhot 3:1`.
2. **Rishonim on the passage:** get_links with category "Commentary" (Rashi, Tosafot, Rif, Rosh, Ritva…). Read the specific comment with get_text.
3. **Parallels and halachic outcome:** get_links category "Talmud" for parallel sugyot. Use category "Halakhah" to see how the Rambam and Shulchan Arukh codified it.
4. **Topic questions** ("what does the Talmud say about honesty"): search_texts with category "Talmud" (Hebrew/Aramaic terms work best), then read the top 2–3 hits.

## How to answer
- **Walk through the sugya's structure:**
  - Mishnah/Baraita: the case and the ruling.
  - Question (קושיא), answer (תירוץ), proof (ראיה), rejection (דחייה).
  - Conclusion (מסקנא).
  - Name the speakers (which Amora says what) and the generation when it matters.
- Quote the Aramaic/Hebrew of the key lines with translation. Explain technical terms: *teiku*, *kal vachomer*, *hava amina*, *maskana*.
- Distinguish aggadah (narrative, ethical teaching) from halacha in the sugya.
- Say what the practical halacha became, if relevant, briefly.
- **Translation requests:**
  - Translate faithfully, line by line, in the user's language, keeping the original visible.
  - Use Sefaria's translation as a base when it exists in that language (get_text returns it). Otherwise translate yourself and say so.
  - Do not abridge silently. If the passage is long, translate it in parts and say how much remains.
  - Add brief bracketed clarifications as the Steinsaltz style does, clearly marked as additions.

## Pitfalls seen in real chats
- Wrong daf or amud numbers, or confusing Bavli with Yerushalmi. Verify the ref with get_text.
- Summarizing when the user asked for a translation, or translating when they asked for an explanation.
- Losing the thread in long multi-part translations. Keep track of where you stopped and continue from exactly there.

## Citation format
[Berakhot 26b], [Berakhot 26b:3], [Mishnah Berakhot 5:5], [Jerusalem Talmud Berakhot 5:5], [Rashi on Berakhot 2a:1:1], [Tosafot on Berakhot 26b:1:1]
