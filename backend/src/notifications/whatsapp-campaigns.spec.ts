import { ConfigService } from '@nestjs/config';
import { buildCampaign, dateIST, productName, WHATSAPP_CAMPAIGNS } from './whatsapp-campaigns';
import { JobsService } from '../common/jobs/jobs.service';
import { NotificationsService } from './notifications.service';

describe('WhatsApp campaign map', () => {
  it('OTP is unchanged: same campaign, the code is the only variable and the copy-code button text', () => {
    expect(buildCampaign('otp', { code: '123456', minutes: 5 })).toEqual({ campaign: 'connectbhai_otp_1', params: ['123456'], copyCode: '123456' });
  });

  it.each([
    ['lead_received', 'Lead Confirm', { name: 'Asha', product: 'BSNL', ref_code: 'CB-000007', executive: 'Ravi' }, ['Asha', 'BSNL', 'CB-000007', 'Ravi']],
    ['lead_followup', 'Connect Bhai_leadfollowup', { name: 'Asha', product: 'Jio' }, ['Asha', 'Jio']],
    ['installation_in_progress', 'Connect Bhai_installation WIP', { name: 'Asha', technician: 'Dream Net', product: 'Airtel', ref_code: 'CB-000007' }, ['Asha', 'Dream Net', 'Airtel', 'CB-000007']],
    ['installed', 'Connect Bhai_activated', { name: 'Asha', product: 'BSNL', plan: '100 Mbps', connection_id: 'CID-9', date: '07 Nov 2026' }, ['Asha', 'BSNL', '100 Mbps', 'CID-9', '07 Nov 2026']],
    ['welcome', 'Connect Bhai _welcome', { name: 'Asha', product: 'BSNL' }, ['Asha', 'BSNL']],
    ['installation_feedback', 'Connect Bhai testing campaign', { name: 'Asha', product: 'BSNL', technician: 'Dream Net' }, ['Asha', 'BSNL', 'Dream Net']],
    ['install_fee_due', 'Connect Bhai testing_payment', { name: 'Dream Net', what: 'install fee for CB-000007', amount: 590, due: '14 Nov 2026' }, ['Dream Net', 'install fee for CB-000007', '590', '14 Nov 2026']],
    ['complaint_registered', 'BSNL Indore_complaint', { name: 'Asha', topic: 'No internet', ticket_code: 'TK-000003', expected: 'within 24 hours' }, ['Asha', 'No internet', 'TK-000003', 'within 24 hours']],
  ])('%s -> "%s" with the variables in template order', (key, campaign, payload, params) => {
    expect(buildCampaign(key, payload)).toEqual({ campaign, params, copyCode: undefined });
  });

  it('messages with no campaign are not sent; empty values become "-" and line breaks are removed (AiSensy rejects empty variables)', () => {
    expect(buildCampaign('new_lead', { ref_code: 'x' })).toBeNull();
    expect(buildCampaign('welcome', { name: '  ', product: 'Two\nlines' })!.params).toEqual(['-', 'Two lines']);
  });

  it('campaign names have no stray spaces, and only the two payment reminders share a campaign', () => {
    const names = Object.values(WHATSAPP_CAMPAIGNS).map((d) => d.campaign);
    names.forEach((n) => expect(n.trim()).toBe(n));
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toEqual(['Connect Bhai testing_payment']);
    expect(buildCampaign('payment_due', { name: 'A', what: 'TIP registration fee', amount: 1180, due: '14 Nov 2026' })).toEqual({ campaign: 'Connect Bhai testing_payment', params: ['A', 'TIP registration fee', '1180', '14 Nov 2026'], copyCode: undefined });
  });

  it('helpers', () => {
    expect(productName({ category: { name: 'BSNL' } })).toBe('BSNL');
    expect(productName(null)).toBe('broadband');
    expect(dateIST(new Date('2026-11-07T10:00:00Z'))).toBe('07 Nov 2026');
  });
});

