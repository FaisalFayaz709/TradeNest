import { jest } from '@jest/globals';
import { RefundReconciliationService } from '../../src/modules/escrow/refund-reconciliation.service.js';

const id='00000000-0000-4000-8000-000000000777';
const escrowId='00000000-0000-4000-8000-000000000888';
const paymentId='00000000-0000-4000-8000-000000000999';
const operation={id,escrowId,paymentId,actorId:id,disputeId:id,provider:'sandbox',
  amount:{toString:()=> '19.95'},currency:'USD',status:'IN_FLIGHT',attempts:1,requestId:null};
function fixture(result:{provider:string;providerRefundId:string|null;status:string}|Error) {
  let txActive=false;let next=true;
  const refund = {claimDue:jest.fn(async()=>next?(next=false,{id,attempts:1,reconcileOnly:false}):null),
    findById:jest.fn(async()=>operation),lock:jest.fn(),needsReview:jest.fn(),pending:jest.fn(),succeeded:jest.fn()};
  const escrow={lockById:jest.fn(),findById:jest.fn(async()=>({id:escrowId,orderId:id,paymentId,status:'UNDER_REVIEW'})),refund:jest.fn(async()=>true)};
  const tx={runSerializable:jest.fn(async(work:(tx:unknown)=>Promise<unknown>)=>{
    txActive=true;try{return await work({client:{}});}finally{txActive=false;}
  })};
  const payment={refundSucceededPayment:jest.fn(async()=>{
    if(txActive) throw new Error('NETWORK_INSIDE_DB_TRANSACTION');
    if(result instanceof Error) throw result;
    return result;
  })};
  const orders={markRefundedFromEscrowRefund:jest.fn(), paymentContext:jest.fn(async()=>({buyerId:id}))};
  const disputes={completeRefundAfterProvider:jest.fn()};
  const audit={write:jest.fn()};
  const worker=new RefundReconciliationService(refund as never,escrow as never,tx as never,audit as never,
    payment as never,orders as never,{record:jest.fn().mockResolvedValue(undefined)} as never,disputes as never);
  return {worker,refund,escrow,tx,payment,orders,disputes,audit};
}

describe('Financial reconciliation crash-safe refund processing',()=>{
  it('commits escrow, order, dispute and ledger only after verified provider success',async()=>{
    const f=fixture({provider:'sandbox',status:'SUCCEEDED',providerRefundId:'sandbox-refund-1'});
    expect(await f.worker.sweepOnce()).toBe(1);
    expect(f.payment.refundSucceededPayment).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey:`tradenest-refund-${id}`,reconcileOnly:false,
    }));
    expect(f.escrow.refund).toHaveBeenCalledTimes(1);
    expect(f.orders.markRefundedFromEscrowRefund).toHaveBeenCalledTimes(1);
    expect(f.disputes.completeRefundAfterProvider).toHaveBeenCalledTimes(1);
    expect(f.refund.succeeded).toHaveBeenCalledTimes(1);
    expect(f.audit.write).toHaveBeenCalledTimes(1);
    expect(f.refund.needsReview).not.toHaveBeenCalled();
  });
  it('does not mutate escrow on ambiguous network outcomes',async()=>{
    const f=fixture(new Error('network uncertainty'));
    expect(await f.worker.sweepOnce()).toBe(1);
    expect(f.refund.needsReview).toHaveBeenCalledWith(id,1,'PROVIDER_OR_FINALIZATION_UNCERTAIN');
    expect(f.escrow.refund).not.toHaveBeenCalled();
    expect(f.orders.markRefundedFromEscrowRefund).not.toHaveBeenCalled();
  });
  it('defers unconfirmed provider pending outcomes',async()=>{
    const f=fixture({provider:'sandbox',status:'PENDING',providerRefundId:'r_pending'});
    expect(await f.worker.sweepOnce()).toBe(1);
    expect(f.refund.pending).toHaveBeenCalledWith(id,1,'r_pending');
    expect(f.escrow.refund).not.toHaveBeenCalled();
  });
  it('never treats an unrecognized provider result as refunded',async()=>{
    const f=fixture({provider:'sandbox',status:'NEEDS_REVIEW',providerRefundId:null});
    expect(await f.worker.sweepOnce()).toBe(1);
    expect(f.refund.needsReview).toHaveBeenCalledWith(id,1,'PROVIDER_OUTCOME_UNCONFIRMED');
    expect(f.escrow.refund).not.toHaveBeenCalled();
  });
});
