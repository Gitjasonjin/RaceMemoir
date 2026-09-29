import {AppError} from '../i18n/runtime.ts'
import {BACKGROUND_STYLES,resolveBackground} from '../domain/styleCatalog'

type Texture = {tile?:HTMLCanvasElement;promise:Promise<HTMLCanvasElement|null>}
const textures=new Map<string,Texture>()

/** Cache rasterized pixels rather than assuming a separate CSS image is ready. */
export function loadMaterialTexture(id?:string):Texture {
  const material=resolveBackground(id)
  const cached=textures.get(material.texture)
  if(cached)return cached
  const image=new Image()
  const entry:Texture={promise:Promise.resolve(null)}
  image.src=material.texture
  entry.promise=image.decode().then(()=>{
    const tile=document.createElement('canvas')
    // Preview tiles are bounded; don't keep the full-size decoded images in memory.
    tile.width=Math.min(image.naturalWidth,material.tileSize*2,1024)
    tile.height=Math.round(tile.width*image.naturalHeight/image.naturalWidth)
    const context=tile.getContext('2d',{alpha:false})
    if(!context)throw new AppError("materialTexture.001")
    context.drawImage(image,0,0,tile.width,tile.height)
    entry.tile=tile
    return tile
  }).catch(()=>{textures.delete(material.texture);return null})
  textures.set(material.texture,entry)
  return entry
}

export function preloadBackgroundTextures(){BACKGROUND_STYLES.forEach(style=>loadMaterialTexture(style.id))}
