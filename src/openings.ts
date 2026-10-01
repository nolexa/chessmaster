import type { Color } from './chess';

export interface Variation {
  name: string;
  /** Space-separated SAN moves from the initial position. */
  moves: string;
  idea: string;
}

export interface Opening {
  id: string;
  name: string;
  /** The colour the learner plays. */
  side: Color;
  /** Listed under "Gambits": the learner's side sacrifices material early. */
  gambit?: boolean;
  eco: string;
  summary: string;
  variations: Variation[];
}

export const OPENINGS: Opening[] = [
  // ───────────────────────────── White ─────────────────────────────
  {
    id: 'italian',
    name: 'Italian Game',
    side: 'w',
    eco: 'C50–C58',
    summary: 'Develop quickly and aim the bishop at f7, Black’s weakest point. Classical, principled and a great first opening.',
    variations: [
      {
        name: 'Giuoco Piano (Main Line)',
        moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2 d5 exd5 Nxd5',
        idea: 'White builds a big pawn centre with c3 and d4. After the trades Black gets free play, so White must use the lead in development quickly.',
      },
      {
        name: 'Giuoco Pianissimo',
        moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 a4',
        idea: 'The quiet, modern approach: d3 keeps e4 solid, and White manoeuvres slowly (Nbd2–f1–g3, a4 to stop …b5) before breaking with d4 later.',
      },
      {
        name: 'Evans Gambit',
        moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O',
        idea: 'White gives a pawn to gain time: c3 and d4 come with tempo against the bishop, and White castles into a fast attack on the open centre.',
      },
      {
        name: 'Two Knights: Ng5 Line',
        moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6 Nf3 e4 Ne5',
        idea: 'White wins a pawn by hitting f7, but Black gets rapid development and chases the knight around. Avoid the tempting Nxd5? which allows the Fried Liver trap for Black to exploit.',
      },
    ],
  },
  {
    id: 'ruy-lopez',
    name: 'Ruy Lopez',
    side: 'w',
    eco: 'C60–C99',
    summary: 'The Spanish Game: pressure the knight that defends e5. One of the richest and most respected openings in chess.',
    variations: [
      {
        name: 'Closed (Main Line)',
        moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3',
        idea: 'White prepares d4 with c3, and h3 stops …Bg4 pinning the knight. Long, strategic battles follow with a later Nbd2–f1–g3.',
      },
      {
        name: 'Berlin Defence',
        moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8',
        idea: 'The “Berlin Wall” endgame: queens come off early. White has a healthy kingside majority; Black has the bishop pair but a displaced king.',
      },
      {
        name: 'Exchange Variation',
        moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1',
        idea: 'White gives up the bishop to damage Black’s pawns. In the endgame, White’s 4-vs-3 kingside majority can create a passed pawn; Black’s doubled c-pawns cannot.',
      },
      {
        name: 'Marshall Attack',
        moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5 exd5 Nxd5 Nxe5 Nxe5 Rxe5 c6',
        idea: 'Black sacrifices a pawn for a dangerous kingside attack. As White, know the defensive setup: d4, Re1, and later Qf3 or g3 to hold the king.',
      },
    ],
  },
  {
    id: 'queens-gambit',
    name: "Queen's Gambit",
    side: 'w',
    eco: 'D06–D69',
    summary: 'Offer the c-pawn to deflect Black’s d-pawn and dominate the centre. Solid, strategic and hugely popular at every level.',
    variations: [
      {
        name: 'Declined: Orthodox',
        moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6',
        idea: 'Classical development: the Bg5 pin adds pressure to d5, and Rc1 eyes the c-file. White often aims for a minority attack with b4–b5 later.',
      },
      {
        name: 'Declined: Exchange',
        moves: 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 c6 e3 Be7 Bd3 Nbd7 Qc2',
        idea: 'White fixes the pawn structure early. The standard plan is the minority attack: b4–b5 to create a weak pawn on c6.',
      },
      {
        name: 'Accepted',
        moves: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6',
        idea: 'Black takes the pawn but cannot keep it. White recovers it with Bxc4 and enjoys free development and a slight central edge.',
      },
      {
        name: 'Slav Defence',
        moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O',
        idea: 'Black supports d5 with c6, keeping the light-squared bishop free. a4 stops …b5, and White regains the pawn with a small space advantage.',
      },
    ],
  },
  {
    id: 'london',
    name: 'London System',
    side: 'w',
    eco: 'D02, A48',
    summary: 'A system opening: the same setup (d4, Bf4, e3, Nf3, c3, Nbd2, Bd3) against almost anything. Low theory, solid structure.',
    variations: [
      {
        name: 'Against …d5 and …c5',
        moves: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3',
        idea: 'The pyramid d4–e3–c3 is rock solid. Bg3 keeps the bishop when challenged by …Bd6. Plans include Ne5 and a kingside attack.',
      },
      {
        name: 'Against King’s Indian Setup',
        moves: 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3 c5 c3',
        idea: 'Against a fianchetto, the bishop goes to e2 and h3 gives the f4-bishop a retreat square on h2. White stays compact and flexible.',
      },
    ],
  },
  {
    id: 'english',
    name: 'English Opening',
    side: 'w',
    eco: 'A10–A39',
    summary: 'Start with 1.c4 and control d5 from the flank. Flexible and positional, often with a kingside fianchetto.',
    variations: [
      {
        name: 'Reversed Sicilian',
        moves: 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7',
        idea: 'This is a Sicilian Dragon with colours reversed and an extra tempo for White. The g2-bishop and the c-file put pressure on Black’s queenside.',
      },
      {
        name: 'Symmetrical',
        moves: 'c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 Nf6 O-O O-O d4 cxd4 Nxd4',
        idea: 'Both sides fianchetto. White breaks the symmetry with d4, opening the long diagonal for the g2-bishop.',
      },
      {
        name: 'Botvinnik System',
        moves: 'c4 e5 Nc3 Nc6 g3 g6 Bg2 Bg7 e4 d6 Nge2',
        idea: 'The pawns on c4 and e4 clamp down on d5. White plays for d3, O-O and an f4 break, with a strong grip on the centre.',
      },
    ],
  },

  {
    id: 'kings-gambit',
    name: "King's Gambit",
    side: 'w',
    gambit: true,
    eco: 'C30–C39',
    summary: 'The romantic classic: 2.f4 offers a pawn to tear open the f-file and drag Black’s e-pawn away from the centre.',
    variations: [
      {
        name: 'Accepted: Kieseritzky',
        moves: 'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6 Bc4 d5 exd5 Bd6 d4 Nh5',
        idea: 'When Black tries to hold the extra pawn with …g5, White hits the pawn chain at once with h4. Ne5 is aggressive, and White aims to win back f4 with the better centre.',
      },
      {
        name: 'Accepted: Modern Defence',
        moves: 'e4 e5 f4 exf4 Nf3 d5 exd5 Nf6 Bb5+ c6 dxc6 Nxc6 d4 Bd6',
        idea: 'Black gives the pawn back with …d5 to free the pieces. White keeps a nice centre with d4 and plays to regain f4 with Qe2+ or O-O.',
      },
      {
        name: 'Declined: Classical',
        moves: 'e4 e5 f4 Bc5 Nf3 d6 c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2',
        idea: 'The c5-bishop stops White castling kingside for now. White answers with c3 and d4 to take over the centre with pawns.',
      },
    ],
  },
  {
    id: 'danish',
    name: 'Danish Gambit',
    side: 'w',
    gambit: true,
    eco: 'C21',
    summary: 'Two pawns for two raking bishops. White gets a big lead in development and aims both bishops at Black’s king.',
    variations: [
      {
        name: 'Accepted: Schlechter Defence',
        moves: 'e4 e5 d4 exd4 c3 dxc3 Bc4 cxb2 Bxb2 d5 Bxd5 Nf6 Bxf7+ Kxf7 Qxd8 Bb4+ Qd2 Bxd2+ Nxd2',
        idea: 'Learn this line to know the safest defence. Black gives material back with …d5, and the game turns into an equal endgame, so the real attacking chances come when Black is greedy.',
      },
      {
        name: 'Declined: 3…d5',
        moves: 'e4 e5 d4 exd4 c3 d5 exd5 Qxd5 cxd4 Nc6 Nf3 Bg4 Be2 Bb4+ Nc3',
        idea: 'Black refuses the gambit and hits the centre. White gets an isolated d-pawn but active pieces and easy development.',
      },
    ],
  },
  {
    id: 'smith-morra',
    name: 'Smith-Morra Gambit',
    side: 'w',
    gambit: true,
    eco: 'B21',
    summary: 'An anti-Sicilian gambit: give the c-pawn for fast development and open c- and d-files against Black’s queenside.',
    variations: [
      {
        name: 'Accepted: Classical',
        moves: 'e4 c5 d4 cxd4 c3 dxc3 Nxc3 Nc6 Nf3 d6 Bc4 e6 O-O Nf6 Qe2 Be7 Rd1 e5',
        idea: 'Qe2 and Rd1 load the d-file against the d6-pawn. White has lots of activity; Black must develop carefully and is often happy to give the pawn back.',
      },
      {
        name: 'Declined: 3…Nf6',
        moves: 'e4 c5 d4 cxd4 c3 Nf6 e5 Nd5 Qxd4 e6 Nf3 Nc6 Qe4',
        idea: 'Black refuses the pawn and attacks e4. This transposes to Alapin-style positions, where White keeps an advanced e5-pawn and space.',
      },
    ],
  },
  {
    id: 'scotch-gambit',
    name: 'Scotch Gambit',
    side: 'w',
    gambit: true,
    eco: 'C44',
    summary: 'Open the centre early with d4 and develop Bc4 instead of recapturing. Aggressive and full of tactics against f7.',
    variations: [
      {
        name: 'Main Line (5…d5)',
        moves: 'e4 e5 Nf3 Nc6 d4 exd4 Bc4 Nf6 e5 d5 Bb5 Ne4 Nxd4 Bd7 Bxc6 bxc6 O-O Bc5',
        idea: 'e5 kicks the f6-knight and Black counters in the centre with …d5. White wins the d4-pawn back and has the healthier pawn structure.',
      },
      {
        name: 'Into the Two Knights (4…Nf6 5.O-O)',
        moves: 'e4 e5 Nf3 Nc6 d4 exd4 Bc4 Nf6 O-O Nxe4 Re1 d5 Bxd5 Qxd5 Nc3 Qa5 Nxe4 Be6',
        idea: 'White castles and pins the e4-knight with Re1. The tactics after Bxd5 and Nc3 regain the material with a lead in development.',
      },
    ],
  },

  {
    id: 'scotch',
    name: 'Scotch Game',
    side: 'w',
    eco: 'C45',
    summary: 'Open the centre at once with 3.d4. White trades the e-pawn for free piece play and a space advantage, avoiding the long theory of the Ruy Lopez.',
    variations: [
      {
        name: 'Classical (4…Bc5)',
        moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7 Bc4',
        idea: 'Black develops the bishop with tempo on the d4-knight. White keeps the knight centralised with Be3 and c3, then develops naturally.',
      },
      {
        name: 'Schmidt (4…Nf6)',
        moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4 Ba6',
        idea: 'The Mieses line: White gains space with e5 and c4, and Black gets active pieces. Black’s doubled c-pawns are the long-term target.',
      },
    ],
  },
  {
    id: 'vienna',
    name: 'Vienna Game',
    side: 'w',
    eco: 'C25–C29',
    summary: '2.Nc3 keeps the f-pawn free for an early f4. A flexible, aggressive alternative to 2.Nf3.',
    variations: [
      {
        name: 'Vienna Gambit',
        moves: 'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7 d4 O-O Bd3 f5',
        idea: 'White opens the f-file and gains central space with e5 and d4. Black’s strong e4-knight is the key piece to challenge.',
      },
      {
        name: 'Frankenstein-Dracula',
        moves: 'e4 e5 Nc3 Nf6 Bc4 Nxe4 Qh5 Nd6 Bb3 Nc6 Nb5 g6 Qf3 f5 Qd5 Qe7 Nxc7+ Kd8 Nxa8 b6',
        idea: 'A famous tactical brawl: White wins the exchange but the knight on a8 is trapped. Know it to avoid surprises after 3…Nxe4.',
      },
    ],
  },
  {
    id: 'ponziani',
    name: 'Ponziani Opening',
    side: 'w',
    eco: 'C44',
    summary: '3.c3 prepares d4 to build a full pawn centre. A rare, old opening that sets practical problems.',
    variations: [
      {
        name: 'Main Line (3…Nf6)',
        moves: 'e4 e5 Nf3 Nc6 c3 Nf6 d4 Nxe4 d5 Ne7 Nxe5 Ng6 Bd3 Nxe5 Bxe4',
        idea: 'Black hits e4 at once. White kicks the c6-knight with d5 and wins back the pawn with active pieces.',
      },
      {
        name: 'Jaenisch Counterattack (3…d5)',
        moves: 'e4 e5 Nf3 Nc6 c3 d5 Qa4 f6 Bb5 Ne7 exd5 Qxd5',
        idea: 'Black strikes in the centre. Qa4 and Bb5 pin the c6-knight, and White aims to exploit the loose e5-pawn.',
      },
    ],
  },
  {
    id: 'colle',
    name: 'Colle System',
    side: 'w',
    eco: 'D04–D05',
    summary: 'A solid system: d4, Nf3, e3, Bd3 and quick castling, then a well-timed e4 break or a Zukertort setup with b3 and Bb2.',
    variations: [
      {
        name: 'Colle-Zukertort',
        moves: 'd4 d5 Nf3 Nf6 e3 e6 Bd3 c5 b3 Nc6 O-O Bd6 Bb2 O-O Nbd2',
        idea: 'Both bishops aim at Black’s king. White often plays Ne5 and f4 for a kingside attack.',
      },
      {
        name: 'Classical Colle',
        moves: 'd4 d5 Nf3 Nf6 e3 e6 Bd3 c5 c3 Nc6 Nbd2 Bd6 O-O O-O dxc5 Bxc5 e4',
        idea: 'The c3–d4–e3 triangle supports the e4 break, which opens the position for the d3-bishop.',
      },
    ],
  },
  {
    id: 'trompowsky',
    name: 'Trompowsky Attack',
    side: 'w',
    eco: 'A45',
    summary: '2.Bg5 attacks the f6-knight immediately, threatening to double Black’s pawns. Low theory and lots of original positions.',
    variations: [
      {
        name: '2…Ne4',
        moves: 'd4 Nf6 Bg5 Ne4 Bf4 c5 f3 Qa5+ c3 Nf6 d5',
        idea: 'Black dodges the exchange and counterattacks b2. White gains space with f3 and d5.',
      },
      {
        name: '2…e6',
        moves: 'd4 Nf6 Bg5 e6 e4 h6 Bxf6 Qxf6 Nc3 d6 Qd2 g5',
        idea: 'White gives the bishop for a big centre and fast development, often castling long.',
      },
    ],
  },
  {
    id: 'catalan',
    name: 'Catalan Opening',
    side: 'w',
    eco: 'E01–E09',
    summary: 'Combine the Queen’s Gambit with a kingside fianchetto. The g2-bishop puts long-term pressure on Black’s queenside.',
    variations: [
      {
        name: 'Open (4…dxc4)',
        moves: 'd4 Nf6 c4 e6 g3 d5 Bg2 dxc4 Nf3 Be7 O-O O-O Qc2 a6 Qxc4 b5 Qc2 Bb7 Bd2',
        idea: 'Black takes the pawn; White wins it back with Qc2xc4. The fight is about Black’s queenside development against the g2-bishop.',
      },
      {
        name: 'Closed',
        moves: 'd4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O Nbd7 Qc2 c6 Nbd2 b6 e4 Bb7',
        idea: 'Black holds d5 solidly. White prepares e4 to open the centre and free the pieces.',
      },
    ],
  },
  {
    id: 'reti',
    name: 'Réti Opening',
    side: 'w',
    eco: 'A04–A09',
    summary: 'Hypermodern: start with 1.Nf3 and c4, attack the centre from the flanks, and often fianchetto. Very flexible.',
    variations: [
      {
        name: 'Réti Gambit Accepted',
        moves: 'Nf3 d5 c4 dxc4 e3 Nf6 Bxc4 e6 O-O c5',
        idea: 'Black takes on c4, but White regains it easily with e3 and Bxc4, getting quick development.',
      },
      {
        name: 'Advance (2…d4)',
        moves: 'Nf3 d5 c4 d4 e3 Nc6 exd4 Nxd4 Nxd4 Qxd4 Nc3',
        idea: 'Black grabs space with …d4. White undermines it with e3 and gains time against Black’s queen.',
      },
      {
        name: 'Against the Slav Setup',
        moves: 'Nf3 d5 c4 c6 b3 Nf6 g3 Bf5 Bg2 e6 Bb2 Nbd7 O-O h6',
        idea: 'A double fianchetto: both bishops aim at the centre, and White waits to choose the right pawn break.',
      },
    ],
  },
  {
    id: 'kia',
    name: "King's Indian Attack",
    side: 'w',
    eco: 'A07–A08',
    summary: 'A system with Nf3, g3, Bg2, O-O, d3 and e4: the King’s Indian Defence with colours reversed. Often aims for a kingside attack.',
    variations: [
      {
        name: 'Against the French Setup',
        moves: 'e4 e6 d3 d5 Nd2 Nf6 Ngf3 c5 g3 Nc6 Bg2 Be7 O-O O-O Re1 b5 e5 Nd7',
        idea: 'After e5, White attacks on the kingside (Nf1, h4, Bf4) while Black storms the queenside.',
      },
      {
        name: 'Classical Setup',
        moves: 'Nf3 d5 g3 Nf6 Bg2 c5 O-O Nc6 d3 e6 Nbd2 Be7 e4 O-O Re1',
        idea: 'White completes the setup before playing e4. Re1 supports the e-pawn and prepares e5.',
      },
    ],
  },
  {
    id: 'larsen',
    name: "Larsen's Opening",
    side: 'w',
    eco: 'A01',
    summary: '1.b3 and Bb2: control the long diagonal from the start. A hypermodern surprise weapon.',
    variations: [
      {
        name: 'Modern (1…e5)',
        moves: 'b3 e5 Bb2 Nc6 e3 d5 Bb5 Bd6 f4',
        idea: 'Bb5 pressures the e5-pawn’s defender; f4 hits the centre. White plays against Black’s big centre.',
      },
      {
        name: 'Classical (1…d5)',
        moves: 'b3 d5 Bb2 Nf6 e3 e6 Nf3 c5 c4 Nc6 cxd5 exd5 Be2',
        idea: 'A reversed Queen’s Indian structure: White targets the isolated d5-pawn later.',
      },
    ],
  },
  {
    id: 'bird',
    name: "Bird's Opening",
    side: 'w',
    eco: 'A02–A03',
    summary: '1.f4 controls e5 and often leads to a reversed Dutch Defence. Good for players who like kingside attacks.',
    variations: [
      {
        name: 'Main Line',
        moves: 'f4 d5 Nf3 Nf6 e3 g6 b3 Bg7 Bb2 O-O Be2 c5 O-O Nc6',
        idea: 'White fianchettoes the queen’s bishop to fight for e5, and later plays Qe1–h4 or Ne5 for an attack.',
      },
      {
        name: "From's Gambit (1…e5)",
        moves: 'f4 e5 fxe5 d6 exd6 Bxd6 Nf3 g5 g3 g4 Nh4 Ne7 d4',
        idea: 'Black sacrifices a pawn to attack White’s weakened king. Know the defence: g3, Nh4 and d4 keep White on top.',
      },
    ],
  },

  // ───────────────────────────── Black ─────────────────────────────
  {
    id: 'sicilian',
    name: 'Sicilian Defence',
    side: 'b',
    eco: 'B20–B99',
    summary: 'Answer 1.e4 with 1…c5 for an unbalanced fight. Black gets a central pawn majority and queenside play.',
    variations: [
      {
        name: 'Najdorf',
        moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O',
        idea: '…a6 is flexible: it keeps pieces off b5 and prepares …b5. Against the English Attack (Be3, f3, Qd2) Black plays …e5 and …Be6 to fight for d5.',
      },
      {
        name: 'Dragon',
        moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 Bc4 Bd7 O-O-O',
        idea: 'The g7-bishop breathes fire down the long diagonal. Against the Yugoslav Attack, both sides race: Black attacks on the c-file, White pushes h4–h5.',
      },
      {
        name: 'Sveshnikov',
        moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5 Bxf6 gxf6 Nd5 f5',
        idea: 'Black takes a weak d5 square and damaged pawns in exchange for activity, the bishop pair and the f5 break. Very dynamic.',
      },
      {
        name: 'Against the Alapin (2.c3)',
        moves: 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6',
        idea: 'White wants a full centre with d4. Black hits e4 at once with …Nf6, then challenges the advanced e5-pawn with …d6.',
      },
    ],
  },
  {
    id: 'french',
    name: 'French Defence',
    side: 'b',
    eco: 'C00–C19',
    summary: 'After 1…e6 and 2…d5, Black builds a solid wall and counterattacks White’s centre with …c5 and …f6.',
    variations: [
      {
        name: 'Winawer',
        moves: 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4',
        idea: 'Black pins and trades the c3-knight, doubling White’s pawns. White attacks g7 with Qg4; Black counters on the queenside and in the centre.',
      },
      {
        name: 'Advance',
        moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4',
        idea: 'Black attacks the d4 base of White’s pawn chain with …c5, …Nc6 and …Qb6. …c4 gains queenside space.',
      },
      {
        name: 'Tarrasch',
        moves: 'e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5 c3 Nc6 Ne2 cxd4 cxd4 f6',
        idea: 'Nd2 avoids the Winawer pin. Black undermines both White centre pawns: …c5 hits d4 and …f6 hits e5.',
      },
      {
        name: 'Classical (Steinitz)',
        moves: 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O Nf3 c5',
        idea: 'Black trades off the dark-squared bishops and strikes at the centre with …c5, followed by …Nc6 and …f6.',
      },
    ],
  },
  {
    id: 'caro-kann',
    name: 'Caro-Kann Defence',
    side: 'b',
    eco: 'B10–B19',
    summary: '1…c6 prepares …d5 while keeping the light-squared bishop free. Very solid, with a good endgame structure.',
    variations: [
      {
        name: 'Classical',
        moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6',
        idea: 'The bishop develops outside the pawn chain before …e6. Black accepts less space for a structure with no weaknesses.',
      },
      {
        name: 'Advance',
        moves: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 Nd7 O-O',
        idea: 'Against White’s space, Black develops the bishop to f5 first, then attacks the centre with …c5.',
      },
      {
        name: 'Exchange',
        moves: 'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4 Qb3 Qd7',
        idea: 'A Carlsbad structure with colours reversed. Black develops the bishop to g4 actively and has a comfortable game.',
      },
    ],
  },
  {
    id: 'kings-indian',
    name: "King's Indian Defence",
    side: 'b',
    eco: 'E60–E99',
    summary: 'Let White build a big centre, then strike it with …e5 or …c5. Leads to sharp, attacking positions.',
    variations: [
      {
        name: 'Classical',
        moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7',
        idea: 'After d5 the centre is closed. Black attacks on the kingside with …Ne8/…Nd7 and …f5; White attacks on the queenside.',
      },
      {
        name: 'Sämisch',
        moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3 e5 d5 Nh5 Qd2 f5',
        idea: 'f3 supports e4 and prepares g4. Black meets it with …Nh5 and …f5, fighting for the light squares.',
      },
      {
        name: 'Fianchetto',
        moves: 'd4 Nf6 c4 g6 Nf3 Bg7 g3 O-O Bg2 d6 O-O Nbd7 Nc3 e5 e4',
        idea: 'The quieter approach. Black challenges the centre with …e5 and piece play on the queenside.',
      },
    ],
  },
  {
    id: 'nimzo-indian',
    name: 'Nimzo-Indian Defence',
    side: 'b',
    eco: 'E20–E59',
    summary: '…Bb4 pins the c3-knight to stop e4. Black is often willing to give up the bishop to double White’s pawns.',
    variations: [
      {
        name: 'Rubinstein (4.e3)',
        moves: 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6',
        idea: 'Classical development. Black puts pressure on the c4–d4 centre with …d5, …c5 and …Nc6.',
      },
      {
        name: 'Classical (4.Qc2)',
        moves: 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6 Bg5 Bb7',
        idea: 'Qc2 avoids doubled pawns. Black gives up the bishop pair and fights for the light squares, especially e4, with …b6 and …Bb7.',
      },
    ],
  },
  {
    id: 'scandinavian',
    name: 'Scandinavian Defence',
    side: 'b',
    eco: 'B01',
    summary: 'Challenge e4 at once with 1…d5. Simple to learn, with a clear structure and quick development.',
    variations: [
      {
        name: 'Main Line (3…Qa5)',
        moves: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5 Bd2 e6',
        idea: 'The queen is safe on a5 and pins the c3-knight. Black builds a Caro-Kann-like structure with …c6, …Bf5 and …e6.',
      },
      {
        name: 'Modern (3…Qd6)',
        moves: 'e4 d5 exd5 Qxd5 Nc3 Qd6 d4 Nf6 Nf3 a6 g3 Bg4 Bg2 Nc6',
        idea: 'On d6 the queen controls important dark squares. …a6 stops Nb5, and Black develops actively with …Bg4 and …Nc6.',
      },
      {
        name: 'Marshall (2…Nf6)',
        moves: 'e4 d5 exd5 Nf6 d4 Nxd5 c4 Nb6 Nf3 g6 Nc3 Bg7',
        idea: 'Black recaptures with the knight instead of the queen. White gets a big centre, which Black attacks with the g7-bishop.',
      },
    ],
  },
  {
    id: 'benko',
    name: 'Benko Gambit',
    side: 'b',
    gambit: true,
    eco: 'A57–A59',
    summary: 'Give up the b-pawn for long-term pressure on the a- and b-files. Black’s play lasts deep into the endgame.',
    variations: [
      {
        name: 'Fully Accepted: Fianchetto',
        moves: 'd4 Nf6 c4 c5 d5 b5 cxb5 a6 bxa6 g6 Nc3 Bxa6 Nf3 d6 g3 Bg7 Bg2 O-O O-O Nbd7',
        idea: 'Black’s rooks go to a8 and b8, the queen often to a5, and the g7-bishop covers the long diagonal. Pawn down, but the pressure is long-lasting.',
      },
      {
        name: 'Declined: 5.e3',
        moves: 'd4 Nf6 c4 c5 d5 b5 cxb5 a6 e3 g6 Nc3 Bg7 a4 O-O',
        idea: 'White keeps the extra pawn on b5 and avoids opening the a-file. Black develops normally and aims for …e6 or …axb5 to open lines.',
      },
    ],
  },
  {
    id: 'budapest',
    name: 'Budapest Gambit',
    side: 'b',
    gambit: true,
    eco: 'A51–A52',
    summary: 'A surprise against 1.d4 2.c4: offer the e-pawn and hunt it back with the knights, getting active pieces.',
    variations: [
      {
        name: 'Rubinstein (4.Bf4)',
        moves: 'd4 Nf6 c4 e5 dxe5 Ng4 Bf4 Nc6 Nf3 Bb4+ Nbd2 Qe7 e3 Ngxe5 Nxe5 Nxe5 Be2',
        idea: 'Black piles up on the e5-pawn with …Nc6 and …Qe7 and wins it back. The pin with …Bb4+ makes White’s development awkward.',
      },
      {
        name: 'Alekhine (4.e4)',
        moves: 'd4 Nf6 c4 e5 dxe5 Ng4 e4 Nxe5 f4 Nec6 Be3 Bb4+ Nc3 Qe7',
        idea: 'White gives back the pawn for a huge centre. Black targets it with …Bb4+ and …Qe7, and later strikes with …f5 or …d6.',
      },
    ],
  },
  {
    id: 'albin',
    name: 'Albin Countergambit',
    side: 'b',
    gambit: true,
    eco: 'D08–D09',
    summary: 'Meet the Queen’s Gambit with a counter-gambit: 2…e5! The d4-pawn becomes a wedge that cramps White.',
    variations: [
      {
        name: 'Main Line (5.g3)',
        moves: 'd4 d5 c4 e5 dxe5 d4 Nf3 Nc6 g3 Be6 Nbd2 Qd7 Bg2 O-O-O',
        idea: 'Black castles long and uses the d4-pawn as a spearhead. Plans include …Bh3 and …h5–h4 to attack White’s king.',
      },
      {
        name: 'Lasker Trap (4.e3?)',
        moves: 'd4 d5 c4 e5 dxe5 d4 e3 Bb4+ Bd2 dxe3 Bxb4 exf2+ Ke2 fxg1=N+',
        idea: 'A famous trap to know: if White plays e3?, the pawn marches to f2 and promotes to a knight with check. Black wins material.',
      },
    ],
  },
  {
    id: 'schliemann',
    name: 'Schliemann Gambit',
    side: 'b',
    gambit: true,
    eco: 'C63',
    summary: 'A sharp counter to the Ruy Lopez: 3…f5 hits e4 at once, King’s Gambit-style but with colours reversed.',
    variations: [
      {
        name: 'Main Line (4.Nc3)',
        moves: 'e4 e5 Nf3 Nc6 Bb5 f5 Nc3 fxe4 Nxe4 d5 Nxe5 dxe4 Nxc6 Qg5 Qe2 Nf6 f4 Qxf4 Ne5+ c6 d4 Qh4+ g3 Qh3 Bc4 Be6',
        idea: 'Wild tactics: after …Qg5, Black gets strong central pawns and active pieces in return for a weakened king. Know this line precisely.',
      },
      {
        name: 'Exchange (4.d3)',
        moves: 'e4 e5 Nf3 Nc6 Bb5 f5 d3 fxe4 dxe4 Nf6 O-O Bc5',
        idea: 'White plays safely and keeps the e4-pawn. Black gets an open f-file and quick development, with a playable game.',
      },
    ],
  },
  {
    id: 'petrov',
    name: "Petrov's Defence",
    side: 'b',
    eco: 'C42–C43',
    summary: 'Answer 2.Nf3 with 2…Nf6, counterattacking e4. Extremely solid and symmetrical; a favourite of top players who want a safe game.',
    variations: [
      {
        name: 'Classical (3.Nxe5)',
        moves: 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7 c4 Nb4 Be2 O-O Nc3 Bf5',
        idea: 'Black first kicks the knight with …d6, then takes on e4. The strong e4-knight and active pieces keep Black comfortable.',
      },
      {
        name: 'Steinitz (3.d4)',
        moves: 'e4 e5 Nf3 Nf6 d4 Nxe4 Bd3 d5 Nxe5 Nd7 Nxd7 Bxd7 O-O Bd6',
        idea: 'White opens the centre. Black keeps the knight on e4 supported by …d5 and develops quickly.',
      },
      {
        name: 'Copycat Trap (3…Nxe4?)',
        moves: 'e4 e5 Nf3 Nf6 Nxe5 Nxe4 Qe2 Nf6 Nc6+',
        idea: 'A trap to avoid: copying with 3…Nxe4? runs into Qe2 and a discovered check that wins Black’s queen. Play 3…d6 first!',
      },
    ],
  },
  {
    id: 'philidor',
    name: 'Philidor Defence',
    side: 'b',
    eco: 'C41',
    summary: '2…d6 solidly protects e5. Black accepts a little less space for a sturdy, flexible setup.',
    variations: [
      {
        name: 'Hanham',
        moves: 'e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7 Bc4 Be7 O-O O-O Re1 c6 a4',
        idea: 'Black holds the e5 strongpoint with …Nbd7 and …c6, then looks for …b5 or …exd4 at the right moment.',
      },
      {
        name: 'Exchange (3…exd4)',
        moves: 'e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6 Nc3 Be7 Bf4 O-O Qd2',
        idea: 'Black gives up the centre for easy development and counterplay against the e4-pawn.',
      },
    ],
  },
  {
    id: 'modern',
    name: 'Modern Defence',
    side: 'b',
    eco: 'B06',
    summary: 'Fianchetto at once with 1…g6 and let White build a centre, then attack it. Flexible and hypermodern.',
    variations: [
      {
        name: 'Against the 150 Attack',
        moves: 'e4 g6 d4 Bg7 Nc3 d6 Be3 a6 Qd2 Nd7 f4 b5 Nf3 Bb7',
        idea: 'Black delays …Nf6 and expands on the queenside with …a6 and …b5, aiming the b7-bishop at e4.',
      },
      {
        name: 'Averbakh Setup (3.c4)',
        moves: 'e4 g6 d4 Bg7 c4 d6 Nc3 Nc6 Be3 e5 d5 Nce7',
        idea: 'Against a broad pawn centre Black strikes with …e5 and, after d5, plans …f5 like in the King’s Indian.',
      },
    ],
  },
  {
    id: 'pirc',
    name: 'Pirc Defence',
    side: 'b',
    eco: 'B07–B09',
    summary: '1…d6, …Nf6 and …g6: let White occupy the centre, then undermine it with …c5 or …e5.',
    variations: [
      {
        name: 'Austrian Attack',
        moves: 'e4 d6 d4 Nf6 Nc3 g6 f4 Bg7 Nf3 O-O Bd3 Na6 O-O c5 d5',
        idea: 'White’s big centre is a target. Black hits it with …c5 and uses the long diagonal of the g7-bishop.',
      },
      {
        name: 'Classical',
        moves: 'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O c6 a4 Nbd7',
        idea: 'A calm setup for White. Black prepares …e5 to fight for the centre.',
      },
      {
        name: '150 Attack',
        moves: 'e4 d6 d4 Nf6 Nc3 g6 Be3 c6 Qd2 b5 f3 Nbd7',
        idea: 'White plans Bh6 and h4–h5. Black counters quickly on the queenside with …b5.',
      },
    ],
  },
  {
    id: 'owen',
    name: "Owen's Defence",
    side: 'b',
    eco: 'B00',
    summary: '1…b6 and …Bb7: pressure e4 from the side. Unusual and a good surprise, though White gets a free centre.',
    variations: [
      {
        name: 'Main Line (3.Bd3)',
        moves: 'e4 b6 d4 Bb7 Bd3 e6 Nf3 c5 c3 Nf6 Qe2',
        idea: 'Black attacks the centre with …c5 and keeps the b7-bishop aimed at e4.',
      },
      {
        name: 'With …Bb4 (3.Nc3)',
        moves: 'e4 b6 d4 Bb7 Nc3 e6 Nf3 Bb4 Bd3 Nf6 Qe2',
        idea: 'Black pins the c3-knight to increase pressure on e4, French-style.',
      },
    ],
  },
  {
    id: 'alekhine',
    name: 'Alekhine Defence',
    side: 'b',
    eco: 'B02–B05',
    summary: '1…Nf6 invites White’s pawns forward, then attacks the overextended centre. Provocative and hypermodern.',
    variations: [
      {
        name: 'Modern (4.Nf3)',
        moves: 'e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6 O-O Be7 c4 Nb6 h3 Bh5',
        idea: 'The most popular line. Black pins the f3-knight and challenges the e5-pawn with …d6 and pieces.',
      },
      {
        name: 'Four Pawns Attack',
        moves: 'e4 Nf6 e5 Nd5 d4 d6 c4 Nb6 f4 dxe5 fxe5 Nc6 Be3 Bf5 Nc3 e6 Nf3',
        idea: 'White grabs maximum space. Black develops fast and attacks the centre pawns with …Nc6, …Bf5 and later …f6 or …c5.',
      },
      {
        name: 'Exchange',
        moves: 'e4 Nf6 e5 Nd5 d4 d6 c4 Nb6 exd6 cxd6 Nc3 g6 Be3 Bg7 Rc1 O-O',
        idea: 'White trades on d6 for a space edge. Black fianchettoes and pressures d4.',
      },
    ],
  },
  {
    id: 'grunfeld',
    name: 'Grünfeld Defence',
    side: 'b',
    eco: 'D70–D99',
    summary: 'Let White build a big centre with e4, then attack it with …c5, …Bg7 and …Nc6. Dynamic and deeply theoretical.',
    variations: [
      {
        name: 'Exchange',
        moves: 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Nf3 c5 Rb1 O-O Be2',
        idea: 'White has the big centre; Black targets d4 with the g7-bishop, …c5 and …Nc6.',
      },
      {
        name: 'Russian (5.Qb3)',
        moves: 'd4 Nf6 c4 g6 Nc3 d5 Nf3 Bg7 Qb3 dxc4 Qxc4 O-O e4 a6',
        idea: 'White wins time against d5 and builds a centre. …a6 prepares …b5 to chase the queen.',
      },
    ],
  },
  {
    id: 'benoni',
    name: 'Benoni Defence',
    side: 'b',
    eco: 'A56–A79',
    summary: 'Unbalance the game with …c5 against d4. Black gets queenside play and a strong g7-bishop in exchange for less space.',
    variations: [
      {
        name: 'Modern: Classical',
        moves: 'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6 Nf3 Bg7 Be2 O-O O-O Re8',
        idea: 'Black has a queenside pawn majority and pressure on e4; White pushes for e5 in the centre.',
      },
      {
        name: 'Modern: Fianchetto',
        moves: 'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 Nf3 g6 g3 Bg7 Bg2 O-O O-O',
        idea: 'A calmer setup for White. Black plays …Re8, …Na6–c7 and …b5.',
      },
      {
        name: 'Czech Benoni',
        moves: 'd4 Nf6 c4 c5 d5 e5 Nc3 d6 e4 Be7',
        idea: 'A closed centre. Black regroups slowly and prepares …f5 or …b5.',
      },
    ],
  },
  {
    id: 'queens-indian',
    name: "Queen's Indian Defence",
    side: 'b',
    eco: 'E12–E19',
    summary: 'Fight for the light squares (especially e4) with …b6 and …Bb7 or …Ba6. Solid and positional.',
    variations: [
      {
        name: 'Main Line (4.g3 Ba6)',
        moves: 'd4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7 Bg2 c6 Bc3 d5',
        idea: '…Ba6 hits c4. Black plays …c6 and …d5 to challenge the centre once White is tied down.',
      },
      {
        name: 'Petrosian (4.a3)',
        moves: 'd4 Nf6 c4 e6 Nf3 b6 a3 Bb7 Nc3 d5 cxd5 Nxd5 Qc2',
        idea: 'a3 stops …Bb4. Black challenges the centre with …d5 and keeps the bishop on the long diagonal.',
      },
    ],
  },
  {
    id: 'slav',
    name: 'Slav Defence',
    side: 'b',
    eco: 'D10–D19',
    summary: 'Defend d5 with …c6, keeping the c8-bishop free to develop. One of the most solid answers to the Queen’s Gambit.',
    variations: [
      {
        name: 'Main Line (4…dxc4)',
        moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O O-O',
        idea: 'Black takes on c4 and develops the bishop to f5 before …e6. The pin with …Bb4 keeps White’s e4 under control.',
      },
      {
        name: 'Exchange',
        moves: 'd4 d5 c4 c6 cxd5 cxd5 Nc3 Nf6 Bf4 Nc6 e3 Bf5',
        idea: 'A symmetrical structure. Black copies White’s development and has a very solid position.',
      },
      {
        name: 'Chebanenko (4…a6)',
        moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 a6 e3 b5 b3 Bg4',
        idea: '…a6 prepares …b5 to gain queenside space, keeping options for the c8-bishop.',
      },
    ],
  },
  {
    id: 'chigorin',
    name: 'Chigorin Defence',
    side: 'b',
    eco: 'D07',
    summary: '2…Nc6 against the Queen’s Gambit: piece play instead of pawn structure. Black often gives up the bishop pair for activity.',
    variations: [
      {
        name: 'Main Line (3.Nf3 Bg4)',
        moves: 'd4 d5 c4 Nc6 Nf3 Bg4 cxd5 Bxf3 gxf3 Qxd5 e3 e5 Nc3 Bb4 Bd2 Bxc3 bxc3',
        idea: 'Black damages White’s pawns and strikes with …e5. White has the bishop pair; Black has the better structure.',
      },
      {
        name: '3.Nc3 dxc4',
        moves: 'd4 d5 c4 Nc6 Nc3 dxc4 Nf3 Nf6 e4 Bg4 Be3 e6 Bxc4 Bb4',
        idea: 'Black takes on c4 and pins both knights to pressure White’s centre.',
      },
    ],
  },
  {
    id: 'marshall-defence',
    name: 'Marshall Defence',
    side: 'b',
    eco: 'D06',
    summary: '2…Nf6 against 2.c4. Considered dubious, because White can grab the centre with tempo, but useful to know as a surprise.',
    variations: [
      {
        name: 'Main Line (4.e4)',
        moves: 'd4 d5 c4 Nf6 cxd5 Nxd5 e4 Nf6 Nc3 e5 dxe5 Qxd1+ Kxd1 Ng4',
        idea: 'Black gives up the centre and goes for a queenless position, winning back the e5-pawn with …Ng4.',
      },
    ],
  },
  {
    id: 'baltic',
    name: 'Baltic Defence',
    side: 'b',
    eco: 'D06',
    summary: '2…Bf5 develops the light-squared bishop before …e6. Rare but sound, with clear ideas.',
    variations: [
      {
        name: 'Main Line (3.Nc3)',
        moves: 'd4 d5 c4 Bf5 Nc3 e6 Nf3 c6 Qb3 Qb6 c5 Qxb3 axb3',
        idea: 'White attacks b7; Black offers a queen trade. The endgame is roughly balanced.',
      },
      {
        name: 'Exchange (3.cxd5)',
        moves: 'd4 d5 c4 Bf5 cxd5 Bxb1 Qa4+ c6 dxc6 Nxc6 Rxb1',
        idea: 'Black is a pawn down but gets quick development. Note that d4 is protected by the a4-queen, so don’t grab it.',
      },
    ],
  },
  {
    id: 'bogo-indian',
    name: 'Bogo-Indian Defence',
    side: 'b',
    eco: 'E11',
    summary: '3…Bb4+ against 3.Nf3: a solid cousin of the Nimzo-Indian that gets the bishop out with check.',
    variations: [
      {
        name: '4.Bd2 Qe7',
        moves: 'd4 Nf6 c4 e6 Nf3 Bb4+ Bd2 Qe7 g3 Nc6 Nc3 Bxc3 Bxc3 Ne4 Rc1 O-O Bg2 d6',
        idea: 'Black keeps the bishop until White commits, then trades it for a knight and fights for e5 with …Nc6 and …d6.',
      },
      {
        name: '4.Bd2 Bxd2+',
        moves: 'd4 Nf6 c4 e6 Nf3 Bb4+ Bd2 Bxd2+ Qxd2 O-O g3 d5 Bg2 Nbd7 O-O',
        idea: 'Black trades the bishops at once and sets up a Queen’s Gambit Declined structure.',
      },
      {
        name: '4.Nbd2',
        moves: 'd4 Nf6 c4 e6 Nf3 Bb4+ Nbd2 b6 a3 Bxd2+ Bxd2 Bb7',
        idea: 'White keeps the bishop pair. Black gets quick development and control of e4.',
      },
    ],
  },
  {
    id: 'dutch',
    name: 'Dutch Defence',
    side: 'b',
    eco: 'A80–A99',
    summary: '1…f5 fights for e4 and prepares a kingside attack. Unbalanced and ambitious.',
    variations: [
      {
        name: 'Leningrad',
        moves: 'd4 f5 g3 Nf6 Bg2 g6 Nf3 Bg7 O-O O-O c4 d6 Nc3 Qe8 d5',
        idea: 'A King’s Indian setup with …f5 already played. Black aims for …e5 and kingside play.',
      },
      {
        name: 'Stonewall',
        moves: 'd4 f5 c4 Nf6 g3 e6 Bg2 d5 Nf3 c6 O-O Bd6 b3 Qe7',
        idea: 'Pawns on c6, d5, e6 and f5 give Black a rock-solid centre and an outpost on e4, at the cost of a weak e5 square.',
      },
    ],
  },
];

