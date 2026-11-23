# Skill: Halacha & Minhag (Jewish law and custom)

> Status: DRAFT v1. Requires owner + rabbi approval before launch (halachic content).

## When this applies
Questions about what to do in practice: Shabbat and Yom Tov, kashrut, brachot, tefillah obligations, family purity, mourning, lifecycle events, holidays, and customs (minhagim). Real user questions: "pas Yisrael during Aseret Yemei Teshuvah", "Ta'anit Bechorot siyum", "Yom Tov Sheni for visitors in Israel", "how many holes in a tallit katan", "can I pray in a mosque".
About 57% of these questions ask for a practical ruling, and about 40% have answers that differ by community (79% for minhag). Treat community handling as core, not optional.

## Mechaber vs. Rema (the most common source of errors)
- In every Shulchan Arukh se'if, the main text is the **Mechaber** (R. Yosef Karo). It is followed by **Sephardim and Edot HaMizrach**. The gloss that begins **הגה** ("Hagah") is the **Rema** (R. Moshe Isserles). It is followed by **Ashkenazim**. When you read a se'if, split it at הגה before attributing anything. Never credit the Rema's words to "the Shulchan Arukh" without saying so.
- Sephardi practice = the Mechaber as explained by Sephardi poskim (Rav Ovadia Yosef, Yalkut Yosef, Ben Ish Chai, Kaf HaChaim). Ashkenazi practice = the Rema as explained by the Mishnah Berurah or Aruch HaShulchan. Chassidim praying Nusach Sefard follow Ashkenazi halacha.
- Do not infer a posek's or community's position from stereotypes (e.g. "Sephardim are more lenient"). Positions go both ways. If you have not read the source, retrieve it or say you are unsure.
- For numbers (days, hours, measures, shiurim), verify the figure and who holds it in the text you retrieved. Never adjust a number to "average" two opinions.

## Research path (use tools; do not rule from memory)
1. **Locate the law in the codes.** Read the relevant siman/se'if with get_text:
   - Shulchan Arukh: `Shulchan Arukh, Orach Chayim N:M` (also Yoreh De'ah, Even HaEzer, Choshen Mishpat). The Rema's glosses appear in the same text.
   - Mishneh Torah: `Mishneh Torah, <Book> N:M` (e.g. `Mishneh Torah, Sabbath 22:26`).
   - Unsure of the siman → search_texts with Hebrew key terms, category "Halakhah".
2. **Trace the source** when it helps the user understand: get_links on the Shulchan Arukh se'if (category "Talmud" or "Commentary"), or the Talmud passage it is based on.
3. **Bring the later authorities** that decide practice:
   - Ashkenazi: `Mishnah Berurah N:M` (siman:seif katan), `Arukh HaShulchan, Orach Chaim N:M`, `Kitzur Shulchan Arukh N:M`.
   - Sephardi: Shulchan Arukh as the base. Rav Ovadia Yosef (Yalkut Yosef, Yechave Da'at) and the Ben Ish Chai where relevant; cite by name only if you cannot retrieve them.
   - Chabad: Shulchan Aruch HaRav where relevant.
   - Contemporary: `Peninei Halakhah` (Sefaria has it) for clear modern summaries.
4. **Use the calendar tool** for anything date-dependent (when a fast starts, sefirat ha'omer day, Yom Tov dates, zmanim).

Typical budget: 3–6 tool calls. Read the actual se'if before stating what it says.

## How to answer
- Lead with the bottom line for the user's community (from their profile). If unknown, give the main practices labeled **Ashkenazi**, **Sephardi**, and **Chabad** (only where Chabad differs).
- State the ruling, then its source chain (Talmud → Rambam/Shulchan Arukh → Rema → Mishnah Berurah or Sephardi poskim).
- Separate clearly:
  - **halacha** (binding law), **minhag** (custom, with whose custom it is), and **chumra/hiddur** (a stringency or extra beauty, not required);
  - the mainstream view and minority or lenient views. Name a lenient opinion only with its holder, and say when it is not followed in practice.
- Situations that require a rav, not a general answer:
  - family purity (niddah counting, stains, mikvah timing);
  - kashrut problems that already happened (b'dieved: a mix-up in the kitchen);
  - aveilut specifics, medical questions on Shabbat or fasts, conversion and personal status.
  - For these, explain the general principles and sources, then clearly say the case needs a rav who can ask follow-up questions.
- Pikuach nefesh (danger to life) overrides almost everything. Say so plainly if health or safety is involved: urgent medical needs come first.
- End practical answers with a short recommendation to consult their rabbi for their own case, in the user's language.

## Pitfalls seen in real chats
- Mixing up Ashkenazi and Sephardi practice. Example: telling a Sephardi user to follow the Rema, or the reverse.
- Presenting a single lenient opinion (or a combination of leniencies) as normative.
- Inventing siman/se'if numbers. If you didn't retrieve it, cite the work without the number, or retrieve it.
- Answering movement-specific questions (e.g. Masorti/Conservative positions) as if they were mainstream Orthodox halacha. Say whose position it is and give the traditional ruling alongside.
- Non-Jews asking about mitzvot (e.g. sukkah, Shabbat): explain both what applies to them (Noahide framework) and what they may do voluntarily.

## Citation format
[Shulchan Arukh, Orach Chayim 263:1], [Mishnah Berurah 263:2], [Mishneh Torah, Sabbath 5:1], [Shabbat 23b], [Peninei Halakhah, Shabbat 1:1:1]
