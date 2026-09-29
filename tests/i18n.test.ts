import {test} from 'node:test'
import assert from 'node:assert/strict'
import zh from '../src/i18n/locales/zh-CN.json' with {type:'json'}
import en from '../src/i18n/locales/en.json' with {type:'json'}
import ja from '../src/i18n/locales/ja.json' with {type:'json'}
import {i18n,t,msg,messageText,AppError,errorNotice,resolveLocale,formatDate} from '../src/i18n/runtime.ts'
import {PIN_OPTIONS} from '../src/domain/styleCatalog.ts'
import {seed} from '../src/domain/model.ts'
import {makeZipArchive,readBackup} from '../src/persistence/zipArchive.ts'

const parameters=(s:string)=>[...s.matchAll(/{{\s*([^},]+)(?:,[^}]+)?}}/g)].map(m=>m[1]).sort()
test('all languages cover source keys with matching interpolation parameters',()=>{
 for(const [language,dict] of Object.entries({en,ja}))for(const [key,value] of Object.entries(zh)){
  const text=(dict as Record<string,string>)[key]
  assert.ok(text,`${language} missing ${key}`)
  assert.deepEqual(parameters(text),parameters(value),`${language} parameters in ${key}`)
 }
})
test('language detection honors explicit preference and supports regional variants and fallback',()=>{
 assert.equal(resolveLocale('ja',['en-US']),'ja')
 assert.equal(resolveLocale('bad',['fr-FR','en-GB']),'en')
 assert.equal(resolveLocale(null,['zh-TW']),'zh-CN')
 assert.equal(resolveLocale(null,['ja-JP']),'ja')
 assert.equal(resolveLocale(null,['fr']),'zh-CN')
})
test('deferred errors, nested messages, catalogs and plural forms update without rewriting user values',async context=>{
 context.after(()=>i18n.changeLanguage('zh-CN'))
 const error=new AppError('readImageSize.002'),notice=errorNotice(error,'fallback')
 const user='名称 <script> & {{count}}',nested=msg('editor.nameKind',{kind:msg('App.025')})
 const original=JSON.stringify(seed)
 for(const language of ['en','ja','zh-CN']){
  await i18n.changeLanguage(language)
  assert.equal(messageText(notice),t('readImageSize.002'))
  assert.equal(messageText(nested),t('editor.nameKind',{kind:t('App.025')}))
  assert.ok(t('editor.nameKind',{kind:user}).includes(user))
  assert.equal(PIN_OPTIONS[0].label,t('styleCatalog.024'))
  assert.equal(JSON.stringify(seed),original)
  assert.notEqual(formatDate('2026-09-29'),'Invalid Date')
 }
 await i18n.changeLanguage('en')
 assert.match(t('App.099',{count:1}),/1 medal /)
 assert.match(t('App.099',{count:2}),/2 medals /)
})
test('ZIP remains language-neutral and restores existing user text unchanged',async context=>{
 context.after(()=>i18n.changeLanguage('zh-CN'))
 const board={title:'用户的名字 日本語',items:[{id:'note',kind:'note' as const,title:'原始备注',x:0,y:0,w:160,h:150,rotation:0,variant:'yellow'}],threads:[]}
 await i18n.changeLanguage('ja')
 const result=await readBackup(await makeZipArchive(board,[]))
 assert.deepEqual(result.board,board)
})
