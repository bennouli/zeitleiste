// All dates are Gregorian, including Russian dates before 1918 (Julian dates converted).
import type { Entry } from '@/lib/entry'
import { paragraphsToLexical } from '@/lib/richText'

export const entries: Entry[] = [
    {
        id: 'grosser-nordischer-krieg',
        title: 'Großer Nordischer Krieg',
        summary:
            'Russland unter Peter dem Großen kämpft zeitweise im Bündnis mit Sachsen-Polen und Dänemark gegen Schweden um die Vorherrschaft im Ostseeraum. Mit dem Frieden von Nystad (10. September 1721; 30. August nach julianischem Kalender) steigt Russland zur europäischen Großmacht auf.',
        start: { year: 1700 },
        end: { year: 1721, month: 9, day: 10 },
        type: 'war',
        tags: ['Russland', 'Schweden'],
    },
    {
        id: 'katharina-die-grosse',
        title: 'Herrschaft Katharinas der Großen',
        summary:
            'Nach einem Staatsstreich gegen ihren Ehemann Peter III. besteigt Katharina II. am 9. Juli 1762 den Thron (28. Juni nach julianischem Kalender) und regiert bis zu ihrem Tod 1796. Russland dehnt sich bis ans Schwarze Meer und nach Westen aus.',
        start: { year: 1762, month: 7, day: 9 },
        end: { year: 1796, month: 11, day: 17 },
        type: 'power',
        tags: ['Russland'],
    },
    {
        id: 'franzoesische-revolution',
        title: 'Französische Revolution',
        summary:
            'In dem Jahrzehnt vom Sturm auf die Bastille bis zum Staatsstreich Napoleon Bonapartes im November 1799 wird die absolute Monarchie in Frankreich gestürzt und die Republik ausgerufen. Die Ideen von Volkssouveränität und Bürgerrechten wirken in ganz Europa fort.',
        start: { year: 1789, month: 7, day: 14 },
        end: { year: 1799, month: 11, day: 9 },
        type: 'revolution',
        tags: ['Frankreich'],
    },
    {
        id: 'russlandfeldzug-1812',
        title: 'Napoleons Russlandfeldzug',
        summary:
            'Die Grande Armée überschreitet am 24. Juni 1812 die Memel (12. Juni nach julianischem Kalender) und erreicht im September Moskau. Der Rückzug im Winter endet im Dezember mit der fast vollständigen Vernichtung des Heeres.',
        start: { year: 1812, month: 6, day: 24 },
        end: { year: 1812, month: 12 },
        type: 'war',
        tags: ['Frankreich', 'Russland'],
    },
    {
        id: 'wiener-kongress',
        title: 'Wiener Kongress',
        summary:
            'Nach dem Sieg über Napoleon ordnen die Großmächte, darunter Russland, Österreich, Preußen und Großbritannien, die politische Landkarte Europas neu. Die Schlussakte wird am 9. Juni 1815 unterzeichnet.',
        start: { year: 1814, month: 9 },
        end: { year: 1815, month: 6, day: 9 },
        type: 'power',
        tags: ['Russland', 'Österreich', 'Preußen', 'Großbritannien'],
    },
    {
        id: 'dekabristenaufstand',
        title: 'Dekabristenaufstand',
        summary:
            'Adlige Offiziere fordern in Sankt Petersburg eine Verfassung und verweigern den Eid auf Nikolaus I.; der Aufstand wird noch am selben Tag niedergeschlagen. Nach julianischem Kalender war es der 14. Dezember; der Name leitet sich vom russischen Wort für Dezember ab.',
        start: { year: 1825, month: 12, day: 26 },
        type: 'revolution',
        tags: ['Russland', 'Sankt Petersburg'],
    },
    {
        id: 'krimkrieg',
        title: 'Krimkrieg',
        summary:
            'Russland kämpft gegen das Osmanische Reich, dem sich 1854 Großbritannien und Frankreich anschließen. Die Niederlage und der Pariser Frieden vom 30. März 1856 zeigen die Rückständigkeit des Zarenreichs und leiten Reformen ein.',
        start: { year: 1853, month: 10 },
        end: { year: 1856, month: 3, day: 30 },
        type: 'war',
        tags: ['Russland', 'Osmanisches Reich', 'Großbritannien', 'Frankreich'],
    },
    {
        id: 'aufhebung-der-leibeigenschaft',
        title: 'Aufhebung der Leibeigenschaft',
        summary:
            'Zar Alexander II. hebt am 3. März 1861 (19. Februar nach julianischem Kalender) mit einem Manifest die Leibeigenschaft der Bauern in Russland auf. Die Befreiten müssen ihr Land jedoch über Jahrzehnte abbezahlen.',
        start: { year: 1861, month: 3, day: 3 },
        type: 'event',
        tags: ['Russland'],
    },
    {
        id: 'deutsche-reichsgruendung',
        title: 'Gründung des Deutschen Kaiserreichs',
        summary:
            'Nach dem Sieg über Frankreich wird der preußische König Wilhelm I. im Spiegelsaal von Versailles zum Deutschen Kaiser proklamiert. Das geeinte Deutschland verschiebt das Mächtegleichgewicht in Europa.',
        start: { year: 1871, month: 1, day: 18 },
        type: 'power',
        tags: ['Deutschland'],
    },
    {
        id: 'russische-revolution-1905',
        title: 'Russische Revolution von 1905',
        summary:
            'Nach dem „Blutsonntag“ am 22. Januar 1905 (9. Januar nach julianischem Kalender) erfassen Streiks und Aufstände das Zarenreich. Der Zar gewährt ein Parlament, die Duma, schränkt dessen Rechte aber mit dem Staatsstreich vom Juni 1907 wieder ein.',
        start: { year: 1905, month: 1, day: 22 },
        end: { year: 1907, month: 6 },
        type: 'revolution',
        tags: ['Russland'],
    },
    {
        id: 'erster-weltkrieg',
        title: 'Erster Weltkrieg',
        summary:
            'Von der österreichisch-ungarischen Kriegserklärung an Serbien bis zum Waffenstillstand von Compiègne kämpfen die Mittelmächte gegen die Entente, zu der anfangs auch Russland gehört. Rund 17 Millionen Menschen sterben.',
        start: { year: 1914, month: 7, day: 28 },
        end: { year: 1918, month: 11, day: 11 },
        type: 'war',
        tags: ['Deutschland', 'Russland', 'Frankreich', 'Großbritannien'],
    },
    {
        id: 'februarrevolution',
        title: 'Februarrevolution',
        summary:
            'Ab dem 8. März 1917 (23. Februar nach julianischem Kalender, daher der Name) erzwingen Massenstreiks und meuternde Soldaten in Petrograd die Abdankung Nikolaus’ II. Eine Provisorische Regierung übernimmt die Macht.',
        start: { year: 1917, month: 3, day: 8 },
        type: 'revolution',
        tags: ['Russland'],
    },
    {
        id: 'oktoberrevolution',
        title: 'Oktoberrevolution',
        summary:
            'Die Bolschewiki unter Lenin stürzen in Petrograd die Provisorische Regierung und übernehmen die Macht (25. Oktober nach julianischem Kalender).',
        start: { year: 1917, month: 11, day: 7 },
        type: 'revolution',
        tags: ['Russland'],
        post: {
            body: paragraphsToLexical(`Im Herbst 1917 war die Provisorische Regierung unter Alexander Kerenski geschwächt. Russland führte den verlustreichen Krieg gegen die Mittelmächte weiter, die Versorgung der Städte brach zusammen, und auf dem Land eigneten sich Bauern eigenmächtig Gutsland an. Die Bolschewiki gewannen mit ihren Forderungen nach Frieden, Land und Brot in den Arbeiter- und Soldatenräten, den Sowjets, zunehmend die Mehrheit.

In der Nacht auf den 7. November 1917 besetzten Rotgardisten und Soldaten unter Führung des Militärrevolutionären Komitees des Petrograder Sowjets Brücken, Bahnhöfe und Telegrafenämter. Am folgenden Abend wurde das Winterpalais eingenommen, der Sitz der Regierung; ihre Minister wurden verhaftet. Nach dem damals in Russland gültigen julianischen Kalender war dies der 25. Oktober, daher der Name der Revolution.

Der gleichzeitig tagende Zweite Allrussische Sowjetkongress bestätigte die Machtübernahme und verabschiedete Dekrete über den Frieden und über das Land. Eine neue Regierung, der Rat der Volkskommissare unter Lenin, trat an die Stelle der Provisorischen Regierung. Die im November gewählte Verfassunggebende Versammlung, in der die Bolschewiki keine Mehrheit hatten, wurde im Januar 1918 aufgelöst.

Die Oktoberrevolution mündete in einen mehrjährigen Bürgerkrieg und schließlich in die Gründung der Sowjetunion. Sie gilt als eines der folgenreichsten Ereignisse des 20. Jahrhunderts, weil sie den ersten kommunistisch regierten Staat hervorbrachte und die Weltpolitik bis zum Ende des Kalten Krieges prägte.`),
        },
    },
    {
        id: 'russischer-buergerkrieg',
        title: 'Russischer Bürgerkrieg',
        summary:
            'Ab 1918 kämpfen die Rote Armee der Bolschewiki und die antibolschewistischen „Weißen“, unterstützt von ausländischen Interventionstruppen, um die Herrschaft in Russland. Mit der Einnahme Wladiwostoks im Oktober 1922 enden die großen Kämpfe.',
        start: { year: 1918 },
        end: { year: 1922, month: 10 },
        type: 'war',
        tags: ['Russland'],
    },
    {
        id: 'frieden-von-brest-litowsk',
        title: 'Frieden von Brest-Litowsk',
        summary:
            'Sowjetrussland schließt einen Separatfrieden mit den Mittelmächten und scheidet aus dem Ersten Weltkrieg aus. Es verzichtet dabei auf große Gebiete, darunter Polen, das Baltikum und die Ukraine.',
        start: { year: 1918, month: 3, day: 3 },
        type: 'power',
        tags: ['Russland', 'Deutschland'],
    },
    {
        id: 'versailler-vertrag',
        title: 'Versailler Vertrag',
        summary:
            'Die Siegermächte und Deutschland unterzeichnen im Spiegelsaal von Versailles den Friedensvertrag. Deutschland verliert Gebiete, muss Reparationen zahlen und wird militärisch stark beschränkt.',
        start: { year: 1919, month: 6, day: 28 },
        type: 'power',
        tags: ['Deutschland', 'Frankreich', 'Großbritannien', 'USA'],
    },
    {
        id: 'kronstadter-matrosenaufstand',
        title: 'Kronstädter Matrosenaufstand',
        summary:
            'Matrosen der Festung Kronstadt, einst Stütze der Bolschewiki, fordern freie Sowjetwahlen und Meinungsfreiheit. Die Rote Armee schlägt den Aufstand nach gut zwei Wochen blutig nieder.',
        start: { year: 1921, month: 3, day: 1 },
        end: { year: 1921, month: 3, day: 18 },
        type: 'revolution',
        tags: ['Russland'],
    },
    {
        id: 'sowjetunion',
        title: 'Sowjetunion',
        summary:
            'Am 30. Dezember 1922 schließen sich die Russische, die Ukrainische, die Weißrussische und die Transkaukasische Sowjetrepublik zur Union der Sozialistischen Sowjetrepubliken zusammen. Sie besteht bis zu ihrer Auflösung am 26. Dezember 1991.',
        start: { year: 1922, month: 12, day: 30 },
        end: { year: 1991, month: 12, day: 26 },
        type: 'power',
        tags: ['Sowjetunion'],
    },
    {
        id: 'hitler-stalin-pakt',
        title: 'Hitler-Stalin-Pakt',
        summary:
            'Das Deutsche Reich und die Sowjetunion schließen einen Nichtangriffsvertrag. Ein geheimes Zusatzprotokoll teilt Ostmitteleuropa in Interessensphären auf und ebnet den Weg für den Überfall auf Polen.',
        start: { year: 1939, month: 8, day: 23 },
        type: 'power',
        tags: ['Deutschland', 'Sowjetunion'],
    },
    {
        id: 'zweiter-weltkrieg',
        title: 'Zweiter Weltkrieg',
        summary:
            'Mit dem deutschen Überfall auf Polen beginnt der verheerendste Krieg der Geschichte; ab 1941 trägt die Sowjetunion die Hauptlast des Kampfes gegen Deutschland. Er endet in Europa im Mai 1945 und mit der Kapitulation Japans am 2. September 1945.',
        start: { year: 1939, month: 9, day: 1 },
        end: { year: 1945, month: 9, day: 2 },
        type: 'war',
        tags: ['Deutschland', 'Sowjetunion', 'USA', 'Großbritannien'],
    },
    {
        id: 'kalter-krieg',
        title: 'Kalter Krieg',
        summary:
            'Der weltweite Systemkonflikt zwischen den USA und der Sowjetunion samt ihren Verbündeten wird hier ab der Verkündung der Truman-Doktrin am 12. März 1947 datiert. Er endet mit der Auflösung der Sowjetunion im Dezember 1991.',
        start: { year: 1947, month: 3, day: 12 },
        end: { year: 1991, month: 12, day: 26 },
        type: 'war',
        tags: ['USA', 'Sowjetunion'],
    },
    {
        id: 'nato-gruendung',
        title: 'Gründung der NATO',
        summary:
            'Zwölf westliche Staaten, darunter die USA, Kanada, Großbritannien und Frankreich, unterzeichnen in Washington den Nordatlantikvertrag. Das Bündnis verpflichtet die Mitglieder zu gegenseitigem Beistand.',
        start: { year: 1949, month: 4, day: 4 },
        type: 'power',
        tags: ['NATO', 'USA'],
    },
    {
        id: 'kubakrise',
        title: 'Kubakrise',
        summary:
            'Nach der Entdeckung sowjetischer Mittelstreckenraketen auf Kuba stehen die USA und die Sowjetunion dreizehn Tage lang am Rand eines Atomkriegs. Die Krise endet mit der Zusage Moskaus, die Raketen abzuziehen.',
        start: { year: 1962, month: 10, day: 16 },
        end: { year: 1962, month: 10, day: 28 },
        type: 'war',
        tags: ['USA', 'Sowjetunion', 'Kuba'],
        post: {
            body: paragraphsToLexical(`Nach der gescheiterten, von den USA unterstützten Invasion in der Schweinebucht 1961 suchte Kubas Regierung unter Fidel Castro engeren Schutz durch die Sowjetunion. Parteichef Nikita Chruschtschow ließ daraufhin 1962 heimlich Mittelstreckenraketen mit Atomsprengköpfen auf die Insel bringen. Er wollte Kuba absichern und zugleich einen Ausgleich für die amerikanischen Raketen in der Türkei und in Italien schaffen.

Am 16. Oktober 1962 legten Berater dem Präsidenten John F. Kennedy Luftaufnahmen eines Aufklärungsflugzeugs vor, die Abschussrampen auf Kuba zeigten. Kennedy beriet sich tagelang im kleinen Kreis und entschied sich gegen einen sofortigen Luftangriff. Am 22. Oktober machte er die Raketen in einer Fernsehansprache öffentlich und verkündete eine Seeblockade, die er als „Quarantäne“ bezeichnete.

In den folgenden Tagen steuerten sowjetische Frachter auf die Sperrlinie zu, und die Streitkräfte beider Seiten wurden in höchste Alarmbereitschaft versetzt. Am 27. Oktober wurde über Kuba ein amerikanisches Aufklärungsflugzeug abgeschossen. Hinter den Kulissen verhandelten beide Seiten über Briefe und vertrauliche Kanäle weiter.

Am 28. Oktober kündigte Chruschtschow den Abbau der Raketen an. Im Gegenzug sicherten die USA zu, Kuba nicht anzugreifen, und sagten vertraulich den späteren Abzug ihrer Raketen aus der Türkei zu. Die Krise führte 1963 zur Einrichtung einer direkten Fernschreibverbindung zwischen Washington und Moskau, dem sogenannten heißen Draht, und zu ersten Abkommen über Rüstungskontrolle.`),
        },
    },
    {
        id: 'fall-der-berliner-mauer',
        title: 'Fall der Berliner Mauer',
        summary:
            'Nach Massenprotesten und einer missverständlichen Ankündigung neuer Reiseregeln öffnet die DDR ihre Grenzübergänge in Berlin. Der Mauerfall wird zum Symbol für das Ende der Teilung Europas.',
        start: { year: 1989, month: 11, day: 9 },
        type: 'event',
        tags: ['DDR', 'Berlin'],
        post: {
            body: paragraphsToLexical(`Im Sommer und Herbst 1989 geriet die DDR-Führung unter wachsenden Druck. Zehntausende Bürgerinnen und Bürger flohen über Ungarn, das seine Grenze zu Österreich geöffnet hatte, oder über die Botschaften in Prag und Warschau in den Westen. Gleichzeitig forderten bei den Montagsdemonstrationen in Leipzig und anderen Städten immer mehr Menschen Reisefreiheit und demokratische Reformen. Die Sowjetunion unter Michail Gorbatschow machte deutlich, dass sie nicht militärisch eingreifen würde.

Am Abend des 9. November 1989 stellte SED-Politbüromitglied Günter Schabowski auf einer im Fernsehen übertragenen Pressekonferenz eine neue Reiseregelung vor. Auf die Frage, ab wann sie gelte, antwortete er, nach seiner Kenntnis sofort und unverzüglich. Die Nachricht verbreitete sich rasch über westliche Rundfunk- und Fernsehsender, die auch in der DDR empfangen wurden.

Noch in derselben Nacht versammelten sich Tausende Ost-Berliner an den Grenzübergängen. Die Grenzsoldaten hatten keine klaren Befehle. Gegen 23:30 Uhr öffnete der diensthabende Offizier am Übergang Bornholmer Straße den Schlagbaum, bald darauf folgten weitere Übergänge. Menschen aus Ost und West feierten gemeinsam auf der Mauer am Brandenburger Tor.

Der Mauerfall beschleunigte den Zusammenbruch der SED-Herrschaft und machte den Weg zur deutschen Einheit frei, die am 3. Oktober 1990 vollzogen wurde. Er gilt als Wendepunkt am Ende des Kalten Krieges und steht bis heute für die friedlichen Revolutionen in Mittel- und Osteuropa.`),
        },
    },
    {
        id: 'deutsche-wiedervereinigung',
        title: 'Deutsche Wiedervereinigung',
        summary:
            'Die DDR tritt der Bundesrepublik Deutschland bei. Vorausgegangen war der Zwei-plus-Vier-Vertrag, in dem die vier Siegermächte des Zweiten Weltkriegs, darunter die Sowjetunion, dem vereinten Deutschland die volle Souveränität zugestanden.',
        start: { year: 1990, month: 10, day: 3 },
        type: 'power',
        tags: ['Deutschland'],
    },
    {
        id: 'terroranschlaege-11-september',
        title: 'Terroranschläge vom 11. September',
        summary:
            'Terroristen des Netzwerks al-Qaida entführen vier Passagierflugzeuge und steuern sie unter anderem in das World Trade Center in New York und das Pentagon. Fast 3000 Menschen sterben; die USA beginnen den „Krieg gegen den Terror“.',
        start: { year: 2001, month: 9, day: 11 },
        type: 'event',
        tags: ['USA'],
    },
    {
        id: 'eu-osterweiterung',
        title: 'EU-Osterweiterung',
        summary:
            'Zehn Staaten treten der Europäischen Union bei, darunter Polen, Tschechien, Ungarn und die baltischen Staaten, die früher zum Ostblock oder zur Sowjetunion gehörten.',
        start: { year: 2004, month: 5, day: 1 },
        type: 'power',
        tags: ['EU'],
    },
    {
        id: 'annexion-der-krim',
        title: 'Annexion der Krim',
        summary:
            'Nach der Besetzung durch russische Truppen ohne Hoheitsabzeichen und einem international nicht anerkannten Referendum gliedert Russland die ukrainische Halbinsel Krim im März 2014 in sein Staatsgebiet ein.',
        start: { year: 2014, month: 3 },
        type: 'war',
        tags: ['Russland', 'Ukraine', 'Krim'],
    },
    {
        id: 'russischer-angriffskrieg-gegen-die-ukraine',
        title: 'Russischer Angriffskrieg gegen die Ukraine',
        summary:
            'Am 24. Februar 2022 beginnt Russland eine umfassende militärische Invasion der Ukraine. Der Krieg dauert an und hat das Verhältnis zwischen Russland und dem Westen grundlegend verändert.',
        start: { year: 2022, month: 2, day: 24 },
        end: 'ongoing',
        type: 'war',
        tags: ['Russland', 'Ukraine'],
    },
]
