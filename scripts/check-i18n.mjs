import fs from 'node:fs'
import {parse} from '@babel/parser'

const source=JSON.parse(fs.readFileSync('src/i18n/locales/zh-CN.json','utf8'))
const parameters=text=>[...text.matchAll(/{{\s*([^},]+)(?:,[^}]+)?}}/g)].map(m=>m[1]).sort().join(',')
const errors=[]
for(const language of ['en','ja']){
  const translated=JSON.parse(fs.readFileSync(`src/i18n/locales/${language}.json`,'utf8'))
  for(const [key,value] of Object.entries(source)){
    if(!translated[key])errors.push(`${language}: missing ${key}`)
    else if(parameters(translated[key])!==parameters(value))errors.push(`${language}: parameters differ in ${key}`)
    if(language==='en'&&parameters(value).split(',').includes('count')){
      for(const form of ['one','other'])if(!translated[`${key}_${form}`])errors.push(`${language}: missing ${key}_${form}`)
    }
  }
  for(const key of Object.keys(translated))if(!(key in source)){
    const base=key.replace(/_(one|other)$/,'')
    if(base===key||!(base in source))errors.push(`${language}: unknown ${key}`)
    else if(parameters(translated[key])!==parameters(source[base]))errors.push(`${language}: parameters differ in ${key}`)
  }
}
function walk(n,file,parent){
  if(!n||typeof n!=='object')return
  // Existing saved demo content and source geography identifiers are not UI translations.
  if(file==='src/domain/model.ts'&&n.type==='VariableDeclarator'&&n.id.name==='seed')return
  if(file==='src/race-map/raceMapProjection.ts'&&parent?.type==='ObjectProperty'&&parent.key===n)return
  if(['StringLiteral','JSXText','TemplateElement'].includes(n.type)){
    const value=n.type==='TemplateElement'?n.value.cooked:n.value
    if(/\p{Script=Han}/u.test(value))errors.push(`${file}:${n.loc.start.line}: untranslated text ${JSON.stringify(value).slice(0,90)}`)
  }
  for(const [key,value] of Object.entries(n))if(!['loc','comments','leadingComments','trailingComments','innerComments','extra'].includes(key)){
    if(Array.isArray(value))value.forEach(child=>walk(child,file,n));else if(value?.type)walk(value,file,n)
  }
}
function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=`${dir}/${entry.name}`
  if(entry.isDirectory()){if(entry.name!=='i18n')scan(file)}
  else if(/\.tsx?$/.test(file))walk(parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['typescript','jsx']}),file)
}}
scan('src')
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}
else console.log(`Internationalization check passed: ${Object.keys(source).length} keys, 3 languages, no hardcoded Chinese UI copy.`)
