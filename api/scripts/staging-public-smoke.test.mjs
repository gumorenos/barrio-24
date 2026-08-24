import assert from 'node:assert/strict'
import test from 'node:test'
import { EXPECTED_STAGING } from './staging-constants.mjs'
import { createSyntheticReport, runPublicStagingSmoke } from './staging-public-smoke.mjs'

const EVENT_ID='11111111-1111-4111-8111-111111111111'; const CLIENT_ID='22222222-2222-4222-8222-222222222222'; const OBSERVED_AT='2026-08-24T05:00:00.000Z'
function response(status, body, headers={}) { return new Response(body===null?null:JSON.stringify(body), {status, headers:{'content-type':'application/json',...headers}}) }

test('createSyntheticReport emits only the public v1 contract', () => assert.deepEqual(createSyntheticReport({eventId:EVENT_ID,observedAt:OBSERVED_AT}), {event_id:EVENT_ID,schema_version:1,category:'building-damage',severity:'observed',location_cell:null,observed_at:OBSERVED_AT}))
test('public smoke refuses any non-staging Worker URL', async () => assert.rejects(runPublicStagingSmoke({fetchImpl:async()=>{throw new Error('must not fetch')},baseUrl:'https://example.com'}),/authorized staging Worker/))
test('public smoke refuses any non-staging Pages origin', async () => assert.rejects(runPublicStagingSmoke({fetchImpl:async()=>{throw new Error('must not fetch')},pagesOrigin:'https://example.com'}),/non-staging Pages origin/))
test('public smoke checks health, CORS, create and duplicate contracts without ops routes', async () => {
  const calls=[]; const fetchImpl=async(url,init={})=>{calls.push({url,init}); const index=calls.length; if(index===1)return response(200,{ok:true,service:'barrio24-reports-api',version:1}); if(index===2)return response(204,null,{'access-control-allow-origin':EXPECTED_STAGING.pagesOrigin}); if(index===3)return response(403,{error:'origin_not_allowed'}); if(index===4)return response(202,{event_id:EVENT_ID,status:'unverified',verified:false},{'access-control-allow-origin':EXPECTED_STAGING.pagesOrigin}); if(index===5)return response(409,{event_id:EVENT_ID,status:'unverified',duplicate:true},{'access-control-allow-origin':EXPECTED_STAGING.pagesOrigin}); throw new Error('unexpected fetch')}
  const result=await runPublicStagingSmoke({fetchImpl,clientId:CLIENT_ID,eventId:EVENT_ID,observedAt:OBSERVED_AT}); assert.equal(result.eventId,EVENT_ID); assert.equal(calls.length,5); assert.ok(calls.every(({url})=>url.startsWith(EXPECTED_STAGING.workerUrl))); assert.ok(calls.every(({url})=>!url.includes('/v1/ops/'))); assert.equal(calls[1].init.method,'OPTIONS'); assert.equal(calls[2].init.headers.Origin,'https://not-barrio24.example'); assert.equal(calls[3].init.headers.Origin,EXPECTED_STAGING.pagesOrigin); assert.equal(calls[3].init.headers['X-Client-Id'],CLIENT_ID); assert.deepEqual(JSON.parse(calls[3].init.body),createSyntheticReport({eventId:EVENT_ID,observedAt:OBSERVED_AT}))
})
test('public smoke fails closed on an unexpected create response', async () => {
  let index=0; const fetchImpl=async()=>{index+=1;if(index===1)return response(200,{ok:true,service:'barrio24-reports-api',version:1});if(index===2)return response(204,null,{'access-control-allow-origin':EXPECTED_STAGING.pagesOrigin});if(index===3)return response(403,{error:'origin_not_allowed'});return response(200,{event_id:EVENT_ID,status:'verified'})}; await assert.rejects(runPublicStagingSmoke({fetchImpl,clientId:CLIENT_ID,eventId:EVENT_ID,observedAt:OBSERVED_AT}),/expected HTTP 202, received 200/)
})
