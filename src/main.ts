import './styles.css';
import type { Color } from './chess';
import { createLearnView } from './learn';
import { createQuizView } from './quiz-view';

// Routes (URL hash):
//   #white/italian/2        learn mode: side / opening / variation number
//   #quiz/black/sicilian    quiz mode: side / opening id or "all"

type Mode = 'learn' | 'quiz';

const learn = createLearnView();
const quiz = createQuizView();
let mode: Mode = 'learn';

const sideName = (side: Color) => (side === 'w' ? 'white' : 'black');
const parseSide = (name?: string): Color => (name === 'black' ? 'b' : 'w');

function route(): void {
  const [first, second, third] = location.hash.slice(1).split('/');
  let side: Color;
  if (first === 'quiz') {
    mode = 'quiz';
    learn.hide();
    quiz.show(parseSide(second), third);
    side = quiz.side;
  } else {
    mode = 'learn';
    quiz.hide();
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
  return mode === 'quiz' ? quiz.side : learn.opening.side;
}

document.querySelectorAll<HTMLElement>('.side-btn').forEach((b) =>
  b.addEventListener('click', () => {
    const side = b.dataset.side as Color;
    location.hash = mode === 'quiz' ? `#quiz/${sideName(side)}/all` : `#${sideName(side)}`;
  }),
);

document.querySelectorAll<HTMLElement>('.mode-btn').forEach((b) =>
  b.addEventListener('click', () => {
    const side = currentSide();
    if (b.dataset.mode === 'quiz') {
      // Start quizzing on the opening being studied.
      location.hash = `#quiz/${sideName(side)}/${learn.opening.side === side ? learn.opening.id : 'all'}`;
    } else {
      location.hash = `#${sideName(side)}`;
    }
  }),
);

window.addEventListener('hashchange', route);
route();
