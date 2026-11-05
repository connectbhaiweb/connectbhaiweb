import { TRANSITIONS } from './leads.service';

describe('lead status transitions', () => {
  it('installed and cancelled are terminal', () => {
    expect(TRANSITIONS.installed).toEqual([]);
    expect(TRANSITIONS.cancelled).toEqual([]);
  });
  it('installed and scheduled can never be set by hand', () => {
    for (const s of Object.keys(TRANSITIONS) as (keyof typeof TRANSITIONS)[]) {
      expect(TRANSITIONS[s]).not.toContain('installed');
      expect(TRANSITIONS[s]).not.toContain('scheduled');
    }
  });
  it('a lost lead can only be reopened to follow-up', () => expect(TRANSITIONS.lost).toEqual(['followup']));
  it('open leads can be lost or cancelled', () => {
    for (const s of ['new', 'contacted', 'followup', 'scheduled'] as const) {
      expect(TRANSITIONS[s]).toEqual(expect.arrayContaining(['lost', 'cancelled']));
    }
  });
});