export const sanList = (v: Variation): string[] => v.moves.trim().split(/\s+/);
export const openingsFor = (side: Color): Opening[] => OPENINGS.filter((o) => o.side === side);
export const findOpening = (id: string): Opening | undefined => OPENINGS.find((o) => o.id === id);

export interface OpeningGroup {
  label: string;
  openings: Opening[];
}

const FIRST_MOVE_ORDER = ['e4', 'd4', 'c4', 'Nf3'];

/**
 * A side's openings grouped by White's first move (as on 365chess.com), with
 * gambits in their own group at the end. Order within a group follows OPENINGS.
 */
export function groupOpenings(side: Color): OpeningGroup[] {
  const groups = new Map<string, Opening[]>();
  const add = (key: string, o: Opening) => groups.set(key, [...(groups.get(key) ?? []), o]);
  for (const o of openingsFor(side)) {
    if (o.gambit) add('gambit', o);
    else {
      const first = sanList(o.variations[0])[0];
      add(FIRST_MOVE_ORDER.includes(first) ? first : 'other', o);
    }
  }
  const label = (key: string) => {
    if (key === 'gambit') return 'Gambits';
    if (key === 'other') return side === 'w' ? 'Other first moves' : 'Against other first moves';
    return side === 'w' ? `1.${key}` : `Against 1.${key}`;
  };
  return [...FIRST_MOVE_ORDER, 'other', 'gambit']
    .filter((key) => groups.has(key))
    .map((key) => ({ label: label(key), openings: groups.get(key)! }));
}
