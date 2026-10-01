import { describe, expect, it } from 'vitest';
import { replay } from '../src/chess';
import { OPENINGS, groupOpenings, openingsFor, sanList } from '../src/openings';

describe('opening library', () => {
  it('has unique opening ids', () => {
    const ids = OPENINGS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has openings for both sides', () => {
    expect(OPENINGS.some((o) => o.side === 'w')).toBe(true);
    expect(OPENINGS.some((o) => o.side === 'b')).toBe(true);
  });

  it('opens each side on a mainstream opening and offers gambits too', () => {
    for (const side of ['w', 'b'] as const) {
      expect(openingsFor(side)[0].gambit).toBeFalsy();
      expect(openingsFor(side).some((o) => o.gambit)).toBe(true);
    }
  });

  it('groups every opening exactly once, by first move, gambits last', () => {
    for (const side of ['w', 'b'] as const) {
      const groups = groupOpenings(side);
      const grouped = groups.flatMap((g) => g.openings);
      expect(new Set(grouped)).toEqual(new Set(openingsFor(side)));
      expect(grouped).toHaveLength(openingsFor(side).length);
      expect(groups.at(-1)!.label).toBe('Gambits');
    }
    expect(groupOpenings('w').map((g) => g.label)).toEqual(['1.e4', '1.d4', '1.c4', '1.Nf3', 'Other first moves', 'Gambits']);
    expect(groupOpenings('b').map((g) => g.label)).toEqual(['Against 1.e4', 'Against 1.d4', 'Gambits']);
  });

  describe.each(OPENINGS)('$name', (opening) => {
    it.each(opening.variations)('$name is a legal line with correct check marks', (variation) => {
      const { moves } = replay(sanList(variation));
      for (const m of moves) {
        expect(/[+#]$/.test(m.san), `check marker on ${m.san}`).toBe(m.check);
      }
    });
  });
});
