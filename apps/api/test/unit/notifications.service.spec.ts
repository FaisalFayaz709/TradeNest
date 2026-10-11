import { jest } from '@jest/globals';
import { NotificationsService } from '../../src/modules/notifications/notifications.service.js';

describe('Notifications: user-scoped notification boundaries', () => {
  const u1='11111111-1111-4111-8111-111111111111';
  const event={ key:'PAYMENT_SUCCEEDED:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',type:'PAYMENT_SUCCEEDED' as const,
    title:'Payment confirmed',body:'Successful payment verified.',recipients:[u1] };
  it('refuses writing outside a transaction', async () => {
    const repo={createEvent:jest.fn()};
    const svc=new NotificationsService(repo as never);
    await expect(svc.record(event,undefined as never)).rejects.toThrow('originating transaction');
    expect(repo.createEvent).not.toHaveBeenCalled();
  });
  it('passes the same opaque transaction to the repository', async()=>{
    const repo={createEvent:jest.fn().mockResolvedValue(undefined)};
    const svc=new NotificationsService(repo as never);
    const tx={client:{}};
    await svc.record(event,tx as never);
    expect(repo.createEvent).toHaveBeenCalledWith(event,tx);
  });
  it('refuses malformed target ID or event key',async()=>{
    const repo={createEvent:jest.fn()};const svc=new NotificationsService(repo as never);
    await expect(svc.record({...event,recipients:['victim']},{client:{}} as never)).rejects.toThrow();
    await expect(svc.record({...event,key:'arbitrary:bad'},{client:{}} as never)).rejects.toThrow();
    expect(repo.createEvent).not.toHaveBeenCalled();
  });
  it('mark-read cannot discover an unowned notification',async()=>{
    const repo={read:jest.fn().mockResolvedValue({count:0}),findOwned:jest.fn().mockResolvedValue(null)};
    const svc=new NotificationsService(repo as never);
    await expect(svc.markRead({userId:u1} as never,'22222222-2222-4222-8222-222222222222')).rejects.toMatchObject({status:404});
    expect(repo.read).toHaveBeenCalledWith(u1,expect.any(String),expect.any(Date));
    expect(repo.findOwned).toHaveBeenCalledWith(u1,expect.any(String));
  });
});
