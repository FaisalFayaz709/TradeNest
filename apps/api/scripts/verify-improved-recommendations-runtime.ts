import 'dotenv/config';
import { AuthorizationService } from '../src/common/authorization/authorization.service.js';
import { AIBridgeService } from '../src/modules/ai-bridge/ai-bridge.service.js';

const BUYER_ID='10000000-0000-4000-8000-000000000001';
const PRODUCT_ID='40000000-0000-4000-8000-000000000001';
const OTHER_PRODUCT_ID='40000000-0000-4000-8000-000000000002';
const CATEGORY_ID='50000000-0000-4000-8000-000000000001';

async function main(): Promise<void> {
  const analytics={async recentRecommendationEvents(){return [{productId:PRODUCT_ID,eventType:'PURCHASE' as const,occurredAt:'2026-10-06T00:00:00.000Z'}];}};
  const catalog={
    async recommendationCandidates(){return [
      {productId:PRODUCT_ID,categoryId:CATEGORY_ID,name:'Keyboard',description:'Mechanical keyboard'},
      {productId:OTHER_PRODUCT_ID,categoryId:CATEGORY_ID,name:'Keyboard Two',description:'Gaming keyboard'},
    ];},
    async recommendationProductFeature(){return {productId:PRODUCT_ID,categoryId:CATEGORY_ID,name:'Keyboard',description:'Mechanical keyboard'};},
  };
  const ai={
    async personalized(){return {items:[{productId:OTHER_PRODUCT_ID,score:0.88}],modelVersion:'recommendation-hybrid-v2',generatedAt:'2026-10-06T00:00:00.000Z'};},
    async similar(){return {items:[{productId:OTHER_PRODUCT_ID,score:0.77}],modelVersion:'recommendation-hybrid-v2',generatedAt:'2026-10-06T00:00:00.000Z'};},
  };
  const service=new AIBridgeService(new AuthorizationService(),analytics as never,catalog as never,ai as never);
  const principal={userId:BUYER_ID,sessionId:'20000000-0000-4000-8000-000000000001',email:'buyer@example.invalid',name:'Buyer',role:'BUYER' as const};
  const personalized=await service.personalized(principal,{limit:10});
  if(personalized.modelVersion!=='recommendation-hybrid-v2') throw new Error('the implementation model version was not propagated.');
  const similar=await service.similar(PRODUCT_ID,{limit:5});
  if(similar.modelVersion!=='recommendation-hybrid-v2') throw new Error('the implementation similar model version was not propagated.');
  console.log('the implementation IMPROVED RECOMMENDATION RUNTIME VERIFICATION PASSED');
}
await main();
