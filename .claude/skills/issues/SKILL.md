---
name: issues
description:
    Use when writing, retitling, triaging or reading a GitHub issue in this repo — creating one, rewriting an existing one, grouping issues
    under a parent, or judging whether a title says what the ticket is about. Supplies the Zeitleiste issue rules (title, body sections,
    parents, readiness).
---

# Issues

Die Regeln stehen in `ISSUES.md` im Repo-Root. Lies sie — sie sind die Quelle und sie ändern sich. Nicht aus einer Kopie in einem älteren
Plan arbeiten.

## Der Maßstab, für den das alles da ist

Jemand, der das Produkt kennt und sonst nichts, versteht **aus dem Titel allein**, worum ein Ticket geht. Der erste Absatz führt Ziel oder
Problem in gewöhnlicher Sprache aus. Erst danach wird es technisch.

Wenn du beim Schreiben unsicher bist, ob ein Titel reicht, ist er es nicht.

## Die Griffe, die du am häufigsten brauchst

**Der Vorlesetest.** Was du buchstabieren müsstest, um es auszusprechen, gehört nicht in den Titel. Das ersetzt jede Verbotsliste — auch für
Wörter, die noch niemand aufgeschrieben hat.

**Die Knappheit.** Jeder Satz trägt eine Information, die ohne ihn fehlt. Kein Ausschmücken, kein Begründen des Unbestrittenen, kein
Erklären, was der Leser kann.

**Der Schnitt.** Abschnitte, zu denen du nichts zu sagen hast, fallen weg — ohne Überschrift, ohne Platzhalter. Die meisten Issues tragen
drei oder vier.

**Die Bereitschaft.** Das Issue ist die Spec — gebaut wird direkt daraus. Bereit ist es mit `## Done`, `## Touched` und
`## Acceptance criteria` und ohne offenes `## Open decisions`. Was unklar ist, wird gefragt, nicht geraten. Eine Antwort wandert in den
passenden Abschnitt, die Frage verschwindet.

**Die Gruppe.** Zusammengehörige Issues sind Sub-Issues eines Parents, dessen Titel das gemeinsame Ergebnis nennt. Ein Parent trägt keine
eigene Arbeit; er schließt, wenn seine Sub-Issues geschlossen sind. Sub-Issues verknüpft man über die GraphQL-Mutation `addSubIssue` (Header
`GraphQL-Features: sub_issues`), nicht über einen Verweis im Text.

## Beim Lesen

Ein Titel, der sich nicht in verständliche Sprache übersetzen lässt, ist meistens kein Titelproblem, sondern ein Issue ohne
Produktbegründung. Das melden, statt es kreativ umzubenennen.

## Beim Schließen

Eine kurze Notiz mit dem Link auf Commit oder PR. Bleibt Arbeit liegen: ein Kommentar, was fertig ist und was fehlt. Die Mechanik (wann
`Closes #N` nichts tut) steht im `merge`-Skill.
