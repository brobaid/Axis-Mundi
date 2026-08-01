# Reading Room Corpora: The Daodejing and the Analects

Destination: `/docs/corpora/chinese/`. Authored by the owner's reviewer. Two
corpora, one memo; they open the Chinese shelf together.

## Daodejing (`daodejing-paired.json`)

1. Chinese: the received text in its standard 81 chapters (new source record
   `ddj-received-text`). English: James Legge's 1891 Sacred Books of the East
   translation (new source record `legge-sbe-39`, note: "James Legge's 1891
   translation, public domain; its verse passages rhyme by Legge's choice, a
   feature of the edition, not the original").
2. All 81 chapters paired, both sides complete, zero gaps. Chapter is the
   citable unit and the route unit.

## Analects (`analects-paired.json`)

1. Chinese: the received text of the twenty books with the traditional book
   names carried (new source record `analects-received-text`). English: Legge's
   1861 Chinese Classics translation (new source record `legge-classics-1`).
2. **The honest structure: 10 of 20 books align saying-for-saying and render
   paired. Ten books (I, V, VI, VII, IX, X, XI, XIV, XV, XX) carry `aligned: false`
   because Legge's chapter divisions differ from the received Chinese text,
   most sharply in Book X; forcing an index pairing there would silently
   mismatch text after the first divergence.** Those books render as parallel
   columns, each side under its own numbering, with the note field verbatim.
   This is the corpus telling the truth about a real editorial divergence
   between a Victorian translation and the modern received text.
3. The shelf entry states the cluster's canon reality per the dive: these two
   works open the shelf and do not close a canon that was never single.
