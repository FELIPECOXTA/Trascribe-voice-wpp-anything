import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSpeakerTurns } from '../apps/api/providers/elevenlabs';
test('preserva texto original com um locutor',()=>{
 const r=formatSpeakerTurns([{text:'Oi',speaker_id:'speaker_1'}],'Oi');
 assert.equal(r.text,'Oi'); assert.deepEqual(r.speakers,[]);
});
test('separa interlocutores em áudio com várias vozes',()=>{
 const r=formatSpeakerTurns([{text:'Oi.',speaker_id:'speaker_1'},{text:'Tudo bem?',speaker_id:'speaker_2'}],'Oi. Tudo bem?');
 assert.equal(r.text,'[Interlocutor 1]: Oi.\n[Interlocutor 2]: Tudo bem?');
 assert.deepEqual(r.speakers,['Interlocutor 1','Interlocutor 2']);
});