describe('NotificationsService with AiSensy configured', () => {
  const make = (key = 'k') => {
    const rows: any[] = [];
    const prisma: any = { notification: { create: async ({ data }: any) => { const r = { id: rows.length + 1, ...data }; rows.push(r); return r; }, update: async ({ where, data }: any) => Object.assign(rows[where.id - 1], data) } };
    return { svc: new NotificationsService(prisma, new ConfigService({ AISENSY_API_KEY: key, APP_ENV: 'test' }), new JobsService(new ConfigService({ APP_ENV: 'test' }))), rows };
  };
  let calls: any[];
  beforeEach(() => { calls = []; (global as any).fetch = jest.fn(async (_u: string, init: any) => { calls.push(JSON.parse(init.body)); return { ok: true, status: 200 }; }); });

  it('sends the mapped campaign with the right variables', async () => {
    const { svc, rows } = make();
    await svc.send({ phone: '9811000000', template: 'lead_received', payload: { name: 'Asha', product: 'BSNL', ref_code: 'CB-000007', executive: 'Ravi' } });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ apiKey: 'k', campaignName: 'Lead Confirm', destination: '919811000000', templateParams: ['Asha', 'BSNL', 'CB-000007', 'Ravi'] });
    expect(calls[0].buttons).toBeUndefined();
    expect(rows[0].status).toBe('sent');
  });

  it('OTP still sends the code with the copy-code button', async () => {
    const { svc } = make();
    await svc.send({ phone: '9811000000', template: 'otp', payload: { code: '482913', minutes: 5 } });
    expect(calls[0]).toMatchObject({ campaignName: 'connectbhai_otp_1', templateParams: ['482913'], buttons: [{ type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: '482913' }] }] });
  });

  it('a message with no campaign is recorded as queued and nothing is sent', async () => {
    const { svc, rows } = make();
    await svc.send({ phone: '9811000000', template: 'partner_suspended', payload: { name: 'X' } });
    expect(calls).toHaveLength(0);
    expect(rows[0]).toMatchObject({ status: 'queued', error: expect.stringContaining('No AiSensy campaign') });
  });

  it('a network error or a 5xx is tried again (twice); a 4xx is not', async () => {
    let n = 0; (global as any).fetch = jest.fn(async () => { n++; return n < 3 ? { ok: false, status: 503 } : { ok: true, status: 200 }; });
    const a = make(); await a.svc.send({ phone: '9811000000', template: 'welcome', payload: { name: 'A', product: 'B' } });
    expect(n).toBe(3); expect(a.rows[0].status).toBe('sent');
    n = 0; (global as any).fetch = jest.fn(async () => { n++; return { ok: false, status: 400 }; });
    const b = make(); await b.svc.send({ phone: '9811000000', template: 'welcome', payload: { name: 'A', product: 'B' } });
    expect(n).toBe(1); expect(b.rows[0].status).toBe('failed');
  });

  it('an AiSensy error is recorded as failed and never thrown', async () => {
    (global as any).fetch = jest.fn(async () => ({ ok: false, status: 400 }));
    const { svc, rows } = make();
    await expect(svc.send({ phone: '9811000000', template: 'welcome', payload: { name: 'A', product: 'B' } })).resolves.toBeUndefined();
    expect(rows[0]).toMatchObject({ status: 'failed', error: 'aisensy 400' });
  });

  it('keeps AiSensy\'s own reason in the error so a 400 can be diagnosed', async () => {
    (global as any).fetch = jest.fn(async () => ({ ok: false, status: 400, json: async () => ({ errorMessage: 'Campaign does not exist' }) }));
    const { svc, rows } = make();
    await svc.send({ phone: '9811000000', template: 'welcome', payload: { name: 'A', product: 'B' } });
    expect(rows[0]).toMatchObject({ status: 'failed', error: 'aisensy 400: Campaign does not exist' });
  });
});
