import {useBlobUrl} from '../../shared/useBlobUrl'
import type {BibRecord} from '../../domain/records'
import type {Memory,TapeStyle} from '../../domain/model'
import {resolveStyle} from '../../domain/styleCatalog'
import MountainLogo from '../../shared/MountainLogo'
import Trees from './Trees'

export default function BibArtwork({item,tapeStyle='classic',record}:{item:Memory;tapeStyle?:TapeStyle;record?:BibRecord}){
  const image=useBlobUrl(record?.image)
  if(record)return <div className="bib-upload">{image&&<img src={image} alt={record.name} draggable={false}/>}<i className={`tape tape-left tape-${tapeStyle}`}/><i className={`tape tape-right tape-${tapeStyle}`}/></div>
  const bib=resolveStyle('bib',item.variant)
  return <div className={`bib paper ${bib.className}`}><i className={`tape tape-left tape-${tapeStyle}`}/><i className={`tape tape-right tape-${tapeStyle}`}/><div className="bib-brand"><MountainLogo/><strong>{item.title}</strong><span>RUN<br/>HIGHER<br/>FURTHER</span></div><div className="bib-number"><span>{item.number}</span></div><div className="bib-tagline">{bib.tagline}</div><div className="bib-trees"><Trees/><MountainLogo/><Trees/></div></div>
}
