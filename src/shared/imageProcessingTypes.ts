import type {StickerStyle} from '../domain/model'
import type {MedalCrop} from '../items/medal/medalCrop'
import type {MessageKey} from '../i18n/runtime'
import type {DerivedImage} from '../persistence/derivedImageCache'

export interface InspectImageTask {type:'inspect';blob:Blob}
export type RenderImageTask={type:'sticker';blob:Blob;border:number;style:StickerStyle}|{type:'medal';original:Blob;image:Blob;crop?:MedalCrop}
export type ImageTask=InspectImageTask|RenderImageTask
export interface ImageInspection {width:number;height:number;transparent:boolean}
export interface ImageResponse {id:number;result?:DerivedImage|ImageInspection;error?:{key?:MessageKey;message:string}}
