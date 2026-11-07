import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWhatsAppChat } from '../apps/web/src/services/chatParser';
import type { ExtractedAudioFile } from '../apps/web/src/services/zipParser';
function file(name:string,date:Date,mediaType:'audio'|'image'='audio'):ExtractedAudioFile {
 return {name,cleanName:name.toLowerCase(),size:10,blob:new Blob(['x']),objectUrl:'',mimeType:'audio/ogg',mediaType,status:'idle',fileDate:date};
}
test('não inventa remetente para áudio avulso',()=>{
 const a=file('audio.ogg',new Date('2026-10-01T12:00:00'));
 const r=parseWhatsAppChat('',new Map([[a.name,a]]));
 assert.equal(r.messages[0].sender,'Remetente não identificado');
 assert.equal(r.messages[0].matchConfidence,'unknown');
});
