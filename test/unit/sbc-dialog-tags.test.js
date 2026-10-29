const test = require('node:test');
const assert = require('node:assert');
const SipMessage = require('drachtio-srf/lib/sip-parser/message');
const CallInfo = require('../../lib/session/call-info');
const snakeCaseKeys = require('../../lib/utils/snakecase-keys');
const {CallDirection} = require('../../lib/utils/constants');

const makeReq = () => {
  const req = new SipMessage([
    'INVITE sip:+971555551234@example.com SIP/2.0',
    'Call-ID: daa1269b-0b91-1240-9db3-022758ab7fff',
    'From: <sip:+971455550000@example.com>;tag=abc123',
    'To: <sip:+971555551234@example.com>',
    'Content-Length: 0',
    '', ''
  ].join('\r\n'));
  req.srf = {locals: {localSipAddress: '172.30.29.123:5060'}};
  return req;
};

const makeResponse = (headers) => new SipMessage([
  'SIP/2.0 200 OK',
  'Call-ID: carrier-call-id',
  ...headers,
  'Content-Length: 0',
  '', ''
].join('\r\n'));

const makeCallInfo = () => new CallInfo({
  direction: CallDirection.Outbound,
  req: makeReq(),
  to: '+971555551234',
  callSid: '9921be00-ced0-45cb-add1-e02f9ce555ab',
  accountSid: 'e43117dc-4b91-430c-82ad-74d2725f3026',
  applicationSid: '72c5c38f-9bba-40ce-aa83-aaa6be55e1b5',
  traceId: '615e314ac26241863b905931d9aad440'
});

const confirmPayload = (callInfo) => snakeCaseKeys(callInfo.toJSON(), ['customerData', 'sip', 'env_vars', 'args']);

test('a carrier 200 supplies call-id and both dialog tags to the confirm hook', () => {
  const callInfo = makeCallInfo();
  callInfo.captureSbcDialog(makeResponse([
    'X-CID: carrier-call-id',
    'X-SBC-From-Tag: from-tag-1',
    'X-SBC-To-Tag: to-tag-1'
  ]));
  const payload = confirmPayload(callInfo);

  assert.strictEqual(payload.sbc_callid, 'carrier-call-id');
  assert.strictEqual(payload.sbc_from_tag, 'from-tag-1');
  assert.strictEqual(payload.sbc_to_tag, 'to-tag-1');
});

test('a provisional response without a to-tag does not clear a tag from the answer', () => {
  const callInfo = makeCallInfo();
  callInfo.captureSbcDialog(makeResponse([
    'X-CID: carrier-call-id',
    'X-SBC-From-Tag: from-tag-1',
    'X-SBC-To-Tag: to-tag-1'
  ]));
  callInfo.captureSbcDialog(makeResponse([
    'X-CID: carrier-call-id',
    'X-SBC-From-Tag: from-tag-1'
  ]));
  const payload = confirmPayload(callInfo);

  assert.strictEqual(payload.sbc_callid, 'carrier-call-id');
  assert.strictEqual(payload.sbc_from_tag, 'from-tag-1');
  assert.strictEqual(payload.sbc_to_tag, 'to-tag-1');
});

test('confirm hook payload omits the tags when the SBC did not send them', () => {
  const callInfo = makeCallInfo();
  callInfo.captureSbcDialog(makeResponse(['X-CID: carrier-call-id']));
  const payload = confirmPayload(callInfo);

  assert.strictEqual(payload.sbc_callid, 'carrier-call-id');
  assert.ok(!('sbc_from_tag' in payload));
  assert.ok(!('sbc_to_tag' in payload));
});
