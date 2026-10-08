import {AppError,formatNumber} from '../i18n/runtime.ts'
import {readImageHeader} from './imageHeader.ts'

// At most 400 MB of RGBA source pixels, plus bounded decoder/processing overhead.
export const MAX_IMPORT_IMAGE_PIXELS=100_000_000
export const MAX_IMPORT_IMAGE_BYTES=80*1024*1024

/** A fresh budget per operation; charge each retained reference, even for shared assets. */
export class ImageImportBudget {
  private pixels=0
  private bytes=0
  async reserve(image:Blob){
    const size=await readImageHeader(image)
    const pixels=size.width*size.height
    if(this.pixels+pixels>MAX_IMPORT_IMAGE_PIXELS||this.bytes+image.size>MAX_IMPORT_IMAGE_BYTES){
      throw new AppError('image.importBudget',{pixels:formatNumber(MAX_IMPORT_IMAGE_PIXELS),mb:MAX_IMPORT_IMAGE_BYTES/1024/1024})
    }
    this.pixels+=pixels;this.bytes+=image.size
    let released=false
    return ()=>{if(!released){this.pixels-=pixels;this.bytes-=image.size;released=true}}
  }
}
