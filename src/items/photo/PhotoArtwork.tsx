import {formatDate} from '../../i18n/runtime'
import type {Memory} from '../../domain/model'
import type {CollectionRecord} from '../../domain/records'
import {resolvePhotoPaper} from '../../domain/styleCatalog'
import {useBlobUrl} from '../../shared/useBlobUrl'

export default function PhotoArtwork({item,record}:{item:Memory;record?:CollectionRecord}){
  const photo=resolvePhotoPaper(item.photoPaper,item.variant)
  const photoUrl=useBlobUrl(record?.kind==='photo'?record.image:undefined)
  return <div className={`photo-mount photo-mount-${photo.id}`}><div className={`photo paper ${photo.caption==='footer'?'polaroid':photo.caption==='overlay'?'landscape':''} photo-paper-${photo.id}`}><div className="photo-image"><img style={{position:"absolute",width:`${(item.photoZoom??1)*100}%`,height:`${(item.photoZoom??1)*100}%`,left:`${(1-(item.photoZoom??1))*(item.photoX??50)}%`,top:`${(1-(item.photoZoom??1))*(item.photoY??50)}%`,objectFit:"cover",objectPosition:`${item.photoX??50}% ${item.photoY??50}%`}} src={photoUrl||item.image||undefined} alt={item.title} draggable={false}/>{photo.caption === 'overlay' && <div className="photo-caption handwritten">{item.title}{item.subtitle&&<small className="photo-date">{formatDate(item.subtitle)}</small>}</div>}</div>{photo.caption === 'footer' && <div className="photo-footer handwritten"><span>{item.title}</span>{item.subtitle&&<small className="photo-date">{formatDate(item.subtitle)}</small>}</div>}</div></div>
}
