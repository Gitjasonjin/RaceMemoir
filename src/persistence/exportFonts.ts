/** CSS unicode ranges may contain a single code point, interval, or wildcard. */
export function rangeIncludesText(range:string,text:string):boolean{
  if(!range)return true
  const intervals=range.split(',').map(part=>{
    const value=part.trim().replace(/^U\+/i,'')
    const [start,end]=value.split('-')
    return [parseInt(start.replaceAll('?','0'),16),parseInt((end??start).replaceAll('?','F'),16)]
  })
  return Array.from(text).some(character=>{
    const code=character.codePointAt(0)!
    return intervals.some(([start,end])=>code>=start&&code<=end)
  })
}

const normalize=(family:string)=>family.trim().replace(/^['"]|['"]$/g,'')
const fontData=new Map<string,Promise<string>>()
function embedFont(url:string):Promise<string>{
  let pending=fontData.get(url)
  if(!pending){
    pending=fetch(url).then(async response=>{
      if(!response.ok)throw new Error(`Font resource unavailable (${response.status})`)
      const blob=await response.blob()
      return new Promise<string>((resolve,reject)=>{
        const reader=new FileReader()
        reader.onload=()=>resolve(reader.result as string)
        reader.onerror=()=>reject(reader.error)
        reader.readAsDataURL(blob)
      })
    }).catch(error=>{fontData.delete(url);throw error})
    fontData.set(url,pending)
  }
  return pending
}

/** html-to-image otherwise embeds every Japanese subset, even for a single label. */
export async function exportFontCSS(root:HTMLElement):Promise<string>{
  const textByFamily=new Map<string,string>()
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT)
  while(walker.nextNode()){
    const text=walker.currentNode.textContent??'',parent=walker.currentNode.parentElement
    if(!parent||!text.trim()||parent.closest('style,script'))continue
    for(const family of getComputedStyle(parent).fontFamily.split(',').map(normalize)){
      textByFamily.set(family,(textByFamily.get(family)??'')+text)
    }
  }
  const faces:CSSFontFaceRule[]=[]
  function visit(rules:CSSRuleList){
    for(const rule of Array.from(rules)){
      if(rule instanceof CSSFontFaceRule)faces.push(rule)
      else if(rule instanceof CSSImportRule&&rule.styleSheet)visit(rule.styleSheet.cssRules)
      else if('cssRules' in rule)visit((rule as CSSGroupingRule).cssRules)
    }
  }
  // All application styles and fonts are hosted locally, including in production.
  for(const sheet of Array.from(document.styleSheets))visit(sheet.cssRules)
  const selected=faces.filter(face=>{
    const text=textByFamily.get(normalize(face.style.fontFamily))
    return !!text&&rangeIncludesText(face.style.getPropertyValue('unicode-range'),text)
  })
  return (await Promise.all(selected.map(async face=>{
    let css=face.cssText
    for(const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)){
      const url=new URL(match[1],face.parentStyleSheet?.href??document.baseURI).href
      css=css.replace(match[0],`url("${await embedFont(url)}")`)
    }
    return css
  }))).join('\n')
}
