import type {Memory} from '../../domain/model'
import {resolveStyle} from '../../domain/styleCatalog'

export default function NoteArtwork({item}:{item:Memory}){
  const note=resolveStyle('note',item.variant)
  return <div className={`note ${note.className}`}><div className="handwritten">{item.title}</div>{note.smiley && <span className="smiley">◡</span>}</div>
}
