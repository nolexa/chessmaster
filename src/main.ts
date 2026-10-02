import './styles.css';
import type { Color } from './chess';
import { createLearnView } from './learn';
import { createPlayView } from './play-view';
import { createQuizView } from './quiz-view';

// Routes (URL hash):
//   #white/italian/2        learn mode: side / opening / variation number
//   #quiz/black/sicilian    quiz mode: side / opening id or "all"
//   #play/white/italian/0   play mode: side / opening / variation number (0 = any)

type Mode = 'learn' | 'quiz' | 'play';

const learn = createLearnView();
const quiz = createQuizView();
const play = createPlayView();
let mode: Mode = 'learn';

const sideName = (side: Color) => (side === 'w' ? 'white' : 'black');
const parseSide = (name?: string): Color => (name === 'black' ? 'b' : 'w');

function route(): void {
  const [first, second, third, fourth] = location.hash.slice(1).split('/');
  let side: Color;
  if (first === 'quiz') {
    mode = 'quiz';
    learn.hide();
    play.hide();
    quiz.show(parseSide(second), third);
    side = quiz.side;
  } else if (first === 'play') {
    mode = 'play';
    learn.hide();
    quiz.hide();
    play.show(parseSide(second), third, Number(fourth) || 0);
    side = play.side;
  } else {
    mode = 'learn';
    quiz.hide();
    play.hide();
    learn.show(parseSide(first), second, Number(third) || 1);
    side = learn.opening.side;
  }

  document.querySelectorAll<HTMLElement>('.side-btn').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.side === side));
  });
  document.querySelectorAll<HTMLElement>('.mode-btn').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.mode === mode));
  });
}

function currentSide(): Color {
  if (mode === 'quiz') return quiz.side;
  if (mode === 'play') return play.side;
  return learn.opening.side;
}

/** The opening being studied in learn mode, if it belongs to `side`. */
const studied = (side: Color) => (learn.opening.side === side ? learn.opening.id : null);

document.querySelectorAll<HTMLElement>('.side-btn').forEach((b) =>
  b.addEventListener('click', () => {
    const side = b.dataset.side as Color;
    if (mode === 'quiz') location.hash = `#quiz/${sideName(side)}/all`;
    else if (mode === 'play') location.hash = `#play/${sideName(side)}`;
    else location.hash = `#${sideName(side)}`;
  }),
);

document.querySelectorAll<HTMLElement>('.mode-btn').forEach((b) =>
  b.addEventListener('click', () => {
    const side = currentSide();
    if (b.dataset.mode === 'quiz') {
      // Start quizzing on the opening being studied.
      location.hash = `#quiz/${sideName(side)}/${studied(side) ?? 'all'}`;
    } else if (b.dataset.mode === 'play') {
      location.hash = `#play/${sideName(side)}${studied(side) ? `/${studied(side)}` : ''}`;
    } else {
      location.hash = `#${sideName(side)}`;
    }
  }),
);

window.addEventListener('hashchange', route);
route();
