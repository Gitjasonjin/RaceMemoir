import type {Memory,TapeStyle} from '../../domain/model'
import {resolveStyle} from '../../domain/styleCatalog'
import MountainLogo from '../../shared/MountainLogo'
import Trees from './Trees'

export default function BibArtwork({item,tapeStyle='classic'}:{item:Memory;tapeStyle?:TapeStyle}){
  const bib=resolveStyle('bib',item.variant)
  return <div className={`bib paper ${bib.className}`}><i className={`tape tape-left tape-${tapeStyle}`}/><i className={`tape tape-right tape-${tapeStyle}`}/><div className="bib-brand"><MountainLogo/><strong>{item.title}</strong><span>RUN<br/>HIGHER<br/>FURTHER</span></div><div className="bib-number">{item.number}</div><div className="bib-tagline">{bib.tagline}</div><div className="bib-trees"><Trees/><MountainLogo/><Trees/></div></div>
}
